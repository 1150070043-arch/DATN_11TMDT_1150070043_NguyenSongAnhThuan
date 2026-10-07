import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { requireAuth } from "../security/auth.js";
import { recordSecurityEvent } from "../security/events.js";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(2).max(2000)
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  category: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(40).default(12),
  sort: z.enum(["newest", "price-asc", "price-desc", "title"]).default("newest")
});

const orderBy = {
  newest: "b.CreatedAt DESC, b.Id DESC",
  "price-asc": "b.Price ASC, b.Id ASC",
  "price-desc": "b.Price DESC, b.Id DESC",
  title: "b.Title ASC"
} as const;

export const booksRouter = Router();

booksRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id AS id, Name AS name, Slug AS slug
      FROM dbo.Categories ORDER BY Name
    `);
    res.json({ data: result.recordset });
  })
);

booksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listSchema.parse(req.query);
    const pool = await getPool();
    const offset = (query.page - 1) * query.limit;

    const selectColumns = `
      b.Id AS id, b.Title AS title, b.Slug AS slug, b.Author AS author,
      b.Isbn AS isbn, b.Description AS description, b.Price AS price,
      b.Stock AS stock, b.CoverUrl AS coverUrl,
      c.Id AS categoryId, c.Name AS categoryName,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.WishlistItems w
        WHERE w.UserId = @viewerId AND w.BookId = b.Id
      ) THEN 1 ELSE 0 END AS bit) AS isWishlisted
    `;

    if (!config.isSecure && query.q) {
      // SECURITY LAB: string concatenation is intentionally retained only for TC01.
      const vulnerableWhere = `
        b.IsPublished = 1
        AND (b.Title LIKE N'%${query.q}%' OR b.Author LIKE N'%${query.q}%')
        ${query.category ? `AND b.CategoryId = ${query.category}` : ""}
      `;
      const result = await pool
        .request()
        .input("viewerId", sql.Int, req.authUser?.id ?? null)
        .query(`
        SELECT ${selectColumns}
        FROM dbo.Books b
        INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
        WHERE ${vulnerableWhere}
        ORDER BY ${orderBy[query.sort]}
        OFFSET ${offset} ROWS FETCH NEXT ${query.limit} ROWS ONLY;

        SELECT COUNT(*) AS total
        FROM dbo.Books b
        WHERE ${vulnerableWhere};
      `);
      const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
      res.json({
        data: sets[0] ?? [],
        meta: { page: query.page, limit: query.limit, total: Number(sets[1]?.[0]?.total ?? 0) }
      });
      return;
    }

    const request = pool
      .request()
      .input("search", sql.NVarChar(220), `%${query.q}%`)
      .input("category", sql.Int, query.category ?? null)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, query.limit)
      .input("viewerId", sql.Int, req.authUser?.id ?? null);

    const result = await request.query(`
      SELECT ${selectColumns}
      FROM dbo.Books b
      INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
      WHERE b.IsPublished = 1
        AND (@category IS NULL OR b.CategoryId = @category)
        AND (@search = N'%%' OR b.Title LIKE @search OR b.Author LIKE @search)
      ORDER BY ${orderBy[query.sort]}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(*) AS total
      FROM dbo.Books b
      WHERE b.IsPublished = 1
        AND (@category IS NULL OR b.CategoryId = @category)
        AND (@search = N'%%' OR b.Title LIKE @search OR b.Author LIKE @search);
    `);

    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    res.json({
      data: sets[0] ?? [],
      meta: { page: query.page, limit: query.limit, total: Number(sets[1]?.[0]?.total ?? 0) }
    });
  })
);

booksRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = z.string().trim().min(1).max(280).parse(req.params.slug);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("slug", sql.NVarChar(280), slug)
      .input("viewerId", sql.Int, req.authUser?.id ?? null)
      .query(`
        SELECT
          b.Id AS id, b.Title AS title, b.Slug AS slug, b.Author AS author,
          b.Isbn AS isbn, b.Description AS description, b.Price AS price,
          b.Stock AS stock, b.CoverUrl AS coverUrl,
          c.Id AS categoryId, c.Name AS categoryName,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.WishlistItems w
            WHERE w.UserId = @viewerId AND w.BookId = b.Id
          ) THEN 1 ELSE 0 END AS bit) AS isWishlisted
        FROM dbo.Books b
        INNER JOIN dbo.Categories c ON c.Id = b.CategoryId
        WHERE b.Slug = @slug AND b.IsPublished = 1;

        SELECT
          r.Id AS id, r.Rating AS rating, r.Content AS content,
          r.CreatedAt AS createdAt, u.Id AS userId, u.FullName AS userName
        FROM dbo.Reviews r
        INNER JOIN dbo.Users u ON u.Id = r.UserId
        INNER JOIN dbo.Books b ON b.Id = r.BookId
        WHERE b.Slug = @slug
        ORDER BY r.CreatedAt DESC;
      `);
    const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
    const book = sets[0]?.[0];
    if (!book) throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");
    res.json({ data: { ...book, reviews: sets[1] ?? [] } });
  })
);

booksRouter.post(
  "/:bookId/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookId = z.coerce.number().int().positive().parse(req.params.bookId);
    const body = reviewSchema.parse(req.body);
    if (/<\/?script|javascript:|onerror\s*=/i.test(body.content)) {
      await recordSecurityEvent("SUSPICIOUS_INPUT", req, { field: "review", bookId });
    }
    const storedContent = config.isSecure
      ? body.content.replace(/<[^>]*>/g, "").trim()
      : body.content;
    if (!storedContent) {
      throw new HttpError(422, "Nội dung đánh giá không hợp lệ.", "INVALID_REVIEW_CONTENT");
    }

    const pool = await getPool();
    const book = await pool
      .request()
      .input("bookId", sql.Int, bookId)
      .query("SELECT Id FROM dbo.Books WHERE Id = @bookId AND IsPublished = 1");
    if (book.recordset.length === 0) throw new HttpError(404, "Không tìm thấy sách.", "BOOK_NOT_FOUND");

    const result = await pool
      .request()
      .input("bookId", sql.Int, bookId)
      .input("userId", sql.Int, req.authUser!.id)
      .input("rating", sql.TinyInt, body.rating)
      .input("content", sql.NVarChar(2000), storedContent)
      .query(`
        INSERT INTO dbo.Reviews (BookId, UserId, Rating, Content)
        OUTPUT INSERTED.Id AS id, INSERTED.Rating AS rating,
               INSERTED.Content AS content, INSERTED.CreatedAt AS createdAt
        VALUES (@bookId, @userId, @rating, @content)
      `);
    res.status(201).json({ data: result.recordset[0] });
  })
);
