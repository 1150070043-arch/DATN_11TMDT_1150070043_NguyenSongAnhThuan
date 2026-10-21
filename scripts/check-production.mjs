import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, OperationError } from './lib/backup-context.mjs';
import { offsiteAdapter } from './lib/backup-offsite.mjs';

export function validateProduction(compose, { allowLocal = false } = {}) {
  const services = compose.services;
  if (Object.keys(services).some(name => name.includes('baseline'))) throw new OperationError('PRODUCTION_MUST_NOT_INCLUDE_BASELINE');
  for (const service of ['sqlserver', 'api-secure', 'web-secure', 'db-init-secure', 'create-admin']) if (services[service].ports?.length) throw new OperationError('PRIVATE_SERVICE_HAS_PUBLISHED_PORT');
  const runtime = services['api-secure'].environment, init = services['db-init-secure'];
  if (JSON.stringify(init.command) !== JSON.stringify(['node', 'dist/db/cli.js', 'init', 'secure']) || init.environment.DB_PROVISION_MODE !== 'production') throw new OperationError('INVALID_PRODUCTION_PROVISIONING');
  if (runtime.SECURITY_MODE !== 'secure' || String(runtime.COOKIE_SECURE) !== 'true' || Number(runtime.TRUST_PROXY_HOPS) !== 1 || !runtime.WEB_ORIGIN.startsWith('https://')) throw new OperationError('INVALID_PROXY_COOKIE_CONFIGURATION');
  if (runtime.DB_NAME !== init.environment.SECURE_DB_NAME || runtime.DB_USER !== init.environment.SECURE_DB_USER || runtime.DB_PASSWORD !== init.environment.SECURE_DB_PASSWORD) throw new OperationError('PROVISION_RUNTIME_DATABASE_MISMATCH');
  for (const value of [runtime.JWT_SECRET, runtime.CSRF_SECRET, runtime.DB_PASSWORD, services.sqlserver.environment.MSSQL_SA_PASSWORD]) {
    if (!value || /ChangeThis|replace_with|your[_-]/i.test(value)) throw new OperationError('REPLACE_PRODUCTION_PLACEHOLDER_SECRETS');
  }
  if (!allowLocal) {
    const hostname = new URL(runtime.WEB_ORIGIN).hostname;
    if (['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.localhost') || hostname.includes('yourdomain')) throw new OperationError('SET_PUBLIC_DOMAIN');
    if (String(runtime.SMTP_SECURE) !== 'true') throw new OperationError('PRODUCTION_SMTP_REQUIRES_DIRECT_TLS');
  }
  if (!['VNPAY_QUERY_ENABLED', 'VNPAY_QUERY_URL', 'VNPAY_QUERY_TIMEOUT_MS', 'VNPAY_QUERY_IP_ADDRESS'].every(key => key in runtime)) throw new OperationError('INCOMPLETE_VNPAY_QUERY_CONFIGURATION');
  const configTest = spawnSync(process.execPath, ['--input-type=module', '-e', `import {config} from ${JSON.stringify(new URL('../apps/api/dist/config.js', import.meta.url).href)}; console.log(JSON.stringify({mode:config.mode,cookieSecure:config.cookieSecure}));`],
    { env: Object.fromEntries(Object.entries(runtime).map(([key, value]) => [key, String(value)])), encoding: 'utf8' });
  if (configTest.status !== 0) throw new OperationError('PRODUCTION_RUNTIME_VALIDATION_FAILED');
  return { passed: true, mode: 'secure', database: runtime.DB_NAME, publicPorts: (services['tls-proxy'].ports || []).map(port => port.published), demoSeed: false,
    alertsConfigured: Boolean(runtime.ALERT_WEBHOOK_URL || runtime.ALERT_TELEGRAM_BOT_TOKEN), vnpayConfigured: Boolean(runtime.VNPAY_TMN_CODE && runtime.VNPAY_HASH_SECRET) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const files = process.env.BACKUP_COMPOSE_FILES ? JSON.parse(process.env.BACKUP_COMPOSE_FILES) : ['deploy/docker-compose.prod.yml'];
    const args = ['compose', '--env-file', process.env.BACKUP_COMPOSE_ENV_FILE || '.env.production'];
    for (const file of files) args.push('-f', file);
    const compose = JSON.parse(run('docker', [...args, '--profile', 'tools', 'config', '--format', 'json']));
    const result = validateProduction(compose);
    let offsiteConfigured = false;
    try { offsiteConfigured = !offsiteAdapter().simulated; } catch (error) { if (error.code !== 'OFFSITE_NOT_CONFIGURED') throw error; }
    console.log(JSON.stringify({ ...result, offsiteConfigured, scope: 'Configuration validation only; no deployment/network/provider test' }));
  } catch (error) { console.error(JSON.stringify({ passed: false, code: error.code || 'PRODUCTION_CHECK_FAILED' })); process.exitCode = 1; }
}
