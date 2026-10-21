import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { detectImage } from "../lib/images.js";
import { logger } from "../lib/logger.js";
import { experimentDashboard, syncExperimentReports } from "../lib/experiments.js";
import { requireAdmin } from "../security/auth.js";
import { recordSecurityEvent } from "../security/events.js";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

const userStatusSchema = z.object({
  isActive: z.boolean()
});

const securityReportSchema = z.object({
  summary: z.object({
    generatedAt: z.string().datetime(),
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    baselineVulnerable: z.number().int().nonnegative(),
    secureProtected: z.number().int().nonnegative()
  }),
  results: z.array(
    z.object({
      id: z.string().max(30),
      name: z.string().max(200),
      reference: z.string().max(100).optional(),
      baseline: z.object({
        protected: z.boolean(),
        status: z.number().int(),
        evidence: z.string().max(2000),
        durationMs: z.number().nonnegative().optional()
      }),
      secure: z.object({
        protected: z.boolean(),
        status: z.number().int(),
        evidence: z.string().max(2000),
        durationMs: z.number().nonnegative().optional()
      }),
      passed: z.boolean()
    })
  ).max(100)
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 3 * 1024 * 1024, fields: 0, parts: 2, headerPairs: 100 }
});

export const adminOperationsRouter = Router();
adminOperationsRouter.use(requireAdmin);

adminOperationsRouter.get(
  "/experiments",
  asyncHandler(async (_req, res) => {
    res.json({ data: await experimentDashboard() });
  })
);

adminOperationsRouter.post(
  "/experiments/sync",
  asyncHandler(async (req, res) => {
    const sync = await syncExperimentReports();
    await recordSecurityEvent("EXPERIMENT_REPORTS_SYNCED", req, {
      imported: sync.imported,
      unchanged: sync.unchanged,
      rejected: sync.rejected.length
    }, "info").catch(() => undefined);
    res.json({ data: { sync, dashboard: await experimentDashboard() } });
  })
);

adminOperationsRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        c.Id AS id, c.Name AS name, c.Slug AS slug,
        COUNT(b.Id) AS bookCount
      FROM dbo.Categories c
      LEFT JOIN dbo.Books b ON b.CategoryId = c.Id
      GROUP BY c.Id, c.Name, c.Slug
      ORDER BY c.Name ASC
    `);
    res.json({ data: result.recordset });
  })
);

adminOperationsRouter.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction)
        .input("name", sql.NVarChar(120), body.name)
        .input("slug", sql.NVarChar(140), body.slug)
        .query(`
          DECLARE @nextId INT = ISNULL((SELECT MAX(Id) FROM dbo.Categories WITH (UPDLOCK, HOLDLOCK)), 0) + 1;
          INSERT INTO dbo.Categories (Id, Name, Slug)
          OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Slug AS slug
          VALUES (@nextId, @name, @slug);
        `);
      await transaction.commit();
      res.status(201).json({ data: { ...result.recordset[0], bookCount: 0 } });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

adminOperationsRouter.put(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const categoryId = z.coerce.number().int().positive().parse(req.params.categoryId);
    const body = categorySchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("categoryId", sql.Int, categoryId)
      .input("name", sql.NVarChar(120), body.name)
      .input("slug", sql.NVarChar(140), body.slug)
      .query(`
        UPDATE dbo.Categories
        SET Name = @name, Slug = @slug
        OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Slug AS slug
        WHERE Id = @categoryId
      `);
    if (result.recordset.length === 0) {
      throw new HttpError(404, "Không tìm thấy thể loại.", "CATEGORY_NOT_FOUND");
    }
    res.json({ data: result.recordset[0] });
  })
);

adminOperationsRouter.delete(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const categoryId = z.coerce.number().int().positive().parse(req.params.categoryId);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const usage = await new sql.Request(transaction)
        .input("categoryId", sql.Int, categoryId)
        .query<{ Id: number; BookCount: number }>(`
          SELECT c.Id, COUNT(b.Id) AS BookCount
          FROM dbo.Categories c WITH (UPDLOCK, HOLDLOCK)
          LEFT JOIN dbo.Books b WITH (HOLDLOCK) ON b.CategoryId = c.Id
          WHERE c.Id = @categoryId
          GROUP BY c.Id
        `);
      const category = usage.recordset[0];
      if (!category) {
        throw new HttpError(404, "Không tìm thấy thể loại.", "CATEGORY_NOT_FOUND");
      }
      if (Number(category.BookCount) > 0) {
        throw new HttpError(
          409,
          "Không thể xóa thể loại đang có sách. Hãy chuyển sách sang thể loại khác trước.",
          "CATEGORY_IN_USE"
        );
      }
      await new sql.Request(transaction)
        .input("categoryId", sql.Int, categoryId)
        .query("DELETE FROM dbo.Categories WHERE Id = @categoryId");
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.status(204).send();
  })
);

adminOperationsRouter.patch(
  "/users/:userId/status",
  asyncHandler(async (req, res) => {
    const userId = z.coerce.number().int().positive().parse(req.params.userId);
    const body = userStatusSchema.parse(req.body);
    if (userId === req.authUser!.id && !body.isActive) {
      throw new HttpError(409, "Bạn không thể tự khóa tài khoản đang sử dụng.", "CANNOT_DISABLE_SELF");
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("isActive", sql.Bit, body.isActive)
      .query(`
        UPDATE dbo.Users
        SET
          TokenVersion = CASE WHEN IsActive <> @isActive THEN TokenVersion + 1 ELSE TokenVersion END,
          IsActive = @isActive,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.Id AS id, INSERTED.IsActive AS isActive
        WHERE Id = @userId AND RoleId = 2;

        IF @isActive = 0
        BEGIN
          UPDATE dbo.UserSessions
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;

          UPDATE dbo.RefreshTokens
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;
        END;
      `);
    if (result.recordset.length === 0) {
      throw new HttpError(404, "Không tìm thấy tài khoản khách hàng.", "CUSTOMER_NOT_FOUND");
    }
    await recordSecurityEvent(
      "USER_STATUS_CHANGED",
      req,
      { targetUserId: userId, isActive: body.isActive },
      "info"
    );
    res.json({ data: result.recordset[0] });
  })
);

adminOperationsRouter.post(
  "/books/:bookId/cover",
  coverUpload.single("cover"),
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const file = req.file;
    if (!file) throw new HttpError(422, "Vui lòng chọn ảnh bìa.", "FILE_REQUIRED");
    const detected = detectImage(file.buffer);
    if (!detected || detected.mime !== file.mimetype || file.size > 3 * 1024 * 1024) {
      await recordSecurityEvent("BOOK_COVER_UPLOAD_REJECTED", req, {
        bookId,
        originalName: path.basename(file.originalname),
        suppliedMime: file.mimetype,
        size: file.size,
        detectedMime: detected?.mime ?? null
      });
      throw new HttpError(
        422,
        "Ảnh bìa phải là PNG, JPEG hoặc WebP hợp lệ và không vượt quá 3 MB.",
        "UPLOAD_REJECTED"
      );
    }

    const coverDirectory = path.join(config.uploadDir, "book-covers");
    await mkdir(coverDirectory, { recursive: true });
    const storedName = `${crypto.randomUUID()}${detected.extension}`;
    const storedRelativeName = `book-covers/${storedName}`;
    const storedPath = path.join(coverDirectory, storedName);
    const coverUrl = `/uploads/${storedRelativeName}`;
    await writeFile(storedPath, file.buffer, { flag: "wx" });

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let previousCoverUrl: string | null = null;
    try {
      const current = await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .query<{ CoverUrl: string | null }>(`
          SELECT CoverUrl FROM dbo.Books WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookId
        `);
      if (current.recordset.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }
      previousCoverUrl = current.recordset[0]?.CoverUrl ?? null;

      await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("originalName", sql.NVarChar(255), path.basename(file.originalname).slice(0, 255))
        .input("storedName", sql.NVarChar(255), storedRelativeName)
        .input("mime", sql.NVarChar(120), detected.mime)
        .input("size", sql.BigInt, file.size)
        .query(`
          INSERT INTO dbo.Uploads (UserId, OriginalName, StoredName, MimeType, SizeBytes)
          VALUES (@userId, @originalName, @storedName, @mime, @size)
        `);
      await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .input("coverUrl", sql.NVarChar(600), coverUrl)
        .query(`
          UPDATE dbo.Books
          SET CoverUrl = @coverUrl, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @bookId
        `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      await unlink(storedPath).catch(() => undefined);
      throw error;
    }

    if (previousCoverUrl?.startsWith("/uploads/book-covers/")) {
      const previousName = path.basename(previousCoverUrl);
      if (previousName !== storedName) {
        await unlink(path.join(coverDirectory, previousName)).catch(() => undefined);
      }
    }
    res.status(201).json({ data: { bookId, coverUrl, mime: detected.mime, size: file.size } });
  })
);

adminOperationsRouter.get(
  "/orders/:orderId",
  asyncHandler(async (req, res) => {
    const orderId = z.coerce.number().int().positive().parse(req.params.orderId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT
          o.Id AS id, o.UserId AS userId, u.Email AS customerEmail,
          o.CustomerName AS customerName, o.Phone AS phone,
          o.ShippingAddress AS shippingAddress, o.Note AS note,
          o.Status AS status, o.SubtotalAmount AS subtotalAmount,
          o.DiscountAmount AS discountAmount, o.CouponCode AS couponCode,
          o.TotalAmount AS totalAmount,
          o.PaymentMethod AS paymentMethod,o.PaymentStatus AS paymentStatus,
          o.StockHoldUntil AS stockHoldUntil,o.StockReleaseAfter AS stockReleaseAfter,o.StockExpiredAt AS stockExpiredAt,
          o.CreatedAt AS createdAt, o.UpdatedAt AS updatedAt
        FROM dbo.Orders o
        INNER JOIN dbo.Users u ON u.Id = o.UserId
        WHERE o.Id = @orderId;

        SELECT
          Id AS id, BookId AS bookId, BookTitle AS bookTitle,
          UnitPrice AS unitPrice, Quantity AS quantity
        FROM dbo.OrderItems
        WHERE OrderId = @orderId
        ORDER BY Id ASC;

        SELECT
          h.Id AS id, h.FromStatus AS fromStatus, h.ToStatus AS toStatus,
          h.Note AS note, h.CreatedAt AS createdAt,
          u.FullName AS changedByName
        FROM dbo.OrderStatusHistory h
        LEFT JOIN dbo.Users u ON u.Id = h.ChangedByUserId
        WHERE h.OrderId = @orderId
        ORDER BY h.CreatedAt ASC, h.Id ASC;

        SELECT TOP 10
          Id AS id, RecipientEmail AS recipientEmail, OrderStatus AS orderStatus,
          DeliveryState AS deliveryState, AttemptCount AS attemptCount,
          LastError AS lastError, CreatedAt AS createdAt, SentAt AS sentAt
        FROM dbo.OrderNotifications
        WHERE OrderId = @orderId
        ORDER BY CreatedAt DESC, Id DESC;
      `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    const order = sets[0]?.[0];
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND");
    res.json({
      data: {
        ...order,
        items: sets[1] ?? [],
        statusHistory: sets[2] ?? [],
        emailNotifications: sets[3] ?? []
      }
    });
  })
);

