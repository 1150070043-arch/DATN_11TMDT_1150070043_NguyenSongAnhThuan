import assert from "node:assert/strict";
import test from "node:test";
import { createCsrfToken, validCsrfToken } from "./csrf.js";

test("CSRF accepts issued tokens and rejects changed signatures", () => {
  const token = createCsrfToken();
  assert.equal(validCsrfToken(token), true);
  const [nonce, signature] = token.split(".");
  assert.equal(validCsrfToken(`${nonce}.${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`), false);
});

test("CSRF rejects ambiguous, oversized and non-string tokens", () => {
  const token = createCsrfToken();
  for (const invalid of [undefined, null, {}, [], "", `${token}.extra`, `${token}\n`, token.slice(1), "a".repeat(100_000)]) {
    assert.equal(validCsrfToken(invalid), false);
  }
});
