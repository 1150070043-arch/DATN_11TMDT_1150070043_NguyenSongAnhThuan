import { Router } from "express";
import { z } from "zod";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { requireAdmin } from "../security/auth.js";
import { config } from "../config.js";
import { queryVnpayAttempt, type QueryAttempt } from "../lib/vnpay-query.js";
import { applyPaymentResult } from "../lib/payment-settlement.js";

export const paymentOperationsRouter = Router();
paymentOperationsRouter.use(requireAdmin);

paymentOperationsRouter.get("/stock-holds", asyncHandler(async (_req, res) => {
  const result = await (await getPool()).request().query(`
    SELECT TOP 100 o.Id AS orderId,o.Status AS status,o.PaymentStatus AS paymentStatus,
      o.StockHoldUntil AS stockHoldUntil,o.StockReleaseAfter AS stockReleaseAfter,
      CASE WHEN o.StockHoldUntil IS NULL THEN N'legacy'
        WHEN o.StockReleaseAfter<=SYSUTCDATETIME() THEN N'overdue'
        WHEN o.StockHoldUntil<=SYSUTCDATETIME() THEN N'awaiting_confirmation' ELSE N'holding' END AS phase,
      CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.PaymentAttempts p WHERE p.OrderId=o.Id AND p.State=N'pending' AND p.ExpiresAt>SYSUTCDATETIME()) THEN 1 ELSE 0 END AS bit) AS hasLiveAttempt
    FROM dbo.Orders o WHERE o.Status IN(N'pending',N'confirmed')
      AND o.PaymentMethod=N'vnpay' AND o.PaymentStatus IN(N'unpaid',N'failed')
    ORDER BY CASE WHEN o.StockHoldUntil IS NULL OR o.StockReleaseAfter<=SYSUTCDATETIME() THEN 0 ELSE 1 END,o.StockReleaseAfter,o.Id;
  `);
  res.json({ data: result.recordset, meta: { workerEnabled: config.stockHold.enabled, holdMinutes: config.stockHold.minutes, graceMinutes: config.stockHold.graceMinutes, limit: 100 } });
}));

paymentOperationsRouter.get("/payment-pending", asyncHandler(async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 50 p.Id AS id,p.OrderId AS orderId,p.Amount AS amount,p.State AS state,
      p.CreatedAt AS createdAt,p.ExpiresAt AS expiresAt,o.Status AS orderStatus,o.CustomerName AS customerName
    FROM dbo.PaymentAttempts p INNER JOIN dbo.Orders o ON o.Id=p.OrderId
    WHERE p.State IN (N'pending',N'failed') AND p.CreatedAt>DATEADD(DAY,-14,SYSUTCDATETIME())
    ORDER BY p.CreatedAt ASC,p.Id ASC;
  `);
  res.json({ data: result.recordset, meta: { queryAvailable: Boolean(config.vnpay.queryEnabled && config.vnpay.tmnCode && config.vnpay.hashSecret) } });
}));

paymentOperationsRouter.post("/payment-reconciliation/:attemptId/query", asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(req.params.attemptId);
  const pool = await getPool();
  const attempt = (await pool.request().input("id", sql.BigInt, id).query<QueryAttempt>("SELECT OrderId,TxnRef,Amount,PaymentUrl FROM dbo.PaymentAttempts WHERE Id=@id;")).recordset[0];
  if (!attempt) throw new HttpError(404, "Không tìm thấy giao dịch.", "PAYMENT_ATTEMPT_NOT_FOUND");
  // No SQL transaction/locks are held during the provider network request.
  const query = await queryVnpayAttempt(attempt, config.vnpay, config.vnpay.queryIpAddress ?? req.socket.localAddress ?? "127.0.0.1");
  const applied = query.result ? await applyPaymentResult(query.result, { userId: req.authUser!.id, requestId: req.requestId }) : undefined;
  if (applied?.code === "01" || applied?.code === "04") throw new HttpError(409, "Giao dịch đã thay đổi trong lúc truy vấn. Vui lòng kiểm tra lại.", "PAYMENT_QUERY_CONFLICT");
  await pool.request().input("id", sql.BigInt, id).input("user", sql.Int, req.authUser!.id).input("request", sql.NVarChar(80), req.requestId)
    .input("code", sql.NVarChar(2), query.providerCode).input("status", sql.NVarChar(2), query.providerStatus.slice(0, 2)).query(`
      INSERT dbo.AdminAuditEvents(AdminUserId,Action,EntityType,EntityId,DetailJson,RequestId)
      SELECT @user,N'payment.query_checked',N'payment_attempt',CONVERT(NVARCHAR(80),@id),
        (SELECT @code AS providerCode,@status AS providerStatus FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@request;
    `);
  res.json({ data: { id, orderId: attempt.OrderId, outcome: query.outcome, changed: applied?.changed ?? false,
    message: query.outcome === "paid" ? "VNPay đã xác nhận thu tiền. Trạng thái đơn được đối chiếu lại." : query.outcome === "failed" ? "VNPay xác nhận giao dịch không thành công." : "VNPay chưa xác nhận thanh toán hoàn tất. Có thể kiểm tra lại sau." } });
}));

paymentOperationsRouter.get("/payment-reconciliation", asyncHandler(async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 100 p.Id AS id, p.OrderId AS orderId, p.TxnRef AS txnRef, p.Amount AS amount,
      p.State AS state, p.TransactionNo AS transactionNo, p.ReviewReason AS reviewReason,
      p.CreatedAt AS createdAt, p.PaidAt AS paidAt, o.Status AS orderStatus, o.CustomerName AS customerName
    FROM dbo.PaymentAttempts p INNER JOIN dbo.Orders o ON o.Id = p.OrderId
    WHERE p.NeedsReview = 1 ORDER BY p.CreatedAt ASC, p.Id ASC;
  `);
  res.json({ data: result.recordset });
}));

