import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExperimentReport } from "./experiments.js";

test("normalizes a k6 report without inventing unavailable resource metrics", () => {
  const run = normalizeExperimentReport("k6-secure.json", JSON.stringify({
    mode: "secure",
    generatedAt: "2026-09-09T08:00:00.000Z",
    metrics: {
      http_req_duration: { med: 42.5, "p(95)": 90.2 },
      http_reqs: { count: 100, rate: 12.4 },
      http_req_failed: { rate: 0 },
      checks: { count: 200, rate: 1 }
    }
  }));

  assert.equal(run.runType, "performance");
  assert.equal(run.mode, "secure");
  assert.equal(run.p50Ms, 42.5);
  assert.equal(run.p95Ms, 90.2);
  assert.equal(run.passed, true);
  assert.equal(run.cpuPercent, null);
  assert.equal(run.memoryMb, null);
});

test("normalizes real security comparison counts", () => {
  const run = normalizeExperimentReport("security-results.json", JSON.stringify({
    summary: {
      generatedAt: "2026-09-09T08:00:00.000Z",
      total: 2,
      passed: 1,
      baselineVulnerable: 2,
      secureProtected: 1
    },
    results: [{ passed: true }, { passed: false }]
  }));
  assert.equal(run.mode, "comparison");
  assert.equal(run.totalCases, 2);
  assert.equal(run.passedCases, 1);
  assert.equal(run.passed, false);
});

test("normalizes Playwright JSON reporter statistics as secure functional evidence", () => {
  const run = normalizeExperimentReport("playwright-results.json", JSON.stringify({
    stats: {
      startTime: "2026-09-09T08:30:00.000Z",
      expected: 3,
      skipped: 0,
      unexpected: 0,
      flaky: 0
    }
  }));
  assert.equal(run.runType, "functional");
  assert.equal(run.mode, "secure");
  assert.equal(run.totalCases, 3);
  assert.equal(run.passedCases, 3);
  assert.equal(run.passed, true);
});
