/*
BookGuard - SQL Server 2022 demo databases
Author / owner: Anh Thuan

Open this entire file in SQL Server Management Studio and select Execute (F5).
SQLCMD mode is NOT required. Execute using an account allowed to create databases.
Creates BOTH BookGuardBaseline and BookGuardSecure, including all migrations
and the canonical demo seed: 3 users, 6 categories, 36 books, 60 orders per DB.

The script refuses to run if EITHER target database already exists.
It does not read .env, export current user data, create SQL logins, or drop data.
For Docker, normal db-init automatically provisions app logins/permissions.

Demo website accounts (fictional lab data):
  admin@bookguard.local       / Admin@12345
  customer.a@bookguard.local  / Customer@123
  customer.b@bookguard.local  / Customer@123
Secure passwords use Argon2id; Baseline deliberately uses plaintext for the lab.
*/
USE [master];
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;

IF @@TRANCOUNT <> 0
  THROW 51000, 'Run the complete SQL file outside an existing transaction.', 1;
IF DB_ID(N'BookGuardBaseline') IS NOT NULL OR DB_ID(N'BookGuardSecure') IS NOT NULL
  THROW 51001, 'A target database already exists. No data was changed. Use a fresh SQL Server instance.', 1;

EXEC(N'CREATE DATABASE [BookGuardBaseline];');
EXEC(N'CREATE DATABASE [BookGuardSecure];');

BEGIN TRY

  -- BookGuardBaseline
  BEGIN TRANSACTION;
  EXEC [BookGuardBaseline].sys.sp_executesql N'CREATE TABLE dbo.SchemaMigrations (
  Version INT NOT NULL PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  Checksum CHAR(64) NOT NULL,
  AppliedAt DATETIME2(0) NOT NULL
    CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
);';

  -- Migration 1: core_schema_v1_4
  EXEC [BookGuardBaseline].sys.sp_executesql N'
SET NOCOUNT ON;

IF OBJECT_ID(N''dbo.Roles'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(40) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N''dbo.Users'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordSecret NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(160) NOT NULL,
    Phone NVARCHAR(30) NULL,
    AddressLine NVARCHAR(500) NULL,
    AvatarUrl NVARCHAR(500) NULL,
    RoleId INT NOT NULL,
    TokenVersion INT NOT NULL CONSTRAINT DF_Users_TokenVersion DEFAULT 0,
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    EmailVerifiedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
  );
END;

-- Preserve existing installations: accounts created before v1.3 remain usable,
-- while accounts registered after the migration must verify their email.
IF COL_LENGTH(N''dbo.Users'', N''EmailVerifiedAt'') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2(0) NULL;
  EXEC(N''UPDATE dbo.Users SET EmailVerifiedAt = CreatedAt WHERE EmailVerifiedAt IS NULL;'');
END;

IF OBJECT_ID(N''dbo.Categories'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Categories (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Slug NVARCHAR(140) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N''dbo.Books'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Books (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Slug NVARCHAR(280) NOT NULL UNIQUE,
    Author NVARCHAR(180) NOT NULL,
    Isbn NVARCHAR(20) NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    Stock INT NOT NULL,
    CoverUrl NVARCHAR(600) NULL,
    CategoryId INT NOT NULL,
    IsPublished BIT NOT NULL CONSTRAINT DF_Books_IsPublished DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Books_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT CK_Books_Price CHECK (Price >= 0),
    CONSTRAINT CK_Books_Stock CHECK (Stock >= 0),
    CONSTRAINT FK_Books_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(Id)
  );
END;

IF OBJECT_ID(N''dbo.Reviews'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Reviews (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BookId INT NOT NULL,
    UserId INT NOT NULL,
    Rating TINYINT NOT NULL,
    Content NVARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
    CONSTRAINT FK_Reviews_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id),
    CONSTRAINT FK_Reviews_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.Carts'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Carts (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Carts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Carts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.CartItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.CartItems (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CartId INT NOT NULL,
    BookId INT NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT UQ_CartItems_CartBook UNIQUE (CartId, BookId),
    CONSTRAINT CK_CartItems_Quantity CHECK (Quantity BETWEEN 1 AND 99),
    CONSTRAINT FK_CartItems_Carts FOREIGN KEY (CartId) REFERENCES dbo.Carts(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CartItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF OBJECT_ID(N''dbo.Orders'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Orders (
    Id INT IDENTITY(100,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CustomerName NVARCHAR(160) NOT NULL,
    Phone NVARCHAR(30) NOT NULL,
    ShippingAddress NVARCHAR(500) NOT NULL,
    Note NVARCHAR(1000) NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    IdempotencyKey UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT CK_Orders_Status CHECK (Status IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')),
    CONSTRAINT CK_Orders_Total CHECK (TotalAmount >= 0),
    CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF COL_LENGTH(N''dbo.Orders'', N''IdempotencyKey'') IS NULL
  ALTER TABLE dbo.Orders ADD IdempotencyKey UNIQUEIDENTIFIER NULL;

IF OBJECT_ID(N''dbo.OrderItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderItems (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    BookId INT NOT NULL,
    BookTitle NVARCHAR(255) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity > 0),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF OBJECT_ID(N''dbo.Uploads'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Uploads (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    OriginalName NVARCHAR(255) NOT NULL,
    StoredName NVARCHAR(255) NOT NULL,
    MimeType NVARCHAR(120) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Uploads_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Uploads_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.SecurityEvents'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.SecurityEvents (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RequestId NVARCHAR(80) NOT NULL,
    UserId INT NULL,
    EventType NVARCHAR(80) NOT NULL,
    Severity NVARCHAR(20) NOT NULL,
    IpAddress NVARCHAR(80) NULL,
    Method NVARCHAR(12) NULL,
    Path NVARCHAR(500) NULL,
    Details NVARCHAR(2000) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SecurityEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SecurityEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.RefreshTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.RefreshTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    SessionId UNIQUEIDENTIFIER NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ReplacedByTokenHash CHAR(64) NULL,
    ExpiresAt DATETIME2(0) NOT NULL,
    RevokedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF COL_LENGTH(N''dbo.RefreshTokens'', N''SessionId'') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD SessionId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N''dbo.RefreshTokens'', N''ReplacedByTokenHash'') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD ReplacedByTokenHash CHAR(64) NULL;

IF OBJECT_ID(N''dbo.OrderStatusHistory'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderStatusHistory (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    FromStatus NVARCHAR(30) NULL,
    ToStatus NVARCHAR(30) NOT NULL,
    ChangedByUserId INT NULL,
    Note NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderStatusHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_OrderStatusHistory_FromStatus CHECK (
      FromStatus IS NULL OR FromStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT CK_OrderStatusHistory_ToStatus CHECK (
      ToStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT FK_OrderStatusHistory_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderStatusHistory_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

INSERT INTO dbo.OrderStatusHistory
  (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
SELECT
  o.Id, NULL, o.Status, o.UserId, N''Lịch sử được khởi tạo khi nâng cấp'',
  COALESCE(o.UpdatedAt, o.CreatedAt)
FROM dbo.Orders o
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.OrderStatusHistory h WHERE h.OrderId = o.Id
);

IF OBJECT_ID(N''dbo.PasswordResetTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordResetTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ExpiresAt DATETIME2(0) NOT NULL,
    UsedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PasswordResetTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.EmailVerificationTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.EmailVerificationTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ExpiresAt DATETIME2(0) NOT NULL,
    UsedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmailVerificationTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_EmailVerificationTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.UserSessions'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.UserSessions (
    SessionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    IpAddress NVARCHAR(80) NULL,
    UserAgent NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_LastSeenAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2(0) NOT NULL,
    RevokedAt DATETIME2(0) NULL,
    CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N''FK_RefreshTokens_Sessions''
)
  ALTER TABLE dbo.RefreshTokens
    ADD CONSTRAINT FK_RefreshTokens_Sessions
    FOREIGN KEY (SessionId) REFERENCES dbo.UserSessions(SessionId);

IF OBJECT_ID(N''dbo.WishlistItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.WishlistItems (
    UserId INT NOT NULL,
    BookId INT NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_WishlistItems PRIMARY KEY (UserId, BookId),
    CONSTRAINT FK_WishlistItems_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_WishlistItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Books_Category_Published'')
  CREATE INDEX IX_Books_Category_Published ON dbo.Books(CategoryId, IsPublished);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Orders_User_Created'')
  CREATE INDEX IX_Orders_User_Created ON dbo.Orders(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''UX_Orders_User_Idempotency'')
  CREATE UNIQUE INDEX UX_Orders_User_Idempotency
    ON dbo.Orders(UserId, IdempotencyKey)
    WHERE IdempotencyKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Reviews_Book_Created'')
  CREATE INDEX IX_Reviews_Book_Created ON dbo.Reviews(BookId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_SecurityEvents_Created'')
  CREATE INDEX IX_SecurityEvents_Created ON dbo.SecurityEvents(CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_PasswordResetTokens_User_Active'')
  CREATE INDEX IX_PasswordResetTokens_User_Active
    ON dbo.PasswordResetTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_EmailVerificationTokens_User_Active'')
  CREATE INDEX IX_EmailVerificationTokens_User_Active
    ON dbo.EmailVerificationTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_UserSessions_User_Recent'')
  CREATE INDEX IX_UserSessions_User_Recent
    ON dbo.UserSessions(UserId, CreatedAt DESC)
    INCLUDE (LastSeenAt, ExpiresAt, RevokedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_RefreshTokens_Session_Active'')
  CREATE INDEX IX_RefreshTokens_Session_Active
    ON dbo.RefreshTokens(SessionId, ExpiresAt DESC)
    INCLUDE (RevokedAt, ReplacedByTokenHash);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_WishlistItems_User_Recent'')
  CREATE INDEX IX_WishlistItems_User_Recent ON dbo.WishlistItems(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_OrderStatusHistory_Order_Created'')
  CREATE INDEX IX_OrderStatusHistory_Order_Created
    ON dbo.OrderStatusHistory(OrderId, CreatedAt ASC);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (1, N''core_schema_v1_4'', N''36d588ea7c34d87a82313e13e25930ad7c424be14d69e6121ab692c71756210a'');';

  -- Migration 2: operations_experiments_v1_5
  EXEC [BookGuardBaseline].sys.sp_executesql N'
IF OBJECT_ID(N''dbo.InventoryMovements'', N''U'') IS NULL
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
      MovementType IN (N''opening'', N''sale'', N''return'', N''adjustment'')
    ),
    CONSTRAINT CK_InventoryMovements_Delta CHECK (QuantityDelta <> 0),
    CONSTRAINT CK_InventoryMovements_Balance CHECK (BalanceAfter >= 0),
    CONSTRAINT FK_InventoryMovements_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id),
    CONSTRAINT FK_InventoryMovements_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.OrderNotifications'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderNotifications (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    RecipientEmail NVARCHAR(255) NOT NULL,
    OrderStatus NVARCHAR(30) NOT NULL,
    DeliveryState NVARCHAR(20) NOT NULL CONSTRAINT DF_OrderNotifications_State DEFAULT N''pending'',
    AttemptCount INT NOT NULL CONSTRAINT DF_OrderNotifications_Attempts DEFAULT 0,
    LastError NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderNotifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    SentAt DATETIME2(0) NULL,
    CONSTRAINT CK_OrderNotifications_Status CHECK (
      OrderStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT CK_OrderNotifications_State CHECK (
      DeliveryState IN (N''pending'', N''processing'', N''sent'', N''failed'')
    ),
    CONSTRAINT CK_OrderNotifications_Attempts CHECK (AttemptCount BETWEEN 0 AND 10),
    CONSTRAINT FK_OrderNotifications_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N''dbo.ExperimentRuns'', N''U'') IS NULL
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
    CONSTRAINT CK_ExperimentRuns_Type CHECK (RunType IN (N''security'', N''functional'', N''performance'')),
    CONSTRAINT CK_ExperimentRuns_Mode CHECK (Mode IN (N''baseline'', N''secure'', N''comparison'')),
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_InventoryMovements_Book_Created'')
  CREATE INDEX IX_InventoryMovements_Book_Created
    ON dbo.InventoryMovements(BookId, CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_InventoryMovements_Created'')
  CREATE INDEX IX_InventoryMovements_Created
    ON dbo.InventoryMovements(CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_OrderNotifications_State_Created'')
  CREATE INDEX IX_OrderNotifications_State_Created
    ON dbo.OrderNotifications(DeliveryState, CreatedAt ASC)
    INCLUDE (OrderId, AttemptCount);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_ExperimentRuns_Type_Executed'')
  CREATE INDEX IX_ExperimentRuns_Type_Executed
    ON dbo.ExperimentRuns(RunType, ExecutedAt DESC, Id DESC);

INSERT INTO dbo.InventoryMovements
  (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, CreatedAt)
SELECT
  b.Id, N''opening'', b.Stock, b.Stock, N''migration'', N''Số dư được ghi nhận khi nâng cấp v1.5'',
  COALESCE(b.UpdatedAt, b.CreatedAt)
FROM dbo.Books b
WHERE b.Stock > 0
  AND NOT EXISTS (SELECT 1 FROM dbo.InventoryMovements m WHERE m.BookId = b.Id);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (2, N''operations_experiments_v1_5'', N''adf42a72ec2b4f5cb9a93d34aef6f761244b16a0b64bad26e335b1475ffca593'');';

  -- Migration 3: promotions_audit_v1_6
  EXEC [BookGuardBaseline].sys.sp_executesql N'
IF COL_LENGTH(N''dbo.Orders'', N''SubtotalAmount'') IS NULL
  ALTER TABLE dbo.Orders ADD SubtotalAmount DECIMAL(18,2) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''DiscountAmount'') IS NULL
  ALTER TABLE dbo.Orders ADD DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT 0;
