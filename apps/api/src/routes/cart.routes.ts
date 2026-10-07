import { Router } from "express";
import { z } from "zod";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { requireAuth } from "../security/auth.js";

const itemSchema = z.object({
  bookId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1)
});

const quantitySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99)
});

async function cartIdForUser(pool: sql.ConnectionPool, userId: number): Promise<number> {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await new sql.Request(transaction)
      .input("userId", sql.Int, userId)
      .query<{ Id: number }>(`
        SELECT Id
        FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @userId
      `);
    let id = result.recordset[0]?.Id;
    if (!id) {
      const created = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .query<{ Id: number }>(
          "INSERT INTO dbo.Carts (UserId) OUTPUT INSERTED.Id VALUES (@userId)"
        );
      id = created.recordset[0]?.Id;
    }
    if (!id) throw new Error("Không thể tạo giỏ hàng.");
    await transaction.commit();
    return id;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export const cartRouter = Router();
cartRouter.use(requireAuth);

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    const cartId = await cartIdForUser(pool, req.authUser!.id);
    const result = await pool
      .request()
      .input("cartId", sql.Int, cartId)
      .query(`
        SELECT
          ci.Id AS id, ci.Quantity AS quantity,
          b.Id AS bookId, b.Title AS title, b.Slug AS slug,
          b.Author AS author, b.Price AS price, b.Stock AS stock,
          b.CoverUrl AS coverUrl,
          CAST(b.Price * ci.Quantity AS DECIMAL(18,2)) AS lineTotal
        FROM dbo.CartItems ci
        INNER JOIN dbo.Books b ON b.Id = ci.BookId
        WHERE ci.CartId = @cartId AND b.IsPublished = 1
        ORDER BY ci.Id DESC
      `);
    const total = result.recordset.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0
    );
    res.json({ data: { id: cartId, items: result.recordset, total } });
  })
);

cartRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const body = itemSchema.parse(req.body);
    const pool = await getPool();
    const cartId = await cartIdForUser(pool, req.authUser!.id);
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const book = await new sql.Request(transaction)
        .input("bookId", sql.Int, body.bookId)
        .query<{ Stock: number }>(`
          SELECT Stock
          FROM dbo.Books WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @bookId AND IsPublished = 1
        `);
      const stock = book.recordset[0]?.Stock;
      if (stock === undefined) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }

      const current = await new sql.Request(transaction)
        .input("cartId", sql.Int, cartId)
        .input("bookId", sql.Int, body.bookId)
        .query<{ Quantity: number }>(`
          SELECT Quantity
          FROM dbo.CartItems WITH (UPDLOCK, HOLDLOCK)
          WHERE CartId = @cartId AND BookId = @bookId
        `);
      const nextQuantity = Number(current.recordset[0]?.Quantity ?? 0) + body.quantity;
      if (nextQuantity > stock || nextQuantity > 99) {
        throw new HttpError(409, "Số lượng trong kho không đủ.", "INSUFFICIENT_STOCK");
      }

      await new sql.Request(transaction)
        .input("cartId", sql.Int, cartId)
        .input("bookId", sql.Int, body.bookId)
        .input("quantity", sql.Int, nextQuantity)
        .query(`
          IF EXISTS (SELECT 1 FROM dbo.CartItems WHERE CartId = @cartId AND BookId = @bookId)
            UPDATE dbo.CartItems SET Quantity = @quantity
            WHERE CartId = @cartId AND BookId = @bookId;
          ELSE
            INSERT INTO dbo.CartItems (CartId, BookId, Quantity)
            VALUES (@cartId, @bookId, @quantity);

          UPDATE dbo.Carts SET UpdatedAt = SYSUTCDATETIME() WHERE Id = @cartId;
        `);
      await transaction.commit();
      res.status(201).json({ data: { cartId, bookId: body.bookId, quantity: nextQuantity } });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

cartRouter.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = z.coerce.number().int().positive().parse(req.params.itemId);
    const body = quantitySchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("itemId", sql.Int, itemId)
      .input("userId", sql.Int, req.authUser!.id)
      .input("quantity", sql.Int, body.quantity)
      .query(`
        UPDATE ci
        SET Quantity = @quantity
        OUTPUT INSERTED.Id AS id, INSERTED.Quantity AS quantity
        FROM dbo.CartItems ci
        INNER JOIN dbo.Carts c ON c.Id = ci.CartId
        INNER JOIN dbo.Books b ON b.Id = ci.BookId
        WHERE ci.Id = @itemId AND c.UserId = @userId AND b.Stock >= @quantity;

        UPDATE c
        SET UpdatedAt = SYSUTCDATETIME()
        FROM dbo.Carts c
        INNER JOIN dbo.CartItems ci ON ci.CartId = c.Id
        WHERE ci.Id = @itemId AND c.UserId = @userId;
      `);
    if (result.recordset.length === 0) {
      throw new HttpError(404, "Không tìm thấy sản phẩm hoặc số lượng không hợp lệ.", "CART_ITEM_NOT_FOUND");
    }
    res.json({ data: result.recordset[0] });
  })
);

cartRouter.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = z.coerce.number().int().positive().parse(req.params.itemId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("itemId", sql.Int, itemId)
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        DELETE ci
        FROM dbo.CartItems ci
        INNER JOIN dbo.Carts c ON c.Id = ci.CartId
        WHERE ci.Id = @itemId AND c.UserId = @userId;

        IF @@ROWCOUNT > 0
          UPDATE dbo.Carts SET UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId;
      `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new HttpError(404, "Không tìm thấy sản phẩm trong giỏ.", "CART_ITEM_NOT_FOUND");
    }
    res.status(204).send();
  })
);
