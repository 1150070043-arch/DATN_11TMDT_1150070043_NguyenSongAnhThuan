import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createAlertDispatcher } from "./alerting.js";
const event = { level: "critical" as const, type: "FIXTURE", message: "Local operational drill" };
const settings = { throttleSeconds: 300, maxAttempts: 2, retryDelayMs: 0, timeoutMs: 1000 };
test("disabled alerts do not claim delivery", async () => {
  assert.equal((await createAlertDispatcher(settings)(event)).status, "disabled");
});
test("HTTP 503 fails, retries and does not throttle the next attempt; success starts cooldown", async () => {
  let requests = 0, healthy = false;
  const server = createServer((_req, res) => { requests++; res.writeHead(healthy ? 204 : 503); res.end(healthy ? undefined : "provider-private-response"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const logs: unknown[] = [];
  const dispatch = createAlertDispatcher({ ...settings, webhookUrl: `http://127.0.0.1:${address.port}/fixture` }, { log: (name, data) => logs.push({ name, data }) });
  try {
    assert.equal((await dispatch(event)).status, "failed"); assert.equal(requests, 2);
    healthy = true; assert.equal((await dispatch(event)).status, "delivered"); assert.equal(requests, 3);
    assert.equal((await dispatch(event)).status, "throttled"); assert.equal(requests, 3);
    assert.equal(JSON.stringify(logs).includes("provider-private-response"), false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("partial delivery retries only the failed channel and checks Telegram JSON acknowledgement", async () => {
  let telegram = 0, webhook = 0;
  const mockFetch: typeof fetch = async input => {
    if (String(input).includes("api.telegram.org")) { telegram++; return Response.json({ ok: true }); }
    webhook++; return new Response(webhook <= 2 ? "private" : null, { status: webhook <= 2 ? 503 : 204 });
  };
  const dispatch = createAlertDispatcher({ ...settings, telegramBotToken: "synthetic", telegramChatId: "fixture", webhookUrl: "https://example.test/fixture" }, { fetch: mockFetch, log: () => {} });
  assert.equal((await dispatch(event)).status, "partial");
  const result = await dispatch(event); assert.equal(result.status, "delivered"); assert.equal(telegram, 1); assert.equal(webhook, 3);
  assert.deepEqual(result.suppressed, ["telegram"]);
  const negative = createAlertDispatcher({ ...settings, telegramBotToken: "synthetic", telegramChatId: "fixture" }, { fetch: async () => Response.json({ ok: false }), log: () => {} });
  assert.equal((await negative(event)).status, "failed");
});
test("concurrent events share an in-flight guard and network errors do not expose provider secrets", async () => {
  let unblock!: () => void, calls = 0;
  const logs: unknown[] = [];
  const dispatch = createAlertDispatcher({ ...settings, maxAttempts: 1, webhookUrl: "https://example.test/secret" }, {
    fetch: async () => { calls++; await new Promise<void>(resolve => { unblock = resolve; }); throw new Error("secret-token-in-provider-url"); },
    log: (name, data) => logs.push({ name, data }) });
  const first = dispatch(event); assert.equal((await dispatch(event)).status, "throttled"); unblock();
  assert.equal((await first).status, "failed"); assert.equal(calls, 1); assert.equal(JSON.stringify(logs).includes("secret-token"), false);
});
