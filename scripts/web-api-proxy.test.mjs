import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer as createViteServer } from 'vite';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));

test('website API requests reach the matching backend and preserve JSON responses', async t => {
  for (const mode of ['baseline', 'secure']) {
    await t.test(mode, async t => {
      const backend = createHttpServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const url = new URL(req.url, 'http://backend');
        res.writeHead(Number(url.searchParams.get('status') ?? 200), {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'set-cookie': `bg_${mode}_session=proxy-test; Path=/; HttpOnly; SameSite=Lax`,
          'retry-after': '900'
        });
        res.end(JSON.stringify({ mode, path: req.url, method: req.method,
          cookie: req.headers.cookie, body: Buffer.concat(chunks).toString() }));
      });
      t.after(() => new Promise(resolve => { backend.close(resolve); backend.closeAllConnections(); }));
      backend.listen(0, '127.0.0.1');
      await once(backend, 'listening');

      const previous = { VITE_SECURITY_MODE: process.env.VITE_SECURITY_MODE, VITE_API_URL: process.env.VITE_API_URL };
      t.after(() => {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
      });
      process.env.VITE_SECURITY_MODE = mode;
      process.env.VITE_API_URL = `http://127.0.0.1:${backend.address().port}`;
      // Vite treats port 0 as its default port; reserve an available port first.
      const reservation = createHttpServer();
      reservation.listen(0, '127.0.0.1');
      await once(reservation, 'listening');
      const webPort = reservation.address().port;
      await new Promise(resolve => reservation.close(resolve));
      const web = await createViteServer({ root, server: {
        port: webPort, watch: null, hmr: false, preTransformRequests: false
      }, logLevel: 'error' });
      t.after(() => web.close());
      await web.listen();
      const origin = `http://127.0.0.1:${web.httpServer.address().port}`;

      // Backend failures must remain JSON, with their original status and headers.
      for (const status of [200, 401, 403, 404, 429]) {
        const path = `/api/admin/users?status=${status}`;
        const response = await fetch(origin + path, { headers: { cookie: `bg_${mode}_session=customer` } });
        assert.equal(response.status, status);
        assert.match(response.headers.get('content-type'), /application\/json/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('retry-after'), '900');
        assert.match(response.headers.get('set-cookie'), new RegExp(`^bg_${mode}_session=`));
        assert.deepEqual(await response.json(), {
          mode, path, method: 'GET', cookie: `bg_${mode}_session=customer`, body: ''
        });
      }

      const body = JSON.stringify({ email: 'proxy-test@bookguard.local', password: 'wrong-password' });
      const login = await fetch(`${origin}/api/auth/login?status=429`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body
      });
      assert.equal(login.status, 429);
      assert.deepEqual(await login.json(), { mode, path: '/api/auth/login?status=429', method: 'POST', body });

      const page = await fetch(`${origin}/login`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type'), /text\/html/);
    });
  }
});
