const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5174/login');
  await page.waitForTimeout(1000);

  console.log('Logging in as admin...');
  await page.click('button:has-text("Admin demo")');
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Navigating to /admin...');
  await page.goto('http://localhost:5174/admin');
  await page.waitForTimeout(2000);

  const basePath = 'C:/Users/Thang/.gemini/antigravity/brain/0d0622ce-7a81-48c2-897e-7acfcaea9461';

  // 1. Dark Mode Overview & Security
  await page.screenshot({ path: `${basePath}/admin_theme_dark_overview.png` });
  console.log('Dark Overview captured');

  // 2. Light Mode: Click "Sáng" button
  console.log('Switching to Light Mode...');
  const lightBtn = page.locator('button[title*="Sáng"], button:has-text("Sáng")').first();
  await lightBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${basePath}/admin_theme_light_overview.png` });
  console.log('Light Overview captured');

  // Light Mode Orders
  const ordersBtn = page.locator('button:has-text("Đơn hàng")').first();
  if (await ordersBtn.count() > 0) {
    await ordersBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/admin_theme_light_orders.png` });
    console.log('Light Orders captured');
  }

  // Light Mode Security Compare
  const secCompareBtn = page.locator('button:has-text("Đối chiếu an ninh")').first();
  if (await secCompareBtn.count() > 0) {
    await secCompareBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/admin_theme_light_security_compare.png` });
    console.log('Light Security compare captured');
  }

  // 3. Cyber Midnight Mode: Click "Cyber" button
  console.log('Switching to Cyber Midnight Mode...');
  const cyberBtn = page.locator('button[title*="Cyber"], button:has-text("Cyber")').first();
  await cyberBtn.click();
  await page.waitForTimeout(1000);

  // Cyber Security Events
  const secEventsBtn = page.locator('button:has-text("Sự kiện bảo mật")').first();
  if (await secEventsBtn.count() > 0) {
    await secEventsBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/admin_theme_cyber_security_events.png` });
    console.log('Cyber Security events captured');
  }

  await browser.close();
  console.log('All theme screenshots successfully captured!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

