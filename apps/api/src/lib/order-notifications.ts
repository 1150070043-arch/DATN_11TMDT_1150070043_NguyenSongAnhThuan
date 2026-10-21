import crypto from "node:crypto";
import { getPool, sql } from "../db/pool.js";
import { logger } from "./logger.js";
import { sendAlertNonBlocking } from "./alerting.js";
import { sendOrderStatusEmail, type MailOrderStatus } from "./mailer.js";

type PendingNotification = {
  Id: number;
  OrderId: number;
  RecipientEmail: string;
  OrderStatus: MailOrderStatus;
  AttemptCount: number;
  CustomerName: string;
  TotalAmount: number;
};

export async function deliverOrderNotification(notificationId: number): Promise<void> {
  const pool = await getPool();
  const leaseToken = crypto.randomUUID();
  const claim = await pool.request()
    .input("notificationId", sql.BigInt, notificationId)
    .input("leaseToken", sql.UniqueIdentifier, leaseToken)
    .query<PendingNotification>(`
      -- SQL pool connections can retain SERIALIZABLE after checkout transactions.
      SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
      SET NOCOUNT ON;
      DECLARE @claimed TABLE (
        Id BIGINT, OrderId INT, RecipientEmail NVARCHAR(255), OrderStatus NVARCHAR(30), AttemptCount INT
      );

      UPDATE dbo.OrderNotifications WITH (UPDLOCK, READPAST, READCOMMITTEDLOCK)
      SET DeliveryState = N'processing', AttemptCount = AttemptCount + 1, LastError = NULL,
        LeaseToken = @leaseToken, LeaseUntil = DATEADD(MINUTE, 2, SYSUTCDATETIME())
      OUTPUT INSERTED.Id, INSERTED.OrderId, INSERTED.RecipientEmail, INSERTED.OrderStatus, INSERTED.AttemptCount
        INTO @claimed
      WHERE Id = @notificationId
        AND NextAttemptAt <= SYSUTCDATETIME()
        AND (DeliveryState IN (N'pending', N'failed') OR (DeliveryState = N'processing' AND LeaseUntil < SYSUTCDATETIME()))
        AND AttemptCount < 10;

      SELECT
        c.Id, c.OrderId, c.RecipientEmail, c.OrderStatus, c.AttemptCount,
        o.CustomerName, o.TotalAmount
      FROM @claimed c
      INNER JOIN dbo.Orders o ON o.Id = c.OrderId;
    `);
  const notification = claim.recordset[0];
  if (!notification) return;

  try {
    await sendOrderStatusEmail({
      to: notification.RecipientEmail,
      customerName: notification.CustomerName,
      orderId: notification.OrderId,
      status: notification.OrderStatus,
      totalAmount: Number(notification.TotalAmount)
    });
    await pool.request()
      .input("notificationId", sql.BigInt, notification.Id)
      .input("leaseToken", sql.UniqueIdentifier, leaseToken)
      .query(`
        UPDATE dbo.OrderNotifications
        SET DeliveryState = N'sent', SentAt = SYSUTCDATETIME(), LastError = NULL, LeaseToken = NULL, LeaseUntil = NULL
        WHERE Id = @notificationId AND DeliveryState = N'processing' AND LeaseToken = @leaseToken
      `);
    logger.info("order_status_email_sent", {
      notificationId: notification.Id,
      orderId: notification.OrderId,
      status: notification.OrderStatus
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.request()
      .input("notificationId", sql.BigInt, notification.Id)
      .input("leaseToken", sql.UniqueIdentifier, leaseToken)
      .input("retrySeconds", sql.Int, Math.min(3600, 5 * 2 ** (notification.AttemptCount - 1)))
      .input("message", sql.NVarChar(1000), message.slice(0, 1000))
      .query(`
        UPDATE dbo.OrderNotifications
        SET DeliveryState = N'failed', LastError = @message, LeaseToken = NULL, LeaseUntil = NULL,
          NextAttemptAt = DATEADD(SECOND, @retrySeconds, SYSUTCDATETIME())
        WHERE Id = @notificationId AND DeliveryState = N'processing' AND LeaseToken = @leaseToken
      `)
      .catch(() => undefined);
    logger.error("order_status_email_failed", {
      notificationId: notification.Id,
      orderId: notification.OrderId,
      status: notification.OrderStatus,
      message
    });
    if (notification.AttemptCount >= 10) {
      sendAlertNonBlocking({
        level: "critical",
        type: "OUTBOX_DELIVERY_EXHAUSTED",
        message: `Thông báo đơn hàng #${notification.OrderId} tới ${notification.RecipientEmail} đã thất bại sau 10 lần thử: ${message}`,
        details: {
          notificationId: notification.Id,
          orderId: notification.OrderId,
          recipient: notification.RecipientEmail,
          status: notification.OrderStatus,
          attempts: notification.AttemptCount,
          lastError: message
        }
      });
    }
  }
}

export function deliverOrderNotificationLater(notificationId: number | undefined): void {
  if (!notificationId) return;
  void deliverOrderNotification(notificationId).catch((error) => {
    logger.error("order_notification_dispatch_failed", {
      notificationId,
      message: error instanceof Error ? error.message : String(error)
    });
  });
}

export async function drainOrderNotifications(limit = 20): Promise<void> {
  const pool = await getPool();
  const pending = await pool.request()
    .input("limit", sql.Int, Math.max(1, Math.min(limit, 100)))
    .query<{ Id: number }>(`
      SELECT TOP (@limit) Id
      FROM dbo.OrderNotifications
      WHERE AttemptCount < 10 AND NextAttemptAt <= SYSUTCDATETIME()
        AND (DeliveryState IN (N'pending', N'failed') OR (DeliveryState = N'processing' AND LeaseUntil < SYSUTCDATETIME()))
      ORDER BY CreatedAt ASC, Id ASC;
    `);
  for (const row of pending.recordset) {
    await deliverOrderNotification(Number(row.Id));
  }
}

export function startOrderNotificationWorker(intervalMs = 5_000): () => Promise<void> {
  let stopped = false;
  let running: Promise<void> | undefined;
  function tick() {
    if (stopped || running) return;
    running = drainOrderNotifications().catch(error => {
      logger.error("order_notification_drain_failed", { message: error instanceof Error ? error.message : String(error) });
    }).finally(() => { running = undefined; });
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
