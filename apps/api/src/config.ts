import path from "node:path";
import { isIP } from "node:net";
import { z } from "zod";
import { environmentIdentity } from "./security/environment.js";

const boolFromEnv = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SECURITY_MODE: z.enum(["baseline", "secure"]).default("secure"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SQLSERVER_HOST: z.string().default("localhost"),
  SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  SQLSERVER_ENCRYPT: boolFromEnv,
  SQLSERVER_TRUST_CERTIFICATE: boolFromEnv,
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  BASELINE_DB_NAME: z.string().optional(),
  BASELINE_DB_USER: z.string().optional(),
  BASELINE_DB_PASSWORD: z.string().optional(),
  SECURE_DB_NAME: z.string().optional(),
  SECURE_DB_USER: z.string().optional(),
  SECURE_DB_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  BASELINE_JWT_SECRET: z.string().optional(),
  SECURE_JWT_SECRET: z.string().optional(),
  CSRF_SECRET: z.string().default("replace-with-a-different-32-character-random-secret"),
  WEB_ORIGIN: z.string().optional(),
  BASELINE_WEB_ORIGIN: z.string().optional(),
  SECURE_WEB_ORIGIN: z.string().optional(),
  // Legacy UPLOAD_DIR is a root; each local environment gets its own child.
  UPLOAD_DIR: z.string().default("./uploads"),
  BASELINE_UPLOAD_DIR: z.string().optional(),
  SECURE_UPLOAD_DIR: z.string().optional(),
  REPORTS_DIR: z.string().default("./reports/generated"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(1025),
  SMTP_SECURE: boolFromEnv,
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  MAIL_FROM_ADDRESS: z.string().email().default("no-reply@bookguard.local"),
  MAIL_FROM_NAME: z.string().trim().min(1).max(120).default("Thư An Bookstore"),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  AUTH_CLEANUP_ENABLED: boolFromEnv,
  AUTH_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
  AUTH_CLEANUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  AUTH_CLEANUP_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(500),
  AUTH_CLEANUP_MAX_BATCHES: z.coerce.number().int().min(1).max(50).default(10),
  STOCK_HOLD_ENABLED: boolFromEnv,
  STOCK_HOLD_MINUTES: z.coerce.number().int().min(15).max(1440).default(30),
  STOCK_HOLD_GRACE_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  STOCK_HOLD_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
  STOCK_HOLD_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  COOKIE_SECURE: boolFromEnv,
  ALLOW_INSECURE_LAB: boolFromEnv,
  VNPAY_TMN_CODE: z.string().default(""),
  VNPAY_HASH_SECRET: z.string().default(""),
  VNPAY_RETURN_URL: z.string().url().optional(),
  VNPAY_URL: z.string().default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
  VNPAY_QUERY_ENABLED: boolFromEnv,
  VNPAY_QUERY_URL: z.string().url().default("https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"),
  VNPAY_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(8000),
  VNPAY_QUERY_IP_ADDRESS: z.preprocess(value => value === "" ? undefined : value, z.string().refine(value => isIP(value) !== 0, "VNPay query IP must be an IPv4 or IPv6 address.").optional()),
  ALERT_WEBHOOK_URL: z.preprocess(value => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().url().optional()),
  ALERT_TELEGRAM_BOT_TOKEN: z.string().optional(),
  ALERT_TELEGRAM_CHAT_ID: z.string().optional(),
  ALERT_THROTTLE_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),
  ALERT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  ALERT_RETRY_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(250),
  ALERT_TIMEOUT_MS: z.coerce.number().int().min(100).max(15000).default(8000)
});

const parsed = envSchema.parse(process.env);
const isSecure = parsed.SECURITY_MODE === "secure";
const otherDatabase = isSecure
  ? parsed.BASELINE_DB_NAME ?? "BookGuardBaseline"
  : parsed.SECURE_DB_NAME ?? "BookGuardSecure";
const otherDatabaseUser = isSecure
  ? parsed.BASELINE_DB_USER ?? "bookguard_baseline"
  : parsed.SECURE_DB_USER ?? "bookguard_secure";
const databaseName =
  parsed.DB_NAME ??
  (isSecure ? parsed.SECURE_DB_NAME : parsed.BASELINE_DB_NAME) ??
  (isSecure ? "BookGuardSecure" : "BookGuardBaseline");
const databaseUser =
  parsed.DB_USER ??
  (isSecure ? parsed.SECURE_DB_USER : parsed.BASELINE_DB_USER) ??
  (isSecure ? "bookguard_secure" : "bookguard_baseline");
