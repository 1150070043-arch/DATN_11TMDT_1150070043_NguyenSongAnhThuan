// Local demonstration owned by Anh Thuan. No credentials or response bodies are logged.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['tests/security-demo/offers.html', 'text/html; charset=utf-8']],
  ['/offers.js', ['tests/security-demo/offers.js', 'text/javascript; charset=utf-8']],
  ['/demo.css', ['apps/web/public/lab/demo.css', 'text/css; charset=utf-8']]
]);

async function environment(mode) {
  try {
    const response = await fetch(`http://localhost:${mode === 'baseline' ? 4001 : 4002}/api/health`, {
      signal: AbortSignal.timeout(4000), redirect: 'error'
    });
    const body = await response.json();
    return { mode, ready: response.ok && body.data?.mode === mode &&
      body.data?.auditFixture === true && body.data?.database === 'connected' };
  } catch { return { mode, ready: false }; }
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://localhost:4001 http://localhost:4002; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (req.headers.host !== 'localhost:5500' || req.method !== 'GET') {
    res.writeHead(403).end('Open http://localhost:5500'); return;
  }
  try {
    if (req.url === '/environment') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(await Promise.all(['baseline', 'secure'].map(environment)))); return;
    }
    const file = files.get(req.url);
    if (!file) { res.writeHead(404).end('Not found'); return; }
    const content = await readFile(new URL(`../${file[0]}`, import.meta.url));
    res.setHeader('Content-Type', file[1]); res.end(content);
  } catch { res.writeHead(500).end('Cannot load demo.'); }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 5500 is busy. Stop the previous demo server before retrying.' : 'Cannot start local demo server.');
  process.exitCode = 1;
});
server.listen(5500, '127.0.0.1', () => console.log('BookGuard TC08 — http://localhost:5500 (Ctrl+C to stop)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(); server.closeAllConnections();
});
