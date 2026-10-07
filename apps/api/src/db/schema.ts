export const schemaSql = `
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(40) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
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
IF COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2(0) NULL;
  EXEC(N'UPDATE dbo.Users SET EmailVerifiedAt = CreatedAt WHERE EmailVerifiedAt IS NULL;');
END;

IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Categories (
    Id INT NOT NULL PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Slug NVARCHAR(140) NOT NULL UNIQUE
  );
END;

IF OBJECT_ID(N'dbo.Books', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.Reviews', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.Carts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Carts (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Carts_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Carts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF OBJECT_ID(N'dbo.CartItems', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
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
    CONSTRAINT CK_Orders_Status CHECK (Status IN (N'pending', N'confirmed', N'shipping', N'completed', N'cancelled')),
    CONSTRAINT CK_Orders_Total CHECK (TotalAmount >= 0),
    CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END;

IF COL_LENGTH(N'dbo.Orders', N'IdempotencyKey') IS NULL
  ALTER TABLE dbo.Orders ADD IdempotencyKey UNIQUEIDENTIFIER NULL;

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.Uploads', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.SecurityEvents', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.RefreshTokens', N'U') IS NULL
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

IF COL_LENGTH(N'dbo.RefreshTokens', N'SessionId') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD SessionId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N'dbo.RefreshTokens', N'ReplacedByTokenHash') IS NULL
  ALTER TABLE dbo.RefreshTokens ADD ReplacedByTokenHash CHAR(64) NULL;

IF OBJECT_ID(N'dbo.OrderStatusHistory', N'U') IS NULL
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
      FromStatus IS NULL OR FromStatus IN (N'pending', N'confirmed', N'shipping', N'completed', N'cancelled')
    ),
    CONSTRAINT CK_OrderStatusHistory_ToStatus CHECK (
      ToStatus IN (N'pending', N'confirmed', N'shipping', N'completed', N'cancelled')
    ),
    CONSTRAINT FK_OrderStatusHistory_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id) ON DELETE CASCADE,
    CONSTRAINT FK_OrderStatusHistory_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(Id)
  );
END;

INSERT INTO dbo.OrderStatusHistory
  (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
SELECT
  o.Id, NULL, o.Status, o.UserId, N'Lịch sử được khởi tạo khi nâng cấp',
  COALESCE(o.UpdatedAt, o.CreatedAt)
FROM dbo.Orders o
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.OrderStatusHistory h WHERE h.OrderId = o.Id
);

IF OBJECT_ID(N'dbo.PasswordResetTokens', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.EmailVerificationTokens', N'U') IS NULL
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

IF OBJECT_ID(N'dbo.UserSessions', N'U') IS NULL
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
  SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_RefreshTokens_Sessions'
)
  ALTER TABLE dbo.RefreshTokens
    ADD CONSTRAINT FK_RefreshTokens_Sessions
    FOREIGN KEY (SessionId) REFERENCES dbo.UserSessions(SessionId);

IF OBJECT_ID(N'dbo.WishlistItems', N'U') IS NULL
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Books_Category_Published')
  CREATE INDEX IX_Books_Category_Published ON dbo.Books(CategoryId, IsPublished);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_User_Created')
  CREATE INDEX IX_Orders_User_Created ON dbo.Orders(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Orders_User_Idempotency')
  CREATE UNIQUE INDEX UX_Orders_User_Idempotency
    ON dbo.Orders(UserId, IdempotencyKey)
    WHERE IdempotencyKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Reviews_Book_Created')
  CREATE INDEX IX_Reviews_Book_Created ON dbo.Reviews(BookId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SecurityEvents_Created')
  CREATE INDEX IX_SecurityEvents_Created ON dbo.SecurityEvents(CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PasswordResetTokens_User_Active')
  CREATE INDEX IX_PasswordResetTokens_User_Active
    ON dbo.PasswordResetTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EmailVerificationTokens_User_Active')
  CREATE INDEX IX_EmailVerificationTokens_User_Active
    ON dbo.EmailVerificationTokens(UserId, ExpiresAt DESC)
    INCLUDE (UsedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_UserSessions_User_Recent')
  CREATE INDEX IX_UserSessions_User_Recent
    ON dbo.UserSessions(UserId, CreatedAt DESC)
    INCLUDE (LastSeenAt, ExpiresAt, RevokedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RefreshTokens_Session_Active')
  CREATE INDEX IX_RefreshTokens_Session_Active
    ON dbo.RefreshTokens(SessionId, ExpiresAt DESC)
    INCLUDE (RevokedAt, ReplacedByTokenHash);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WishlistItems_User_Recent')
  CREATE INDEX IX_WishlistItems_User_Recent ON dbo.WishlistItems(UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OrderStatusHistory_Order_Created')
  CREATE INDEX IX_OrderStatusHistory_Order_Created
    ON dbo.OrderStatusHistory(OrderId, CreatedAt ASC);
`;
