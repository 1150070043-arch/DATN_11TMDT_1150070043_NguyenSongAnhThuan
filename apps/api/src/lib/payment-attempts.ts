import { sql } from "../db/pool.js";

export async function savePaymentAttempt(transaction: sql.Transaction, orderId: number, amount: number, paymentUrl: string): Promise<void> {
  const params = new URL(paymentUrl).searchParams;
  const txnRef = params.get("vnp_TxnRef");
  if (!txnRef) throw new Error("Payment reference missing");
  const rawExpiry = params.get("vnp_ExpireDate") ?? "";
  if (!/^\d{14}$/.test(rawExpiry)) throw new Error("Payment expiration missing");
  const expiresAt = new Date(`${rawExpiry.slice(0, 4)}-${rawExpiry.slice(4, 6)}-${rawExpiry.slice(6, 8)}T${rawExpiry.slice(8, 10)}:${rawExpiry.slice(10, 12)}:${rawExpiry.slice(12, 14)}+07:00`);
  if (!Number.isFinite(expiresAt.getTime())) throw new Error("Payment expiration invalid");
  await new sql.Request(transaction)
    .input("orderId", sql.Int, orderId)
    .input("amount", sql.Decimal(18, 2), amount)
    .input("txnRef", sql.NVarChar(100), txnRef)
    .input("paymentUrl", sql.NVarChar(1000), paymentUrl)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.PaymentAttempts (OrderId, TxnRef, Amount, PaymentUrl, ExpiresAt)
      VALUES (@orderId, @txnRef, @amount, @paymentUrl, @expiresAt);
      UPDATE dbo.Orders SET PaymentUrl = @paymentUrl, UpdatedAt = SYSUTCDATETIME() WHERE Id = @orderId;
    `);
}

// Must run under the same order lock as cancellation to serialize with an IPN.
export async function queueCancelledPaymentReview(transaction: sql.Transaction, orderId: number): Promise<void> {
  await new sql.Request(transaction).input("orderId", sql.Int, orderId).query(`
    UPDATE dbo.PaymentAttempts SET NeedsReview = 1, ReviewReason = N'Đơn đã hủy sau khi thu tiền; cần hoàn tiền', UpdatedAt = SYSUTCDATETIME()
    WHERE OrderId = @orderId AND State = N'paid';
    UPDATE dbo.Orders SET PaymentStatus = N'refund_pending' WHERE Id = @orderId AND PaymentStatus = N'paid';
  `);
}
