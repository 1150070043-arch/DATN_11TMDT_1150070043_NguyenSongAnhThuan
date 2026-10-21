import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import { backupContext, inside, run, withBackupLock } from './lib/backup-context.mjs';
import { createBackup } from './lib/backup-bundle.mjs';
import { offsiteAdapter, syncBackup } from './lib/backup-offsite.mjs';
import { validateProduction } from './check-production.mjs';
import { cleanEnvironment } from './lib/ci-fixture.mjs';

const project = 'bookguard-ops-drill-' + randomUUID().slice(0, 8);
const root = path.resolve('reports/operations', project); await mkdir(root, { recursive: true });
const envFile = path.join(root, 'fixture.env'), override = path.join(root, 'override.json');
const composeFile = path.resolve('deploy/docker-compose.prod.yml');
const args = ['compose', '-p', project, '--env-file', envFile, '-f', composeFile, '-f', override];
const results = [];
let started = false;
function compose(command, options) { return run('docker', [...args, ...command], { env: cleanEnvironment(fixtureEnv), ...options }); }
const fixtureEnv = {
  COMPOSE_PROJECT_NAME: project, BOOKGUARD_DOMAIN: 'localhost', ACME_EMAIL: 'fixture@example.test',
  SQLSERVER_SA_PASSWORD: 'Fixture-SA-' + randomBytes(24).toString('hex') + '!1',
  SECURE_DB_NAME: 'BookGuardProdDrill_' + randomUUID().replaceAll('-', '').slice(0, 12),
  SECURE_DB_USER: 'bookguard_prod_' + randomUUID().replaceAll('-', '').slice(0, 12),
  SECURE_DB_PASSWORD: 'Fixture-Runtime-' + randomBytes(24).toString('hex') + '!1',
  SECURE_JWT_SECRET: randomBytes(32).toString('hex'), CSRF_SECRET: randomBytes(32).toString('hex'),
  SMTP_HOST: 'mailpit', SMTP_PORT: '1025', SMTP_SECURE: 'false', MAIL_FROM_ADDRESS: 'fixture@example.test',
  INITIAL_ADMIN_EMAIL: 'operator@example.test', INITIAL_ADMIN_PASSWORD: 'Fixture-Admin-' + randomBytes(24).toString('hex') + '!1',
  ALERT_WEBHOOK_URL: '', VNPAY_QUERY_ENABLED: 'false',
  BACKUP_ROOT: `backups/${project}`, BACKUP_COMPOSE_ENV_FILE: envFile, BACKUP_COMPOSE_FILES: JSON.stringify([composeFile, override])
};
function record(name, details = {}) { results.push({ name, passed: true, ...details }); console.log('PASS ' + name); }
function request(url, { ca, headers = {}, body, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? https : http).request(url, { ca, headers, method, timeout: 5000, family: 4 }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout'))); if (body) req.write(body); req.end();
  });
}
try {
  await rm('reports/operations/production-drill.json', { force: true });
  await writeFile(envFile, Object.entries(fixtureEnv).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
  const caddyFile = path.join(root, 'Caddyfile');
  const caddyTemplate = await readFile('deploy/Caddyfile.production.example', 'utf8');
  await writeFile(caddyFile, caddyTemplate.replace('{$BOOKGUARD_DOMAIN:localhost} {', '{$BOOKGUARD_DOMAIN:localhost} {\n  tls internal'));
  await writeFile(override, JSON.stringify({ services: {
    'tls-proxy': { ports: ['127.0.0.1:18083:80', '127.0.0.1:18443:443'], volumes: [`${caddyFile.replaceAll('\\', '/')}:/etc/caddy/Caddyfile:ro`] },
    'api-secure': { environment: { WEB_ORIGIN: 'https://localhost:18443' } },
    sqlserver: { environment: { MSSQL_PID: 'Developer', MSSQL_MEMORY_LIMIT_MB: '1024' } },
    mailpit: { image: 'axllent/mailpit:v1.31.1', networks: ['secure-prod'] }
  } }, null, 2));
  // JSON Compose cannot express !override; verify and remove inherited public mappings explicitly.
  const merged = JSON.parse(compose(['--profile', 'tools', 'config', '--format', 'json']));
  merged.services['tls-proxy'].ports = [ { target: 80, published: '18083', host_ip: '127.0.0.1', protocol: 'tcp' }, { target: 443, published: '18443', host_ip: '127.0.0.1', protocol: 'tcp' } ];
  const mergedFile = path.join(root, 'resolved.json'); await writeFile(mergedFile, JSON.stringify(merged), { mode: 0o600 });
  // Resolved config contains only synthetic secrets and is removed at teardown.
  args.splice(0, args.length, 'compose', '-p', project, '-f', mergedFile);
  const topology = validateProduction(merged, { allowLocal: true });
  assert.ok(merged.services['tls-proxy'].ports.every(port => port.host_ip === '127.0.0.1'));
  record('production template validates with alerts disabled and private SQL/API/web', { schemaTarget: topology.database });
  console.log('Building isolated production API image...');
  compose(['build', 'web-secure', 'api-secure', 'db-init-secure', 'create-admin'], { timeout: 600000 });
  started = true; console.log('Starting isolated SQL, API, web and internal TLS proxy...');
  compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '180'], { timeout: 210000 });
  const context = await backupContext({ production: true, env: { ...cleanEnvironment(), ...fixtureEnv, BACKUP_COMPOSE_FILES: JSON.stringify([mergedFile]) } });
  const db = fixtureEnv.SECURE_DB_NAME;
  const before = context.query(`SELECT (SELECT COUNT(*) FROM [${db}].dbo.Users) AS users,(SELECT COUNT(*) FROM [${db}].dbo.Books) AS books,(SELECT MAX(Version) FROM [${db}].dbo.SchemaMigrations) AS schemaVersion;`)[0];
  assert.deepEqual(before, { users: 0, books: 0, schemaVersion: 8 }); record('fresh provision is schema v8 with no demo users or catalog');
  compose(['run', '--rm', '--no-deps', 'create-admin']);
  const [admin] = context.query(`SELECT COUNT(*) AS admins FROM [${db}].dbo.Users u INNER JOIN [${db}].dbo.Roles r ON r.Id=u.RoleId WHERE r.Name=N'admin' AND u.EmailVerifiedAt IS NOT NULL;`);
  assert.equal(admin.admins, 1);
  compose(['run', '--rm', '--no-deps', 'create-admin']);
  assert.equal(context.query(`SELECT COUNT(*) AS users FROM [${db}].dbo.Users;`)[0].users, 1);
  record('one-time explicit admin creation is verified and repeat-safe');
  compose(['run', '--rm', '--no-deps', 'db-init-secure']);
  assert.equal(context.query(`SELECT COUNT(*) AS users FROM [${db}].dbo.Users;`)[0].users, 1);
  record('reprovision with empty Books preserves the existing admin');
  const proxy = compose(['ps', '-q', 'tls-proxy']).trim(), caPath = path.join(root, 'root.crt');
  run('docker', ['cp', `${proxy}:/data/caddy/pki/authorities/local/root.crt`, caPath]); const ca = await readFile(caPath);
  const origin = 'https://localhost:18443';
  const health = await request(origin + '/api/health', { ca }); assert.equal(health.status, 200); assert.equal(JSON.parse(health.text).data.schemaVersion, 8);
  assert.match(health.headers['strict-transport-security'], /max-age=/); assert.equal(health.headers['x-content-type-options'], 'nosniff');
  const homepage = await request(origin + '/', { ca }); assert.equal(homepage.status, 200);
  const redirect = await request('http://localhost:18083/api/health'); assert.equal(redirect.status, 308);
  record('HTTPS chain verified with fixture CA, HSTS, frontend and HTTP redirect');
  const verifyAdmin = run('docker', ['exec', '-i', context.apiContainer, 'node', '--input-type=module'], { input: `import argon2 from 'argon2';import {getPool,closePool} from './dist/db/pool.js';const password=${JSON.stringify(fixtureEnv.INITIAL_ADMIN_PASSWORD)};try {const p=await getPool();const u=(await p.query("SELECT TOP 1 PasswordSecret,IsActive FROM dbo.Users")).recordset[0];console.log(JSON.stringify({exists:!!u,active:u?.IsActive,matches:u?await argon2.verify(u.PasswordSecret,password):false}));} finally {await closePool();}` });
  assert.deepEqual(JSON.parse(verifyAdmin.trim().split('\n').at(-1)), { exists: true, active: true, matches: true });
  const login = await request(origin + '/api/auth/login', { ca, method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: fixtureEnv.INITIAL_ADMIN_EMAIL, password: fixtureEnv.INITIAL_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200, `Login status ${login.status}, error code ${login.status !== 200 ? JSON.parse(login.text).error?.code : 'none'}`);
  const cookies = login.headers['set-cookie']; assert.ok(cookies.length > 0);
  assert.ok(cookies.every(cookie => /; Secure/i.test(cookie))); assert.ok(cookies.some(cookie => /; HttpOnly/i.test(cookie)));
  record('real admin login through TLS proxy issues Secure/HttpOnly cookies');
  const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
  const csrf = await request(origin + '/api/auth/csrf', { ca, headers: { cookie: cookieHeader } }); assert.equal(csrf.status, 200);
  const blocked = await request(origin + '/api/auth/logout', { ca, method: 'POST', headers: { cookie: cookieHeader, origin: 'https://foreign.example.test', 'x-csrf-token': JSON.parse(csrf.text).data.csrfToken } });
  assert.equal(blocked.status, 403);
  record('authenticated CSRF endpoint and foreign-origin rejection work behind proxy');
  const runtimePermissions = run('docker', ['exec', '-i', context.apiContainer, 'node', '--input-type=module'], { input: `import {getPool,closePool} from './dist/db/pool.js'; try {const p=await getPool();console.log(JSON.stringify((await p.query("SELECT IS_ROLEMEMBER('db_owner') AS owner,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS canAlter")).recordset[0]));} finally {await closePool();}` });
  const permissions = JSON.parse(runtimePermissions.trim().split('\n').at(-1)); assert.equal(permissions.owner, 0); assert.equal(permissions.canAlter, 0);
  record('production runtime uses a SQL principal without db_owner/ALTER');
  const alertFixture = run('docker', ['exec', '-i', context.apiContainer, 'node', '--input-type=module'], { input: `
    import {createServer} from 'node:http';import {createAlertDispatcher} from './dist/lib/alerting.js';
    let good=false,count=0;const server=createServer((req,res)=>{count++;res.writeHead(good?204:503);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const dispatch=createAlertDispatcher({webhookUrl:'http://127.0.0.1:'+server.address().port+'/fixture',throttleSeconds:300,maxAttempts:2,retryDelayMs:0,timeoutMs:1000},{log:()=>{}});
    const event={level:'critical',type:'FIXTURE',message:'local only'};const failed=await dispatch(event);good=true;const delivered=await dispatch(event);const throttled=await dispatch(event);await new Promise(r=>server.close(r));
    console.log(JSON.stringify({failed:failed.status,delivered:delivered.status,throttled:throttled.status,count}));` });
  assert.deepEqual(JSON.parse(alertFixture.trim().split('\n').at(-1)), { failed: 'failed', delivered: 'delivered', throttled: 'throttled', count: 3 });
  record('Docker alert provider fixture verifies failure, retry and success-only cooldown');
  // Synthetic upload ensures the recovery drill exercises actual file content.
  run('docker', ['exec', '-i', context.apiContainer, 'node', '--input-type=module'], { input: `import {writeFile} from 'node:fs/promises';await writeFile('/app/uploads/ops-fixture.bin','synthetic-production-upload');` });
  const receipt = await withBackupLock(context.root, async () => {
    const backup = await createBackup(context);
    const adapter = offsiteAdapter({ BACKUP_ALLOW_LOCAL_OFFSITE: 'true', BACKUP_OFFSITE_TEST_DIR: path.join(root, 'remote-fixture') });
    return syncBackup(context, backup, adapter);
  });
  assert.equal(receipt.status, 'simulated_verified'); assert.equal(receipt.databaseProbes.length, 1); assert.equal(receipt.uploadsRestored, 1);
  record('production topology backup and downloaded restore/DBCC/uploads drill', { offsiteStatus: receipt.status, backupId: receipt.id });
  const ps = compose(['ps', '--format', 'json']).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(ps.filter(service => ['api-secure', 'web-secure', 'sqlserver'].includes(service.Service)).every(service => service.Health === 'healthy'));
  record('isolated production services remain healthy after recovery drills');
  await writeFile('reports/operations/production-drill.json', JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, scope: 'Isolated production Compose project, loopback HTTPS with internal CA, Mailpit and local offsite simulator; no public deployment/provider transaction', results }, null, 2));
} catch (error) {
  // Assertion metadata is safe; provider/Docker error strings can include secrets.
  console.error(JSON.stringify({ passed: false, code: error.code || 'PRODUCTION_DRILL_FAILED', assertion: error.code === 'ERR_ASSERTION' ? error.message : undefined, site: error.stack?.split('\n').slice(1, 3), completed: results.length }));
  process.exitCode = 1;
} finally {
  try {
    if (started) {
      assert.match(project, /^bookguard-ops-drill-[a-f0-9]{8}$/);
      // Only volumes belonging to this generated, isolated project are removed.
      compose(['down', '--volumes', '--remove-orphans'], { timeout: 120000 });
    }
  } catch {
    console.error('Production fixture cleanup failed.'); process.exitCode = 1;
  } finally {
    for (const file of [envFile, path.join(root, 'resolved.json')]) await rm(inside(root, file), { force: true });
    if (process.exitCode) await writeFile('reports/operations/production-drill.json', JSON.stringify({ generatedAt: new Date().toISOString(), passed: false, results }, null, 2));
  }
}
