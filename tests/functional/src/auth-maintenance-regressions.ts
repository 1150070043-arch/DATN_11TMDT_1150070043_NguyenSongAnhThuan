import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import sql from 'mssql';
import { cleanupAuthBatch, previewAuthCleanup, AUTH_CLEANUP_LOCK } from '../../../apps/api/src/lib/auth-cleanup.js';
import { runMigrations } from '../../../apps/api/src/db/migrations.js';
import { ResettingConnectionPool } from '../../../apps/api/src/db/resetting-pool.js';
import { HttpSession } from '../../security/src/http-session.js';

const results: Array<{ mode: string; name: string; passed: boolean }> = [];
const policy = { retentionDays: 7, batchSize: 1 };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fixtureHash = () => hash(randomUUID());
function connection(database: string, user: string, password: string | undefined): sql.config {
  return { server: 'localhost', port: Number(process.env.SQLSERVER_PORT || 1433), database, user, password,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true } };
}

async function run(mode: 'baseline' | 'secure') {
  // Names are fixed and every API must advertise auditFixture before any mutation.
  const database = mode === 'secure' ? 'BookGuardAuditSecure' : 'BookGuardAuditBaseline';
  const base = mode === 'secure' ? process.env.SECURE_URL ?? 'http://localhost:4002' : process.env.BASELINE_URL ?? 'http://localhost:4001';
  const session = new HttpSession(base);
  const health = await session.request('/api/health');
  assert.equal(health.status, 200);
  assert.equal((health.body as { data: { auditFixture: boolean } }).data.auditFixture, true, 'Refusing to mutate a regular API');
  const admin = await new sql.ConnectionPool(connection(database, process.env.SQLSERVER_SA_USER || 'sa', process.env.SQLSERVER_SA_PASSWORD)).connect();
  const runtime = await new ResettingConnectionPool(connection(database, mode === 'secure' ? 'bookguard_audit_secure' : 'bookguard_audit_baseline', mode === 'secure' ? process.env.SECURE_DB_PASSWORD : process.env.BASELINE_DB_PASSWORD)).connect();
  let userId: number | undefined;
  async function step(name: string, action: () => Promise<void>) {
    try { await action(); results.push({ mode, name, passed: true }); console.log(`PASS ${mode}: ${name}`); }
    catch (error) { results.push({ mode, name, passed: false }); console.error(`FAIL ${mode}: ${name}`); throw error; }
  }
  async function counts() {
    return (await admin.request().input('user', sql.Int, userId).query(`
      SELECT (SELECT COUNT(*) FROM dbo.UserSessions WHERE UserId=@user) AS sessions,
        (SELECT COUNT(*) FROM dbo.RefreshTokens WHERE UserId=@user) AS refreshTokens,
        (SELECT COUNT(*) FROM dbo.PasswordResetTokens WHERE UserId=@user) AS resetTokens,
        (SELECT COUNT(*) FROM dbo.EmailVerificationTokens WHERE UserId=@user) AS verifyTokens;
    `)).recordset[0];
  }
  async function addSession(expiresDays: number, revokedDays: number | null) {
    const id = randomUUID();
    await admin.request().input('id', sql.UniqueIdentifier, id).input('user', sql.Int, userId)
      .input('expires', sql.Int, expiresDays).input('revoked', sql.Int, revokedDays).query(`
        INSERT dbo.UserSessions(SessionId,UserId,CreatedAt,ExpiresAt,RevokedAt)
        VALUES(@id,@user,DATEADD(DAY,-60,SYSUTCDATETIME()),DATEADD(DAY,@expires,SYSUTCDATETIME()),
          CASE WHEN @revoked IS NULL THEN NULL ELSE DATEADD(DAY,@revoked,SYSUTCDATETIME()) END);
      `);
    return id;
  }
  async function addRefresh(id: string, revokedDays: number | null = null) {
    await admin.request().input('id', sql.UniqueIdentifier, id).input('user', sql.Int, userId).input('hash', sql.Char(64), fixtureHash())
      .input('revoked', sql.Int, revokedDays).query(`
        INSERT dbo.RefreshTokens(UserId,SessionId,TokenHash,ExpiresAt,RevokedAt)
        VALUES(@user,@id,@hash,DATEADD(DAY,2,SYSUTCDATETIME()),
          CASE WHEN @revoked IS NULL THEN NULL ELSE DATEADD(DAY,@revoked,SYSUTCDATETIME()) END);
      `);
  }
  try {
    await step('migrations through v8 are idempotent and cleanup/session ordering indexes exist', async () => {
      assert.deepEqual(await runMigrations(admin), []);
      const indexes = await admin.query("SELECT COUNT(*) AS total FROM sys.indexes WHERE name IN ('IX_UserSessions_Cleanup','IX_PasswordResetTokens_Cleanup','IX_EmailVerificationTokens_Cleanup');");
      assert.equal(indexes.recordset[0]?.total, 3);
      assert.equal((await admin.query("SELECT COLUMNPROPERTY(OBJECT_ID('dbo.UserSessions'),'IssuedOrder','IsIdentity') AS ordered;")).recordset[0]?.ordered, 1);
    });
    const email = `maintenance-${randomUUID()}@example.test`;
    userId = (await admin.request().input('email', sql.NVarChar(255), email).query(`
      INSERT dbo.Users(Email,PasswordSecret,FullName,RoleId,EmailVerifiedAt)
      OUTPUT INSERTED.Id SELECT @email,PasswordSecret,N'Auth maintenance fixture',RoleId,SYSUTCDATETIME()
      FROM dbo.Users WHERE Email=N'customer.a@bookguard.local';
    `)).recordset[0]?.Id;
    assert.ok(userId);
    await session.login(email, 'Customer@123');
    let replayCookie: string | undefined;
    if (mode === 'secure') {
      replayCookie = session.cookie('bg_secure_refresh'); assert.ok(replayCookie);
      assert.equal((await session.request('/api/auth/refresh', { method: 'POST' })).status, 200);
      await admin.request().input('hash', sql.Char(64), hash(replayCookie)).query('UPDATE dbo.RefreshTokens SET RevokedAt=DATEADD(DAY,-30,SYSUTCDATETIME()) WHERE TokenHash=@hash;');
    }
    const expiredOld = await addSession(-8, null), revokedOld = await addSession(2, -8);
    const expiredRecent = await addSession(-2, null), revokedRecent = await addSession(2, -2), live = await addSession(2, null);
    // More child tokens than the batch size exercises FK-safe progress across batches.
    for (const id of [expiredOld, expiredOld, expiredOld, revokedOld, expiredRecent, revokedRecent]) await addRefresh(id);
    await addRefresh(live, -30);
    for (const table of ['PasswordResetTokens', 'EmailVerificationTokens']) {
      for (const [expires, used] of [[-8, null], [2, -8], [-2, null], [2, -2], [2, null]]) {
        await admin.request().input('user', sql.Int, userId).input('hash', sql.Char(64), fixtureHash())
          .input('expires', sql.Int, expires).input('used', sql.Int, used).query(`
            INSERT dbo.${table}(UserId,TokenHash,ExpiresAt,UsedAt)
            VALUES(@user,@hash,DATEADD(DAY,@expires,SYSUTCDATETIME()),
              CASE WHEN @used IS NULL THEN NULL ELSE DATEADD(DAY,@used,SYSUTCDATETIME()) END);
          `);
      }
    }
    await step('dry run counts candidates without mutating any fixture', async () => {
      const before = await counts();
      const preview = await previewAuthCleanup(runtime, policy);
      for (const count of Object.values(preview)) assert.equal(typeof count, 'number');
      assert.ok(preview.sessions >= 2 && preview.refreshTokens >= 4 && preview.passwordResetTokens >= 2 && preview.emailVerificationTokens >= 2);
      assert.deepEqual(await counts(), before);
    });
    await step('a second runner skips within one twin while the other twin remains independent', async () => {
      const held = new sql.Transaction(admin); await held.begin();
      try {
        await held.request().input('resource', sql.NVarChar(255), AUTH_CLEANUP_LOCK).query(`EXEC sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;`);
        const before = await counts();
        const result = await cleanupAuthBatch(runtime, policy);
        assert.equal(result.skipped, true); assert.deepEqual(await counts(), before);
        const otherMode = mode === 'secure' ? 'baseline' : 'secure';
        const other = await new ResettingConnectionPool(connection(otherMode === 'secure' ? 'BookGuardAuditSecure' : 'BookGuardAuditBaseline',
          otherMode === 'secure' ? 'bookguard_audit_secure' : 'bookguard_audit_baseline', otherMode === 'secure' ? process.env.SECURE_DB_PASSWORD : process.env.BASELINE_DB_PASSWORD)).connect();
        try { assert.equal((await cleanupAuthBatch(other, policy)).skipped, false); } finally { await other.close(); }
      } finally { await held.rollback(); }
    });
    await step('a failure rolls back the entire batch and releases its lock', async () => {
      const before = await counts();
      const eligible = await previewAuthCleanup(runtime, policy);
      await admin.query(`CREATE TRIGGER dbo.AuthCleanupRollbackProbe ON dbo.EmailVerificationTokens AFTER DELETE AS BEGIN THROW 51000, 'Auth cleanup rollback fixture', 1; END;`);
      try {
        await assert.rejects(cleanupAuthBatch(runtime, policy), /Auth cleanup rollback fixture/);
        assert.deepEqual(await counts(), before);
        assert.deepEqual(await previewAuthCleanup(runtime, policy), eligible);
      } finally { await admin.query('DROP TRIGGER dbo.AuthCleanupRollbackProbe;'); }
    });
    await step('bounded batches delete dead sessions and children, preserving active and recent records', async () => {
      let complete = false;
      for (let i = 0; i < 100; i++) {
        const result = await cleanupAuthBatch(runtime, policy);
        assert.equal(result.skipped, false);
        for (const [key, count] of Object.entries(result)) if (key !== 'skipped') assert.ok(Number(count) >= 0 && Number(count) <= 1);
        const remaining = await previewAuthCleanup(runtime, policy);
        if (Object.values(remaining).every(count => Number(count) === 0)) { complete = true; break; }
      }
      assert.equal(complete, true);
      const remaining = await counts();
      assert.equal(remaining.sessions, 4); // API login + expired recent + revoked recent + live fixture.
      assert.equal(remaining.resetTokens, 3); assert.equal(remaining.verifyTokens, 3);
      assert.equal(remaining.refreshTokens, mode === 'secure' ? 5 : 3);
      assert.equal((await session.request('/api/auth/me')).status, 200);
      if (mode === 'secure') assert.equal((await session.request('/api/auth/refresh', { method: 'POST' })).status, 200);
    });
    if (mode === 'secure') await step('parallel cleanup runners leave a simultaneous live refresh usable', async () => {
      const [refresh, ...cleanups] = await Promise.all([
        session.request('/api/auth/refresh', { method: 'POST' }),
        ...Array.from({ length: 4 }, () => cleanupAuthBatch(runtime, policy))
      ]);
      assert.equal((refresh as { status: number }).status, 200);
      assert.ok(cleanups.some(result => !(result as { skipped: boolean }).skipped));
      assert.equal((await session.request('/api/auth/me')).status, 200);
    });
    if (mode === 'secure') await step('old rotated-token replay still revokes the live session after cleanup', async () => {
      session.setCookie('bg_secure_refresh', replayCookie!);
      assert.equal((await session.request('/api/auth/refresh', { method: 'POST' })).status, 401);
      assert.equal((await session.request('/api/auth/me')).status, 401);
    });
    if (mode === 'secure') await step('sessions with identical creation timestamps retain exactly the last ten issued', async () => {
      const fixed = (await admin.query('SELECT DATEADD(DAY,1,SYSUTCDATETIME()) AS stamp;')).recordset[0]!.stamp;
      const issued: HttpSession[] = [];
      for (let i = 0; i < 12; i++) {
        const client = new HttpSession(base); await client.login(email, 'Customer@123'); issued.push(client);
        await admin.request().input('hash', sql.Char(64), hash(client.cookie('bg_secure_refresh')!)).input('stamp', sql.DateTime2, fixed)
          .query('UPDATE s SET CreatedAt=@stamp FROM dbo.UserSessions s INNER JOIN dbo.RefreshTokens rt ON rt.SessionId=s.SessionId WHERE rt.TokenHash=@hash;');
      }
      const stamps = await admin.request().input('user', sql.Int, userId).input('stamp', sql.DateTime2, fixed)
        .query('SELECT COUNT(*) AS total FROM dbo.UserSessions WHERE UserId=@user AND CreatedAt=CAST(@stamp AS DATETIME2(0));');
      assert.equal(stamps.recordset[0]?.total, 12);
      for (let i = 0; i < issued.length; i++) assert.equal((await issued[i]!.request('/api/auth/me')).status, i < 2 ? 401 : 200);
    });
  } finally {
    if (userId) await admin.request().input('user', sql.Int, userId).query(`
      DELETE dbo.RefreshTokens WHERE UserId=@user; DELETE dbo.UserSessions WHERE UserId=@user;
      DELETE dbo.PasswordResetTokens WHERE UserId=@user; DELETE dbo.EmailVerificationTokens WHERE UserId=@user;
      DELETE dbo.SecurityEvents WHERE UserId=@user; DELETE dbo.Users WHERE Id=@user;
    `);
    await runtime.close(); await admin.close();
  }
}

try { await run('baseline'); await run('secure'); }
catch { console.error('Auth maintenance SQL regression failed; see the last named check. No credentials are printed.'); process.exitCode = 1; }
const report = { generatedAt: new Date().toISOString(), fixture: 'Isolated audit SQL and real auth API; no regular database mutation', passed: results.length === 13 && results.every(row => row.passed), results };
await mkdir('../../reports/auth-maintenance', { recursive: true });
await writeFile('../../reports/auth-maintenance/sql-regressions.json', JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