IF COL_LENGTH(N''dbo.Orders'', N''CouponCode'') IS NULL
  ALTER TABLE dbo.Orders ADD CouponCode NVARCHAR(40) NULL;
EXEC(N''UPDATE dbo.Orders SET SubtotalAmount = TotalAmount WHERE SubtotalAmount IS NULL;'');

IF OBJECT_ID(N''dbo.Coupons'', N''U'') IS NULL
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
    CONSTRAINT CK_Coupons_Type CHECK (DiscountType IN (N''percent'', N''fixed'')),
    CONSTRAINT CK_Coupons_Value CHECK (DiscountValue > 0),
    CONSTRAINT CK_Coupons_Dates CHECK (EndsAt > StartsAt),
    CONSTRAINT CK_Coupons_Usage CHECK (UsageLimit IS NULL OR UsageLimit > 0)
  );
END;

IF OBJECT_ID(N''dbo.CouponRedemptions'', N''U'') IS NULL
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
IF COL_LENGTH(N''dbo.CouponRedemptions'', N''ReleasedAt'') IS NULL
  ALTER TABLE dbo.CouponRedemptions ADD ReleasedAt DATETIME2(0) NULL;

IF OBJECT_ID(N''dbo.AdminAuditEvents'', N''U'') IS NULL
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Coupons_Active_Dates'')
  CREATE INDEX IX_Coupons_Active_Dates ON dbo.Coupons(IsActive, StartsAt, EndsAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_AdminAuditEvents_Created'')
  CREATE INDEX IX_AdminAuditEvents_Created ON dbo.AdminAuditEvents(CreatedAt DESC, Id DESC);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (3, N''promotions_audit_v1_6'', N''b2d477c8449b920721cd551dbfe28dc3e17d516e86e5012247e2b762f63bf62a'');';

  -- Migration 4: payment_gateways_v1_7
  EXEC [BookGuardBaseline].sys.sp_executesql N'
