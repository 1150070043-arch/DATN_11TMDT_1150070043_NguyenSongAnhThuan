import { chromium } from "playwright";
import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const outDir = "UI/temp-check";
const artifactDir = "C:/Users/Thang/.gemini/antigravity/brain/0d0622ce-7a81-48c2-897e-7acfcaea9461";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

// Mock API endpoints to provide realistic, executive-grade bookstore data
await page.route("**/api/auth/me", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      data: {
        id: 1,
        email: "admin@bookguard.local",
        fullName: "Quản trị viên Thư An",
        role: "admin",
        emailVerified: true
      }
    })
  });
});

await page.route("**/api/csrf-token", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { csrfToken: "mock-csrf-token" } })
  });
});

await page.route("**/api/auth/csrf", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { csrfToken: "mock-csrf-token" } })
  });
});

await page.route("**/api/auth/refresh", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { csrfToken: "mock-csrf-token" } })
  });
});

await page.route("**/api/cart", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { items: [], totalAmount: 0 } })
  });
});

await page.route("**/api/profile/wishlist", route => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [] })
  });
});

const mockBooks = [
  {
    id: 1,
    title: "Sapiens: Lược Sử Loài Người",
    slug: "sapiens-luoc-su-loai-nguoi",
    author: "Yuval Noah Harari",
    isbn: "9780062316097",
    description: "Khảo cứu lịch sử tiến hóa và phát triển của nhân loại.",
    price: 280000,
    stock: 24,
    coverUrl: "",
    categoryId: 1,
    categoryName: "Lịch sử - Xã hội",
    isPublished: true
  },
  {
    id: 2,
    title: "Nhà Giả Kim (Bản Đặc Biệt)",
    slug: "nha-gia-kim-dac-biet",
    author: "Paulo Coelho",
    isbn: "9780061122415",
    description: "Câu chuyện ngụ ngôn vượt thời gian về việc theo đuổi ước mơ.",
    price: 195000,
    stock: 18,
    coverUrl: "",
    categoryId: 2,
    categoryName: "Văn học cổ điển",
    isPublished: true
  },
  {
    id: 3,
    title: "Tội Ác Và Hình Phạt",
    slug: "toi-ac-va-hinh-phat",
    author: "Fyodor Dostoevsky",
    isbn: "9780140449136",
    description: "Kiệt tác phân tích tâm lý sâu sắc về tội lỗi và sự chuộc tội.",
    price: 245000,
    stock: 4,
    coverUrl: "",
    categoryId: 2,
    categoryName: "Văn học cổ điển",
    isPublished: true
  },
  {
    id: 4,
    title: "Kinh Tế Học Cơ Bản",
    slug: "kinh-te-hoc-co-ban",
    author: "Thomas Sowell",
    isbn: "9780465060733",
    description: "Cẩm nang nhập môn kinh tế thị trường dành cho mọi độc giả.",
    price: 320000,
    stock: 15,
    coverUrl: "",
    categoryId: 3,
    categoryName: "Kinh tế học",
    isPublished: true
  },
  {
    id: 5,
    title: "Designing Data-Intensive Applications",
    slug: "designing-data-intensive-applications",
    author: "Martin Kleppmann",
    isbn: "9781449373320",
    description: "Nguyên lý kiến trúc hệ thống lưu trữ và xử lý dữ liệu lớn.",
    price: 490000,
    stock: 9,
    coverUrl: "",
    categoryId: 4,
    categoryName: "Công nghệ thông tin",
    isPublished: true
  },
  {
    id: 6,
    title: "Trăm Năm Cô Đơn",
    slug: "tram-nam-co-don",
    author: "Gabriel García Márquez",
    isbn: "9780060883287",
    description: "Đỉnh cao chủ nghĩa hiện thực huyền ảo thế giới.",
    price: 210000,
    stock: 0,
    coverUrl: "",
    categoryId: 2,
    categoryName: "Văn học cổ điển",
    isPublished: true
  }
];

