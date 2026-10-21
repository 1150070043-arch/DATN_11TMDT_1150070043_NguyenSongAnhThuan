import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
});
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

// UI fixtures only. Real SQL/signature/state checks live in payment-regressions.ts.
async function openPayments(page: Page, queryAvailable = true) {
  const state = { pending: true };
  await page.route("http://localhost:4002/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/auth/me" ? { id: 1, email: "admin@example.test", fullName: "Admin", role: "admin", emailVerified: true }
      : path === "/api/auth/csrf" ? { csrfToken: "fixture" }
      : path === "/api/cart" ? { items: [], total: 0 }
      : path === "/api/admin/dashboard" ? { summary: { customers: 1, books: 0, orders: 0, revenue: 0, pendingOrders: 0 }, recentOrders: [], ordersByStatus: [], revenueByDay: [], lowStock: [], topSelling: [] }
      : path === "/api/admin/security-report" ? { available: false }
      : path === "/api/admin/payment-reconciliation" ? [{ id: 501, orderId: 12, amount: 100000, transactionNo: "123456", reviewReason: "Đơn đã hủy", customerName: "Khách thử" }]
      : path === "/api/admin/payment-pending" ? (state.pending ? [{ id: 601, orderId: 13, amount: 100000, state: "pending", customerName: "Khách thử" }] : [])
      : path === "/api/admin/order-notifications" ? { summary: [], pending: [] }
      : [];
    await route.fulfill({ json: { data, meta: { total: 0, queryAvailable } } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Đơn hàng", exact: true }).filter({ visible: true }).click();
  await page.locator("summary").filter({ hasText: "Đối soát thanh toán" }).click();
  await expect(page.getByLabel("Mã tham chiếu hoàn tiền")).toBeVisible();
  await page.locator("summary").filter({ hasText: "Giao dịch chưa xác nhận" }).click();
  return state;
}

test("provider failure retains refund input and query can be retried", async ({ page }) => {
  await openPayments(page);
  let calls = 0;
  await page.route("**/api/admin/payment-reconciliation/601/query", route => {
    calls++;
    return route.fulfill({ status: 502, json: { error: { message: "Chưa nhận được kết quả VNPay." } } });
  });
  await page.getByLabel("Mã tham chiếu hoàn tiền").fill("REFUND-1234");
  await page.getByLabel("Ghi chú đối soát").fill("Đã kiểm tra giao dịch trong cổng VNPay.");
  const query = page.getByRole("button", { name: "Truy vấn VNPay giao dịch 601" });
  await query.click();
  await expect(page.getByRole("alert")).toContainText("Chưa nhận được kết quả VNPay.");
  await expect(page.getByLabel("Mã tham chiếu hoàn tiền")).toHaveValue("REFUND-1234");
  await query.click();
  await expect.poll(() => calls).toBe(2);
  await expect(query).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("query disables overlapping actions and refreshing retains another refund draft", async ({ page }) => {
  const state = await openPayments(page);
  let calls = 0;
  let release!: () => void;
  const responseReady = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/admin/payment-reconciliation/601/query", async route => {
    calls++; await responseReady; state.pending = false;
    await route.fulfill({ json: { data: { message: "VNPay xác nhận thanh toán thành công." } } });
  });
  await page.getByLabel("Mã tham chiếu hoàn tiền").fill("REFUND-DRAFT");
  const query = page.getByRole("button", { name: "Truy vấn VNPay giao dịch 601" });
  await query.click();
  await expect(query).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ghi nhận đã hoàn tiền" })).toBeDisabled();
  expect(calls).toBe(1); release();
  await expect(page.getByRole("status").filter({ hasText: "VNPay xác nhận thanh toán thành công." })).toBeVisible();
  await expect(query).toHaveCount(0);
  await expect(page.getByLabel("Mã tham chiếu hoàn tiền")).toHaveValue("REFUND-DRAFT");
  await expect(page.getByRole("button", { name: "Ghi nhận đã hoàn tiền" })).toBeEnabled();
});

test("disabled provider queries show a concrete portal instruction", async ({ page }) => {
  await openPayments(page, false);
  await expect(page.getByText("Chưa bật truy vấn VNPay. Kiểm tra giao dịch trong cổng quản trị VNPay.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Truy vấn VNPay giao dịch/ })).toHaveCount(0);
});
