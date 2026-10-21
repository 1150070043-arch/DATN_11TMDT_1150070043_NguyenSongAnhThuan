import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sql from "mssql";
import { HttpSession } from "../../security/src/http-session.js";

const api = process.env.SECURE_URL ?? "http://localhost:4002", web = process.env.SECURE_WEB_URL ?? "http://localhost:5174";
const results: Array<{ name: string; passed: boolean }> = [];
const marker = `private-query-${randomUUID()}`;
const requestId = `privacy-${randomUUID()}`;
let pool: sql.ConnectionPool | undefined, userId: number | undefined;
async function step(name: string, action: () => Promise<void>) {
  try { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false }); console.error(`FAIL ${name}`); throw error; }
}

try {
  for (const base of [process.env.BASELINE_URL ?? "http://localhost:4001", api]) {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).data.auditFixture, true, "Refusing to mutate a regular API");
  }
  pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433),
    database: "BookGuardAuditSecure", user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true } }).connect();
  const email = `security-${randomUUID()}@example.test`;
  userId = (await pool.request().input("email", sql.NVarChar(255), email).query(`
    INSERT dbo.Users(Email,PasswordSecret,FullName,RoleId,EmailVerifiedAt)
    OUTPUT INSERTED.Id SELECT @email,PasswordSecret,N'Security fixture',RoleId,SYSUTCDATETIME()
    FROM dbo.Users WHERE Email=N'customer.a@bookguard.local';
  `)).recordset[0]!.Id;
  const loginBody = JSON.stringify({ email, password: "Customer@123" });
  const session = new HttpSession(api);
  await step("foreign-origin form writes are rejected on all six public auth routes before processing", async () => {
    for (const route of ["login", "register", "forgot-password", "reset-password", "verify-email", "resend-verification"]) {
      const response = await fetch(`${api}/api/auth/${route}`, { method: "POST",
        headers: { origin: "http://localhost:5188", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password: "Customer@123" }), redirect: "manual" });
      assert.equal(response.status, 403);
      assert.equal(response.headers.getSetCookie().length, 0);
      assert.equal((await response.json()).error.code, "CSRF_REJECTED");
    }
    assert.equal((await pool!.request().input("user", sql.Int, userId).query("SELECT COUNT(*) AS total FROM dbo.UserSessions WHERE UserId=@user;")).recordset[0]!.total, 0);
  });
  await step("null origins and cross-site browser metadata without an Origin are rejected", async () => {
    for (const headers of [{ origin: "null" }, { "sec-fetch-site": "cross-site" }]) {
      const response = await fetch(`${api}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: loginBody });
      assert.equal(response.status, 403); assert.equal(response.headers.getSetCookie().length, 0);
    }
  });
  await step("trusted-origin login succeeds with protected cookies and cache headers", async () => {
    const response = await session.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: loginBody }, { origin: web });
    assert.equal(response.status, 200);
    const cookies = response.headers.getSetCookie();
    assert.ok(cookies.some(value => value.startsWith("bg_secure_session=") && /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
    assert.ok(cookies.some(value => value.startsWith("bg_secure_refresh=") && /HttpOnly/i.test(value) && /SameSite=Strict/i.test(value)));
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.equal((await session.request("/api/auth/me")).status, 200);
  });
  await step("valid CSRF tokens cannot authorize a write from a foreign origin", async () => {
    const before = await session.request("/api/auth/me");
    const response = await session.request("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: "Foreign mutation" }) }, { origin: "http://localhost:5188" });
    assert.equal(response.status, 403);
    const after = await session.request("/api/auth/me");
    assert.equal((after.body as any).data.fullName, (before.body as any).data.fullName);
  });
  await step("CSRF signatures with an appended component cannot mutate data", async () => {
    const original = session.cookie("bg_secure_csrf")!;
    const invalid = `${original}.extra`;
    session.setCookie("bg_secure_csrf", invalid);
    try {
      const response = await session.request("/api/profile", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": invalid }, body: JSON.stringify({ fullName: "Ambiguous CSRF" }) }, { useCsrf: false, origin: web });
      assert.equal(response.status, 403);
    } finally { session.setCookie("bg_secure_csrf", original); }
  });
  await step("role downgrade immediately blocks both admin reads and writes with an existing admin JWT", async () => {
    await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.Users SET RoleId=(SELECT Id FROM dbo.Roles WHERE Name=N'admin') WHERE Id=@user;");
    const administrator = new HttpSession(api); await administrator.login(email, "Customer@123");
    assert.equal((await administrator.request("/api/admin/users")).status, 200);
    await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.Users SET RoleId=(SELECT Id FROM dbo.Roles WHERE Name=N'customer') WHERE Id=@user;");
    assert.equal((await administrator.request("/api/admin/users")).status, 403);
    assert.equal((await administrator.request("/api/admin/books", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
    assert.equal((await administrator.request("/api/auth/me")).status, 200);
  });
  await step("disabled accounts invalidate existing access immediately", async () => {
    await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.Users SET IsActive=0 WHERE Id=@user;");
    try { assert.equal((await session.request("/api/auth/me")).status, 401); }
    finally { await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.Users SET IsActive=1 WHERE Id=@user;"); }
  });
  await step("changing TokenVersion invalidates existing JWTs", async () => {
    await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.Users SET TokenVersion=TokenVersion+1 WHERE Id=@user;");
    assert.equal((await session.request("/api/auth/me")).status, 401);
    await session.login(email, "Customer@123");
    assert.equal((await session.request("/api/auth/me")).status, 200);
  });
  await step("expired database sessions cannot use an otherwise unexpired JWT", async () => {
    await pool!.request().input("user", sql.Int, userId).query("UPDATE dbo.UserSessions SET ExpiresAt=DATEADD(SECOND,-1,SYSUTCDATETIME()) WHERE UserId=@user;");
    assert.equal((await session.request("/api/auth/me")).status, 401);
    await session.login(email, "Customer@123");
    assert.equal((await session.request("/api/auth/me")).status, 200);
  });
  await step("multipart field amplification and oversized JSON are rejected without storing an upload", async () => {
    const form = new FormData(); form.append("unexpected", "x");
    assert.equal((await session.request("/api/profile/avatar", { method: "POST", body: form })).status, 413);
    assert.equal((await pool!.request().input("user", sql.Int, userId).query("SELECT COUNT(*) AS total FROM dbo.Uploads WHERE UserId=@user;")).recordset[0]!.total, 0);
    const response = await session.request("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: "x".repeat(130 * 1024) }) });
    assert.equal(response.status, 413); assert.equal((response.body as any).stack, undefined);
  });
  await step("security events omit URL queries and validation responses omit server internals", async () => {
    const response = await session.request(`/api/books?limit=invalid&token=${marker}`, { headers: { "x-request-id": requestId } });
    assert.equal(response.status, 422); assert.equal((response.body as any).stack, undefined);
    assert.equal(JSON.stringify(response.body).includes(marker), false);
    const records = (await pool!.request().input("request", sql.NVarChar(80), requestId).query("SELECT Path,Details FROM dbo.SecurityEvents WHERE RequestId=@request;")).recordset;
    assert.ok(records.length > 0); assert.ok(records.every(row => row.Path === "/api/books"));
    assert.equal(JSON.stringify(records).includes(marker), false);
    const badId = await session.request("/api/health", { headers: { "x-request-id": "invalid id <script>" } });
    assert.match(badId.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/i);
    const malformed = await session.request("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: '{"fullName":' });
    assert.equal(malformed.status, 400); assert.equal((malformed.body as any).error.code, "MALFORMED_JSON");
  });
  await step("logout revokes the server session even when the old cookie is replayed", async () => {
    const oldCookie = session.cookie("bg_secure_session")!;
    assert.equal((await session.request("/api/auth/logout", { method: "POST" })).status, 204);
    session.setCookie("bg_secure_session", oldCookie);
    assert.equal((await session.request("/api/auth/me")).status, 401);
  });
} catch {
  console.error("Security hardening regression failed; inspect the last named check. Credentials are never printed.");
  process.exitCode = 1;
} finally {
  if (pool && userId) await pool.request().input("user", sql.Int, userId).query(`
    DELETE dbo.RefreshTokens WHERE UserId=@user; DELETE dbo.UserSessions WHERE UserId=@user;
    DELETE dbo.PasswordResetTokens WHERE UserId=@user; DELETE dbo.EmailVerificationTokens WHERE UserId=@user;
    DELETE dbo.Uploads WHERE UserId=@user; DELETE dbo.SecurityEvents WHERE UserId=@user;
    DELETE dbo.Users WHERE Id=@user;
  `);
  await pool?.close();
}
const report = { generatedAt: new Date().toISOString(), fixture: "Isolated audit SQL and real secure API", passed: results.length === 12 && results.every(row => row.passed), results };
await mkdir("../../reports/security-hardening", { recursive: true });
await writeFile("../../reports/security-hardening/sql-regressions.json", JSON.stringify(report, null, 2));
// The marker is synthetic; a separate runtime check confirms it is absent in logs.
await writeFile("../../reports/security-hardening/privacy-probe.json", JSON.stringify({ marker, requestId }, null, 2));
if (!report.passed) process.exitCode = 1;
