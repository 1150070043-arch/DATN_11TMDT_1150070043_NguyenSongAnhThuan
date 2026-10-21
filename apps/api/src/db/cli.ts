import { createInitialAdmin, initializeDatabases } from "./bootstrap.js";
import { diagnosticErrorCode } from "../lib/diagnostics.js";
import { logger } from "../lib/logger.js";

const action = process.argv[2] ?? "init";
const target = process.argv[3] ?? "all";

if (!["init", "reset", "admin"].includes(action)) {
  throw new Error("Usage: db:cli <init|reset> [baseline|secure|all], or db:cli admin secure");
}
if (target !== "baseline" && target !== "secure" && target !== "all") {
  throw new Error("Database target must be baseline, secure or all.");
}

if (action === "admin" && target !== "secure") throw new Error("Initial admin target must be secure.");
(action === "admin" ? createInitialAdmin() : initializeDatabases(action === "reset", target))
  .then(() => {
    logger.info("database_command_complete", { action, target });
  })
  .catch((error: unknown) => {
    logger.error("database_command_failed", {
      action,
      code: diagnosticErrorCode(error)
    });
    process.exitCode = 1;
  });
