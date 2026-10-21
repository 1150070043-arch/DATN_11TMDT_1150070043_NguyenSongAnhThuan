import sql from "mssql";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Fingerprints only; no customer/order details are written to the report.
const after = process.argv.includes("--after");
const snapshots = [];
for (const database of ["BookGuardBaseline", "BookGuardSecure"]) {
  const pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database, user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    const books = (await pool.query("SELECT * FROM dbo.Books ORDER BY Id;")).recordset;
    const orders = (await pool.query("SELECT * FROM dbo.Orders ORDER BY Id;")).recordset;
    if (process.argv.includes('--stock-holds')) for (const order of orders) {
      for (const column of ['StockHoldUntil', 'StockReleaseAfter', 'StockExpiredAt']) delete order[column];
    }
    snapshots.push({ database, books: books.length, orders: orders.length, sha256: createHash("sha256").update(JSON.stringify({ books, orders })).digest("hex") });
  } finally { await pool.close(); }
}
const directory = process.argv.includes('--ci') ? 'reports/ci' : process.argv.includes('--operations') ? 'reports/operations'
  : process.argv.includes('--stock-holds') ? 'reports/stock-holds'
  : process.argv.includes('--cart-recovery') ? 'reports/cart-recovery'
  : process.argv.includes('--payments') ? 'reports/payments'
  : process.argv.includes('--security-hardening') ? 'reports/security-hardening'
  : process.argv.includes('--auth-maintenance') ? 'reports/auth-maintenance'
  : process.argv.includes("--mobile") ? "reports/mobile-ux" : "reports/storefront-performance";
await mkdir(directory, { recursive: true });
if (after) {
  const before = JSON.parse(await readFile(`${directory}/business-before.json`, "utf8"));
  assert.deepEqual(snapshots, before.snapshots);
}
await writeFile(`${directory}/business-${after ? "after" : "before"}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), snapshots, matchedBefore: after }, null, 2));
console.log(snapshots.map(row => `${row.database}: ${row.books} books / ${row.orders} orders${after ? "; unchanged" : "; fingerprint saved"}`).join("\n"));