const mockOrders = [
  {
    id: 1048,
    customerName: "Nguyễn Văn An",
    phone: "0912 345 678",
    shippingAddress: "124 Phố Huế, Hai Bà Trưng, Hà Nội",
    note: "Giao trong giờ hành chính giúp tôi",
    status: "shipping",
    totalAmount: 495000,
    subtotalAmount: 550000,
    discountAmount: 55000,
    couponCode: "THUAN10",
    createdAt: "2026-09-18T10:15:00Z",
    items: [
      { id: 1, bookTitle: "Sapiens: Lược Sử Loài Người", quantity: 1, unitPrice: 280000 },
      { id: 2, bookTitle: "Nhà Giả Kim (Bản Đặc Biệt)", quantity: 1, unitPrice: 270000 }
    ],
    statusHistory: [
      { id: 1, toStatus: "pending", createdAt: "2026-09-18T10:15:00Z", note: "Khách hàng hoàn tất thanh toán VNPay" },
      { id: 2, toStatus: "confirmed", createdAt: "2026-09-18T10:45:00Z", note: "Đã kiểm kho và xuất hóa đơn", changedByName: "Quản trị viên" },
      { id: 3, toStatus: "shipping", createdAt: "2026-09-18T13:20:00Z", note: "Đã giao đơn vị vận chuyển ViettelPost", changedByName: "Quản trị viên" }
    ],
    emailNotifications: [
      { id: 1, recipientEmail: "nguyenvanan@gmail.com", orderStatus: "pending", deliveryState: "sent", createdAt: "2026-09-18T10:15:05Z" },
      { id: 2, recipientEmail: "nguyenvanan@gmail.com", orderStatus: "confirmed", deliveryState: "sent", createdAt: "2026-09-18T10:45:10Z" },
      { id: 3, recipientEmail: "nguyenvanan@gmail.com", orderStatus: "shipping", deliveryState: "sent", createdAt: "2026-09-18T13:20:05Z" }
    ]
  },
  {
    id: 1047,
    customerName: "Trần Thị Mai",
    phone: "0987 654 321",
    shippingAddress: "45 Lê Duẩn, Quận 1, TP. Hồ Chí Minh",
    note: "",
    status: "confirmed",
    totalAmount: 320000,
    subtotalAmount: 320000,
    discountAmount: 0,
    createdAt: "2026-09-18T09:30:00Z",
    items: [
      { id: 3, bookTitle: "Kinh Tế Học Cơ Bản", quantity: 1, unitPrice: 320000 }
    ],
    statusHistory: [
      { id: 4, toStatus: "pending", createdAt: "2026-09-18T09:30:00Z" },
      { id: 5, toStatus: "confirmed", createdAt: "2026-09-18T09:40:00Z", changedByName: "Quản trị viên" }
    ],
    emailNotifications: [
      { id: 4, recipientEmail: "tranmai@gmail.com", orderStatus: "pending", deliveryState: "sent", createdAt: "2026-09-18T09:30:05Z" }
    ]
  },
  {
    id: 1046,
    customerName: "Lê Hoàng Long",
    phone: "0903 112 233",
    shippingAddress: "78 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    note: "",
    status: "completed",
    totalAmount: 735000,
    subtotalAmount: 735000,
    discountAmount: 0,
    createdAt: "2026-09-17T15:20:00Z",
    items: [
      { id: 4, bookTitle: "Designing Data-Intensive Applications", quantity: 1, unitPrice: 490000 },
      { id: 5, bookTitle: "Tội Ác Và Hình Phạt", quantity: 1, unitPrice: 245000 }
    ]
  },
  {
    id: 1045,
    customerName: "Phạm Minh Đức",
    phone: "0934 889 900",
    shippingAddress: "12 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội",
    note: "",
    status: "pending",
    totalAmount: 195000,
    subtotalAmount: 195000,
    discountAmount: 0,
    createdAt: "2026-09-18T11:05:00Z",
    items: [
      { id: 6, bookTitle: "Nhà Giả Kim (Bản Đặc Biệt)", quantity: 1, unitPrice: 195000 }
    ]
  },
  {
    id: 1044,
    customerName: "Vũ Hải Đăng",
    phone: "0971 223 344",
    shippingAddress: "88 Cầu Giấy, Hà Nội",
    note: "",
    status: "cancelled",
    totalAmount: 210000,
    subtotalAmount: 210000,
    discountAmount: 0,
    createdAt: "2026-09-16T14:10:00Z",
    items: [
      { id: 7, bookTitle: "Trăm Năm Cô Đơn", quantity: 1, unitPrice: 210000 }
    ]
  }
];

