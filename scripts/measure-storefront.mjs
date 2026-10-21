import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Read-only public-page measurements. This never logs in or writes business data.
const option = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const phase = option("phase", "after");
assert.match(phase, /^[a-z0-9-]+$/);
const samples = Number(option("samples", "3"));
assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 10);
const origin = option("origin", "http://localhost:5174");
assert.ok(["http://localhost:5174", "http://localhost:5173"].includes(origin));
const observationMs = 10000;
const directory = "reports/storefront-performance";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const route of ["/", "/catalog"]) for (let sample = 1; sample <= samples; sample++) {
    const context = await browser.newContext({ viewport: { width: 320, height: 720 }, deviceScaleFactor: 2, locale: "vi-VN" });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const identify = element => element ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${[...element.classList].slice(0, 3).join(".")}` : ""}` : null;
      window.__storefront = { lcp: [], shifts: [], longTasks: [] };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__storefront.lcp.push({ startTime: entry.startTime, renderTime: entry.renderTime, loadTime: entry.loadTime, size: entry.size, url: entry.url, element: identify(entry.element) });
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__storefront.shifts.push({ startTime: entry.startTime, value: entry.value });
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__storefront.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    });
    for (const cache of ["cold", "warm"]) {
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on("pageerror", onError);
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(await page.evaluate(windowMs => Math.max(0, windowMs - performance.now()), observationMs));
      assert.ok(await page.locator(".book-card").count() > 0, "Catalog data must render within the observation window");
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource").map(entry => ({ url: entry.name, type: entry.initiatorType, startTime: entry.startTime, responseEnd: entry.responseEnd, duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize }));
        const shifts = window.__storefront.shifts;
        let cls = 0, value = 0, first = 0, previous = 0;
        for (const shift of shifts) {
          if (shift.startTime - previous > 1000 || shift.startTime - first > 5000) { first = shift.startTime; value = 0; }
          value += shift.value; previous = shift.startTime; cls = Math.max(cls, value);
        }
        return { lcpMs: window.__storefront.lcp.at(-1)?.startTime ?? null, lcpCandidates: window.__storefront.lcp, fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null, cls, domContentLoadedMs: navigation.domContentLoadedEventEnd, observationMs: performance.now(), transferredBytes: resources.reduce((total, item) => total + item.transferSize, navigation.transferSize), resources, longTasks: window.__storefront.longTasks, overflow: document.documentElement.scrollWidth > innerWidth, visibleCovers: [...document.querySelectorAll(".book-card img")].filter(img => { const rect = img.getBoundingClientRect(); return rect.top < innerHeight && rect.bottom > 0; }).map(img => ({ url: img.currentSrc, loaded: img.complete && img.naturalWidth > 0 })) };
      });
      assert.equal(metrics.overflow, false);
      assert.deepEqual(errors, []);
      assert.ok(metrics.lcpMs !== null && metrics.fcpMs !== null);
      if (sample === 1) await page.screenshot({ path: `${directory}/${phase}-${route === "/" ? "home" : "catalog"}-${cache}.png` });
      results.push({ route, sample, cache, ...metrics });
      console.log(`${phase} ${route} ${sample}/${samples} ${cache}: LCP=${metrics.lcpMs.toFixed(0)}ms FCP=${metrics.fcpMs.toFixed(0)}ms CLS=${metrics.cls.toFixed(3)} transfer=${Math.round(metrics.transferredBytes / 1024)}KiB`);
      page.off("pageerror", onError);
    }
    await context.close();
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = ["/", "/catalog"].flatMap(route => ["cold", "warm"].map(cache => {
    const rows = results.filter(row => row.route === route && row.cache === cache);
    return { route, cache, samples: rows.length, medianLcpMs: median(rows.map(row => row.lcpMs)), medianFcpMs: median(rows.map(row => row.fcpMs)), maximumCls: Math.max(...rows.map(row => row.cls)), medianTransferredBytes: median(rows.map(row => row.transferredBytes)) };
  }));
  await writeFile(`${directory}/${phase}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), origin, settings: { width: 320, height: 720, dpr: 2, latencyMs: 150, downloadMbps: 1.6, cpuSlowdown: 4, observationMs, samples }, limitation: "Repeated local Chromium lab samples over a fixed 10-second observation window; not field Core Web Vitals or an INP assessment. Transfer totals cover same-origin resource timing; cross-origin servers without Timing-Allow-Origin hide byte counts.", summary, results }, null, 2));
} finally { await browser.close(); }
