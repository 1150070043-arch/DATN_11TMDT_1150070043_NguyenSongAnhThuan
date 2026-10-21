import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { identifier, inside, OperationError, run, runId } from './backup-context.mjs';

export async function checksum(file) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
export async function bundleFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    if (entry.isSymbolicLink()) throw new OperationError('BACKUP_SYMLINK_NOT_ALLOWED');
    if (entry.isDirectory()) files.push(...await bundleFiles(root, name));
    else if (entry.isFile() && name !== 'manifest.json') {
      const file = inside(root, path.join(root, name));
      files.push({ path: name, bytes: (await lstat(file)).size, sha256: await checksum(file) });
    } else if (!entry.isFile()) throw new OperationError('BACKUP_SPECIAL_FILE_NOT_ALLOWED');
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function cleanupSqlInput(context, destination) {
  if (!/^\/var\/opt\/mssql\/data\/BookGuard(?:Backup|RestoreInput)_[a-f0-9]{32}(?:_[A-Za-z][A-Za-z0-9_]{2,63})?\.bak$/.test(destination)) throw new OperationError('UNSAFE_SQL_BACKUP_PATH');
  run('docker', ['exec', context.sqlContainer, 'rm', '-f', '--', destination]);
}
export async function restoreProbe(context, destination) {
  const temporary = 'BookGuardRestoreProbe_' + randomUUID().replaceAll('-', '');
  const files = context.query('RESTORE FILELISTONLY FROM DISK=@destination;', { destination });
  if (!files.length || files.some(file => !['D', 'L'].includes(file.Type))) throw new OperationError('UNSUPPORTED_SQL_BACKUP_FILE');
  const moves = files.map((file, index) => `MOVE N'${String(file.LogicalName).replaceAll("'", "''")}' TO N'/var/opt/mssql/data/${temporary}_${index}.${file.Type === 'L' ? 'ldf' : 'mdf'}'`).join(', ');
  try {
    context.query(`RESTORE DATABASE [${temporary}] FROM DISK=@destination WITH CHECKSUM, ${moves};`, { destination });
    context.query(`DBCC CHECKDB ([${temporary}]) WITH NO_INFOMSGS;`);
    const [counts] = context.query(`SELECT (SELECT COUNT(*) FROM [${temporary}].dbo.Books) AS books,(SELECT COUNT(*) FROM [${temporary}].dbo.Orders) AS orders,(SELECT MAX(Version) FROM [${temporary}].dbo.SchemaMigrations) AS schemaVersion;`);
    return { restored: true, checkDb: true, ...counts };
  } finally {
    // Generated probe only; production/lab databases are never restore targets.
    context.query(`IF DB_ID(N'${temporary}') IS NOT NULL BEGIN ALTER DATABASE [${temporary}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${temporary}]; END;`);
  }
}
export async function createBackup(context) {
  const id = runId(), directory = inside(context.root, path.join(context.root, id));
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const databases = [];
  for (const source of context.databases) {
    const destination = `/var/opt/mssql/data/BookGuardBackup_${randomUUID().replaceAll('-', '')}_${source.database}.bak`;
    try {
      context.query(`BACKUP DATABASE [${identifier(source.database)}] TO DISK=@destination WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=@destination WITH CHECKSUM;`, { destination });
      const backupFile = `${source.database}.bak`;
      run('docker', ['cp', `${context.sqlContainer}:${destination}`, path.join(directory, backupFile)]);
      const probe = await restoreProbe(context, destination);
      const uploadDir = path.join(directory, 'uploads', source.mode); await mkdir(uploadDir, { recursive: true });
      run('docker', ['cp', `${source.apiContainer}:/app/uploads/.`, uploadDir]);
      databases.push({ database: source.database, mode: source.mode, backupFile, checksumVerified: true, ...probe, uploadsPath: `uploads/${source.mode}` });
    } finally { cleanupSqlInput(context, destination); }
  }
  const files = await bundleFiles(directory);
  const manifest = { version: 2, id, createdAt: new Date().toISOString(), environment: context.production ? 'production' : 'lab',
    consistency: 'SQL transaction-consistent; uploads are a live file snapshot. Quiesce writers for a coordinated recovery point.', databases, files };
  // Immutable checksum manifest is sealed BEFORE any upload.
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`Local backup verified: ${id}; ${databases.length} databases; ${files.length} files (including uploads)`);
  return { directory, manifest };
}
export async function verifyBundle(directory, context, { restore = true } = {}) {
  const manifestPath = path.join(directory, 'manifest.json');
  if ((await lstat(manifestPath)).isSymbolicLink()) throw new OperationError('BACKUP_SYMLINK_NOT_ALLOWED');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== 2 || !Array.isArray(manifest.files) || !manifest.files.length || !Array.isArray(manifest.databases) || !manifest.databases.length) throw new OperationError('INVALID_BACKUP_MANIFEST');
  const actual = await bundleFiles(directory);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new OperationError('BACKUP_CHECKSUM_MISMATCH');
  const probes = [];
  if (restore) for (const db of manifest.databases) {
    identifier(db.database);
    if (db.backupFile !== `${db.database}.bak` || !actual.some(file => file.path === db.backupFile)) throw new OperationError('INVALID_BACKUP_MANIFEST');
    const destination = `/var/opt/mssql/data/BookGuardRestoreInput_${randomUUID().replaceAll('-', '')}.bak`;
    try {
      run('docker', ['cp', inside(directory, path.join(directory, db.backupFile)), `${context.sqlContainer}:${destination}`]);
      const probe = await restoreProbe(context, destination);
      if (probe.books !== db.books || probe.orders !== db.orders || probe.schemaVersion !== db.schemaVersion) throw new OperationError('RESTORE_COUNTS_MISMATCH');
      probes.push({ database: db.database, ...probe });
    } finally { cleanupSqlInput(context, destination); }
  }
  // Exercise upload recovery into an isolated folder; never overwrite runtime uploads.
  const uploadFiles = actual.filter(file => file.path.startsWith('uploads/'));
  const probeDir = inside(context.root, path.join(context.root, '.uploads-probe-' + randomUUID()));
  try {
    await cp(path.join(directory, 'uploads'), probeDir, { recursive: true, errorOnExist: true, force: false });
    for (const file of uploadFiles) {
      const recovered = inside(probeDir, path.join(probeDir, file.path.slice('uploads/'.length)));
      if (await checksum(recovered) !== file.sha256) throw new OperationError('UPLOAD_RESTORE_CHECKSUM_MISMATCH');
    }
  } finally { await rm(inside(context.root, probeDir), { recursive: true, force: true }); }
  return { manifest, manifestSha256: await checksum(manifestPath), probes, uploadsRestored: uploadFiles.length };
}
export async function pruneVerifiedBackups(root, retentionDays, currentId) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new OperationError('INVALID_RETENTION_DAYS');
  const verified = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{8}T\d{9}Z-[a-f0-9]{32}$/.test(entry.name)) continue;
    const directory = inside(root, path.join(root, entry.name));
    // Resolve before any recursive deletion; refuse links outside the root.
    if (await realpath(directory) !== directory) throw new OperationError('UNSAFE_BACKUP_PATH');
    try {
      const receipt = JSON.parse(await readFile(path.join(root, entry.name + '.remote.json'), 'utf8'));
      const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
      if (receipt.status === 'remote_verified' && receipt.manifestSha256 === await checksum(path.join(directory, 'manifest.json')) && manifest.id === entry.name) {
        verified.push({ id: entry.name, directory, createdAt: Date.parse(manifest.createdAt) });
      }
    } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  }
  verified.sort((a, b) => b.createdAt - a.createdAt);
  const removed = [];
  // Keep the two newest independently verified backups and this run regardless of age.
  for (const backup of verified.slice(2)) if (backup.id !== currentId && Number.isFinite(backup.createdAt) && Date.now() - backup.createdAt > retentionDays * 86400000) {
    await rm(inside(root, backup.directory), { recursive: true });
    await rm(inside(root, path.join(root, backup.id + '.remote.json')));
    removed.push(backup.id);
  }
  return removed;
}
