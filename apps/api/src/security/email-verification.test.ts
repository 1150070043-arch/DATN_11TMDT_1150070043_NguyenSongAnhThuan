import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken
} from "./email-verification.js";

test("email verification tokens are random and hash deterministically", () => {
  const first = createEmailVerificationToken();
  const second = createEmailVerificationToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashEmailVerificationToken(first.token));
  assert.match(first.hash, /^[a-f0-9]{64}$/);
});
