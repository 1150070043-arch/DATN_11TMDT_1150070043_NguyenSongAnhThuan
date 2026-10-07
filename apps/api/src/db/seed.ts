import argon2 from "argon2";
import sql from "mssql";

export const books = [
  {
    id: 1,
    title: "Nhà Giả Kim",
    slug: "nha-gia-kim",
    author: "Paulo Coelho",
    isbn: "9780061122415",
    description: "Hành trình đi tìm kho báu và lắng nghe tiếng gọi sâu thẳm của chính mình.",
    price: 79000,
    stock: 42,
    categoryId: 1
  },
  {
    id: 2,
    title: "Hoàng Tử Bé",
    slug: "hoang-tu-be",
    author: "Antoine de Saint-Exupéry",
    isbn: "9780156012195",
    description: "Một câu chuyện trong trẻo về tình bạn, trách nhiệm và những điều thật sự quan trọng.",
    price: 68000,
    stock: 36,
    categoryId: 1
  },
  {
    id: 3,
    title: "Rừng Na Uy",
    slug: "rung-na-uy",
    author: "Haruki Murakami",
    isbn: "9780375704024",
    description: "Tiểu thuyết giàu cảm xúc về tuổi trẻ, mất mát và hành trình trưởng thành.",
    price: 128000,
    stock: 28,
    categoryId: 1
  },
  {
    id: 4,
    title: "Dune",
    slug: "dune",
    author: "Frank Herbert",
    isbn: "9780441172719",
    description: "Thiên sử thi khoa học viễn tưởng về quyền lực, sinh thái và số phận trên hành tinh Arrakis.",
    price: 189000,
    stock: 24,
    categoryId: 1
  },
  {
    id: 5,
    title: "Atomic Habits",
    slug: "atomic-habits",
    author: "James Clear",
    isbn: "9780735211292",
    description: "Phương pháp thực tế để xây dựng thói quen tốt bằng những thay đổi nhỏ và bền vững.",
    price: 158000,
    stock: 55,
    categoryId: 2
  },
  {
    id: 6,
    title: "Đắc Nhân Tâm",
    slug: "dac-nhan-tam",
    author: "Dale Carnegie",
    isbn: "9780671027032",
    description: "Những nguyên tắc nền tảng giúp giao tiếp chân thành và xây dựng mối quan hệ tích cực.",
    price: 92000,
    stock: 61,
    categoryId: 2
  },
  {
    id: 7,
    title: "Clean Code",
    slug: "clean-code",
    author: "Robert C. Martin",
    isbn: "9780132350884",
    description: "Các nguyên tắc và thực hành giúp lập trình viên xây dựng mã nguồn dễ đọc, dễ kiểm thử và bảo trì.",
    price: 315000,
    stock: 18,
    categoryId: 3
  },
  {
    id: 8,
    title: "The Pragmatic Programmer",
    slug: "the-pragmatic-programmer",
    author: "David Thomas, Andrew Hunt",
    isbn: "9780135957059",
    description: "Cẩm nang thực hành để phát triển tư duy, kỹ năng và thói quen của một kỹ sư phần mềm chuyên nghiệp.",
    price: 349000,
    stock: 15,
    categoryId: 3
  },
  {
    id: 9,
    title: "Designing Data-Intensive Applications",
    slug: "designing-data-intensive-applications",
    author: "Martin Kleppmann",
    isbn: "9781449373320",
    description: "Kiến thức nền tảng về hệ thống dữ liệu tin cậy, có khả năng mở rộng và dễ bảo trì.",
    price: 425000,
    stock: 12,
    categoryId: 3
  },
  {
    id: 10,
    title: "Sapiens",
    slug: "sapiens",
    author: "Yuval Noah Harari",
    isbn: "9780062316097",
    description: "Một góc nhìn khái quát về lịch sử loài người từ thời tiền sử đến xã hội hiện đại.",
    price: 219000,
    stock: 31,
    categoryId: 4
  },
  {
    id: 11,
    title: "Educated",
    slug: "educated",
    author: "Tara Westover",
    isbn: "9780399590504",
    description: "Hồi ký về sức mạnh của giáo dục và hành trình tự kiến tạo cuộc đời.",
    price: 176000,
    stock: 20,
    categoryId: 4
  },
  {
    id: 12,
    title: "1984",
    slug: "1984",
    author: "George Orwell",
    isbn: "9780451524935",
    description: "Tác phẩm kinh điển cảnh báo về giám sát, quyền lực toàn trị và sự thao túng sự thật.",
    price: 112000,
    stock: 39,
    categoryId: 1
  },
  {
    id: 13,
    title: "Kafka Bên Bờ Biển",
    slug: "kafka-ben-bo-bien",
    author: "Haruki Murakami",
    isbn: "9781400079278",
    description: "Một hành trình siêu thực đan xen ký ức, định mệnh và những câu hỏi về bản ngã.",
    price: 168000,
    stock: 22,
    categoryId: 1
  },
  {
    id: 14,
    title: "Giết Con Chim Nhại",
    slug: "giet-con-chim-nhai",
    author: "Harper Lee",
    isbn: "9780061120084",
    description: "Câu chuyện kinh điển về lòng can đảm, công lý và sự trưởng thành giữa những định kiến.",
    price: 145000,
    stock: 27,
    categoryId: 1
  },
  {
    id: 15,
    title: "Thư Viện Nửa Đêm",
    slug: "thu-vien-nua-dem",
    author: "Matt Haig",
    isbn: "9780525559474",
    description: "Một lời nhắc dịu dàng về lựa chọn, tiếc nuối và giá trị của cuộc đời đang sống.",
    price: 139000,
    stock: 34,
    categoryId: 1
  },
  {
    id: 16,
    title: "Bắt Trẻ Đồng Xanh",
    slug: "bat-tre-dong-xanh",
    author: "J. D. Salinger",
    isbn: "9780316769488",
    description: "Tiếng nói nổi loạn và cô độc của tuổi trẻ trên hành trình tìm một nơi thuộc về.",
    price: 98000,
    stock: 31,
    categoryId: 1
  },
  {
    id: 17,
    title: "Tâm Lý Học Về Tiền",
    slug: "tam-ly-hoc-ve-tien",
    author: "Morgan Housel",
    isbn: "9780857197689",
    description: "Những bài học dễ hiểu về hành vi, rủi ro và cách đưa ra quyết định tài chính dài hạn.",
    price: 159000,
    stock: 48,
    categoryId: 2
  },
  {
    id: 18,
    title: "Deep Work",
    slug: "deep-work",
    author: "Cal Newport",
    isbn: "9781455586691",
    description: "Phương pháp rèn luyện khả năng tập trung sâu để tạo ra công việc có giá trị cao.",
    price: 179000,
    stock: 29,
    categoryId: 2
  },
  {
    id: 19,
    title: "Tư Duy Nhanh Và Chậm",
    slug: "tu-duy-nhanh-va-cham",
    author: "Daniel Kahneman",
    isbn: "9780374533557",
    description: "Khám phá hai hệ thống tư duy chi phối phán đoán, lựa chọn và những sai lệch thường gặp.",
    price: 249000,
    stock: 26,
    categoryId: 2
  },
  {
    id: 20,
    title: "Ikigai",
    slug: "ikigai",
    author: "Héctor García, Francesc Miralles",
    isbn: "9780143130727",
    description: "Gợi mở cách tìm niềm vui, nhịp sống cân bằng và lý do để bắt đầu mỗi ngày.",
    price: 119000,
    stock: 44,
    categoryId: 2
  },
  {
    id: 21,
    title: "Refactoring",
    slug: "refactoring",
    author: "Martin Fowler",
    isbn: "9780134757599",
    description: "Hướng dẫn cải tiến cấu trúc mã nguồn có kiểm soát mà không làm thay đổi hành vi hệ thống.",
    price: 499000,
    stock: 11,
    categoryId: 3
  },
  {
    id: 22,
    title: "Domain-Driven Design",
    slug: "domain-driven-design",
    author: "Eric Evans",
    isbn: "9780321125217",
    description: "Nền tảng thiết kế phần mềm phức tạp xoay quanh ngôn ngữ và mô hình nghiệp vụ chung.",
    price: 519000,
    stock: 9,
    categoryId: 3
  },
  {
    id: 23,
    title: "System Design Interview",
    slug: "system-design-interview",
    author: "Alex Xu",
    isbn: "9781736049112",
    description: "Cách tiếp cận có hệ thống để phân tích yêu cầu và thiết kế các dịch vụ có khả năng mở rộng.",
    price: 389000,
    stock: 17,
    categoryId: 3
  },
  {
    id: 24,
    title: "The Web Application Hacker's Handbook",
    slug: "web-application-hackers-handbook",
    author: "Dafydd Stuttard, Marcus Pinto",
    isbn: "9781118026472",
    description: "Tài liệu chuyên sâu về cách nhận diện, kiểm thử và hiểu các điểm yếu phổ biến của ứng dụng web.",
    price: 545000,
    stock: 8,
    categoryId: 3
  },
  {
    id: 25,
    title: "Lược Sử Thời Gian",
    slug: "luoc-su-thoi-gian",
    author: "Stephen Hawking",
    isbn: "9780553380163",
    description: "Một hành trình dễ tiếp cận qua những câu hỏi lớn về vũ trụ, thời gian và nguồn gốc tồn tại.",
    price: 135000,
    stock: 33,
    categoryId: 4
  },
  {
    id: 26,
    title: "Súng, Vi Trùng Và Thép",
    slug: "sung-vi-trung-va-thep",
    author: "Jared Diamond",
    isbn: "9780393354324",
    description: "Phân tích những điều kiện địa lý và sinh thái đã định hình khác biệt giữa các xã hội loài người.",
    price: 239000,
    stock: 19,
    categoryId: 4
  },
  {
    id: 27,
    title: "Homo Deus",
    slug: "homo-deus",
    author: "Yuval Noah Harari",
    isbn: "9780062464316",
    description: "Những dự báo và câu hỏi lớn về tương lai con người trong kỷ nguyên dữ liệu và công nghệ.",
    price: 229000,
    stock: 23,
    categoryId: 4
  },
  {
    id: 28,
    title: "Factfulness",
    slug: "factfulness",
    author: "Hans Rosling",
    isbn: "9781250123824",
    description: "Bộ công cụ tư duy dựa trên dữ liệu giúp nhìn thế giới rõ ràng và bớt thiên kiến hơn.",
    price: 189000,
    stock: 25,
    categoryId: 4
  },
  {
    id: 29,
    title: "Start With Why",
    slug: "start-with-why",
    author: "Simon Sinek",
    isbn: "9781591846444",
    description: "Cách những tổ chức truyền cảm hứng bắt đầu từ mục đích trước khi nói về sản phẩm.",
    price: 169000,
    stock: 30,
    categoryId: 5
  },
  {
    id: 30,
    title: "Zero to One",
    slug: "zero-to-one",
    author: "Peter Thiel",
    isbn: "9780804139298",
    description: "Những góc nhìn cô đọng về đổi mới, lợi thế khác biệt và cách xây dựng doanh nghiệp mới.",
    price: 149000,
    stock: 37,
    categoryId: 5
  },
  {
    id: 31,
    title: "The Lean Startup",
    slug: "the-lean-startup",
    author: "Eric Ries",
    isbn: "9780307887894",
    description: "Khung thực hành xây dựng, đo lường và học hỏi để phát triển sản phẩm trong điều kiện bất định.",
    price: 199000,
    stock: 21,
    categoryId: 5
  },
  {
    id: 32,
    title: "Good to Great",
    slug: "good-to-great",
    author: "Jim Collins",
    isbn: "9780066620992",
    description: "Nghiên cứu những nguyên tắc giúp doanh nghiệp duy trì kỷ luật và chuyển mình bền vững.",
    price: 209000,
    stock: 18,
    categoryId: 5
  },
  {
    id: 33,
    title: "Matilda",
    slug: "matilda",
    author: "Roald Dahl",
    isbn: "9780142410370",
    description: "Câu chuyện hóm hỉnh về một cô bé yêu sách, thông minh và không ngại đứng lên vì điều đúng.",
    price: 99000,
    stock: 35,
    categoryId: 6
  },
  {
    id: 34,
    title: "Charlie Và Nhà Máy Sô-cô-la",
    slug: "charlie-va-nha-may-so-co-la",
    author: "Roald Dahl",
    isbn: "9780142410318",
    description: "Chuyến phiêu lưu kỳ diệu, tinh nghịch và giàu trí tưởng tượng trong nhà máy của Willy Wonka.",
    price: 105000,
    stock: 32,
    categoryId: 6
  },
  {
    id: 35,
    title: "Chú Sâu Háu Ăn",
    slug: "chu-sau-hau-an",
    author: "Eric Carle",
    isbn: "9780399226908",
    description: "Cuốn sách tranh rực rỡ giúp trẻ nhỏ làm quen với số đếm, thức ăn và vòng đời tự nhiên.",
    price: 86000,
    stock: 46,
    categoryId: 6
  },
  {
    id: 36,
    title: "Nhật Ký Chú Bé Nhút Nhát",
    slug: "nhat-ky-chu-be-nhut-nhat",
    author: "Jeff Kinney",
    isbn: "9781419741852",
    description: "Những tình huống trường lớp hài hước được kể bằng nhật ký và tranh minh họa gần gũi.",
    price: 95000,
    stock: 40,
    categoryId: 6
  }
];

