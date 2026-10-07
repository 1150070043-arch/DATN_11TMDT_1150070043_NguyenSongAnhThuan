import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { config } from "../config.js";
import { recordSecurityEvent } from "../security/events.js";

const passThrough: RequestHandler = (_req, _res, next) => next();

export const loginRateLimit: RequestHandler = config.isSecure
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        const email = typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase().slice(0, 255)
          : "unknown-account";
        return `${ipKeyGenerator(req.ip ?? "unknown-ip")}:${email}`;
      },
      handler: (req, res) => {
        void recordSecurityEvent("LOGIN_RATE_LIMITED", req, { limit: 5 });
        res.status(429).json({
          error: {
            code: "LOGIN_RATE_LIMITED",
            message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
            requestId: req.requestId
          }
        });
      }
    })
  : passThrough;

export const passwordResetRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    void recordSecurityEvent("PASSWORD_RESET_RATE_LIMITED", req, { limit: 3 });
    res.status(429).json({
      error: {
        code: "PASSWORD_RESET_RATE_LIMITED",
        message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
        requestId: req.requestId
      }
    });
  }
});

export const verificationEmailRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    void recordSecurityEvent("VERIFICATION_EMAIL_RATE_LIMITED", req, { limit: 3 });
    res.status(429).json({
      error: {
        code: "VERIFICATION_EMAIL_RATE_LIMITED",
        message: "Bạn đã gửi quá nhiều yêu cầu xác minh. Vui lòng thử lại sau.",
        requestId: req.requestId
      }
    });
  }
});

export const sessionRefreshRateLimit: RequestHandler = config.isSecure
  ? rateLimit({
      windowMs: 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (req, res) => {
        void recordSecurityEvent("SESSION_REFRESH_RATE_LIMITED", req, { limit: 30 });
        res.status(429).json({
          error: {
            code: "SESSION_REFRESH_RATE_LIMITED",
            message: "Phiên được làm mới quá nhiều lần. Vui lòng đăng nhập lại.",
            requestId: req.requestId
          }
        });
      }
    })
  : passThrough;

export const apiRateLimit: RequestHandler = config.isSecure
  ? rateLimit({
      windowMs: 60 * 1000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (req, res) => {
        void recordSecurityEvent("API_RATE_LIMITED", req, { limit: 180 });
        res.status(429).json({
          error: {
            code: "API_RATE_LIMITED",
            message: "Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau.",
            requestId: req.requestId
          }
        });
      }
    })
  : passThrough;
