import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordResetToken, hashPasswordResetToken } from "./password-reset.js";

test("creates an opaque reset token and stores only its SHA-256 hash", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.match(first.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.hash, hashPasswordResetToken(first.token));
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.hash, second.hash);
  assert.equal(first.hash.includes(first.token), false);
});
