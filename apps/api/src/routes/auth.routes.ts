import crypto from "node:crypto";
import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "../lib/mailer.js";
import {
  loginRateLimit,
  passwordResetRateLimit,
  sessionRefreshRateLimit,
  verificationEmailRateLimit
} from "../middleware/rate-limit.js";
import {
  clearRefreshCookie,
  clearSessionCookie,
  issueAccessToken,
  refreshTokenFromRequest,
  requireAuth,
  setRefreshCookie,
  setSessionCookie,
  type AuthUser
} from "../security/auth.js";
import { setCsrfCookie } from "../security/csrf.js";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken
} from "../security/email-verification.js";
import { recordSecurityEvent } from "../security/events.js";
import { createPasswordResetToken, hashPasswordResetToken } from "../security/password-reset.js";
import { createRefreshCredential, hashRefreshToken } from "../security/refresh-token.js";

type LoginRow = {
  Id: number;
  Email: string;
  PasswordSecret: string;
  FullName: string;
  Role: "admin" | "customer";
  TokenVersion: number;
  IsActive: boolean;
  EmailVerifiedAt: Date | null;
};

type RefreshRow = LoginRow & {
  RefreshTokenId: number;
  SessionId: string;
  RefreshExpiresAt: Date;
  RefreshRevokedAt: Date | null;
  ReplacedByTokenHash: string | null;
  SessionExpiresAt: Date;
  SessionRevokedAt: Date | null;
};

type RefreshRotationResult =
  | { ok: true; user: RefreshRow; credential: ReturnType<typeof createRefreshCredential> }
  | { ok: false; reason: "missing" | "expired" | "revoked" | "session" };

// Valid Argon2id hash used when an email does not exist so secure login timing
// remains close to the valid-user path without creating a real credential.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$6Ue3KyVLii3ZeCaBLxk9zQ$NLHez06vMecHcMXG5YBWm5T457yBHTia8R78+mTCn34";

const securePassword = z
  .string()
  .min(10, "Mật khẩu phải có ít nhất 10 ký tự.")
  .max(128)
  .regex(/[a-z]/, "Mật khẩu cần có chữ thường.")
  .regex(/[A-Z]/, "Mật khẩu cần có chữ hoa.")
  .regex(/[0-9]/, "Mật khẩu cần có chữ số.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().email("Email không đúng định dạng.").max(255));

const registerSchema = z.object({
  email: emailSchema,
  password: config.isSecure ? securePassword : z.string().min(1).max(255),
  fullName: z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự.").max(160)
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(255)
});

const forgotPasswordSchema = z.object({
  email: emailSchema
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(200),
  password: config.isSecure ? securePassword : z.string().min(1).max(255)
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(32).max(200)
});

const resendVerificationSchema = z.object({
  email: emailSchema
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  newPassword: config.isSecure ? securePassword : z.string().min(1).max(255)
});

function publicUser(row: LoginRow) {
  return {
    id: row.Id,
    email: row.Email,
    fullName: row.FullName,
    role: row.Role,
    emailVerified: Boolean(row.EmailVerifiedAt)
  };
}

function authUser(row: LoginRow, sessionId: string): AuthUser {
  return {
    id: row.Id,
    sessionId,
    email: row.Email,
    role: row.Role,
    tokenVersion: row.TokenVersion
  };
}

function clientMetadata(req: Parameters<typeof recordSecurityEvent>[1]): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: req.ip?.slice(0, 80) ?? null,
    userAgent: req.header("user-agent")?.slice(0, 500) ?? null
  };
}

