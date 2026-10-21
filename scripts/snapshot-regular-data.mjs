import sql from "mssql";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const after = process.argv.includes("--after");
const snapshots = [];
for (const database of ["BookGuardBaseline", "BookGuardSecure"]) {
  const pool = await new sql.ConnectionPool({ server: "localhost", port: Number(process.env.SQLSERVER_PORT || 1433), database, user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
  try {
    const books = (await pool.query("SELECT * FROM dbo.Books ORDER BY Id;")).recordset;
    const orders = (await pool.query("SELECT Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, SubtotalAmount, DiscountAmount, TotalAmount, CreatedAt, UpdatedAt FROM dbo.Orders ORDER BY Id;")).recordset;
    const schema = (await pool.query("SELECT MAX(Version) AS version FROM dbo.SchemaMigrations;")).recordset[0].version;
    let paymentBackfill;
    if (after) {
      paymentBackfill = (await pool.query(`
        SELECT COUNT(*) AS legacyPayments,
          SUM(CASE WHEN o.UpdatedAt IS NULL THEN 1 ELSE 0 END) AS nullUpdatedAt,
          SUM(CASE WHEN p.Id IS NULL OR p.ExpiresAt <> DATEADD(MINUTE, 15, COALESCE(o.UpdatedAt, o.CreatedAt)) THEN 1 ELSE 0 END) AS incorrectBackfill
        FROM dbo.Orders o LEFT JOIN dbo.PaymentAttempts p ON p.OrderId = o.Id AND p.PaymentUrl = o.PaymentUrl
        WHERE o.PaymentMethod = N'vnpay' AND o.PaymentUrl IS NOT NULL AND o.TotalAmount > 0 AND CHARINDEX(N'vnp_TxnRef=', o.PaymentUrl) > 0;
      `)).recordset[0];
      assert.equal(paymentBackfill.incorrectBackfill ?? 0, 0, `${database}: legacy payment backfill failed`);
    }
    snapshots.push({ database, schema, books: books.length, orders: orders.length, businessDataSha256: createHash("sha256").update(JSON.stringify({ books, orders })).digest("hex"), ...(after ? { paymentBackfill } : {}) });
  } finally { await pool.close(); }
}
const file = `reports/generated/regular-data-${after ? "after" : "before"}.json`;
if (after) {
  const before = JSON.parse(await readFile("reports/generated/regular-data-before.json", "utf8"));
  for (const current of snapshots) {
    const previous = before.snapshots.find(row => row.database === current.database);
    assert.equal(current.businessDataSha256, previous?.businessDataSha256, `${current.database}: business data changed`);
    assert.equal(current.schema, 5);
  }
}
await writeFile(file, JSON.stringify({ generatedAt: new Date().toISOString(), matchedBefore: after, snapshots }, null, 2));
console.log(snapshots.map(row => `${row.database}: schema ${row.schema}, ${row.books} books / ${row.orders} orders${after ? "; business hash unchanged" : ""}`).join("\n"));
