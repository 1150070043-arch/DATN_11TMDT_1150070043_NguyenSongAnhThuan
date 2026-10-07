import type { Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { recordSecurityEvent } from "./events.js";

const SESSION_COOKIE = config.identity.sessionCookie;
const REFRESH_COOKIE = config.identity.refreshCookie;

type TokenClaims = jwt.JwtPayload & {
  sub: string;
  sid: string;
  email: string;
  role: "admin" | "customer";
  tokenVersion: number;
};

export type AuthUser = {
  id: number;
  sessionId: string;
  email: string;
  role: "admin" | "customer";
  tokenVersion: number;
};

export function issueAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sid: user.sessionId,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion
    },
    config.jwtSecret,
    {
      subject: String(user.id),
      issuer: config.identity.issuer,
      audience: config.identity.audience,
      expiresIn: config.isSecure
        ? config.accessTokenTtlMinutes * 60
        : 24 * 60 * 60
    }
  );
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: config.isSecure,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: config.isSecure
      ? config.accessTokenTtlMinutes * 60 * 1000
      : 24 * 60 * 60 * 1000
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  if (!config.isSecure) return;
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: config.isSecure,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/"
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "strict",
    path: "/api/auth"
  });
}

export function refreshTokenFromRequest(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE] as unknown;
  return typeof value === "string" && value.length <= 256 ? value : undefined;
}

function tokenFromRequest(req: Request): string | undefined {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const cookie = req.cookies?.[SESSION_COOKIE] as unknown;
  return typeof cookie === "string" ? cookie : undefined;
}

function claimsToUser(claims: TokenClaims): AuthUser {
  const id = Number(claims.sub);
  if (
    !Number.isInteger(id) ||
    typeof claims.sid !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(claims.sid) ||
    !claims.email ||
    !["admin", "customer"].includes(claims.role)
  ) {
    throw new HttpError(401, "Phiên đăng nhập không hợp lệ.", "INVALID_SESSION");
  }
  return {
    id,
    sessionId: claims.sid,
    email: claims.email,
    role: claims.role,
    tokenVersion: Number(claims.tokenVersion ?? 0)
  };
}

async function verifySecureToken(token: string): Promise<AuthUser> {
  const claims = jwt.verify(token, config.jwtSecret, {
    issuer: config.identity.issuer,
    audience: config.identity.audience,
    algorithms: ["HS256"]
  }) as TokenClaims;
  const user = claimsToUser(claims);

  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, user.id)
    .input("sessionId", sql.UniqueIdentifier, user.sessionId)
    .query<{
      TokenVersion: number;
      IsActive: boolean;
      ExpiresAt: Date | null;
      RevokedAt: Date | null;
    }>(`
      SELECT u.TokenVersion, u.IsActive, s.ExpiresAt, s.RevokedAt
      FROM dbo.Users u
      LEFT JOIN dbo.UserSessions s
        ON s.UserId = u.Id AND s.SessionId = @sessionId
      WHERE u.Id = @id
    `);
  const databaseUser = result.recordset[0];
  if (
    !databaseUser?.IsActive ||
    databaseUser.TokenVersion !== user.tokenVersion ||
    !databaseUser.ExpiresAt ||
    databaseUser.RevokedAt ||
    databaseUser.ExpiresAt.getTime() <= Date.now()
  ) {
    throw new HttpError(401, "Phiên đăng nhập đã hết hiệu lực.", "SESSION_REVOKED");
  }
  await pool
    .request()
    .input("sessionId", sql.UniqueIdentifier, user.sessionId)
    .query(`
      UPDATE dbo.UserSessions
      SET LastSeenAt = SYSUTCDATETIME()
      WHERE SessionId = @sessionId
        AND LastSeenAt < DATEADD(MINUTE, -5, SYSUTCDATETIME())
    `);
  return user;
}

function decodeBaselineToken(token: string): AuthUser {
  // SECURITY LAB: Baseline intentionally decodes without signature verification for TC04.
  const claims = jwt.decode(token) as TokenClaims | null;
  if (!claims || claims.iss !== config.identity.issuer || claims.aud !== config.identity.audience) {
    throw new HttpError(401, "Phiên đăng nhập không hợp lệ.", "INVALID_SESSION");
  }
  return claimsToUser(claims);
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = tokenFromRequest(req);
  if (!token) {
    next();
    return;
  }
  try {
    req.authUser = config.isSecure
      ? await verifySecureToken(token)
      : decodeBaselineToken(token);
    next();
  } catch (error) {
    await recordSecurityEvent("AUTH_TOKEN_REJECTED", req, {
      message: error instanceof Error ? error.message : "unknown"
    });
    next();
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.authUser) {
    next(new HttpError(401, "Vui lòng đăng nhập để tiếp tục.", "AUTH_REQUIRED"));
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  if (!req.authUser) {
    next(new HttpError(401, "Vui lòng đăng nhập để tiếp tục.", "AUTH_REQUIRED"));
    return;
  }

  // SECURITY LAB: Baseline checks authentication only, intentionally omitting authorization for TC06.
  if (config.isSecure && req.authUser.role !== "admin") {
    await recordSecurityEvent("ACCESS_DENIED", req, { requiredRole: "admin" });
    next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này.", "ACCESS_DENIED"));
    return;
  }
  next();
};

export function ensureOwnerOrAdmin(req: Request, ownerId: number): void {
  if (!config.isSecure) return;
  const user = req.authUser;
  if (!user || (user.role !== "admin" && user.id !== ownerId)) {
    void recordSecurityEvent("IDOR_BLOCKED", req, { ownerId });
    throw new HttpError(403, "Bạn không có quyền truy cập dữ liệu này.", "RESOURCE_OWNERSHIP_REQUIRED");
  }
}
