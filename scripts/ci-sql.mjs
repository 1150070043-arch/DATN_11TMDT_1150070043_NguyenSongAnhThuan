import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inside } from './lib/backup-context.mjs';
import { cleanEnvironment, fixtureEnvironment, validateCiCompose } from './lib/ci-fixture.mjs';

const project = 'bookguard-ci-' + randomUUID().slice(0, 8);
const root = path.resolve('reports/ci', project);
await mkdir(path.join(root, 'generated'), { recursive: true });
const env = cleanEnvironment(fixtureEnvironment(project));
const envFile = path.join(root, 'fixture.env'), resolvedFile = path.join(root, 'resolved.json');
const args = ['compose', '-p', project, '--env-file', envFile, '-f', path.resolve('docker-compose.yml'), '-f', path.resolve('docker-compose.audit.yml')];
const stages = [], startedAt = new Date().toISOString();
let topology, started = false, stage = 'configuration', cleanupPassed = false;
function execute(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, env, ...options });
  if (result.error || result.status !== 0) {
    writeFileSync(path.join(root, 'failure.local.log'), (result.stdout || '') + (result.stderr || ''), { mode: 0o600 });
    throw Object.assign(new Error('CI_COMMAND_FAILED'), { code: 'CI_COMMAND_FAILED' });
  }
  return result.stdout;
}
function compose(command, options = {}) { return execute('docker', [...args, ...command], options); }
const suites = [
  ['commerce', 'commerce-regressions.ts', 'reports/generated/commerce-regressions.json', 19],
  ['auth', 'auth-maintenance-regressions.ts', 'reports/auth-maintenance/sql-regressions.json', 13],
  ['security', 'security-hardening-regressions.ts', 'reports/security-hardening/sql-regressions.json', 12],
  ['payments', 'payment-regressions.ts', 'reports/payments/sql-provider-regressions.json', 10],
  ['stock', 'stock-hold-regressions.ts', 'reports/stock-holds/sql-regressions.json', 17],
  ['e2e', null, 'reports/generated/playwright-results.json', 7]
];
try {
  if (process.env.GITHUB_ACTIONS === 'true') for (const [key, value] of Object.entries(env)) {
    if (/PASSWORD|SECRET/.test(key) && value) console.log('::add-mask::' + value);
  }
  await writeFile(envFile, Object.entries(env).filter(([key]) => /^[A-Z_]+$/.test(key)).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
  topology = JSON.parse(compose(['--profile', 'tools', 'config', '--format', 'json']));
  const ports = { sqlserver: { 1433: 13433 }, mailpit: { 1025: 11025, 8025: 18025 }, 'mailpit-baseline': { 1025: 11026, 8025: 18026 },
    'api-baseline': { 4001: 14001 }, 'api-secure': { 4002: 14002 }, 'web-baseline': { 80: 15173 }, 'web-secure': { 80: 15174 } };
  const services = [...Object.keys(ports), 'db-init-baseline', 'db-init-secure'];
  topology.services = Object.fromEntries(Object.entries(topology.services).filter(([name]) => services.includes(name)));
  for (const [name, service] of Object.entries(topology.services)) {
    for (const port of service.ports || []) Object.assign(port, { published: String(ports[name][port.target]), host_ip: '127.0.0.1' });
    service.restart = 'no';
  }
  topology.services.sqlserver.environment.MSSQL_MEMORY_LIMIT_MB = '1024';
  for (const mode of ['baseline', 'secure']) {
    const api = topology.services[`api-${mode}`];
    Object.assign(api.environment, { WEB_ORIGIN: env[`${mode.toUpperCase()}_WEB_ORIGIN`], STOCK_HOLD_ENABLED: 'false', AUTH_CLEANUP_ENABLED: 'false',
      ALERT_WEBHOOK_URL: '', ALERT_TELEGRAM_BOT_TOKEN: '', ALERT_TELEGRAM_CHAT_ID: '', VNPAY_QUERY_ENABLED: 'false' });
    api.volumes.find(volume => volume.target === '/app/reports/generated').source = path.join(root, 'generated');
    Object.assign(topology.services[`web-${mode}`].build.args, { VITE_API_URL: env[`${mode.toUpperCase()}_URL`], VITE_MAIL_UI_URL: '' });
  }
  validateCiCompose(topology, project);
  await writeFile(resolvedFile, JSON.stringify(topology), { mode: 0o600 });
  args.splice(0, args.length, 'compose', '-p', project, '-f', resolvedFile);
  stage = 'build'; console.log('Building isolated CI images...');
  compose(['build', 'api-baseline', 'api-secure', 'db-init-baseline', 'db-init-secure', 'web-baseline', 'web-secure'], { timeout: 600000 });
  stage = 'startup'; started = true; console.log('Starting isolated CI SQL and services...');
  compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '180'], { timeout: 210000 });
  for (const mode of ['baseline', 'secure']) {
    const health = await fetch(env[`${mode.toUpperCase()}_URL`] + '/api/health').then(response => response.json());
    assert.equal(health.data.auditFixture, true); assert.equal(health.data.schemaVersion, 8);
  }
  for (const [name, script, reportFile, expected] of suites) {
    stage = name; console.log('Running CI gate: ' + name);
    // A fresh fixture and process per gate keep rate limits and worker state realistic.
    validateCiCompose(topology, project);
    compose(['stop', 'api-baseline', 'api-secure']);
    for (const mode of ['baseline', 'secure']) compose(['run', '--rm', '--no-deps', `db-init-${mode}`, 'node', 'dist/db/cli.js', 'reset', mode]);
    compose(['up', '-d', '--no-deps', '--wait', '--wait-timeout', '90', 'api-baseline', 'api-secure'], { timeout: 120000 });
    await rm(reportFile, { force: true });
    const start = Date.now();
    const childEnv = { ...env, CI: 'true' };
    const output = script
      ? execute(process.execPath, ['--import', 'tsx', `src/${script}`], { cwd: path.resolve('tests/functional'), env: childEnv, timeout: 240000 })
      : execute(process.execPath, [path.resolve('node_modules/playwright/cli.js'), 'test'], { cwd: path.resolve('tests/e2e'), env: childEnv, timeout: 240000 });
    await writeFile(path.join(root, `${name}.local.log`), output, { mode: 0o600 });
    assert.ok((await stat(reportFile)).mtimeMs >= start - 2000);
    const report = JSON.parse(await readFile(reportFile, 'utf8'));
    if (script) { assert.equal(report.passed, true); assert.equal(report.results.length, expected); assert.ok(report.results.every(result => result.passed)); }
    else { assert.equal(report.stats.expected, expected); for (const key of ['unexpected', 'skipped', 'flaky']) assert.equal(report.stats[key], 0); assert.equal(report.errors.length, 0); }
    stages.push({ gate: name, passed: true, checks: expected, durationMs: Date.now() - start });
    console.log(`PASS ${name}: ${expected} checks`);
  }
} catch (error) {
  if (started) {
    try {
      const logs = compose(['logs', '--no-log-prefix', 'api-secure', 'api-baseline']);
      await writeFile(path.join(root, 'services.local.log'), logs, { mode: 0o600 });
      const failures = logs.split('\n').flatMap(line => { try { const row = JSON.parse(line); const code = row.code || row.message; return row.level === 'error' && /^[A-Z_]{1,64}$/.test(code || '') ? [{ code, ...(Number.isInteger(row.databaseErrorNumber) ? { number: row.databaseErrorNumber } : {}) }] : []; } catch { return []; } });
      console.error(JSON.stringify({ serviceErrors: failures }));
    } catch { /* The failing gate remains the primary result. */ }
  }
  stages.push({ gate: stage, passed: false, checks: 0 });
  console.error(JSON.stringify({ gate: stage, code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'CI_GATE_FAILED', site: error.stack?.split('\n')[1] }));
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      validateCiCompose(topology, project);
      compose(['down', '--volumes', '--remove-orphans'], { timeout: 120000 });
      cleanupPassed = true;
    } catch { console.error('CI fixture cleanup failed.'); process.exitCode = 1; }
  } else cleanupPassed = true;
  for (const file of [envFile, resolvedFile]) await rm(inside(root, file), { force: true });
  await writeFile('reports/ci/sql.json', JSON.stringify({ generatedAt: new Date().toISOString(), startedAt,
    passed: stages.length === suites.length && stages.every(result => result.passed) && cleanupPassed, cleanupPassed, results: stages }, null, 2));
}
