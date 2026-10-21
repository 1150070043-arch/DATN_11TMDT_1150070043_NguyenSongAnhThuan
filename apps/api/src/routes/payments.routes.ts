import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import type { PaymentOrder } from "../domain/payment.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { applyPaymentResult } from "../lib/payment-settlement.js";
import { diagnosticErrorCode } from "../lib/diagnostics.js";
import { savePaymentAttempt } from "../lib/payment-attempts.js";
import { buildVnpayPaymentUrl, verifyVnpayReturn } from "../lib/vnpay.js";
import { expireStockHold, initializeStockHold } from "../lib/stock-holds.js";
import { deliverOrderNotificationLater } from "../lib/order-notifications.js";
import { ensureOwnerOrAdmin, requireAuth } from "../security/auth.js";

export const paymentsRouter = Router();
const querySchema = z.record(z.string(), z.string());

paymentsRouter.get("/methods", (_req, res) => {
  res.json({ data: { cod: true, vnpay: Boolean(config.vnpay.tmnCode && config.vnpay.hashSecret) } });
});

// Browser redirects do not mutate orders. The authenticated UI reads the saved order.
paymentsRouter.get("/vnpay-return", asyncHandler(async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const result = verifyVnpayReturn(parsed.success ? parsed.data : {});
  const params = new URLSearchParams({
    orderId: String(result.orderId),
    status: result.isSuccess ? "pending" : "failed",
    message: result.isValid ? result.message : "Không thể xác minh giao dịch thanh toán."
  });
  res.redirect(`${config.webOrigin}/payment/vnpay-return?${params}`);
}));

// Register this HTTPS endpoint with VNPay. Signature validation replaces browser CSRF for this GET notification.
paymentsRouter.get("/vnpay-ipn", asyncHandler(async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  const result = verifyVnpayReturn(parsed.success ? parsed.data : {});
  res.setHeader("Cache-Control", "no-store");
  if (!result.isValid || !result.orderId) {
    res.json({ RspCode: "97", Message: "Invalid signature or parameters" });
    return;
  }
  try {
    const saved = await applyPaymentResult(result);
    res.json({ RspCode: saved.code, Message: saved.code === "00" ? "Confirm Success" : saved.code === "04" ? "Invalid amount" : saved.code === "02" ? "Order already confirmed" : "Order or payment attempt not found" });
  } catch (cause) {
    logger.error("vnpay_ipn_failed", { orderId: result.orderId, code: diagnosticErrorCode(cause) });
    res.json({ RspCode: "99", Message: "Unable to persist payment; retry notification" });
  }
}));

paymentsRouter.post("/vnpay-verify", requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({ query: querySchema }).parse(req.body);
  res.json({ data: verifyVnpayReturn(body.query) });
}));

paymentsRouter.post("/:orderId/pay", requireAuth, asyncHandler(async (req, res) => {
  const orderId = z.coerce.number().int().positive().max(2147483647).parse(req.params.orderId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(transaction).input("orderId", sql.Int, orderId)
      .query<PaymentOrder & { UserId: number }>(`
        SELECT UserId, Status, TotalAmount, PaymentMethod, PaymentStatus, PaymentUrl
        FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK) WHERE Id = @orderId;
      `);
    const order = result.recordset[0];
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
    ensureOwnerOrAdmin(req, order.UserId);
    if (["paid", "refund_pending", "refunded"].includes(order.PaymentStatus)) throw new HttpError(409, "Đơn hàng này đã được thanh toán.", "ORDER_ALREADY_PAID");
    if (!["pending", "confirmed"].includes(order.Status)) throw new HttpError(409, "Đơn hàng đã kết thúc, không thể thanh toán.", "ORDER_CLOSED");
    const expiration = await expireStockHold(transaction, orderId);
    if (expiration.expired) {
      await transaction.commit(); deliverOrderNotificationLater(expiration.notificationId);
      throw new HttpError(409, "Đơn đã hết thời hạn giữ kho và được hủy. Vui lòng đặt đơn mới.", "STOCK_HOLD_EXPIRED");
    }
    // Explicit payment initiation enrolls legacy/COD orders; retries never extend a hold.
    const hold = await initializeStockHold(transaction, orderId);
    const holdEnded = (await transaction.request().input("id", sql.Int, orderId).query<{ ended: boolean }>(`
      SELECT CAST(CASE WHEN StockHoldUntil<=SYSUTCDATETIME() THEN 1 ELSE 0 END AS bit) AS ended FROM dbo.Orders WHERE Id=@id;
    `)).recordset[0]!.ended;
    if (holdEnded) throw new HttpError(409, "Thời gian thanh toán đã hết. Đang chờ xác nhận giao dịch; vui lòng kiểm tra lại đơn hàng.", "STOCK_HOLD_ENDED");
    const pending = await new sql.Request(transaction).input("orderId", sql.Int, orderId)
      .query<{ PaymentUrl: string }>(`SELECT TOP 1 PaymentUrl FROM dbo.PaymentAttempts WHERE OrderId = @orderId AND State = N'pending' AND ExpiresAt > SYSUTCDATETIME() ORDER BY Id DESC;`);
    if (pending.recordset[0]) {
      await transaction.commit();
      res.json({ data: { orderId, paymentMethod: "vnpay", paymentUrl: pending.recordset[0].PaymentUrl, reused: true } });
      return;
    }
    const paymentUrl = buildVnpayPaymentUrl({ orderId, amount: Number(order.TotalAmount), ipAddress: req.ip || "127.0.0.1", returnUrl: config.vnpay.returnUrl ?? `${req.protocol}://${req.get("host")}/api/payments/vnpay-return`, expiresAt: hold.StockHoldUntil });
    await savePaymentAttempt(transaction, orderId, Number(order.TotalAmount), paymentUrl);
    await new sql.Request(transaction).input("orderId", sql.Int, orderId).query(`UPDATE dbo.Orders SET PaymentMethod = N'vnpay', PaymentStatus = N'unpaid' WHERE Id = @orderId;`);
    await transaction.commit();
    res.json({ data: { orderId, paymentMethod: "vnpay", paymentUrl } });
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
}));
