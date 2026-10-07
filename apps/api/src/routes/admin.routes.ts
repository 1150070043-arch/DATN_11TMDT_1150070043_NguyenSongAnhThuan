import { Router, type Request } from "express";
import { z } from "zod";
import { getPool, sql } from "../db/pool.js";
import {
  canTransitionOrder,
  orderStatuses,
  type OrderStatus
} from "../domain/order-status.js";
import { calculateAdjustedStock } from "../domain/inventory.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { deliverOrderNotificationLater } from "../lib/order-notifications.js";
import { requireAdmin } from "../security/auth.js";
import { recordSecurityEvent } from "../security/events.js";

const storedCoverPattern = /^\/uploads\/book-covers\/[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i;

function isAllowedCoverUrl(value: string): boolean {
  if (value === "" || storedCoverPattern.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "covers.openlibrary.org";
  } catch {
    return false;
  }
}

const bookSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(280).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  author: z.string().trim().min(2).max(180),
  isbn: z.string().trim().max(20).optional().default(""),
  description: z.string().trim().min(20).max(8000),
  price: z.coerce.number().min(0).max(100_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  coverUrl: z.string().max(600).refine(isAllowedCoverUrl, "Hãy dùng URL Open Library hoặc tải ảnh bìa trực tiếp.").default(""),
  categoryId: z.coerce.number().int().positive(),
  isPublished: z.boolean().optional().default(true)
});

const orderStatusSchema = z.object({
  status: z.enum(orderStatuses)
});

const publicationSchema = z.object({
  isPublished: z.boolean()
});

const stockAdjustmentSchema = z.object({
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
  note: z.string().trim().min(4).max(500)
});

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive().max(100_000_000),
  minimumOrder: z.coerce.number().min(0).max(100_000_000).default(0),
  maximumDiscount: z.coerce.number().positive().max(100_000_000).nullable().optional(),
  usageLimit: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date()
}).refine((value) => value.endsAt > value.startsAt, { message: "Thời gian kết thúc phải sau thời gian bắt đầu.", path: ["endsAt"] })
  .refine((value) => value.discountType !== "percent" || value.discountValue <= 100, { message: "Giảm theo phần trăm không được vượt quá 100%.", path: ["discountValue"] });

