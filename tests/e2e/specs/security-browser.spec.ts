import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import sql from "mssql";

test("secure: a foreign-origin HTML login form cannot replace the browser's existing account", async ({ page, context }) => {
  const api = "http://localhost:4002";
  expect((await (await context.request.get(`${api}/api/health`)).json()).data.auditFixture).toBe(true);
  expect((await context.request.post(`${api}/api/auth/login`, { data: { email: "customer.a@bookguard.local", password: "Customer@123" } })).status()).toBe(200);
  const before = (await (await context.request.get(`${api}/api/auth/me`)).json()).data.id;
  const attacker = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><form action="${api}/api/auth/login" method="post"><input name="email" value="customer.b@bookguard.local"><input name="password" value="Customer@123"><button>Submit</button></form>`);
  });
  await new Promise<void>(resolve => attacker.listen(5188, "127.0.0.1", resolve));
  try {
    await page.goto("http://localhost:5188");
    const responsePromise = page.waitForResponse(response => response.url() === `${api}/api/auth/login` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Submit" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("CSRF_REJECTED");
    expect((await (await context.request.get(`${api}/api/auth/me`)).json()).data.id).toBe(before);
  } finally {
    attacker.closeAllConnections(); await new Promise<void>(resolve => attacker.close(() => resolve()));
  }
});

for (const mode of ["baseline", "secure"] as const) {
  const api = `http://localhost:${mode === "secure" ? 4002 : 4001}`;
  const web = `http://localhost:${mode === "secure" ? 5174 : 5173}`;
  test(`${mode}: stored XSS executes only in intentionally vulnerable storefront`, async ({ page, context }) => {
    expect((await (await context.request.get(`${api}/api/health`)).json()).data.auditFixture, "Refusing to mutate a regular API").toBe(true);
    const login = await context.request.post(`${api}/api/auth/login`, { data: { email: "customer.a@bookguard.local", password: "Customer@123" } });
    expect(login.status()).toBe(200); const csrf = (await login.json()).data.csrfToken;
    const marker = `browser-xss-${Date.now()}`;
    const review = await context.request.post(`${api}/api/books/2/reviews`, { headers: csrf ? { "x-csrf-token": csrf } : {}, data: { rating: 5, content: `${marker} <img src=x onerror="window.__bookguardXssExecuted=true">` } });
    expect(review.status()).toBe(201);
    const id = (await review.json()).data.id;
    try {
      await page.goto(`${web}/books/hoang-tu-be`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
      if (mode === "baseline") await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __bookguardXssExecuted?: boolean }).__bookguardXssExecuted))).toBe(true);
      else {
        await expect(page.locator('img[src="x"]')).toHaveCount(0);
        expect(await page.evaluate(() => Boolean((window as unknown as { __bookguardXssExecuted?: boolean }).__bookguardXssExecuted))).toBe(false);
      }
    } finally {
      const pool = await new sql.ConnectionPool({ server: "localhost", database: mode === "secure" ? "BookGuardAuditSecure" : "BookGuardAuditBaseline",
        user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
      try { await pool.request().input("id", sql.Int, id).query("DELETE dbo.Reviews WHERE Id = @id;"); } finally { await pool.close(); }
    }
  });

  test(`${mode}: foreign-origin browser request exercises CORS and trusted-origin tokenless request exercises CSRF`, async ({ page, context }) => {
    expect((await (await context.request.get(`${api}/api/health`)).json()).data.auditFixture, "Refusing to mutate a regular API").toBe(true);
    const login = await context.request.post(`${api}/api/auth/login`, { data: { email: "customer.a@bookguard.local", password: "Customer@123" } });
    expect(login.status()).toBe(200); const csrf = (await login.json()).data.csrfToken;
    const beforeResponse = await context.request.get(`${api}/api/auth/me`); expect(beforeResponse.status()).toBe(200);
    const normalize = (value: Record<string, unknown>) => ({ fullName: value.fullName ?? value.FullName, phone: value.phone ?? value.Phone, addressLine: value.addressLine ?? value.AddressLine });
    const before = normalize((await beforeResponse.json()).data);
    const marker = `Browser CSRF ${Date.now()}`;
    const payload = { fullName: marker, phone: "0900000000", addressLine: "Isolated browser CSRF fixture" };
    // Different port on the same site: SameSite cookies alone cannot block this attacker.
    const attacker = createServer((_req, res) => { res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Local isolated attacker fixture</title>"); });
    await new Promise<void>(resolve => attacker.listen(5188, resolve));
    try {
      await page.goto("http://localhost:5188", { waitUntil: "domcontentloaded" });
      const outcome = await page.evaluate(async ({ api, payload }) => {
        try { return (await fetch(`${api}/api/profile`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status; }
        catch { return "browser-cors-blocked"; }
      }, { api, payload });
      expect(outcome).toBe(mode === "secure" ? "browser-cors-blocked" : 200);
      const after = normalize((await (await context.request.get(`${api}/api/auth/me`)).json()).data);
      expect(after.fullName).toBe(mode === "secure" ? before.fullName : marker);
      if (mode === "secure") {
        await page.goto(web, { waitUntil: "domcontentloaded" });
        const tokenless = await page.evaluate(async ({ api, payload }) => (await fetch(`${api}/api/profile`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })).status, { api, payload });
        expect(tokenless).toBe(403);
        expect((await (await context.request.get(`${api}/api/auth/me`)).json()).data.fullName).toBe(before.fullName);
      }
    } finally {
      await context.request.patch(`${api}/api/profile`, { headers: csrf ? { "x-csrf-token": csrf } : {}, data: { fullName: before.fullName, phone: before.phone || "0900000000", addressLine: before.addressLine || "236 Le Van Sy, Ho Chi Minh" } });
      attacker.closeAllConnections(); await new Promise<void>(resolve => attacker.close(() => resolve()));
    }
  });
}
