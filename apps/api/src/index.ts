import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool } from "./db/pool.js";
import { logger } from "./lib/logger.js";
import { startOrderNotificationWorker } from "./lib/order-notifications.js";
import { startAuthCleanupWorker } from "./lib/auth-cleanup-worker.js";
import { startStockHoldWorker } from "./lib/stock-hold-worker.js";

const app = createApp();
let stopNotificationWorker: (() => Promise<void>) | undefined;
let stopAuthCleanupWorker: (() => Promise<void>) | undefined;
let stopStockHoldWorker: (() => Promise<void>) | undefined;
const server = app.listen(config.port, config.host, () => {
  logger.info("api_started", {
    mode: config.mode,
    host: config.host,
    port: config.port,
    environment: config.nodeEnv
  });
  stopNotificationWorker = startOrderNotificationWorker();
  stopAuthCleanupWorker = startAuthCleanupWorker();
  stopStockHoldWorker = startStockHoldWorker();
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("api_shutdown", { signal });
  const workersStopped = Promise.all([stopNotificationWorker?.(), stopAuthCleanupWorker?.(), stopStockHoldWorker?.()]);
  server.close(async () => {
    await workersStopped;
    await closePool().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