async function auditAdmin(req: Request, action: string, entityType: string, entityId: string | number | null, detail: unknown) {
  const pool = await getPool();
  await pool.request()
    .input("adminUserId", sql.Int, req.authUser!.id)
    .input("action", sql.NVarChar(80), action)
    .input("entityType", sql.NVarChar(50), entityType)
    .input("entityId", sql.NVarChar(80), entityId == null ? null : String(entityId))
    .input("detail", sql.NVarChar(sql.MAX), JSON.stringify(detail))
    .input("requestId", sql.NVarChar(80), req.requestId)
    .query(`INSERT INTO dbo.AdminAuditEvents (AdminUserId, Action, EntityType, EntityId, DetailJson, RequestId)
            VALUES (@adminUserId, @action, @entityType, @entityId, @detail, @requestId)`);
}

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.Users WHERE RoleId = 2) AS customers,
        (SELECT COUNT(*) FROM dbo.Books WHERE IsPublished = 1) AS books,
        (SELECT COUNT(*) FROM dbo.Orders) AS orders,
        (SELECT COALESCE(SUM(TotalAmount), 0) FROM dbo.Orders WHERE Status = N'completed') AS revenue,
        (SELECT COUNT(*) FROM dbo.Orders WHERE Status = N'pending') AS pendingOrders;

      SELECT TOP 8
        Id AS id, CustomerName AS customerName, Status AS status,
        TotalAmount AS totalAmount, CreatedAt AS createdAt
      FROM dbo.Orders
      ORDER BY CreatedAt DESC;

      WITH Statuses AS (
        SELECT N'pending' AS Status, 1 AS SortOrder UNION ALL
        SELECT N'confirmed', 2 UNION ALL
        SELECT N'shipping', 3 UNION ALL
        SELECT N'completed', 4 UNION ALL
        SELECT N'cancelled', 5
      )
      SELECT s.Status AS status, COUNT(o.Id) AS total
      FROM Statuses s
      LEFT JOIN dbo.Orders o ON o.Status = s.Status
      GROUP BY s.Status, s.SortOrder
      ORDER BY s.SortOrder;

      SELECT
        CONVERT(char(10), CAST(CreatedAt AS date), 23) AS day,
        COUNT(*) AS orders,
        COALESCE(SUM(TotalAmount), 0) AS revenue
      FROM dbo.Orders
      WHERE Status = N'completed' AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
      GROUP BY CAST(CreatedAt AS date)
      ORDER BY CAST(CreatedAt AS date) ASC;

      SELECT TOP 8
        b.Id AS id, b.Title AS title, b.Stock AS stock,
        b.IsPublished AS isPublished
      FROM dbo.Books b
      ORDER BY b.Stock ASC, b.Title ASC;

      SELECT TOP 6
        oi.BookId AS bookId, MAX(oi.BookTitle) AS title,
        SUM(oi.Quantity) AS quantity
      FROM dbo.OrderItems oi
      INNER JOIN dbo.Orders o ON o.Id = oi.OrderId
      WHERE o.Status = N'completed'
      GROUP BY oi.BookId
      ORDER BY SUM(oi.Quantity) DESC, MAX(oi.BookTitle) ASC;
    `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    res.json({
      data: {
        summary: sets[0]?.[0],
        recentOrders: sets[1] ?? [],
        ordersByStatus: sets[2] ?? [],
        revenueByDay: sets[3] ?? [],
        lowStock: sets[4] ?? [],
        topSelling: sets[5] ?? []
      }
    });
  })
);

adminRouter.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(10).max(200).catch(80).parse(req.query.limit);
    const pool = await getPool();
    const result = await pool.request()
      .input("limit", sql.Int, limit)
      .query(`
        SELECT
          COUNT(*) AS totalTitles,
          COALESCE(SUM(Stock), 0) AS totalUnits,
          SUM(CASE WHEN Stock = 0 THEN 1 ELSE 0 END) AS outOfStock,
          SUM(CASE WHEN Stock BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS lowStock
        FROM dbo.Books;

        SELECT
          b.Id AS id, b.Title AS title, b.Author AS author,
          b.Stock AS stock, b.IsPublished AS isPublished,
          c.Name AS categoryName,
          movement.CreatedAt AS lastMovementAt
        FROM dbo.Books b
        INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
        OUTER APPLY (
          SELECT TOP 1 m.CreatedAt
          FROM dbo.InventoryMovements m
          WHERE m.BookId = b.Id
          ORDER BY m.CreatedAt DESC, m.Id DESC
        ) movement
        ORDER BY b.Stock ASC, b.Title ASC;

        SELECT TOP (@limit)
          m.Id AS id, m.BookId AS bookId, b.Title AS bookTitle,
          m.MovementType AS movementType, m.QuantityDelta AS quantityDelta,
          m.BalanceAfter AS balanceAfter, m.ReferenceType AS referenceType,
          m.ReferenceId AS referenceId, m.Note AS note,
          u.FullName AS changedByName, m.CreatedAt AS createdAt
        FROM dbo.InventoryMovements m
        INNER JOIN dbo.Books b ON b.Id = m.BookId
        LEFT JOIN dbo.Users u ON u.Id = m.ChangedByUserId
        ORDER BY m.CreatedAt DESC, m.Id DESC;
      `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    res.json({
      data: {
        summary: sets[0]?.[0] ?? {},
        books: sets[1] ?? [],
        movements: sets[2] ?? []
      }
    });
  })
);

adminRouter.post(
  "/books/:bookId/stock-adjustments",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const body = stockAdjustmentSchema.parse(req.body);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const current = await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .query<{ Stock: number }>(`
          SELECT Stock FROM dbo.Books WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookId
        `);
      const previousStock = current.recordset[0]?.Stock;
      if (previousStock === undefined) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }
      const adjustment = calculateAdjustedStock(Number(previousStock), body.delta);
      if (!adjustment.ok && adjustment.code === "NEGATIVE_STOCK") {
        throw new HttpError(409, "Số lượng điều chỉnh làm kho bị âm.", "NEGATIVE_STOCK");
      }
      if (!adjustment.ok && adjustment.code === "STOCK_LIMIT_EXCEEDED") {
        throw new HttpError(422, "Số lượng tồn kho vượt giới hạn cho phép.", "STOCK_LIMIT_EXCEEDED");
      }
      if (!adjustment.ok) {
        throw new HttpError(422, "Số lượng điều chỉnh không hợp lệ.", "INVALID_ADJUSTMENT");
      }
      const nextStock = adjustment.nextStock;

      const result = await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .input("delta", sql.Int, body.delta)
        .input("balanceAfter", sql.Int, nextStock)
        .input("note", sql.NVarChar(500), body.note)
        .input("changedBy", sql.Int, req.authUser!.id)
        .query(`
          UPDATE dbo.Books
          SET Stock = @balanceAfter, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @bookId;

          INSERT INTO dbo.InventoryMovements
            (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, ChangedByUserId)
          OUTPUT
            INSERTED.Id AS id, INSERTED.BookId AS bookId,
            INSERTED.QuantityDelta AS quantityDelta, INSERTED.BalanceAfter AS balanceAfter,
            INSERTED.Note AS note, INSERTED.CreatedAt AS createdAt
          VALUES
            (@bookId, N'adjustment', @delta, @balanceAfter, N'admin', @note, @changedBy);
        `);
      await transaction.commit();
      await recordSecurityEvent(
        "INVENTORY_ADJUSTED",
        req,
        { bookId, delta: body.delta, previousStock, nextStock, note: body.note },
        "info"
      );
      res.status(201).json({ data: result.recordset[0] });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        u.Id AS id, u.Email AS email, u.FullName AS fullName,
        r.Name AS role, u.IsActive AS isActive,
        CAST(CASE WHEN u.EmailVerifiedAt IS NULL THEN 0 ELSE 1 END AS bit) AS emailVerified,
        u.CreatedAt AS createdAt
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON r.Id = u.RoleId
      ORDER BY u.CreatedAt DESC
    `);
    res.json({ data: result.recordset });
  })
);

