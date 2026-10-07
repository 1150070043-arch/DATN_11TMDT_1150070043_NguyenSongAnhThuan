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
  await page.waitForTimeout(2500);

  const basePath = 'C:/Users/Thang/.gemini/antigravity/brain/0d0622ce-7a81-48c2-897e-7acfcaea9461';

  await page.screenshot({ path: `${basePath}/admin_redesign_overview.png` });
  console.log('Overview captured');

  // Click on Sự kiện bảo mật
  const secEventsBtn = page.locator('button:has-text("Sự kiện bảo mật")').first();
  if (await secEventsBtn.count() > 0) {
    await secEventsBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${basePath}/admin_redesign_security_events.png` });
    console.log('Security events captured');
  }

  // Click on Đối chiếu an ninh
  const secCompareBtn = page.locator('button:has-text("Đối chiếu an ninh")').first();
  if (await secCompareBtn.count() > 0) {
    await secCompareBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${basePath}/admin_redesign_security_compare.png` });
    console.log('Security compare captured');
  }

  // Click on Đơn hàng
  const ordersBtn = page.locator('button:has-text("Đơn hàng")').first();
  if (await ordersBtn.count() > 0) {
    await ordersBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${basePath}/admin_redesign_orders.png` });
    console.log('Orders captured');
  }

  // Click on Kho sách
  const booksBtn = page.locator('button:has-text("Kho sách")').first();
  if (await booksBtn.count() > 0) {
    await booksBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${basePath}/admin_redesign_books.png` });
    console.log('Books captured');
  }

  await browser.close();
  console.log('Done capturing all screenshots!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
