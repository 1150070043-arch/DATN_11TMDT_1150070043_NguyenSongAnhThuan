import { expect, type Page } from "@playwright/test";

export async function login(page: Page, role: "customer" | "admin" = "customer") {
  const credentials = role === "admin"
    ? { email: "admin@bookguard.local", password: "Admin@12345" }
    : { email: "customer.a@bookguard.local", password: "Customer@123" };
  await page.goto("/login", { waitUntil: 'domcontentloaded' });
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu").fill(credentials.password);
  await page.locator('form').getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(role === "admin" ? /\/admin$/ : /\/$/);
  await expect(page.locator('header').getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
}
