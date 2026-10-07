const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5174/login');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Admin demo")');
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:5174/admin');
  await page.waitForTimeout(2000);

  const basePath = 'C:/Users/Thang/.gemini/antigravity/brain/0d0622ce-7a81-48c2-897e-7acfcaea9461';

  // Navigate to "Thể loại"
  const catBtn = page.locator('button:has-text("Thể loại")').first();
  await catBtn.click();
  await page.waitForTimeout(1000);

  // 1. Grid view
  const gridToggle = page.locator('button:has-text("⊞ Lưới")').first();
  if (await gridToggle.count() > 0) {
    await gridToggle.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/categories_explorer_grid.png` });
    console.log('Categories Grid captured');
  }

  // 2. Light mode in details view
  const listToggle = page.locator('button:has-text("▦ Danh sách")').first();
  if (await listToggle.count() > 0) {
    await listToggle.click();
    await page.waitForTimeout(500);
  }

  const lightBtn = page.locator('button[title*="Sáng"]').first();
  if (await lightBtn.count() > 0) {
    await lightBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/categories_explorer_light.png` });
    console.log('Categories Light captured');
  }

  await browser.close();
  console.log('Done capturing extra views!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

