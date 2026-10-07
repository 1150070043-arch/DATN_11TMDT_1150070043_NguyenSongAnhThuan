import crypto from "node:crypto";
import type sql from "mssql";
import { schemaSql } from "./schema.js";

export type DatabaseMigration = {
  version: number;
  name: string;
  sql: string;
};

const operationsAndExperimentsSql = `
IF OBJECT_ID(N'dbo.InventoryMovements', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.InventoryMovements (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BookId INT NOT NULL,
    MovementType NVARCHAR(30) NOT NULL,
    QuantityDelta INT NOT NULL,
    BalanceAfter INT NOT NULL,
    ReferenceType NVARCHAR(30) NULL,
    ReferenceId INT NULL,
    Note NVARCHAR(500) NULL,
    ChangedByUserId INT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InventoryMovements_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_InventoryMovements_Type CHECK (
      MovementType IN (N'opening', N'sale', N'return', N'adjustment')
    ),
    CONSTRAINT CK_InventoryMovements_Delta CHECK (QuantityDelta <> 0),
    CONSTRAINT CK_InventoryMovements_Balance CHECK (BalanceAfter >= 0),
    CONSTRAINT FK_InventoryMovements_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id),
    CONSTRAINT FK_InventoryMovements_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N'dbo.OrderNotifications', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderNotifications (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    RecipientEmail NVARCHAR(255) NOT NULL,
    OrderStatus NVARCHAR(30) NOT NULL,
    DeliveryState NVARCHAR(20) NOT NULL CONSTRAINT DF_OrderNotifications_State DEFAULT N'pending',
    AttemptCount INT NOT NULL CONSTRAINT DF_OrderNotifications_Attempts DEFAULT 0,
    LastError NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderNotifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    SentAt DATETIME2(0) NULL,
    CONSTRAINT CK_OrderNotifications_Status CHECK (
      OrderStatus IN (N'pending', N'confirmed', N'shipping', N'completed', N'cancelled')
    ),
    CONSTRAINT CK_OrderNotifications_State CHECK (
      DeliveryState IN (N'pending', N'processing', N'sent', N'failed')
    ),
    CONSTRAINT CK_OrderNotifications_Attempts CHECK (AttemptCount BETWEEN 0 AND 10),
    CONSTRAINT FK_OrderNotifications_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N'dbo.ExperimentRuns', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ExperimentRuns (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RunType NVARCHAR(30) NOT NULL,
    Mode NVARCHAR(20) NOT NULL,
    SourceKey CHAR(64) NOT NULL UNIQUE,
    ExecutedAt DATETIME2(0) NOT NULL,
    Passed BIT NULL,
    TotalCases INT NULL,
    PassedCases INT NULL,
    P50Ms DECIMAL(18,3) NULL,
    P95Ms DECIMAL(18,3) NULL,
    Throughput DECIMAL(18,3) NULL,
    ErrorRate DECIMAL(18,6) NULL,
    CpuPercent DECIMAL(9,3) NULL,
    MemoryMb DECIMAL(18,3) NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ExperimentRuns_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ExperimentRuns_Type CHECK (RunType IN (N'security', N'functional', N'performance')),
    CONSTRAINT CK_ExperimentRuns_Mode CHECK (Mode IN (N'baseline', N'secure', N'comparison')),
    CONSTRAINT CK_ExperimentRuns_Counts CHECK (
      (TotalCases IS NULL OR TotalCases >= 0) AND
      (PassedCases IS NULL OR PassedCases >= 0) AND
      (TotalCases IS NULL OR PassedCases IS NULL OR PassedCases <= TotalCases)
    ),
    CONSTRAINT CK_ExperimentRuns_Metrics CHECK (
      (P50Ms IS NULL OR P50Ms >= 0) AND
      (P95Ms IS NULL OR P95Ms >= 0) AND
      (Throughput IS NULL OR Throughput >= 0) AND
      (ErrorRate IS NULL OR ErrorRate BETWEEN 0 AND 1) AND
      (CpuPercent IS NULL OR CpuPercent >= 0) AND
      (MemoryMb IS NULL OR MemoryMb >= 0)
    )
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InventoryMovements_Book_Created')
  CREATE INDEX IX_InventoryMovements_Book_Created
    ON dbo.InventoryMovements(BookId, CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InventoryMovements_Created')
  CREATE INDEX IX_InventoryMovements_Created
    ON dbo.InventoryMovements(CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OrderNotifications_State_Created')
  CREATE INDEX IX_OrderNotifications_State_Created
    ON dbo.OrderNotifications(DeliveryState, CreatedAt ASC)
    INCLUDE (OrderId, AttemptCount);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ExperimentRuns_Type_Executed')
  CREATE INDEX IX_ExperimentRuns_Type_Executed
    ON dbo.ExperimentRuns(RunType, ExecutedAt DESC, Id DESC);

INSERT INTO dbo.InventoryMovements
  (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, CreatedAt)
SELECT
  b.Id, N'opening', b.Stock, b.Stock, N'migration', N'Số dư được ghi nhận khi nâng cấp v1.5',
  COALESCE(b.UpdatedAt, b.CreatedAt)
FROM dbo.Books b
WHERE b.Stock > 0
  AND NOT EXISTS (SELECT 1 FROM dbo.InventoryMovements m WHERE m.BookId = b.Id);
`;

