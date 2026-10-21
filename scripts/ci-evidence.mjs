import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Deliberately export counts only. Strings, errors, attachments and request data
// from arbitrary test reports never cross the artifact boundary.
export function summarize(report) {
  if (report.stats) {
    const valid = ['expected', 'unexpected', 'skipped', 'flaky'].every(key => Number.isSafeInteger(report.stats[key]) && report.stats[key] >= 0);
    const count = key => Number.isSafeInteger(report.stats[key]) && report.stats[key] >= 0 ? report.stats[key] : 0;
    const counts = Object.fromEntries(['expected', 'unexpected', 'skipped', 'flaky'].map(key => [key, count(key)]));
    return { available: true, passed: valid && counts.expected > 0 && counts.unexpected === 0 && counts.skipped === 0 && counts.flaky === 0 && Array.isArray(report.errors) && report.errors.length === 0, counts };
  }
  const results = Array.isArray(report.results) ? report.results : [];
  return { available: true, passed: report.passed === true && report.cleanupPassed !== false && results.length > 0 && results.every(result => result.passed === true),
    counts: { checks: results.reduce((total, result) => total + (Number.isSafeInteger(result.checks) && result.checks >= 0 ? result.checks : 1), 0),
      failed: results.filter(result => result.passed !== true).length }, ...(typeof report.cleanupPassed === 'boolean' ? { cleanupPassed: report.cleanupPassed } : {}),
    stages: results.filter(result => ['configuration', 'build', 'startup', 'commerce', 'auth', 'security', 'payments', 'stock', 'e2e'].includes(result.gate))
      .map(result => ({ gate: result.gate, passed: result.passed === true })) };
}
export const reportFiles = {
  ux: { desktop: 'reports/ux/results.json', mobile: 'reports/mobile-ux/results.json', layout: 'reports/ui-layout/results.json', payments: 'reports/payments/ux-results.json' },
  sql: { integration: 'reports/ci/sql.json' }, production: { drill: 'reports/operations/production-drill.json' }, verify: {}
};
export async function exportEvidence(job, since = Date.now() - 3600000) {
  if (!Object.hasOwn(reportFiles, job) || !Number.isFinite(since)) throw new Error('INVALID_EVIDENCE_SCOPE');
  const gates = {};
  for (const [gate, file] of Object.entries(reportFiles[job])) {
    try {
      if ((await stat(file)).mtimeMs < since) throw new Error('STALE_REPORT');
      gates[gate] = summarize(JSON.parse(await readFile(file, 'utf8')));
    } catch { gates[gate] = { available: false, passed: false }; }
  }
  if (job === 'verify') for (const gate of ['audit', 'verify', 'operations', 'ci', 'lint']) {
    const outcome = process.env[`CI_${gate.toUpperCase()}_OUTCOME`];
    gates[gate] = { available: ['success', 'failure', 'cancelled', 'skipped'].includes(outcome), passed: outcome === 'success' };
  }
  const evidence = { generatedAt: new Date().toISOString(), job, passed: Object.values(gates).every(gate => gate.passed), gates };
  await mkdir('reports/ci/evidence', { recursive: true });
  await writeFile(`reports/ci/evidence/${job}.json`, JSON.stringify(evidence, null, 2));
  return evidence;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const evidence = await exportEvidence(process.argv[2], process.env.CI_STARTED_AT ? Date.parse(process.env.CI_STARTED_AT) : undefined);
  if (!evidence.passed) process.exitCode = 1;
}
