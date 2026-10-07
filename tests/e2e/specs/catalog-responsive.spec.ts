import { expect, test } from "@playwright/test";

test("catalog search works at mobile width without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/catalog", { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole("heading", { name: "Tất cả đầu sách" })).toBeVisible();
  const search = page.getByLabel("Tìm theo tên sách hoặc tác giả");
  await search.fill("Clean Code");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Clean Code", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.locator('header').getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
});