async function createSession(
  request: sql.Request,
  userId: number,
  metadata: ReturnType<typeof clientMetadata>
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await request
    .input("sessionId", sql.UniqueIdentifier, sessionId)
    .input("sessionUserId", sql.Int, userId)
    .input("sessionIp", sql.NVarChar(80), metadata.ipAddress)
    .input("sessionAgent", sql.NVarChar(500), metadata.userAgent)
    .input("sessionMinutes", sql.Int, config.isSecure ? config.sessionTtlDays * 24 * 60 : 24 * 60)
    .query(`
      INSERT INTO dbo.UserSessions
        (SessionId, UserId, IpAddress, UserAgent, ExpiresAt)
      VALUES
        (@sessionId, @sessionUserId, @sessionIp, @sessionAgent,
         DATEADD(MINUTE, @sessionMinutes, SYSUTCDATETIME()))
    `);
  return sessionId;
}

async function storeRefreshCredential(
  request: sql.Request,
  userId: number,
  sessionId: string,
  tokenHash: string
): Promise<void> {
  if (!config.isSecure) return;
  await request
    .input("refreshUserId", sql.Int, userId)
    .input("refreshSessionId", sql.UniqueIdentifier, sessionId)
    .input("refreshTokenHash", sql.Char(64), tokenHash)
    .input("refreshDays", sql.Int, config.sessionTtlDays)
    .query(`
      INSERT INTO dbo.RefreshTokens (UserId, SessionId, TokenHash, ExpiresAt)
      VALUES (
        @refreshUserId,
        @refreshSessionId,
        @refreshTokenHash,
        DATEADD(DAY, @refreshDays, SYSUTCDATETIME())
      )
    `);
}

function clearAuthCookies(res: Parameters<typeof clearSessionCookie>[0]): void {
  clearSessionCookie(res);
  clearRefreshCookie(res);
  res.clearCookie(config.identity.csrfCookie, { path: "/" });
}

async function rotateRefreshToken(rawToken: string): Promise<RefreshRotationResult> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const tokenHash = hashRefreshToken(rawToken);
    const result = await new sql.Request(transaction)
      .input("tokenHash", sql.Char(64), tokenHash)
      .query<RefreshRow>(`
        SELECT
          rt.Id AS RefreshTokenId, rt.SessionId, rt.ExpiresAt AS RefreshExpiresAt,
          rt.RevokedAt AS RefreshRevokedAt, rt.ReplacedByTokenHash,
          s.ExpiresAt AS SessionExpiresAt, s.RevokedAt AS SessionRevokedAt,
          u.Id, u.Email, u.PasswordSecret, u.FullName, r.Name AS Role,
          u.TokenVersion, u.IsActive, u.EmailVerifiedAt
        FROM dbo.RefreshTokens rt WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.UserSessions s WITH (UPDLOCK, HOLDLOCK)
          ON s.SessionId = rt.SessionId AND s.UserId = rt.UserId
        INNER JOIN dbo.Users u ON u.Id = rt.UserId
        INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE rt.TokenHash = @tokenHash
      `);
    const row = result.recordset[0];
    if (!row) {
      await transaction.commit();
      return { ok: false, reason: "missing" };
    }

    const now = Date.now();
    const refreshExpired = row.RefreshExpiresAt.getTime() <= now;
    const sessionInvalid =
      !row.IsActive ||
      !row.EmailVerifiedAt ||
      Boolean(row.SessionRevokedAt) ||
      row.SessionExpiresAt.getTime() <= now;
    if (row.RefreshRevokedAt || refreshExpired || sessionInvalid) {
      await new sql.Request(transaction)
        .input("sessionId", sql.UniqueIdentifier, row.SessionId)
        .query(`
          UPDATE dbo.UserSessions
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE SessionId = @sessionId;

          UPDATE dbo.RefreshTokens
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE SessionId = @sessionId;
        `);
      await transaction.commit();
      return {
        ok: false,
        reason: row.RefreshRevokedAt
          ? "revoked"
          : refreshExpired
            ? "expired"
            : "session"
      };
    }

    const nextCredential = createRefreshCredential();
    await new sql.Request(transaction)
      .input("refreshTokenId", sql.BigInt, row.RefreshTokenId)
      .input("nextTokenHash", sql.Char(64), nextCredential.hash)
      .input("userId", sql.Int, row.Id)
      .input("sessionId", sql.UniqueIdentifier, row.SessionId)
      .input("expiresAt", sql.DateTime2, row.SessionExpiresAt)
      .query(`
        UPDATE dbo.RefreshTokens
        SET RevokedAt = SYSUTCDATETIME(), ReplacedByTokenHash = @nextTokenHash
        WHERE Id = @refreshTokenId AND RevokedAt IS NULL;

        INSERT INTO dbo.RefreshTokens (UserId, SessionId, TokenHash, ExpiresAt)
        VALUES (@userId, @sessionId, @nextTokenHash, @expiresAt);

        UPDATE dbo.UserSessions
        SET LastSeenAt = SYSUTCDATETIME()
        WHERE SessionId = @sessionId;
      `);
    await transaction.commit();
    return { ok: true, user: row, credential: nextCredential };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function queueVerificationEmail(
  req: Parameters<typeof recordSecurityEvent>[1],
  user: { Id: number; Email: string }
): Promise<void> {
  const token = createEmailVerificationToken();
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await new sql.Request(transaction)
      .input("userId", sql.Int, user.Id)
      .input("tokenHash", sql.Char(64), token.hash)
      .input("ttlHours", sql.Int, config.emailVerificationTtlHours)
      .query(`
        SELECT Id
        FROM dbo.EmailVerificationTokens WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @userId;

        UPDATE dbo.EmailVerificationTokens
        SET UsedAt = SYSUTCDATETIME()
        WHERE UserId = @userId AND UsedAt IS NULL;

        INSERT INTO dbo.EmailVerificationTokens (UserId, TokenHash, ExpiresAt)
        VALUES (@userId, @tokenHash, DATEADD(HOUR, @ttlHours, SYSUTCDATETIME()));
      `);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  deliverVerificationEmail(req, user, token.token);
}

