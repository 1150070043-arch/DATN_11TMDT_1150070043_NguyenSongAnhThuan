import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const baseUrl = __ENV.BASE_URL || "http://api-secure:4002";
const mode = __ENV.TEST_MODE || "secure";
const outputFile = __ENV.OUTPUT_FILE || `/reports/k6-${mode}.json`;
const loginTime = new Trend("login_duration", true);
const checkoutTime = new Trend("checkout_duration", true);
const limited = new Counter("rate_limited_requests");
const duration = __ENV.DURATION || "75s";
export const options = {
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
  scenarios: {
    browse: { executor: "constant-vus", vus: 1, duration, exec: "browse", gracefulStop: "15s" },
    account: { executor: "constant-vus", vus: 1, duration, exec: "account", gracefulStop: "15s" },
    checkout: { executor: "constant-vus", vus: 1, duration, exec: "checkoutFlow", gracefulStop: "15s" }
  },
  thresholds: { http_req_failed: ["rate<0.01"], checks: ["rate==1"], http_req_duration: ["p(95)<500"] }
};
if (__ENV.WARMUP === "true") options.scenarios = { browse: { executor: "constant-vus", vus: 1, duration, exec: "browse", gracefulStop: "5s" } };
function observe(response, expected, label) {
  check(response, { [label]: r => r.status === expected });
  if (response.status === 429) limited.add(1);
  return response.status === expected;
}
function authenticate(email = "customer.b@bookguard.local") {
  const response = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({ email, password: "Customer@123" }), { headers: { "content-type": "application/json" }, tags: { operation: "login" } });
  loginTime.add(response.timings.duration);
  if (!observe(response, 200, "login 200")) return null;
  return { "content-type": "application/json", ...(response.json("data.csrfToken") ? { "x-csrf-token": response.json("data.csrfToken") } : {}) };
}
export function browse() {
  observe(http.get(`${baseUrl}/api/books?limit=12&sort=newest`, { tags: { operation: "catalog" } }), 200, "catalog 200");
  observe(http.get(`${baseUrl}/api/books/clean-code`, { tags: { operation: "detail" } }), 200, "detail 200");
  sleep(2);
}
export function account() {
  const headers = authenticate();
  if (headers) {
    observe(http.get(`${baseUrl}/api/auth/me`, { tags: { operation: "session" } }), 200, "session 200");
    observe(http.post(`${baseUrl}/api/auth/logout`, null, { headers, tags: { operation: "logout" } }), 204, "logout 204");
  }
  sleep(10);
}
function uuid() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === "x" ? n : (n & 3) | 8).toString(16); }); }
export function checkoutFlow() {
  const headers = authenticate("customer.a@bookguard.local");
  if (!headers) { sleep(20); return; }
  const cart = http.get(`${baseUrl}/api/cart`, { tags: { operation: "cart" } });
  if (observe(cart, 200, "cart 200")) {
    for (const item of cart.json("data.items") || []) observe(http.del(`${baseUrl}/api/cart/items/${item.id}`, null, { headers }), 204, "cart cleanup 204");
    const added = http.post(`${baseUrl}/api/cart/items`, JSON.stringify({ bookId: 1, quantity: 1 }), { headers, tags: { operation: "cart_add" } });
    if (observe(added, 201, "cart add 201")) {
      const response = http.post(`${baseUrl}/api/orders`, JSON.stringify({ customerName: "Performance fixture", phone: "0987000001", shippingAddress: "236 Le Van Sy, Ho Chi Minh", paymentMethod: "cod" }), { headers: { ...headers, "idempotency-key": uuid() }, tags: { operation: "checkout" } });
      checkoutTime.add(response.timings.duration);
      if (observe(response, 201, "checkout 201")) observe(http.patch(`${baseUrl}/api/orders/${response.json("data.id")}/cancel`, null, { headers, tags: { operation: "cancel" } }), 200, "cancel 200");
    }
  }
  observe(http.post(`${baseUrl}/api/auth/logout`, null, { headers }), 204, "checkout logout 204");
  sleep(20);
}
export function handleSummary(data) {
  const metrics = {};
  for (const [name, metric] of Object.entries(data.metrics)) if (metric?.values) metrics[name] = metric.values;
  const result = { mode, baseUrl, generatedAt: new Date().toISOString(), workload: "3 VUs: catalog/detail, login/session/logout, COD checkout/cancel; shared client IP; security controls enabled", thresholds: options.thresholds, thresholdsPassed: Object.values(data.metrics).every(metric => !metric.thresholds || Object.values(metric.thresholds).every(value => value.ok)), metrics };
  return { [outputFile]: JSON.stringify(result, null, 2), stdout: `${mode}: p95=${metrics.http_req_duration?.["p(95)"]}ms; error=${metrics.http_req_failed?.rate}; checks=${metrics.checks?.rate}\n` };
}
