import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";

const directory = "reports/generated";
const repetitions = Number(process.argv[2] || 3);
const files = (await readdir(directory)).filter(name => /^k6-(baseline|secure)-\d{8}T\d{6}Z\.json$/.test(name));
const reports = await Promise.all(files.map(async file => ({ file, ...JSON.parse((await readFile(`${directory}/${file}`, "utf8")).replace(/^\uFEFF/, "")) })));
const batch = reports.map(report => report.experiment?.batch).filter(Boolean).sort().at(-1);
assert.ok(batch, "Need reports from a complete experiment batch");
const median = values => { const sorted = values.toSorted((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const round = value => Number(value.toFixed(3));
const rows = [];
for (const mode of ["baseline", "secure"]) {
  const selected = reports.filter(report => report.mode === mode && report.experiment?.batch === batch).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).slice(0, repetitions);
  assert.equal(selected.length, repetitions, `Need ${repetitions} measured runs for ${mode}`);
  assert.equal(new Set(selected.map(report => report.experiment?.iteration)).size, repetitions);
  assert.ok(selected.every(report => report.thresholdsPassed && report.metrics.checks.rate === 1 && report.metrics.http_req_failed.rate === 0 && report.resources.sampleCount > 0));
  rows.push({ mode, repetitions, files: selected.map(report => report.file),
    medianRequestMs: round(median(selected.map(report => report.metrics.http_req_duration.med))),
    medianP95Ms: round(median(selected.map(report => report.metrics.http_req_duration["p(95)"]))),
    medianThroughputPerSecond: round(median(selected.map(report => report.metrics.http_reqs.rate))),
    medianLoginMs: round(median(selected.map(report => report.metrics.login_duration.med))),
    medianCheckoutMs: round(median(selected.map(report => report.metrics.checkout_duration.med))),
    errorRate: 0, checksPassedRate: 1,
    medianApiCpuPercent: round(median(selected.map(report => report.resources.cpuPercent))),
    maximumApiMemoryMb: round(Math.max(...selected.map(report => report.resources.memoryMb))),
    medianSqlCpuPercent: round(median(selected.map(report => report.resources.sqlServer.cpuPercent))),
    maximumSqlMemoryMb: round(Math.max(...selected.map(report => report.resources.sqlServer.memoryMb))) });
}
const summary = { generatedAt: new Date().toISOString(), batch, aggregation: "Median of each run's statistics; not a pooled percentile. Memory is maximum across runs.",
  environment: { cpu: "Intel Core i7-13620H, 10 cores / 16 threads", hostMemoryBytes: 16869351424, dockerCpuCount: 16, dockerMemoryBytes: 8170143744, sqlShared: true, background: "Other pre-existing PostgreSQL container remained running; no production capacity claim" },
  workload: "3 VUs, 75 seconds + graceful stop, 10-second catalog warmup, reset to 36 books / 60 orders before each run; one active API at a time; alternating order; security controls unchanged", rows };
await writeFile(`${directory}/performance-summary.json`, JSON.stringify(summary, null, 2));
console.table(rows.map(({ files, ...row }) => row));
