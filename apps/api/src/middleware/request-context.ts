import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";
import { diagnosticPath } from "../lib/diagnostics.js";

export const requestContext: RequestHandler = (req, res, next) => {
  const suppliedId = req.header("x-request-id");
  const requestId = suppliedId && /^[a-zA-Z0-9_-]{1,80}$/.test(suppliedId)
    ? suppliedId : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const started = performance.now();

  res.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: diagnosticPath(req.originalUrl),
      status: res.statusCode,
      durationMs: Number((performance.now() - started).toFixed(2))
    });
  });
  next();
};
