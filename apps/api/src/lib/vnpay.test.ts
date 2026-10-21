import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import express from "express";
import { checkPaymentAttempt, paymentReviewReason } from "../domain/payment.js";

process.env.VNPAY_TMN_CODE = "TESTCODE";
process.env.VNPAY_HASH_SECRET = "test-only-merchant-secret";
const { vnpaySignData, verifyVnpayReturn, buildVnpayPaymentUrl } = await import("./vnpay.js");
const { paymentsRouter } = await import("../routes/payments.routes.js");

function signed(overrides: Record<string, string> = {}) {
  const query = { vnp_TmnCode: "TESTCODE", vnp_TxnRef: "12_123456789", vnp_Amount: "15000000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "9876", vnp_OrderInfo: "Thanh toan sach", ...overrides };
  return { ...query, vnp_SecureHash: createHmac("sha512", process.env.VNPAY_HASH_SECRET!).update(vnpaySignData(query)).digest("hex") };
}

test("VNPay canonical encoding sorts parameters and encodes spaces as plus", () => {
  assert.equal(vnpaySignData({ vnp_B: "a b+c", vnp_A: "1", unrelated: "ignore", vnp_SecureHash: "ignore" }), "vnp_A=1&vnp_B=a+b%2Bc");
});

test("VNPay verifies merchant, amount syntax, exact order reference and both success codes", () => {
  const valid = verifyVnpayReturn(signed());
  assert.equal(valid.isSuccess, true);
  assert.equal(valid.orderId, 12);
  assert.equal(valid.amount, 150000);
  for (const overrides of [{ vnp_TmnCode: "OTHER" }, { vnp_Amount: "100abc" }, { vnp_TxnRef: "12junk_123" }, { vnp_TxnRef: "9999999999_123" }, { vnp_TransactionStatus: "" }]) {
    assert.equal(verifyVnpayReturn(signed(overrides)).isValid, false);
  }
  assert.equal(verifyVnpayReturn(signed({ vnp_TransactionStatus: "02" })).isSuccess, false);
  assert.equal(verifyVnpayReturn({ ...signed(), vnp_Amount: "100" }).isValid, false);
  assert.equal(verifyVnpayReturn({ ...signed(), vnp_SecureHash: "bad" }).orderId, 0);
});

test("payment policy accepts saved older attempts, validates amount and queues late or duplicate money for review", () => {
  const order = { Status: "pending", PaymentMethod: "vnpay", PaymentStatus: "unpaid", TotalAmount: 150000, PaymentUrl: "https://sandbox.example/pay?vnp_TxnRef=12_123456789" };
  const input = { orderId: 12, txnRef: "12_123456789", amount: 150000 };
  const attempt = { Id: 1, OrderId: 12, TxnRef: input.txnRef, Amount: 150000, State: "pending" };
  assert.equal(checkPaymentAttempt(order, attempt, input), "00");
  assert.equal(checkPaymentAttempt(order, attempt, { ...input, amount: 1 }), "04");
  assert.equal(checkPaymentAttempt(order, attempt, { ...input, txnRef: "12_deadbeef" }), "01");
  assert.equal(checkPaymentAttempt(order, { ...attempt, State: "paid" }, input), "02");
  assert.equal(checkPaymentAttempt(order, { ...attempt, State: "refunded" }, input), "02");
  assert.equal(paymentReviewReason(order), null);
  assert.ok(paymentReviewReason({ ...order, Status: "cancelled" }));
  assert.ok(paymentReviewReason({ ...order, PaymentStatus: "paid" }));
  assert.ok(paymentReviewReason(order, 1));
});

test("VNPay URLs respect amount limits and contain provider-compatible descriptions", () => {
  const valid = { orderId: 12, amount: 150000, ipAddress: "127.0.0.1", returnUrl: "https://example.test/return", orderInfo: "Thanh toán đơn hàng #12" };
  const url = new URL(buildVnpayPaymentUrl(valid));
  assert.equal(url.searchParams.get("vnp_OrderInfo"), "Thanh toan don hang 12");
  for (const amount of [0, 0.001, -1, Infinity, 10_000_000_000]) assert.throws(() => buildVnpayPaymentUrl({ ...valid, amount }));
  assert.throws(() => buildVnpayPaymentUrl({ ...valid, orderId: 2147483648 }));
});

test("unsigned IPN is refused and signed browser return stays read-only without a database", async () => {
  const app = express(); app.use("/api/payments", paymentsRouter);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/payments`;
  try {
    const ipn = await fetch(`${base}/vnpay-ipn?vnp_TxnRef=12_123`);
    assert.equal((await ipn.json() as { RspCode: string }).RspCode, "97");
    const returned = await fetch(`${base}/vnpay-return?${new URLSearchParams(signed())}`, { redirect: "manual" });
    assert.equal(returned.status, 302);
    const target = new URL(returned.headers.get("location")!);
    assert.equal(target.searchParams.get("status"), "pending");
    assert.equal(target.searchParams.get("orderId"), "12");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
