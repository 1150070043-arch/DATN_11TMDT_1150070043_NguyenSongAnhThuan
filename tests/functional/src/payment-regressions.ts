import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import sql from "mssql";
import { HttpSession, type SessionResponse } from "../../security/src/http-session.js";

const secret = "payment-regression-only-secret";
const requestFields = ["vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo"];
const responseFields = ["vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount"];
const results: Array<{ name: string; passed: boolean }> = [];
const data = <T>(response: SessionResponse) => (response.body as { data: T }).data;
let responseMode = "paid", requests = 0;
const bankReferences = new Map<string, string>();
const logs: unknown[] = [];
const provider = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const input = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, string>;
    const expected = createHmac("sha512", secret).update(requestFields.map(key => input[key] ?? "").join("|")).digest("hex");
    assert.equal(input.vnp_SecureHash, expected); assert.equal(input.vnp_Command, "querydr"); requests++;
    if (responseMode === "timeout") return;
    const values: Record<string, string> = { vnp_ResponseId: randomUUID().replaceAll("-", ""), vnp_Command: "querydr", vnp_ResponseCode: "00", vnp_Message: "Success", vnp_TmnCode: "AUDITONLY",
      vnp_TxnRef: input.vnp_TxnRef!, vnp_Amount: "10000000", vnp_BankCode: "NCB", vnp_PayDate: "20261012100000", vnp_TransactionNo: bankReferences.get(input.vnp_TxnRef!)!,
      vnp_TransactionType: "01", vnp_TransactionStatus: responseMode === "pending" ? "01" : responseMode === "failed" ? "02" : "00", vnp_OrderInfo: "Payment fixture" };
    if (responseMode === "wrong-ref") values.vnp_TxnRef = "999_deadbeef";
    if (responseMode === "wrong-amount") values.vnp_Amount = "1";
    values.vnp_SecureHash = responseMode === "bad-hash" ? "bad" : createHmac("sha512", secret).update(responseFields.map(key => values[key] ?? "").join("|")).digest("hex");
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify(values));
  } catch { res.writeHead(400); res.end(); }
});
await new Promise<void>(resolve => provider.listen(0, "127.0.0.1", resolve));
const providerAddress = provider.address(); assert.ok(providerAddress && typeof providerAddress !== "string");
Object.assign(process.env, { NODE_ENV: "test", SECURITY_MODE: "secure", DB_NAME: "BookGuardAuditSecure", DB_USER: "bookguard_audit_secure",
  VNPAY_TMN_CODE: "AUDITONLY", VNPAY_HASH_SECRET: secret, VNPAY_QUERY_ENABLED: "true", VNPAY_QUERY_URL: `http://127.0.0.1:${providerAddress.port}/query`, VNPAY_QUERY_TIMEOUT_MS: "1000",
  ALERT_WEBHOOK_URL: undefined, ALERT_TELEGRAM_BOT_TOKEN: "", ALERT_TELEGRAM_CHAT_ID: "", SMTP_HOST: "localhost", SMTP_PORT: process.env.TEST_SMTP_PORT ?? "1025", SMTP_USER: "", SMTP_PASSWORD: "", SMTP_SECURE: "false" });
