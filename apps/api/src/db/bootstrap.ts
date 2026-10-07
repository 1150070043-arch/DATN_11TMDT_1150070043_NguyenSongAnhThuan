import sql from "mssql";
import { seedDatabase } from "./seed.js";
import { runMigrations } from "./migrations.js";
import { logger } from "../lib/logger.js";

type LabDatabase = {
  name: string;
  user: string;
  password: string;
  secure: boolean;
};

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function identifier(value: string, label: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]{2,63}$/.test(value)) {
    throw new Error(`Invalid SQL identifier for ${label}`);
  }
  return value;
}

function stringLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function adminConfig(database = "master"): sql.config {
  return {
    server: required("SQLSERVER_HOST", "localhost"),
    port: Number(process.env.SQLSERVER_PORT ?? 1433),
    database,
    user: required("SQLSERVER_SA_USER", "sa"),
    password: required("SQLSERVER_SA_PASSWORD"),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    connectionTimeout: 10_000,
    requestTimeout: 30_000
  };
}

function databases(target: "baseline" | "secure" | "all"): LabDatabase[] {
  const modes = target === "all" ? ["baseline", "secure"] as const : [target];
  const baselineName = required("BASELINE_DB_NAME", "BookGuardBaseline");
  const secureName = required("SECURE_DB_NAME", "BookGuardSecure");
  const baselineUser = required("BASELINE_DB_USER", "bookguard_baseline");
  const secureUser = required("SECURE_DB_USER", "bookguard_secure");
  if (baselineName.toLowerCase() === secureName.toLowerCase() || baselineUser.toLowerCase() === secureUser.toLowerCase()) {
    throw new Error("Twin environments must use different database names and users.");
  }
  return modes.map((mode) => {
    const prefix = mode.toUpperCase();
    return {
      name: identifier(mode === "secure" ? secureName : baselineName, `${prefix}_DB_NAME`),
      user: identifier(mode === "secure" ? secureUser : baselineUser, `${prefix}_DB_USER`),
      password: required(`${prefix}_DB_PASSWORD`),
      secure: mode === "secure"
    };
  });
}

async function waitForServer(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const pool = await new sql.ConnectionPool(adminConfig()).connect();
      await pool.query("SELECT 1 AS ok");
      await pool.close();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function provisionDatabase(db: LabDatabase, reset: boolean): Promise<void> {
  const master = await new sql.ConnectionPool(adminConfig()).connect();
  try {
    await master.request().batch(`
      IF DB_ID(N'${db.name}') IS NULL
        CREATE DATABASE [${db.name}];

      IF SUSER_ID(N'${db.user}') IS NULL
        CREATE LOGIN [${db.user}] WITH PASSWORD = N'${stringLiteral(db.password)}', CHECK_POLICY = ON;
      ELSE
        ALTER LOGIN [${db.user}] WITH PASSWORD = N'${stringLiteral(db.password)}';
    `);
  } finally {
    await master.close();
  }

  const pool = await new sql.ConnectionPool(adminConfig(db.name)).connect();
  let appliedMigrations: number[] = [];
  try {
    appliedMigrations = await runMigrations(pool);
    await pool.request().batch(`
      IF DATABASE_PRINCIPAL_ID(N'${db.user}') IS NULL
        CREATE USER [${db.user}] FOR LOGIN [${db.user}] WITH DEFAULT_SCHEMA = dbo;
    `);

    if (db.secure) {
      await pool.request().batch(`
        REVOKE CONTROL ON DATABASE::[${db.name}] TO [${db.user}];
        GRANT CONNECT TO [${db.user}];
        GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [${db.user}];
        DENY ALTER, TAKE OWNERSHIP ON DATABASE::[${db.name}] TO [${db.user}];
      `);
    } else {
      await pool.request().batch(`
        IF IS_ROLEMEMBER(N'db_owner', N'${db.user}') <> 1
          ALTER ROLE db_owner ADD MEMBER [${db.user}];
      `);
    }

    const count = await pool.request().query<{ Total: number }>("SELECT COUNT(*) AS Total FROM dbo.Books");
    if (reset || Number(count.recordset[0]?.Total ?? 0) === 0) {
      await seedDatabase(pool, db.secure);
    }
  } finally {
    await pool.close();
  }

  logger.info("database_ready", {
    database: db.name,
    mode: db.secure ? "secure" : "baseline",
    reset,
    appliedMigrations
  });
}

export async function initializeDatabases(reset = false, target: "baseline" | "secure" | "all" = "all"): Promise<void> {
  // Validate the selected environment before connecting or changing any database.
  const selected = databases(target);
  await waitForServer();
  for (const db of selected) {
    await provisionDatabase(db, reset);
  }
}
