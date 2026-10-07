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

  // Navigate to "Thể loại"
  console.log('Clicking on Thể loại...');
  const catBtn = page.locator('button:has-text("Thể loại")').first();
  await catBtn.click();
  await page.waitForTimeout(1500);

  // 1. Initial Explorer View
  await page.screenshot({ path: `${basePath}/categories_explorer_initial.png` });
  console.log('Categories Explorer Initial captured');

  // 2. Select a category (click on first row, e.g. "Văn học" or first folder)
  const firstFolder = page.locator('tbody tr').first();
  if (await firstFolder.count() > 0) {
    await firstFolder.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/categories_explorer_selected.png` });
    console.log('Categories Explorer Selected captured');
  }

  // 3. Double click on a folder to drill down into books
  if (await firstFolder.count() > 0) {
    await firstFolder.dblclick();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/categories_explorer_drilldown.png` });
    console.log('Categories Explorer Drilldown into books captured');
  }

  // 4. Click back to Thể loại via breadcrumb
  const breadcrumbCat = page.locator('button:has-text("Thể loại")').last();
  if (await breadcrumbCat.count() > 0) {
    await breadcrumbCat.click();
    await page.waitForTimeout(1000);
  }

  // 5. Test Light Mode
  console.log('Switching to Light Mode...');
  const lightBtn = page.locator('button[title*="Sáng"], button:has-text("Sáng")').first();
  if (await lightBtn.count() > 0) {
    await lightBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/categories_explorer_light.png` });
    console.log('Categories Explorer Light captured');
  }

  await browser.close();
  console.log('Done capturing all categories explorer screenshots!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

