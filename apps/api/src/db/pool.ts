import sql from "mssql";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { ResettingConnectionPool } from "./resetting-pool.js";

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const pool = new ResettingConnectionPool({
      server: config.db.server,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: config.db.trustServerCertificate,
        enableArithAbort: true
      },
      pool: { min: 1, max: 10, idleTimeoutMillis: 30_000 },
      requestTimeout: 15_000,
      connectionTimeout: 15_000
    });
    poolPromise = pool.connect().catch(async (error: unknown) => {
      poolPromise = undefined;
      await pool.close().catch(() => undefined);
      throw error;
    });
    pool.on("error", (error) => {
      logger.error("database_pool_error", { message: error.message });
      poolPromise = undefined;
    });
  }
  return poolPromise;
}

export async function closePool(): Promise<void> {
  if (!poolPromise) return;
  const pool = await poolPromise;
  await pool.close();
  poolPromise = undefined;
}

export { sql };