const mockDashboard = {
  summary: {
    customers: 142,
    books: 36,
    orders: 48,
    revenue: 38450000,
    pendingOrders: 1
  },
  ordersByStatus: [
    { status: "completed", total: 32 },
    { status: "shipping", total: 8 },
    { status: "confirmed", total: 5 },
    { status: "pending", total: 1 },
    { status: "cancelled", total: 2 }
  ],
  revenueByDay: [
    { day: "01/09", orders: 3, revenue: 1650000 },
    { day: "05/09", orders: 5, revenue: 3400000 },
    { day: "10/09", orders: 7, revenue: 5900000 },
    { day: "14/09", orders: 9, revenue: 8200000 },
    { day: "18/09", orders: 6, revenue: 5400000 }
  ],
  lowStock: [
    { id: 3, title: "Tội Ác Và Hình Phạt", stock: 4, isPublished: true },
    { id: 5, title: "Designing Data-Intensive Applications", stock: 9, isPublished: true },
    { id: 6, title: "Trăm Năm Cô Đơn", stock: 0, isPublished: true }
  ],
  topSelling: [
    { bookId: 2, title: "Nhà Giả Kim (Bản Đặc Biệt)", quantity: 42 },
    { bookId: 1, title: "Sapiens: Lược Sử Loài Người", quantity: 36 },
    { bookId: 4, title: "Kinh Tế Học Cơ Bản", quantity: 28 }
  ],
  recentOrders: mockOrders
};

const mockCategories = [
  { id: 1, name: "Lịch sử - Xã hội", slug: "lich-su-xa-hoi", bookCount: 8 },
  { id: 2, name: "Văn học cổ điển", slug: "van-hoc-co-dien", bookCount: 14 },
  { id: 3, name: "Kinh tế học", slug: "kinh-te-hoc", bookCount: 6 },
  { id: 4, name: "Công nghệ thông tin", slug: "cong-nghe-thong-tin", bookCount: 5 },
  { id: 5, name: "Triết học & Tư tưởng", slug: "triet-hoc-tu-tuong", bookCount: 3 }
];

const mockUsers = [
  { id: 1, email: "admin@bookguard.local", fullName: "Quản trị viên Thư An", role: "admin", isActive: true, emailVerified: true, createdAt: "2026-08-01T00:00:00Z" },
  { id: 2, email: "nguyenvanan@gmail.com", fullName: "Nguyễn Văn An", role: "customer", isActive: true, emailVerified: true, createdAt: "2026-08-15T10:20:00Z" },
  { id: 3, email: "tranmai@gmail.com", fullName: "Trần Thị Mai", role: "customer", isActive: true, emailVerified: true, createdAt: "2026-08-20T14:15:00Z" },
  { id: 4, email: "lehoanglong@gmail.com", fullName: "Lê Hoàng Long", role: "customer", isActive: false, emailVerified: false, createdAt: "2026-09-01T08:00:00Z" }
];

const mockInventory = {
  summary: { totalTitles: 36, totalUnits: 1420, outOfStock: 1, lowStock: 3 },
  books: mockBooks.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    stock: b.stock,
    categoryName: b.categoryName,
    isPublished: b.isPublished,
    lastMovementAt: "2026-09-18T10:15:00Z"
  })),
  movements: []
};

