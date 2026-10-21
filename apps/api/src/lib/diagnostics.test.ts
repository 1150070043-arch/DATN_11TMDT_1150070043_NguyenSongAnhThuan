import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response, NextFunction } from "express";
import { diagnosticErrorCode, diagnosticPath } from "./diagnostics.js";
import { errorHandler } from "./http.js";
import { logger } from "./logger.js";

test("diagnostics omit all query values, fragments, controls and excessively long paths", () => {
  for (const url of ["/api/auth/reset-password?token=SECRET&email=PRIVATE", "/api/auth/reset-password#SECRET", "/api/auth/reset-password?%74oken=SECRET", "/api/auth/reset-password\r\n?token=SECRET"]) {
    assert.equal(diagnosticPath(url), "/api/auth/reset-password");
  }
  assert.equal(diagnosticPath("/api/books"), "/api/books");
  assert.equal(diagnosticPath("x".repeat(1000)).length, 500);
});

test("diagnostic error codes cannot include raw exceptions or untrusted text", () => {
  assert.equal(diagnosticErrorCode({ code: "ETIMEOUT" }), "ETIMEOUT");
  for (const error of [null, undefined, new Error("PRIVATE"), { code: "token=PRIVATE" }, { code: "A".repeat(1000) }]) {
    assert.equal(diagnosticErrorCode(error), "INTERNAL_ERROR");
  }
});

test("secure 5xx responses, log fields and alert inputs omit URL queries and raw error messages", t => {
  const records: unknown[] = [];
  t.mock.method(logger, "error", (...args: unknown[]) => { records.push(args); });
  t.mock.method(logger, "info", (...args: unknown[]) => { records.push(args); });
  let body: unknown;
  const res = { status: (status: number) => { assert.equal(status, 500); return res; }, json: (value: unknown) => { body = value; } };
  errorHandler(new Error("password=PRIVATE"), {
    originalUrl: "/api/test?token=PRIVATE", method: "GET", requestId: "fixture-request", ip: "127.0.0.1"
  } as Request, res as unknown as Response, (() => {}) as NextFunction);
  assert.equal(JSON.stringify({ records, body }).includes("PRIVATE"), false);
  assert.equal(records.length > 0, true);
});
