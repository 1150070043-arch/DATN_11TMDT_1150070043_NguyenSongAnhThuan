import path from "node:path";
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
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  COOKIE_SECURE: boolFromEnv,
  ALLOW_INSECURE_LAB: boolFromEnv,
  VNPAY_TMN_CODE: z.string().default("2QXUI4J4"),
  VNPAY_HASH_SECRET: z.string().default("RAHQxnhjxUk1ambjhWrhAAMPfNxVuErw"),
  VNPAY_URL: z.string().default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html")
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
    password: databasePassword
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
  trustProxyHops: parsed.TRUST_PROXY_HOPS,
  cookieSecure:
    parsed.COOKIE_SECURE ?? (parsed.NODE_ENV === "production" && webOrigin.startsWith("https://")),
  vnpay: {
    tmnCode: parsed.VNPAY_TMN_CODE,
    hashSecret: parsed.VNPAY_HASH_SECRET,
    url: parsed.VNPAY_URL
  }
} as const;

export type SecurityMode = typeof config.mode;
