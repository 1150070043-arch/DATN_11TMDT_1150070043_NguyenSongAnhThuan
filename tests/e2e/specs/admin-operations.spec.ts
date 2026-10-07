import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin overview, audited inventory and order details work end to end", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin", { waitUntil: 'domcontentloaded' });
  await expect(page.locator('aside')).toContainText('Quản trị Thư An');
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();

  await page.locator('aside').getByRole("button", { name: "Tồn kho", exact: true }).click();
  const bookRow = page.getByRole('button', { name: 'Điều chỉnh kho Clean Code', exact: true });
  const stock = bookRow.locator('div.text-right > span').first();
  const stockBefore = Number(await stock.textContent());
  await bookRow.click();
  await page.getByLabel("Số lượng thay đổi").fill("1");
  await page.getByLabel("Lý do").fill("Playwright kiểm tra ledger nhập kho");
  await page.getByRole("button", { name: "Xác nhận điều chỉnh" }).click();
  await expect(page.getByText(/Đã cập nhật tồn kho/)).toBeVisible();
  await expect(stock).toHaveText(String(stockBefore + 1));

  await bookRow.click();
  await page.getByLabel("Số lượng thay đổi").fill("-1");
  await page.getByLabel("Lý do").fill("Playwright hoàn nguyên tồn kho sau kiểm thử");
  await page.getByRole("button", { name: "Xác nhận điều chỉnh" }).click();
  await expect(stock).toHaveText(String(stockBefore));

  await page.locator('aside').getByRole("button", { name: "Đơn hàng", exact: true }).click();
  await page.getByRole('button', { name: /Chi tiết đơn/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Cập nhật trạng thái')).toBeVisible();
});
