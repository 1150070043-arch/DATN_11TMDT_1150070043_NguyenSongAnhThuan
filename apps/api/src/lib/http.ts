import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { logger } from "./logger.js";
import { recordSecurityEvent } from "../security/events.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_ERROR"
  ) {
    super(message);
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Không tìm thấy tài nguyên.", "NOT_FOUND"));
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const raw = error as
    | { code?: unknown; number?: unknown; status?: unknown; type?: unknown }
    | null;
  const isMalformedJson = raw?.type === "entity.parse.failed";
  const isBodyTooLarge = raw?.type === "entity.too.large" || raw?.status === 413;
  const isUploadLimit =
    typeof raw?.code === "string" && raw.code.startsWith("LIMIT_");
  const isDuplicate = raw?.number === 2601 || raw?.number === 2627;
  const isReferenceConflict = raw?.number === 547;
  const isDatabaseUnavailable = ["ETIMEOUT", "ESOCKET", "ECONNCLOSED"].includes(
    typeof raw?.code === "string" ? raw.code : ""
  );
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof ZodError
        ? 422
        : isMalformedJson
          ? 400
          : isUploadLimit || isBodyTooLarge
            ? 413
            : isDuplicate
              ? 409
              : isReferenceConflict
                ? 409
                : isDatabaseUnavailable
                  ? 503
                  : 500;
  const code =
    error instanceof HttpError
      ? error.code
      : error instanceof ZodError
        ? "VALIDATION_ERROR"
        : isMalformedJson
          ? "MALFORMED_JSON"
          : isUploadLimit || isBodyTooLarge
            ? "REQUEST_TOO_LARGE"
            : isDuplicate
              ? "DUPLICATE_RESOURCE"
              : isReferenceConflict
                ? "REFERENCE_CONFLICT"
                : isDatabaseUnavailable
                  ? "DATABASE_UNAVAILABLE"
                  : "INTERNAL_ERROR";

  const safeMessage =
    error instanceof ZodError
      ? error.issues.map((issue) => issue.message.replace(/\.+$/, "")).filter(Boolean).join(". ") + "."
      : isMalformedJson
        ? "Nội dung JSON không hợp lệ."
        : isUploadLimit || isBodyTooLarge
          ? "Nội dung gửi lên vượt quá giới hạn cho phép."
          : isDuplicate
            ? "Dữ liệu đã tồn tại trong hệ thống."
            : isReferenceConflict
              ? "Dữ liệu liên quan không tồn tại hoặc vẫn đang được sử dụng."
              : isDatabaseUnavailable
                ? "Cơ sở dữ liệu đang bận. Vui lòng thử lại sau."
                : error instanceof Error
                  ? error.message
                  : "Đã xảy ra lỗi.";

  const body: Record<string, unknown> = {
    error: {
      code,
      message:
        config.isSecure && status >= 500
          ? "Hệ thống đang bận. Vui lòng thử lại sau."
          : safeMessage,
      requestId: req.requestId
    }
  };

  if (error instanceof ZodError) {
    (body.error as Record<string, unknown>).details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message
    }));
  }

  if (!config.isSecure && error instanceof Error) {
    body.stack = error.stack;
  }

  if (error instanceof ZodError || isMalformedJson) {
    const issues = error instanceof ZodError ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") : undefined;
    logger.warn("validation_rejected", { path: req.originalUrl, issues });
    void recordSecurityEvent("VALIDATION_REJECTED", req, { code, issues });
  } else if (isUploadLimit || isBodyTooLarge) {
    void recordSecurityEvent("UPLOAD_REJECTED", req, { code });
  }
  if (status >= 500) {
    logger.error("request_failed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  res.status(status).json(body);
};
