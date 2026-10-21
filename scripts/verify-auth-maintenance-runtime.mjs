import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';

const audit = process.argv.includes('--audit');
if (process.argv.slice(2).some(arg => !['--audit', '--security-hardening', '--payments'].includes(arg))) throw new Error('Usage: verify-auth-maintenance-runtime.mjs [--audit] [--security-hardening|--payments]');
const health = [];
for (const port of [4001, 4002]) {
  const response = await fetch(`http://localhost:${port}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.data.auditFixture, audit);
  health.push({ port, healthy: true, auditFixture: audit });
}
const { stdout } = await promisify(execFile)('docker', ['compose', 'logs', '--no-color', 'api-baseline', 'api-secure'], { maxBuffer: 8 * 1024 * 1024 });
// Record only the cleanup worker's counts; discard HTTP/auth logs and SQL secrets.
const events = stdout.split(/\r?\n/).flatMap(line => {
  const start = line.indexOf('{'); if (start < 0) return [];
  try {
    const event = JSON.parse(line.slice(start));
    return ['auth_cleanup_completed', 'auth_cleanup_failed'].includes(event.event) ? [event] : [];
  } catch { return []; }
});
for (const mode of ['baseline', 'secure']) {
  const latest = events.filter(event => event.mode === mode).at(-1);
  assert.equal(latest?.event, 'auth_cleanup_completed', `${mode}: startup maintenance must complete successfully`);
  assert.equal(latest.skipped, false);
}
const directory = process.argv.includes('--payments') ? 'reports/payments' : process.argv.includes('--security-hardening') ? 'reports/security-hardening' : 'reports/auth-maintenance';
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/runtime-${audit ? 'audit' : 'regular'}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), health, events }, null, 2));
console.log(`${audit ? 'Audit' : 'Regular'} APIs healthy; both cleanup workers completed successfully.`);
