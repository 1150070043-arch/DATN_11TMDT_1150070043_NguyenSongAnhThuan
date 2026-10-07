import crypto from "node:crypto";
import type { RequestHandler, Response } from "express";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";
import { recordSecurityEvent } from "./events.js";

const CSRF_COOKIE = config.identity.csrfCookie;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/resend-verification"
]);

function signature(nonce: string): string {
  return crypto.createHmac("sha256", config.csrfSecret).update(nonce).digest("base64url");
}

export function createCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString("base64url");
  return `${nonce}.${signature(nonce)}`;
}

function validToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const [nonce, suppliedSignature] = token.split(".");
  if (!nonce || !suppliedSignature) return false;
  const expected = signature(nonce);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export function setCsrfCookie(res: Response): string | undefined {
  if (!config.isSecure) return undefined;
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000
  });
  return token;
}

export const csrfProtection: RequestHandler = async (req, _res, next) => {
  if (!config.isSecure || SAFE_METHODS.has(req.method) || PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE] as unknown;
  const headerToken = req.header("x-csrf-token");
  if (
    !validToken(cookieToken) ||
    !validToken(headerToken) ||
    cookieToken !== headerToken
  ) {
    await recordSecurityEvent("CSRF_BLOCKED", req, { hasCookie: Boolean(cookieToken), hasHeader: Boolean(headerToken) });
    next(new HttpError(403, "Yêu cầu bảo mật không hợp lệ. Vui lòng tải lại trang.", "CSRF_REJECTED"));
    return;
  }

  next();
};
