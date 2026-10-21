import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bundleFiles, checksum, pruneVerifiedBackups, verifyBundle } from './lib/backup-bundle.mjs';
import { inside, withBackupLock } from './lib/backup-context.mjs';
import { offsiteAdapter, syncBackup } from './lib/backup-offsite.mjs';
import { validateProduction } from './check-production.mjs';

await mkdir('reports/operations', { recursive: true });
test('production gate catches exposed SQL, database mismatch and placeholders; alert disabled/enabled both validate', () => {
  const runtime = { NODE_ENV: 'production', SECURITY_MODE: 'secure', COOKIE_SECURE: 'true', TRUST_PROXY_HOPS: '1', WEB_ORIGIN: 'https://shop.example.test',
    DB_NAME: 'FixtureSecure', DB_USER: 'fixture_secure', DB_PASSWORD: 'Synthetic-Runtime-123!', JWT_SECRET: 'synthetic-jwt-secret-at-least-32characters', CSRF_SECRET: 'synthetic-csrf-secret-distinct-and32characters',
    SMTP_SECURE: 'true', ALERT_WEBHOOK_URL: '', VNPAY_QUERY_ENABLED: 'false', VNPAY_QUERY_URL: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction', VNPAY_QUERY_TIMEOUT_MS: '8000', VNPAY_QUERY_IP_ADDRESS: '' };
  const config = { services: { 'api-secure': { environment: runtime }, sqlserver: { environment: { MSSQL_SA_PASSWORD: 'Synthetic-SA-123!' } }, 'web-secure': {},
    'tls-proxy': { ports: [{ published: '80' }, { published: '443' }] }, 'create-admin': {},
    'db-init-secure': { command: ['node', 'dist/db/cli.js', 'init', 'secure'], environment: { DB_PROVISION_MODE: 'production', SECURE_DB_NAME: 'FixtureSecure', SECURE_DB_USER: 'fixture_secure', SECURE_DB_PASSWORD: 'Synthetic-Runtime-123!' } } } };
  assert.equal(validateProduction(config).alertsConfigured, false);
  runtime.ALERT_WEBHOOK_URL = 'https://alerts.example.test/fixture'; assert.equal(validateProduction(config).alertsConfigured, true);
  config.services.sqlserver.ports = [{ published: '1433' }]; assert.throws(() => validateProduction(config), /PRIVATE_SERVICE/); delete config.services.sqlserver.ports;
  runtime.DB_NAME = 'WrongSecure'; assert.throws(() => validateProduction(config), /DATABASE_MISMATCH/); runtime.DB_NAME = 'FixtureSecure';
  runtime.DB_PASSWORD = 'ChangeThis_Password'; config.services['db-init-secure'].environment.SECURE_DB_PASSWORD = runtime.DB_PASSWORD;
  assert.throws(() => validateProduction(config), /PLACEHOLDER_SECRETS/);
});
async function fixture(operation) {
  const root = await mkdtemp(path.resolve('reports/operations/unit-'));
  try {
    const id = '20261012T120000000Z-' + 'a'.repeat(32), directory = path.join(root, id);
    await mkdir(path.join(directory, 'uploads', 'secure'), { recursive: true });
    await writeFile(path.join(directory, 'FixtureSecure.bak'), 'synthetic-sql-backup');
    await writeFile(path.join(directory, 'uploads', 'secure', 'cover.bin'), 'synthetic-upload');
    const manifest = { version: 2, id, createdAt: new Date().toISOString(), databases: [{ database: 'FixtureSecure', backupFile: 'FixtureSecure.bak' }], files: await bundleFiles(directory) };
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    await operation({ root, directory, manifest });
  } finally { await rm(inside(path.resolve('reports/operations'), root), { recursive: true, force: true }); }
}
test('backup locks reject overlapping jobs and are released on failure', async () => fixture(async ({ root }) => {
  await withBackupLock(root, async () => { await assert.rejects(withBackupLock(root, async () => {}), /BACKUP_ALREADY_RUNNING/); });
  await assert.rejects(withBackupLock(root, async () => { throw new Error('fixture'); }), /fixture/);
  await withBackupLock(root, async () => {});
}));
test('bundle checksum verifies both SQL and recovered uploads; corruption and traversal fail before restore', async () => fixture(async ({ root, directory }) => {
  const result = await verifyBundle(directory, { root }, { restore: false }); assert.equal(result.uploadsRestored, 1);
  await writeFile(path.join(directory, 'uploads', 'secure', 'cover.bin'), 'corrupted');
  await assert.rejects(verifyBundle(directory, { root }, { restore: false }), /BACKUP_CHECKSUM_MISMATCH/);
  assert.throws(() => inside(root, path.resolve(root, '..', 'outside')), /UNSAFE_BACKUP_PATH/);
}));
test('missing remote, old shell commands and unpaired upload/download configuration fail', () => {
  assert.throws(() => offsiteAdapter({}), /OFFSITE_NOT_CONFIGURED/);
  assert.throws(() => offsiteAdapter({ BACKUP_OFFSITE_CMD: 'never execute this' }), /USE_STRUCTURED/);
  assert.throws(() => offsiteAdapter({ BACKUP_OFFSITE_UPLOAD_ARGS: '["rclone","copy","%DIR%","remote:%STAMP%"]' }), /SET_PAIRED/);
  assert.throws(() => offsiteAdapter({ BACKUP_OFFSITE_TEST_DIR: 'reports/operations' }), /LOCAL_OFFSITE_FIXTURE/);
});
test('S3 failure propagates and commands use argument arrays without leaking credentials', async () => {
  let received;
  const adapter = offsiteAdapter({ BACKUP_OFFSITE_S3_BUCKET: 'fixture-bucket', BACKUP_OFFSITE_S3_ENDPOINT: 'https://storage.example.test' }, (command, args) => { received = { command, args }; throw new Error('fixture CLI failed'); });
  await assert.rejects(adapter.upload('folder with spaces', 'fixture'), /fixture CLI failed/);
  assert.equal(received.command, 'aws'); assert.ok(received.args.includes('folder with spaces')); assert.equal(received.args.includes('--delete'), false);
});
test('upload sees the sealed manifest; remote download is checked and simulated receipts never permit retention', async () => fixture(async ({ root, directory, manifest }) => {
  const adapter = offsiteAdapter({ BACKUP_ALLOW_LOCAL_OFFSITE: 'true', BACKUP_OFFSITE_TEST_DIR: path.join(root, 'remote') });
  const result = await syncBackup({ root }, { directory, manifest }, adapter, { prune: true, verify: (dir, context) => verifyBundle(dir, context, { restore: false }) });
  assert.equal(result.status, 'simulated_verified'); assert.equal(result.pruned, 0);
  const uploaded = JSON.parse(await readFile(path.join(root, 'remote', manifest.id, 'manifest.json'), 'utf8'));
  assert.deepEqual(uploaded.files, manifest.files);
}));
test('upload failure retains every local backup and writes no verified receipt', async () => fixture(async ({ root, directory, manifest }) => {
  const adapter = { simulated: false, upload: async () => { throw new Error('failed upload'); }, download: async () => assert.fail('download must not run') };
  await assert.rejects(syncBackup({ root }, { directory, manifest }, adapter, { prune: true, verify: (dir, context) => verifyBundle(dir, context, { restore: false }) }), /failed upload/);
  assert.ok(await readFile(path.join(directory, 'manifest.json')));
  await assert.rejects(readFile(path.join(root, manifest.id + '.remote.json')), error => error.code === 'ENOENT');
}));
test('tampered downloaded data cannot be reported as verified or trigger pruning', async () => fixture(async ({ root, directory, manifest }) => {
  const adapter = { simulated: false, upload: async () => {}, download: async dest => { await cp(directory, dest, { recursive: true }); await writeFile(path.join(dest, 'FixtureSecure.bak'), 'tampered'); } };
  await assert.rejects(syncBackup({ root }, { directory, manifest }, adapter, { prune: true, verify: (dir, context) => verifyBundle(dir, context, { restore: false }) }), /BACKUP_CHECKSUM_MISMATCH/);
  await assert.rejects(readFile(path.join(root, manifest.id + '.remote.json')), error => error.code === 'ENOENT');
}));
test('retention keeps unverified/legacy folders and the two newest verified bundles', async () => fixture(async ({ root }) => {
  const ids = [];
  for (let index = 0; index < 4; index++) {
    const id = `2020010${index + 1}T120000000Z-${String(index).repeat(32)}`, dir = path.join(root, id); ids.push(id);
    await mkdir(dir); await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ id, createdAt: `2020-01-0${index + 1}T12:00:00Z` }));
    if (index > 0) await writeFile(path.join(root, id + '.remote.json'), JSON.stringify({ status: 'remote_verified', manifestSha256: await checksum(path.join(dir, 'manifest.json')) }));
  }
  const removed = await pruneVerifiedBackups(root, 7, 'current'); assert.deepEqual(removed, [ids[1]]);
  await readFile(path.join(root, ids[0], 'manifest.json')); await readFile(path.join(root, ids[2], 'manifest.json')); await readFile(path.join(root, ids[3], 'manifest.json'));
  await assert.rejects(pruneVerifiedBackups(root, NaN, 'current'), /INVALID_RETENTION/);
}));
