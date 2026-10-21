import { sql } from "../db/pool.js";

// Caller holds an UPDLOCK/HOLDLOCK on the order and validates its status.
// Lock books in ID order, then coupons, matching checkout's resource order.
export async function releaseOrderReservation(transaction: sql.Transaction, orderId: number, note: string, actorId: number | null) {
  const items = (await transaction.request().input("order", sql.Int, orderId)
    .query<{ BookId: number; Quantity: number }>(`
      SELECT BookId,SUM(Quantity) AS Quantity FROM dbo.OrderItems
      WHERE OrderId=@order GROUP BY BookId ORDER BY BookId;
    `)).recordset;
  for (const item of items) await transaction.request().input("order", sql.Int, orderId)
    .input("book", sql.Int, item.BookId).input("qty", sql.Int, item.Quantity)
    .input("note", sql.NVarChar(500), note).input("actor", sql.Int, actorId).query(`
      UPDATE dbo.Books WITH (UPDLOCK) SET Stock=Stock+@qty,UpdatedAt=SYSUTCDATETIME() WHERE Id=@book;
      INSERT dbo.InventoryMovements(BookId,MovementType,QuantityDelta,BalanceAfter,ReferenceType,ReferenceId,Note,ChangedByUserId)
      SELECT @book,N'return',@qty,Stock,N'order',@order,@note,@actor FROM dbo.Books WHERE Id=@book;
    `);
  await transaction.request().input("order", sql.Int, orderId).query(`
    UPDATE c SET UsedCount=CASE WHEN UsedCount>0 THEN UsedCount-1 ELSE 0 END,UpdatedAt=SYSUTCDATETIME()
    FROM dbo.Coupons c INNER JOIN dbo.CouponRedemptions r ON r.CouponId=c.Id
    WHERE r.OrderId=@order AND r.ReleasedAt IS NULL;
    UPDATE dbo.CouponRedemptions SET ReleasedAt=SYSUTCDATETIME()
    WHERE OrderId=@order AND ReleasedAt IS NULL;
  `);
}