// Record a refund already confirmed in the provider portal; this does not send money.
paymentOperationsRouter.post("/payment-reconciliation/:attemptId/refund-confirmation", asyncHandler(async (req, res) => {
  const attemptId = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(req.params.attemptId);
  const body = z.object({ providerReference: z.string().trim().min(4).max(100), note: z.string().trim().min(10).max(500) }).parse(req.body);
  const pool = await getPool();
  const lookup = await pool.request().input("attemptId", sql.BigInt, attemptId)
    .query<{ OrderId: number }>(`SELECT OrderId FROM dbo.PaymentAttempts WHERE Id = @attemptId;`);
  const orderId = lookup.recordset[0]?.OrderId;
  if (!orderId) throw new HttpError(404, "Không tìm thấy giao dịch.", "PAYMENT_ATTEMPT_NOT_FOUND");
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    // All payment mutations acquire the order lock before the attempt lock.
    await new sql.Request(transaction).input("orderId", sql.Int, orderId).query(`SELECT Id FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK) WHERE Id = @orderId;`);
    const attempt = await new sql.Request(transaction).input("attemptId", sql.BigInt, attemptId)
      .query<{ State: string; NeedsReview: boolean; TransactionNo: string; RefundReference: string | null }>(`SELECT State, NeedsReview, TransactionNo, RefundReference FROM dbo.PaymentAttempts WITH (UPDLOCK, HOLDLOCK) WHERE Id = @attemptId;`);
    const current = attempt.recordset[0];
    if (current?.State === "refunded" && current.RefundReference === body.providerReference) {
      await transaction.commit(); res.json({ data: { id: attemptId, state: "refunded", replayed: true } }); return;
    }
    if (!current || current.State !== "paid" || !current.NeedsReview) throw new HttpError(409, "Giao dịch không đang chờ xử lý hoàn tiền.", "PAYMENT_REVIEW_CONFLICT");
    await new sql.Request(transaction).input("attemptId", sql.BigInt, attemptId).input("orderId", sql.Int, orderId)
      .input("providerReference", sql.NVarChar(100), body.providerReference).input("note", sql.NVarChar(500), body.note)
      .input("userId", sql.Int, req.authUser!.id).input("txnNo", sql.NVarChar(100), current.TransactionNo)
      .input("requestId", sql.NVarChar(80), req.requestId)
      .query(`
        UPDATE dbo.PaymentAttempts SET State = N'refunded', NeedsReview = 0, RefundReference = @providerReference,
          ResolvedByUserId = @userId, ResolvedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @attemptId;
        UPDATE dbo.Orders SET PaymentStatus = CASE WHEN EXISTS (
            SELECT 1 FROM dbo.PaymentAttempts WHERE OrderId=@orderId AND State=N'paid' AND NeedsReview=1
          ) THEN N'refund_pending' ELSE N'refunded' END, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @orderId AND PaymentStatus IN (N'refund_pending',N'refunded');
        INSERT INTO dbo.AdminAuditEvents (AdminUserId, Action, EntityType, EntityId, DetailJson, RequestId)
        SELECT @userId, N'payment.refund_recorded', N'payment_attempt', CONVERT(NVARCHAR(80), @attemptId),
          (SELECT @providerReference AS providerReference, @note AS note FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @requestId;
      `);
    await transaction.commit();
    res.json({ data: { id: attemptId, state: "refunded" } });
  } catch (cause) {
    await transaction.rollback().catch(() => undefined); throw cause;
  }
}));

paymentOperationsRouter.get("/order-notifications", asyncHandler(async (_req, res) => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT DeliveryState AS state, COUNT(*) AS total FROM dbo.OrderNotifications GROUP BY DeliveryState;
    SELECT TOP 30 Id AS id, OrderId AS orderId, OrderStatus AS orderStatus, DeliveryState AS state,
      AttemptCount AS attemptCount, LastError AS lastError, NextAttemptAt AS nextAttemptAt
    FROM dbo.OrderNotifications WHERE DeliveryState <> N'sent' ORDER BY CreatedAt ASC, Id ASC;
  `);
  const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
  res.json({ data: { summary: sets[0] ?? [], pending: sets[1] ?? [] } });
}));

paymentOperationsRouter.post("/order-notifications/:notificationId/retry", asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.notificationId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const updated = await new sql.Request(transaction).input("id", sql.BigInt, id).input("userId", sql.Int, req.authUser!.id)
      .input("requestId", sql.NVarChar(80), req.requestId).query(`
        UPDATE dbo.OrderNotifications SET DeliveryState = N'pending', AttemptCount = 0, NextAttemptAt = SYSUTCDATETIME(), LeaseToken = NULL, LeaseUntil = NULL
        OUTPUT INSERTED.Id AS id
        WHERE Id = @id AND (DeliveryState = N'failed' OR (DeliveryState = N'processing' AND LeaseUntil < SYSUTCDATETIME()));
        IF @@ROWCOUNT > 0
          INSERT INTO dbo.AdminAuditEvents (AdminUserId, Action, EntityType, EntityId, RequestId)
          VALUES (@userId, N'notification.retry_requested', N'order_notification', CONVERT(NVARCHAR(80), @id), @requestId;
      `);
    if (!updated.recordset.length) throw new HttpError(409, "Chỉ có thể thử lại email đã lỗi hoặc hết thời hạn xử lý.", "NOTIFICATION_RETRY_CONFLICT");
    await transaction.commit(); res.json({ data: { id, state: "pending" } });
  } catch (cause) { await transaction.rollback().catch(() => undefined); throw cause; }
}));
