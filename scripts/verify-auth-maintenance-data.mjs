import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sql from 'mssql';
import { previewAuthCleanup } from '../apps/api/dist/lib/auth-cleanup.js';

if (process.argv.slice(2).some(arg => !['--after', '--security-hardening', '--payments', '--cart-recovery', '--stock-holds', '--operations', '--ci'].includes(arg))) throw new Error('Usage: verify-auth-maintenance-data.mjs [--after] [--security-hardening|--payments|--cart-recovery|--stock-holds|--operations|--ci]');
const after = process.argv.includes('--after');
const snapshots = [];
for (const database of ['BookGuardBaseline', 'BookGuardSecure']) {
  const pool = await new sql.ConnectionPool({ server: 'localhost', port: Number(process.env.SQLSERVER_PORT || 1433), database,
    user: process.env.SQLSERVER_SA_USER || 'sa', password: process.env.SQLSERVER_SA_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true } }).connect();
  try {
    const groups = {};
    for (const [name, query] of Object.entries({
      activeSessions: 'SELECT SessionId,UserId,CreatedAt,ExpiresAt,RevokedAt,IssuedOrder FROM dbo.UserSessions WHERE RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() ORDER BY SessionId;',
      liveSessionRefreshTokens: 'SELECT rt.* FROM dbo.RefreshTokens rt INNER JOIN dbo.UserSessions s ON s.SessionId=rt.SessionId WHERE s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() ORDER BY rt.Id;',
      activePasswordResetTokens: 'SELECT * FROM dbo.PasswordResetTokens WHERE UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() ORDER BY Id;',
      activeEmailVerificationTokens: 'SELECT * FROM dbo.EmailVerificationTokens WHERE UsedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() ORDER BY Id;',
      securityEvents: 'SELECT * FROM dbo.SecurityEvents ORDER BY Id;',
      adminAuditEvents: 'SELECT * FROM dbo.AdminAuditEvents ORDER BY Id;'
    })) {
      const rows = (await pool.query(query)).recordset;
      groups[name] = { count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }
    snapshots.push({ database, groups, eligible: await previewAuthCleanup(pool, { retentionDays: Number(process.env.AUTH_CLEANUP_RETENTION_DAYS || 7), batchSize: 500 }) });
  } finally { await pool.close(); }
}
const directory = process.argv.includes('--ci') ? 'reports/ci' : process.argv.includes('--operations') ? 'reports/operations'
  : process.argv.includes('--stock-holds') ? 'reports/stock-holds' : process.argv.includes('--cart-recovery') ? 'reports/cart-recovery' : process.argv.includes('--payments') ? 'reports/payments' : process.argv.includes('--security-hardening') ? 'reports/security-hardening' : 'reports/auth-maintenance'; await mkdir(directory, { recursive: true });
if (after) {
  const before = JSON.parse(await readFile(`${directory}/auth-before.json`, 'utf8'));
  for (let i = 0; i < snapshots.length; i++) assert.deepEqual(snapshots[i].groups, before.snapshots[i].groups, 'Live credentials and audit records must remain unchanged');
}
await writeFile(`${directory}/auth-${after ? 'after' : 'before'}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), matchedBefore: after, snapshots }, null, 2));
for (const snapshot of snapshots) console.log(JSON.stringify({ database: snapshot.database, activeSessions: snapshot.groups.activeSessions.count, eligible: snapshot.eligible, ...(after ? { liveCredentialsAndAuditUnchanged: true } : {}) }));