adminRouter.get(
  "/orders",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        o.Id AS id, o.UserId AS userId, u.Email AS customerEmail,
        o.CustomerName AS customerName, o.Status AS status,
        o.TotalAmount AS totalAmount, o.CreatedAt AS createdAt
      FROM dbo.Orders o
      INNER JOIN dbo.Users u ON u.Id = o.UserId
      ORDER BY o.CreatedAt DESC
    `);
    res.json({ data: result.recordset });
  })
);

adminRouter.get(
  "/books",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        b.Id AS id, b.Title AS title, b.Slug AS slug, b.Author AS author,
        b.Isbn AS isbn, b.Description AS description, b.Price AS price,
        b.Stock AS stock, b.CoverUrl AS coverUrl, b.IsPublished AS isPublished,
        c.Id AS categoryId, c.Name AS categoryName
      FROM dbo.Books b
      INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
      ORDER BY b.IsPublished DESC, b.Title ASC
    `);
    res.json({ data: result.recordset });
  })
);

adminRouter.patch(
  "/orders/:orderId/status",
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const body = orderStatusSchema.parse(req.body);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let notificationId: number | undefined;
    try {
      const current = await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .query<{ Status: string }>(`
          SELECT Status
          FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @orderId
        `);
      const currentStatus = current.recordset[0]?.Status as OrderStatus | undefined;
      if (!currentStatus) {
        throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
      }
      if (currentStatus === body.status) {
        await transaction.commit();
        res.json({ data: { id: orderId, status: currentStatus } });
        return;
      }
      if (!canTransitionOrder(currentStatus, body.status)) {
        throw new HttpError(
          409,
          `Không thể chuyển đơn từ ${currentStatus} sang ${body.status}.`,
          "INVALID_ORDER_TRANSITION"
        );
      }

      if (body.status === "cancelled") {
        await new sql.Request(transaction)
          .input("orderId", sql.Int, orderId)
          .input("changedBy", sql.Int, req.authUser!.id)
          .query(`
            UPDATE b
            SET b.Stock = b.Stock + oi.Quantity, b.UpdatedAt = SYSUTCDATETIME()
            FROM dbo.Books b
            INNER JOIN dbo.OrderItems oi ON oi.BookId = b.Id
            WHERE oi.OrderId = @orderId;

            INSERT INTO dbo.InventoryMovements
              (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, ReferenceId, Note, ChangedByUserId)
            SELECT
              oi.BookId, N'return', oi.Quantity, b.Stock, N'order', @orderId,
              N'Hoàn kho khi quản trị viên hủy đơn', @changedBy
            FROM dbo.OrderItems oi
            INNER JOIN dbo.Books b ON b.Id = oi.BookId
            WHERE oi.OrderId = @orderId;

            UPDATE c SET c.UsedCount = CASE WHEN c.UsedCount > 0 THEN c.UsedCount - 1 ELSE 0 END,
              c.UpdatedAt = SYSUTCDATETIME()
            FROM dbo.Coupons c INNER JOIN dbo.CouponRedemptions r ON r.CouponId = c.Id
            WHERE r.OrderId = @orderId AND r.ReleasedAt IS NULL;
            UPDATE dbo.CouponRedemptions SET ReleasedAt = SYSUTCDATETIME()
            WHERE OrderId = @orderId AND ReleasedAt IS NULL;
          `);
      }

      const updated = await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("status", sql.NVarChar(30), body.status)
        .input("changedBy", sql.Int, req.authUser!.id)
        .input("fromStatus", sql.NVarChar(30), currentStatus)
        .query<{ notificationId: number }>(`
          UPDATE dbo.Orders
          SET Status = @status, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @orderId;

          INSERT INTO dbo.OrderStatusHistory
            (OrderId, FromStatus, ToStatus, ChangedByUserId, Note)
          VALUES
            (@orderId, @fromStatus, @status, @changedBy, N'Quản trị viên cập nhật trạng thái');

          INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus)
          OUTPUT INSERTED.Id AS notificationId
          SELECT o.Id, u.Email, @status
          FROM dbo.Orders o
          INNER JOIN dbo.Users u ON u.Id = o.UserId
          WHERE o.Id = @orderId;
        `);
      notificationId = updated.recordset[0]?.notificationId;
      await transaction.commit();
      await auditAdmin(req, "order.status_changed", "order", orderId, { from: currentStatus, to: body.status });
      deliverOrderNotificationLater(notificationId);
      res.json({ data: { id: orderId, status: body.status } });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

adminRouter.post(
  "/books",
  asyncHandler(async (req, res) => {
    const body = bookSchema.parse(req.body);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction)
      .input("title", sql.NVarChar(255), body.title)
      .input("slug", sql.NVarChar(280), body.slug)
      .input("author", sql.NVarChar(180), body.author)
      .input("isbn", sql.NVarChar(20), body.isbn || null)
      .input("description", sql.NVarChar(sql.MAX), body.description)
      .input("price", sql.Decimal(18, 2), body.price)
      .input("stock", sql.Int, body.stock)
      .input("coverUrl", sql.NVarChar(600), body.coverUrl || null)
      .input("categoryId", sql.Int, body.categoryId)
      .input("isPublished", sql.Bit, body.isPublished)
      .input("changedBy", sql.Int, req.authUser!.id)
      .query<{ id: number; slug: string }>(`
        INSERT INTO dbo.Books
          (Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
        OUTPUT INSERTED.Id AS id, INSERTED.Slug AS slug
        VALUES
          (@title, @slug, @author, @isbn, @description, @price, @stock, @coverUrl, @categoryId, @isPublished)
      `);
      const saved = result.recordset[0];
      if (!saved) throw new Error("Không thể tạo sách.");
      if (body.stock > 0) {
        await new sql.Request(transaction)
          .input("bookId", sql.Int, saved.id)
          .input("stock", sql.Int, body.stock)
          .input("changedBy", sql.Int, req.authUser!.id)
          .query(`
            INSERT INTO dbo.InventoryMovements
              (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, ChangedByUserId)
            VALUES
              (@bookId, N'opening', @stock, @stock, N'book_create', N'Tồn kho khi tạo đầu sách', @changedBy)
          `);
      }
      await transaction.commit();
      res.status(201).json({ data: saved });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

adminRouter.put(
  "/books/:bookId",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const body = bookSchema.parse(req.body);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const current = await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .query<{ Stock: number }>(`
          SELECT Stock FROM dbo.Books WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookId
        `);
      if (current.recordset.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }
      if (Number(current.recordset[0]?.Stock) !== body.stock) {
        throw new HttpError(
          409,
          "Tồn kho phải được thay đổi tại khu vực Quản lý tồn kho để có lịch sử kiểm toán.",
          "STOCK_ADJUSTMENT_REQUIRED"
        );
      }
      const result = await new sql.Request(transaction)
      .input("bookId", sql.Int, bookId)
      .input("title", sql.NVarChar(255), body.title)
      .input("slug", sql.NVarChar(280), body.slug)
      .input("author", sql.NVarChar(180), body.author)
      .input("isbn", sql.NVarChar(20), body.isbn || null)
      .input("description", sql.NVarChar(sql.MAX), body.description)
      .input("price", sql.Decimal(18, 2), body.price)
      .input("stock", sql.Int, body.stock)
      .input("coverUrl", sql.NVarChar(600), body.coverUrl || null)
      .input("categoryId", sql.Int, body.categoryId)
      .input("isPublished", sql.Bit, body.isPublished)
      .query(`
        UPDATE dbo.Books
        SET
          Title = @title, Slug = @slug, Author = @author, Isbn = @isbn,
          Description = @description, Price = @price,
          CoverUrl = @coverUrl, CategoryId = @categoryId,
          IsPublished = @isPublished, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.Id AS id, INSERTED.Slug AS slug
        WHERE Id = @bookId
      `);
      if (result.recordset.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }
      await transaction.commit();
      res.json({ data: result.recordset[0] });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

adminRouter.delete(
  "/books/:bookId",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("bookId", sql.Int, bookId)
      .query(`
        UPDATE dbo.Books
        SET IsPublished = 0, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @bookId
      `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
    }
    res.status(204).send();
  })
);

adminRouter.patch(
  "/books/:bookId/publication",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const body = publicationSchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("bookId", sql.Int, bookId)
      .input("isPublished", sql.Bit, body.isPublished)
      .query(`
        UPDATE dbo.Books
        SET IsPublished = @isPublished, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.Id AS id, INSERTED.IsPublished AS isPublished
        WHERE Id = @bookId
      `);
    if (result.recordset.length === 0) {
      throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
    }
    res.json({ data: result.recordset[0] });
  })
);

adminRouter.get(
  "/security-events",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 100
        Id AS id, RequestId AS requestId, UserId AS userId,
        EventType AS eventType, Severity AS severity,
        IpAddress AS ipAddress, Method AS method, Path AS path,
        Details AS details, CreatedAt AS createdAt
      FROM dbo.SecurityEvents
      ORDER BY CreatedAt DESC
    `);
    res.json({ data: result.recordset });
  })
);

adminRouter.get(
  "/coupons",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id AS id, Code AS code, DiscountType AS discountType,
        DiscountValue AS discountValue, MinimumOrder AS minimumOrder,
        MaximumDiscount AS maximumDiscount, UsageLimit AS usageLimit,
        UsedCount AS usedCount, StartsAt AS startsAt, EndsAt AS endsAt,
        IsActive AS isActive, CreatedAt AS createdAt
      FROM dbo.Coupons ORDER BY CreatedAt DESC, Id DESC
    `);
    res.json({ data: result.recordset });
  })
);

