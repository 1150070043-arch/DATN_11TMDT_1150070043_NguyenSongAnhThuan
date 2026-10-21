import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { diagnosticErrorCode } from "./diagnostics.js";
import { logger } from "./logger.js";
import { expireStockHoldBatch } from "./stock-holds.js";

export async function drainStockHolds() {
  const { scanned, expired } = await expireStockHoldBatch(await getPool());
  if (scanned) logger.info("stock_holds_expired", { mode: config.mode, scanned, expired });
}

export function startStockHoldWorker(intervalMs = config.stockHold.intervalSeconds * 1000, task = drainStockHolds): () => Promise<void> {
  if (!config.stockHold.enabled) return async () => {};
  let stopped = false;
  let running: Promise<void> | undefined;
  function tick() {
    if (stopped || running) return;
    running = Promise.resolve().then(task).catch(cause => {
      logger.error("stock_hold_expiry_failed", { mode: config.mode, code: diagnosticErrorCode(cause) });
    }).finally(() => { running = undefined; });
  }
  const timer = setInterval(tick, intervalMs); timer.unref(); tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
