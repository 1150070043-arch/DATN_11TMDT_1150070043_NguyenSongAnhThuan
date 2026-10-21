import { expect, test, type BrowserContext } from "@playwright/test";
import { login as loginUi } from "./helpers";

const secure = process.env.SECURE_URL ?? "http://localhost:4002";
const baseline = process.env.BASELINE_URL ?? "http://localhost:4001";
const credentials = { email: "customer.a@bookguard.local", password: "Customer@123" };

async function login(context: BrowserContext, url: string) {
  const response = await context.request.post(`${url}/api/auth/login`, { data: credentials });
  expect(response.status()).toBe(200);
  return (await response.json()).data.csrfToken as string | undefined;
}

test("twin-isolation: simultaneous logins, refresh and baseline logout preserve secure session", async ({ context }) => {
  let csrf = await login(context, secure);
  try {
    await login(context, baseline);
    const names = (await context.cookies()).map(cookie => cookie.name);
    expect(names).toContain("bg_secure_session");
    expect(names).toContain("bg_baseline_session");
    expect(names).toContain("bg_secure_refresh");
    expect(names).not.toContain("bg_session");
    expect((await context.request.get(`${secure}/api/auth/me`)).status()).toBe(200);
    expect((await context.request.get(`${baseline}/api/auth/me`)).status()).toBe(200);
    const refresh = await context.request.post(`${secure}/api/auth/refresh`, { headers: { "x-csrf-token": csrf! } });
    expect(refresh.status()).toBe(200);
    csrf = (await refresh.json()).data.csrfToken;
    expect((await context.request.get(`${baseline}/api/auth/me`)).status()).toBe(200);
    expect((await context.request.post(`${baseline}/api/auth/logout`)).status()).toBe(204);
    expect((await context.request.get(`${baseline}/api/auth/me`)).status()).toBe(401);
    expect((await context.request.get(`${secure}/api/auth/me`)).status()).toBe(200);
  } finally {
    await context.request.post(`${secure}/api/auth/logout`, { headers: { "x-csrf-token": csrf ?? "" } });
    await context.request.post(`${baseline}/api/auth/logout`);
  }
});

test("twin-isolation: foreign tokens are rejected and secure logout preserves baseline session", async ({ context, playwright }) => {
  const csrf = await login(context, secure);
  await login(context, baseline);
  const cookies = await context.cookies();
  const probe = await playwright.request.newContext();
  try {
    for (const [source, target] of [["secure", baseline], ["baseline", secure]]) {
      const token = cookies.find(cookie => cookie.name === `bg_${source}_session`)!.value;
      const response = await probe.get(`${target}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
      expect(response.status()).toBe(401);
    }
    expect((await context.request.post(`${secure}/api/auth/logout`, { headers: { "x-csrf-token": csrf! } })).status()).toBe(204);
    expect((await context.request.get(`${baseline}/api/auth/me`)).status()).toBe(200);
    expect((await context.request.get(`${secure}/api/auth/me`)).status()).toBe(401);
  } finally {
    await probe.dispose();
    await context.request.post(`${baseline}/api/auth/logout`);
    await context.request.post(`${secure}/api/auth/logout`, { headers: { "x-csrf-token": csrf ?? "" } });
  }
});

test("twin-isolation: comparison screen displays failures instead of hardcoded PASS", async ({ page }) => {
  await page.route("**/api/admin/security-report", route => route.fulfill({
    json: { data: {
      available: true,
      summary: { generatedAt: new Date().toISOString(), total: 1, passed: 0, baselineVulnerable: 1, secureProtected: 0 },
      results: [{
        id: "TC01", name: "Isolation regression fixture", passed: false,
        baseline: { protected: false, status: 200, evidence: "Mock baseline evidence" },
        secure: { protected: false, status: 200, evidence: "Mock secure failure" }
      }]
    } }
  }));
  await loginUi(page, "admin");
  await page.locator("aside").getByRole("button", { name: /Đối chiếu an ninh/ }).click();
  await expect(page.getByText("CHẶN 0/1", { exact: true })).toBeVisible();
  await expect(page.getByText("CHƯA ĐẠT", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa ngăn chặn", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa đủ dữ liệu", { exact: true })).toBeVisible();
  await expect(page.getByText("10/10 PASS", { exact: true })).toHaveCount(0);
  await expect(page.getByText("AN TOÀN", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ĐẠT CHUẨN", { exact: true })).toHaveCount(0);
});
