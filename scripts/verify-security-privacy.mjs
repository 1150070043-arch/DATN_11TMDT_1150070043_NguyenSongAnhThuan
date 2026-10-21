import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

const exec = promisify(execFile);
const directory = "reports/security-hardening";
const { marker, requestId } = JSON.parse(await readFile(`${directory}/privacy-probe.json`, "utf8"));
const api = await fetch("http://localhost:4002/api/health");
assert.equal(api.status, 200);
assert.equal((await api.json()).data.auditFixture, true, "Privacy proof expects the isolated audit API");
const webProbe = await fetch(`http://localhost:5174/reset-password?token=${marker}`, { headers: { referer: `http://localhost:5174/reset-password?token=${marker}` } });
assert.equal(webProbe.status, 200);
await webProbe.arrayBuffer();
const checks = [];
for (const service of ["api-secure", "web-secure"]) {
  // Capture privately: logs may predate this upgrade. Never print or export them.
  const { stdout, stderr } = await exec("docker", ["compose", "logs", "--no-color", "--no-log-prefix", service], { maxBuffer: 20 * 1024 * 1024 });
  const logs = stdout + stderr;
  assert.equal(logs.includes(marker), false, `${service}: synthetic query marker leaked into logs`);
  assert.ok(logs.includes(service === "api-secure" ? requestId : '"GET /reset-password HTTP/'), `${service}: expected request record missing`);
  checks.push({ service, requestObserved: true, queryMarkerAbsent: true });
}
await writeFile(`${directory}/privacy-runtime.json`, JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, checks }, null, 2));
console.log("PASS API and Nginx access logs record requests without the synthetic token/query/referrer values");
