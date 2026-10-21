import { getPool, sql } from "../db/pool.js";
import { checkPaymentAttempt, paymentReviewReason, type PaymentAttempt, type PaymentOrder, type PaymentResult } from "../domain/payment.js";
import { deliverOrderNotificationLater } from "./order-notifications.js";
import { expireStockHold } from "./stock-holds.js";

export async function applyPaymentResult(result: PaymentResult, actor?: { userId: number; requestId: string }) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let notificationId: number | undefined;
  try {
    const order = (await transaction.request().input("orderId", sql.Int, result.orderId).query<PaymentOrder>(`
      SELECT Status,PaymentMethod,PaymentStatus,PaymentUrl,TotalAmount
      FROM dbo.Orders WITH (UPDLOCK,HOLDLOCK) WHERE Id=@orderId;
    `)).recordset[0];
    const attempt = (await transaction.request().input("orderId", sql.Int, result.orderId).input("ref", sql.NVarChar(100), result.txnRef)
      .query<PaymentAttempt>("SELECT Id,OrderId,TxnRef,Amount,State FROM dbo.PaymentAttempts WITH (UPDLOCK,HOLDLOCK) WHERE OrderId=@orderId AND TxnRef=@ref;")).recordset[0];
    const code = checkPaymentAttempt(order, attempt, result);
    if (!order || !attempt || code !== "00") {
      await transaction.rollback();
      return { code, changed: false };
    }
    if (!result.isSuccess && attempt.State === "failed") {
      await transaction.commit(); return { code: "00", changed: false };
    }
    // Enforce the cutoff even if the background worker was temporarily offline.
    // Validation above must succeed before an IPN can expire any reservation.
    const expiration = await expireStockHold(transaction, result.orderId);
    if (expiration.expired) { order.Status = "cancelled"; notificationId = expiration.notificationId; }
    const reviewReason = result.isSuccess ? paymentReviewReason(order, result.amount) : null;
    const settle = result.isSuccess && !reviewReason;
    // A new late payment after a previous refund must reopen refund_pending.
    const needsRefund = result.isSuccess && Boolean(reviewReason) && order.PaymentStatus !== "paid";
    let currentRef: string | null = null;
    try { currentRef = order.PaymentUrl ? new URL(order.PaymentUrl).searchParams.get("vnp_TxnRef") : null; } catch { /* legacy invalid URL cannot defeat a signed result */ }
    const failCurrent = !result.isSuccess && currentRef === result.txnRef && !["paid", "refund_pending", "refunded"].includes(order.PaymentStatus);
    const nextStatus = settle && order.Status === "pending" ? "confirmed" : order.Status;
    const changed = await transaction.request().input("orderId", sql.Int, result.orderId)
      .input("attemptId", sql.BigInt, attempt.Id).input("paid", sql.Bit, result.isSuccess)
      .input("settle", sql.Bit, settle).input("needsRefund", sql.Bit, needsRefund).input("failCurrent", sql.Bit, failCurrent)
      .input("review", sql.NVarChar(500), reviewReason).input("response", sql.NVarChar(2), result.responseCode)
      .input("txn", sql.NVarChar(100), result.transactionNo).input("from", sql.NVarChar(30), order.Status).input("to", sql.NVarChar(30), nextStatus)
      .input("note", sql.NVarChar(500), reviewReason ?? (result.isSuccess ? "Thanh toán VNPay đã được xác nhận." : "Thanh toán VNPay không thành công."))
      .query<{ id: number }>(`
        UPDATE dbo.PaymentAttempts SET State=CASE WHEN @paid=1 THEN N'paid' ELSE N'failed' END,
          TransactionNo=@txn,ResponseCode=@response,NeedsReview=CASE WHEN @review IS NULL THEN 0 ELSE 1 END,ReviewReason=@review,
          PaidAt=CASE WHEN @paid=1 THEN SYSUTCDATETIME() ELSE PaidAt END,UpdatedAt=SYSUTCDATETIME() WHERE Id=@attemptId;
        UPDATE dbo.Orders SET
          PaymentStatus=CASE WHEN @settle=1 THEN N'paid' WHEN @needsRefund=1 THEN N'refund_pending' WHEN @failCurrent=1 THEN N'failed' ELSE PaymentStatus END,
          Status=@to,PaymentTransactionId=CASE WHEN @settle=1 OR @needsRefund=1 THEN @txn ELSE PaymentTransactionId END,
          PaymentPaidAt=CASE WHEN @settle=1 OR @needsRefund=1 THEN SYSUTCDATETIME() ELSE PaymentPaidAt END,UpdatedAt=SYSUTCDATETIME() WHERE Id=@orderId;
        INSERT dbo.OrderStatusHistory(OrderId,FromStatus,ToStatus,ChangedByUserId,Note) VALUES(@orderId,@from,@to,NULL,@note);
        IF @from<>@to
          INSERT dbo.OrderNotifications(OrderId,RecipientEmail,OrderStatus) OUTPUT INSERTED.Id AS id
          SELECT @orderId,u.Email,@to FROM dbo.Orders o INNER JOIN dbo.Users u ON u.Id=o.UserId WHERE o.Id=@orderId;
      `);
    notificationId = changed.recordset?.[0]?.id ?? notificationId;
    if (actor) await transaction.request().input("user", sql.Int, actor.userId).input("request", sql.NVarChar(80), actor.requestId)
      .input("attempt", sql.BigInt, attempt.Id).input("txn", sql.NVarChar(100), result.transactionNo)
      .input("state", sql.NVarChar(20), result.isSuccess ? "paid" : "failed").query(`
        INSERT dbo.AdminAuditEvents(AdminUserId,Action,EntityType,EntityId,DetailJson,RequestId)
        SELECT @user,N'payment.query_applied',N'payment_attempt',CONVERT(NVARCHAR(80),@attempt),
          (SELECT @state AS state,@txn AS transactionNo FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@request;
      `);
    await transaction.commit();
  } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  deliverOrderNotificationLater(notificationId);
  return { code: "00", changed: true };
}
