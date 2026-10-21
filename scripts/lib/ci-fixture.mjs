import { randomBytes } from 'node:crypto';
import { OperationError } from './backup-context.mjs';

export function cleanEnvironment(extra = {}, source = process.env) {
  const allowed = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
    'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'ComSpec',
    'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_CERT_PATH', 'DOCKER_TLS_VERIFY', 'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'LANG', 'LC_ALL', 'TERM'];
  return { ...Object.fromEntries(allowed.filter(key => source[key] !== undefined).map(key => [key, source[key]])), ...extra };
}
export function fixtureEnvironment(project) {
  if (!/^bookguard-ci-[a-f0-9]{8}$/.test(project)) throw new OperationError('INVALID_CI_PROJECT');
  return { COMPOSE_PROJECT_NAME: project, SQLSERVER_HOST: 'localhost', SQLSERVER_PORT: '13433', SQLSERVER_SA_USER: 'sa',
    SQLSERVER_SA_PASSWORD: 'Ci-SA-' + randomBytes(24).toString('hex') + '!1',
    BASELINE_DB_NAME: 'BookGuardAuditBaseline', SECURE_DB_NAME: 'BookGuardAuditSecure', BASELINE_DB_USER: 'bookguard_audit_baseline', SECURE_DB_USER: 'bookguard_audit_secure',
    BASELINE_DB_PASSWORD: 'Ci-Baseline-' + randomBytes(24).toString('hex') + '!1', SECURE_DB_PASSWORD: 'Ci-Secure-' + randomBytes(24).toString('hex') + '!1',
    BASELINE_JWT_SECRET: randomBytes(32).toString('hex'), SECURE_JWT_SECRET: randomBytes(32).toString('hex'), CSRF_SECRET: randomBytes(32).toString('hex'),
    COOKIE_SECURE: 'false', TRUST_PROXY_HOPS: '0', WEB_ORIGIN: 'http://localhost:15174', SECURE_WEB_ORIGIN: 'http://localhost:15174', BASELINE_WEB_ORIGIN: 'http://localhost:15173',
    SECURITY_MODE: 'secure', NODE_ENV: 'test', BASELINE_URL: 'http://localhost:14001', SECURE_URL: 'http://localhost:14002', SECURE_WEB_URL: 'http://localhost:15174',
    E2E_BASE_URL: 'http://localhost:15174', E2E_API_URL: 'http://localhost:14002', TEST_SMTP_PORT: '11025',
    SMTP_HOST: 'localhost', SMTP_PORT: '11025', SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASSWORD: '', MAIL_FROM_ADDRESS: 'fixture@bookguard.local',
    DOCKER_SMTP_HOST: 'mailpit', DOCKER_SMTP_PORT: '1025', DOCKER_SMTP_SECURE: 'false', DOCKER_SMTP_USER: '', DOCKER_SMTP_PASSWORD: '',
    VNPAY_TMN_CODE: 'AUDITONLY', VNPAY_HASH_SECRET: 'audit-fixture-key-not-a-real-merchant', VNPAY_QUERY_ENABLED: 'false',
    ALERT_WEBHOOK_URL: '', ALERT_TELEGRAM_BOT_TOKEN: '', ALERT_TELEGRAM_CHAT_ID: '', AUTH_CLEANUP_ENABLED: 'false', STOCK_HOLD_ENABLED: 'true' };
}
export function validateCiCompose(compose, project) {
  if (!/^bookguard-ci-[a-f0-9]{8}$/.test(project)) throw new OperationError('INVALID_CI_PROJECT');
  for (const mode of ['baseline', 'secure']) {
    const prefix = mode === 'secure' ? 'SECURE' : 'BASELINE', database = mode === 'secure' ? 'BookGuardAuditSecure' : 'BookGuardAuditBaseline';
    if (compose.services[`api-${mode}`].environment.DB_NAME !== database || compose.services[`db-init-${mode}`].environment[`${prefix}_DB_NAME`] !== database) throw new OperationError('CI_REQUIRES_FIXED_AUDIT_DATABASES');
    if (compose.services[`db-init-${mode}`].environment.ALLOW_INSECURE_LAB !== 'true' || compose.services[`db-init-${mode}`].environment.DB_PROVISION_MODE !== 'lab') throw new OperationError('CI_REQUIRES_LAB_PROVISIONING');
    if (compose.services[`api-${mode}`].environment.ALERT_WEBHOOK_URL || compose.services[`api-${mode}`].environment.ALERT_TELEGRAM_BOT_TOKEN) throw new OperationError('CI_EXTERNAL_ALERT_FORBIDDEN');
    const api = compose.services[`api-${mode}`].environment;
    if (api.DB_USER !== `bookguard_audit_${mode}` || api.SQLSERVER_HOST !== 'sqlserver') throw new OperationError('CI_REQUIRES_AUDIT_PRINCIPAL');
    if (api.SMTP_HOST !== (mode === 'secure' ? 'mailpit' : 'mailpit-baseline') || api.SMTP_USER || api.SMTP_PASSWORD) throw new OperationError('CI_EXTERNAL_SMTP_FORBIDDEN');
    if (api.VNPAY_QUERY_ENABLED !== 'false' || api.VNPAY_TMN_CODE !== 'AUDITONLY' || api.PAYOS_API_KEY) throw new OperationError('CI_EXTERNAL_PAYMENTS_FORBIDDEN');
    const reports = compose.services[`api-${mode}`].volumes.find(volume => volume.target === '/app/reports/generated');
    if (!reports?.read_only) throw new OperationError('CI_REPORTS_MUST_BE_READ_ONLY');
  }
  for (const volume of Object.values(compose.volumes)) if (volume.external || !volume.name?.startsWith(project + '_')) throw new OperationError('CI_REQUIRES_OWN_VOLUMES');
  for (const network of Object.values(compose.networks)) if (network.external || !network.name?.startsWith(project + '_')) throw new OperationError('CI_REQUIRES_OWN_NETWORKS');
  for (const service of Object.values(compose.services)) for (const port of service.ports || []) {
    if (port.host_ip !== '127.0.0.1' || Number(port.published) < 10000) throw new OperationError('CI_REQUIRES_ISOLATED_LOOPBACK_PORTS');
  }
}
