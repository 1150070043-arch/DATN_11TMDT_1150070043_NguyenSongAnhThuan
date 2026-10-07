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

  // 1. Check redesigned Inventory Modal
  const invBtn = page.locator('button:has-text("Tồn kho")').first();
  await invBtn.click();
  await page.waitForTimeout(1000);

  const firstInvRow = page.locator('tbody tr').first();
  if (await firstInvRow.count() > 0) {
    await firstInvRow.click();
    await page.waitForTimeout(500);
    const adjustBtn = page.locator('button:has-text("Điều chỉnh tồn kho")').first();
    if (await adjustBtn.count() > 0) {
      await adjustBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${basePath}/modal_adjustment_redesigned.png` });

      const cancelBtn = page.locator('button:has-text("Hủy bỏ")').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  // 2. Books tab (Kho sách)
  const booksBtn = page.locator('button:has-text("Kho sách")').first();
  await booksBtn.click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${basePath}/books_explorer_initial.png` });

  // Grid view of books
  const gridBtn = page.locator('button:has-text("⊞ Lưới")').first();
  if (await gridBtn.count() > 0) {
    await gridBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${basePath}/books_explorer_grid.png` });
  }

  await browser.close();
  console.log('Done capturing screenshots!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
