import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("customer can buy a real seeded book then cancel with stock return", async ({ page }) => {
  await login(page);
  const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:4002';
  const initial = await (await page.request.get(`${apiUrl}/api/books/clean-code`)).json();
  await page.goto("/catalog", { waitUntil: 'domcontentloaded' });
  const search = page.getByLabel("Tìm theo tên sách hoặc tác giả");
  await search.fill("Clean Code");
  await search.press("Enter");

  const card = page.locator(".book-card").filter({ hasText: "Clean Code" });
  await card.hover();
  await card.getByRole("button", { name: "Thêm Clean Code vào giỏ", exact: true }).click();
  await expect(page.getByText('Đã thêm "Clean Code" vào giỏ')).toBeVisible();

  await page.locator('header').getByRole("button", { name: 'Giỏ hàng', exact: true }).click();
  await expect(page.getByText("Clean Code", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText("Clean Code", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Tiến hành thanh toán/ }).click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Nguyễn Minh An");
  await page.getByLabel("Số điện thoại").fill("0987000001");
  await page.getByLabel("Địa chỉ", { exact: true }).fill("236 Lê Văn Sỹ, TP. Hồ Chí Minh");
  await page.getByRole("button", { name: "Đặt hàng", exact: true }).click();

  await expect(page).toHaveURL(/\/confirmation\/\d+$/);
  const orderId = Number(page.url().split('/').at(-1));
  expect(orderId).toBeGreaterThan(0);
  const saved = await (await page.request.get(`${apiUrl}/api/orders/${orderId}`)).json();
  expect(saved.data.shippingAddress).toBe('236 Lê Văn Sỹ, TP. Hồ Chí Minh');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Xem chi tiết đơn hàng", exact: true }).click();
  await page.getByRole("button", { name: "Xem đơn" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Hủy đơn hàng" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hủy đơn" }).click();
  await expect(page.getByText(new RegExp(`Đã hủy đơn #${orderId}`))).toBeVisible();
  await expect(page.getByRole("button", { name: `Xem chi tiết đơn ${orderId}`, exact: true })).toContainText('Đã hủy');
  await expect.poll(async () => (await (await page.request.get(`${apiUrl}/api/books/clean-code`)).json()).data.stock).toBe(initial.data.stock);
});
