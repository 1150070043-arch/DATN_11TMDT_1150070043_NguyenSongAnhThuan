import { getPool, sql } from "../db/pool.js";
import { logger } from "./logger.js";
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
  const claim = await pool.request()
    .input("notificationId", sql.BigInt, notificationId)
    .query<PendingNotification>(`
      SET NOCOUNT ON;
      DECLARE @claimed TABLE (
        Id BIGINT, OrderId INT, RecipientEmail NVARCHAR(255), OrderStatus NVARCHAR(30), AttemptCount INT
      );

      UPDATE dbo.OrderNotifications WITH (ROWLOCK, READPAST, READCOMMITTEDLOCK)
      SET DeliveryState = N'processing', AttemptCount = AttemptCount + 1, LastError = NULL
      OUTPUT INSERTED.Id, INSERTED.OrderId, INSERTED.RecipientEmail, INSERTED.OrderStatus, INSERTED.AttemptCount
        INTO @claimed
      WHERE Id = @notificationId
        AND DeliveryState IN (N'pending', N'failed')
        AND AttemptCount < 3;

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
      .query(`
        UPDATE dbo.OrderNotifications
        SET DeliveryState = N'sent', SentAt = SYSUTCDATETIME(), LastError = NULL
        WHERE Id = @notificationId AND DeliveryState = N'processing'
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
      .input("message", sql.NVarChar(1000), message.slice(0, 1000))
      .query(`
        UPDATE dbo.OrderNotifications
        SET DeliveryState = N'failed', LastError = @message
        WHERE Id = @notificationId AND DeliveryState = N'processing'
      `)
      .catch(() => undefined);
    logger.error("order_status_email_failed", {
      notificationId: notification.Id,
      orderId: notification.OrderId,
      status: notification.OrderStatus,
      message
    });
    if (notification.AttemptCount < 3) {
      const retry = setTimeout(
        () => deliverOrderNotificationLater(notification.Id),
        notification.AttemptCount * 5_000
      );
      retry.unref();
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
  await pool.request().query(`
    UPDATE dbo.OrderNotifications
    SET DeliveryState = N'failed', LastError = N'Khôi phục sau khi tiến trình gửi trước bị gián đoạn'
    WHERE DeliveryState = N'processing' AND CreatedAt < DATEADD(MINUTE, -5, SYSUTCDATETIME());
  `);
  const pending = await pool.request()
    .input("limit", sql.Int, Math.max(1, Math.min(limit, 100)))
    .query<{ Id: number }>(`
      SELECT TOP (@limit) Id
      FROM dbo.OrderNotifications
      WHERE DeliveryState IN (N'pending', N'failed') AND AttemptCount < 3
      ORDER BY CreatedAt ASC, Id ASC;
    `);
  for (const row of pending.recordset) {
    await deliverOrderNotification(Number(row.Id));
  }
}
