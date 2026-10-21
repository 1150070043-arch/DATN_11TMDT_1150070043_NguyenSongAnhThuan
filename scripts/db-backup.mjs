import { backupContext, withBackupLock } from './lib/backup-context.mjs';
import { createBackup } from './lib/backup-bundle.mjs';
try {
  const context = await backupContext({ production: process.argv.includes('--production') });
  const result = await withBackupLock(context.root, () => createBackup(context));
  console.log(JSON.stringify({ status: 'local_verified', directory: result.directory, id: result.manifest.id }));
} catch (error) { console.error(JSON.stringify({ status: 'failed', code: error.code || 'BACKUP_FAILED' })); process.exitCode = 1; }
