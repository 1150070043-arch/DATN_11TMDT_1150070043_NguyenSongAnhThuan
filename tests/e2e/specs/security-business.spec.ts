import { test, expect, type BrowserContext } from '@playwright/test';

const modes = ['baseline', 'secure'] as const;
async function login(context: BrowserContext, mode: typeof modes[number]) {
  const api = `http://localhost:${mode === 'baseline' ? 4001 : 4002}`;
  const health = await context.request.get(`${api}/api/health`);
  expect(health.ok(), 'API must be healthy before interpreting a security result').toBe(true);
  const state = (await health.json()).data;
  expect(state.auditFixture, 'Only isolated audit databases may be used').toBe(true);
  expect(state.mode).toBe(mode);
  const response = await context.request.post(`${api}/api/auth/login`, {
    data: { email: 'customer.a@bookguard.local', password: 'Customer@123' }
  });
  expect(response.status()).toBe(200);
  return api;
}

for (const mode of modes) {
  const web = `http://localhost:${mode === 'baseline' ? 5173 : 5174}`;
  test(`TC08 ${mode}: foreign-origin offer reads orders only when CORS permits it`, async ({ page, context }) => {
    const api = await login(context, mode);
    // A trusted browser request establishes that the session and order data work.
    await page.goto(`${web}/orders`, { waitUntil: 'domcontentloaded' });
    const ownOrders = await page.evaluate(async () => {
      const response = await fetch('/api/orders', { credentials: 'include' });
      const body = await response.json();
      return { status: response.status, ids: body.data.map((order: { id: number }) => order.id) as number[] };
    });
    expect(ownOrders.status).toBe(200); expect(ownOrders.ids.length).toBeGreaterThan(0);
    await page.goto('http://localhost:5500');
    const button = page.locator(`#${mode}`);
    await expect(button).toBeEnabled();
    // CORS-blocked responses may emit requestfailed rather than Playwright's response event.
    // CDP supplies the actual HTTP status/headers without making the body readable to page JS.
    const network = await context.newCDPSession(page);
    await network.send('Network.enable');
    const orderRequests = new Set<string>();
    const origins = new Map<string, string>();
    network.on('Network.requestWillBeSent', event => {
      if (event.request.url === `${api}/api/orders`) orderRequests.add(event.requestId);
    });
    network.on('Network.requestWillBeSentExtraInfo', event => {
      const origin = Object.entries(event.headers).find(([key]) => key.toLowerCase() === 'origin')?.[1];
      if (origin) origins.set(event.requestId, String(origin));
    });
    const pending = new Promise<{ status: number; headers: Record<string, string>; origin: string }>(resolve => {
      network.on('Network.responseReceivedExtraInfo', event => {
        if (orderRequests.has(event.requestId)) resolve({ status: event.statusCode,
          headers: Object.fromEntries(Object.entries(event.headers).map(([key, value]) => [key.toLowerCase(), String(value)])),
          origin: origins.get(event.requestId)! });
      });
    });
    await button.click();
    const response = await pending;
    expect(response.status).toBe(200); // A 401, outage, or throttle must not pass as a CORS block.
    expect(response.origin).toBe('http://localhost:5500');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    if (mode === 'baseline') {
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5500');
      expect(response.headers['x-powered-by']).toBe('Express');
      await expect(page.locator('#baseline-status')).toContainText('ĐỌC ĐƯỢC LỊCH SỬ MUA HÀNG');
      await expect(page.locator('#baseline-result tbody tr')).toHaveCount(ownOrders.ids.length);
      const shownIds = await page.locator('#baseline-result tbody tr td:first-child').allTextContents();
      expect(shownIds.map(Number)).toEqual(ownOrders.ids);
    } else {
      expect(response.headers['access-control-allow-origin']).toBe(web);
      expect(response.headers['x-powered-by']).toBeUndefined();
      await expect(page.locator('#secure-status')).toContainText('KHÔNG ĐỌC ĐƯỢC RESPONSE');
      await expect(page.locator('#secure-result table')).toHaveCount(0);
    }
    await network.detach();
    await page.screenshot({ path: test.info().outputPath('demo.png'), fullPage: true });
  });

  test(`TC09 ${mode}: trusted-origin profile inspector classifies actual response fields`, async ({ page, context }) => {
    await login(context, mode);
    await page.goto(`${web}/profile`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${web}/lab/profile-exposure.html`);
    const pending = page.waitForResponse(response => response.url() === `${web}/api/auth/me`);
    await page.getByRole('button', { name: 'Kiểm tra dữ liệu API' }).click();
    const response = await pending;
    expect(response.status()).toBe(200);
    const profile = (await response.json()).data;
    const fields = Object.keys(profile).sort();
    await expect(page.locator('#fields')).toBeVisible();
    expect(await page.locator('#fields tbody td:first-child').allTextContents()).toEqual(fields);
    await expect(page.locator('#metadata')).toContainText(`${mode} · HTTP 200`);
    if (mode === 'baseline') {
      expect(fields).toContain('PasswordSecret');
      await expect(page.locator('#status')).toContainText('PHÁT HIỆN DỮ LIỆU NHẠY CẢM');
      // Never include the credential value in a screenshot, table, or status label.
      expect((await page.locator('body').innerText()).includes(profile.PasswordSecret)).toBe(false);
    } else {
      expect(fields.some(field => /password|secret|token|credential|salt|hash/i.test(field))).toBe(false);
      await expect(page.locator('#status')).toContainText('DTO ĐƯỢC GIỚI HẠN');
      await expect(page.locator('#fields .danger')).toHaveCount(0);
    }
    await page.screenshot({ path: test.info().outputPath('demo.png'), fullPage: true });
  });
}

test('TC08: an unauthenticated baseline request is inconclusive, not a successful exploit', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await expect(page.locator('#baseline')).toBeEnabled();
  await page.locator('#baseline').click();
  await expect(page.locator('#baseline-status')).toContainText('HTTP 401');
  await expect(page.locator('#baseline-result table')).toHaveCount(0);
});

test('TC09: a missing session cannot be reported as a safe DTO', async ({ page }) => {
  await page.goto('http://localhost:5174/lab/profile-exposure.html');
  await page.getByRole('button', { name: 'Kiểm tra dữ liệu API' }).click();
  await expect(page.locator('#status')).toContainText('HTTP 401');
  await expect(page.locator('#fields')).toBeHidden();
});

test('TC09: a regular database cannot be inspected by the lab helper', async ({ page }) => {
  let meRequested = false;
  await page.route('**/api/health', route => route.fulfill({ json: { data: { mode: 'secure', database: 'connected', auditFixture: false } } }));
  await page.route('**/api/auth/me', route => { meRequested = true; return route.fulfill({ status: 500 }); });
  await page.goto('http://localhost:5174/lab/profile-exposure.html');
  await page.getByRole('button', { name: 'Kiểm tra dữ liệu API' }).click();
  await expect(page.locator('#status')).toContainText('Cần đúng API audit');
  expect(meRequested).toBe(false);
});