const promotionsAndAuditSql = `
IF COL_LENGTH(N'dbo.Orders', N'SubtotalAmount') IS NULL
  ALTER TABLE dbo.Orders ADD SubtotalAmount DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.Orders', N'DiscountAmount') IS NULL
  ALTER TABLE dbo.Orders ADD DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT 0;
IF COL_LENGTH(N'dbo.Orders', N'CouponCode') IS NULL
  ALTER TABLE dbo.Orders ADD CouponCode NVARCHAR(40) NULL;
EXEC(N'UPDATE dbo.Orders SET SubtotalAmount = TotalAmount WHERE SubtotalAmount IS NULL;');

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Coupons (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Code NVARCHAR(40) NOT NULL UNIQUE,
    DiscountType NVARCHAR(10) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
    MinimumOrder DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_Minimum DEFAULT 0,
    MaximumDiscount DECIMAL(18,2) NULL,
    UsageLimit INT NULL,
    UsedCount INT NOT NULL CONSTRAINT DF_Coupons_Used DEFAULT 0,
    StartsAt DATETIME2(0) NOT NULL,
    EndsAt DATETIME2(0) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_Coupons_Active DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Coupons_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Coupons_Updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Coupons_Type CHECK (DiscountType IN (N'percent', N'fixed')),
    CONSTRAINT CK_Coupons_Value CHECK (DiscountValue > 0),
    CONSTRAINT CK_Coupons_Dates CHECK (EndsAt > StartsAt),
    CONSTRAINT CK_Coupons_Usage CHECK (UsageLimit IS NULL OR UsageLimit > 0)
  );
END;

IF OBJECT_ID(N'dbo.CouponRedemptions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CouponRedemptions (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CouponId INT NOT NULL,
    UserId INT NOT NULL,
    OrderId INT NOT NULL UNIQUE,
    DiscountAmount DECIMAL(18,2) NOT NULL,
    ReleasedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CouponRedemptions_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CouponRedemptions_Coupons FOREIGN KEY (CouponId) REFERENCES dbo.Coupons(Id),
    CONSTRAINT FK_CouponRedemptions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_CouponRedemptions_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id)
  );
END;
IF COL_LENGTH(N'dbo.CouponRedemptions', N'ReleasedAt') IS NULL
  ALTER TABLE dbo.CouponRedemptions ADD ReleasedAt DATETIME2(0) NULL;

IF OBJECT_ID(N'dbo.AdminAuditEvents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AdminAuditEvents (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    AdminUserId INT NOT NULL,
    Action NVARCHAR(80) NOT NULL,
    EntityType NVARCHAR(50) NOT NULL,
    EntityId NVARCHAR(80) NULL,
    DetailJson NVARCHAR(MAX) NULL,
    RequestId NVARCHAR(80) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AdminAuditEvents_Created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AdminAuditEvents_Users FOREIGN KEY (AdminUserId) REFERENCES dbo.Users(Id),
    CONSTRAINT CK_AdminAuditEvents_Json CHECK (DetailJson IS NULL OR ISJSON(DetailJson) = 1)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Coupons_Active_Dates')
  CREATE INDEX IX_Coupons_Active_Dates ON dbo.Coupons(IsActive, StartsAt, EndsAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AdminAuditEvents_Created')
  CREATE INDEX IX_AdminAuditEvents_Created ON dbo.AdminAuditEvents(CreatedAt DESC, Id DESC);
`;

