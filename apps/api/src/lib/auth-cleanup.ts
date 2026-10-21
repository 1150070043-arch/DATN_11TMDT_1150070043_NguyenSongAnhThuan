import sql from 'mssql';

export const AUTH_CLEANUP_LOCK = 'bookguard:auth-cleanup';
export type AuthCleanupPolicy = { retentionDays: number; batchSize: number };
export type AuthCleanupCounts = { refreshTokens: number; sessions: number; passwordResetTokens: number; emailVerificationTokens: number };
export type AuthCleanupResult = AuthCleanupCounts & { skipped: boolean };

function validatePolicy(policy: AuthCleanupPolicy): void {
  if (!Number.isInteger(policy.retentionDays) || policy.retentionDays < 1 || policy.retentionDays > 365 ||
      !Number.isInteger(policy.batchSize) || policy.batchSize < 1 || policy.batchSize > 1000) {
    throw new Error('Auth cleanup requires retention 1–365 days and batch size 1–1000.');
  }
}

// A rotated credential remains evidence of replay while its parent session lives.
// Never purge it merely because RefreshTokens.RevokedAt is old.
const eligibleRefresh = `
  (rt.SessionId IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.UserSessions s WHERE s.SessionId = rt.SessionId AND s.InvalidAfter <= @cutoff
  )) OR (rt.SessionId IS NULL AND (rt.ExpiresAt <= @cutoff OR rt.RevokedAt <= @cutoff))
`;

export async function previewAuthCleanup(pool: sql.ConnectionPool, policy: AuthCleanupPolicy): Promise<AuthCleanupCounts> {
  validatePolicy(policy);
  const result = await pool.request().input('retentionDays', sql.Int, policy.retentionDays).query<Record<keyof AuthCleanupCounts, number | string>>(`
    DECLARE @cutoff DATETIME2(0) = DATEADD(DAY, -@retentionDays, SYSUTCDATETIME());
    SELECT
      (SELECT COUNT_BIG(*) FROM dbo.RefreshTokens rt WHERE ${eligibleRefresh}) AS refreshTokens,
      (SELECT COUNT_BIG(*) FROM dbo.UserSessions WHERE InvalidAfter <= @cutoff) AS sessions,
      (SELECT COUNT_BIG(*) FROM dbo.PasswordResetTokens WHERE InvalidAfter <= @cutoff) AS passwordResetTokens,
      (SELECT COUNT_BIG(*) FROM dbo.EmailVerificationTokens WHERE InvalidAfter <= @cutoff) AS emailVerificationTokens;
  `);
  const counts = {} as AuthCleanupCounts;
  for (const key of ['refreshTokens', 'sessions', 'passwordResetTokens', 'emailVerificationTokens'] as const) {
    const count = Number(result.recordset[0]![key]);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Auth cleanup count exceeds the supported range.');
    counts[key] = count;
  }
  return counts;
}

export async function cleanupAuthBatch(pool: sql.ConnectionPool, policy: AuthCleanupPolicy): Promise<AuthCleanupResult> {
  validatePolicy(policy);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const lock = await transaction.request().input('resource', sql.NVarChar(255), AUTH_CLEANUP_LOCK).query<{ result: number }>(`
      DECLARE @result INT;
      EXEC @result = sys.sp_getapplock @Resource = @resource, @LockMode = 'Exclusive',
        @LockOwner = 'Transaction', @LockTimeout = 0;
      SELECT @result AS result;
    `);
    const code = lock.recordset[0]!.result;
    if (code === -1) {
      await transaction.rollback();
      return { skipped: true, refreshTokens: 0, sessions: 0, passwordResetTokens: 0, emailVerificationTokens: 0 };
    }
    if (code < 0) throw new Error(`Auth cleanup lock failed (${code}).`);
    const result = await transaction.request()
      .input('retentionDays', sql.Int, policy.retentionDays).input('batchSize', sql.Int, policy.batchSize)
      .query<AuthCleanupCounts>(`
        DECLARE @cutoff DATETIME2(0) = DATEADD(DAY, -@retentionDays, SYSUTCDATETIME());
        DECLARE @refresh INT, @sessions INT, @reset INT, @verify INT;
        DELETE TOP (@batchSize) rt FROM dbo.RefreshTokens rt WITH (ROWLOCK)
        INNER JOIN dbo.UserSessions s ON s.SessionId = rt.SessionId
        WHERE s.InvalidAfter <= @cutoff;
        SET @refresh = @@ROWCOUNT;
        DELETE TOP (@batchSize - @refresh) FROM dbo.RefreshTokens WITH (ROWLOCK)
        WHERE SessionId IS NULL AND (ExpiresAt <= @cutoff OR RevokedAt <= @cutoff);
        SET @refresh = @refresh + @@ROWCOUNT;
        DELETE TOP (@batchSize) s FROM dbo.UserSessions s WITH (ROWLOCK)
        WHERE s.InvalidAfter <= @cutoff AND NOT EXISTS (
          SELECT 1 FROM dbo.RefreshTokens rt WHERE rt.SessionId = s.SessionId
        );
        SET @sessions = @@ROWCOUNT;
        DELETE TOP (@batchSize) FROM dbo.PasswordResetTokens WITH (ROWLOCK) WHERE InvalidAfter <= @cutoff;
        SET @reset = @@ROWCOUNT;
        DELETE TOP (@batchSize) FROM dbo.EmailVerificationTokens WITH (ROWLOCK) WHERE InvalidAfter <= @cutoff;
        SET @verify = @@ROWCOUNT;
        SELECT @refresh AS refreshTokens, @sessions AS sessions, @reset AS passwordResetTokens, @verify AS emailVerificationTokens;
      `);
    await transaction.commit();
    return { ...result.recordset[0]!, skipped: false };
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}
