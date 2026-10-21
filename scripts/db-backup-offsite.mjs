import { backupContext, withBackupLock } from './lib/backup-context.mjs';
import { createBackup } from './lib/backup-bundle.mjs';
import { offsiteAdapter, syncBackup } from './lib/backup-offsite.mjs';
try {
  // Fail before backup/retention if remote configuration is missing or incomplete.
  const adapter = offsiteAdapter();
  const context = await backupContext({ production: process.argv.includes('--production') });
  const result = await withBackupLock(context.root, async () => {
    const backup = await createBackup(context);
    return syncBackup(context, backup, adapter, { prune: process.argv.includes('--prune'), retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 7) });
  });
  console.log(JSON.stringify(result));
} catch (error) {
  const code = typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'OFFSITE_BACKUP_FAILED';
  console.error(JSON.stringify({ status: 'failed', code }));
  // Explicit opt-in; local/test jobs never send messages to external recipients.
  if (process.env.BACKUP_SEND_ALERTS === 'true') {
    try {
      const { deliverAlert } = await import('../apps/api/dist/lib/alerting.js');
      const delivery = await deliverAlert({ level: 'critical', type: 'DATABASE_BACKUP_FAILED', message: 'Backup failed; inspect the local job result.', details: { code } });
      console.error(JSON.stringify({ alertStatus: delivery.status }));
    } catch { console.error(JSON.stringify({ alertStatus: 'failed' })); }
  }
  process.exitCode = 1;
}
