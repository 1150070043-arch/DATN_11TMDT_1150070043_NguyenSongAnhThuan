import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { inside, OperationError, run } from './backup-context.mjs';
import { checksum, pruneVerifiedBackups, verifyBundle } from './backup-bundle.mjs';

export function offsiteAdapter(env = process.env, execute = run) {
  if (env.BACKUP_OFFSITE_CMD) throw new OperationError('USE_STRUCTURED_OFFSITE_UPLOAD_AND_DOWNLOAD_ARGS');
  if (env.BACKUP_OFFSITE_TEST_DIR) {
    if (env.BACKUP_ALLOW_LOCAL_OFFSITE !== 'true') throw new OperationError('LOCAL_OFFSITE_FIXTURE_NOT_ENABLED');
    const root = path.resolve(env.BACKUP_OFFSITE_TEST_DIR);
    return { simulated: true,
      upload: async (directory, id) => { const remote = inside(root, path.join(root, id)); await mkdir(root, { recursive: true }); await cp(directory, remote, { recursive: true, errorOnExist: true, force: false }); },
      download: async (directory, id) => { await cp(inside(root, path.join(root, id)), directory, { recursive: true, errorOnExist: true, force: false }); } };
  }
  if (env.BACKUP_OFFSITE_S3_BUCKET && env.BACKUP_OFFSITE_UPLOAD_ARGS) throw new OperationError('SELECT_ONE_OFFSITE_ADAPTER');
  if (env.BACKUP_OFFSITE_S3_BUCKET) {
    const bucket = env.BACKUP_OFFSITE_S3_BUCKET;
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new OperationError('INVALID_S3_BUCKET');
    const endpointArgs = [];
    if (env.BACKUP_OFFSITE_S3_ENDPOINT) {
      const url = new URL(env.BACKUP_OFFSITE_S3_ENDPOINT);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new OperationError('S3_ENDPOINT_REQUIRES_HTTPS');
      endpointArgs.push('--endpoint-url', url.href);
    }
    return { simulated: false,
      upload: async (directory, id) => execute('aws', [...endpointArgs, 's3', 'sync', directory, `s3://${bucket}/bookguard/${id}/`, '--only-show-errors']),
      download: async (directory, id) => execute('aws', [...endpointArgs, 's3', 'sync', `s3://${bucket}/bookguard/${id}/`, directory, '--only-show-errors']) };
  }
  if (env.BACKUP_OFFSITE_UPLOAD_ARGS || env.BACKUP_OFFSITE_DOWNLOAD_ARGS) {
    const upload = JSON.parse(env.BACKUP_OFFSITE_UPLOAD_ARGS || 'null'), download = JSON.parse(env.BACKUP_OFFSITE_DOWNLOAD_ARGS || 'null');
    if ([upload, download].some(args => !Array.isArray(args) || args.length < 2 || args.some(arg => typeof arg !== 'string') || !args.some(arg => arg.includes('%DIR%')) || !args.some(arg => arg.includes('%STAMP%')))) throw new OperationError('SET_PAIRED_OFFSITE_ARGUMENT_ARRAYS');
    const invoke = (args, directory, id) => execute(args[0], args.slice(1).map(arg => arg.replaceAll('%DIR%', directory).replaceAll('%STAMP%', id)));
    return { simulated: false, upload: async (directory, id) => invoke(upload, directory, id), download: async (directory, id) => invoke(download, directory, id) };
  }
  throw new OperationError('OFFSITE_NOT_CONFIGURED');
}

export async function syncBackup(context, backup, adapter, { prune = false, retentionDays = 7, verify = verifyBundle } = {}) {
  // Validate local bundle and manifest BEFORE allowing an adapter to upload.
  await verify(backup.directory, context, { restore: false });
  const manifestSha256 = await checksum(path.join(backup.directory, 'manifest.json'));
  await adapter.upload(backup.directory, backup.manifest.id);
  const downloaded = inside(context.root, path.join(context.root, '.remote-probe-' + randomUUID()));
  try {
    await adapter.download(downloaded, backup.manifest.id);
    if (await checksum(path.join(downloaded, 'manifest.json')) !== manifestSha256) throw new OperationError('REMOTE_MANIFEST_MISMATCH');
    const verified = await verify(downloaded, context, { restore: true });
    const receipt = { status: adapter.simulated ? 'simulated_verified' : 'remote_verified', verifiedAt: new Date().toISOString(),
      id: backup.manifest.id, manifestSha256, databaseProbes: verified.probes, uploadsRestored: verified.uploadsRestored };
    await writeFile(path.join(context.root, backup.manifest.id + '.remote.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    const removed = prune && !adapter.simulated ? await pruneVerifiedBackups(context.root, retentionDays, backup.manifest.id) : [];
    return { ...receipt, pruned: removed.length };
  } finally { await rm(inside(context.root, downloaded), { recursive: true, force: true }); }
}