function deliverVerificationEmail(
  req: Parameters<typeof recordSecurityEvent>[1],
  user: { Id: number; Email: string },
  rawToken: string
): void {
  const verificationUrl = new URL("/verify-email", config.webOrigin);
  verificationUrl.searchParams.set("token", rawToken);
  void sendEmailVerificationEmail(
    user.Email,
    verificationUrl.toString(),
    config.emailVerificationTtlHours
  ).catch(async (error: unknown) => {
    logger.error("email_verification_delivery_failed", {
      userId: user.Id,
      message: error instanceof Error ? error.message : String(error)
    });
    await recordSecurityEvent("EMAIL_DELIVERY_FAILED", req, { userId: user.Id }, "critical");
  });
}

export const authRouter = Router();

authRouter.post(
  "/forgot-password",
  passwordResetRateLimit,
  asyncHandler(async (req, res) => {
    const startedAt = performance.now();
    const body = forgotPasswordSchema.parse(req.body);
    const pool = await getPool();
    const account = await pool
      .request()
      .input("email", sql.NVarChar(255), body.email)
      .query<{ Id: number; Email: string; IsActive: boolean }>(`
        SELECT Id, Email, IsActive
        FROM dbo.Users
        WHERE Email = @email
      `);
    const user = account.recordset[0];

    if (user?.IsActive) {
      const reset = createPasswordResetToken();
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      try {
        await new sql.Request(transaction)
          .input("userId", sql.Int, user.Id)
          .input("tokenHash", sql.Char(64), reset.hash)
          .input("ttlMinutes", sql.Int, config.passwordResetTtlMinutes)
          .query(`
            SELECT Id
            FROM dbo.PasswordResetTokens WITH (UPDLOCK, HOLDLOCK)
            WHERE UserId = @userId;

            UPDATE dbo.PasswordResetTokens
            SET UsedAt = SYSUTCDATETIME()
            WHERE UserId = @userId AND UsedAt IS NULL;

            DELETE FROM dbo.PasswordResetTokens
            WHERE UserId = @userId
              AND (ExpiresAt < DATEADD(DAY, -1, SYSUTCDATETIME())
                OR UsedAt < DATEADD(DAY, -1, SYSUTCDATETIME()));

            INSERT INTO dbo.PasswordResetTokens (UserId, TokenHash, ExpiresAt)
            VALUES (
              @userId,
              @tokenHash,
              DATEADD(MINUTE, @ttlMinutes, SYSUTCDATETIME())
            );
          `);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }

      const resetUrl = new URL("/reset-password", config.webOrigin);
      resetUrl.searchParams.set("token", reset.token);
      void sendPasswordResetEmail(user.Email, resetUrl.toString(), config.passwordResetTtlMinutes)
        .catch(async (error: unknown) => {
          logger.error("password_reset_email_failed", {
            userId: user.Id,
            message: error instanceof Error ? error.message : String(error)
          });
          await recordSecurityEvent("EMAIL_DELIVERY_FAILED", req, { userId: user.Id }, "critical");
        });
    }

    await recordSecurityEvent(
      "PASSWORD_RESET_REQUESTED",
      req,
      { accountMatched: Boolean(user?.IsActive) },
      "info"
    );
    const remainingDelay = 200 - (performance.now() - startedAt);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }
    res.status(202).json({
      data: {
        message: "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi."
      }
    });
  })
);

