import path from 'node:path';
import { backupContext, inside, withBackupLock } from './lib/backup-context.mjs';
import { verifyBundle } from './lib/backup-bundle.mjs';
try {
  const directoryArg = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--'));
  if (!directoryArg) throw Object.assign(new Error('directory'), { code: 'SPECIFY_BACKUP_DIRECTORY' });
  const context = await backupContext({ production: process.argv.includes('--production') });
  const directory = inside(context.root, path.resolve(directoryArg));
  const result = await withBackupLock(context.root, () => verifyBundle(directory, context));
  console.log(JSON.stringify({ status: 'restore_drill_verified', probes: result.probes, uploadsRestored: result.uploadsRestored }));
} catch (error) { console.error(JSON.stringify({ status: 'failed', code: error.code || 'RESTORE_DRILL_FAILED' })); process.exitCode = 1; }