export const sampleOrderCount = 60;

async function passwordSecret(password: string, secure: boolean): Promise<string> {
  if (!secure) return password;
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function seedDatabase(pool: sql.ConnectionPool, secure: boolean): Promise<void> {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction).batch(`
      DELETE FROM dbo.SecurityEvents;
      DELETE FROM dbo.ExperimentRuns;
      DELETE FROM dbo.OrderNotifications;
      DELETE FROM dbo.RefreshTokens;
      DELETE FROM dbo.UserSessions;
      DELETE FROM dbo.PasswordResetTokens;
      DELETE FROM dbo.EmailVerificationTokens;
      DELETE FROM dbo.Uploads;
      DELETE FROM dbo.OrderStatusHistory;
      DELETE FROM dbo.OrderItems;
      DELETE FROM dbo.Orders;
      DELETE FROM dbo.CartItems;
      DELETE FROM dbo.Carts;
      DELETE FROM dbo.Reviews;
      DELETE FROM dbo.WishlistItems;
      DELETE FROM dbo.InventoryMovements;
      DELETE FROM dbo.Books;
      DELETE FROM dbo.Users;
      DELETE FROM dbo.Categories;
      DELETE FROM dbo.Roles;
    `);

    await new sql.Request(transaction).batch(`
      INSERT INTO dbo.Roles (Id, Name) VALUES (1, N'admin'), (2, N'customer');
      INSERT INTO dbo.Categories (Id, Name, Slug) VALUES
        (1, N'Văn học', N'van-hoc'),
        (2, N'Kỹ năng', N'ky-nang'),
        (3, N'Công nghệ', N'cong-nghe'),
        (4, N'Lịch sử - xã hội', N'lich-su-xa-hoi'),
        (5, N'Kinh doanh', N'kinh-doanh'),
        (6, N'Thiếu nhi', N'thieu-nhi');
    `);

    const users = [
      { id: 1, email: "admin@bookguard.local", password: "Admin@12345", fullName: "Quản trị BookGuard", roleId: 1 },
      { id: 2, email: "customer.a@bookguard.local", password: "Customer@123", fullName: "Nguyễn Minh An", roleId: 2 },
      { id: 3, email: "customer.b@bookguard.local", password: "Customer@123", fullName: "Trần Hải Bình", roleId: 2 }
    ];

    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Users ON;");
    for (const user of users) {
      const secret = await passwordSecret(user.password, secure);
      await new sql.Request(transaction)
        .input("id", user.id)
        .input("email", user.email)
        .input("secret", secret)
        .input("fullName", user.fullName)
        .input("roleId", user.roleId)
        .query(`
          INSERT INTO dbo.Users
            (Id, Email, PasswordSecret, FullName, Phone, AddressLine, RoleId, TokenVersion, IsActive, EmailVerifiedAt)
          VALUES
            (@id, @email, @secret, @fullName, N'0900000000', N'236 Lê Văn Sỹ, TP. Hồ Chí Minh', @roleId, 0, 1, SYSUTCDATETIME())
        `);
    }
    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Users OFF;");

    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Books ON;");
    for (const book of books) {
      await new sql.Request(transaction)
        .input("id", book.id)
        .input("title", book.title)
        .input("slug", book.slug)
        .input("author", book.author)
        .input("isbn", book.isbn)
        .input("description", book.description)
        .input("price", book.price)
        .input("stock", book.stock)
        .input("coverUrl", `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`)
        .input("categoryId", book.categoryId)
        .query(`
          INSERT INTO dbo.Books
            (Id, Title, Slug, Author, Isbn, Description, Price, Stock, CoverUrl, CategoryId, IsPublished)
          VALUES
            (@id, @title, @slug, @author, @isbn, @description, @price, @stock, @coverUrl, @categoryId, 1)
        `);
    }
    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Books OFF;");

    await new sql.Request(transaction).batch(`
      INSERT INTO dbo.InventoryMovements
        (BookId, MovementType, QuantityDelta, BalanceAfter, ReferenceType, Note, ChangedByUserId)
      SELECT
        Id, N'opening', Stock, Stock, N'seed', N'Số dư kho ban đầu từ bộ dữ liệu chuẩn', 1
      FROM dbo.Books
      WHERE Stock > 0;
    `);

    await new sql.Request(transaction).batch(`
      INSERT INTO dbo.Carts (UserId) VALUES (2), (3);

      INSERT INTO dbo.Reviews (BookId, UserId, Rating, Content) VALUES
        (1, 2, 5, N'Một cuốn sách nhẹ nhàng nhưng để lại nhiều suy nghĩ.'),
        (7, 3, 4, N'Nội dung thực tế, phù hợp để đọc lại nhiều lần.'),
        (5, 2, 5, N'Cách trình bày rõ, dễ bắt đầu và có thể áp dụng ngay.'),
        (17, 3, 5, N'Nhiều ví dụ gần gũi, giúp nhìn tiền bạc bình tĩnh hơn.'),
        (25, 2, 4, N'Chủ đề lớn nhưng cách kể cuốn hút và dễ theo dõi.'),
        (33, 3, 5, N'Một cuốn truyện vui và đầy năng lượng cho cả trẻ em lẫn người lớn.');

      INSERT INTO dbo.WishlistItems (UserId, BookId) VALUES
        (2, 4), (2, 7), (3, 1);
    `);

    const statuses = ["confirmed", "completed", "shipping", "pending", "cancelled"] as const;
    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Orders ON;");
    for (let index = 0; index < sampleOrderCount; index += 1) {
      const id = 101 + index;
      const userId = index % 2 === 0 ? 3 : 2;
      const firstBook = index === 0 ? books[6]! : books[index % books.length]!;
      const secondBook = books[(index * 7 + 3) % books.length]!;
      const firstQuantity = (index % 2) + 1;
      const secondQuantity = index % 3 === 0 ? 1 : 0;
      const total = firstBook.price * firstQuantity + secondBook.price * secondQuantity;
      const status = statuses[index % statuses.length]!;
      const customerName = userId === 2 ? "Nguyễn Minh An" : "Trần Hải Bình";
      const phone = userId === 2 ? "0987000001" : "0987000002";
      const address = userId === 2
        ? "236 Lê Văn Sỹ, TP. Hồ Chí Minh"
        : "12 Nguyễn Văn Bảo, TP. Hồ Chí Minh";

      await new sql.Request(transaction)
        .input("orderId", sql.Int, id)
        .input("userId", sql.Int, userId)
        .input("status", sql.NVarChar(30), status)
        .input("customerName", sql.NVarChar(160), customerName)
        .input("phone", sql.NVarChar(30), phone)
        .input("address", sql.NVarChar(500), address)
        .input("note", sql.NVarChar(1000), index % 4 === 0 ? "Giao giờ hành chính" : null)
        .input("total", sql.Decimal(18, 2), total)
        .input("daysAgo", sql.Int, sampleOrderCount - index)
        .query(`
          INSERT INTO dbo.Orders
            (Id, UserId, Status, CustomerName, Phone, ShippingAddress, Note, TotalAmount, CreatedAt)
          VALUES
            (@orderId, @userId, @status, @customerName, @phone, @address, @note, @total,
             DATEADD(DAY, -@daysAgo, SYSUTCDATETIME()))
        `);

      await new sql.Request(transaction)
        .input("orderId", sql.Int, id)
        .input("bookId", sql.Int, firstBook.id)
        .input("title", sql.NVarChar(255), firstBook.title)
        .input("price", sql.Decimal(18, 2), firstBook.price)
        .input("quantity", sql.Int, firstQuantity)
        .query(`
          INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
          VALUES (@orderId, @bookId, @title, @price, @quantity)
        `);

      if (secondQuantity > 0 && secondBook.id !== firstBook.id) {
        await new sql.Request(transaction)
          .input("orderId", sql.Int, id)
          .input("bookId", sql.Int, secondBook.id)
          .input("title", sql.NVarChar(255), secondBook.title)
          .input("price", sql.Decimal(18, 2), secondBook.price)
          .input("quantity", sql.Int, secondQuantity)
          .query(`
            INSERT INTO dbo.OrderItems (OrderId, BookId, BookTitle, UnitPrice, Quantity)
            VALUES (@orderId, @bookId, @title, @price, @quantity)
          `);
      }

      const historySteps = status === "completed"
        ? ["pending", "confirmed", "shipping", "completed"] as const
        : status === "shipping"
          ? ["pending", "confirmed", "shipping"] as const
          : status === "confirmed"
            ? ["pending", "confirmed"] as const
            : status === "cancelled"
              ? ["pending", "cancelled"] as const
              : ["pending"] as const;
      for (const [stepIndex, historyStatus] of historySteps.entries()) {
        const previousStatus = stepIndex === 0 ? null : historySteps[stepIndex - 1];
        const note = historyStatus === "pending"
          ? "Khách hàng tạo đơn"
          : historyStatus === "confirmed"
            ? "Đơn đã được xác nhận"
            : historyStatus === "shipping"
              ? "Đơn đã bàn giao cho đơn vị vận chuyển"
              : historyStatus === "completed"
                ? "Giao hàng hoàn tất"
                : "Khách hàng hủy đơn";
        await new sql.Request(transaction)
          .input("orderId", sql.Int, id)
          .input("fromStatus", sql.NVarChar(30), previousStatus)
          .input("toStatus", sql.NVarChar(30), historyStatus)
          .input("changedBy", sql.Int, stepIndex === 0 || historyStatus === "cancelled" ? userId : 1)
          .input("note", sql.NVarChar(500), note)
          .input("daysAgo", sql.Int, sampleOrderCount - index)
          .input("hoursOffset", sql.Int, stepIndex * 8)
          .query(`
            INSERT INTO dbo.OrderStatusHistory
              (OrderId, FromStatus, ToStatus, ChangedByUserId, Note, CreatedAt)
            VALUES
              (@orderId, @fromStatus, @toStatus, @changedBy, @note,
               DATEADD(HOUR, @hoursOffset, DATEADD(DAY, -@daysAgo, SYSUTCDATETIME())))
          `);
      }
    }
    await new sql.Request(transaction).batch("SET IDENTITY_INSERT dbo.Orders OFF;");

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
