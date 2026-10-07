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

  // Navigate to "Tồn kho"
  console.log('Clicking on Tồn kho tab...');
  const invBtn = page.locator('button:has-text("Tồn kho")').first();
  await invBtn.click();
  await page.waitForTimeout(1500);

  // 1. Initial Inventory View
  await page.screenshot({ path: `${basePath}/inventory_explorer_initial.png` });
  console.log('Inventory Explorer Initial captured');

  // 2. Select a book (first row)
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/inventory_explorer_selected.png` });
    console.log('Inventory Explorer Selected captured');
  }

  // 3. Click "Xem sổ biến động"
  const ledgerBtn = page.locator('button:has-text("Xem sổ biến động")').first();
  if (await ledgerBtn.count() > 0) {
    await ledgerBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/inventory_explorer_drilldown.png` });
    console.log('Inventory Explorer Drilldown captured');

    // Click back to inventory
    const backBtn = page.locator('button:has-text("Quản lý tồn kho")').first();
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // 4. Click "Điều chỉnh tồn kho" to verify modal
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(500);
    const adjustBtn = page.locator('button:has-text("Điều chỉnh tồn kho")').first();
    if (await adjustBtn.count() > 0) {
      await adjustBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${basePath}/inventory_explorer_modal.png` });
      console.log('Inventory Explorer Modal captured');

      // Close modal
      const cancelBtn = page.locator('button:has-text("Hủy bỏ")').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // 5. Test Light Mode
  console.log('Switching to Light Mode...');
  const lightBtn = page.locator('button[title*="Sáng"]').first();
  if (await lightBtn.count() > 0) {
    await lightBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${basePath}/inventory_explorer_light.png` });
    console.log('Inventory Explorer Light captured');
  }

  await browser.close();
  console.log('Done capturing all inventory explorer screenshots!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

