import assert from "node:assert/strict";
import test from "node:test";
import { initialAdminCredentials, provisioningPolicy } from "./provisioning-policy.js";
test("public production provisions only Secure without demo seed/reset", () => {
  assert.deepEqual(provisioningPolicy(false, "secure", { NODE_ENV: "production" }), { production: true, seedDemo: false });
  for (const target of ["baseline", "all"] as const) assert.throws(() => provisioningPolicy(false, target, { NODE_ENV: "production" }));
  assert.throws(() => provisioningPolicy(true, "secure", { DB_PROVISION_MODE: "production" }));
  assert.equal(provisioningPolicy(false, "secure", { NODE_ENV: "production", DB_PROVISION_MODE: "lab" }).seedDemo, false);
  assert.equal(provisioningPolicy(true, "all", { NODE_ENV: "production", ALLOW_INSECURE_LAB: "true" }).seedDemo, true);
});
test("initial admin requires explicit strong credentials without a default demo password", () => {
  assert.throws(() => initialAdminCredentials({}));
  assert.throws(() => initialAdminCredentials({ INITIAL_ADMIN_EMAIL: "admin@example.test", INITIAL_ADMIN_PASSWORD: "Admin@12345" }));
  const valid = initialAdminCredentials({ INITIAL_ADMIN_EMAIL: " ADMIN@EXAMPLE.TEST ", INITIAL_ADMIN_PASSWORD: "Synthetic-admin-Strong-123!" });
  assert.equal(valid.email, "admin@example.test");
});