authRouter.post(
  "/reset-password",
  passwordResetRateLimit,
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const tokenHash = hashPasswordResetToken(body.token);
    const secret = config.isSecure
      ? await argon2.hash(body.password, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1
        })
      : body.password;
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let resetUserId = 0;
    try {
      const tokenResult = await new sql.Request(transaction)
        .input("tokenHash", sql.Char(64), tokenHash)
        .query<{ Id: number; UserId: number }>(`
          SELECT prt.Id, prt.UserId
          FROM dbo.PasswordResetTokens prt WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN dbo.Users u ON u.Id = prt.UserId
          WHERE prt.TokenHash = @tokenHash
            AND prt.UsedAt IS NULL
            AND prt.ExpiresAt > SYSUTCDATETIME()
            AND u.IsActive = 1
        `);
      const resetToken = tokenResult.recordset[0];
      if (!resetToken) {
        throw new HttpError(
          422,
          "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
          "INVALID_RESET_TOKEN"
        );
      }
      resetUserId = resetToken.UserId;

      await new sql.Request(transaction)
        .input("userId", sql.Int, resetToken.UserId)
        .input("secret", sql.NVarChar(255), secret)
        .query(`
          UPDATE dbo.Users
          SET PasswordSecret = @secret,
              TokenVersion = TokenVersion + 1,
              UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @userId;

          UPDATE dbo.PasswordResetTokens
          SET UsedAt = SYSUTCDATETIME()
          WHERE UserId = @userId AND UsedAt IS NULL;

          UPDATE dbo.UserSessions
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;

          UPDATE dbo.RefreshTokens
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;
        `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    clearAuthCookies(res);
    await recordSecurityEvent(
      "PASSWORD_RESET_COMPLETED",
      req,
      { userId: resetUserId },
      "info"
    );
    res.json({ data: { message: "Mật khẩu đã được cập nhật." } });
  })
);