adminRouter.post(
  "/coupons",
  asyncHandler(async (req, res) => {
    const body = couponSchema.parse(req.body);
    const pool = await getPool();
    try {
      const result = await pool.request()
        .input("code", sql.NVarChar(40), body.code)
        .input("type", sql.NVarChar(10), body.discountType)
        .input("value", sql.Decimal(18, 2), body.discountValue)
        .input("minimum", sql.Decimal(18, 2), body.minimumOrder)
        .input("maximum", sql.Decimal(18, 2), body.maximumDiscount ?? null)
        .input("limit", sql.Int, body.usageLimit ?? null)
        .input("startsAt", sql.DateTime2, body.startsAt)
        .input("endsAt", sql.DateTime2, body.endsAt)
        .query<{ id: number }>(`
          INSERT INTO dbo.Coupons (Code, DiscountType, DiscountValue, MinimumOrder, MaximumDiscount, UsageLimit, StartsAt, EndsAt)
          OUTPUT INSERTED.Id AS id
          VALUES (@code, @type, @value, @minimum, @maximum, @limit, @startsAt, @endsAt)
        `);
      const id = result.recordset[0]!.id;
      await auditAdmin(req, "coupon.created", "coupon", id, { code: body.code, discountType: body.discountType, discountValue: body.discountValue });
      res.status(201).json({ data: { id } });
    } catch (error) {
      if ((error as { number?: number }).number === 2627 || (error as { number?: number }).number === 2601) {
        throw new HttpError(409, "Mã ưu đãi đã tồn tại.", "COUPON_EXISTS");
      }
      throw error;
    }
  })
);

