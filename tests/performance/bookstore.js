import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:4002";
const mode = __ENV.TEST_MODE || "secure";
const outputFile = __ENV.OUTPUT_FILE || `/reports/k6-${mode}.json`;

export const options = {
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
  scenarios: {
    browse_catalog: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 10 },
        { duration: "45s", target: 10 },
        { duration: "15s", target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"]
  }
};

export default function () {
  const catalog = http.get(`${baseUrl}/api/books?limit=12&sort=newest`);
  check(catalog, {
    "catalog status 200": (response) => response.status === 200,
    "catalog has data": (response) => response.json("data.0.id") !== undefined
  });

  const detail = http.get(`${baseUrl}/api/books/clean-code`);
  check(detail, {
    "detail status 200": (response) => response.status === 200
  });
  sleep(1);
}

export function handleSummary(data) {
  const metrics = {};
  for (const [name, metric] of Object.entries(data.metrics)) {
    if (metric?.values) metrics[name] = metric.values;
  }

  const result = {
    mode,
    baseUrl,
    generatedAt: new Date().toISOString(),
    thresholds: options.thresholds,
    metrics
  };

  const timestamp = result.generatedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const separator = outputFile.lastIndexOf("/");
  const outputDirectory = separator >= 0 ? outputFile.slice(0, separator) : ".";
  const archiveFile = `${outputDirectory}/k6-${mode}-${timestamp}.json`;
  const serialized = JSON.stringify(result, null, 2);

  return {
    [outputFile]: serialized,
    [archiveFile]: serialized,
    stdout: [
      `BookGuard ${mode} performance run completed`,
      `Output: ${outputFile}`,
      `Requests: ${metrics.http_reqs?.count ?? 0}`,
      `p95: ${Math.round((metrics.http_req_duration?.["p(95)"] ?? 0) * 100) / 100} ms`,
      `Error rate: ${Math.round((metrics.http_req_failed?.rate ?? 0) * 10000) / 100}%`
    ].join("\n") + "\n"
  };
}
