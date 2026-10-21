import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const directory = "reports/browser";
await mkdir(directory, { recursive: true });
const tls = process.argv.includes("--https");
const origin = tls ? "https://localhost:8443" : "http://localhost:5174";
const api = tls ? origin : "http://localhost:4002";
const browser = await chromium.launch();
const context = await browser.newContext({ locale: "vi-VN", ignoreHTTPSErrors: tls, viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const results = [];
async function snapshot(name, url, waitFor) {
  await page.goto(`${origin}${url}`, { waitUntil: "domcontentloaded" });
  await waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
  await page.screenshot({ path: `${directory}/${name}-viewport.png` });
  results.push({ name, url, width: (await page.viewportSize()).width, overflow: false });
}
try {
  const healthResponse = await context.request.get(`${api}/api/health`);
  assert.equal(healthResponse.status(), 200, "API must be healthy; run evidence separately from other load tests");
  const health = await healthResponse.json();
  assert.equal(health.data.auditFixture, true, "Browser evidence only runs against the isolated audit API");
  if (tls) {
    await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
    const responsePromise = page.waitForResponse(response => response.url() === `${api}/api/auth/login` && response.request().method() === "POST");
    await page.getByLabel("Email").fill("customer.a@bookguard.local");
    await page.getByLabel("Mật khẩu").fill("Customer@123");
    await page.locator("form").getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const transport = await response.securityDetails();
    assert.match(transport?.protocol ?? "", /^TLS 1\.[23]$/);
    await page.waitForURL(`${origin}/`);
    const cookies = (await context.cookies()).filter(cookie => cookie.name.startsWith("bg_secure_"));
    assert.ok(cookies.length >= 3 && cookies.every(cookie => cookie.secure));
    assert.ok(cookies.filter(cookie => cookie.name !== "bg_secure_csrf").every(cookie => cookie.httpOnly));
    assert.ok(cookies.every(cookie => cookie.sameSite === (cookie.name.includes("refresh") ? "Strict" : "Lax")));
    const homepage = await context.request.get(origin);
    assert.match(homepage.headers()["strict-transport-security"], /max-age=/);
    await snapshot("https-home", "/", () => page.getByRole("button", { name: "Đăng xuất", exact: true }).waitFor());
    results.push({ name: "HTTPS session", login: 200, transport, secureCookies: cookies.map(cookie => ({ name: cookie.name, secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite })), hsts: homepage.headers()["strict-transport-security"], certificate: "Caddy internal lab CA; ignored only by this test browser" });
  } else {
    await snapshot("home-desktop", "/", () => page.locator(".book-card").first().waitFor());
    await page.goto(`${origin}/login`);
    await page.getByLabel("Email").fill("customer.a@bookguard.local");
    await page.getByLabel("Mật khẩu").fill("Customer@123");
    await page.locator("form").getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(`${origin}/`);
    await page.setViewportSize({ width: 320, height: 720 });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__lcp = null;
      new PerformanceObserver(list => { const entries = list.getEntries(); window.__lcp = entries.at(-1)?.startTime ?? null; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await snapshot("catalog-mobile-throttled", "/catalog", async () => {
      await page.getByRole("button", { name: "Thêm Clean Code vào giỏ", exact: true }).waitFor();
      // A visible buy button does not mean its LCP cover has finished loading.
      await page.waitForTimeout(await page.evaluate(() => Math.max(0, 10000 - performance.now())));
    });
    const timing = await page.evaluate(() => ({ lcpMs: window.__lcp, domContentLoadedMs: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd, observationMs: performance.now() }));
    results.push({ name: "Throttled catalog sample", ...timing, latencyMs: 150, downloadMbps: 1.6, cpuSlowdown: 4, cache: "disabled", limitation: "One local Chromium sample over at least 10 seconds; not a field Core Web Vitals result. Use measure-storefront.mjs for repeated cold/warm comparisons." });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.getByRole("button", { name: "Thêm Clean Code vào giỏ", exact: true }).click();
    await page.getByText('Đã thêm "Clean Code" vào giỏ', { exact: true }).waitFor();
    await snapshot("cart-mobile", "/cart", () => page.getByRole("button", { name: /Tiến hành thanh toán/ }).waitFor());
    await snapshot("checkout-mobile", "/checkout", () => page.getByLabel("Địa chỉ", { exact: true }).waitFor());
    // Remove only the item added by this isolated fixture (no order was submitted).
    const csrf = (await context.cookies()).find(cookie => cookie.name === "bg_secure_csrf")?.value;
    const cart = await (await context.request.get(`${api}/api/cart`)).json();
    for (const item of cart.data.items) if (item.bookId === 1) await context.request.delete(`${api}/api/cart/items/${item.id}`, { headers: { "x-csrf-token": csrf } });
  }
  await writeFile(`${directory}/${tls ? "https" : "ux"}-evidence.json`, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