adminRouter.patch(
  "/coupons/:couponId/toggle",
  asyncHandler(async (req, res) => {
    const couponId = z.coerce.number().int().positive().parse(req.params.couponId);
    const active = z.object({ isActive: z.boolean() }).parse(req.body).isActive;
    const pool = await getPool();
    const result = await pool.request().input("couponId", sql.Int, couponId).input("active", sql.Bit, active).query(`
      UPDATE dbo.Coupons SET IsActive = @active, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive
      WHERE Id = @couponId
    `);
    if (!result.recordset[0]) throw new HttpError(404, "Không tìm thấy mã ưu đãi.", "COUPON_NOT_FOUND");
    await auditAdmin(req, active ? "coupon.activated" : "coupon.deactivated", "coupon", couponId, { isActive: active });
    res.json({ data: result.recordset[0] });
  })
);

adminRouter.get(
  "/audit-events",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 200 a.Id AS id, a.Action AS action, a.EntityType AS entityType,
        a.EntityId AS entityId, a.DetailJson AS detailJson, a.RequestId AS requestId,
        a.CreatedAt AS createdAt, u.FullName AS adminName
      FROM dbo.AdminAuditEvents a INNER JOIN dbo.Users u ON u.Id = a.AdminUserId
      ORDER BY a.CreatedAt DESC, a.Id DESC
    `);
    res.json({ data: result.recordset });
  })
);
