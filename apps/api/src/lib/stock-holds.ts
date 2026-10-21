import { config } from "../config.js";
import { sql } from "../db/pool.js";
import { releaseOrderReservation } from "./order-reservation.js";

export async function initializeStockHold(transaction: sql.Transaction, orderId: number) {
  return (await transaction.request().input("order", sql.Int, orderId)
    .input("minutes", sql.Int, config.stockHold.minutes).input("grace", sql.Int, config.stockHold.graceMinutes)
    .query<{ StockHoldUntil: Date; StockReleaseAfter: Date }>(`
      DECLARE @now DATETIME2(0)=SYSUTCDATETIME();
      UPDATE dbo.Orders SET StockHoldUntil=DATEADD(MINUTE,@minutes,@now),
        StockReleaseAfter=DATEADD(MINUTE,@minutes+@grace,@now)
      WHERE Id=@order AND StockHoldUntil IS NULL;
      SELECT StockHoldUntil,StockReleaseAfter FROM dbo.Orders WHERE Id=@order;
    `)).recordset[0]!;
}

// Every caller locks the order first. Recheck eligibility under that lock, including
// captured attempts, so racing workers, cancellation and signed IPN serialize.
export async function expireStockHold(transaction: sql.Transaction, orderId: number): Promise<{ expired: boolean; notificationId?: number }> {
  const order = (await transaction.request().input("order", sql.Int, orderId).query<{ Status: string }>(`
    SELECT Status FROM dbo.Orders WITH (UPDLOCK,HOLDLOCK)
    WHERE Id=@order AND Status IN(N'pending',N'confirmed') AND PaymentMethod=N'vnpay'
      AND PaymentStatus IN(N'unpaid',N'failed') AND StockReleaseAfter<=SYSUTCDATETIME()
      AND StockExpiredAt IS NULL;
  `)).recordset[0];
  if (!order) return { expired: false };
  const blocked = (await transaction.request().input("order", sql.Int, orderId).query(`
    SELECT TOP 1 Id FROM dbo.PaymentAttempts WITH (UPDLOCK,HOLDLOCK) WHERE OrderId=@order
      AND (State IN(N'paid',N'refunded') OR (State=N'pending' AND ExpiresAt>SYSUTCDATETIME()));
  `)).recordset.length > 0;
  if (blocked) return { expired: false };
  const note = "Đơn hết thời hạn giữ kho VNPay; đã hoàn kho và lượt ưu đãi. Khoản thu đến muộn cần đối soát.";
  await releaseOrderReservation(transaction, orderId, note, null);
  const notification = (await transaction.request().input("order", sql.Int, orderId)
    .input("from", sql.NVarChar(30), order.Status).input("note", sql.NVarChar(500), note).query<{ id: number }>(`
      UPDATE dbo.Orders SET Status=N'cancelled',StockExpiredAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE Id=@order;
      INSERT dbo.OrderStatusHistory(OrderId,FromStatus,ToStatus,ChangedByUserId,Note) VALUES(@order,@from,N'cancelled',NULL,@note);
      INSERT dbo.OrderNotifications(OrderId,RecipientEmail,OrderStatus) OUTPUT INSERTED.Id AS id
      SELECT @order,u.Email,N'cancelled' FROM dbo.Orders o INNER JOIN dbo.Users u ON u.Id=o.UserId WHERE o.Id=@order;
    `)).recordset[0]?.id;
  return { expired: true, ...(notification ? { notificationId: notification } : {}) };
}

export async function expireStockHoldBatch(pool: sql.ConnectionPool, batchSize = config.stockHold.batchSize) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error("Stock hold batch size must be 1–100");
  const candidates = (await pool.request().input("batch", sql.Int, batchSize).query<{ Id: number }>(`
    SELECT TOP (@batch) o.Id FROM dbo.Orders o
    WHERE o.StockReleaseAfter<=SYSUTCDATETIME() AND o.StockExpiredAt IS NULL
      AND o.Status IN(N'pending',N'confirmed') AND o.PaymentMethod=N'vnpay' AND o.PaymentStatus IN(N'unpaid',N'failed')
      AND NOT EXISTS(SELECT 1 FROM dbo.PaymentAttempts p WHERE p.OrderId=o.Id
        AND (p.State IN(N'paid',N'refunded') OR (p.State=N'pending' AND p.ExpiresAt>SYSUTCDATETIME())))
    ORDER BY o.StockReleaseAfter,o.Id;
  `)).recordset;
  const notifications: number[] = [];
  let expired = 0;
  for (const candidate of candidates) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await expireStockHold(transaction, candidate.Id);
      await transaction.commit();
      if (result.expired) expired++;
      if (result.notificationId) notifications.push(result.notificationId);
    } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  }
  // Outbox rows are committed with cancellation; the notification worker drains them.
  return { scanned: candidates.length, expired, notifications };
}
