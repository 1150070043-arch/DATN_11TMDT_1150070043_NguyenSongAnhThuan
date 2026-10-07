import { initializeDatabases } from "./bootstrap.js";
import { logger } from "../lib/logger.js";

const action = process.argv[2] ?? "init";
const target = process.argv[3] ?? "all";

if (!["init", "reset"].includes(action)) {
  throw new Error("Usage: db:cli <init|reset> [baseline|secure|all]");
}
if (target !== "baseline" && target !== "secure" && target !== "all") {
  throw new Error("Database target must be baseline, secure or all.");
}

initializeDatabases(action === "reset", target)
  .then(() => {
    logger.info("database_command_complete", { action, target });
  })
  .catch((error: unknown) => {
    logger.error("database_command_failed", {
      action,
      message: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  });
