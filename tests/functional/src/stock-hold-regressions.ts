import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import sql from "mssql";
import { HttpSession, type SessionResponse } from "../../security/src/http-session.js";

const secret = "stock-hold-regression-only-secret";
Object.assign(process.env, { NODE_ENV: "test", SECURITY_MODE: "secure", DB_NAME: "BookGuardAuditSecure", DB_USER: "bookguard_audit_secure",
  VNPAY_TMN_CODE: "AUDITONLY", VNPAY_HASH_SECRET: secret, VNPAY_QUERY_ENABLED: "false",
  STOCK_HOLD_ENABLED: "true", STOCK_HOLD_MINUTES: "30", STOCK_HOLD_GRACE_MINUTES: "5",
  SMTP_HOST: "localhost", SMTP_PORT: process.env.TEST_SMTP_PORT ?? "1025", SMTP_SECURE: "false", SMTP_USER: "", SMTP_PASSWORD: "" });
delete process.env.ALERT_WEBHOOK_URL;
const { logger } = await import("../../../apps/api/src/lib/logger.js");
const logs: unknown[] = [];
for (const level of ["info", "warn", "error"] as const) logger[level] = (event, details) => { logs.push({ event, ...details }); };
const { createApp } = await import("../../../apps/api/src/app.js");
const { getPool, closePool } = await import("../../../apps/api/src/db/pool.js");
const { expireStockHold, expireStockHoldBatch } = await import("../../../apps/api/src/lib/stock-holds.js");
const { startStockHoldWorker } = await import("../../../apps/api/src/lib/stock-hold-worker.js");
const { applyPaymentResult } = await import("../../../apps/api/src/lib/payment-settlement.js");
const { buildVnpayPaymentUrl, vnpaySignData } = await import("../../../apps/api/src/lib/vnpay.js");
const server = createServer(createApp()); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const customer = new HttpSession(origin), admin = new HttpSession(origin);
const results: Array<{ name: string; passed: boolean }> = [];
const ids: number[] = [];
let pool: sql.ConnectionPool | undefined, customerId: number | undefined, adminId: number | undefined, bookId: number | undefined, couponId: number | undefined;
const code = `HOLD${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
const data = <T>(response: SessionResponse) => (response.body as { data: T }).data;
const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({ method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
async function step(name: string, action: () => Promise<void>) {
  try { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (cause) { results.push({ name, passed: false }); console.error(`FAIL ${name}: ${cause instanceof assert.AssertionError ? cause.message : "SQL/API fixture failure"}`); throw cause; }
}
const row = async (id: number) => (await pool!.request().input("id", sql.Int, id).query("SELECT * FROM dbo.Orders WHERE Id=@id;")).recordset[0]!;
async function balances() {
  return (await pool!.request().input("book", sql.Int, bookId).input("coupon", sql.Int, couponId)
    .query<{ stock: number; used: number }>("SELECT Stock AS stock,(SELECT UsedCount FROM dbo.Coupons WHERE Id=@coupon) AS used FROM dbo.Books WHERE Id=@book;")).recordset[0]!;
}
async function expire(id: number) {
  const transaction = new sql.Transaction(await getPool()); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try { const result = await expireStockHold(transaction, id); await transaction.commit(); return result; }
  catch (cause) { await transaction.rollback().catch(() => undefined); throw cause; }
}
async function fixture(options: { status?: string; method?: string; payment?: string; window?: "overdue" | "future" | "grace" | "legacy" } = {}) {
  const window = options.window ?? "overdue";
  const hold = window === "future" ? 30 : window === "grace" ? -1 : -6;
  const release = window === "future" ? 35 : window === "grace" ? 4 : -1;
  const transaction = new sql.Transaction(pool!); await transaction.begin();
  try {
  const result = await transaction.request().input("user", sql.Int, customerId).input("book", sql.Int, bookId).input("coupon", sql.Int, couponId)
    .input("code", sql.NVarChar(40), code).input("status", sql.NVarChar(30), options.status ?? "pending")
    .input("method", sql.NVarChar(20), options.method ?? "vnpay").input("payment", sql.NVarChar(20), options.payment ?? "unpaid")
    .input("hold", sql.Int, hold).input("release", sql.Int, release).input("legacy", sql.Bit, window === "legacy").query<{ Id: number }>(`
      INSERT dbo.Orders(UserId,Status,CustomerName,Phone,ShippingAddress,SubtotalAmount,DiscountAmount,CouponCode,TotalAmount,PaymentMethod,PaymentStatus,StockHoldUntil,StockReleaseAfter)
      OUTPUT INSERTED.Id VALUES(@user,@status,N'Stock hold fixture',N'0900000000',N'Isolated audit fixture',100000,10000,@code,90000,@method,@payment,
        CASE WHEN @legacy=1 THEN NULL ELSE DATEADD(MINUTE,@hold,SYSUTCDATETIME()) END,
        CASE WHEN @legacy=1 THEN NULL ELSE DATEADD(MINUTE,@release,SYSUTCDATETIME()) END);
    `);
  const id = result.recordset[0]!.Id; ids.push(id);
  await transaction.request().input("order", sql.Int, id).input("user", sql.Int, customerId).input("book", sql.Int, bookId).input("coupon", sql.Int, couponId).query(`
    INSERT dbo.OrderItems(OrderId,BookId,BookTitle,UnitPrice,Quantity) VALUES(@order,@book,N'Stock hold fixture',100000,1);
    UPDATE dbo.Books SET Stock=Stock-1 WHERE Id=@book;
    INSERT dbo.InventoryMovements(BookId,MovementType,QuantityDelta,BalanceAfter,ReferenceType,ReferenceId)
      SELECT @book,N'sale',-1,Stock,N'order',@order FROM dbo.Books WHERE Id=@book;
    UPDATE dbo.Coupons SET UsedCount=UsedCount+1 WHERE Id=@coupon;
    INSERT dbo.CouponRedemptions(CouponId,UserId,OrderId,DiscountAmount) VALUES(@coupon,@user,@order,10000);
  `);
  await transaction.commit(); return id;
  } catch (cause) { await transaction.rollback().catch(() => undefined); throw cause; }
}
async function attempt(id: number, state = "pending", live = false) {
  const url = buildVnpayPaymentUrl({ orderId: id, amount: 90000, ipAddress: "127.0.0.1", returnUrl: `${origin}/api/payments/vnpay-return` });
  const ref = new URL(url).searchParams.get("vnp_TxnRef")!;
  const attemptId = (await pool!.request().input("order", sql.Int, id).input("url", sql.NVarChar(1000), url).input("ref", sql.NVarChar(100), ref)
    .input("state", sql.NVarChar(20), state).input("expiry", sql.Int, live ? 1 : -10).query<{ Id: number }>(`
      INSERT dbo.PaymentAttempts(OrderId,TxnRef,Amount,PaymentUrl,ExpiresAt,State) OUTPUT INSERTED.Id
      VALUES(@order,@ref,90000,@url,DATEADD(MINUTE,@expiry,SYSUTCDATETIME()),@state);
      UPDATE dbo.Orders SET PaymentUrl=@url WHERE Id=@order;
    `)).recordset[0]!.Id;
  return { id: attemptId, orderId: id, ref, url };
}
async function ipn(payment: { ref: string }, overrides: Record<string, string> = {}) {
  const values = { vnp_TmnCode: "AUDITONLY", vnp_TxnRef: payment.ref, vnp_Amount: "9000000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "123456789", ...overrides };
  const signed = vnpaySignData(values), hash = createHmac("sha512", secret).update(signed).digest("hex");
  return await (await fetch(`${origin}/api/payments/vnpay-ipn?${signed}&vnp_SecureHash=${hash}`)).json() as { RspCode: string };
}
async function assertOneRelease(id: number) {
  const counts = (await pool!.request().input("order", sql.Int, id).query(`
    SELECT (SELECT COUNT(*) FROM dbo.InventoryMovements WHERE ReferenceType=N'order' AND ReferenceId=@order AND MovementType=N'return') AS returns,
      (SELECT COUNT(*) FROM dbo.OrderStatusHistory WHERE OrderId=@order AND ToStatus=N'cancelled' AND FromStatus<>N'cancelled') AS transitions,
      (SELECT COUNT(*) FROM dbo.OrderNotifications WHERE OrderId=@order AND OrderStatus=N'cancelled') AS notifications,
      (SELECT COUNT(*) FROM dbo.CouponRedemptions WHERE OrderId=@order AND ReleasedAt IS NOT NULL) AS released;
  `)).recordset[0]!;
  assert.deepEqual(counts, { returns: 1, transitions: 1, notifications: 1, released: 1 });
}
try {
  assert.equal(data<{ auditFixture: boolean }>(await customer.request("/api/health")).auditFixture, true);
  pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database: "BookGuardAuditSecure",
    user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
  assert.equal((await pool.query("SELECT DB_NAME() AS name,MAX(Version) AS version FROM dbo.SchemaMigrations;")).recordset[0]!.version, 8);
  for (const role of ["customer", "admin"] as const) {
    const email = `hold-${role}-${randomUUID()}@example.test`;
    const id = (await pool.request().input("email", sql.NVarChar(255), email).input("source", sql.NVarChar(255), role === "admin" ? "admin@bookguard.local" : "customer.a@bookguard.local").query<{ Id: number }>(`
      INSERT dbo.Users(Email,PasswordSecret,FullName,RoleId,EmailVerifiedAt) OUTPUT INSERTED.Id
      SELECT @email,PasswordSecret,N'Stock hold fixture',RoleId,SYSUTCDATETIME() FROM dbo.Users WHERE Email=@source;
    `)).recordset[0]!.Id;
    if (role === "admin") { adminId = id; await admin.login(email, "Admin@12345"); }
    else { customerId = id; await customer.login(email, "Customer@123"); }
  }
  bookId = (await pool.request().input("slug", sql.NVarChar(280), `stock-hold-${randomUUID()}`).query<{ Id: number }>(`
    INSERT dbo.Books(CategoryId,Title,Slug,Author,Description,Price,Stock) OUTPUT INSERTED.Id
    VALUES(1,N'Stock hold fixture',@slug,N'Audit',N'Isolated regression',100000,100);
  `)).recordset[0]!.Id;
  couponId = (await pool.request().input("code", sql.NVarChar(40), code).query<{ Id: number }>(`
    INSERT dbo.Coupons(Code,DiscountType,DiscountValue,MinimumOrder,StartsAt,EndsAt,UsageLimit)
    OUTPUT INSERTED.Id VALUES(@code,N'fixed',10000,0,DATEADD(DAY,-1,SYSUTCDATETIME()),DATEADD(DAY,1,SYSUTCDATETIME()),1000);
  `)).recordset[0]!.Id;
  await step("real checkout stores a 30-minute hold plus five-minute grace; idempotent replay preserves it", async () => {
    assert.equal((await customer.request("/api/cart/items", json("POST", { bookId, quantity: 1 }))).status, 201);
    const key = randomUUID(), body = { customerName: "Hold fixture", phone: "0900000000", shippingAddress: "Isolated SQL fixture", paymentMethod: "vnpay", couponCode: code };
    const response = await customer.request("/api/orders", json("POST", body, { "idempotency-key": key })); assert.equal(response.status, 201);
    const id = data<{ id: number }>(response).id; ids.push(id); const first = await row(id);
    assert.ok(Math.abs(first.StockHoldUntil.getTime() - first.CreatedAt.getTime() - 30 * 60_000) < 5000);
    assert.equal(first.StockReleaseAfter.getTime() - first.StockHoldUntil.getTime(), 5 * 60_000);
    const replay = await customer.request("/api/orders", json("POST", body, { "idempotency-key": key })); assert.equal(replay.status, 200);
    assert.equal(data<{ id: number }>(replay).id, id); assert.equal((await row(id)).StockHoldUntil.getTime(), first.StockHoldUntil.getTime());
    const saved = (await pool!.request().input("id", sql.Int, id).query("SELECT ExpiresAt,PaymentUrl FROM dbo.PaymentAttempts WHERE OrderId=@id;")).recordset[0]!;
    const raw = new URL(saved.PaymentUrl).searchParams.get("vnp_ExpireDate")!;
    const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+07:00`);
    assert.equal(saved.ExpiresAt.getTime(), date.getTime()); assert.ok(saved.ExpiresAt <= first.StockHoldUntil);
  });
  await step("expiry restores stock and coupon once with one history entry and one transactional outbox row", async () => {
    const id = await fixture(); await attempt(id, "failed"); const before = await balances();
    assert.equal((await expire(id)).expired, true); assert.equal((await expire(id)).expired, false);
    assert.deepEqual(await balances(), { stock: before.stock + 1, used: before.used - 1 });
    assert.equal((await row(id)).Status, "cancelled"); assert.ok((await row(id)).StockExpiredAt); await assertOneRelease(id);
  });
  await step("COD, paid/refund, fulfilled, legacy, future, grace and captured/live-attempt orders are excluded", async () => {
    for (const options of [{ method: "cod" }, { payment: "paid" }, { payment: "refund_pending" }, { payment: "refunded" }, { status: "shipping" }, { status: "completed" }, { status: "cancelled" }, { window: "legacy" as const }, { window: "future" as const }, { window: "grace" as const }]) {
      const id = await fixture(options); const before = await balances(); assert.equal((await expire(id)).expired, false); assert.deepEqual(await balances(), before);
    }
    for (const state of ["paid", "refunded", "pending"]) { const id = await fixture(); await attempt(id, state, state === "pending"); assert.equal((await expire(id)).expired, false); }
  });
  await step("admin-confirmed unpaid VNPay orders still release an expired reservation", async () => {
    const id = await fixture({ status: "confirmed" }); assert.equal((await expire(id)).expired, true); await assertOneRelease(id);
  });
  await step("two concurrent workers return one release, not two", async () => {
    const id = await fixture(); const before = await balances();
    const outcomes = await Promise.all([expire(id), expire(id)]); assert.equal(outcomes.filter(item => item.expired).length, 1);
    assert.deepEqual(await balances(), { stock: before.stock + 1, used: before.used - 1 }); await assertOneRelease(id);
  });
  await step("checkout racing stock release cannot oversell the last copy or consume a coupon twice", async () => {
    const original = await balances(); const expired = await fixture();
    assert.equal((await customer.request("/api/cart/items", json("POST", { bookId, quantity: 1 }))).status, 201);
    await pool!.request().input("book", sql.Int, bookId).query("UPDATE dbo.Books SET Stock=0 WHERE Id=@book;");
    const key = randomUUID(), body = { customerName: "Checkout race", phone: "0900000000", shippingAddress: "Isolated audit fixture", paymentMethod: "vnpay", couponCode: code };
    const checkout = () => customer.request("/api/orders", json("POST", body, { "idempotency-key": key }));
    const [_, response] = await Promise.all([expire(expired), checkout()]);
    assert.ok([201, 409].includes(response.status));
    const created = response.status === 201 ? response : await checkout(); assert.equal(created.status, 201);
    const id = data<{ id: number }>(created).id; ids.push(id);
    assert.equal((await balances()).stock, 0); assert.equal((await balances()).used, original.used + 1);
    assert.equal((await checkout()).status, 200); assert.equal((await balances()).used, original.used + 1);
    await assertOneRelease(expired);
    await pool!.request().input("book", sql.Int, bookId).input("stock", sql.Int, original.stock - 1).query("UPDATE dbo.Books SET Stock=@stock WHERE Id=@book;");
  });
  await step("customer cancellation racing expiration releases the reservation once", async () => {
    const id = await fixture(); const [_, cancellation] = await Promise.all([expire(id), customer.request(`/api/orders/${id}/cancel`, { method: "PATCH" })]);
    assert.ok([200, 409].includes(cancellation.status)); await assertOneRelease(id);
  });
  await step("admin cancellation racing expiration remains idempotent", async () => {
    const id = await fixture(); const [_, cancellation] = await Promise.all([expire(id), admin.request(`/api/admin/orders/${id}/status`, json("PATCH", { status: "cancelled" }))]);
    assert.equal(cancellation.status, 200); await assertOneRelease(id);
  });
  await step("signed payment inside callback grace confirms the order and keeps its stock reserved", async () => {
    const id = await fixture({ window: "grace" }); const payment = await attempt(id); const before = await balances();
    assert.equal((await ipn(payment)).RspCode, "00"); assert.equal((await row(id)).PaymentStatus, "paid");
    assert.equal((await row(id)).Status, "confirmed"); assert.equal((await expire(id)).expired, false); assert.deepEqual(await balances(), before);
  });
  await step("wrong amount or unsigned callback cannot expire an order; valid late payment expires it and enters refund review", async () => {
    const id = await fixture(); const payment = await attempt(id);
    assert.equal((await (await fetch(`${origin}/api/payments/vnpay-ipn?vnp_TxnRef=${payment.ref}`)).json() as { RspCode: string }).RspCode, "97");
    assert.equal((await ipn(payment, { vnp_Amount: "1" })).RspCode, "04"); assert.equal((await row(id)).Status, "pending");
    assert.equal((await ipn(payment)).RspCode, "00"); assert.equal((await row(id)).PaymentStatus, "refund_pending");
    assert.equal((await row(id)).Status, "cancelled"); assert.equal((await ipn(payment)).RspCode, "02"); await assertOneRelease(id);
  });
  await step("expiration racing IPN never confirms an expired order or returns stock twice", async () => {
    const id = await fixture(); const payment = await attempt(id);
    const [_, callback] = await Promise.all([expire(id), ipn(payment)]); assert.equal(callback.RspCode, "00");
    assert.equal((await row(id)).Status, "cancelled"); assert.equal((await row(id)).PaymentStatus, "refund_pending"); await assertOneRelease(id);
  });
  await step("query settlement racing expiration captures late money for review using the same order lock", async () => {
    const id = await fixture(); const payment = await attempt(id);
    const [_, saved] = await Promise.all([expire(id), applyPaymentResult({ orderId: id, txnRef: payment.ref, amount: 90000, isSuccess: true, responseCode: "00", transactionNo: "987654321" }, { userId: adminId!, requestId: randomUUID() })]);
    assert.equal(saved.code, "00"); assert.equal((await row(id)).Status, "cancelled"); assert.equal((await row(id)).PaymentStatus, "refund_pending"); await assertOneRelease(id);
  });
  await step("explicit legacy payment enrolls once; retries cap link expiration at the original hold", async () => {
    const id = await fixture({ window: "legacy" });
    const first = await customer.request(`/api/payments/${id}/pay`, { method: "POST" }); assert.equal(first.status, 200); const deadline = (await row(id)).StockHoldUntil;
    const reused = await customer.request(`/api/payments/${id}/pay`, { method: "POST" }); assert.equal(reused.status, 200); assert.equal(data<{ reused: boolean }>(reused).reused, true);
    assert.equal((await row(id)).StockHoldUntil.getTime(), deadline.getTime());
    await pool!.request().input("id", sql.Int, id).query(`UPDATE dbo.Orders SET StockHoldUntil=DATEADD(MINUTE,3,SYSUTCDATETIME()),StockReleaseAfter=DATEADD(MINUTE,8,SYSUTCDATETIME()) WHERE Id=@id; UPDATE dbo.PaymentAttempts SET ExpiresAt=DATEADD(MINUTE,-1,SYSUTCDATETIME()) WHERE OrderId=@id;`);
    assert.equal((await customer.request(`/api/payments/${id}/pay`, { method: "POST" })).status, 200);
    const latest = (await pool!.request().input("id", sql.Int, id).query("SELECT TOP 1 ExpiresAt FROM dbo.PaymentAttempts WHERE OrderId=@id ORDER BY Id DESC;")).recordset[0]!;
    assert.ok(latest.ExpiresAt.getTime() <= (await row(id)).StockHoldUntil.getTime());
    assert.ok(latest.ExpiresAt.getTime() - Date.now() < 3 * 60_000 + 1000);
  });
  await step("payment link requests stop at hold cutoff and expire overdue orders even without a worker tick", async () => {
    const grace = await fixture({ window: "grace" }); assert.equal((await customer.request(`/api/payments/${grace}/pay`, { method: "POST" })).status, 409); assert.equal((await row(grace)).Status, "pending");
    const overdue = await fixture(); assert.equal((await customer.request(`/api/payments/${overdue}/pay`, { method: "POST" })).status, 409);
    assert.equal((await row(overdue)).Status, "cancelled"); await assertOneRelease(overdue);
  });
  await step("stock restoration failure rolls back order, coupon, history and outbox before a safe retry", async () => {
    const id = await fixture(); const before = await balances();
    await pool!.request().input("book", sql.Int, bookId).query("UPDATE dbo.Books SET Stock=2147483647 WHERE Id=@book;");
    await assert.rejects(expire(id)); assert.equal((await row(id)).Status, "pending"); assert.equal((await row(id)).StockExpiredAt, null);
    assert.equal((await balances()).used, before.used);
    const counts = (await pool!.request().input("id", sql.Int, id).query("SELECT (SELECT COUNT(*) FROM dbo.OrderStatusHistory WHERE OrderId=@id) AS history,(SELECT COUNT(*) FROM dbo.OrderNotifications WHERE OrderId=@id) AS outbox;")).recordset[0]!;
    assert.deepEqual(counts, { history: 0, outbox: 0 });
    await pool!.request().input("book", sql.Int, bookId).input("stock", sql.Int, before.stock).query("UPDATE dbo.Books SET Stock=@stock WHERE Id=@book;");
    assert.equal((await expire(id)).expired, true); await assertOneRelease(id);
  });
  await step("admin backlog is access-controlled, bounded and identifies legacy reservations", async () => {
    assert.equal((await customer.request("/api/admin/stock-holds")).status, 403);
    const response = await admin.request("/api/admin/stock-holds"); assert.equal(response.status, 200);
    const holds = data<Array<{ orderId: number; phase: string }>>(response); assert.ok(holds.length <= 100); assert.ok(holds.some(item => ids.includes(item.orderId) && item.phase === "legacy"));
  });
  await step("bounded batch and actual worker tick release overdue orders through runtime SQL permissions", async () => {
    const group = await Promise.all([fixture(), fixture(), fixture()]);
    const batch = await expireStockHoldBatch(await getPool(), 2); assert.equal(batch.scanned, 2); assert.equal(batch.expired, 2);
    const stop = startStockHoldWorker(1000);
    try {
      const until = Date.now() + 5000;
      while (Date.now() < until && (await row(group[2]!)).Status !== "cancelled") await new Promise(resolve => setTimeout(resolve, 50));
      for (const id of group) { assert.equal((await row(id)).Status, "cancelled"); await assertOneRelease(id); }
    } finally { await stop(); }
  });
} catch (cause) {
  process.exitCode = 1;
  const failure = cause as { code?: string; number?: number };
  console.error("Stock hold regression failed; all writes were limited to audit fixtures.", cause instanceof assert.AssertionError ? cause.message : { code: failure.code, number: failure.number });
}
finally {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  await new Promise(resolve => setTimeout(resolve, 400));
  if (pool) {
    for (const id of ids) await pool.request().input("id", sql.Int, id).query(`
      DELETE dbo.InventoryMovements WHERE ReferenceType=N'order' AND ReferenceId=@id;
      DELETE dbo.PaymentAttempts WHERE OrderId=@id; DELETE dbo.OrderNotifications WHERE OrderId=@id;
      DELETE dbo.OrderStatusHistory WHERE OrderId=@id; DELETE dbo.CouponRedemptions WHERE OrderId=@id;
      DELETE dbo.OrderItems WHERE OrderId=@id; DELETE dbo.Orders WHERE Id=@id;
    `);
    for (const id of [customerId, adminId].filter(Boolean)) await pool.request().input("id", sql.Int, id).query(`
      DELETE dbo.CartItems WHERE CartId IN(SELECT Id FROM dbo.Carts WHERE UserId=@id); DELETE dbo.Carts WHERE UserId=@id;
      DELETE dbo.AdminAuditEvents WHERE AdminUserId=@id; DELETE dbo.SecurityEvents WHERE UserId=@id;
      DELETE dbo.RefreshTokens WHERE UserId=@id; DELETE dbo.UserSessions WHERE UserId=@id; DELETE dbo.Users WHERE Id=@id;
    `);
    if (bookId) await pool.request().input("id", sql.Int, bookId).query("DELETE dbo.InventoryMovements WHERE BookId=@id; DELETE dbo.Books WHERE Id=@id;");
    if (couponId) await pool.request().input("id", sql.Int, couponId).query("DELETE dbo.Coupons WHERE Id=@id;");
    await pool.close();
  }
  await closePool();
}
await mkdir("../../reports/stock-holds", { recursive: true });
const passed = results.length === 17 && results.every(item => item.passed);
await writeFile("../../reports/stock-holds/sql-regressions.json", JSON.stringify({ generatedAt: new Date().toISOString(), passed, fixture: "Isolated audit SQL, runtime app and signed IPN fixtures; no bank transaction", results }, null, 2));
if (!passed) process.exitCode = 1;