authRouter.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = verifyEmailSchema.parse(req.body);
    const tokenHash = hashEmailVerificationToken(body.token);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const tokenResult = await new sql.Request(transaction)
        .input("tokenHash", sql.Char(64), tokenHash)
        .query<{ Id: number; UserId: number }>(`
          SELECT evt.Id, evt.UserId
          FROM dbo.EmailVerificationTokens evt WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN dbo.Users u ON u.Id = evt.UserId
          WHERE evt.TokenHash = @tokenHash
            AND evt.UsedAt IS NULL
            AND evt.ExpiresAt > SYSUTCDATETIME()
            AND u.IsActive = 1
        `);
      const verification = tokenResult.recordset[0];
      if (!verification) {
        throw new HttpError(
          422,
          "Liên kết xác minh không hợp lệ hoặc đã hết hạn.",
          "INVALID_VERIFICATION_TOKEN"
        );
      }

      await new sql.Request(transaction)
        .input("userId", sql.Int, verification.UserId)
        .query(`
          UPDATE dbo.Users
          SET EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSUTCDATETIME()),
              UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @userId;

          UPDATE dbo.EmailVerificationTokens
          SET UsedAt = SYSUTCDATETIME()
          WHERE UserId = @userId AND UsedAt IS NULL;
        `);
      await transaction.commit();
      await recordSecurityEvent("EMAIL_VERIFIED", req, { userId: verification.UserId }, "info");
      res.json({ data: { message: "Email đã được xác minh. Bạn có thể đăng nhập." } });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);

authRouter.post(
  "/resend-verification",
  verificationEmailRateLimit,
  asyncHandler(async (req, res) => {
    const startedAt = performance.now();
    const body = resendVerificationSchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), body.email)
      .query<{ Id: number; Email: string; IsActive: boolean; EmailVerifiedAt: Date | null }>(`
        SELECT Id, Email, IsActive, EmailVerifiedAt
        FROM dbo.Users
        WHERE Email = @email
      `);
    const user = result.recordset[0];
    if (user?.IsActive && !user.EmailVerifiedAt) {
      await queueVerificationEmail(req, user);
    }
    await recordSecurityEvent(
      "EMAIL_VERIFICATION_REQUESTED",
      req,
      { accountEligible: Boolean(user?.IsActive && !user.EmailVerifiedAt) },
      "info"
    );
    const remainingDelay = 200 - (performance.now() - startedAt);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }
    res.status(202).json({
      data: {
        message: "Nếu tài khoản cần xác minh, một email mới đã được gửi."
      }
    });
  })
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const pool = await getPool();
    const existing = await pool
      .request()
      .input("email", sql.NVarChar(255), body.email)
      .query("SELECT Id FROM dbo.Users WHERE Email = @email");
    if (existing.recordset.length > 0) {
      throw new HttpError(409, "Email này đã được sử dụng.", "EMAIL_EXISTS");
    }

    const secret = config.isSecure
      ? await argon2.hash(body.password, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1
        })
      : body.password;

    const verification = config.isSecure ? createEmailVerificationToken() : null;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    let id = 0;
    try {
      const result = await new sql.Request(transaction)
        .input("email", sql.NVarChar(255), body.email)
        .input("secret", sql.NVarChar(255), secret)
        .input("fullName", sql.NVarChar(160), body.fullName)
        .input("markVerified", sql.Bit, !config.isSecure)
        .query<{ Id: number }>(`
          INSERT INTO dbo.Users (Email, PasswordSecret, FullName, RoleId, EmailVerifiedAt)
          OUTPUT INSERTED.Id
          VALUES (
            @email, @secret, @fullName, 2,
            CASE WHEN @markVerified = 1 THEN SYSUTCDATETIME() ELSE NULL END
          )
        `);
      id = result.recordset[0]?.Id ?? 0;
      if (!id) throw new Error("Không thể tạo tài khoản.");
      await new sql.Request(transaction)
        .input("userId", sql.Int, id)
        .query("INSERT INTO dbo.Carts (UserId) VALUES (@userId)");
      if (verification) {
        await new sql.Request(transaction)
          .input("userId", sql.Int, id)
          .input("tokenHash", sql.Char(64), verification.hash)
          .input("ttlHours", sql.Int, config.emailVerificationTtlHours)
          .query(`
            INSERT INTO dbo.EmailVerificationTokens (UserId, TokenHash, ExpiresAt)
            VALUES (@userId, @tokenHash, DATEADD(HOUR, @ttlHours, SYSUTCDATETIME()))
          `);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    if (verification) {
      deliverVerificationEmail(req, { Id: id, Email: body.email }, verification.token);
    }
    res.status(201).json({
      data: {
        id,
        email: body.email,
        fullName: body.fullName,
        role: "customer",
        emailVerificationRequired: config.isSecure
      }
    });
  })
);

