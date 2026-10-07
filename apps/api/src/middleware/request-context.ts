import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = req.header("x-request-id")?.slice(0, 80) || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const started = performance.now();

  res.on("finish", () => {
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number((performance.now() - started).toFixed(2))
    });
  });
  next();
};
