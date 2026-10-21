import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentResult } from "../domain/payment.js";
import { HttpError } from "./http.js";

type QuerySettings = { queryEnabled: boolean; queryUrl: string; queryTimeoutMs: number; tmnCode: string; hashSecret: string };
export type QueryAttempt = { OrderId: number; TxnRef: string; Amount: number; PaymentUrl: string };
const requestFields = ["vnp_RequestId", "vnp_Version", "vnp_Command", "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo"];
const responseFields = ["vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount"];
const sign = (fields: string[], values: Record<string, string>, secret: string) => createHmac("sha512", secret).update(fields.map(key => values[key] ?? "").join("|")).digest("hex");
export const signVnpayQueryRequest = (values: Record<string, string>, secret: string) => sign(requestFields, values, secret);

function createDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return ["year", "month", "day", "hour", "minute", "second"].map(type => parts.find(part => part.type === type)!.value).join("");
}

export async function queryVnpayAttempt(attempt: QueryAttempt, settings: QuerySettings, ipAddress: string) {
  if (!settings.queryEnabled || !settings.tmnCode || !settings.hashSecret) throw new HttpError(503, "Truy vấn VNPay chưa được cấu hình.", "PAYMENT_QUERY_UNAVAILABLE");
  let saved: URL;
  try { saved = new URL(attempt.PaymentUrl); } catch { throw new HttpError(409, "Giao dịch cũ thiếu thông tin truy vấn.", "PAYMENT_QUERY_METADATA_INVALID"); }
  const transactionDate = saved.searchParams.get("vnp_CreateDate") ?? "";
  if (!/^\d{14}$/.test(transactionDate) || saved.searchParams.get("vnp_TxnRef") !== attempt.TxnRef || saved.searchParams.get("vnp_TmnCode") !== settings.tmnCode) {
    throw new HttpError(409, "Giao dịch cũ thiếu thông tin truy vấn.", "PAYMENT_QUERY_METADATA_INVALID");
  }
  const request: Record<string, string> = { vnp_RequestId: randomUUID().replaceAll("-", ""), vnp_Version: "2.1.0", vnp_Command: "querydr",
    vnp_TmnCode: settings.tmnCode, vnp_TxnRef: attempt.TxnRef, vnp_TransactionDate: transactionDate,
    vnp_CreateDate: createDate(new Date()), vnp_IpAddr: ipAddress || "127.0.0.1", vnp_OrderInfo: `Truy van thanh toan don hang ${attempt.OrderId}` };
  request.vnp_SecureHash = signVnpayQueryRequest(request, settings.hashSecret);
  const deadline = AbortSignal.timeout(settings.queryTimeoutMs);
  let raw: unknown;
  try {
    const response = await fetch(settings.queryUrl, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(request), redirect: "error", signal: deadline });
    if (!response.ok || !response.body) throw new Error("Provider HTTP failure");
    // Bound response memory even when a remote endpoint omits Content-Length.
    const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 32768) throw new Error("Provider response too large"); chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(502, "Chưa nhận được kết quả từ VNPay. Bạn có thể truy vấn lại.", "PAYMENT_QUERY_FAILED");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length > 40) throw invalidResponse();
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string" && !(typeof value === "number" && Number.isSafeInteger(value))) throw invalidResponse();
    values[key] = String(value); if (values[key]!.length > 2048) throw invalidResponse();
  }
  const hash = values.vnp_SecureHash ?? "";
  const expected = sign(responseFields, values, settings.hashSecret);
  if (!/^[a-f0-9]{128}$/i.test(hash) || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex")) ||
      values.vnp_TmnCode !== settings.tmnCode || values.vnp_TxnRef !== attempt.TxnRef ||
      !/^[1-9]\d{0,11}$/.test(values.vnp_Amount ?? "") || Number(values.vnp_Amount) !== Math.round(Number(attempt.Amount) * 100) ||
      (values.vnp_Command !== undefined && values.vnp_Command !== "" && values.vnp_Command !== "querydr") ||
      !/^[a-zA-Z0-9]{1,32}$/.test(values.vnp_ResponseId ?? "") || !/^\d{2}$/.test(values.vnp_ResponseCode ?? "")) throw invalidResponse();
  const status = values.vnp_TransactionStatus ?? "";
  const successfulQuery = values.vnp_ResponseCode === "00";
  const finalPayment = successfulQuery && ["00", "02"].includes(status) && values.vnp_TransactionType === "01";
  if (finalPayment && !/^\d{1,15}$/.test(values.vnp_TransactionNo ?? "")) throw invalidResponse();
  const result: PaymentResult | undefined = finalPayment ? {
    orderId: attempt.OrderId, txnRef: attempt.TxnRef, amount: Number(values.vnp_Amount) / 100,
    isSuccess: status === "00", transactionNo: values.vnp_TransactionNo!, responseCode: status === "00" ? "00" : "99"
  } : undefined;
  return { outcome: result ? result.isSuccess ? "paid" : "failed" : "pending", result,
    providerCode: values.vnp_ResponseCode!, providerStatus: status };
}

function invalidResponse() {
  return new HttpError(502, "Không thể xác minh kết quả truy vấn VNPay. Trạng thái thanh toán chưa thay đổi.", "PAYMENT_QUERY_INVALID_RESPONSE");
}
