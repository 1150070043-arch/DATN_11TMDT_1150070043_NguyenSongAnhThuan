import crypto from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { getPool, sql } from "../db/pool.js";
import { logger } from "./logger.js";

const reportNamePattern = /^(?:(?:security-results|functional-results|k6-(?:baseline|secure))(?:-[0-9]{8}T[0-9]{6}Z)?|playwright-results)\.json$/;
const maximumReportBytes = 2 * 1024 * 1024;

const securitySchema = z.object({
  summary: z.object({
    generatedAt: z.string().datetime(),
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    baselineVulnerable: z.number().int().nonnegative(),
    secureProtected: z.number().int().nonnegative()
  }),
  results: z.array(z.object({ passed: z.boolean() })).max(100)
});

const functionalSchema = z.object({
  generatedAt: z.string().datetime(),
  passed: z.boolean(),
  results: z.array(z.object({
    mode: z.enum(["baseline", "secure"]),
    passed: z.boolean(),
    steps: z.array(z.object({ passed: z.boolean() })).max(200)
  })).max(10)
});

const performanceSchema = z.object({
  mode: z.enum(["baseline", "secure"]),
  generatedAt: z.string().datetime(),
  metrics: z.record(z.string(), z.unknown()),
  resources: z.object({
    cpuPercent: z.number().nonnegative().optional(),
    memoryMb: z.number().nonnegative().optional()
  }).optional()
});

const playwrightSchema = z.object({
  stats: z.object({
    startTime: z.string().datetime(),
    expected: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    unexpected: z.number().int().nonnegative(),
    flaky: z.number().int().nonnegative()
  })
});

type NormalizedExperiment = {
  runType: "security" | "functional" | "performance";
  mode: "baseline" | "secure" | "comparison";
  sourceKey: string;
  executedAt: Date;
  passed: boolean | null;
  totalCases: number | null;
  passedCases: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  throughput: number | null;
  errorRate: number | null;
  cpuPercent: number | null;
  memoryMb: number | null;
  payloadJson: string;
};

function finiteMetric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function metricValues(metrics: Record<string, unknown>, name: string): Record<string, unknown> {
  const metric = metrics[name];
  if (!metric || typeof metric !== "object" || Array.isArray(metric)) return {};
  return metric as Record<string, unknown>;
}

export function normalizeExperimentReport(filename: string, raw: string): NormalizedExperiment {
  const sourceKey = crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  const payload = JSON.parse(raw) as unknown;

  if (filename.startsWith("security-results")) {
    const report = securitySchema.parse(payload);
    return {
      runType: "security",
      mode: "comparison",
      sourceKey,
      executedAt: new Date(report.summary.generatedAt),
      passed: report.summary.total > 0 && report.summary.passed === report.summary.total,
      totalCases: report.summary.total,
      passedCases: report.summary.passed,
      p50Ms: null,
      p95Ms: null,
      throughput: null,
      errorRate: null,
      cpuPercent: null,
      memoryMb: null,
      payloadJson: raw
    };
  }

  if (filename.startsWith("functional-results")) {
    const report = functionalSchema.parse(payload);
    const steps = report.results.flatMap((result) => result.steps);
    return {
      runType: "functional",
      mode: "comparison",
      sourceKey,
      executedAt: new Date(report.generatedAt),
      passed: report.passed,
      totalCases: steps.length,
      passedCases: steps.filter((step) => step.passed).length,
      p50Ms: null,
      p95Ms: null,
      throughput: null,
      errorRate: null,
      cpuPercent: null,
      memoryMb: null,
      payloadJson: raw
    };
  }

  if (filename === "playwright-results.json") {
    const report = playwrightSchema.parse(payload);
    const total = report.stats.expected + report.stats.unexpected + report.stats.flaky;
    return {
      runType: "functional",
      mode: "secure",
      sourceKey,
      executedAt: new Date(report.stats.startTime),
      passed: report.stats.unexpected === 0,
      totalCases: total,
      passedCases: report.stats.expected + report.stats.flaky,
      p50Ms: null,
      p95Ms: null,
      throughput: null,
      errorRate: total === 0 ? null : report.stats.unexpected / total,
      cpuPercent: null,
      memoryMb: null,
      payloadJson: raw
    };
  }

  const report = performanceSchema.parse(payload);
  const duration = metricValues(report.metrics, "http_req_duration");
  const requests = metricValues(report.metrics, "http_reqs");
  const failures = metricValues(report.metrics, "http_req_failed");
  const checks = metricValues(report.metrics, "checks");
  const p50 = finiteMetric(duration.med ?? duration["p(50)"]);
  const p95 = finiteMetric(duration["p(95)"]);
  const throughput = finiteMetric(requests.rate);
  const errorRate = finiteMetric(failures.rate);
  const passedRate = finiteMetric(checks.rate);
  const passed = p95 === null || errorRate === null
    ? null
    : p95 < 500 && errorRate < 0.01 && (passedRate === null || passedRate === 1);
  return {
    runType: "performance",
    mode: report.mode,
    sourceKey,
    executedAt: new Date(report.generatedAt),
    passed,
    totalCases: finiteMetric(checks.count),
    passedCases: passedRate === null || finiteMetric(checks.count) === null
      ? null
      : Math.round(Number(checks.count) * passedRate),
    p50Ms: p50,
    p95Ms: p95,
    throughput,
    errorRate,
    cpuPercent: finiteMetric(report.resources?.cpuPercent),
    memoryMb: finiteMetric(report.resources?.memoryMb),
    payloadJson: raw
  };
}

