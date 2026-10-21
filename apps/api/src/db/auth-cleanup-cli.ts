import { previewAuthCleanup } from '../lib/auth-cleanup.js';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--baseline', '--audit', '--apply', '--dry-run'].includes(arg)) || (args.has('--apply') && args.has('--dry-run'))) {
  throw new Error('Usage: auth:cleanup [--baseline] [--audit] [--dry-run|--apply]');
}
process.env.SECURITY_MODE = args.has('--baseline') ? 'baseline' : 'secure';
if (args.has('--audit')) {
  process.env.DB_NAME = args.has('--baseline') ? 'BookGuardAuditBaseline' : 'BookGuardAuditSecure';
  process.env.DB_USER = args.has('--baseline') ? 'bookguard_audit_baseline' : 'bookguard_audit_secure';
}
const { config } = await import('../config.js');
const { getPool, closePool } = await import('./pool.js');
try {
  const pool = await getPool();
  if (args.has('--apply')) {
    const { drainAuthCleanup } = await import('../lib/auth-cleanup-worker.js');
    await drainAuthCleanup();
  } else {
    console.log(JSON.stringify({ dryRun: true, database: config.db.database, retentionDays: config.authCleanup.retentionDays, eligible: await previewAuthCleanup(pool, config.authCleanup) }));
  }
} finally { await closePool(); }