authRouter.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), body.email)
      .query<LoginRow>(`
        SELECT
          u.Id, u.Email, u.PasswordSecret, u.FullName, r.Name AS Role,
          u.TokenVersion, u.IsActive, u.EmailVerifiedAt
        FROM dbo.Users u
        INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE u.Email = @email
      `);
    const user = result.recordset[0];
    const passwordMatches = config.isSecure
      ? await argon2
          .verify(user?.PasswordSecret ?? DUMMY_PASSWORD_HASH, body.password)
          .catch(() => false)
      : Boolean(user && user.PasswordSecret === body.password);

    if (!user || !user.IsActive || !passwordMatches) {
      await recordSecurityEvent("LOGIN_FAILED", req, { email: body.email });
      throw new HttpError(401, "Email hoặc mật khẩu không chính xác.", "INVALID_CREDENTIALS");
    }

    if (config.isSecure && !user.EmailVerifiedAt) {
      await recordSecurityEvent("LOGIN_BLOCKED_UNVERIFIED_EMAIL", req, { userId: user.Id });
      throw new HttpError(
        403,
        "Bạn cần xác minh email trước khi đăng nhập.",
        "EMAIL_NOT_VERIFIED"
      );
    }

    const refresh = config.isSecure ? createRefreshCredential() : null;
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let sessionId = "";
    try {
      sessionId = await createSession(
        new sql.Request(transaction),
        user.Id,
        clientMetadata(req)
      );
      if (refresh) {
        await storeRefreshCredential(
          new sql.Request(transaction),
          user.Id,
          sessionId,
          refresh.hash
        );
      }
      await new sql.Request(transaction)
        .input("userId", sql.Int, user.Id)
        .input("currentSessionId", sql.UniqueIdentifier, sessionId)
        .query(`
          ;WITH OlderSessions AS (
            SELECT SessionId,
                   ROW_NUMBER() OVER (ORDER BY CreatedAt DESC, SessionId DESC) AS position
            FROM dbo.UserSessions
            WHERE UserId = @userId AND RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
          )
          UPDATE s
          SET RevokedAt = SYSUTCDATETIME()
          FROM dbo.UserSessions s
          INNER JOIN OlderSessions ranked ON ranked.SessionId = s.SessionId
          WHERE ranked.position > 10 AND s.SessionId <> @currentSessionId;

          UPDATE rt
          SET RevokedAt = COALESCE(rt.RevokedAt, SYSUTCDATETIME())
          FROM dbo.RefreshTokens rt
          INNER JOIN dbo.UserSessions s ON s.SessionId = rt.SessionId
          WHERE s.UserId = @userId AND s.RevokedAt IS NOT NULL AND rt.RevokedAt IS NULL;

          DELETE TOP (500) FROM dbo.RefreshTokens
          WHERE ExpiresAt < DATEADD(DAY, -1, SYSUTCDATETIME());
        `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    const token = issueAccessToken(authUser(user, sessionId));
    setSessionCookie(res, token);
    if (refresh) setRefreshCookie(res, refresh.token);
    const csrfToken = setCsrfCookie(res);
    await recordSecurityEvent("LOGIN_SUCCEEDED", req, { userId: user.Id, sessionId }, "info");
    res.json({
      data: {
        user: publicUser(user),
        csrfToken
      }
    });
  })
);

