import sql from "mssql";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

const compose = ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.audit.yml"];
execFileSync("docker", [...compose, "stop", "api-baseline", "api-secure"], { stdio: "pipe" });
const pool = await new sql.ConnectionPool({ server: "localhost", database: "BookGuardAuditSecure", user: process.env.SQLSERVER_SA_USER || "sa", password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
const marker = `legacy-${randomUUID()}@bookguard.local`;
try {
  const orderId = (await pool.query("SELECT TOP 1 Id FROM dbo.Orders ORDER BY Id;")).recordset[0].Id;
  const lease = randomUUID();
  await pool.request().input("orderId", sql.Int, orderId).input("email", sql.NVarChar(180), marker).input("lease", sql.UniqueIdentifier, lease).query(`
    INSERT INTO dbo.OrderNotifications (OrderId, RecipientEmail, OrderStatus, DeliveryState, AttemptCount, LeaseToken, LeaseUntil)
    VALUES (@orderId, @email, N'pending', N'processing', 1, NULL, NULL),
           (@orderId, @email, N'confirmed', N'processing', 1, @lease, DATEADD(MINUTE, 2, SYSUTCDATETIME()));
  `);
  execFileSync(process.execPath, ["--env-file=.env", "scripts/audit-db.mjs"], { stdio: "pipe" });
  const rows = (await pool.request().input("email", sql.NVarChar(180), marker).query("SELECT OrderStatus, DeliveryState, LeaseToken FROM dbo.OrderNotifications WHERE RecipientEmail = @email;")).recordset;
  assert.equal(rows.find(row => row.OrderStatus === "pending").DeliveryState, "failed");
  const live = rows.find(row => row.OrderStatus === "confirmed");
  assert.equal(live.DeliveryState, "processing"); assert.equal(live.LeaseToken.toLowerCase(), lease);
  await writeFile("reports/generated/legacy-outbox.json", JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, legacyProcessingRecovered: true, liveLeasePreserved: true }, null, 2));
  console.log("Legacy v4 outbox row recovered; valid v5 processing lease preserved.");
} finally {
  await pool.request().input("email", sql.NVarChar(180), marker).query("DELETE dbo.OrderNotifications WHERE RecipientEmail = @email;");
  await pool.close();
  execFileSync("docker", [...compose, "up", "-d", "--no-deps", "api-baseline", "api-secure"], { stdio: "pipe" });
}
