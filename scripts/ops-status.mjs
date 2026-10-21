import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { backupContext, run } from './lib/backup-context.mjs';
import { checksum } from './lib/backup-bundle.mjs';
try {
  const context = await backupContext({ production: process.argv.includes('--production') });
  const databases = context.databases.map(source => {
    const [state] = context.query(`USE [${source.database}]; SELECT
      (SELECT MAX(Version) FROM dbo.SchemaMigrations) AS schemaVersion,
      (SELECT COUNT(*) FROM dbo.OrderNotifications WHERE DeliveryState<>N'sent' AND AttemptCount>=10) AS terminalMailFailures,
      (SELECT COUNT(*) FROM dbo.OrderNotifications WHERE DeliveryState<>N'sent') AS unsentMail,
      (SELECT COUNT(*) FROM dbo.Orders WHERE Status IN(N'pending',N'confirmed') AND PaymentMethod=N'vnpay' AND PaymentStatus IN(N'unpaid',N'failed') AND StockReleaseAfter<=SYSUTCDATETIME() AND StockExpiredAt IS NULL) AS overdueHolds,
      (SELECT COUNT(*) FROM dbo.Orders WHERE Status IN(N'pending',N'confirmed') AND PaymentMethod=N'vnpay' AND PaymentStatus IN(N'unpaid',N'failed') AND StockHoldUntil IS NULL) AS legacyHolds,
      (SELECT COUNT(*) FROM dbo.Orders WHERE PaymentStatus=N'refund_pending') AS pendingRefundReview;`);
    const healthScript = `const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/api/health');if(!r.ok)process.exit(1);console.log(JSON.stringify((await r.json()).data));`;
    const health = JSON.parse(run('docker', ['exec', '-i', source.apiContainer, 'node', '--input-type=module'], { input: healthScript }));
    return { database: source.database, apiHealthy: health.status === 'ok', ...state };
  });
  const receipts = [];
  for (const file of await readdir(context.root)) if (/^\d{8}T\d{9}Z-[a-f0-9]{32}\.remote\.json$/.test(file)) {
    const receipt = JSON.parse(await readFile(path.join(context.root, file), 'utf8'));
    if (receipt.id + '.remote.json' === file && receipt.status === 'remote_verified' && receipt.manifestSha256 === await checksum(path.join(context.root, receipt.id, 'manifest.json'))) receipts.push(receipt);
  }
  receipts.sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt));
  const backupAgeHours = receipts.length ? (Date.now() - Date.parse(receipts[0].verifiedAt)) / 3600000 : null;
  const needsAttention = backupAgeHours === null || backupAgeHours > 24 || databases.some(db => db.terminalMailFailures || db.overdueHolds || db.legacyHolds || db.pendingRefundReview);
  const result = { generatedAt: new Date().toISOString(), status: needsAttention ? 'needs_attention' : 'healthy', databases, lastVerifiedOffsiteAgeHours: backupAgeHours,
    note: 'Aggregate read-only status; simulated receipts never count as an offsite backup.' };
  if (process.argv.includes('--report')) { await mkdir('reports/operations', { recursive: true }); await writeFile('reports/operations/status.json', JSON.stringify(result, null, 2)); }
  console.log(JSON.stringify(result, null, 2));
  if (needsAttention) process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ status: 'failed', code: error.code || 'OPERATIONS_STATUS_FAILED' })); process.exitCode = 1; }