authRouter.post(
  "/refresh",
  sessionRefreshRateLimit,
  asyncHandler(async (req, res) => {
    if (!config.isSecure) {
      throw new HttpError(404, "Không tìm thấy tài nguyên.", "NOT_FOUND");
    }
    const rawToken = refreshTokenFromRequest(req);
    if (!rawToken) {
      clearAuthCookies(res);
      throw new HttpError(401, "Phiên đăng nhập đã hết hạn.", "REFRESH_TOKEN_REQUIRED");
    }

    const rotation = await rotateRefreshToken(rawToken);
    if (!rotation.ok) {
      clearAuthCookies(res);
      await recordSecurityEvent("SESSION_REFRESH_REJECTED", req, { reason: rotation.reason });
      throw new HttpError(401, "Phiên đăng nhập đã hết hiệu lực.", "REFRESH_TOKEN_REJECTED");
    }

    const user = authUser(rotation.user, rotation.user.SessionId);
    setSessionCookie(res, issueAccessToken(user));
    setRefreshCookie(res, rotation.credential.token);
    const csrfToken = setCsrfCookie(res);
    await recordSecurityEvent(
      "SESSION_REFRESHED",
      req,
      { userId: rotation.user.Id, sessionId: rotation.user.SessionId },
      "info"
    );
    res.json({ data: { csrfToken } });
  })
);

authRouter.get(
  "/csrf",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const csrfToken = setCsrfCookie(res);
    res.json({ data: { csrfToken: csrfToken ?? null } });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    const request = pool.request().input("id", sql.Int, req.authUser!.id);

    if (!config.isSecure) {
      // SECURITY LAB: Baseline intentionally exposes the stored credential for TC09.
      const result = await request.query(`
        SELECT u.*, r.Name AS Role
        FROM dbo.Users u INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE u.Id = @id
      `);
      res.json({ data: result.recordset[0] });
      return;
    }

    const result = await request.query(`
      SELECT
        u.Id AS id, u.Email AS email, u.FullName AS fullName, u.Phone AS phone,
        u.AddressLine AS addressLine, u.AvatarUrl AS avatarUrl, r.Name AS role,
        CAST(CASE WHEN u.EmailVerifiedAt IS NULL THEN 0 ELSE 1 END AS bit) AS emailVerified,
        u.EmailVerifiedAt AS emailVerifiedAt, u.CreatedAt AS createdAt
      FROM dbo.Users u INNER JOIN dbo.Roles r ON r.Id = u.RoleId
      WHERE u.Id = @id
    `);
    res.json({ data: result.recordset[0] });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, req.authUser!.id)
      .query<LoginRow>(`
        SELECT
          u.Id, u.Email, u.PasswordSecret, u.FullName, r.Name AS Role,
          u.TokenVersion, u.IsActive, u.EmailVerifiedAt
        FROM dbo.Users u
        INNER JOIN dbo.Roles r ON r.Id = u.RoleId
        WHERE u.Id = @id
      `);
    const user = result.recordset[0];
    if (!user?.IsActive) {
      throw new HttpError(401, "Tài khoản không còn hoạt động.", "ACCOUNT_DISABLED");
    }
    const currentMatches = config.isSecure
      ? await argon2.verify(user.PasswordSecret, body.currentPassword).catch(() => false)
      : user.PasswordSecret === body.currentPassword;
    if (!currentMatches) {
      await recordSecurityEvent("PASSWORD_CHANGE_REJECTED", req, { reason: "invalid_current_password" });
      throw new HttpError(422, "Mật khẩu hiện tại không chính xác.", "INVALID_CURRENT_PASSWORD");
    }

    const nextSecret = config.isSecure
      ? await argon2.hash(body.newPassword, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1
        })
      : body.newPassword;
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let sessionId = "";
    let nextTokenVersion = user.TokenVersion + 1;
    const refresh = config.isSecure ? createRefreshCredential() : null;
    try {
      const updated = await new sql.Request(transaction)
        .input("userId", sql.Int, user.Id)
        .input("secret", sql.NVarChar(255), nextSecret)
        .query<{ TokenVersion: number }>(`
          UPDATE dbo.Users
          SET PasswordSecret = @secret,
              TokenVersion = TokenVersion + 1,
              UpdatedAt = SYSUTCDATETIME()
          OUTPUT INSERTED.TokenVersion
          WHERE Id = @userId;

          UPDATE dbo.UserSessions
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;

          UPDATE dbo.RefreshTokens
          SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
          WHERE UserId = @userId;
        `);
      nextTokenVersion = updated.recordset[0]?.TokenVersion ?? nextTokenVersion;
      sessionId = await createSession(
        new sql.Request(transaction),
        user.Id,
        clientMetadata(req)
      );
      if (refresh) {
        await storeRefreshCredential(
          new sql.Request(transaction),
          user.Id,
          sessionId,
          refresh.hash
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const token = issueAccessToken(
      authUser({ ...user, TokenVersion: nextTokenVersion }, sessionId)
    );
    setSessionCookie(res, token);
    if (refresh) setRefreshCookie(res, refresh.token);
    const csrfToken = setCsrfCookie(res);
    await recordSecurityEvent("PASSWORD_CHANGED", req, { userId: user.Id }, "info");
    res.json({
      data: {
        message: "Mật khẩu đã được đổi và các phiên cũ đã bị đăng xuất.",
        csrfToken
      }
    });
  })
);

authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.Int, req.authUser!.id)
      .input("currentSessionId", sql.UniqueIdentifier, req.authUser!.sessionId)
      .query(`
        SELECT TOP 20
          CONVERT(NVARCHAR(36), SessionId) AS id,
          IpAddress AS ipAddress, UserAgent AS userAgent,
          CreatedAt AS createdAt, LastSeenAt AS lastSeenAt,
          ExpiresAt AS expiresAt, RevokedAt AS revokedAt,
          CAST(CASE WHEN SessionId = @currentSessionId THEN 1 ELSE 0 END AS bit) AS isCurrent,
          CAST(CASE
            WHEN RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME() THEN 1
            ELSE 0
          END AS bit) AS isActive
        FROM dbo.UserSessions
        WHERE UserId = @userId
          AND CreatedAt > DATEADD(DAY, -30, SYSUTCDATETIME())
        ORDER BY CreatedAt DESC
      `);
    res.json({ data: result.recordset });
  })
);

authRouter.delete(
  "/sessions/:sessionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = z.string().uuid().parse(req.params.sessionId);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("sessionId", sql.UniqueIdentifier, sessionId)
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        UPDATE dbo.UserSessions
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE SessionId = @sessionId AND UserId = @userId;

        UPDATE dbo.RefreshTokens
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE SessionId = @sessionId AND UserId = @userId;
      `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new HttpError(404, "Không tìm thấy phiên đăng nhập.", "SESSION_NOT_FOUND");
    }
    if (sessionId === req.authUser!.sessionId) {
      clearAuthCookies(res);
    }
    await recordSecurityEvent("SESSION_REVOKED", req, { sessionId }, "info");
    res.status(204).send();
  })
);

authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    await pool
      .request()
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        UPDATE dbo.Users
        SET TokenVersion = TokenVersion + 1, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @userId;

        UPDATE dbo.UserSessions
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE UserId = @userId;

        UPDATE dbo.RefreshTokens
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE UserId = @userId;
      `);
    clearAuthCookies(res);
    await recordSecurityEvent("ALL_SESSIONS_REVOKED", req, { userId: req.authUser!.id }, "info");
    res.status(204).send();
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const pool = await getPool();
    await pool
      .request()
      .input("sessionId", sql.UniqueIdentifier, req.authUser!.sessionId)
      .input("userId", sql.Int, req.authUser!.id)
      .query(`
        UPDATE dbo.UserSessions
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE SessionId = @sessionId AND UserId = @userId;

        UPDATE dbo.RefreshTokens
        SET RevokedAt = COALESCE(RevokedAt, SYSUTCDATETIME())
        WHERE SessionId = @sessionId AND UserId = @userId;
      `);
    clearAuthCookies(res);
    await recordSecurityEvent("LOGOUT_COMPLETED", req, { sessionId: req.authUser!.sessionId }, "info");
    res.status(204).send();
  })
);
