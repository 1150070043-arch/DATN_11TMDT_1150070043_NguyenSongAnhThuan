import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin overview, audited inventory and order details work end to end", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin", { waitUntil: 'domcontentloaded' });
  await expect(page.locator('aside').getByRole('button', { name: 'Tổng quan', exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tổng quan kinh doanh", exact: true })).toBeVisible();

  await page.locator('aside').getByRole("button", { name: "Tồn kho", exact: true }).click();
  const bookRow = page.getByRole('button', { name: 'Điều chỉnh kho Clean Code', exact: true });
  const stock = page.getByRole('row').filter({ has: bookRow }).getByRole('cell').nth(2);
  const stockBefore = Number((await stock.textContent())?.replace(/\D/g, ''));
  await bookRow.click();
  await page.getByLabel("Số lượng thay đổi").fill("1");
  await page.getByLabel("Lý do").fill("Playwright kiểm tra ledger nhập kho");
  await page.getByRole("button", { name: "Xác nhận điều chỉnh" }).click();
  await expect(page.getByText(/Đã cập nhật tồn kho/)).toBeVisible();
  await expect(stock).toHaveText(`${stockBefore + 1} cuốn`);

  await bookRow.click();
  await page.getByLabel("Số lượng thay đổi").fill("-1");
  await page.getByLabel("Lý do").fill("Playwright hoàn nguyên tồn kho sau kiểm thử");
  await page.getByRole("button", { name: "Xác nhận điều chỉnh" }).click();
  await expect(stock).toHaveText(`${stockBefore} cuốn`);

  await page.locator('aside').getByRole("button", { name: "Đơn hàng", exact: true }).click();
  const detailButton = page.getByRole('row').filter({ hasText: 'Chờ xác nhận' }).first().getByRole('button', { name: /Chi tiết đơn/ });
  await detailButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Cập nhật trạng thái')).toBeVisible();
  await expect.poll(() => page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(detailButton).toBeFocused();
});
