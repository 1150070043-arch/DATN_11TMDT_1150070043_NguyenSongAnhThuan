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
