import type { Request } from "express";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { logger } from "../lib/logger.js";
import { sendAlertNonBlocking } from "../lib/alerting.js";
import { diagnosticPath, diagnosticErrorCode } from "../lib/diagnostics.js";

export type SecurityEventType =
  | "LOGIN_FAILED"
  | "LOGIN_RATE_LIMITED"
  | "LOGIN_SUCCEEDED"
  | "LOGIN_BLOCKED_UNVERIFIED_EMAIL"
  | "PASSWORD_RESET_RATE_LIMITED"
  | "PASSWORD_CHANGE_REJECTED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_VERIFICATION_REQUESTED"
  | "EMAIL_VERIFIED"
  | "VERIFICATION_EMAIL_RATE_LIMITED"
  | "EMAIL_DELIVERY_FAILED"
  | "API_RATE_LIMITED"
  | "AUTH_TOKEN_REJECTED"
  | "SESSION_REVOKED"
  | "SESSION_REFRESHED"
  | "SESSION_REFRESH_REJECTED"
  | "SESSION_REFRESH_RATE_LIMITED"
  | "ALL_SESSIONS_REVOKED"
  | "LOGOUT_COMPLETED"
  | "ACCESS_DENIED"
  | "IDOR_BLOCKED"
  | "CSRF_BLOCKED"
  | "UPLOAD_REJECTED"
  | "BOOK_COVER_UPLOAD_REJECTED"
  | "USER_STATUS_CHANGED"
  | "INVENTORY_ADJUSTED"
  | "EXPERIMENT_REPORTS_SYNCED"
  | "VALIDATION_REJECTED"
  | "SUSPICIOUS_INPUT";

export async function recordSecurityEvent(
  type: SecurityEventType,
  req: Request,
  details: Record<string, unknown> = {},
  severity: "info" | "warning" | "critical" = "warning"
): Promise<void> {
  if (!config.isSecure) return;

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("requestId", sql.NVarChar(80), req.requestId)
      .input("userId", sql.Int, req.authUser?.id ?? null)
      .input("type", sql.NVarChar(80), type)
      .input("severity", sql.NVarChar(20), severity)
      .input("ip", sql.NVarChar(80), req.ip ?? null)
      .input("method", sql.NVarChar(12), req.method)
      .input("path", sql.NVarChar(500), diagnosticPath(req.originalUrl))
      .input("details", sql.NVarChar(2000), JSON.stringify(details).slice(0, 2000))
      .query(`
        INSERT INTO dbo.SecurityEvents
          (RequestId, UserId, EventType, Severity, IpAddress, Method, Path, Details)
        VALUES
          (@requestId, @userId, @type, @severity, @ip, @method, @path, @details)
      `);

    if (severity === "critical") {
      sendAlertNonBlocking({
        level: "critical",
        type: `SECURITY_${type}`,
        message: `Phát hiện sự kiện an ninh mức CRITICAL [${type}] từ IP ${req.ip ?? "unknown"} trên đường dẫn ${req.method} ${diagnosticPath(req.originalUrl)}`,
        details: {
          requestId: req.requestId,
          userId: req.authUser?.id,
          ip: req.ip,
          method: req.method,
          path: diagnosticPath(req.originalUrl),
          ...details
        }
      });
    }
  } catch (error) {
    logger.error("security_event_write_failed", {
      type,
      code: diagnosticErrorCode(error)
    });
  }
}
