import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool } from "./db/pool.js";
import { logger } from "./lib/logger.js";
import { drainOrderNotifications } from "./lib/order-notifications.js";

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  logger.info("api_started", {
    mode: config.mode,
    host: config.host,
    port: config.port,
    environment: config.nodeEnv
  });
  void drainOrderNotifications().catch((error) => {
    logger.error("order_notification_drain_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info("api_shutdown", { signal });
  server.close(async () => {
    await closePool().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