const databasePassword =
  parsed.DB_PASSWORD ??
  (isSecure ? parsed.SECURE_DB_PASSWORD : parsed.BASELINE_DB_PASSWORD) ??
  (isSecure ? "ChangeThis_Secure_123!" : "ChangeThis_Baseline_123!");
const jwtSecret =
  parsed.JWT_SECRET ??
  (isSecure ? parsed.SECURE_JWT_SECRET : parsed.BASELINE_JWT_SECRET) ??
  (isSecure ? "replace-with-at-least-32-random-characters" : "baseline-lab-secret");
const webOrigin =
  parsed.WEB_ORIGIN ??
  (isSecure ? parsed.SECURE_WEB_ORIGIN : parsed.BASELINE_WEB_ORIGIN) ??
  (isSecure ? "http://localhost:5174" : "http://localhost:5173");
const smtpSecure = parsed.SMTP_SECURE ?? false;
if (Boolean(parsed.ALERT_TELEGRAM_BOT_TOKEN) !== Boolean(parsed.ALERT_TELEGRAM_CHAT_ID)) {
  throw new Error("ALERT_TELEGRAM_BOT_TOKEN and ALERT_TELEGRAM_CHAT_ID must be configured together.");
}
const queryEndpoint = new URL(parsed.VNPAY_QUERY_URL);
if (queryEndpoint.username || queryEndpoint.password || queryEndpoint.search || queryEndpoint.hash ||
    (queryEndpoint.protocol !== "https:" && !(parsed.NODE_ENV === "test" && queryEndpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(queryEndpoint.hostname)))) {
  throw new Error("VNPay query endpoint must use HTTPS; loopback HTTP is allowed only in tests.");
}
const localSqlServer = ["localhost", "127.0.0.1", "sqlserver"].includes(parsed.SQLSERVER_HOST.toLowerCase());
const sqlEncrypt = parsed.SQLSERVER_ENCRYPT ?? true;
const sqlTrustCertificate = parsed.SQLSERVER_TRUST_CERTIFICATE ?? localSqlServer;
if (isSecure && parsed.NODE_ENV === "production" && (!sqlEncrypt || (!localSqlServer && sqlTrustCertificate))) {
  throw new Error("Secure production requires encrypted SQL and certificate verification for remote SQL servers.");
}

if (databaseName.toLowerCase() === otherDatabase.toLowerCase() ||
    databaseUser.toLowerCase() === otherDatabaseUser.toLowerCase()) {
  throw new Error("Twin environments must use different database names and database users.");
}
if (parsed.BASELINE_JWT_SECRET && parsed.BASELINE_JWT_SECRET === parsed.SECURE_JWT_SECRET) {
  throw new Error("Twin environments must use different JWT secrets.");
}
if (parsed.BASELINE_UPLOAD_DIR && parsed.SECURE_UPLOAD_DIR &&
    path.resolve(parsed.BASELINE_UPLOAD_DIR).toLowerCase() === path.resolve(parsed.SECURE_UPLOAD_DIR).toLowerCase()) {
  throw new Error("Twin environments must use different upload directories.");
}

if (Boolean(parsed.SMTP_USER) !== Boolean(parsed.SMTP_PASSWORD)) {
  throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together.");
}

if (
  isSecure &&
  parsed.NODE_ENV === "production" &&
  parsed.SMTP_USER &&
  !smtpSecure &&
  !["localhost", "127.0.0.1", "mailpit"].includes(parsed.SMTP_HOST.toLowerCase())
) {
  throw new Error("Authenticated SMTP must use SMTP_SECURE=true outside the local Mailpit environment.");
}

if (
  parsed.SECURITY_MODE === "baseline" &&
  parsed.NODE_ENV === "production" &&
  !parsed.ALLOW_INSECURE_LAB
) {
  throw new Error(
    "Baseline is intentionally vulnerable. Set ALLOW_INSECURE_LAB=true only inside an isolated lab."
  );
}

if (
  isSecure &&
  parsed.NODE_ENV === "production" &&
  (jwtSecret.length < 32 ||
    jwtSecret === "replace-with-at-least-32-random-characters")
) {
  throw new Error("JWT_SECRET must be replaced with a random secret of at least 32 characters.");
}

if (
  isSecure &&
  parsed.NODE_ENV === "production" &&
  (parsed.CSRF_SECRET.length < 32 ||
    parsed.CSRF_SECRET === jwtSecret ||
    parsed.CSRF_SECRET === "replace-with-a-different-32-character-random-secret")
) {
  throw new Error("CSRF_SECRET must be replaced with a distinct random secret of at least 32 characters.");
}

