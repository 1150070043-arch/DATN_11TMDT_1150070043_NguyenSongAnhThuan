import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });

  const pageBase = await browser.newPage();
  await pageBase.goto("http://localhost:5173/catalog");
  await pageBase.fill('input[placeholder*="Tìm"]', "' OR 1=1)--");
  await pageBase.waitForTimeout(1000);
  const baseCount = await pageBase.locator(".grid > div").count();
  console.log("Baseline UI search result count:", baseCount);

  const pageSec = await browser.newPage();
  await pageSec.goto("http://localhost:5174/catalog");
  await pageSec.fill('input[placeholder*="Tìm"]', "' OR 1=1)--");
  await pageSec.waitForTimeout(1000);
  const secCount = await pageSec.locator(".grid > div").count();
  console.log("Secure UI search result count:", secCount);

  await browser.close();
}

main().catch(console.error);

