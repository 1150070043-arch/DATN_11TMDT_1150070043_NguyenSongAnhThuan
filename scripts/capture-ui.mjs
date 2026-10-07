import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.BOOKGUARD_WEB_URL ?? "http://localhost:5174";
await mkdir("UI", { recursive: true });

const browser = await chromium.launch({ headless: true });

async function prepare(page, reveal = false) {
  await page.waitForTimeout(1300);
  if (reveal) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 650) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(70);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
}

async function shot(page, file, reveal = false) {
  await prepare(page, reveal);
  await page.screenshot({ path: `UI/${file}`, fullPage: true });
  console.log(file);
}

async function open(page, path, file, reveal = false) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await shot(page, file, reveal);
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.waitForTimeout(800);
}

const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const publicPage = await publicContext.newPage();
await open(publicPage, "/", "01-trang-chu-danh-muc.png", true);
await open(publicPage, "/catalog", "02-danh-muc-sach.png");
await open(publicPage, "/books/nhat-ky-chu-be-nhut-nhat", "03-chi-tiet-sach.png");
await open(publicPage, "/login", "04-dang-nhap.png");
await open(publicPage, "/register", "05-dang-ky.png");
await open(publicPage, "/forgot-password", "06-quen-mat-khau.png");
await open(publicPage, "/reset-password", "07-dat-lai-mat-khau.png");
await open(publicPage, "/verify-email", "08-xac-minh-email.png");
await open(publicPage, "/khong-ton-tai", "09-trang-404.png");
await publicContext.close();

const customerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const customerPage = await customerContext.newPage();
await login(customerPage, "customer.a@bookguard.local", "Customer@123");
await open(customerPage, "/", "10-trang-chu-da-dang-nhap.png", true);

await customerPage.goto(`${baseUrl}/catalog`, { waitUntil: "domcontentloaded" });
await customerPage.waitForTimeout(1200);
const firstCard = customerPage.locator(".final-book-card").first();
if (await firstCard.count()) {
  await firstCard.hover();
  const addButton = firstCard.getByRole("button", { name: /Thêm vào giỏ/ });
  if (await addButton.count()) {
    await addButton.click();
    await customerPage.waitForTimeout(800);
  }
}
await open(customerPage, "/cart", "11-gio-hang.png");
await open(customerPage, "/checkout", "12-thanh-toan.png");
await open(customerPage, "/wishlist", "13-sach-yeu-thich.png");
await open(customerPage, "/orders", "14-don-hang-cua-toi.png");
const orderButton = customerPage.getByRole("button", { name: /Xem chi tiết đơn/ }).first();
if (await orderButton.count()) {
  await orderButton.click();
  await customerPage.waitForTimeout(400);
  await shot(customerPage, "15-chi-tiet-don-hang.png");
}
await open(customerPage, "/profile", "16-ho-so-va-bao-mat.png");
await customerContext.close();

const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const adminPage = await adminContext.newPage();
await login(adminPage, "admin@bookguard.local", "Admin@12345");
await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
await adminPage.waitForTimeout(1800);

const adminTabs = [
  ["Tổng quan", "17-admin-tong-quan.png"],
  ["Đơn hàng", "18-admin-don-hang.png"],
  ["Sách", "19-admin-sach.png"],
  ["Tồn kho", "20-admin-ton-kho.png"],
  ["Ưu đãi", "21-admin-uu-dai.png"],
  ["Thể loại", "22-admin-the-loai.png"],
  ["Tài khoản", "23-admin-tai-khoan.png"],
  ["Thực nghiệm", "24-admin-thuc-nghiem.png"],
  ["Đối chiếu bảo mật", "25-admin-doi-chieu-bao-mat.png"],
  ["Sự kiện bảo mật", "26-admin-su-kien-bao-mat.png"],
  ["Nhật ký quản trị", "27-admin-nhat-ky-quan-tri.png"]
];

for (const [tab, file] of adminTabs) {
  const button = adminPage.getByRole("tab", { name: tab, exact: true });
  if (await button.count()) {
    await button.click();
    await adminPage.waitForTimeout(500);
    await shot(adminPage, file);
  }
}

await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
await adminPage.waitForTimeout(1200);
await adminPage.getByRole("tab", { name: "Đơn hàng", exact: true }).click();
const detailButton = adminPage.getByRole("button", { name: "Chi tiết", exact: true }).first();
if (await detailButton.count()) {
  await detailButton.click();
  await adminPage.waitForTimeout(300);
  await shot(adminPage, "28-admin-chi-tiet-don-hang.png");
}

await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
await adminPage.waitForTimeout(1200);
await adminPage.getByRole("tab", { name: "Sách", exact: true }).click();
await adminPage.getByRole("button", { name: "Thêm sách", exact: true }).click();
await shot(adminPage, "29-admin-form-them-sach.png");

await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
await adminPage.waitForTimeout(1200);
await adminPage.getByRole("tab", { name: "Thể loại", exact: true }).click();
await adminPage.getByRole("button", { name: "Thêm thể loại", exact: true }).click();
await shot(adminPage, "30-admin-form-them-the-loai.png");

await browser.close();
