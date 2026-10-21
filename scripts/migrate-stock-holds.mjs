import sql from 'mssql';
import { runMigrations } from '../apps/api/dist/db/migrations.js';

if (process.argv.slice(2).some(arg => arg !== '--audit')) throw new Error('Usage: migrate-stock-holds.mjs [--audit]');
const databases = process.argv.includes('--audit') ? ['BookGuardAuditBaseline', 'BookGuardAuditSecure'] : ['BookGuardBaseline', 'BookGuardSecure'];
for (const database of databases) {
  const pool = await new sql.ConnectionPool({ server: 'localhost', port: Number(process.env.SQLSERVER_PORT || 1433), database,
    user: process.env.SQLSERVER_SA_USER || 'sa', password: process.env.SQLSERVER_SA_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    const current = (await pool.query('SELECT MAX(Version) AS version FROM dbo.SchemaMigrations;')).recordset[0]?.version;
    if (![7, 8].includes(current)) throw new Error(`${database}: expected existing schema v7–v8; refusing to provision or reset.`);
    const applied = await runMigrations(pool);
    const existingEnrolled = (await pool.query('SELECT COUNT(*) AS total FROM dbo.Orders WHERE StockHoldUntil IS NOT NULL;')).recordset[0].total;
    console.log(JSON.stringify({ database, applied, schemaVersion: 8, existingEnrolled }));
  } finally { await pool.close(); }
}
