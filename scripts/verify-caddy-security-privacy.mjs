import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const marker = `synthetic-secret-${randomUUID()}`;
const name = `bookguard-privacy-fixture-${randomUUID()}`;
const image = "caddy@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f";
let containerId;
try {
  containerId = (await exec("docker", ["run", "-d", "--name", name,
    "-p", "127.0.0.1:18189:8080", "-e", "BOOKGUARD_DOMAIN=http://localhost:8080",
    "--mount", `type=bind,source=${path.resolve("deploy/Caddyfile.production.example")},target=/etc/caddy/Caddyfile,readonly`, image])).stdout.trim();
  let response;
  for (let i = 0; i < 20; i++) {
    try {
      response = await fetch(`http://localhost:18189/api/privacy?token=${marker}`, {
        headers: { referer: `http://localhost/reset-password?token=${marker}`, "x-csrf-token": marker }, signal: AbortSignal.timeout(2000) });
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  // The temporary container deliberately has no API network/upstream. This
  // exercises the sensitive proxy-error log path without touching any database.
  assert.equal(response?.status, 502); await response.arrayBuffer();
  const runtime = await exec("docker", ["logs", containerId], { maxBuffer: 1024 * 1024 });
  const access = await exec("docker", ["exec", containerId, "cat", "/var/log/caddy/access.log"]);
  assert.equal((runtime.stdout + runtime.stderr + access.stdout).includes(marker), false);
  const records = access.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.ok(records.some(record => record.path === "/api/privacy" && record.status === 502));
  assert.ok(records.every(record => !record.request.uri && !record.request.headers));
  await writeFile("reports/security-hardening/caddy-privacy-runtime.json", JSON.stringify({ generatedAt: new Date().toISOString(), passed: true, scope: "Temporary loopback HTTP proxy fixture using the production Caddy template; access and proxy-error logs", status: 502, queryAndHeaderMarkerAbsent: true }, null, 2));
  console.log("PASS production Caddy template omits credential queries and headers in access and proxy-error logs");
} finally {
  if (containerId) await exec("docker", ["rm", "-f", containerId]);
}