delete process.env.ALERT_WEBHOOK_URL;
const { logger } = await import("../../../apps/api/src/lib/logger.js");
for (const level of ["info", "warn", "error"] as const) logger[level] = (event, details) => { logs.push({ event, ...details }); };
const { createApp } = await import("../../../apps/api/src/app.js");
const { closePool } = await import("../../../apps/api/src/db/pool.js");
const { buildVnpayPaymentUrl } = await import("../../../apps/api/src/lib/vnpay.js");
const app = createServer(createApp()); await new Promise<void>(resolve => app.listen(0, "127.0.0.1", resolve));
const address = app.address(); assert.ok(address && typeof address !== "string"); const api = `http://127.0.0.1:${address.port}`;
const admin = new HttpSession(api), customer = new HttpSession(api);
let pool: sql.ConnectionPool | undefined, customerId: number | undefined, adminId: number | undefined;
const orderIds: number[] = [];
async function step(name: string, action: () => Promise<void>) {
  try { await action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false }); console.error(`FAIL ${name}`); throw error; }
}
async function fixtureOrder(status = "pending") {
  const id = (await pool!.request().input("user", sql.Int, customerId).input("status", sql.NVarChar(30), status).query(`
    INSERT dbo.Orders(UserId,Status,CustomerName,Phone,ShippingAddress,SubtotalAmount,TotalAmount,PaymentMethod,PaymentStatus)
    OUTPUT INSERTED.Id VALUES(@user,@status,N'Payment regression',N'0900000000',N'Isolated SQL fixture',100000,100000,N'vnpay',N'unpaid');
  `)).recordset[0]!.Id as number;
  orderIds.push(id); return id;
}
async function addAttempt(orderId: number) {
  const url = buildVnpayPaymentUrl({ orderId, amount: 100000, ipAddress: "127.0.0.1", returnUrl: `${api}/api/payments/vnpay-return` });
  const txnRef = new URL(url).searchParams.get("vnp_TxnRef")!;
  bankReferences.set(txnRef, String(Date.now() + bankReferences.size));
  const id = (await pool!.request().input("order", sql.Int, orderId).input("url", sql.NVarChar(1000), url).input("ref", sql.NVarChar(100), txnRef).query(`
    INSERT dbo.PaymentAttempts(OrderId,TxnRef,Amount,PaymentUrl,ExpiresAt) OUTPUT INSERTED.Id
    VALUES(@order,@ref,100000,@url,DATEADD(MINUTE,15,SYSUTCDATETIME()));
    UPDATE dbo.Orders SET PaymentUrl=@url WHERE Id=@order;
  `)).recordset[0]!.Id as number;
  return { id, orderId, url, txnRef };
}
const query = (attempt: { id: number }) => admin.request(`/api/admin/payment-reconciliation/${attempt.id}/query`, { method: "POST" });
const order = async (id: number) => (await pool!.request().input("id", sql.Int, id).query("SELECT * FROM dbo.Orders WHERE Id=@id;")).recordset[0]!;
async function ipn(attempt: { txnRef: string }, extra: Record<string, string> = {}) {
  const values: Record<string, string> = { vnp_TmnCode: "AUDITONLY", vnp_TxnRef: attempt.txnRef, vnp_Amount: "10000000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: bankReferences.get(attempt.txnRef)!, ...extra };
  const encoded = Object.keys(values).sort().map(key => `${encodeURIComponent(key)}=${encodeURIComponent(values[key]!).replace(/%20/g, "+")}`).join("&");
  const signature = createHmac("sha512", secret).update(encoded).digest("hex");
  return (await (await fetch(`${api}/api/payments/vnpay-ipn?${encoded}&vnp_SecureHash=${signature}`)).json()) as { RspCode: string };
}
const refund = (id: number) => admin.request(`/api/admin/payment-reconciliation/${id}/refund-confirmation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerReference: `refund-${id}`, note: "Provider refund already confirmed in isolated fixture" }) });
try {
  const health = await customer.request("/api/health"); assert.equal(data<{ auditFixture: boolean }>(health).auditFixture, true);
  pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database: "BookGuardAuditSecure",
    user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
  assert.equal((await pool.query("SELECT DB_NAME() AS name;")).recordset[0]!.name, "BookGuardAuditSecure");
  for (const role of ["customer", "admin"] as const) {
    const email = `payment-${role}-${randomUUID()}@example.test`;
    const id = (await pool.request().input("email", sql.NVarChar(255), email).input("source", sql.NVarChar(255), role === "admin" ? "admin@bookguard.local" : "customer.a@bookguard.local").query(`
      INSERT dbo.Users(Email,PasswordSecret,FullName,RoleId,EmailVerifiedAt)
      OUTPUT INSERTED.Id SELECT @email,PasswordSecret,N'Payment fixture',RoleId,SYSUTCDATETIME() FROM dbo.Users WHERE Email=@source;
    `)).recordset[0]!.Id as number;
    if (role === "admin") { adminId = id; await admin.login(email, "Admin@12345"); }
    else { customerId = id; await customer.login(email, "Customer@123"); }
  }
  await step("admin-only query rejects customer access before contacting the provider", async () => {
    const attempt = await addAttempt(await fixtureOrder()); const before = requests;
    assert.equal((await customer.request(`/api/admin/payment-reconciliation/${attempt.id}/query`, { method: "POST" })).status, 403); assert.equal(requests, before);
  });
  await step("signed query recovers a lost IPN and writes one settlement audit/history entry", async () => {
    const attempt = await addAttempt(await fixtureOrder()); responseMode = "paid";
    const response = await query(attempt); assert.equal(response.status, 200); assert.equal(data<{ changed: boolean }>(response).changed, true);
    assert.equal((await order(attempt.orderId)).PaymentStatus, "paid"); assert.equal((await order(attempt.orderId)).Status, "confirmed");
    assert.equal((await query(attempt)).status, 200);
    assert.equal((await ipn(attempt)).RspCode, "02");
    const history = await pool!.request().input("order", sql.Int, attempt.orderId).query("SELECT COUNT(*) AS total FROM dbo.OrderStatusHistory WHERE OrderId=@order;"); assert.equal(history.recordset[0]!.total, 1);
    const audit = await pool!.request().input("id", sql.NVarChar(80), String(attempt.id)).query("SELECT COUNT(*) AS total FROM dbo.AdminAuditEvents WHERE EntityId=@id AND Action=N'payment.query_applied';"); assert.equal(audit.recordset[0]!.total, 1);
  });
  await step("simultaneous query and IPN settle once without duplicate history", async () => {
    const attempt = await addAttempt(await fixtureOrder());
    const [response, callback] = await Promise.all([query(attempt), ipn(attempt)]);
    assert.equal(response.status, 200); assert.ok(["00", "02"].includes(callback.RspCode));
    const history = await pool!.request().input("order", sql.Int, attempt.orderId).query("SELECT COUNT(*) AS total FROM dbo.OrderStatusHistory WHERE OrderId=@order;"); assert.equal(history.recordset[0]!.total, 1);
  });
  await step("bad signature, signed wrong reference and signed wrong amount cannot change order state", async () => {
    const attempt = await addAttempt(await fixtureOrder());
    for (const mode of ["bad-hash", "wrong-ref", "wrong-amount"]) { responseMode = mode; assert.equal((await query(attempt)).status, 502); assert.equal((await order(attempt.orderId)).PaymentStatus, "unpaid"); }
  });
  await step("in-progress and timed-out queries leave payment pending and allow safe retries", async () => {
    const attempt = await addAttempt(await fixtureOrder());
    responseMode = "pending"; const pending = await query(attempt); assert.equal(pending.status, 200); assert.equal(data<{ changed: boolean }>(pending).changed, false);
    responseMode = "timeout"; assert.equal((await query(attempt)).status, 502); assert.equal((await order(attempt.orderId)).PaymentStatus, "unpaid");
    responseMode = "paid"; assert.equal((await query(attempt)).status, 200); assert.equal((await order(attempt.orderId)).PaymentStatus, "paid");
  });
  await step("query failure can later become a signed successful payment without losing the attempt", async () => {
    const attempt = await addAttempt(await fixtureOrder()); responseMode = "failed";
    assert.equal((await query(attempt)).status, 200); assert.equal((await order(attempt.orderId)).PaymentStatus, "failed");
    responseMode = "paid"; assert.equal((await query(attempt)).status, 200); assert.equal((await order(attempt.orderId)).PaymentStatus, "paid");
  });
  await step("cancelled orders remain refund_pending until every captured payment is refunded", async () => {
    const id = await fixtureOrder("cancelled"), first = await addAttempt(id), second = await addAttempt(id);
    assert.equal((await ipn(first)).RspCode, "00"); assert.equal((await ipn(second)).RspCode, "00");
    assert.equal((await refund(second.id)).status, 200); assert.equal((await order(id)).PaymentStatus, "refund_pending");
    assert.equal((await refund(first.id)).status, 200); assert.equal((await order(id)).PaymentStatus, "refunded");
    assert.equal((await refund(first.id)).status, 200);
    const late = await addAttempt(id); assert.equal((await ipn(late)).RspCode, "00");
    assert.equal((await order(id)).PaymentStatus, "refund_pending"); assert.equal((await order(id)).Status, "cancelled");
    assert.equal((await refund(late.id)).status, 200); assert.equal((await order(id)).PaymentStatus, "refunded");
  });
  await step("refunding a duplicate payment preserves a live order's primary paid status", async () => {
    const id = await fixtureOrder(), primary = await addAttempt(id), duplicate = await addAttempt(id);
    assert.equal((await ipn(primary)).RspCode, "00"); assert.equal((await ipn(duplicate)).RspCode, "00");
    assert.equal((await refund(duplicate.id)).status, 200); assert.equal((await order(id)).PaymentStatus, "paid");
    assert.equal((await order(id)).PaymentTransactionId, bankReferences.get(primary.txnRef));
  });
  await step("captured amount matching an attempt but not the order enters review without confirming fulfillment", async () => {
    const id = await fixtureOrder(), attempt = await addAttempt(id);
    await pool!.request().input("order", sql.Int, id).query("UPDATE dbo.Orders SET TotalAmount=90000,SubtotalAmount=90000 WHERE Id=@order;");
    assert.equal((await ipn(attempt)).RspCode, "00"); const saved = await order(id);
    assert.equal(saved.Status, "pending"); assert.equal(saved.PaymentStatus, "refund_pending");
  });
  await step("provider calls release database locks while waiting and do not log signatures", async () => {
    const attempt = await addAttempt(await fixtureOrder()); responseMode = "timeout";
    const request = query(attempt); await new Promise(resolve => setTimeout(resolve, 100));
    const started = Date.now(); await pool!.request().input("id", sql.Int, attempt.orderId).query("UPDATE dbo.Orders SET CustomerName=CustomerName WHERE Id=@id;");
    assert.ok(Date.now() - started < 700); assert.equal((await request).status, 502);
    assert.equal(JSON.stringify(logs).includes("vnp_SecureHash="), false); assert.equal(JSON.stringify(logs).includes(secret), false);
  });
} catch { process.exitCode = 1; console.error("Payment regression failed; see named result. No merchant credentials are printed."); }
finally {
  app.closeAllConnections(); await new Promise<void>(resolve => app.close(() => resolve()));
  await new Promise(resolve => setTimeout(resolve, 300));
  if (pool) {
    for (const id of orderIds) await pool.request().input("order", sql.Int, id).query(`
      DELETE dbo.PaymentAttempts WHERE OrderId=@order; DELETE dbo.OrderNotifications WHERE OrderId=@order;
      DELETE dbo.OrderStatusHistory WHERE OrderId=@order; DELETE dbo.Orders WHERE Id=@order;
    `);
    for (const id of [customerId, adminId].filter(Boolean)) await pool.request().input("user", sql.Int, id).query(`
      DELETE dbo.AdminAuditEvents WHERE AdminUserId=@user; DELETE dbo.SecurityEvents WHERE UserId=@user;
      DELETE dbo.RefreshTokens WHERE UserId=@user; DELETE dbo.UserSessions WHERE UserId=@user; DELETE dbo.Users WHERE Id=@user;
    `);
    await pool.close();
  }
  await closePool(); provider.closeAllConnections(); await new Promise<void>(resolve => provider.close(() => resolve()));
}
await mkdir("../../reports/payments", { recursive: true });
const passed = results.length === 10 && results.every(row => row.passed);
await writeFile("../../reports/payments/sql-provider-regressions.json", JSON.stringify({ generatedAt: new Date().toISOString(), passed, fixture: "Real isolated audit SQL + runtime API + local HTTP VNPay query simulator; no provider/bank transaction", providerRequests: requests, results }, null, 2));
if (!passed) process.exitCode = 1;
