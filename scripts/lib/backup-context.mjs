import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, open, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

export class OperationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function identifier(value) {
  if (!/^[A-Za-z][A-Za-z0-9_]{2,63}$/.test(value)) throw new OperationError('INVALID_DATABASE_IDENTIFIER');
  return value;
}
export function inside(root, target) {
  const resolved = path.resolve(target), relative = path.relative(path.resolve(root), resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new OperationError('UNSAFE_BACKUP_PATH');
  return resolved;
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new OperationError(result.error?.code === 'ENOENT' ? 'COMMAND_NOT_FOUND' : 'OPERATION_COMMAND_FAILED');
  return result.stdout;
}
export async function backupContext({ production = false, env = process.env, cwd = process.cwd() } = {}) {
  const root = path.resolve(cwd, env.BACKUP_ROOT || 'backups');
  // Backup/destructive retention is confined to a directory within this checkout.
  inside(cwd, root); await mkdir(root, { recursive: true });
  const actualRoot = await realpath(root);
  inside(await realpath(cwd), actualRoot);
  if (actualRoot.toLowerCase() !== root.toLowerCase()) throw new OperationError('BACKUP_ROOT_SYMLINK_NOT_ALLOWED');
  const compose = ['compose'];
  if (production) {
    if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(env.COMPOSE_PROJECT_NAME || '')) throw new OperationError('SET_PRODUCTION_COMPOSE_PROJECT_NAME');
    compose.push('-p', env.COMPOSE_PROJECT_NAME, '--env-file', path.resolve(cwd, env.BACKUP_COMPOSE_ENV_FILE || '.env.production'));
    const files = env.BACKUP_COMPOSE_FILES ? JSON.parse(env.BACKUP_COMPOSE_FILES) : ['deploy/docker-compose.prod.yml'];
    if (!Array.isArray(files) || !files.length || files.some(file => typeof file !== 'string')) throw new OperationError('INVALID_COMPOSE_FILES');
    for (const file of files) compose.push('-f', path.resolve(cwd, file));
  }
  const container = service => {
    const id = run('docker', [...compose, 'ps', '-q', service]).trim();
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new OperationError('EXPECTED_RUNNING_' + service.toUpperCase().replaceAll('-', '_'));
    return id;
  };
  const sqlContainer = container('sqlserver');
  const apiContainer = container('api-secure');
  if (!env.SQLSERVER_SA_PASSWORD) throw new OperationError('SET_SQLSERVER_SA_PASSWORD');
  const modes = production ? ['SECURE'] : ['BASELINE', 'SECURE'];
  const databases = modes.map(mode => ({ mode: mode.toLowerCase(), database: identifier(env[`${mode}_DB_NAME`] || (mode === 'SECURE' ? 'BookGuardSecure' : 'BookGuardBaseline')),
    apiContainer: container(`api-${mode.toLowerCase()}`) }));
  function query(queryText, params = {}, timeout = 180000) {
    // Password travels through stdin, never command arguments, logs or the manifest.
    const payload = { password: env.SQLSERVER_SA_PASSWORD, user: env.SQLSERVER_SA_USER || 'sa', queryText, params };
    const script = `import sql from 'mssql';
      const input=${JSON.stringify(payload)};
      const pool=new sql.ConnectionPool({server:process.env.SQLSERVER_HOST||'sqlserver',port:Number(process.env.SQLSERVER_PORT||1433),
        database:'master',user:input.user,password:input.password,options:{encrypt:true,trustServerCertificate:true},requestTimeout:${timeout}});
      try { await pool.connect(); const request=pool.request(); for(const [key,value] of Object.entries(input.params)) request.input(key,sql.NVarChar(4000),value);
        const result=await request.query(input.queryText); console.log(JSON.stringify({ok:true,rows:result.recordset||[]}));
      } catch(error) {console.log(JSON.stringify({ok:false,code:typeof error.code==='string'?error.code:'SQL_OPERATION_FAILED'}));process.exitCode=1;}
      finally {await pool.close();}`;
    const output = run('docker', ['exec', '-i', apiContainer, 'node', '--input-type=module'], { input: script, timeout: timeout + 10000 });
    const result = JSON.parse(output.trim().split('\n').at(-1));
    if (!result.ok) throw new OperationError('SQL_OPERATION_FAILED');
    return result.rows;
  }
  return { root, databases, sqlContainer, apiContainer, query, production };
}
export async function withBackupLock(root, operation) {
  await mkdir(root, { recursive: true });
  const lockPath = path.join(root, '.backup.lock');
  let handle;
  try { handle = await open(lockPath, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new OperationError('BACKUP_ALREADY_RUNNING'); throw error; }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await operation(); }
  finally { await handle.close(); await rm(lockPath); }
}
export function runId() { return new Date().toISOString().replace(/[-:.]/g, '') + '-' + randomUUID().replaceAll('-', ''); }
export async function pathExists(target) { try { await access(target); return true; } catch { return false; } }
