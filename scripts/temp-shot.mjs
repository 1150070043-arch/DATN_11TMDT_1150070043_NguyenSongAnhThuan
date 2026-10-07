import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = "UI/temp-check";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Login
await page.goto("http://localhost:5174/login", { waitUntil: "domcontentloaded" });
await page.getByLabel("Email").fill("admin@bookguard.local");
await page.getByLabel("Mật khẩu", { exact: true }).fill("Admin@12345");
await page.locator("button[type='submit']").click();
await page.waitForTimeout(1500);

// Admin Overview
await page.goto("http://localhost:5174/admin", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/01-admin-overview.png` });

// Admin Orders
const ordersTab = page.locator("button.sidebar-link", { hasText: "Đơn hàng" }).first();
if (await ordersTab.count()) {
  await ordersTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/02-admin-orders.png` });

  // Open order detail
  const detailBtn = page.locator("button", { hasText: "Chi tiết" }).first();
  if (await detailBtn.count()) {
    await detailBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/03-admin-order-detail.png` });
    // Close order modal
    const closeBtn = page.locator("button", { hasText: "✕" }).first();
    if (await closeBtn.count()) await closeBtn.click();
    await page.waitForTimeout(400);
  }
}

// Admin Books & Edit Book Modal
const booksTab = page.locator("button.sidebar-link", { hasText: "Kho sách" }).first();
if (await booksTab.count()) {
  await booksTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/04-admin-books.png` });

  // Open Edit Book modal
  const editBtn = page.locator("button", { hasText: "Sửa" }).first();
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/05-admin-book-modal.png` });
    // Close book modal
    const cancelBtn = page.locator("button", { hasText: "Hủy bỏ" }).first();
    if (await cancelBtn.count()) await cancelBtn.click();
    await page.waitForTimeout(400);
  }
}

// Admin Inventory & Audit stock modal
const invTab = page.locator("button.sidebar-link", { hasText: "Tồn kho" }).first();
if (await invTab.count()) {
  await invTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/06-admin-inventory.png` });

  // Click "Điều chỉnh" button
  const adjustBtn = page.locator("button", { hasText: "Điều chỉnh" }).first();
  if (await adjustBtn.count()) {
    await adjustBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/07-admin-inventory-audit-modal.png` });
    // Close
    const closeAudit = page.locator("button", { hasText: "Hủy thao tác" }).first();
    if (await closeAudit.count()) await closeAudit.click();
    await page.waitForTimeout(400);
  }
}

// Admin Categories
const catTab = page.locator("button.sidebar-link", { hasText: "Thể loại" }).first();
if (await catTab.count()) {
  await catTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/08-admin-categories.png` });
}

// Admin Security Events
const secEventsTab = page.locator("button.sidebar-link", { hasText: "Sự kiện bảo mật" }).first();
if (await secEventsTab.count()) {
  await secEventsTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/09-admin-security-events.png` });
}

// Admin Security Comparison
const secCompTab = page.locator("button.sidebar-link", { hasText: "Đối chiếu an ninh" }).first();
if (await secCompTab.count()) {
  await secCompTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/10-admin-security-comparison.png` });
}

// Admin Coupons
const couponTab = page.locator("button.sidebar-link", { hasText: "Ưu đãi & Voucher" }).first();
if (await couponTab.count()) {
  await couponTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/11-admin-coupons.png` });
}

// Admin Experiments
const expTab = page.locator("button.sidebar-link", { hasText: "Đo tải & Benchmark" }).first();
if (await expTab.count()) {
  await expTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/12-admin-experiments.png` });
}

await browser.close();
console.log("All screenshots captured successfully!");