IF COL_LENGTH(N''dbo.Orders'', N''PaymentMethod'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentMethod DEFAULT N''cod'';
IF COL_LENGTH(N''dbo.Orders'', N''PaymentStatus'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT N''unpaid'';
IF COL_LENGTH(N''dbo.Orders'', N''PaymentTransactionId'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentTransactionId NVARCHAR(100) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''PaymentPaidAt'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentPaidAt DATETIME2(0) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''PaymentUrl'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentUrl NVARCHAR(1000) NULL;
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (4, N''payment_gateways_v1_7'', N''6bd77a893c4aa7d02cc5a803ff53f545ccd58f5f579ce315a9c138bdf8820795'');';

  -- Migration 5: reliable_payments_notifications_v1_8
  EXEC [BookGuardBaseline].sys.sp_executesql N'
CREATE TABLE dbo.PaymentAttempts (
  Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  OrderId INT NOT NULL,
  TxnRef NVARCHAR(100) NOT NULL UNIQUE,
  Amount DECIMAL(18,2) NOT NULL,
  PaymentUrl NVARCHAR(1000) NOT NULL,
  State NVARCHAR(20) NOT NULL CONSTRAINT DF_PaymentAttempts_State DEFAULT N''pending'',
  TransactionNo NVARCHAR(100) NULL,
  ResponseCode NVARCHAR(2) NULL,
  NeedsReview BIT NOT NULL CONSTRAINT DF_PaymentAttempts_Review DEFAULT 0,
  ReviewReason NVARCHAR(500) NULL,
  RefundReference NVARCHAR(100) NULL,
  ResolvedByUserId INT NULL,
  ResolvedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentAttempts_Created DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentAttempts_Updated DEFAULT SYSUTCDATETIME(),
  ExpiresAt DATETIME2(0) NOT NULL,
  PaidAt DATETIME2(0) NULL,
  CONSTRAINT CK_PaymentAttempts_State CHECK (State IN (N''pending'', N''failed'', N''paid'', N''refunded'')),
  CONSTRAINT CK_PaymentAttempts_Amount CHECK (Amount > 0),
  CONSTRAINT FK_PaymentAttempts_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id),
  CONSTRAINT FK_PaymentAttempts_Resolver FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users(Id)
);
CREATE INDEX IX_PaymentAttempts_Order ON dbo.PaymentAttempts(OrderId, Id DESC);
CREATE INDEX IX_PaymentAttempts_Review ON dbo.PaymentAttempts(NeedsReview, CreatedAt) INCLUDE (OrderId, State);

-- Preserve the last attempt from v4. Older attempts were never saved and cannot be reconstructed.
INSERT INTO dbo.PaymentAttempts (OrderId, TxnRef, Amount, PaymentUrl, State, TransactionNo, ExpiresAt, PaidAt, CreatedAt)
SELECT Id,
  SUBSTRING(PaymentUrl, CHARINDEX(N''vnp_TxnRef='', PaymentUrl) + 11,
    CHARINDEX(N''&'', PaymentUrl + N''&'', CHARINDEX(N''vnp_TxnRef='', PaymentUrl) + 11) - CHARINDEX(N''vnp_TxnRef='', PaymentUrl) - 11),
  TotalAmount, PaymentUrl,
  CASE WHEN PaymentStatus = N''paid'' THEN N''paid'' WHEN PaymentStatus = N''failed'' THEN N''failed'' ELSE N''pending'' END,
  PaymentTransactionId, DATEADD(MINUTE, 15, COALESCE(UpdatedAt, CreatedAt, SYSUTCDATETIME())), PaymentPaidAt, CreatedAt
FROM dbo.Orders
WHERE PaymentMethod = N''vnpay'' AND PaymentUrl IS NOT NULL AND TotalAmount > 0 AND CHARINDEX(N''vnp_TxnRef='', PaymentUrl) > 0;

ALTER TABLE dbo.OrderNotifications ADD
  LeaseToken UNIQUEIDENTIFIER NULL,
  LeaseUntil DATETIME2(0) NULL,
  NextAttemptAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderNotifications_NextAttempt DEFAULT SYSUTCDATETIME();
CREATE INDEX IX_OrderNotifications_Due ON dbo.OrderNotifications(DeliveryState, NextAttemptAt, Id)
  INCLUDE (AttemptCount, LeaseUntil);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (5, N''reliable_payments_notifications_v1_8'', N''0bd733517f199464ccd97d979635e3f5bbc2e53543f02371573f478b8162d40c'');';

  -- Migration 6: auth_cleanup_indexes_v1_9
  EXEC [BookGuardBaseline].sys.sp_executesql N'
ALTER TABLE dbo.UserSessions ADD InvalidAfter AS
  (CASE WHEN RevokedAt IS NOT NULL AND RevokedAt < ExpiresAt THEN RevokedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_UserSessions_Cleanup ON dbo.UserSessions(InvalidAfter, SessionId);
ALTER TABLE dbo.PasswordResetTokens ADD InvalidAfter AS
  (CASE WHEN UsedAt IS NOT NULL AND UsedAt < ExpiresAt THEN UsedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_PasswordResetTokens_Cleanup ON dbo.PasswordResetTokens(InvalidAfter, Id);
ALTER TABLE dbo.EmailVerificationTokens ADD InvalidAfter AS
  (CASE WHEN UsedAt IS NOT NULL AND UsedAt < ExpiresAt THEN UsedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_EmailVerificationTokens_Cleanup ON dbo.EmailVerificationTokens(InvalidAfter, Id);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (6, N''auth_cleanup_indexes_v1_9'', N''bb57ab77dc6d79e5cc5aba8dfc15e294ff6ffc17a71f3b7cffc4d1c22dbc4ef2'');';

  -- Migration 7: deterministic_session_order_v1_10
  EXEC [BookGuardBaseline].sys.sp_executesql N'
ALTER TABLE dbo.UserSessions ADD IssuedOrder BIGINT IDENTITY(1,1) NOT NULL;
DROP INDEX IX_UserSessions_User_Recent ON dbo.UserSessions;
CREATE INDEX IX_UserSessions_User_Recent ON dbo.UserSessions(UserId, CreatedAt DESC, IssuedOrder DESC)
  INCLUDE (LastSeenAt, ExpiresAt, RevokedAt);
';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (7, N''deterministic_session_order_v1_10'', N''4d117b130882fbe50c52394eaf2f6e1bd57e8a01ccbf8481e8b14e441bb63648'');';

  -- Migration 8: bounded_stock_holds_v1_11
  EXEC [BookGuardBaseline].sys.sp_executesql N'
    ALTER TABLE dbo.Orders ADD StockHoldUntil DATETIME2(0) NULL,
      StockReleaseAfter DATETIME2(0) NULL, StockExpiredAt DATETIME2(0) NULL;
    EXEC(N''ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_StockHold CHECK (
      (StockHoldUntil IS NULL AND StockReleaseAfter IS NULL) OR
      (StockHoldUntil IS NOT NULL AND StockReleaseAfter IS NOT NULL AND StockReleaseAfter>StockHoldUntil));'');
    EXEC(N''CREATE INDEX IX_Orders_StockRelease ON dbo.Orders(StockReleaseAfter,Id)
      INCLUDE(Status,PaymentMethod,PaymentStatus) WHERE StockReleaseAfter IS NOT NULL;'');
  ';
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (8, N''bounded_stock_holds_v1_11'', N''daba40db9d36c303be6fdb442f1b4ed068344949d21be4f5465dcc45346ea6b3'');';

  -- Canonical demo data (no existing rows are removed).
  EXEC [BookGuardBaseline].sys.sp_executesql N'INSERT INTO dbo.Roles (Id, Name) VALUES (1, N''admin''), (2, N''customer'');
      INSERT INTO dbo.Categories (Id, Name, Slug) VALUES
        (1, N''Văn học'', N''van-hoc''),
        (2, N''Kỹ năng'', N''ky-nang''),
        (3, N''Công nghệ'', N''cong-nghe''),
        (4, N''Lịch sử - xã hội'', N''lich-su-xa-hoi''),
        (5, N''Kinh doanh'', N''kinh-doanh''),
        (6, N''Thiếu nhi'', N''thieu-nhi'');

SET IDENTITY_INSERT dbo.Users ON;

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (1, N''admin@bookguard.local'', N''Admin@12345'', N''Quản trị BookGuard'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 1, 0, 1, SYSUTCDATETIME());

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (2, N''customer.a@bookguard.local'', N''Customer@123'', N''Nguyễn Minh An'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 2, 0, 1, SYSUTCDATETIME());

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (3, N''customer.b@bookguard.local'', N''Customer@123'', N''Trần Hải Bình'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 2, 0, 1, SYSUTCDATETIME());

SET IDENTITY_INSERT dbo.Users OFF;

SET IDENTITY_INSERT dbo.Books ON;

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (1, N''Nhà Giả Kim'', N''nha-gia-kim'', N''Paulo Coelho'', N''9780061122415'', N''Hành trình đi tìm kho báu và lắng nghe tiếng gọi sâu thẳm của chính mình.'', 79000, 42, N''https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (2, N''Hoàng Tử Bé'', N''hoang-tu-be'', N''Antoine de Saint-Exupéry'', N''9780156012195'', N''Một câu chuyện trong trẻo về tình bạn, trách nhiệm và những điều thật sự quan trọng.'', 68000, 36, N''https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (3, N''Rừng Na Uy'', N''rung-na-uy'', N''Haruki Murakami'', N''9780375704024'', N''Tiểu thuyết giàu cảm xúc về tuổi trẻ, mất mát và hành trình trưởng thành.'', 128000, 28, N''https://covers.openlibrary.org/b/isbn/9780375704024-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (4, N''Dune'', N''dune'', N''Frank Herbert'', N''9780441172719'', N''Thiên sử thi khoa học viễn tưởng về quyền lực, sinh thái và số phận trên hành tinh Arrakis.'', 189000, 24, N''https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (5, N''Atomic Habits'', N''atomic-habits'', N''James Clear'', N''9780735211292'', N''Phương pháp thực tế để xây dựng thói quen tốt bằng những thay đổi nhỏ và bền vững.'', 158000, 55, N''https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (6, N''Đắc Nhân Tâm'', N''dac-nhan-tam'', N''Dale Carnegie'', N''9780671027032'', N''Những nguyên tắc nền tảng giúp giao tiếp chân thành và xây dựng mối quan hệ tích cực.'', 92000, 61, N''https://covers.openlibrary.org/b/isbn/9780671027032-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (7, N''Clean Code'', N''clean-code'', N''Robert C. Martin'', N''9780132350884'', N''Các nguyên tắc và thực hành giúp lập trình viên xây dựng mã nguồn dễ đọc, dễ kiểm thử và bảo trì.'', 315000, 18, N''https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (8, N''The Pragmatic Programmer'', N''the-pragmatic-programmer'', N''David Thomas, Andrew Hunt'', N''9780135957059'', N''Cẩm nang thực hành để phát triển tư duy, kỹ năng và thói quen của một kỹ sư phần mềm chuyên nghiệp.'', 349000, 15, N''https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (9, N''Designing Data-Intensive Applications'', N''designing-data-intensive-applications'', N''Martin Kleppmann'', N''9781449373320'', N''Kiến thức nền tảng về hệ thống dữ liệu tin cậy, có khả năng mở rộng và dễ bảo trì.'', 425000, 12, N''https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (10, N''Sapiens'', N''sapiens'', N''Yuval Noah Harari'', N''9780062316097'', N''Một góc nhìn khái quát về lịch sử loài người từ thời tiền sử đến xã hội hiện đại.'', 219000, 31, N''https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (11, N''Educated'', N''educated'', N''Tara Westover'', N''9780399590504'', N''Hồi ký về sức mạnh của giáo dục và hành trình tự kiến tạo cuộc đời.'', 176000, 20, N''https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (12, N''1984'', N''1984'', N''George Orwell'', N''9780451524935'', N''Tác phẩm kinh điển cảnh báo về giám sát, quyền lực toàn trị và sự thao túng sự thật.'', 112000, 39, N''https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (13, N''Kafka Bên Bờ Biển'', N''kafka-ben-bo-bien'', N''Haruki Murakami'', N''9781400079278'', N''Một hành trình siêu thực đan xen ký ức, định mệnh và những câu hỏi về bản ngã.'', 168000, 22, N''https://covers.openlibrary.org/b/isbn/9781400079278-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (14, N''Giết Con Chim Nhại'', N''giet-con-chim-nhai'', N''Harper Lee'', N''9780061120084'', N''Câu chuyện kinh điển về lòng can đảm, công lý và sự trưởng thành giữa những định kiến.'', 145000, 27, N''https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (15, N''Thư Viện Nửa Đêm'', N''thu-vien-nua-dem'', N''Matt Haig'', N''9780525559474'', N''Một lời nhắc dịu dàng về lựa chọn, tiếc nuối và giá trị của cuộc đời đang sống.'', 139000, 34, N''https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (16, N''Bắt Trẻ Đồng Xanh'', N''bat-tre-dong-xanh'', N''J. D. Salinger'', N''9780316769488'', N''Tiếng nói nổi loạn và cô độc của tuổi trẻ trên hành trình tìm một nơi thuộc về.'', 98000, 31, N''https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (17, N''Tâm Lý Học Về Tiền'', N''tam-ly-hoc-ve-tien'', N''Morgan Housel'', N''9780857197689'', N''Những bài học dễ hiểu về hành vi, rủi ro và cách đưa ra quyết định tài chính dài hạn.'', 159000, 48, N''https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (18, N''Deep Work'', N''deep-work'', N''Cal Newport'', N''9781455586691'', N''Phương pháp rèn luyện khả năng tập trung sâu để tạo ra công việc có giá trị cao.'', 179000, 29, N''https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (19, N''Tư Duy Nhanh Và Chậm'', N''tu-duy-nhanh-va-cham'', N''Daniel Kahneman'', N''9780374533557'', N''Khám phá hai hệ thống tư duy chi phối phán đoán, lựa chọn và những sai lệch thường gặp.'', 249000, 26, N''https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (20, N''Ikigai'', N''ikigai'', N''Héctor García, Francesc Miralles'', N''9780143130727'', N''Gợi mở cách tìm niềm vui, nhịp sống cân bằng và lý do để bắt đầu mỗi ngày.'', 119000, 44, N''https://covers.openlibrary.org/b/isbn/9780143130727-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (21, N''Refactoring'', N''refactoring'', N''Martin Fowler'', N''9780134757599'', N''Hướng dẫn cải tiến cấu trúc mã nguồn có kiểm soát mà không làm thay đổi hành vi hệ thống.'', 499000, 11, N''https://covers.openlibrary.org/b/isbn/9780134757599-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (22, N''Domain-Driven Design'', N''domain-driven-design'', N''Eric Evans'', N''9780321125217'', N''Nền tảng thiết kế phần mềm phức tạp xoay quanh ngôn ngữ và mô hình nghiệp vụ chung.'', 519000, 9, N''https://covers.openlibrary.org/b/isbn/9780321125217-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (23, N''System Design Interview'', N''system-design-interview'', N''Alex Xu'', N''9781736049112'', N''Cách tiếp cận có hệ thống để phân tích yêu cầu và thiết kế các dịch vụ có khả năng mở rộng.'', 389000, 17, N''https://covers.openlibrary.org/b/isbn/9781736049112-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (24, N''The Web Application Hacker''''s Handbook'', N''web-application-hackers-handbook'', N''Dafydd Stuttard, Marcus Pinto'', N''9781118026472'', N''Tài liệu chuyên sâu về cách nhận diện, kiểm thử và hiểu các điểm yếu phổ biến của ứng dụng web.'', 545000, 8, N''https://covers.openlibrary.org/b/isbn/9781118026472-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (25, N''Lược Sử Thời Gian'', N''luoc-su-thoi-gian'', N''Stephen Hawking'', N''9780553380163'', N''Một hành trình dễ tiếp cận qua những câu hỏi lớn về vũ trụ, thời gian và nguồn gốc tồn tại.'', 135000, 33, N''https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (26, N''Súng, Vi Trùng Và Thép'', N''sung-vi-trung-va-thep'', N''Jared Diamond'', N''9780393354324'', N''Phân tích những điều kiện địa lý và sinh thái đã định hình khác biệt giữa các xã hội loài người.'', 239000, 19, N''https://covers.openlibrary.org/b/isbn/9780393354324-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (27, N''Homo Deus'', N''homo-deus'', N''Yuval Noah Harari'', N''9780062464316'', N''Những dự báo và câu hỏi lớn về tương lai con người trong kỷ nguyên dữ liệu và công nghệ.'', 229000, 23, N''https://covers.openlibrary.org/b/isbn/9780062464316-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (28, N''Factfulness'', N''factfulness'', N''Hans Rosling'', N''9781250123824'', N''Bộ công cụ tư duy dựa trên dữ liệu giúp nhìn thế giới rõ ràng và bớt thiên kiến hơn.'', 189000, 25, N''https://covers.openlibrary.org/b/isbn/9781250123824-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (29, N''Start With Why'', N''start-with-why'', N''Simon Sinek'', N''9781591846444'', N''Cách những tổ chức truyền cảm hứng bắt đầu từ mục đích trước khi nói về sản phẩm.'', 169000, 30, N''https://covers.openlibrary.org/b/isbn/9781591846444-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (30, N''Zero to One'', N''zero-to-one'', N''Peter Thiel'', N''9780804139298'', N''Những góc nhìn cô đọng về đổi mới, lợi thế khác biệt và cách xây dựng doanh nghiệp mới.'', 149000, 37, N''https://covers.openlibrary.org/b/isbn/9780804139298-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (31, N''The Lean Startup'', N''the-lean-startup'', N''Eric Ries'', N''9780307887894'', N''Khung thực hành xây dựng, đo lường và học hỏi để phát triển sản phẩm trong điều kiện bất định.'', 199000, 21, N''https://covers.openlibrary.org/b/isbn/9780307887894-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (32, N''Good to Great'', N''good-to-great'', N''Jim Collins'', N''9780066620992'', N''Nghiên cứu những nguyên tắc giúp doanh nghiệp duy trì kỷ luật và chuyển mình bền vững.'', 209000, 18, N''https://covers.openlibrary.org/b/isbn/9780066620992-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (33, N''Matilda'', N''matilda'', N''Roald Dahl'', N''9780142410370'', N''Câu chuyện hóm hỉnh về một cô bé yêu sách, thông minh và không ngại đứng lên vì điều đúng.'', 99000, 35, N''https://covers.openlibrary.org/b/isbn/9780142410370-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (34, N''Charlie Và Nhà Máy Sô-cô-la'', N''charlie-va-nha-may-so-co-la'', N''Roald Dahl'', N''9780142410318'', N''Chuyến phiêu lưu kỳ diệu, tinh nghịch và giàu trí tưởng tượng trong nhà máy của Willy Wonka.'', 105000, 32, N''https://covers.openlibrary.org/b/isbn/9780142410318-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (35, N''Chú Sâu Háu Ăn'', N''chu-sau-hau-an'', N''Eric Carle'', N''9780399226908'', N''Cuốn sách tranh rực rỡ giúp trẻ nhỏ làm quen với số đếm, thức ăn và vòng đời tự nhiên.'', 86000, 46, N''https://covers.openlibrary.org/b/isbn/9780399226908-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (36, N''Nhật Ký Chú Bé Nhút Nhát'', N''nhat-ky-chu-be-nhut-nhat'', N''Jeff Kinney'', N''9781419741852'', N''Những tình huống trường lớp hài hước được kể bằng nhật ký và tranh minh họa gần gũi.'', 95000, 40, N''https://covers.openlibrary.org/b/isbn/9781419741852-L.jpg?default=false'', 6, 1);

SET IDENTITY_INSERT dbo.Books OFF;

INSERT INTO dbo.InventoryMovements
        (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, ChangedByUserId)
      SELECT
        Id, N''opening'', Stock, Stock, N''seed'', N''Số dư kho ban đầu từ bộ dữ liệu chuẩn'', 1
      FROM dbo.Books
      WHERE Stock > 0;

INSERT INTO dbo.Carts (UserId) VALUES (2), (3);

      INSERT INTO dbo.Reviews (BookId, UserId, Rating, Content) VALUES
        (1, 2, 5, N''Một cuốn sách nhẹ nhàng nhưng để lại nhiều suy nghĩ.''),
        (7, 3, 4, N''Nội dung thực tế, phù hợp để đọc lại nhiều lần.''),
        (5, 2, 5, N''Cách trình bày rõ, dễ bắt đầu và có thể áp dụng ngay.''),
        (17, 3, 5, N''Nhiều ví dụ gần gũi, giúp nhìn tiền bạc bình tĩnh hơn.''),
        (25, 2, 4, N''Chủ đề lớn nhưng cách kể cuốn hút và dễ theo dõi.''),
        (33, 3, 5, N''Một cuốn truyện vui và đầy năng lượng cho cả trẻ em lẫn người lớn.'');

      INSERT INTO dbo.WishlistItems (UserId, BookId) VALUES
        (2, 4), (2, 7), (3, 1);

SET IDENTITY_INSERT dbo.Orders ON;

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (101, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 504000,
             DATEADD(DAY, -60, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (101, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (101, 4, N''Dune'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (101, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -60, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (101, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -60, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (102, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 136000,
             DATEADD(DAY, -59, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (102, 2, N''Hoàng Tử Bé'', 68000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (103, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 128000,
             DATEADD(DAY, -58, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (103, 3, N''Rừng Na Uy'', 128000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (104, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 513000,
             DATEADD(DAY, -57, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (104, 4, N''Dune'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (104, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (104, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -57, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (105, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 158000,
             DATEADD(DAY, -56, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (105, 5, N''Atomic Habits'', 158000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (105, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -56, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (105, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -56, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (106, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 184000,
             DATEADD(DAY, -55, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (106, 6, N''Đắc Nhân Tâm'', 92000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (106, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -55, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (106, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -55, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (107, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 534000,
             DATEADD(DAY, -54, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (107, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (107, 10, N''Sapiens'', 219000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (108, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 698000,
             DATEADD(DAY, -53, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (108, 8, N''The Pragmatic Programmer'', 349000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (109, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 425000,
             DATEADD(DAY, -52, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (109, 9, N''Designing Data-Intensive Applications'', 425000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (109, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -52, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (110, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 637000,
             DATEADD(DAY, -51, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (110, 10, N''Sapiens'', 219000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (110, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (110, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -51, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (110, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -51, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (111, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 176000,
             DATEADD(DAY, -50, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (111, 11, N''Educated'', 176000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (111, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -50, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (111, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -50, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (112, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 224000,
             DATEADD(DAY, -49, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (112, 12, N''1984'', 112000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (113, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 266000,
             DATEADD(DAY, -48, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (113, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (113, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (114, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 290000,
             DATEADD(DAY, -47, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (114, 14, N''Giết Con Chim Nhại'', 145000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (114, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -47, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (115, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 139000,
             DATEADD(DAY, -46, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (115, 15, N''Thư Viện Nửa Đêm'', 139000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (115, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -46, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (115, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -46, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (116, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 275000,
             DATEADD(DAY, -45, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (116, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (116, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (116, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -45, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (116, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -45, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (117, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 159000,
             DATEADD(DAY, -44, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (117, 17, N''Tâm Lý Học Về Tiền'', 159000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (118, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 358000,
             DATEADD(DAY, -43, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (118, 18, N''Deep Work'', 179000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (119, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 768000,
             DATEADD(DAY, -42, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (119, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (119, 22, N''Domain-Driven Design'', 519000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (119, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -42, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (120, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 238000,
             DATEADD(DAY, -41, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (120, 20, N''Ikigai'', 119000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (120, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -41, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (120, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -41, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (121, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 499000,
             DATEADD(DAY, -40, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (121, 21, N''Refactoring'', 499000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (121, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -40, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (121, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -40, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (122, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1353000,
             DATEADD(DAY, -39, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (122, 22, N''Domain-Driven Design'', 519000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (122, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (123, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 389000,
             DATEADD(DAY, -38, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (123, 23, N''System Design Interview'', 389000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (124, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1090000,
             DATEADD(DAY, -37, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (124, 24, N''The Web Application Hacker''''s Handbook'', 545000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (124, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -37, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (125, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 324000,
             DATEADD(DAY, -36, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (125, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (125, 28, N''Factfulness'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (125, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -36, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (125, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -36, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (126, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 478000,
             DATEADD(DAY, -35, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (126, 26, N''Súng, Vi Trùng Và Thép'', 239000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (126, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -35, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (126, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -35, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (127, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 229000,
             DATEADD(DAY, -34, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (127, 27, N''Homo Deus'', 229000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (128, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 546000,
             DATEADD(DAY, -33, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (128, 28, N''Factfulness'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (128, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (129, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 169000,
             DATEADD(DAY, -32, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (129, 29, N''Start With Why'', 169000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (129, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -32, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (130, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 298000,
             DATEADD(DAY, -31, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (130, 30, N''Zero to One'', 149000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (130, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -31, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (130, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -31, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (131, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 304000,
             DATEADD(DAY, -30, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (131, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (131, 34, N''Charlie Và Nhà Máy Sô-cô-la'', 105000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (131, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -30, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (131, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -30, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (132, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 418000,
             DATEADD(DAY, -29, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (132, 32, N''Good to Great'', 209000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (133, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 99000,
             DATEADD(DAY, -28, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (133, 33, N''Matilda'', 99000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (134, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 459000,
             DATEADD(DAY, -27, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (134, 34, N''Charlie Và Nhà Máy Sô-cô-la'', 105000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (134, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (134, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -27, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (135, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 86000,
             DATEADD(DAY, -26, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (135, 35, N''Chú Sâu Háu Ăn'', 86000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (135, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -26, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (135, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -26, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (136, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 190000,
             DATEADD(DAY, -25, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (136, 36, N''Nhật Ký Chú Bé Nhút Nhát'', 95000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (136, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -25, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (136, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -25, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (137, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 268000,
             DATEADD(DAY, -24, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (137, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (137, 4, N''Dune'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (138, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 136000,
             DATEADD(DAY, -23, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (138, 2, N''Hoàng Tử Bé'', 68000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (139, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 128000,
             DATEADD(DAY, -22, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (139, 3, N''Rừng Na Uy'', 128000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (139, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -22, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (140, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 513000,
             DATEADD(DAY, -21, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (140, 4, N''Dune'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (140, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (140, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -21, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (140, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -21, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (141, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 158000,
             DATEADD(DAY, -20, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (141, 5, N''Atomic Habits'', 158000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (141, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -20, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (141, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -20, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (142, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 184000,
             DATEADD(DAY, -19, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (142, 6, N''Đắc Nhân Tâm'', 92000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (143, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 534000,
             DATEADD(DAY, -18, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (143, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (143, 10, N''Sapiens'', 219000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (144, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 698000,
             DATEADD(DAY, -17, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (144, 8, N''The Pragmatic Programmer'', 349000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (144, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -17, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (145, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 425000,
             DATEADD(DAY, -16, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (145, 9, N''Designing Data-Intensive Applications'', 425000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (145, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -16, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (145, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -16, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (146, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 637000,
             DATEADD(DAY, -15, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (146, 10, N''Sapiens'', 219000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (146, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (146, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -15, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (146, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -15, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (147, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 176000,
             DATEADD(DAY, -14, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (147, 11, N''Educated'', 176000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (148, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 224000,
             DATEADD(DAY, -13, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (148, 12, N''1984'', 112000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (149, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 266000,
             DATEADD(DAY, -12, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (149, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (149, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (149, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -12, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (150, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 290000,
             DATEADD(DAY, -11, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (150, 14, N''Giết Con Chim Nhại'', 145000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (150, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -11, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (150, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -11, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (151, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 139000,
             DATEADD(DAY, -10, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (151, 15, N''Thư Viện Nửa Đêm'', 139000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (151, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -10, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (151, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -10, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (152, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 275000,
             DATEADD(DAY, -9, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (152, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (152, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (153, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 159000,
             DATEADD(DAY, -8, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (153, 17, N''Tâm Lý Học Về Tiền'', 159000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (154, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 358000,
             DATEADD(DAY, -7, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (154, 18, N''Deep Work'', 179000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (154, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -7, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (155, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 768000,
             DATEADD(DAY, -6, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (155, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (155, 22, N''Domain-Driven Design'', 519000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (155, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -6, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (155, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -6, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (156, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 238000,
             DATEADD(DAY, -5, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (156, 20, N''Ikigai'', 119000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (156, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -5, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (156, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -5, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (157, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 499000,
             DATEADD(DAY, -4, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (157, 21, N''Refactoring'', 499000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (158, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1353000,
             DATEADD(DAY, -3, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (158, 22, N''Domain-Driven Design'', 519000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (158, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (159, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 389000,
             DATEADD(DAY, -2, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (159, 23, N''System Design Interview'', 389000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (159, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -2, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (160, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1090000,
             DATEADD(DAY, -1, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (160, 24, N''The Web Application Hacker''''s Handbook'', 545000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (160, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -1, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (160, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -1, SYSUTCDATETIME())));

SET IDENTITY_INSERT dbo.Orders OFF;';
  COMMIT TRANSACTION;

  -- BookGuardSecure
  BEGIN TRANSACTION;
  EXEC [BookGuardSecure].sys.sp_executesql N'CREATE TABLE dbo.SchemaMigrations (
  Version INT NOT NULL PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL UNIQUE,
  Checksum CHAR(64) NOT NULL,
  AppliedAt DATETIME2(0) NOT NULL
    CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
);';

  -- Migration 1: core_schema_v1_4
  EXEC [BookGuardSecure].sys.sp_executesql N'
SET NOCOUNT ON;

IF OBJECT_ID(N''dbo.Roles'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(40) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N''dbo.Users'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordSecret NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(160) NOT NULL,
    Phone NVARCHAR(30) NULL,
    AddressLine NVARCHAR(500) NULL,
    AvatarUrl NVARCHAR(500) NULL,
    RoleId INT NOT NULL,
    TokenVersion INT NOT NULL CONSTRAINT DF_Users_TokenVersion DEFAULT 0,
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    EmailVerifiedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
  );
END;

-- Preserve existing installations: accounts created before v1.3 remain usable,
-- while accounts registered after the migration must verify their email.
IF COL_LENGTH(N''dbo.Users'', N''EmailVerifiedAt'') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2(0) NULL;
  EXEC(N''UPDATE dbo.Users SET EmailVerifiedAt = CreatedAt WHERE EmailVerifiedAt IS NULL;'');
END;

IF OBJECT_ID(N''dbo.Categories'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Categories (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Slug NVARCHAR(140) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N''dbo.Books'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Books (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Slug NVARCHAR(280) NOT NULL UNIQUE,
    Author NVARCHAR(180) NOT NULL,
    Isbn NVARCHAR(20) NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    Stock INT NOT NULL,
    CoverUrl NVARCHAR(600) NULL,
    CategoryId INT NOT NULL,
    IsPublished BIT NOT NULL CONSTRAINT DF_Books_IsPublished DEFAULT 1,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Books_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT CK_Books_Price CHECK (Price >= 0),
    CONSTRAINT CK_Books_Stock CHECK (Stock >= 0),
    CONSTRAINT FK_Books_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(Id)
  );
END;

IF OBJECT_ID(N''dbo.Reviews'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Reviews (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BookId INT NOT NULL,
    UserId INT NOT NULL,
    Rating TINYINT NOT NULL,
    Content NVARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Reviews_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5),
    CONSTRAINT FK_Reviews_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id),
    CONSTRAINT FK_Reviews_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.Carts'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Carts (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Carts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Carts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.CartItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.CartItems (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CartId INT NOT NULL,
    BookId INT NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT UQ_CartItems_CartBook UNIQUE (CartId, BookId),
    CONSTRAINT CK_CartItems_Quantity CHECK (Quantity BETWEEN 1 AND 99),
    CONSTRAINT FK_CartItems_Carts FOREIGN KEY (CartId) REFERENCES dbo.Carts(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CartItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF OBJECT_ID(N''dbo.Orders'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Orders (
    Id INT IDENTITY(100,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    CustomerName NVARCHAR(160) NOT NULL,
    Phone NVARCHAR(30) NOT NULL,
    ShippingAddress NVARCHAR(500) NOT NULL,
    Note NVARCHAR(1000) NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    IdempotencyKey UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    CONSTRAINT CK_Orders_Status CHECK (Status IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')),
    CONSTRAINT CK_Orders_Total CHECK (TotalAmount >= 0),
    CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF COL_LENGTH(N''dbo.Orders'', N''IdempotencyKey'') IS NULL
  ALTER TABLE dbo.Orders ADD IdempotencyKey UNIQUEIDENTIFIER NULL;

IF OBJECT_ID(N''dbo.OrderItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderItems (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    BookId INT NOT NULL,
    BookTitle NVARCHAR(255) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity > 0),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF OBJECT_ID(N''dbo.Uploads'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.Uploads (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    OriginalName NVARCHAR(255) NOT NULL,
    StoredName NVARCHAR(255) NOT NULL,
    MimeType NVARCHAR(120) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Uploads_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Uploads_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.SecurityEvents'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.SecurityEvents (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RequestId NVARCHAR(80) NOT NULL,
    UserId INT NULL,
    EventType NVARCHAR(80) NOT NULL,
    Severity NVARCHAR(20) NOT NULL,
    IpAddress NVARCHAR(80) NULL,
    Method NVARCHAR(12) NULL,
    Path NVARCHAR(500) NULL,
    Details NVARCHAR(2000) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SecurityEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_SecurityEvents_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.RefreshTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.RefreshTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    SessionId UNIQUEIDENTIFIER NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ReplacedByTokenHash CHAR(64) NULL,
    ExpiresAt DATETIME2(0) NOT NULL,
    RevokedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF COL_LENGTH(N''dbo.RefreshTokens'', N''SessionId'') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD SessionId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N''dbo.RefreshTokens'', N''ReplacedByTokenHash'') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD ReplacedByTokenHash CHAR(64) NULL;

IF OBJECT_ID(N''dbo.OrderStatusHistory'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderStatusHistory (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    FromStatus NVARCHAR(30) NULL,
    ToStatus NVARCHAR(30) NOT NULL,
    ChangedByUserId INT NULL,
    Note NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderStatusHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_OrderStatusHistory_FromStatus CHECK (
      FromStatus IS NULL OR FromStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT CK_OrderStatusHistory_ToStatus CHECK (
      ToStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT FK_OrderStatusHistory_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderStatusHistory_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

INSERT INTO dbo.OrderStatusHistory
  (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
SELECT
  o.Id, NULL, o.Status, o.UserId, N''Lịch sử được khởi tạo khi nâng cấp'',
  COALESCE(o.UpdatedAt, o.CreatedAt)
FROM dbo.Orders o
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.OrderStatusHistory h WHERE h.OrderId = o.Id
);

IF OBJECT_ID(N''dbo.PasswordResetTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordResetTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ExpiresAt DATETIME2(0) NOT NULL,
    UsedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PasswordResetTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.EmailVerificationTokens'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.EmailVerificationTokens (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    TokenHash CHAR(64) NOT NULL UNIQUE,
    ExpiresAt DATETIME2(0) NOT NULL,
    UsedAt DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmailVerificationTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_EmailVerificationTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.UserSessions'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.UserSessions (
    SessionId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserId INT NOT NULL,
    IpAddress NVARCHAR(80) NULL,
    UserAgent NVARCHAR(500) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    LastSeenAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserSessions_LastSeenAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2(0) NOT NULL,
    RevokedAt DATETIME2(0) NULL,
    CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N''FK_RefreshTokens_Sessions''
)
  ALTER TABLE dbo.RefreshTokens
    ADD CONSTRAINT FK_RefreshTokens_Sessions
    FOREIGN KEY (SessionId) REFERENCES dbo.UserSessions(SessionId);

IF OBJECT_ID(N''dbo.WishlistItems'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.WishlistItems (
    UserId INT NOT NULL,
    BookId INT NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_WishlistItems PRIMARY KEY (UserId, BookId),
    CONSTRAINT FK_WishlistItems_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_WishlistItems_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Books_Category_Published'')
  CREATE INDEX IX_Books_Category_Published ON dbo.Books(CategoryId, IsPublished);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Orders_User_Created'')
  CREATE INDEX IX_Orders_User_Created ON dbo.Orders(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''UX_Orders_User_Idempotency'')
  CREATE UNIQUE INDEX UX_Orders_User_Idempotency
    ON dbo.Orders(UserId, IdempotencyKey)
    WHERE IdempotencyKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Reviews_Book_Created'')
  CREATE INDEX IX_Reviews_Book_Created ON dbo.Reviews(BookId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_SecurityEvents_Created'')
  CREATE INDEX IX_SecurityEvents_Created ON dbo.SecurityEvents(CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_PasswordResetTokens_User_Active'')
  CREATE INDEX IX_PasswordResetTokens_User_Active
    ON dbo.PasswordResetTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_EmailVerificationTokens_User_Active'')
  CREATE INDEX IX_EmailVerificationTokens_User_Active
    ON dbo.EmailVerificationTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_UserSessions_User_Recent'')
  CREATE INDEX IX_UserSessions_User_Recent
    ON dbo.UserSessions(UserId, CreatedAt DESC)
    INCLUDE (LastSeenAt, ExpiresAt, RevokedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_RefreshTokens_Session_Active'')
  CREATE INDEX IX_RefreshTokens_Session_Active
    ON dbo.RefreshTokens(SessionId, ExpiresAt DESC)
    INCLUDE (RevokedAt, ReplacedByTokenHash);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_WishlistItems_User_Recent'')
  CREATE INDEX IX_WishlistItems_User_Recent ON dbo.WishlistItems(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_OrderStatusHistory_Order_Created'')
  CREATE INDEX IX_OrderStatusHistory_Order_Created
    ON dbo.OrderStatusHistory(OrderId, CreatedAt ASC);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (1, N''core_schema_v1_4'', N''36d588ea7c34d87a82313e13e25930ad7c424be14d69e6121ab692c71756210a'');';

  -- Migration 2: operations_experiments_v1_5
  EXEC [BookGuardSecure].sys.sp_executesql N'
IF OBJECT_ID(N''dbo.InventoryMovements'', N''U'') IS NULL
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
      MovementType IN (N''opening'', N''sale'', N''return'', N''adjustment'')
    ),
    CONSTRAINT CK_InventoryMovements_Delta CHECK (QuantityDelta <> 0),
    CONSTRAINT CK_InventoryMovements_Balance CHECK (BalanceAfter >= 0),
    CONSTRAINT FK_InventoryMovements_Books FOREIGN KEY (BookId) REFERENCES dbo.Books(Id),
    CONSTRAINT FK_InventoryMovements_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N''dbo.OrderNotifications'', N''U'') IS NULL
BEGIN
  CREATE TABLE dbo.OrderNotifications (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderId INT NOT NULL,
    RecipientEmail NVARCHAR(255) NOT NULL,
    OrderStatus NVARCHAR(30) NOT NULL,
    DeliveryState NVARCHAR(20) NOT NULL CONSTRAINT DF_OrderNotifications_State DEFAULT N''pending'',
    AttemptCount INT NOT NULL CONSTRAINT DF_OrderNotifications_Attempts DEFAULT 0,
    LastError NVARCHAR(1000) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderNotifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    SentAt DATETIME2(0) NULL,
    CONSTRAINT CK_OrderNotifications_Status CHECK (
      OrderStatus IN (N''pending'', N''confirmed'', N''shipping'', N''completed'', N''cancelled'')
    ),
    CONSTRAINT CK_OrderNotifications_State CHECK (
      DeliveryState IN (N''pending'', N''processing'', N''sent'', N''failed'')
    ),
    CONSTRAINT CK_OrderNotifications_Attempts CHECK (AttemptCount BETWEEN 0 AND 10),
    CONSTRAINT FK_OrderNotifications_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE
  );
END;

IF OBJECT_ID(N''dbo.ExperimentRuns'', N''U'') IS NULL
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
    CONSTRAINT CK_ExperimentRuns_Type CHECK (RunType IN (N''security'', N''functional'', N''performance'')),
    CONSTRAINT CK_ExperimentRuns_Mode CHECK (Mode IN (N''baseline'', N''secure'', N''comparison'')),
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_InventoryMovements_Book_Created'')
  CREATE INDEX IX_InventoryMovements_Book_Created
    ON dbo.InventoryMovements(BookId, CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_InventoryMovements_Created'')
  CREATE INDEX IX_InventoryMovements_Created
    ON dbo.InventoryMovements(CreatedAt DESC, Id DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_OrderNotifications_State_Created'')
  CREATE INDEX IX_OrderNotifications_State_Created
    ON dbo.OrderNotifications(DeliveryState, CreatedAt ASC)
    INCLUDE (OrderId, AttemptCount);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_ExperimentRuns_Type_Executed'')
  CREATE INDEX IX_ExperimentRuns_Type_Executed
    ON dbo.ExperimentRuns(RunType, ExecutedAt DESC, Id DESC);

INSERT INTO dbo.InventoryMovements
  (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, CreatedAt)
SELECT
  b.Id, N''opening'', b.Stock, b.Stock, N''migration'', N''Số dư được ghi nhận khi nâng cấp v1.5'',
  COALESCE(b.UpdatedAt, b.CreatedAt)
FROM dbo.Books b
WHERE b.Stock > 0
  AND NOT EXISTS (SELECT 1 FROM dbo.InventoryMovements m WHERE m.BookId = b.Id);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (2, N''operations_experiments_v1_5'', N''adf42a72ec2b4f5cb9a93d34aef6f761244b16a0b64bad26e335b1475ffca593'');';

  -- Migration 3: promotions_audit_v1_6
  EXEC [BookGuardSecure].sys.sp_executesql N'
IF COL_LENGTH(N''dbo.Orders'', N''SubtotalAmount'') IS NULL
  ALTER TABLE dbo.Orders ADD SubtotalAmount DECIMAL(18,2) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''DiscountAmount'') IS NULL
  ALTER TABLE dbo.Orders ADD DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT 0;
IF COL_LENGTH(N''dbo.Orders'', N''CouponCode'') IS NULL
  ALTER TABLE dbo.Orders ADD CouponCode NVARCHAR(40) NULL;
EXEC(N''UPDATE dbo.Orders SET SubtotalAmount = TotalAmount WHERE SubtotalAmount IS NULL;'');

IF OBJECT_ID(N''dbo.Coupons'', N''U'') IS NULL
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
    CONSTRAINT CK_Coupons_Type CHECK (DiscountType IN (N''percent'', N''fixed'')),
    CONSTRAINT CK_Coupons_Value CHECK (DiscountValue > 0),
    CONSTRAINT CK_Coupons_Dates CHECK (EndsAt > StartsAt),
    CONSTRAINT CK_Coupons_Usage CHECK (UsageLimit IS NULL OR UsageLimit > 0)
  );
END;

IF OBJECT_ID(N''dbo.CouponRedemptions'', N''U'') IS NULL
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
IF COL_LENGTH(N''dbo.CouponRedemptions'', N''ReleasedAt'') IS NULL
  ALTER TABLE dbo.CouponRedemptions ADD ReleasedAt DATETIME2(0) NULL;

IF OBJECT_ID(N''dbo.AdminAuditEvents'', N''U'') IS NULL
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_Coupons_Active_Dates'')
  CREATE INDEX IX_Coupons_Active_Dates ON dbo.Coupons(IsActive, StartsAt, EndsAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''IX_AdminAuditEvents_Created'')
  CREATE INDEX IX_AdminAuditEvents_Created ON dbo.AdminAuditEvents(CreatedAt DESC, Id DESC);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (3, N''promotions_audit_v1_6'', N''b2d477c8449b920721cd551dbfe28dc3e17d516e86e5012247e2b762f63bf62a'');';

  -- Migration 4: payment_gateways_v1_7
  EXEC [BookGuardSecure].sys.sp_executesql N'
IF COL_LENGTH(N''dbo.Orders'', N''PaymentMethod'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentMethod NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentMethod DEFAULT N''cod'';
IF COL_LENGTH(N''dbo.Orders'', N''PaymentStatus'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT N''unpaid'';
IF COL_LENGTH(N''dbo.Orders'', N''PaymentTransactionId'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentTransactionId NVARCHAR(100) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''PaymentPaidAt'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentPaidAt DATETIME2(0) NULL;
IF COL_LENGTH(N''dbo.Orders'', N''PaymentUrl'') IS NULL
  ALTER TABLE dbo.Orders ADD PaymentUrl NVARCHAR(1000) NULL;
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (4, N''payment_gateways_v1_7'', N''6bd77a893c4aa7d02cc5a803ff53f545ccd58f5f579ce315a9c138bdf8820795'');';

  -- Migration 5: reliable_payments_notifications_v1_8
  EXEC [BookGuardSecure].sys.sp_executesql N'
CREATE TABLE dbo.PaymentAttempts (
  Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  OrderId INT NOT NULL,
  TxnRef NVARCHAR(100) NOT NULL UNIQUE,
  Amount DECIMAL(18,2) NOT NULL,
  PaymentUrl NVARCHAR(1000) NOT NULL,
  State NVARCHAR(20) NOT NULL CONSTRAINT DF_PaymentAttempts_State DEFAULT N''pending'',
  TransactionNo NVARCHAR(100) NULL,
  ResponseCode NVARCHAR(2) NULL,
  NeedsReview BIT NOT NULL CONSTRAINT DF_PaymentAttempts_Review DEFAULT 0,
  ReviewReason NVARCHAR(500) NULL,
  RefundReference NVARCHAR(100) NULL,
  ResolvedByUserId INT NULL,
  ResolvedAt DATETIME2(0) NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentAttempts_Created DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentAttempts_Updated DEFAULT SYSUTCDATETIME(),
  ExpiresAt DATETIME2(0) NOT NULL,
  PaidAt DATETIME2(0) NULL,
  CONSTRAINT CK_PaymentAttempts_State CHECK (State IN (N''pending'', N''failed'', N''paid'', N''refunded'')),
  CONSTRAINT CK_PaymentAttempts_Amount CHECK (Amount > 0),
  CONSTRAINT FK_PaymentAttempts_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id),
  CONSTRAINT FK_PaymentAttempts_Resolver FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users(Id)
);
CREATE INDEX IX_PaymentAttempts_Order ON dbo.PaymentAttempts(OrderId, Id DESC);
CREATE INDEX IX_PaymentAttempts_Review ON dbo.PaymentAttempts(NeedsReview, CreatedAt) INCLUDE (OrderId, State);

-- Preserve the last attempt from v4. Older attempts were never saved and cannot be reconstructed.
INSERT INTO dbo.PaymentAttempts (OrderId, TxnRef, Amount, PaymentUrl, State, TransactionNo, ExpiresAt, PaidAt, CreatedAt)
SELECT Id,
  SUBSTRING(PaymentUrl, CHARINDEX(N''vnp_TxnRef='', PaymentUrl) + 11,
    CHARINDEX(N''&'', PaymentUrl + N''&'', CHARINDEX(N''vnp_TxnRef='', PaymentUrl) + 11) - CHARINDEX(N''vnp_TxnRef='', PaymentUrl) - 11),
  TotalAmount, PaymentUrl,
  CASE WHEN PaymentStatus = N''paid'' THEN N''paid'' WHEN PaymentStatus = N''failed'' THEN N''failed'' ELSE N''pending'' END,
  PaymentTransactionId, DATEADD(MINUTE, 15, COALESCE(UpdatedAt, CreatedAt, SYSUTCDATETIME())), PaymentPaidAt, CreatedAt
FROM dbo.Orders
WHERE PaymentMethod = N''vnpay'' AND PaymentUrl IS NOT NULL AND TotalAmount > 0 AND CHARINDEX(N''vnp_TxnRef='', PaymentUrl) > 0;

ALTER TABLE dbo.OrderNotifications ADD
  LeaseToken UNIQUEIDENTIFIER NULL,
  LeaseUntil DATETIME2(0) NULL,
  NextAttemptAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderNotifications_NextAttempt DEFAULT SYSUTCDATETIME();
CREATE INDEX IX_OrderNotifications_Due ON dbo.OrderNotifications(DeliveryState, NextAttemptAt, Id)
  INCLUDE (AttemptCount, LeaseUntil);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (5, N''reliable_payments_notifications_v1_8'', N''0bd733517f199464ccd97d979635e3f5bbc2e53543f02371573f478b8162d40c'');';

  -- Migration 6: auth_cleanup_indexes_v1_9
  EXEC [BookGuardSecure].sys.sp_executesql N'
ALTER TABLE dbo.UserSessions ADD InvalidAfter AS
  (CASE WHEN RevokedAt IS NOT NULL AND RevokedAt < ExpiresAt THEN RevokedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_UserSessions_Cleanup ON dbo.UserSessions(InvalidAfter, SessionId);
ALTER TABLE dbo.PasswordResetTokens ADD InvalidAfter AS
  (CASE WHEN UsedAt IS NOT NULL AND UsedAt < ExpiresAt THEN UsedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_PasswordResetTokens_Cleanup ON dbo.PasswordResetTokens(InvalidAfter, Id);
ALTER TABLE dbo.EmailVerificationTokens ADD InvalidAfter AS
  (CASE WHEN UsedAt IS NOT NULL AND UsedAt < ExpiresAt THEN UsedAt ELSE ExpiresAt END) PERSISTED;
CREATE INDEX IX_EmailVerificationTokens_Cleanup ON dbo.EmailVerificationTokens(InvalidAfter, Id);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (6, N''auth_cleanup_indexes_v1_9'', N''bb57ab77dc6d79e5cc5aba8dfc15e294ff6ffc17a71f3b7cffc4d1c22dbc4ef2'');';

  -- Migration 7: deterministic_session_order_v1_10
  EXEC [BookGuardSecure].sys.sp_executesql N'
ALTER TABLE dbo.UserSessions ADD IssuedOrder BIGINT IDENTITY(1,1) NOT NULL;
DROP INDEX IX_UserSessions_User_Recent ON dbo.UserSessions;
CREATE INDEX IX_UserSessions_User_Recent ON dbo.UserSessions(UserId, CreatedAt DESC, IssuedOrder DESC)
  INCLUDE (LastSeenAt, ExpiresAt, RevokedAt);
';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (7, N''deterministic_session_order_v1_10'', N''4d117b130882fbe50c52394eaf2f6e1bd57e8a01ccbf8481e8b14e441bb63648'');';

  -- Migration 8: bounded_stock_holds_v1_11
  EXEC [BookGuardSecure].sys.sp_executesql N'
    ALTER TABLE dbo.Orders ADD StockHoldUntil DATETIME2(0) NULL,
      StockReleaseAfter DATETIME2(0) NULL, StockExpiredAt DATETIME2(0) NULL;
    EXEC(N''ALTER TABLE dbo.Orders ADD CONSTRAINT CK_Orders_StockHold CHECK (
      (StockHoldUntil IS NULL AND StockReleaseAfter IS NULL) OR
      (StockHoldUntil IS NOT NULL AND StockReleaseAfter IS NOT NULL AND StockReleaseAfter>StockHoldUntil));'');
    EXEC(N''CREATE INDEX IX_Orders_StockRelease ON dbo.Orders(StockReleaseAfter,Id)
      INCLUDE(Status,PaymentMethod,PaymentStatus) WHERE StockReleaseAfter IS NOT NULL;'');
  ';
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.SchemaMigrations (Version, Name, Checksum)
VALUES (8, N''bounded_stock_holds_v1_11'', N''daba40db9d36c303be6fdb442f1b4ed068344949d21be4f5465dcc45346ea6b3'');';

  -- Canonical demo data (no existing rows are removed).
  EXEC [BookGuardSecure].sys.sp_executesql N'INSERT INTO dbo.Roles (Id, Name) VALUES (1, N''admin''), (2, N''customer'');
      INSERT INTO dbo.Categories (Id, Name, Slug) VALUES
        (1, N''Văn học'', N''van-hoc''),
        (2, N''Kỹ năng'', N''ky-nang''),
        (3, N''Công nghệ'', N''cong-nghe''),
        (4, N''Lịch sử - xã hội'', N''lich-su-xa-hoi''),
        (5, N''Kinh doanh'', N''kinh-doanh''),
        (6, N''Thiếu nhi'', N''thieu-nhi'');

SET IDENTITY_INSERT dbo.Users ON;

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (1, N''admin@bookguard.local'', N''$argon2id$v=19$m=19456,t=2,p=1$VL0H5e0VI6VBQJ1v02jjuw$0BSOo3OmdpWrUOsvv8Gu1uPA7OVXe20D1VBQ/0jMpNU'', N''Quản trị BookGuard'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 1, 0, 1, SYSUTCDATETIME());

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (2, N''customer.a@bookguard.local'', N''$argon2id$v=19$m=19456,t=2,p=1$lwJ2A1Ln4JDpeKX7AHLDHQ$kw2LvWH6UkqpjwFjkPzetxm5Fq20ytUEHm5w0s/HgBs'', N''Nguyễn Minh An'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 2, 0, 1, SYSUTCDATETIME());

INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (3, N''customer.b@bookguard.local'', N''$argon2id$v=19$m=19456,t=2,p=1$3bTifkJ0F77d4JHwqCj6EQ$8oh6pchdDkwMA/qWEWlGvnjXgxh3XK1jSzqRjF9x9yk'', N''Trần Hải Bình'', N''0900000000'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', 2, 0, 1, SYSUTCDATETIME());

SET IDENTITY_INSERT dbo.Users OFF;

SET IDENTITY_INSERT dbo.Books ON;

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (1, N''Nhà Giả Kim'', N''nha-gia-kim'', N''Paulo Coelho'', N''9780061122415'', N''Hành trình đi tìm kho báu và lắng nghe tiếng gọi sâu thẳm của chính mình.'', 79000, 42, N''https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (2, N''Hoàng Tử Bé'', N''hoang-tu-be'', N''Antoine de Saint-Exupéry'', N''9780156012195'', N''Một câu chuyện trong trẻo về tình bạn, trách nhiệm và những điều thật sự quan trọng.'', 68000, 36, N''https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (3, N''Rừng Na Uy'', N''rung-na-uy'', N''Haruki Murakami'', N''9780375704024'', N''Tiểu thuyết giàu cảm xúc về tuổi trẻ, mất mát và hành trình trưởng thành.'', 128000, 28, N''https://covers.openlibrary.org/b/isbn/9780375704024-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (4, N''Dune'', N''dune'', N''Frank Herbert'', N''9780441172719'', N''Thiên sử thi khoa học viễn tưởng về quyền lực, sinh thái và số phận trên hành tinh Arrakis.'', 189000, 24, N''https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (5, N''Atomic Habits'', N''atomic-habits'', N''James Clear'', N''9780735211292'', N''Phương pháp thực tế để xây dựng thói quen tốt bằng những thay đổi nhỏ và bền vững.'', 158000, 55, N''https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (6, N''Đắc Nhân Tâm'', N''dac-nhan-tam'', N''Dale Carnegie'', N''9780671027032'', N''Những nguyên tắc nền tảng giúp giao tiếp chân thành và xây dựng mối quan hệ tích cực.'', 92000, 61, N''https://covers.openlibrary.org/b/isbn/9780671027032-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (7, N''Clean Code'', N''clean-code'', N''Robert C. Martin'', N''9780132350884'', N''Các nguyên tắc và thực hành giúp lập trình viên xây dựng mã nguồn dễ đọc, dễ kiểm thử và bảo trì.'', 315000, 18, N''https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (8, N''The Pragmatic Programmer'', N''the-pragmatic-programmer'', N''David Thomas, Andrew Hunt'', N''9780135957059'', N''Cẩm nang thực hành để phát triển tư duy, kỹ năng và thói quen của một kỹ sư phần mềm chuyên nghiệp.'', 349000, 15, N''https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (9, N''Designing Data-Intensive Applications'', N''designing-data-intensive-applications'', N''Martin Kleppmann'', N''9781449373320'', N''Kiến thức nền tảng về hệ thống dữ liệu tin cậy, có khả năng mở rộng và dễ bảo trì.'', 425000, 12, N''https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (10, N''Sapiens'', N''sapiens'', N''Yuval Noah Harari'', N''9780062316097'', N''Một góc nhìn khái quát về lịch sử loài người từ thời tiền sử đến xã hội hiện đại.'', 219000, 31, N''https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (11, N''Educated'', N''educated'', N''Tara Westover'', N''9780399590504'', N''Hồi ký về sức mạnh của giáo dục và hành trình tự kiến tạo cuộc đời.'', 176000, 20, N''https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (12, N''1984'', N''1984'', N''George Orwell'', N''9780451524935'', N''Tác phẩm kinh điển cảnh báo về giám sát, quyền lực toàn trị và sự thao túng sự thật.'', 112000, 39, N''https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (13, N''Kafka Bên Bờ Biển'', N''kafka-ben-bo-bien'', N''Haruki Murakami'', N''9781400079278'', N''Một hành trình siêu thực đan xen ký ức, định mệnh và những câu hỏi về bản ngã.'', 168000, 22, N''https://covers.openlibrary.org/b/isbn/9781400079278-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (14, N''Giết Con Chim Nhại'', N''giet-con-chim-nhai'', N''Harper Lee'', N''9780061120084'', N''Câu chuyện kinh điển về lòng can đảm, công lý và sự trưởng thành giữa những định kiến.'', 145000, 27, N''https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (15, N''Thư Viện Nửa Đêm'', N''thu-vien-nua-dem'', N''Matt Haig'', N''9780525559474'', N''Một lời nhắc dịu dàng về lựa chọn, tiếc nuối và giá trị của cuộc đời đang sống.'', 139000, 34, N''https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (16, N''Bắt Trẻ Đồng Xanh'', N''bat-tre-dong-xanh'', N''J. D. Salinger'', N''9780316769488'', N''Tiếng nói nổi loạn và cô độc của tuổi trẻ trên hành trình tìm một nơi thuộc về.'', 98000, 31, N''https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg?default=false'', 1, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (17, N''Tâm Lý Học Về Tiền'', N''tam-ly-hoc-ve-tien'', N''Morgan Housel'', N''9780857197689'', N''Những bài học dễ hiểu về hành vi, rủi ro và cách đưa ra quyết định tài chính dài hạn.'', 159000, 48, N''https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (18, N''Deep Work'', N''deep-work'', N''Cal Newport'', N''9781455586691'', N''Phương pháp rèn luyện khả năng tập trung sâu để tạo ra công việc có giá trị cao.'', 179000, 29, N''https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (19, N''Tư Duy Nhanh Và Chậm'', N''tu-duy-nhanh-va-cham'', N''Daniel Kahneman'', N''9780374533557'', N''Khám phá hai hệ thống tư duy chi phối phán đoán, lựa chọn và những sai lệch thường gặp.'', 249000, 26, N''https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (20, N''Ikigai'', N''ikigai'', N''Héctor García, Francesc Miralles'', N''9780143130727'', N''Gợi mở cách tìm niềm vui, nhịp sống cân bằng và lý do để bắt đầu mỗi ngày.'', 119000, 44, N''https://covers.openlibrary.org/b/isbn/9780143130727-L.jpg?default=false'', 2, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (21, N''Refactoring'', N''refactoring'', N''Martin Fowler'', N''9780134757599'', N''Hướng dẫn cải tiến cấu trúc mã nguồn có kiểm soát mà không làm thay đổi hành vi hệ thống.'', 499000, 11, N''https://covers.openlibrary.org/b/isbn/9780134757599-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (22, N''Domain-Driven Design'', N''domain-driven-design'', N''Eric Evans'', N''9780321125217'', N''Nền tảng thiết kế phần mềm phức tạp xoay quanh ngôn ngữ và mô hình nghiệp vụ chung.'', 519000, 9, N''https://covers.openlibrary.org/b/isbn/9780321125217-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (23, N''System Design Interview'', N''system-design-interview'', N''Alex Xu'', N''9781736049112'', N''Cách tiếp cận có hệ thống để phân tích yêu cầu và thiết kế các dịch vụ có khả năng mở rộng.'', 389000, 17, N''https://covers.openlibrary.org/b/isbn/9781736049112-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (24, N''The Web Application Hacker''''s Handbook'', N''web-application-hackers-handbook'', N''Dafydd Stuttard, Marcus Pinto'', N''9781118026472'', N''Tài liệu chuyên sâu về cách nhận diện, kiểm thử và hiểu các điểm yếu phổ biến của ứng dụng web.'', 545000, 8, N''https://covers.openlibrary.org/b/isbn/9781118026472-L.jpg?default=false'', 3, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (25, N''Lược Sử Thời Gian'', N''luoc-su-thoi-gian'', N''Stephen Hawking'', N''9780553380163'', N''Một hành trình dễ tiếp cận qua những câu hỏi lớn về vũ trụ, thời gian và nguồn gốc tồn tại.'', 135000, 33, N''https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (26, N''Súng, Vi Trùng Và Thép'', N''sung-vi-trung-va-thep'', N''Jared Diamond'', N''9780393354324'', N''Phân tích những điều kiện địa lý và sinh thái đã định hình khác biệt giữa các xã hội loài người.'', 239000, 19, N''https://covers.openlibrary.org/b/isbn/9780393354324-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (27, N''Homo Deus'', N''homo-deus'', N''Yuval Noah Harari'', N''9780062464316'', N''Những dự báo và câu hỏi lớn về tương lai con người trong kỷ nguyên dữ liệu và công nghệ.'', 229000, 23, N''https://covers.openlibrary.org/b/isbn/9780062464316-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (28, N''Factfulness'', N''factfulness'', N''Hans Rosling'', N''9781250123824'', N''Bộ công cụ tư duy dựa trên dữ liệu giúp nhìn thế giới rõ ràng và bớt thiên kiến hơn.'', 189000, 25, N''https://covers.openlibrary.org/b/isbn/9781250123824-L.jpg?default=false'', 4, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (29, N''Start With Why'', N''start-with-why'', N''Simon Sinek'', N''9781591846444'', N''Cách những tổ chức truyền cảm hứng bắt đầu từ mục đích trước khi nói về sản phẩm.'', 169000, 30, N''https://covers.openlibrary.org/b/isbn/9781591846444-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (30, N''Zero to One'', N''zero-to-one'', N''Peter Thiel'', N''9780804139298'', N''Những góc nhìn cô đọng về đổi mới, lợi thế khác biệt và cách xây dựng doanh nghiệp mới.'', 149000, 37, N''https://covers.openlibrary.org/b/isbn/9780804139298-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (31, N''The Lean Startup'', N''the-lean-startup'', N''Eric Ries'', N''9780307887894'', N''Khung thực hành xây dựng, đo lường và học hỏi để phát triển sản phẩm trong điều kiện bất định.'', 199000, 21, N''https://covers.openlibrary.org/b/isbn/9780307887894-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (32, N''Good to Great'', N''good-to-great'', N''Jim Collins'', N''9780066620992'', N''Nghiên cứu những nguyên tắc giúp doanh nghiệp duy trì kỷ luật và chuyển mình bền vững.'', 209000, 18, N''https://covers.openlibrary.org/b/isbn/9780066620992-L.jpg?default=false'', 5, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (33, N''Matilda'', N''matilda'', N''Roald Dahl'', N''9780142410370'', N''Câu chuyện hóm hỉnh về một cô bé yêu sách, thông minh và không ngại đứng lên vì điều đúng.'', 99000, 35, N''https://covers.openlibrary.org/b/isbn/9780142410370-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (34, N''Charlie Và Nhà Máy Sô-cô-la'', N''charlie-va-nha-may-so-co-la'', N''Roald Dahl'', N''9780142410318'', N''Chuyến phiêu lưu kỳ diệu, tinh nghịch và giàu trí tưởng tượng trong nhà máy của Willy Wonka.'', 105000, 32, N''https://covers.openlibrary.org/b/isbn/9780142410318-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (35, N''Chú Sâu Háu Ăn'', N''chu-sau-hau-an'', N''Eric Carle'', N''9780399226908'', N''Cuốn sách tranh rực rỡ giúp trẻ nhỏ làm quen với số đếm, thức ăn và vòng đời tự nhiên.'', 86000, 46, N''https://covers.openlibrary.org/b/isbn/9780399226908-L.jpg?default=false'', 6, 1);

INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (36, N''Nhật Ký Chú Bé Nhút Nhát'', N''nhat-ky-chu-be-nhut-nhat'', N''Jeff Kinney'', N''9781419741852'', N''Những tình huống trường lớp hài hước được kể bằng nhật ký và tranh minh họa gần gũi.'', 95000, 40, N''https://covers.openlibrary.org/b/isbn/9781419741852-L.jpg?default=false'', 6, 1);

SET IDENTITY_INSERT dbo.Books OFF;

INSERT INTO dbo.InventoryMovements
        (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, ChangedByUserId)
      SELECT
        Id, N''opening'', Stock, Stock, N''seed'', N''Số dư kho ban đầu từ bộ dữ liệu chuẩn'', 1
      FROM dbo.Books
      WHERE Stock > 0;

INSERT INTO dbo.Carts (UserId) VALUES (2), (3);

      INSERT INTO dbo.Reviews (BookId, UserId, Rating, Content) VALUES
        (1, 2, 5, N''Một cuốn sách nhẹ nhàng nhưng để lại nhiều suy nghĩ.''),
        (7, 3, 4, N''Nội dung thực tế, phù hợp để đọc lại nhiều lần.''),
        (5, 2, 5, N''Cách trình bày rõ, dễ bắt đầu và có thể áp dụng ngay.''),
        (17, 3, 5, N''Nhiều ví dụ gần gũi, giúp nhìn tiền bạc bình tĩnh hơn.''),
        (25, 2, 4, N''Chủ đề lớn nhưng cách kể cuốn hút và dễ theo dõi.''),
        (33, 3, 5, N''Một cuốn truyện vui và đầy năng lượng cho cả trẻ em lẫn người lớn.'');

      INSERT INTO dbo.WishlistItems (UserId, BookId) VALUES
        (2, 4), (2, 7), (3, 1);

SET IDENTITY_INSERT dbo.Orders ON;

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (101, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 504000,
             DATEADD(DAY, -60, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (101, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (101, 4, N''Dune'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (101, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -60, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (101, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -60, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (102, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 136000,
             DATEADD(DAY, -59, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (102, 2, N''Hoàng Tử Bé'', 68000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (102, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -59, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (103, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 128000,
             DATEADD(DAY, -58, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (103, 3, N''Rừng Na Uy'', 128000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (103, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -58, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (104, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 513000,
             DATEADD(DAY, -57, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (104, 4, N''Dune'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (104, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (104, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -57, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (105, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 158000,
             DATEADD(DAY, -56, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (105, 5, N''Atomic Habits'', 158000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (105, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -56, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (105, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -56, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (106, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 184000,
             DATEADD(DAY, -55, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (106, 6, N''Đắc Nhân Tâm'', 92000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (106, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -55, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (106, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -55, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (107, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 534000,
             DATEADD(DAY, -54, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (107, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (107, 10, N''Sapiens'', 219000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (107, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -54, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (108, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 698000,
             DATEADD(DAY, -53, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (108, 8, N''The Pragmatic Programmer'', 349000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (108, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -53, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (109, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 425000,
             DATEADD(DAY, -52, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (109, 9, N''Designing Data-Intensive Applications'', 425000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (109, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -52, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (110, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 637000,
             DATEADD(DAY, -51, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (110, 10, N''Sapiens'', 219000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (110, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (110, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -51, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (110, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -51, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (111, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 176000,
             DATEADD(DAY, -50, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (111, 11, N''Educated'', 176000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (111, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -50, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (111, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -50, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (112, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 224000,
             DATEADD(DAY, -49, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (112, 12, N''1984'', 112000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (112, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -49, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (113, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 266000,
             DATEADD(DAY, -48, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (113, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (113, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (113, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -48, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (114, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 290000,
             DATEADD(DAY, -47, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (114, 14, N''Giết Con Chim Nhại'', 145000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (114, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -47, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (115, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 139000,
             DATEADD(DAY, -46, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (115, 15, N''Thư Viện Nửa Đêm'', 139000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (115, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -46, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (115, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -46, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (116, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 275000,
             DATEADD(DAY, -45, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (116, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (116, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (116, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -45, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (116, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -45, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (117, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 159000,
             DATEADD(DAY, -44, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (117, 17, N''Tâm Lý Học Về Tiền'', 159000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (117, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -44, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (118, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 358000,
             DATEADD(DAY, -43, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (118, 18, N''Deep Work'', 179000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (118, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -43, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (119, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 768000,
             DATEADD(DAY, -42, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (119, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (119, 22, N''Domain-Driven Design'', 519000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (119, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -42, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (120, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 238000,
             DATEADD(DAY, -41, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (120, 20, N''Ikigai'', 119000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (120, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -41, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (120, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -41, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (121, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 499000,
             DATEADD(DAY, -40, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (121, 21, N''Refactoring'', 499000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (121, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -40, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (121, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -40, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (122, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1353000,
             DATEADD(DAY, -39, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (122, 22, N''Domain-Driven Design'', 519000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (122, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (122, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -39, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (123, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 389000,
             DATEADD(DAY, -38, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (123, 23, N''System Design Interview'', 389000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (123, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -38, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (124, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1090000,
             DATEADD(DAY, -37, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (124, 24, N''The Web Application Hacker''''s Handbook'', 545000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (124, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -37, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (125, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 324000,
             DATEADD(DAY, -36, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (125, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (125, 28, N''Factfulness'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (125, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -36, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (125, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -36, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (126, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 478000,
             DATEADD(DAY, -35, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (126, 26, N''Súng, Vi Trùng Và Thép'', 239000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (126, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -35, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (126, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -35, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (127, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 229000,
             DATEADD(DAY, -34, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (127, 27, N''Homo Deus'', 229000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (127, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -34, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (128, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 546000,
             DATEADD(DAY, -33, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (128, 28, N''Factfulness'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (128, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (128, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -33, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (129, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 169000,
             DATEADD(DAY, -32, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (129, 29, N''Start With Why'', 169000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (129, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -32, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (130, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 298000,
             DATEADD(DAY, -31, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (130, 30, N''Zero to One'', 149000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (130, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -31, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (130, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -31, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (131, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 304000,
             DATEADD(DAY, -30, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (131, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (131, 34, N''Charlie Và Nhà Máy Sô-cô-la'', 105000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (131, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -30, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (131, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -30, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (132, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 418000,
             DATEADD(DAY, -29, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (132, 32, N''Good to Great'', 209000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (132, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -29, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (133, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 99000,
             DATEADD(DAY, -28, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (133, 33, N''Matilda'', 99000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (133, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -28, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (134, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 459000,
             DATEADD(DAY, -27, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (134, 34, N''Charlie Và Nhà Máy Sô-cô-la'', 105000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (134, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (134, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -27, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (135, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 86000,
             DATEADD(DAY, -26, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (135, 35, N''Chú Sâu Háu Ăn'', 86000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (135, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -26, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (135, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -26, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (136, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 190000,
             DATEADD(DAY, -25, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (136, 36, N''Nhật Ký Chú Bé Nhút Nhát'', 95000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (136, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -25, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (136, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -25, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (137, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 268000,
             DATEADD(DAY, -24, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (137, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (137, 4, N''Dune'', 189000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (137, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -24, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (138, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 136000,
             DATEADD(DAY, -23, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (138, 2, N''Hoàng Tử Bé'', 68000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (138, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -23, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (139, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 128000,
             DATEADD(DAY, -22, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (139, 3, N''Rừng Na Uy'', 128000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (139, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -22, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (140, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 513000,
             DATEADD(DAY, -21, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (140, 4, N''Dune'', 189000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (140, 25, N''Lược Sử Thời Gian'', 135000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (140, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -21, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (140, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -21, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (141, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 158000,
             DATEADD(DAY, -20, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (141, 5, N''Atomic Habits'', 158000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (141, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -20, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (141, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -20, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (142, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 184000,
             DATEADD(DAY, -19, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (142, 6, N''Đắc Nhân Tâm'', 92000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (142, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -19, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (143, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 534000,
             DATEADD(DAY, -18, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (143, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (143, 10, N''Sapiens'', 219000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (143, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -18, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (144, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 698000,
             DATEADD(DAY, -17, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (144, 8, N''The Pragmatic Programmer'', 349000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (144, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -17, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (145, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 425000,
             DATEADD(DAY, -16, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (145, 9, N''Designing Data-Intensive Applications'', 425000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (145, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -16, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (145, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -16, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (146, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 637000,
             DATEADD(DAY, -15, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (146, 10, N''Sapiens'', 219000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (146, 31, N''The Lean Startup'', 199000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (146, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -15, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (146, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -15, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (147, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 176000,
             DATEADD(DAY, -14, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (147, 11, N''Educated'', 176000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (147, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -14, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (148, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 224000,
             DATEADD(DAY, -13, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (148, 12, N''1984'', 112000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (148, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -13, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (149, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 266000,
             DATEADD(DAY, -12, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (149, 13, N''Kafka Bên Bờ Biển'', 168000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (149, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (149, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -12, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (150, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 290000,
             DATEADD(DAY, -11, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (150, 14, N''Giết Con Chim Nhại'', 145000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (150, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -11, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (150, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -11, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (151, 3, N''confirmed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 139000,
             DATEADD(DAY, -10, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (151, 15, N''Thư Viện Nửa Đêm'', 139000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (151, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -10, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (151, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -10, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (152, 2, N''completed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 275000,
             DATEADD(DAY, -9, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (152, 16, N''Bắt Trẻ Đồng Xanh'', 98000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (152, 1, N''Nhà Giả Kim'', 79000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (152, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -9, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (153, 3, N''shipping'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 159000,
             DATEADD(DAY, -8, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (153, 17, N''Tâm Lý Học Về Tiền'', 159000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (153, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -8, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (154, 2, N''pending'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 358000,
             DATEADD(DAY, -7, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (154, 18, N''Deep Work'', 179000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (154, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -7, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (155, 3, N''cancelled'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 768000,
             DATEADD(DAY, -6, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (155, 19, N''Tư Duy Nhanh Và Chậm'', 249000, 1);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (155, 22, N''Domain-Driven Design'', 519000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (155, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -6, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (155, N''pending'', N''cancelled'', 3, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -6, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (156, 2, N''confirmed'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 238000,
             DATEADD(DAY, -5, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (156, 20, N''Ikigai'', 119000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (156, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -5, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (156, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -5, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (157, 3, N''completed'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', N''Giao giờ hành chính'', 499000,
             DATEADD(DAY, -4, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (157, 21, N''Refactoring'', 499000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (157, N''shipping'', N''completed'', 1, N''Giao hàng hoàn tất'',
               DATEADD(HOUR, 24, DATEADD(DAY, -4, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (158, 2, N''shipping'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1353000,
             DATEADD(DAY, -3, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (158, 22, N''Domain-Driven Design'', 519000, 2);

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (158, 7, N''Clean Code'', 315000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, N''pending'', N''confirmed'', 1, N''Đơn đã được xác nhận'',
               DATEADD(HOUR, 8, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (158, N''confirmed'', N''shipping'', 1, N''Đơn đã bàn giao cho đơn vị vận chuyển'',
               DATEADD(HOUR, 16, DATEADD(DAY, -3, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (159, 3, N''pending'', N''Trần Hải Bình'', N''0987000002'', N''12 Nguyễn Văn Bảo, TP. Hồ Chí Minh'', NULL, 389000,
             DATEADD(DAY, -2, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (159, 23, N''System Design Interview'', 389000, 1);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (159, NULL, N''pending'', 3, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -2, SYSUTCDATETIME())));

INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (160, 2, N''cancelled'', N''Nguyễn Minh An'', N''0987000001'', N''236 Lê Văn Sỹ, TP. Hồ Chí Minh'', NULL, 1090000,
             DATEADD(DAY, -1, SYSUTCDATETIME()));

INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (160, 24, N''The Web Application Hacker''''s Handbook'', 545000, 2);

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (160, NULL, N''pending'', 2, N''Khách hàng tạo đơn'',
               DATEADD(HOUR, 0, DATEADD(DAY, -1, SYSUTCDATETIME())));

INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (160, N''pending'', N''cancelled'', 2, N''Khách hàng hủy đơn'',
               DATEADD(HOUR, 8, DATEADD(DAY, -1, SYSUTCDATETIME())));

SET IDENTITY_INSERT dbo.Orders OFF;';
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

EXEC(N'SELECT N''BookGuardBaseline'' AS DatabaseName,
  (SELECT COUNT(*) FROM [BookGuardBaseline].dbo.Users) AS Users,
  (SELECT COUNT(*) FROM [BookGuardBaseline].dbo.Categories) AS Categories,
  (SELECT COUNT(*) FROM [BookGuardBaseline].dbo.Books) AS Books,
  (SELECT COUNT(*) FROM [BookGuardBaseline].dbo.Orders) AS Orders
UNION ALL
SELECT N''BookGuardSecure'',
  (SELECT COUNT(*) FROM [BookGuardSecure].dbo.Users),
  (SELECT COUNT(*) FROM [BookGuardSecure].dbo.Categories),
  (SELECT COUNT(*) FROM [BookGuardSecure].dbo.Books),
  (SELECT COUNT(*) FROM [BookGuardSecure].dbo.Orders);');