async function insertExperiment(run: NormalizedExperiment): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request()
    .input("runType", sql.NVarChar(30), run.runType)
    .input("mode", sql.NVarChar(20), run.mode)
    .input("sourceKey", sql.Char(64), run.sourceKey)
    .input("executedAt", sql.DateTime2, run.executedAt)
    .input("passed", sql.Bit, run.passed)
    .input("totalCases", sql.Int, run.totalCases)
    .input("passedCases", sql.Int, run.passedCases)
    .input("p50Ms", sql.Decimal(18, 3), run.p50Ms)
    .input("p95Ms", sql.Decimal(18, 3), run.p95Ms)
    .input("throughput", sql.Decimal(18, 3), run.throughput)
    .input("errorRate", sql.Decimal(18, 6), run.errorRate)
    .input("cpuPercent", sql.Decimal(9, 3), run.cpuPercent)
    .input("memoryMb", sql.Decimal(18, 3), run.memoryMb)
    .input("payloadJson", sql.NVarChar(sql.MAX), run.payloadJson)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.ExperimentRuns WITH (UPDLOCK, HOLDLOCK) WHERE SourceKey = @sourceKey)
      BEGIN
        INSERT INTO dbo.ExperimentRuns
          (RunType, Mode, SourceKey, ExecutedAt, Passed, TotalCases, PassedCases,
           P50Ms, P95Ms, Throughput, ErrorRate, CpuPercent, MemoryMb, PayloadJson)
        VALUES
          (@runType, @mode, @sourceKey, @executedAt, @passed, @totalCases, @passedCases,
           @p50Ms, @p95Ms, @throughput, @errorRate, @cpuPercent, @memoryMb, @payloadJson);
        SELECT CAST(1 AS bit) AS inserted;
      END
      ELSE SELECT CAST(0 AS bit) AS inserted;
    `);
  return Boolean(result.recordset[0]?.inserted);
}

export async function syncExperimentReports(): Promise<{
  imported: number;
  unchanged: number;
  rejected: Array<{ file: string; reason: string }>;
}> {
  const result = { imported: 0, unchanged: 0, rejected: [] as Array<{ file: string; reason: string }> };
  let entries;
  try {
    entries = await readdir(config.reportsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return result;
    throw error;
  }

  const candidates = entries
    .filter((entry) => entry.isFile() && reportNamePattern.test(entry.name))
    .slice(0, 200);
  for (const entry of candidates) {
    try {
      const filePath = path.join(config.reportsDir, entry.name);
      const metadata = await stat(filePath);
      if (metadata.size > maximumReportBytes) throw new Error("Tệp vượt giới hạn 2 MB.");
      const raw = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
      const run = normalizeExperimentReport(entry.name, raw);
      if (await insertExperiment(run)) result.imported += 1;
      else result.unchanged += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Báo cáo không hợp lệ.";
      result.rejected.push({ file: entry.name, reason: reason.slice(0, 240) });
      logger.warn("experiment_report_rejected", { file: entry.name, reason });
    }
  }
  return result;
}

export async function experimentDashboard() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      COUNT(*) AS totalRuns,
      COALESCE(SUM(CASE WHEN RunType = N'security' THEN 1 ELSE 0 END), 0) AS securityRuns,
      COALESCE(SUM(CASE WHEN RunType = N'functional' THEN 1 ELSE 0 END), 0) AS functionalRuns,
      COALESCE(SUM(CASE WHEN RunType = N'performance' THEN 1 ELSE 0 END), 0) AS performanceRuns,
      MAX(ExecutedAt) AS lastExecutedAt
    FROM dbo.ExperimentRuns;

    SELECT TOP 100
      Id AS id, RunType AS runType, Mode AS mode, ExecutedAt AS executedAt,
      Passed AS passed, TotalCases AS totalCases, PassedCases AS passedCases,
      P50Ms AS p50Ms, P95Ms AS p95Ms, Throughput AS throughput,
      ErrorRate AS errorRate, CpuPercent AS cpuPercent, MemoryMb AS memoryMb
    FROM dbo.ExperimentRuns
    ORDER BY ExecutedAt DESC, Id DESC;

    WITH Ranked AS (
      SELECT
        Id, RunType, Mode, ExecutedAt, Passed, TotalCases, PassedCases,
        P50Ms, P95Ms, Throughput, ErrorRate, CpuPercent, MemoryMb,
        ROW_NUMBER() OVER (PARTITION BY RunType, Mode ORDER BY ExecutedAt DESC, Id DESC) AS RowNumber
      FROM dbo.ExperimentRuns
    )
    SELECT
      Id AS id, RunType AS runType, Mode AS mode, ExecutedAt AS executedAt,
      Passed AS passed, TotalCases AS totalCases, PassedCases AS passedCases,
      P50Ms AS p50Ms, P95Ms AS p95Ms, Throughput AS throughput,
      ErrorRate AS errorRate, CpuPercent AS cpuPercent, MemoryMb AS memoryMb
    FROM Ranked
    WHERE RowNumber = 1
    ORDER BY RunType, Mode;
  `);
  const sets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
  return {
    summary: sets[0]?.[0] ?? {},
    history: sets[1] ?? [],
    latest: sets[2] ?? []
  };
}
