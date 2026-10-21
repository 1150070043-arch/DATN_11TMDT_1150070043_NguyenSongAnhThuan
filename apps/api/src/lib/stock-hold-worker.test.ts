import assert from "node:assert/strict";
import test from "node:test";
import { startStockHoldWorker } from "./stock-hold-worker.js";
import { expireStockHoldBatch } from "./stock-holds.js";
import type sql from "mssql";

async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
test("stock expiration does not overlap and shutdown waits for the current transaction", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let release!: () => void; let calls = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const stop = startStockHoldWorker(1000, async () => { calls++; await pending; });
  await settle(); t.mock.timers.tick(5000); await settle(); assert.equal(calls, 1);
  let stopped = false; const stopping = stop().then(() => { stopped = true; });
  await settle(); assert.equal(stopped, false); release(); await stopping;
  t.mock.timers.tick(5000); await settle(); assert.equal(calls, 1);
});
test("stock expiration retries after a failed tick without logging raw driver errors", async t => {
  t.mock.timers.enable({ apis: ["setInterval"] }); let calls = 0;
  const stop = startStockHoldWorker(1000, async () => { if (++calls === 1) throw new Error("fixture driver details"); });
  await settle(); t.mock.timers.tick(1000); await settle(); assert.equal(calls, 2); await stop();
});
test("stock expiration rejects an unbounded batch before accessing SQL", async () => {
  for (const size of [0, 101, 1.5, NaN]) await assert.rejects(expireStockHoldBatch({} as sql.ConnectionPool, size), /batch size/);
});
