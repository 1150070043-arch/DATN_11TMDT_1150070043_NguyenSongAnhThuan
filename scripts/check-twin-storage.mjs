import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Docker check failed");
  return result.stdout.trim();
}

// Read-only SQL checks using each application's own login, never SA.
for (const mode of ["baseline", "secure"]) {
  const script = `
    import assert from 'node:assert/strict';
    import {config} from './dist/config.js';
    import {getPool, closePool} from './dist/db/pool.js';
    const other = config.isSecure ? 'BookGuardBaseline' : 'BookGuardSecure';
    try {
      const pool = await getPool();
      const own = await pool.query('SELECT DB_NAME() AS databaseName, SUSER_SNAME() AS loginName, (SELECT COUNT(*) FROM dbo.Books) AS books, (SELECT COUNT(*) FROM dbo.Orders) AS orders');
      assert.equal(own.recordset[0].databaseName, config.isSecure ? 'BookGuardSecure' : 'BookGuardBaseline');
      assert.equal(own.recordset[0].loginName, config.isSecure ? 'bookguard_secure' : 'bookguard_baseline');
      let rejected = false;
      try { await pool.query('SELECT TOP 0 Id FROM [' + other + '].dbo.Users'); }
      catch (error) { assert.ok([916, 229].includes(error.number), 'Unexpected cross-DB failure: ' + error.number); rejected = true; }
      assert.ok(rejected, 'Cross-database access must be denied');
      console.log(JSON.stringify({mode: config.mode, ...own.recordset[0], crossDatabaseAccess: 'denied'}));
    } finally { await closePool(); }
  `;
  console.log(docker(["compose", "exec", "-T", `api-${mode}`, "node", "--input-type=module"], script));
}

const containers = ["baseline", "secure"].map(mode => {
  const id = docker(["compose", "ps", "-q", `api-${mode}`]);
  const [container] = JSON.parse(docker(["inspect", id]));
  return container;
});
const uploadVolumes = containers.map(container => {
  const mount = container.Mounts.find(item => item.Destination === "/app/uploads");
  assert.ok(mount?.Name, "Missing upload volume");
  assert.equal(container.Mounts.find(item => item.Destination === "/app/reports/generated")?.RW, false);
  return mount.Name;
});
assert.notEqual(...uploadVolumes);
const baselineNetworks = Object.keys(containers[0].NetworkSettings.Networks);
const secureNetworks = Object.keys(containers[1].NetworkSettings.Networks);
assert.equal(baselineNetworks.some(name => secureNetworks.includes(name)), false);

// Parse resolved config privately: never print passwords or SMTP credentials.
const { services } = JSON.parse(docker(["compose", "config", "--format", "json"]));
assert.equal(services["api-baseline"].environment.SMTP_HOST, "mailpit-baseline");
assert.ok(!services["api-baseline"].environment.SMTP_PASSWORD);
for (const [mode, other] of [["baseline", "secure"], ["secure", "baseline"]]) {
  assert.deepEqual(services[`db-init-${mode}`].command, ["node", "dist/db/cli.js", "init", mode]);
  assert.ok(!services[`db-init-${mode}`].environment[`${other.toUpperCase()}_DB_PASSWORD`]);
  assert.ok(services[`api-${mode}`].depends_on[`db-init-${mode}`]);
  assert.ok(!services[`api-${mode}`].depends_on[`db-init-${other}`]);
}
console.log("PASS: separate uploads, networks, init jobs and baseline mail; reports read-only. SQL checks made no data changes.");
