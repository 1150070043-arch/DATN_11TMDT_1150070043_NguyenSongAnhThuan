import sql from 'mssql';
import { migrations, runMigrations } from '../apps/api/dist/db/migrations.js';

if (process.argv.slice(2).some(arg => arg !== '--audit')) throw new Error('Usage: migrate-auth-maintenance.mjs [--audit]');
const databases = process.argv.includes('--audit') ? ['BookGuardAuditBaseline', 'BookGuardAuditSecure'] : ['BookGuardBaseline', 'BookGuardSecure'];
for (const database of databases) {
  const pool = await new sql.ConnectionPool({ server: 'localhost', port: Number(process.env.SQLSERVER_PORT || 1433), database,
    user: process.env.SQLSERVER_SA_USER || 'sa', password: process.env.SQLSERVER_SA_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true } }).connect();
  try {
    const current = (await pool.query('SELECT MAX(Version) AS version FROM dbo.SchemaMigrations;')).recordset[0]?.version;
    if (![5, 6, 7, 8].includes(current)) throw new Error(`${database}: expected an existing schema v5–v8, refusing to provision or reset it.`);
    const applied = await runMigrations(pool);
    console.log(JSON.stringify({ database, applied, schemaVersion: migrations.at(-1).version }));
  } finally { await pool.close(); }
}