const paymentGatewaysSql = `
IF COL_LENGTH(N'dbo.Orders', N'PaymentMethod') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentMethod DEFAULT N'cod';
IF COL_LENGTH(N'dbo.Orders', N'PaymentStatus') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT N'unpaid';
IF COL_LENGTH(N'dbo.Orders', N'PaymentTransactionId') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentTransactionId NVARCHAR(100) NULL;
IF COL_LENGTH(N'dbo.Orders', N'PaymentPaidAt') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentPaidAt DATETIME2(0) NULL;
IF COL_LENGTH(N'dbo.Orders', N'PaymentUrl') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentUrl NVARCHAR(1000) NULL;
`;

export const migrations: readonly DatabaseMigration[] = Object.freeze([
  { version: 1, name: "core_schema_v1_4", sql: schemaSql },
  { version: 2, name: "operations_experiments_v1_5", sql: operationsAndExperimentsSql },
  { version: 3, name: "promotions_audit_v1_6", sql: promotionsAndAuditSql },
  { version: 4, name: "payment_gateways_v1_7", sql: paymentGatewaysSql }
]);

export function migrationChecksum(migration: DatabaseMigration): string {
  return crypto
    .createHash("sha256")
    .update(`${migration.version}:${migration.name}\n${migration.sql}`, "utf8")
    .digest("hex");
}

export function validateMigrations(items: readonly DatabaseMigration[] = migrations): void {
  let previous = 0;
  const names = new Set<string>();
  for (const migration of items) {
    if (!Number.isSafeInteger(migration.version) || migration.version <= previous) {
      throw new Error("Database migrations must use strictly increasing positive versions.");
    }
    if (!/^[a-z0-9_]{3,120}$/.test(migration.name) || names.has(migration.name)) {
      throw new Error(`Invalid or duplicate database migration name: ${migration.name}`);
    }
    if (migration.sql.trim().length === 0) {
      throw new Error(`Database migration ${migration.version} has no SQL.`);
    }
    names.add(migration.name);
    previous = migration.version;
  }
}

export async function runMigrations(pool: sql.ConnectionPool): Promise<number[]> {
  validateMigrations();
  await pool.request().batch(`
    IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SchemaMigrations (
        Version INT NOT NULL PRIMARY KEY,
        Name NVARCHAR(120) NOT NULL UNIQUE,
        Checksum CHAR(64) NOT NULL,
        AppliedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  const applied = await pool.request().query<{ Version: number; Checksum: string }>(
    "SELECT Version, Checksum FROM dbo.SchemaMigrations ORDER BY Version"
  );
  const appliedByVersion = new Map(
    applied.recordset.map((row) => [Number(row.Version), String(row.Checksum).trim().toLowerCase()])
  );
  const newlyApplied: number[] = [];

  for (const migration of migrations) {
    const checksum = migrationChecksum(migration);
    const existingChecksum = appliedByVersion.get(migration.version);
    if (existingChecksum) {
      if (existingChecksum !== checksum) {
        throw new Error(
          `Database migration ${migration.version} (${migration.name}) was modified after it was applied.`
        );
      }
      continue;
    }

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      await transaction.request().batch(migration.sql);
      await transaction.request()
        .input("version", migration.version)
        .input("name", migration.name)
        .input("checksum", checksum)
        .query(`
          INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
          VALUES (@version, @name, @checksum)
        `);
      await transaction.commit();
      newlyApplied.push(migration.version);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  return newlyApplied;
}
