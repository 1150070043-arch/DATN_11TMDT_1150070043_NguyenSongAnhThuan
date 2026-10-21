import { config } from '../config.js';
import { getPool } from '../db/pool.js';
import { cleanupAuthBatch, type AuthCleanupCounts } from './auth-cleanup.js';
import { logger } from './logger.js';

export async function drainAuthCleanup(): Promise<void> {
  const started = Date.now();
  const pool = await getPool();
  const totals: AuthCleanupCounts = { sessions: 0, refreshTokens: 0, passwordResetTokens: 0, emailVerificationTokens: 0 };
  let batches = 0;
  let skipped = false;
  let backlogPossible = false;
  for (; batches < config.authCleanup.maxBatches;) {
    const result = await cleanupAuthBatch(pool, config.authCleanup);
    if (result.skipped) { skipped = true; break; }
    batches++;
    for (const key of Object.keys(totals) as Array<keyof AuthCleanupCounts>) totals[key] += result[key];
    backlogPossible = Object.values(result).some(value => typeof value === 'number' && value === config.authCleanup.batchSize);
    if (!backlogPossible) break;
  }
  logger.info('auth_cleanup_completed', { mode: config.mode, ...totals, batches, skipped, backlogPossible, durationMs: Date.now() - started, retentionDays: config.authCleanup.retentionDays });
}

export function startAuthCleanupWorker(intervalMs = config.authCleanup.intervalMinutes * 60_000, task = drainAuthCleanup): () => Promise<void> {
  if (!config.authCleanup.enabled) return async () => {};
  let stopped = false;
  let running: Promise<void> | undefined;
  function tick() {
    if (stopped || running) return;
    running = Promise.resolve().then(task).catch(error => {
      // Counts only on success; errors omit driver details that may contain SQL inputs.
      logger.error('auth_cleanup_failed', { mode: config.mode, code: typeof error?.code === 'string' ? error.code : 'CLEANUP_FAILED' });
    }).finally(() => { running = undefined; });
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
