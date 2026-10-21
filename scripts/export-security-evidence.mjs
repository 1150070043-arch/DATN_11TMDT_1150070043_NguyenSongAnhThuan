import { readFile, writeFile } from "node:fs/promises";
import sql from "mssql";

const report = JSON.parse(await readFile("reports/generated/security-results.json", "utf8"));
const pool = await new sql.ConnectionPool({ server: "localhost", database: "BookGuardAuditSecure", user: process.env.SQLSERVER_SA_USER || "sa",
  password: process.env.SQLSERVER_SA_PASSWORD, options: { encrypt: true, trustServerCertificate: true } }).connect();
try {
  const evidence = [];
  for (const item of report.results) {
    const requestId = item.secure.requestId;
    const rows = requestId ? (await pool.request().input("requestId", sql.NVarChar(80), requestId)
      .query("SELECT EventType, Severity, RequestId, Method, Path, CreatedAt FROM dbo.SecurityEvents WHERE RequestId = @requestId ORDER BY Id;")).recordset : [];
    evidence.push({ case: item.id, requestId, status: item.secure.status, events: rows });
  }
  await writeFile("reports/generated/security-event-evidence.json", JSON.stringify({ generatedAt: new Date().toISOString(), testGeneratedAt: report.summary.generatedAt, evidence }, null, 2));
  console.log(evidence.map(item => `${item.case}: ${item.events.map(event => event.EventType).join(", ") || "no security event for this request"}`).join("\n"));
} finally { await pool.close(); }
