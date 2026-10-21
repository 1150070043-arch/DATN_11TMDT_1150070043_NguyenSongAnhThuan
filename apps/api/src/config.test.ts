import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { environmentIdentity } from "./security/environment.js";

function readConfig(overrides: Record<string, string> = {}) {
  // Deliberately do not inherit .env or real credentials into this fixture.
  const script = `import {config} from ${JSON.stringify(new URL("./config.js", import.meta.url).href)}; console.log(JSON.stringify(config));`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { NODE_ENV: "test", ...overrides }, encoding: "utf8"
  });
}

test("blank optional webhook permits production startup; invalid URLs and incomplete Telegram settings fail", () => {
  const production = { NODE_ENV: "production", JWT_SECRET: "synthetic-production-jwt-secret-32chars", CSRF_SECRET: "synthetic-production-csrf-secret-distinct", DB_PASSWORD: "synthetic-runtime-pass-123!", ALERT_WEBHOOK_URL: "" };
  assert.equal(readConfig(production).status, 0);
  assert.equal(readConfig({ ...production, ALERT_WEBHOOK_URL: "   " }).status, 0);
  assert.notEqual(readConfig({ ...production, ALERT_WEBHOOK_URL: "invalid" }).status, 0);
  assert.notEqual(readConfig({ ...production, ALERT_TELEGRAM_BOT_TOKEN: "synthetic" }).status, 0);
  assert.notEqual(readConfig({ ...production, ALERT_MAX_ATTEMPTS: "4" }).status, 0);
});

test("twin configurations use distinct DBs, users, uploads and browser/token identities", () => {
  const baselineResult = readConfig({ SECURITY_MODE: "baseline", UPLOAD_DIR: "./legacy-uploads" });
  const secureResult = readConfig({ SECURITY_MODE: "secure", UPLOAD_DIR: "./legacy-uploads" });
  assert.equal(baselineResult.status, 0, baselineResult.stderr);
  assert.equal(secureResult.status, 0, secureResult.stderr);
  const baseline = JSON.parse(baselineResult.stdout);
  const secure = JSON.parse(secureResult.stdout);
  assert.notEqual(baseline.db.database, secure.db.database);
  assert.notEqual(baseline.db.user, secure.db.user);
  assert.notEqual(baseline.uploadDir, secure.uploadDir);
  for (const key of Object.keys(environmentIdentity("secure"))) {
    assert.notEqual(baseline.identity[key], secure.identity[key]);
  }
});

test("explicit per-environment uploads preserve Docker volume paths", () => {
  const result = readConfig({ SECURITY_MODE: "secure", SECURE_UPLOAD_DIR: "/app/uploads" });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).uploadDir.replaceAll("\\", "/").endsWith("/app/uploads"));
});

test('auth maintenance defaults are bounded, configurable and can be disabled', () => {
  const defaults = readConfig();
  assert.equal(defaults.status, 0);
  assert.deepEqual(JSON.parse(defaults.stdout).authCleanup, { enabled: true, intervalMinutes: 60, retentionDays: 7, batchSize: 500, maxBatches: 10 });
  const disabled = readConfig({ AUTH_CLEANUP_ENABLED: 'false', AUTH_CLEANUP_RETENTION_DAYS: '30' });
  assert.equal(disabled.status, 0);
  assert.equal(JSON.parse(disabled.stdout).authCleanup.enabled, false);
  assert.equal(JSON.parse(disabled.stdout).authCleanup.retentionDays, 30);
  for (const invalid of [{ AUTH_CLEANUP_RETENTION_DAYS: '0' }, { AUTH_CLEANUP_BATCH_SIZE: '1001' }, { AUTH_CLEANUP_INTERVAL_MINUTES: '0' }, { AUTH_CLEANUP_MAX_BATCHES: '51' }]) {
    assert.notEqual(readConfig(invalid).status, 0);
  }
});

test("stock hold policy has a fixed bounded window, callback grace and a switch for its worker", () => {
  const defaults = readConfig(); assert.equal(defaults.status, 0);
  assert.deepEqual(JSON.parse(defaults.stdout).stockHold, { enabled: true, minutes: 30, graceMinutes: 5, intervalSeconds: 60, batchSize: 25 });
  const custom = readConfig({ STOCK_HOLD_ENABLED: "false", STOCK_HOLD_MINUTES: "45", STOCK_HOLD_GRACE_MINUTES: "10" });
  assert.equal(custom.status, 0); assert.equal(JSON.parse(custom.stdout).stockHold.enabled, false);
  assert.equal(JSON.parse(custom.stdout).stockHold.minutes, 45);
  for (const invalid of [{ STOCK_HOLD_MINUTES: "14" }, { STOCK_HOLD_GRACE_MINUTES: "0" }, { STOCK_HOLD_BATCH_SIZE: "101" }, { STOCK_HOLD_INTERVAL_SECONDS: "9" }]) assert.notEqual(readConfig(invalid).status, 0);
});

test("production remote SQL must encrypt and verify its certificate", () => {
  const production = { SECURITY_MODE: "secure", NODE_ENV: "production", SQLSERVER_HOST: "sql.example.com",
    JWT_SECRET: "fixture-jwt-secret-of-at-least-32-characters", CSRF_SECRET: "fixture-csrf-secret-distinct-and-32-characters", DB_PASSWORD: "fixture-runtime-password-123!" };
  for (const unsafe of [{ SQLSERVER_ENCRYPT: "false" }, { SQLSERVER_TRUST_CERTIFICATE: "true" }]) {
    const result = readConfig({ ...production, ...unsafe });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /encrypted SQL and certificate verification/);
  }
  const valid = readConfig(production);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).db.encrypt, true);
  assert.equal(JSON.parse(valid.stdout).db.trustServerCertificate, false);
});

test("accidental DB, user, secret and upload collisions fail before startup", () => {
  for (const env of [
    { DB_NAME: "BookGuardBaseline" },
    { DB_USER: "bookguard_baseline" },
    { BASELINE_DB_NAME: "same_db", SECURE_DB_NAME: "same_db" },
    { BASELINE_JWT_SECRET: "same", SECURE_JWT_SECRET: "same" },
    { BASELINE_UPLOAD_DIR: "./same", SECURE_UPLOAD_DIR: "./same" }
  ]) {
    const result = readConfig({ SECURITY_MODE: "secure", ...env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Twin environments must use different/);
  }
});

test("VNPay queries default off, require safe endpoints and validate timeout/egress IP", () => {
  const defaults = readConfig(); assert.equal(defaults.status, 0);
  assert.equal(JSON.parse(defaults.stdout).vnpay.queryEnabled, false);
  for (const invalid of [{ VNPAY_QUERY_URL: "http://provider.example/query" }, { VNPAY_QUERY_URL: "https://user:password@provider.example/query" },
    { VNPAY_QUERY_URL: "https://provider.example/query?secret=value" }, { VNPAY_QUERY_TIMEOUT_MS: "16000" }, { VNPAY_QUERY_IP_ADDRESS: "invalid" }]) {
    assert.notEqual(readConfig(invalid).status, 0);
  }
  assert.equal(readConfig({ VNPAY_QUERY_URL: "http://127.0.0.1:19091/query", VNPAY_QUERY_ENABLED: "true", VNPAY_QUERY_IP_ADDRESS: "" }).status, 0);
  assert.notEqual(readConfig({ NODE_ENV: "development", VNPAY_QUERY_URL: "http://127.0.0.1:19091/query" }).status, 0);
});
