import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const results = [];
for (const [service, database] of [['api-baseline', 'BookGuardBaseline'], ['api-secure', 'BookGuardSecure']]) {
  const script = `
    import {config} from './dist/config.js';
    import {getPool,closePool} from './dist/db/pool.js';
    const pool=await getPool();
    try {
      const state=(await pool.query(\`
        SELECT (SELECT MAX(Version) FROM dbo.SchemaMigrations) AS schemaVersion,
          (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Orders') AND name=N'IX_Orders_StockRelease') AS indexExists,
          (SELECT COUNT(*) FROM dbo.Orders WHERE StockHoldUntil IS NOT NULL OR StockReleaseAfter IS NOT NULL OR StockExpiredAt IS NOT NULL) AS enrolledOrExpired,
          (SELECT COUNT(*) FROM dbo.Orders o WHERE o.StockHoldUntil IS NULL AND o.Status IN(N'pending',N'confirmed')
            AND o.PaymentMethod=N'vnpay' AND o.PaymentStatus IN(N'unpaid',N'failed')
            AND EXISTS(SELECT 1 FROM dbo.PaymentAttempts p WHERE p.OrderId=o.Id AND p.ExpiresAt<=SYSUTCDATETIME())
            AND NOT EXISTS(SELECT 1 FROM dbo.PaymentAttempts p WHERE p.OrderId=o.Id AND p.State=N'pending' AND p.ExpiresAt>SYSUTCDATETIME())) AS legacyExpiredLinkOrders;
      \`)).recordset[0];
      console.log(JSON.stringify({database:config.db.database,policy:config.stockHold,...state}));
    } finally {await closePool();}
  `;
  const output = execFileSync('docker', ['compose', 'exec', '-T', service, 'node', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 20000 });
  const result = JSON.parse(output.trim().split('\n').at(-1));
  assert.equal(result.database, database); assert.equal(result.schemaVersion, 8); assert.equal(result.indexExists, 1);
  assert.equal(result.policy.enabled, true); assert.equal(result.enrolledOrExpired, 0, 'Existing orders must not be enrolled or expired by migration/testing');
  const id = execFileSync('docker', ['compose', 'ps', '-q', service], { encoding: 'utf8' }).trim();
  const startedAt = execFileSync('docker', ['inspect', '--format', '{{.State.StartedAt}}', id], { encoding: 'utf8' }).trim();
  const logs = execFileSync('docker', ['logs', '--since', startedAt, id], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const workerErrors = logs.split('\n').filter(line => {
    try { return JSON.parse(line).event === 'stock_hold_expiry_failed'; } catch { return false; }
  }).length;
  assert.equal(workerErrors, 0);
  results.push({ service, ...result, workerErrors });
  console.log(`${service}: schema v8, worker enabled, no existing order enrolled/expired; ${result.legacyExpiredLinkOrders} legacy expired-link orders retained`);
}
await mkdir('reports/stock-holds', { recursive: true });
await writeFile('reports/stock-holds/runtime.json', JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, results }, null, 2));