await page.route("**/api/admin/dashboard", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockDashboard }) }));
await page.route("**/api/admin/orders", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockOrders }) }));
await page.route("**/api/admin/orders/*", route => {
  const url = route.request().url();
  const id = parseInt(url.split("/").pop() || "1048", 10);
  const order = mockOrders.find(o => o.id === id) || mockOrders[0];
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: order }) });
});
await page.route("**/api/admin/books", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockBooks }) }));
await page.route("**/api/admin/categories", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockCategories }) }));
await page.route("**/api/admin/users", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockUsers }) }));
await page.route("**/api/admin/inventory*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockInventory }) }));
await page.route("**/api/admin/security-events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
await page.route("**/api/admin/audit-events", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
await page.route("**/api/admin/coupons", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }));
await page.route("**/api/admin/security-report", route => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    data: {
      available: true,
      summary: {
        generatedAt: "2026-09-18T10:00:00Z",
        total: 10,
        passed: 10,
        baselineVulnerable: 10,
        secureProtected: 10
      },
      results: []
    }
  })
}));
await page.route("**/api/books/categories", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockCategories }) }));
await page.route("**/api/books**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockBooks }) }));

console.log("Navigating to http://localhost:5174/admin ...");
await page.goto("http://localhost:5174/admin", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// 01: Overview (KPIs + Recent Orders + Embedded AdminCharts)
await page.screenshot({ path: `${outDir}/01-admin-overview.png` });
console.log("Captured 01-admin-overview.png");

// 02: Orders tab (Single-card unified table)
const ordersTab = page.locator("button.sidebar-link", { hasText: "Đơn hàng" }).first();
if (await ordersTab.count()) {
  await ordersTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/02-admin-orders.png` });
  console.log("Captured 02-admin-orders.png");

  // Click on first row to select
  const firstOrderRow = page.locator("table tbody tr").first();
  if (await firstOrderRow.count()) {
    await firstOrderRow.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/02-admin-orders-selected.png` });
    console.log("Captured 02-admin-orders-selected.png");

    // Click "Xem chi tiết đơn hàng"
    const viewDetailBtn = page.locator("button", { hasText: "Xem chi tiết đơn hàng" }).first();
    if (await viewDetailBtn.count()) {
      await viewDetailBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${outDir}/03-admin-order-detail.png` });
      console.log("Captured 03-admin-order-detail.png");

      const closeBtn = page.locator("button", { hasText: "Đóng cửa sổ" }).first();
      if (await closeBtn.count()) await closeBtn.click();
      await page.waitForTimeout(400);

      const deselectBtn = page.locator("button[title='Bỏ chọn']").first();
      if (await deselectBtn.count()) await deselectBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // Switch to Grid / Cards view
  const gridBtn = page.locator("button", { hasText: "Thẻ" }).first();
  if (await gridBtn.count()) {
    await gridBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/02-admin-orders-grid.png` });
    console.log("Captured 02-admin-orders-grid.png");

    // Switch back to details
    const listBtn = page.locator("button", { hasText: "Danh sách" }).first();
    if (await listBtn.count()) await listBtn.click();
    await page.waitForTimeout(300);
  }
}

// 04: Books tab (Single-card table + monogram cover fallbacks)
const booksTab = page.locator("button.sidebar-link", { hasText: "Kho sách" }).first();
if (await booksTab.count()) {
  await booksTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/04-admin-books.png` });
  console.log("Captured 04-admin-books.png");

  // 05: Edit book modal (Non-scrolling layout)
  const editBtn = page.locator("button", { hasText: "Sửa" }).first();
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/05-admin-book-modal.png` });
    console.log("Captured 05-admin-book-modal.png");

    const cancelBtn = page.locator("button", { hasText: "Hủy bỏ" }).first();
    if (await cancelBtn.count()) await cancelBtn.click();
    await page.waitForTimeout(300);
  }
}

// 06: Inventory tab (Single-card table with HUD cards)
const invTab = page.locator("button.sidebar-link", { hasText: "Tồn kho" }).first();
if (await invTab.count()) {
  await invTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/06-admin-inventory.png` });
  console.log("Captured 06-admin-inventory.png");

  // 07: Stock adjustment audit modal
  const adjustBtn = page.locator("button", { hasText: "Điều chỉnh kho" }).first();
  if (await adjustBtn.count()) {
    await adjustBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/07-admin-inventory-audit-modal.png` });
    console.log("Captured 07-admin-inventory-audit-modal.png");

    const closeAudit = page.locator("button", { hasText: "✕" }).first();
    if (await closeAudit.count()) await closeAudit.click();
    await page.waitForTimeout(300);
  }
}

// 08: Categories tab
const catTab = page.locator("button.sidebar-link", { hasText: "Thể loại" }).first();
if (await catTab.count()) {
  await catTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/08-admin-categories.png` });
  console.log("Captured 08-admin-categories.png");
}

// 09: Accounts tab
const accTab = page.locator("button.sidebar-link", { hasText: "Người dùng" }).first();
if (await accTab.count()) {
  await accTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/09-admin-accounts.png` });
  console.log("Captured 09-admin-accounts.png");
}

await browser.close();

// Copy screenshots to artifact directory for display
const files = [
  "01-admin-overview.png",
  "02-admin-orders.png",
  "02-admin-orders-selected.png",
  "02-admin-orders-grid.png",
  "03-admin-order-detail.png",
  "04-admin-books.png",
  "05-admin-book-modal.png",
  "06-admin-inventory.png",
  "07-admin-inventory-audit-modal.png",
  "08-admin-categories.png",
  "09-admin-accounts.png"
];

for (const file of files) {
  const src = `${outDir}/${file}`;
  if (existsSync(src)) {
    await copyFile(src, `${artifactDir}/${file}`);
  }
}

console.log("All admin screenshots captured and copied to artifacts!");

