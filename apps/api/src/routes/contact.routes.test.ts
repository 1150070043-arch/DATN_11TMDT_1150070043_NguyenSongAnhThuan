import assert from 'node:assert/strict';
import test from 'node:test';
import express, { type ErrorRequestHandler } from 'express';
import type { AddressInfo } from 'node:net';
import { ZodError } from 'zod';
import { createContactRouter } from './contact.routes.js';
import { HttpError } from '../lib/http.js';
import type { MailContent } from '../lib/mailer.js';
import { config } from '../config.js';
import { validCsrfToken } from '../security/csrf.js';

const body = { name: 'Độc giả <script>', email: 'reader@example.test', topic: 'books', message: 'Tôi muốn tìm sách <img src=x onerror=alert(1)> về công nghệ.' };
async function fixture(options: { unavailable?: boolean; fail?: boolean } = {}) {
  const delivered: MailContent[] = [];
  const app = express();
  app.use(express.json());
  app.use('/api/contact', createContactRouter({
    recipient: async () => options.unavailable ? undefined : 'admin@example.test',
    deliver: async content => { if (options.fail) throw new Error('Fixture SMTP failure'); delivered.push(content); }
  }));
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 422 : 500;
    res.status(status).json({ error: { code: error instanceof HttpError ? error.code : 'VALIDATION_ERROR' } });
  };
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/contact`;
  return { delivered, csrf: () => fetch(url + '/csrf'), send: (data: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }),
    close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) };
}

test('contact sends only to the configured administrator, escapes HTML and returns a reference after delivery', async t => {
  const f = await fixture(); t.after(f.close);
  const response = await f.send(body);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as { data: { reference: string } };
  assert.match(result.data.reference, /^TA-[A-F0-9]{12}$/);
  assert.equal(f.delivered.length, 1);
  const mail = f.delivered[0];
  assert.ok(mail);
  assert.equal(mail.to, 'admin@example.test'); assert.equal(mail.replyTo, body.email);
  assert.ok(mail.subject.includes(result.data.reference));
  assert.ok(mail.text.includes(body.message));
  assert.doesNotMatch(mail.html, /<script>|<img/);
  assert.match(mail.html, /&lt;img/);
});

test('contact rejects invalid email, topic, extra recipients and oversized messages before sending', async t => {
  for (const data of [{ ...body, email: 'reader@example.test\r\nBcc:other@example.test' }, { ...body, topic: 'unknown' }, { ...body, to: 'other@example.test' }, { ...body, message: 'x'.repeat(3001) }]) {
    const f = await fixture(); t.after(f.close);
    assert.equal((await f.send(data)).status, 422);
    assert.equal(f.delivered.length, 0);
  }
});

test('contact never claims success when no administrator exists or SMTP fails', async t => {
  for (const options of [{ unavailable: true }, { fail: true }]) {
    const f = await fixture(options); t.after(f.close);
    const response = await f.send(body);
    assert.equal(response.status, 503);
    assert.equal(f.delivered.length, 0);
  }
});

test('contact rate limiting bounds email submissions per client', async t => {
  const f = await fixture(); t.after(f.close);
  for (let index = 0; index < 3; index++) assert.equal((await f.send(body)).status, 201);
  assert.equal((await f.send(body)).status, 429);
  assert.equal(f.delivered.length, 3);
});

test('contact issues an anonymous CSRF token without issuing an authenticated session', async t => {
  const f = await fixture(); t.after(f.close);
  const response = await f.csrf();
  assert.equal(response.status, 200);
  const data = await response.json() as { data: { csrfToken: string | null } };
  if (config.isSecure) {
    assert.ok(validCsrfToken(data.data.csrfToken));
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 1);
    assert.ok(cookies[0]?.startsWith(config.identity.csrfCookie + '='));
    assert.equal(cookies.some(cookie => cookie.startsWith(config.identity.sessionCookie + '=')), false);
  } else assert.equal(data.data.csrfToken, null);
  assert.equal(f.delivered.length, 0);
});
