import sql from "mssql";
import { seedDatabase } from "./seed.js";
import { runMigrations } from "./migrations.js";
import { logger } from "../lib/logger.js";
import argon2 from "argon2";
import { initialAdminCredentials, provisioningPolicy } from "./provisioning-policy.js";

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
      encrypt: process.env.SQLSERVER_ENCRYPT !== "false",
      trustServerCertificate: process.env.SQLSERVER_TRUST_CERTIFICATE === "true" ||
        (process.env.SQLSERVER_TRUST_CERTIFICATE === undefined && ["localhost", "127.0.0.1", "sqlserver"].includes((process.env.SQLSERVER_HOST ?? "localhost").toLowerCase())),
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

async function provisionDatabase(db: LabDatabase, reset: boolean, seedDemo: boolean): Promise<void> {
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
    // A v4 worker had no lease columns. During provisioning (old API stopped),
    // recover its orphaned processing rows without changing valid v5 leases.
    await pool.request().query(`
      UPDATE dbo.OrderNotifications SET DeliveryState = N'failed', NextAttemptAt = SYSUTCDATETIME()
      WHERE DeliveryState = N'processing' AND LeaseToken IS NULL AND LeaseUntil IS NULL;
    `);
    await pool.request().batch(`
      IF DATABASE_PRINCIPAL_ID(N'${db.user}') IS NULL
        CREATE USER [${db.user}] FOR LOGIN [${db.user}] WITH DEFAULT_SCHEMA = dbo;
    `);

    if (db.secure) {
      await pool.request().batch(`
        REVOKE CONTROL ON DATABASE::[${db.name}] TO [${db.user}];
        GRANT CONNECT TO [${db.user}];
        REVOKE SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [${db.user}];
        IF IS_ROLEMEMBER(N'db_owner', N'${db.user}') = 1
          ALTER ROLE db_owner DROP MEMBER [${db.user}];
        DENY ALTER, TAKE OWNERSHIP ON DATABASE::[${db.name}] TO [${db.user}];
      `);
      const mutableTables = ["Users", "Categories", "Books", "Reviews", "WishlistItems", "Carts", "CartItems", "Orders", "OrderItems", "OrderStatusHistory", "UserSessions", "RefreshTokens", "PasswordResetTokens", "EmailVerificationTokens", "Uploads", "InventoryMovements", "OrderNotifications", "ExperimentRuns", "Coupons", "CouponRedemptions", "PaymentAttempts"];
      for (const table of mutableTables) {
        await pool.request().batch(`GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.[${table}] TO [${db.user}];`);
      }
      await pool.request().batch(`
        GRANT SELECT ON OBJECT::dbo.Roles TO [${db.user}];
        GRANT SELECT ON OBJECT::dbo.SchemaMigrations TO [${db.user}];
        DENY INSERT, UPDATE, DELETE ON OBJECT::dbo.SchemaMigrations TO [${db.user}];
        GRANT SELECT, INSERT ON OBJECT::dbo.SecurityEvents TO [${db.user}];
        GRANT SELECT, INSERT ON OBJECT::dbo.AdminAuditEvents TO [${db.user}];
        DENY UPDATE, DELETE ON OBJECT::dbo.SecurityEvents TO [${db.user}];
        DENY UPDATE, DELETE ON OBJECT::dbo.AdminAuditEvents TO [${db.user}];
      `);
    } else {
      await pool.request().batch(`
        IF IS_ROLEMEMBER(N'db_owner', N'${db.user}') <> 1
          ALTER ROLE db_owner ADD MEMBER [${db.user}];
      `);
    }

    const count = await pool.request().query<{ Total: number }>("SELECT COUNT(*) AS Total FROM dbo.Books");
    if (seedDemo && (reset || Number(count.recordset[0]?.Total ?? 0) === 0)) {
      await seedDatabase(pool, db.secure);
    } else if (!seedDemo) {
      await pool.query(`
        IF NOT EXISTS(SELECT 1 FROM dbo.Roles WHERE Name=N'admin') INSERT dbo.Roles(Id,Name) VALUES(1,N'admin');
        IF NOT EXISTS(SELECT 1 FROM dbo.Roles WHERE Name=N'customer') INSERT dbo.Roles(Id,Name) VALUES(2,N'customer');
      `);
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
  const policy = provisioningPolicy(reset, target);
  const selected = databases(target);
  await waitForServer();
  for (const db of selected) {
    await provisionDatabase(db, reset, policy.seedDemo);
  }
}

// Explicit one-time command. Existing admins are never overwritten/promoted.
export async function createInitialAdmin(): Promise<void> {
  const credentials = initialAdminCredentials();
  const [db] = databases("secure");
  const hash = await argon2.hash(credentials.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const pool = await new sql.ConnectionPool(adminConfig(db!.name)).connect();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const admins = (await transaction.request().query(`SELECT u.Id FROM dbo.Users u WITH(UPDLOCK,HOLDLOCK) INNER JOIN dbo.Roles r ON r.Id=u.RoleId WHERE r.Name=N'admin';`)).recordset;
    if (admins.length) {
      await transaction.commit(); logger.info("initial_admin_already_exists", { database: db!.name }); return;
    }
    await transaction.request().input("email", sql.NVarChar(320), credentials.email).input("hash", sql.NVarChar(500), hash).query(`
      IF NOT EXISTS(SELECT 1 FROM dbo.Roles WHERE Name=N'admin') THROW 50001, 'Provision Secure before creating the initial admin', 1;
      INSERT dbo.Users(Email,PasswordSecret,FullName,RoleId,EmailVerifiedAt)
      SELECT @email,@hash,N'Quản trị BookGuard',Id,SYSUTCDATETIME() FROM dbo.Roles WHERE Name=N'admin';
    `);
    await transaction.commit(); logger.info("initial_admin_created", { database: db!.name });
  } catch (error) { await transaction.rollback().catch(() => undefined); throw error; }
  finally { await pool.close(); }
}
