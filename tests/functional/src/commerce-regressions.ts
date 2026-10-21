import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sql from "mssql";
import { ResettingConnectionPool } from "../../../apps/api/src/db/resetting-pool.js";
import { HttpSession, type SessionResponse } from "../../security/src/http-session.js";

// These fixtures may only mutate the dedicated audit databases.
const results: Array<{ mode: string; name: string; passed: boolean; evidence: string }> = [];
const fixtureSecret = "audit-fixture-key-not-a-real-merchant";
const body = { customerName: "Commerce regression", phone: "0987000001", shippingAddress: "236 Le Van Sy, Ho Chi Minh", note: "Isolated audit fixture" };
function data<T>(response: SessionResponse): T { return (response.body as { data: T }).data; }
function json(method: string, value: unknown, extra: Record<string, string> = {}) {
  return { method, headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(value) };
}
async function run(mode: "baseline" | "secure") {
  const database = mode === "secure" ? "BookGuardAuditSecure" : "BookGuardAuditBaseline";
  const pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database,
    user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true } }).connect();
  const base = mode === "secure" ? process.env.SECURE_URL ?? "http://localhost:4002" : process.env.BASELINE_URL ?? "http://localhost:4001";
  const a = new HttpSession(base), b = new HttpSession(base), admin = new HttpSession(base);
  const step = async (name: string, action: () => Promise<string>) => {
    try { const evidence = await action(); results.push({ mode, name, passed: true, evidence }); console.log(`${mode}: PASS ${name}`); }
    catch (cause) { results.push({ mode, name, passed: false, evidence: cause instanceof Error ? cause.message : String(cause) }); throw cause; }
  };
  async function clear(session: HttpSession) {
    const response = await session.request("/api/cart"); assert.equal(response.status, 200);
    for (const item of data<{ items: Array<{ id: number }> }>(response).items) assert.equal((await session.request(`/api/cart/items/${item.id}`, { method: "DELETE" })).status, 204);
  }
  async function add(session: HttpSession, bookId: number, quantity = 1) {
    const response = await session.request("/api/cart/items", json("POST", { bookId, quantity })); assert.equal(response.status, 201, JSON.stringify(response.body));
  }
  async function checkout(session: HttpSession, value: Record<string, unknown> = {}, key = randomUUID()) {
    return session.request("/api/orders", json("POST", { ...body, ...value }, { "idempotency-key": key }));
  }
  async function cancel(session: HttpSession, id: number) { return session.request(`/api/orders/${id}/cancel`, { method: "PATCH" }); }
  async function order(id: number) { return (await pool.request().input("id", sql.Int, id).query(`SELECT * FROM dbo.Orders WHERE Id = @id;`)).recordset[0]!; }
  async function stock(id: number) { return Number((await pool.request().input("id", sql.Int, id).query(`SELECT Stock FROM dbo.Books WHERE Id = @id;`)).recordset[0]!.Stock); }
  async function ipn(url: string, overrides: Record<string, string> = {}) {
    const params = new URL(url).searchParams;
    const query = { vnp_TmnCode: "AUDITONLY", vnp_TxnRef: params.get("vnp_TxnRef")!, vnp_Amount: params.get("vnp_Amount")!,
      vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: String(Math.floor(Math.random() * 1e12) + 1), ...overrides };
    const encode = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
    const signed = Object.keys(query).sort().map(key => `${encode(key)}=${encode(query[key as keyof typeof query])}`).join("&");
    const hash = createHmac("sha512", fixtureSecret).update(signed).digest("hex");
    const response = await fetch(`${base}/api/payments/vnpay-ipn?${signed}&vnp_SecureHash=${hash}`);
    return (await response.json()) as { RspCode: string };
  }
  async function newBook(stockValue: number) {
    const slug = `audit-${randomUUID()}`;
    const response = await admin.request("/api/admin/books", json("POST", { title: "Audit commerce fixture", slug, author: "Audit fixture", description: "Temporary fixture for database transaction regressions", price: 100000, stock: stockValue, categoryId: 1, coverUrl: "" }));
    assert.equal(response.status, 201, JSON.stringify(response.body)); return data<{ id: number }>(response).id;
  }
  try {
    const health = await new HttpSession(base).request("/api/health");
    assert.equal(health.status, 200);
    assert.equal(data<{ auditFixture: boolean }>(health).auditFixture, true, "Refusing to mutate a regular API: start the audit compose overlay first");
    await a.login(); await b.login("customer.b@bookguard.local", "Customer@123"); await admin.login("admin@bookguard.local", "Admin@12345");
    await clear(a); await clear(b);
    await step("migration v8 and encrypted SQL connection", async () => {
      const schema = await pool.query("SELECT MAX(Version) AS version FROM dbo.SchemaMigrations;"); assert.equal(schema.recordset[0]?.version, 8);
      const transport = await pool.query("SELECT encrypt_option FROM sys.dm_exec_connections WHERE session_id = @@SPID;"); assert.equal(transport.recordset[0]?.encrypt_option, "TRUE");
      return "Schema v8; SQL session encrypted";
    });
    await step("pool resets isolation after committed and rolled-back transactions", async () => {
      const isolated = await new ResettingConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database,
        user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD,
        options: { encrypt: true, trustServerCertificate: true }, pool: { min: 1, max: 1 } }).connect();
      try {
        for (const finish of ["commit", "rollback"] as const) {
          const transaction = new sql.Transaction(isolated);
          await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
          const inside = await transaction.request().query("SELECT transaction_isolation_level AS level FROM sys.dm_exec_sessions WHERE session_id = @@SPID;");
          assert.equal(inside.recordset[0]?.level, 4);
          await transaction[finish]();
          const outside = await isolated.query("SELECT transaction_isolation_level AS level FROM sys.dm_exec_sessions WHERE session_id = @@SPID;");
          assert.equal(outside.recordset[0]?.level, 2, `Connection must return to READ COMMITTED after ${finish}`);
        }
      } finally { await isolated.close(); }
      return "Single-connection pool: SERIALIZABLE inside transaction, READ COMMITTED on reuse after both commit and rollback";
    });
    await step("concurrent identical checkout and cancel change stock exactly once", async () => {
      const before = await stock(1); await add(a, 1, 2); const key = randomUUID();
      const responses = await Promise.all([checkout(a, {}, key), checkout(a, {}, key)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 201], JSON.stringify(responses.map(r => r.body)));
      const ids = responses.map(r => data<{ id: number }>(r).id); assert.equal(ids[0], ids[1]); assert.equal(await stock(1), before - 2);
      const cancellations = await Promise.all([cancel(a, ids[0]!), cancel(a, ids[0]!)]);
      assert.deepEqual(cancellations.map(r => r.status).sort(), [200, 409]); assert.equal(await stock(1), before);
      const movement = await pool.request().input("id", sql.Int, ids[0]).query("SELECT MovementType, COUNT(*) AS total FROM dbo.InventoryMovements WHERE ReferenceType = N'order' AND ReferenceId = @id GROUP BY MovementType;");
      assert.equal(movement.recordset.length, 2); assert.ok(movement.recordset.every(row => row.total === 1));
      return `Order ${ids[0]}: one sale, one return; stock ${before} restored`;
    });
    await step("two customers compete for last book without overselling", async () => {
      const id = await newBook(1); await add(a, id); await add(b, id);
      const responses = await Promise.all([checkout(a), checkout(b)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409], JSON.stringify(responses.map(r => r.body))); assert.equal(await stock(id), 0);
      const winner = responses[0]!.status === 201 ? a : b; const created = responses.find(r => r.status === 201)!;
      assert.equal((await cancel(winner, data<{ id: number }>(created).id)).status, 200); assert.equal(await stock(id), 1);
      await clear(a); await clear(b); return "Exactly one customer buys the last copy; cancellation restores one copy";
    });
    await step("coupon last use is atomic and cancellation releases it once", async () => {
      const code = `AUDIT_${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      const coupon = await admin.request("/api/admin/coupons", json("POST", { code, discountType: "fixed", discountValue: 15000, usageLimit: 1, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString() })); assert.equal(coupon.status, 201);
      const id = await newBook(10); await add(a, id); await add(b, id);
      const quoted = await a.request("/api/orders/quote", json("POST", { couponCode: code })); assert.equal(quoted.status, 200); assert.equal(data<{ total: number }>(quoted).total, 85000);
      const responses = await Promise.all([checkout(a, { couponCode: code }), checkout(b, { couponCode: code })]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 422], JSON.stringify(responses.map(r => r.body)));
      const winner = responses[0]!.status === 201 ? a : b; const created = data<{ id: number; total: number }>(responses.find(r => r.status === 201)!); assert.equal(created.total, 85000);
      assert.equal((await pool.request().input("code", sql.NVarChar(40), code).query("SELECT UsedCount FROM dbo.Coupons WHERE Code = @code;")).recordset[0]?.UsedCount, 1);
      assert.equal((await cancel(winner, created.id)).status, 200); assert.equal((await cancel(winner, created.id)).status, 409);
      assert.equal((await pool.request().input("code", sql.NVarChar(40), code).query("SELECT UsedCount FROM dbo.Coupons WHERE Code = @code;")).recordset[0]?.UsedCount, 0);
      await clear(a); await clear(b); return "One coupon redemption; quote and checkout agree; release is idempotent";
    });
    await step("VNPay retry reuses live URL, old success settles and duplicate money enters review", async () => {
      await add(a, 1); const response = await checkout(a, { paymentMethod: "vnpay" }); assert.equal(response.status, 201);
      const created = data<{ id: number; paymentUrl: string }>(response);
      const retry = await a.request(`/api/payments/${created.id}/pay`, { method: "POST" }); assert.equal(retry.status, 200); assert.equal(data<{ paymentUrl: string }>(retry).paymentUrl, created.paymentUrl);
      await pool.request().input("id", sql.Int, created.id).query("UPDATE dbo.PaymentAttempts SET ExpiresAt = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE OrderId = @id;");
      const newer = await a.request(`/api/payments/${created.id}/pay`, { method: "POST" }); assert.equal(newer.status, 200); const newerUrl = data<{ paymentUrl: string }>(newer).paymentUrl; assert.notEqual(newerUrl, created.paymentUrl);
      assert.equal((await ipn(created.paymentUrl, { vnp_Amount: "100" })).RspCode, "04"); assert.equal((await order(created.id)).PaymentStatus, "unpaid");
      const replies = await Promise.all([ipn(created.paymentUrl), ipn(created.paymentUrl)]); assert.deepEqual(replies.map(r => r.RspCode).sort(), ["00", "02"]);
      assert.equal((await order(created.id)).PaymentStatus, "paid"); assert.equal((await order(created.id)).Status, "confirmed");
      assert.equal((await ipn(newerUrl)).RspCode, "00");
      const saved = await pool.request().input("id", sql.Int, created.id).query("SELECT State, NeedsReview FROM dbo.PaymentAttempts WHERE OrderId = @id ORDER BY Id;"); assert.equal(saved.recordset.length, 2); assert.equal(saved.recordset[1]?.NeedsReview, true);
      const reviews = await admin.request("/api/admin/payment-reconciliation"); assert.equal(reviews.status, 200); assert.ok(data<Array<{ orderId: number }>>(reviews).some(row => row.orderId === created.id));
      return `Order ${created.id}: old reference accepted; concurrent replay prevented; extra receipt flagged`;
    });
    await step("cancelled order receives late money without restoring order and refund confirmation is audited", async () => {
      const before = await stock(1); await add(a, 1); const response = await checkout(a, { paymentMethod: "vnpay" }); assert.equal(response.status, 201);
      const created = data<{ id: number; paymentUrl: string }>(response); assert.equal((await cancel(a, created.id)).status, 200); assert.equal(await stock(1), before);
      assert.equal((await ipn(created.paymentUrl)).RspCode, "00"); const saved = await order(created.id); assert.equal(saved.Status, "cancelled"); assert.equal(saved.PaymentStatus, "refund_pending"); assert.equal(await stock(1), before);
      const attempt = (await pool.request().input("id", sql.Int, created.id).query("SELECT Id FROM dbo.PaymentAttempts WHERE OrderId = @id;")).recordset[0]!.Id;
      const refundBody = { providerReference: `AUDIT-REFUND-${created.id}`, note: "Fixture only: simulates a refund confirmed by provider" };
      if (mode === "secure") assert.equal((await a.request(`/api/admin/payment-reconciliation/${attempt}/refund-confirmation`, json("POST", refundBody))).status, 403);
      const refunded = await admin.request(`/api/admin/payment-reconciliation/${attempt}/refund-confirmation`, json("POST", refundBody)); assert.equal(refunded.status, 200);
      assert.equal((await order(created.id)).PaymentStatus, "refunded"); assert.equal((await ipn(created.paymentUrl)).RspCode, "02");
      assert.equal((await admin.request(`/api/admin/payment-reconciliation/${attempt}/refund-confirmation`, json("POST", refundBody))).status, 200);
      const events = await pool.request().input("id", sql.NVarChar(80), String(attempt)).query("SELECT COUNT(*) AS total FROM dbo.AdminAuditEvents WHERE Action = N'payment.refund_recorded' AND EntityId = @id;"); assert.equal(events.recordset[0]?.total, 1);
      return "Late money persisted as refund_pending; no stock/state resurrection; one audited refund record";
    });
    await step("continuous outbox drains backlog and only reclaims expired leases", async () => {
      const orderId = (await pool.query("SELECT TOP 1 Id FROM dbo.Orders ORDER BY Id;")).recordset[0]!.Id;
      const suffix = randomUUID();
      const backlogEmail = `outbox-${suffix}@bookguard.local`, liveEmail = `live-${suffix}@bookguard.local`, expiredEmail = `expired-${suffix}@bookguard.local`;
      await pool.request().input("id", sql.Int, orderId).input("backlog", sql.NVarChar(180), backlogEmail).input("live", sql.NVarChar(180), liveEmail).input("expired", sql.NVarChar(180), expiredEmail).query(`
        INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus)
        SELECT @id, @backlog, N'pending' FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),(21),(22),(23),(24),(25)) AS backlog(n);
        INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus, DeliveryState, AttemptCount, LeaseToken, LeaseUntil, CreatedAt)
        VALUES (@id, @live, N'pending', N'processing', 1, NEWID(), DATEADD(MINUTE, 2, SYSUTCDATETIME()), DATEADD(DAY, -1, SYSUTCDATETIME())),
               (@id, @expired, N'pending', N'processing', 1, NEWID(), DATEADD(SECOND, -1, SYSUTCDATETIME()), SYSUTCDATETIME());
      `);
      let rows: Array<{ RecipientEmail: string; DeliveryState: string; AttemptCount: number }> = [];
      for (let i = 0; i < 25; i++) {
        rows = (await pool.request().input("backlog", sql.NVarChar(180), backlogEmail).input("live", sql.NVarChar(180), liveEmail).input("expired", sql.NVarChar(180), expiredEmail).query("SELECT RecipientEmail, DeliveryState, AttemptCount FROM dbo.OrderNotifications WHERE RecipientEmail IN (@backlog, @live, @expired);")).recordset;
        if (rows.filter(r => r.DeliveryState === "sent").length === 26) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      assert.equal(rows.filter(r => r.DeliveryState === "sent").length, 26); assert.equal(rows.find(r => r.RecipientEmail === liveEmail)?.DeliveryState, "processing"); assert.equal(rows.find(r => r.RecipientEmail === expiredEmail)?.AttemptCount, 2);
      await pool.request().input("live", sql.NVarChar(180), liveEmail).query("UPDATE dbo.OrderNotifications SET LeaseUntil = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE RecipientEmail = @live;");
      return "Backlog >20 drains without restart; expired lease recovered; old createdAt with live lease untouched";
    });
    await step("concurrent logins isolate accounts and keep the ten-session cap", async () => {
      const sessions: HttpSession[][] = [[], []];
      for (let round = 0; round < 6; round++) {
        const requests = [];
        for (let account = 0; account < 2; account++) for (let copy = 0; copy < 2; copy++) {
          const session = new HttpSession(base); sessions[account]!.push(session);
          requests.push(session.login(account === 0 ? "customer.a@bookguard.local" : "customer.b@bookguard.local", "Customer@123"));
        }
        await Promise.all(requests);
      }
      const counts = await pool.query(`SELECT u.Email, COUNT(*) AS total FROM dbo.UserSessions s INNER JOIN dbo.Users u ON u.Id = s.UserId
        WHERE u.Email IN (N'customer.a@bookguard.local', N'customer.b@bookguard.local') AND s.RevokedAt IS NULL AND s.ExpiresAt > SYSUTCDATETIME() GROUP BY u.Email;`);
      assert.equal(counts.recordset.length, 2); assert.ok(counts.recordset.every(row => row.total === 10), JSON.stringify(counts.recordset));
      if (mode === "secure") for (const [index, account] of sessions.entries()) {
        assert.equal((await (index === 0 ? a : b).request("/api/auth/me")).status, 401);
        assert.equal((await account.at(-1)!.request("/api/auth/me")).status, 200);
        assert.equal((await account.at(-1)!.request("/api/auth/logout", { method: "POST" })).status, 204);
      }
      return "24 concurrent logins across two accounts succeed; active-session cap is 10; Secure rejects evicted sessions";
    });
    if (mode === "secure") await step("runtime SQL cannot change migrations, erase audit or create tables", async () => {
      const runtime = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database, user: "bookguard_audit_secure", password: process.env.SECURE_DB_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
      try {
        for (const statement of ["UPDATE dbo.SchemaMigrations SET Name = Name WHERE Version = 5;", "DELETE dbo.SecurityEvents WHERE 1 = 0;", "UPDATE dbo.AdminAuditEvents SET Action = Action WHERE 1 = 0;", "CREATE TABLE dbo.RuntimePermissionProbe (Id INT);"]) await assert.rejects(runtime.query(statement));
        assert.equal((await runtime.query("SELECT MAX(Version) AS version FROM dbo.SchemaMigrations;")).recordset[0]?.version, 8);
      } finally { await runtime.close(); }
      return "SELECT health allowed; protected writes and DDL denied";
    });
  } finally { await pool.close(); }
}
try { await run("baseline"); await run("secure"); }
catch (cause) { console.error(cause instanceof Error ? cause.message : String(cause)); process.exitCode = 1; }
const report = { generatedAt: new Date().toISOString(), fixture: "isolated audit SQL; signed VNPay simulation, no provider transaction", passed: results.every(item => item.passed) && results.length === 19, results };
const dir = path.resolve(process.cwd(), "../../reports/generated"); await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "commerce-regressions.json"), JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
