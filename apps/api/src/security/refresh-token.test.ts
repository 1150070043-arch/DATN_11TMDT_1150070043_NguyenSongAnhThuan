import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshCredential, hashRefreshToken } from "./refresh-token.js";

test("refresh credentials are random and stored as SHA-256 hashes", () => {
  const first = createRefreshCredential();
  const second = createRefreshCredential();

  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^[A-Za-z0-9_-]{64}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.hash, hashRefreshToken(first.token));
  assert.notEqual(first.hash, first.token);
});

test("hashing a refresh token is deterministic", () => {
  const token = "refresh-token-for-a-repeatable-unit-test";
  assert.equal(hashRefreshToken(token), hashRefreshToken(token));
});
