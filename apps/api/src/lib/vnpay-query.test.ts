import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { queryVnpayAttempt } from "./vnpay-query.js";
import { HttpError } from "./http.js";

const secret = "query-test-only-secret";
const attempt = { OrderId: 12, TxnRef: "12_aabb", Amount: 150000, PaymentUrl: "https://sandbox.example/pay?vnp_TmnCode=TESTCODE&vnp_TxnRef=12_aabb&vnp_CreateDate=20261012090000" };
const fields = ["vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount"];
function reply(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { vnp_ResponseId: "response12", vnp_Command: "querydr", vnp_ResponseCode: "00", vnp_Message: "Success", vnp_TmnCode: "TESTCODE", vnp_TxnRef: attempt.TxnRef,
    vnp_Amount: "15000000", vnp_BankCode: "NCB", vnp_PayDate: "20261012090100", vnp_TransactionNo: "123456", vnp_TransactionType: "01", vnp_TransactionStatus: "00", vnp_OrderInfo: "Test", ...overrides };
  values.vnp_SecureHash = createHmac("sha512", secret).update(fields.map(key => values[key] ?? "").join("|")).digest("hex"); return values;
}
async function fixture(action: (query: (overrides?: Record<string, string>, mode?: string) => Promise<Awaited<ReturnType<typeof queryVnpayAttempt>>>, requests: Array<Record<string, string>>) => Promise<void>) {
  let overrides: Record<string, string> = {}, mode = "valid";
  const requests: Array<Record<string, string>> = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    if (mode === "timeout") { return; }
    if (mode === "redirect") { res.writeHead(302, { location: "/query" }); res.end(); return; }
    if (mode === "http-failure") { res.writeHead(500); res.end(); return; }
    res.setHeader("content-type", "application/json");
    res.end(mode === "oversized" ? "x".repeat(40000) : mode === "malformed" ? "{" : JSON.stringify(mode === "bad-hash" ? { ...reply(overrides), vnp_SecureHash: "bad" } : reply(overrides)));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const settings = { queryEnabled: true, queryUrl: `http://127.0.0.1:${address.port}/query`, queryTimeoutMs: 5000, tmnCode: "TESTCODE", hashSecret: secret };
  try {
    await action((next = {}, nextMode = "valid") => { overrides = next; mode = nextMode; return queryVnpayAttempt(attempt, { ...settings, queryTimeoutMs: nextMode === "timeout" ? 100 : settings.queryTimeoutMs }, "127.0.0.1"); }, requests);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test("querydr signs the documented request fields, uses original date and verifies a paid response", async () => fixture(async (query, requests) => {
  assert.equal((await query()).result?.isSuccess, true);
  const request = requests[0]!;
  const expected = ["vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo"].map(key => request[key]).join("|");
  assert.equal(request.vnp_SecureHash, createHmac("sha512", secret).update(expected).digest("hex"));
  assert.equal(request.vnp_TransactionDate, "20261012090000"); assert.match(request.vnp_RequestId!, /^[a-f0-9]{32}$/);
  await query(); assert.notEqual(requests[1]!.vnp_RequestId, request.vnp_RequestId);
}));

test("querydr binds signed responses to merchant, reference and amount", async () => fixture(async query => {
  for (const changes of [{ vnp_TmnCode: "OTHER" }, { vnp_TxnRef: "13_aabb" }, { vnp_Amount: "1" }, { vnp_Command: "refund" }]) {
    await assert.rejects(query(changes), (error: unknown) => error instanceof HttpError && error.code === "PAYMENT_QUERY_INVALID_RESPONSE");
  }
  await assert.rejects(query({}, "bad-hash"));
}));

test("querydr does not treat request success, in-progress or refund statuses as payment success", async () => fixture(async query => {
  for (const changes of [{ vnp_TransactionStatus: "01" }, { vnp_ResponseCode: "91" }, { vnp_TransactionType: "02" }, { vnp_TransactionStatus: "04" }]) {
    assert.equal((await query(changes)).result, undefined);
  }
  assert.equal((await query({ vnp_TransactionStatus: "02" })).result?.isSuccess, false);
}));

test("querydr bounds response size/time and rejects redirects, malformed JSON and HTTP failures", async () => fixture(async query => {
  for (const mode of ["oversized", "malformed", "http-failure", "redirect", "timeout"]) {
    await assert.rejects(query({}, mode), (error: unknown) => error instanceof HttpError && error.code === "PAYMENT_QUERY_FAILED");
  }
}));

test("querydr refuses disabled queries and incomplete legacy metadata before making a network request", async () => {
  const settings = { queryEnabled: false, queryUrl: "http://127.0.0.1:1/query", queryTimeoutMs: 100, tmnCode: "TESTCODE", hashSecret: secret };
  await assert.rejects(queryVnpayAttempt(attempt, settings, "127.0.0.1"), (error: unknown) => error instanceof HttpError && error.code === "PAYMENT_QUERY_UNAVAILABLE");
  await assert.rejects(queryVnpayAttempt({ ...attempt, PaymentUrl: "not-a-url" }, { ...settings, queryEnabled: true }, "127.0.0.1"), (error: unknown) => error instanceof HttpError && error.code === "PAYMENT_QUERY_METADATA_INVALID");
});
