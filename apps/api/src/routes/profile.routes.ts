import crypto from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { detectImage } from "../lib/images.js";
import { requireAuth } from "../security/auth.js";
import { recordSecurityEvent } from "../security/events.js";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional().default(""),
  addressLine: z.string().trim().max(500).optional().default("")
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    ...(config.isSecure ? { fields: 0, parts: 2, headerPairs: 100 } : {}),
    fileSize: (config.isSecure ? 2 : 12) * 1024 * 1024
  }
});

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get(
  "/wishlist",
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        SELECT
          b.Id AS id, b.Title AS title, b.Slug AS slug, b.Author AS author,
          b.Isbn AS isbn, b.Description AS description, b.Price AS price,
          b.Stock AS stock, b.CoverUrl AS coverUrl,
          c.Id AS categoryId, c.Name AS categoryName,
          CAST(1 AS bit) AS isWishlisted,
          w.CreatedAt AS wishlistedAt
        FROM dbo.WishlistItems w
        INNER JOIN dbo.Books b ON b.Id = w.BookId
        INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
        WHERE w.UserId = @userId AND b.IsPublished = 1
        ORDER BY w.CreatedAt DESC
      `);
    res.json({ data: result.recordset });
  })
);

profileRouter.put(
  "/wishlist/:bookId",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const book = await new sql.Request(transaction)
        .input("bookId", sql.Int, bookId)
        .query("SELECT Id FROM dbo.Books WITH (HOLDLOCK) WHERE Id = @bookId AND IsPublished = 1");
      if (book.recordset.length === 0) {
        throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
      }
      await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("bookId", sql.Int, bookId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM dbo.WishlistItems WITH (UPDLOCK, HOLDLOCK)
            WHERE UserId = @userId AND BookId = @bookId
          )
          INSERT INTO dbo.WishlistItems (UserId, BookId)
          VALUES (@userId, @bookId)
        `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json({ data: { bookId, isWishlisted: true } });
  })
);

profileRouter.delete(
  "/wishlist/:bookId",
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const pool = await getPool();
    await pool
      .request()
      .input("userId", sql.Int, req.authUser!.id)
      .input("bookId", sql.Int, bookId)
      .query("DELETE FROM dbo.WishlistItems WHERE UserId = @userId AND BookId = @bookId");
    res.status(204).send();
  })
);

profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = profileSchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.authUser!.id)
      .input("fullName", sql.NVarChar(160), body.fullName)
      .input("phone", sql.NVarChar(30), body.phone || null)
      .input("address", sql.NVarChar(500), body.addressLine || null)
      .query(`
        UPDATE dbo.Users
        SET
          FullName = @fullName,
          Phone = @phone,
          AddressLine = @address,
          UpdatedAt = SYSUTCDATETIME()
        OUTPUT
          INSERTED.Id AS id, INSERTED.Email AS email, INSERTED.FullName AS fullName,
          INSERTED.Phone AS phone, INSERTED.AddressLine AS addressLine,
          INSERTED.AvatarUrl AS avatarUrl
        WHERE Id = @id
      `);
    res.json({ data: result.recordset[0] });
  })
);

profileRouter.post(
  "/avatar",
  upload.single("avatar"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(422, "Vui lòng chọn một tệp.", "FILE_REQUIRED");

    let extension = path.extname(path.basename(file.originalname)).slice(0, 12).toLowerCase() || ".bin";
    let mime = file.mimetype || "application/octet-stream";
    const detected = detectImage(file.buffer);

    if (config.isSecure) {
      if (
        file.size > 2 * 1024 * 1024 ||
        !detected ||
        ![".png", ".jpg", ".jpeg", ".webp"].includes(extension) ||
        detected.mime !== file.mimetype
      ) {
        await recordSecurityEvent("UPLOAD_REJECTED", req, {
          originalName: path.basename(file.originalname),
          suppliedMime: file.mimetype,
          size: file.size,
          detectedMime: detected?.mime ?? null
        });
        throw new HttpError(
          422,
          "Ảnh phải là PNG, JPEG hoặc WebP hợp lệ và không vượt quá 2 MB.",
          "UPLOAD_REJECTED"
        );
      }
      extension = detected.extension;
      mime = detected.mime;
    }

    await mkdir(config.uploadDir, { recursive: true });
    const storedName = `${crypto.randomUUID()}${extension}`;
    const storedPath = path.join(config.uploadDir, storedName);
    await writeFile(storedPath, file.buffer, { flag: "wx" });
    const avatarUrl = `/uploads/${storedName}`;

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let previousAvatarUrl: string | null = null;
    try {
      const previousAvatar = await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .query<{ AvatarUrl: string | null }>(`
          SELECT AvatarUrl
          FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @userId
        `);
      previousAvatarUrl = previousAvatar.recordset[0]?.AvatarUrl ?? null;

      await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("originalName", sql.NVarChar(255), path.basename(file.originalname).slice(0, 255))
        .input("storedName", sql.NVarChar(255), storedName)
        .input("mime", sql.NVarChar(120), mime.slice(0, 120))
        .input("size", sql.BigInt, file.size)
        .query(`
          INSERT INTO dbo.Uploads (UserId, OriginalName, StoredName, MimeType, SizeBytes)
          VALUES (@userId, @originalName, @storedName, @mime, @size)
        `);
      await new sql.Request(transaction)
        .input("userId", sql.Int, req.authUser!.id)
        .input("avatarUrl", sql.NVarChar(500), avatarUrl)
        .query(`
          UPDATE dbo.Users
          SET AvatarUrl = @avatarUrl, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @userId
        `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      await unlink(storedPath).catch(() => undefined);
      throw error;
    }

    if (previousAvatarUrl?.startsWith("/uploads/")) {
      const previousName = path.basename(previousAvatarUrl);
      if (previousName !== storedName) {
        await unlink(path.join(config.uploadDir, previousName)).catch(() => undefined);
      }
    }

    res.status(201).json({ data: { avatarUrl, storedName, mime, size: file.size } });
  })
);
