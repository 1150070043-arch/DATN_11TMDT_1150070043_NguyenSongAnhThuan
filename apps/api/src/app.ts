import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { getPool } from "./db/pool.js";
import { errorHandler, notFound } from "./lib/http.js";
import { apiRateLimit } from "./middleware/rate-limit.js";
import { requestContext } from "./middleware/request-context.js";
import { adminRouter } from "./routes/admin.routes.js";
import { adminOperationsRouter } from "./routes/admin-operations.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { booksRouter } from "./routes/books.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { ordersRouter } from "./routes/orders.routes.js";
import { paymentsRouter } from "./routes/payments.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { optionalAuth } from "./security/auth.js";
import { csrfProtection } from "./security/csrf.js";

export function createApp() {
  const app = express();

  if (config.trustProxyHops > 0) {
    app.set("trust proxy", config.trustProxyHops);
  }
  if (config.isSecure) {
    app.disable("x-powered-by");
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "same-site" },
        contentSecurityPolicy: false
      })
    );
  } else {
    app.use((_req, res, next) => {
      res.setHeader("x-bookguard-warning", "INTENTIONALLY-VULNERABLE-LAB");
      next();
    });
  }

  app.use(requestContext);
  app.use(
    cors(
      config.isSecure
        ? {
            origin: config.webOrigin,
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["content-type", "x-csrf-token", "x-request-id", "idempotency-key"]
          }
        : {
            // SECURITY LAB: permissive reflected CORS is intentional for TC08.
            origin: true,
            credentials: true
          }
    )
  );
  app.use(express.json({ limit: config.isSecure ? "128kb" : "5mb" }));
  app.use(express.urlencoded({ extended: false, limit: config.isSecure ? "128kb" : "5mb" }));
  app.use(cookieParser());
  app.use("/api", apiRateLimit);
  app.use(optionalAuth);
  app.use(csrfProtection);

  if (config.isSecure) {
    app.use(["/api/auth", "/api/profile", "/api/cart", "/api/orders", "/api/admin"], (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      next();
    });
  }

  app.get("/api/health", async (_req, res, next) => {
    try {
      const pool = await getPool();
      const database = await pool.query<{ schemaVersion: number }>(
        "SELECT COALESCE(MAX(Version), 0) AS schemaVersion FROM dbo.SchemaMigrations"
      );
      res.json({
        data: {
          status: "ok",
          mode: config.mode,
          database: "connected",
          schemaVersion: Number(database.recordset[0]?.schemaVersion ?? 0),
          uptimeSeconds: Math.floor(process.uptime())
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    "/uploads",
    express.static(config.uploadDir, {
      dotfiles: "deny",
      fallthrough: false,
      setHeaders: (res) => {
        if (config.isSecure) {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'");
        }
      }
    })
  );

  app.use("/api/auth", authRouter);
  app.use("/api/books", booksRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", adminOperationsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
