import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const results = [];
for (const port of [5173, 5174]) {
  const origin = `http://localhost:${port}`;
  const html = await fetch(origin);
  assert.equal(html.status, 200);
  assert.match(html.headers.get("cache-control"), /no-store/);
  const source = await html.text();
  const assets = [...source.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith(".css")) && assets.some(path => path.endsWith(".js")));
  for (const path of assets) {
    const response = await fetch(origin + path, { headers: { "accept-encoding": "gzip" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("content-encoding"), "gzip");
    assert.match(response.headers.get("vary"), /Accept-Encoding/i);
    if (port === 5174) assert.ok(response.headers.get("content-security-policy"));
  }
  const image = await fetch(`${origin}/design/covers/1118026470-L.jpg`);
  assert.equal(image.headers.get("cache-control"), "public, max-age=3600, must-revalidate");
  const etag = image.headers.get("etag");
  assert.ok(etag);
  const conditional = await fetch(`${origin}/design/covers/1118026470-L.jpg`, { headers: { "if-none-match": etag } });
  assert.equal(conditional.status, 304);
  const missing = await fetch(`${origin}/assets/missing-deadbeef.js`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), null);
  if (port === 5174) {
    assert.ok(missing.headers.get("content-security-policy"));
    const books = await fetch("http://localhost:4002/api/books?limit=1");
    assert.equal(books.status, 200);
    assert.match(books.headers.get("cache-control"), /no-store/);
  }
  results.push({ origin, passed: true, freshHtml: true, hashedAssetsCacheSeconds: 31536000, gzip: true, vary: true, unversionedAssetRevalidationSeconds: 3600, etagResponse: 304, missingAssetCached: false, ...(port === 5174 ? { cspPreserved: true, liveBooksApiNoStore: true } : {}) });
  console.log(`${port}: HTML/cache/gzip/ETag/404${port === 5174 ? "/CSP/live stock API" : ""} passed`);
}
const directory = process.argv.includes('--cart-recovery') ? 'reports/cart-recovery' : process.argv.includes('--mobile') ? 'reports/mobile-ux' : 'reports/storefront-performance';
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/delivery.json`, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
