import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpSession, type SessionResponse } from "../../security/src/http-session.js";

const targets = [
  { mode: "baseline", url: process.env.BASELINE_URL ?? "http://localhost:4001" },
  { mode: "secure", url: process.env.SECURE_URL ?? "http://localhost:4002" }
] as const;

type StepResult = {
  name: string;
  status: number;
  passed: boolean;
  detail: string;
};

type ModeResult = {
  mode: "baseline" | "secure";
  passed: boolean;
  steps: StepResult[];
};

function data<T>(response: SessionResponse): T {
  return (response.body as { data: T }).data;
}

function expectStatus(response: SessionResponse, expected: number, label: string): void {
  if (response.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, received ${response.status}`);
  }
}

async function runMode(target: (typeof targets)[number]): Promise<ModeResult> {
  const session = new HttpSession(target.url);
  const steps: StepResult[] = [];
  const step = async (name: string, expectedStatus: number, action: () => Promise<SessionResponse>) => {
    const response = await action();
    expectStatus(response, expectedStatus, name);
    steps.push({ name, status: response.status, passed: true, detail: "Đạt" });
    return response;
  };

  try {
    const health = await step("Kết nối API", 200, () => session.request("/api/health"));
    if (data<{ mode: string }>(health).mode !== target.mode) {
      throw new Error(`API ${target.url} không chạy đúng mode ${target.mode}`);
    }

    await session.login();
    steps.push({ name: "Đăng nhập khách hàng", status: 200, passed: true, detail: "Cookie phiên đã được cấp" });

    const catalog = await step("Đọc danh mục", 200, () => session.request("/api/books?limit=12"));
    if (!Array.isArray(data<unknown>(catalog))) throw new Error("Danh mục không trả về một mảng sách");

    const existingCart = await step("Đọc giỏ hàng", 200, () => session.request("/api/cart"));
    const existingItems = data<{ items: Array<{ id: number }> }>(existingCart).items;
    for (const item of existingItems) {
      await step("Dọn giỏ trước kiểm thử", 204, () => session.request(`/api/cart/items/${item.id}`, { method: "DELETE" }));
    }

    await step("Thêm sách vào giỏ", 201, () => session.request("/api/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId: 1, quantity: 1 })
    }));
    const cart = await step("Đọc lại giỏ", 200, () => session.request("/api/cart"));
    const cartItem = data<{ items: Array<{ id: number; quantity: number }> }>(cart).items[0];
    if (!cartItem) throw new Error("Sách vừa thêm không xuất hiện trong giỏ");

    await step("Đổi số lượng", 200, () => session.request(`/api/cart/items/${cartItem.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: 2 })
    }));

    const idempotencyKey = crypto.randomUUID();
    const checkoutBody = JSON.stringify({
      customerName: "Nguyễn Minh An",
      phone: "0987000001",
      shippingAddress: "236 Lê Văn Sỹ, TP. Hồ Chí Minh",
      note: "Đơn kiểm thử chức năng tự động"
    });
    const created = await step("Tạo đơn trong transaction", 201, () => session.request("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: checkoutBody
    }));
    const createdOrder = data<{ id: number }>(created);

    const replay = await step("Gửi lại không tạo đơn trùng", 200, () => session.request("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: checkoutBody
    }));
    if (data<{ id: number }>(replay).id !== createdOrder.id) {
      throw new Error("Idempotency key trả về một mã đơn khác");
    }

    const detail = await step("Đọc chi tiết và lịch sử", 200, () => session.request(`/api/orders/${createdOrder.id}`));
    const orderDetail = data<{
      status: string;
      items: Array<{ quantity: number }>;
      statusHistory: Array<{ toStatus: string }>;
    }>(detail);
    if (orderDetail.status !== "pending" || orderDetail.items[0]?.quantity !== 2) {
      throw new Error("Chi tiết đơn không khớp giỏ đã xác nhận");
    }
    if (!orderDetail.statusHistory.some((event) => event.toStatus === "pending")) {
      throw new Error("Đơn mới chưa có lịch sử trạng thái pending");
    }

    await step("Hủy đơn và hoàn kho", 200, () => session.request(`/api/orders/${createdOrder.id}/cancel`, { method: "PATCH" }));
    const cancelled = await step("Kiểm tra trạng thái sau hủy", 200, () => session.request(`/api/orders/${createdOrder.id}`));
    const cancelledDetail = data<{ status: string; statusHistory: Array<{ toStatus: string }> }>(cancelled);
    if (cancelledDetail.status !== "cancelled" || !cancelledDetail.statusHistory.some((event) => event.toStatus === "cancelled")) {
      throw new Error("Trạng thái hoặc lịch sử hủy đơn chưa đúng");
    }

    return { mode: target.mode, passed: true, steps };
  } catch (error) {
    steps.push({
      name: "Dừng tại lỗi",
      status: 0,
      passed: false,
      detail: error instanceof Error ? error.message : String(error)
    });
    return { mode: target.mode, passed: false, steps };
  }
}

async function main(): Promise<void> {
  const results = await Promise.all(targets.map(runMode));
  const report = {
    generatedAt: new Date().toISOString(),
    passed: results.every((result) => result.passed),
    results
  };
  const outputDir = path.resolve(process.cwd(), "../../reports/generated");
  await mkdir(outputDir, { recursive: true });
  const timestamp = report.generatedAt.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const jsonReport = JSON.stringify(report, null, 2);
  await writeFile(path.join(outputDir, "functional-results.json"), jsonReport);
  await writeFile(path.join(outputDir, `functional-results-${timestamp}.json`), jsonReport);

  for (const result of results) {
    console.log(`${result.mode}: ${result.passed ? "ĐẠT" : "CHƯA ĐẠT"}`);
    for (const item of result.steps) console.log(`  ${item.passed ? "✓" : "✗"} ${item.name}: ${item.detail}`);
  }
  if (!report.passed) process.exitCode = 1;
}

await main();
