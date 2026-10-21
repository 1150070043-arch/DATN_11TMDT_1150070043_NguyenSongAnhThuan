import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { cleanEnvironment, fixtureEnvironment, validateCiCompose } from './lib/ci-fixture.mjs';
import { summarize, exportEvidence } from './ci-evidence.mjs';

const project = 'bookguard-ci-1234abcd';
function topology() {
  const services = {};
  for (const mode of ['baseline', 'secure']) {
    const database = 'BookGuardAudit' + (mode === 'secure' ? 'Secure' : 'Baseline');
    services[`api-${mode}`] = { environment: { DB_NAME: database, DB_USER: `bookguard_audit_${mode}`, SQLSERVER_HOST: 'sqlserver',
      SMTP_HOST: mode === 'secure' ? 'mailpit' : 'mailpit-baseline', VNPAY_QUERY_ENABLED: 'false', VNPAY_TMN_CODE: 'AUDITONLY' },
      volumes: [{ target: '/app/reports/generated', read_only: true }], ports: [{ host_ip: '127.0.0.1', published: '14002' }] };
    services[`db-init-${mode}`] = { environment: { [`${mode.toUpperCase()}_DB_NAME`]: database, ALLOW_INSECURE_LAB: 'true', DB_PROVISION_MODE: 'lab' } };
  }
  return { services, volumes: { sql: { name: project + '_sql' } }, networks: { secure: { name: project + '_secure' } } };
}
test('child fixtures cannot inherit merchant, SQL, mail or GitHub credentials', () => {
  const env = cleanEnvironment({}, { PATH: 'path', SQLSERVER_SA_PASSWORD: 'secret', SMTP_PASSWORD: 'secret', GITHUB_TOKEN: 'secret', VNPAY_HASH_SECRET: 'secret' });
  assert.deepEqual(env, { PATH: 'path' });
});
test('fixture credentials are fresh and only fixed audit databases are selected', () => {
  const first = fixtureEnvironment(project), second = fixtureEnvironment(project);
  assert.equal(first.SECURE_DB_NAME, 'BookGuardAuditSecure'); assert.notEqual(first.SQLSERVER_SA_PASSWORD, second.SQLSERVER_SA_PASSWORD);
  assert.throws(() => fixtureEnvironment('normal-project'));
});
test('regular databases cannot be reset through CI topology', () => {
  const config = topology(); config.services['db-init-secure'].environment.SECURE_DB_NAME = 'BookGuardSecure';
  assert.throws(() => validateCiCompose(config, project), /CI_REQUIRES_FIXED_AUDIT_DATABASES/);
});
test('regular Docker volumes and networks cannot be cleaned up by CI', () => {
  for (const field of ['volumes', 'networks']) {
    const config = topology(); Object.values(config[field])[0].name = 'normal_data';
    assert.throws(() => validateCiCompose(config, project));
  }
});
test('external mail and payment providers are rejected before startup', () => {
  for (const [key, value] of [['SMTP_HOST', 'smtp.example.com'], ['VNPAY_QUERY_ENABLED', 'true'], ['ALERT_WEBHOOK_URL', 'https://example.com']]) {
    const config = topology(); config.services['api-secure'].environment[key] = value;
    assert.throws(() => validateCiCompose(config, project));
  }
});
test('public and regular application ports are rejected', () => {
  for (const port of [{ host_ip: '0.0.0.0', published: '14002' }, { host_ip: '127.0.0.1', published: '4002' }]) {
    const config = topology(); config.services['api-secure'].ports = [port]; assert.throws(() => validateCiCompose(config, project));
  }
});
test('artifact boundary discards arbitrary secrets, errors and attachments', () => {
  const report = { passed: true, password: 'SENSITIVE', results: [{ passed: true, name: 'SENSITIVE', evidence: 'SENSITIVE', cookie: 'SENSITIVE' }] };
  assert.equal(JSON.stringify(summarize(report)).includes('SENSITIVE'), false);
  const browser = { stats: { expected: 7, unexpected: 0, skipped: 0, flaky: 0, token: 'SENSITIVE' }, errors: [], suites: [{ attachments: 'SENSITIVE' }] };
  assert.equal(JSON.stringify(summarize(browser)).includes('SENSITIVE'), false);
});
test('skipped, flaky, empty or failed suites cannot be presented as passed', () => {
  for (const stats of [{ expected: 0 }, { expected: 7 }, { expected: 7, unexpected: 0, skipped: 0, flaky: 1 }, { expected: 7, unexpected: 0, skipped: 1, flaky: 0 }]) assert.equal(summarize({ stats, errors: [] }).passed, false);
  assert.equal(summarize({ passed: true, results: [] }).passed, false);
  assert.equal(summarize({ passed: true, results: [{ passed: false }] }).passed, false);
  assert.equal(summarize({ passed: true, cleanupPassed: false, results: [{ passed: true }] }).passed, false);
});
test('stale reports fail evidence freshness checks', async () => {
  const report = await exportEvidence('sql', Date.now() + 3600000);
  assert.equal(report.passed, false); assert.equal(report.gates.integration.available, false);
  const cli = spawnSync(process.execPath, ['scripts/ci-evidence.mjs', 'sql'], { env: cleanEnvironment({ CI_STARTED_AT: new Date(Date.now() + 3600000).toISOString() }), encoding: 'utf8' });
  assert.equal(cli.status, 1, 'A stale report must fail the workflow step, not just its artifact');
  await assert.rejects(exportEvidence('../../private'));
});