adminOperationsRouter.get(
  "/security-report",
  asyncHandler(async (_req, res) => {
    const reportPath = path.join(config.reportsDir, "security-results.json");
    try {
      const metadata = await stat(reportPath);
      if (metadata.size > 2 * 1024 * 1024) {
        res.json({ data: { available: false, reason: "Báo cáo vượt quá giới hạn đọc an toàn." } });
        return;
      }
      const raw = await readFile(reportPath, "utf8");
      const parsed = securityReportSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        res.json({ data: { available: false, reason: "Báo cáo chưa đúng định dạng được hỗ trợ." } });
        return;
      }
      res.json({ data: { available: true, ...parsed.data } });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        logger.error("security_report_read_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
      res.json({
        data: {
          available: false,
          reason: code === "ENOENT"
            ? "Chưa có kết quả. Hãy chạy bộ kiểm thử bảo mật để tạo báo cáo."
            : "Không thể đọc báo cáo bảo mật hiện tại."
        }
      });
    }
  })
);

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

adminOperationsRouter.get(
  "/security-report.csv",
  asyncHandler(async (_req, res) => {
    const reportPath = path.join(config.reportsDir, "security-results.json");
    let report: z.infer<typeof securityReportSchema>;
    try {
      const metadata = await stat(reportPath);
      if (metadata.size > 2 * 1024 * 1024) {
        throw new HttpError(422, "Báo cáo vượt quá giới hạn xuất.", "REPORT_TOO_LARGE");
      }
      const raw = await readFile(reportPath, "utf8");
      report = securityReportSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        404,
        "Chưa có báo cáo hợp lệ để xuất. Hãy chạy bộ kiểm thử trước.",
        "SECURITY_REPORT_NOT_FOUND"
      );
    }

    const rows: unknown[][] = [
      [
        "Mã test",
        "Kịch bản",
        "Chuẩn tham chiếu",
        "Baseline được bảo vệ",
        "Baseline HTTP",
        "Baseline thời gian (ms)",
        "Baseline minh chứng",
        "Secure được bảo vệ",
        "Secure HTTP",
        "Secure thời gian (ms)",
        "Secure minh chứng",
        "Đạt kỳ vọng",
        "Thời điểm tạo"
      ],
      ...report.results.map((item) => [
        item.id,
        item.name,
        item.reference ?? "",
        item.baseline.protected ? "Có" : "Không",
        item.baseline.status,
        item.baseline.durationMs ?? "",
        item.baseline.evidence,
        item.secure.protected ? "Có" : "Không",
        item.secure.status,
        item.secure.durationMs ?? "",
        item.secure.evidence,
        item.passed ? "Đạt" : "Chưa đạt",
        report.summary.generatedAt
      ])
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="bookguard-security-report.csv"');
    res.send(csv);
  })
);