if (
  isSecure &&
  parsed.NODE_ENV === "production" &&
  databasePassword.startsWith("ChangeThis_")
) {
  throw new Error("DB_PASSWORD must be changed before secure production startup.");
}

export const config = {
  nodeEnv: parsed.NODE_ENV,
  mode: parsed.SECURITY_MODE,
  isSecure,
  identity: environmentIdentity(parsed.SECURITY_MODE),
  host: parsed.HOST,
  port: parsed.PORT ?? (isSecure ? 4002 : 4001),
  db: {
    server: parsed.SQLSERVER_HOST,
    port: parsed.SQLSERVER_PORT,
    database: databaseName,
    user: databaseUser,
    password: databasePassword,
    encrypt: sqlEncrypt,
    trustServerCertificate: sqlTrustCertificate
  },
  jwtSecret,
  csrfSecret: parsed.CSRF_SECRET,
  webOrigin,
  uploadDir: path.resolve((isSecure ? parsed.SECURE_UPLOAD_DIR : parsed.BASELINE_UPLOAD_DIR)
    ?? path.join(parsed.UPLOAD_DIR, parsed.SECURITY_MODE)),
  reportsDir: path.resolve(parsed.REPORTS_DIR),
  smtp: {
    host: parsed.SMTP_HOST,
    port: parsed.SMTP_PORT,
    secure: smtpSecure,
    user: parsed.SMTP_USER,
    password: parsed.SMTP_PASSWORD,
    fromAddress: parsed.MAIL_FROM_ADDRESS,
    fromName: parsed.MAIL_FROM_NAME
  },
  passwordResetTtlMinutes: parsed.PASSWORD_RESET_TTL_MINUTES,
  emailVerificationTtlHours: parsed.EMAIL_VERIFICATION_TTL_HOURS,
  accessTokenTtlMinutes: parsed.ACCESS_TOKEN_TTL_MINUTES,
  sessionTtlDays: parsed.SESSION_TTL_DAYS,
  authCleanup: {
    enabled: parsed.AUTH_CLEANUP_ENABLED ?? true,
    intervalMinutes: parsed.AUTH_CLEANUP_INTERVAL_MINUTES,
    retentionDays: parsed.AUTH_CLEANUP_RETENTION_DAYS,
    batchSize: parsed.AUTH_CLEANUP_BATCH_SIZE,
    maxBatches: parsed.AUTH_CLEANUP_MAX_BATCHES
  },
  trustProxyHops: parsed.TRUST_PROXY_HOPS,
  stockHold: {
    enabled: parsed.STOCK_HOLD_ENABLED ?? true,
    minutes: parsed.STOCK_HOLD_MINUTES,
    graceMinutes: parsed.STOCK_HOLD_GRACE_MINUTES,
    intervalSeconds: parsed.STOCK_HOLD_INTERVAL_SECONDS,
    batchSize: parsed.STOCK_HOLD_BATCH_SIZE
  },
  cookieSecure:
    parsed.COOKIE_SECURE ?? (parsed.NODE_ENV === "production" && webOrigin.startsWith("https://")),
  vnpay: {
    tmnCode: parsed.VNPAY_TMN_CODE,
    hashSecret: parsed.VNPAY_HASH_SECRET,
    returnUrl: parsed.VNPAY_RETURN_URL,
    url: parsed.VNPAY_URL,
    queryEnabled: parsed.VNPAY_QUERY_ENABLED ?? false,
    queryUrl: parsed.VNPAY_QUERY_URL,
    queryTimeoutMs: parsed.VNPAY_QUERY_TIMEOUT_MS,
    queryIpAddress: parsed.VNPAY_QUERY_IP_ADDRESS
  },
  alerting: {
    webhookUrl: parsed.ALERT_WEBHOOK_URL,
    telegramBotToken: parsed.ALERT_TELEGRAM_BOT_TOKEN,
    telegramChatId: parsed.ALERT_TELEGRAM_CHAT_ID,
    throttleSeconds: parsed.ALERT_THROTTLE_SECONDS,
    maxAttempts: parsed.ALERT_MAX_ATTEMPTS,
    retryDelayMs: parsed.ALERT_RETRY_DELAY_MS,
    timeoutMs: parsed.ALERT_TIMEOUT_MS
  }
} as const;

export type SecurityMode = typeof config.mode;
