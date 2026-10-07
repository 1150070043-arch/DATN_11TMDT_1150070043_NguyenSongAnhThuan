import crypto from "node:crypto";
import { config } from "../config.js";

export function buildVnpayPaymentUrl(input: {
  orderId: number;
  amount: number;
  ipAddress: string;
  orderInfo?: string;
  returnUrl: string;
}): string {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const createDate = `${getPart("year")}${getPart("month")}${getPart("day")}${getPart("hour")}${getPart("minute")}${getPart("second")}`;

  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.vnpay.tmnCode,
    vnp_Amount: String(Math.round(input.amount * 100)),
    vnp_CreateDate: createDate,
    vnp_CurrCode: "VND",
    vnp_IpAddr: input.ipAddress || "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: input.orderInfo || `Thanh toan don hang #${input.orderId}`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: input.returnUrl,
    vnp_TxnRef: `${input.orderId}_${Date.now()}`
  };

  const sortedKeys = Object.keys(vnpParams).sort();
  const signDataParts: string[] = [];
  const queryParts: string[] = [];

  for (const key of sortedKeys) {
    const val = vnpParams[key];
    if (val !== undefined && val !== null && val.length > 0) {
      signDataParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  }

  const signData = signDataParts.join("&");
  const hmac = crypto.createHmac("sha512", config.vnpay.hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  queryParts.push(`vnp_SecureHash=${signed}`);
  return `${config.vnpay.url}?${queryParts.join("&")}`;
}

export function verifyVnpayReturn(query: Record<string, string>): {
  isValid: boolean;
  isSuccess: boolean;
  orderId: number;
  amount: number;
  transactionNo: string;
  responseCode: string;
  message: string;
} {
  const secureHash = query.vnp_SecureHash;
  if (!secureHash) {
    return {
      isValid: false,
      isSuccess: false,
      orderId: 0,
      amount: 0,
      transactionNo: "",
      responseCode: "99",
      message: "Chữ ký bảo mật không tồn tại."
    };
  }

  const cleanParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k !== "vnp_SecureHash" && k !== "vnp_SecureHashType" && typeof v === "string") {
      cleanParams[k] = v;
    }
  }

  const sortedKeys = Object.keys(cleanParams).sort();
  const signDataParts: string[] = [];
  for (const key of sortedKeys) {
    signDataParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(cleanParams[key]!)}`);
  }
  const signData = signDataParts.join("&");
  const hmac = crypto.createHmac("sha512", config.vnpay.hashSecret);
  const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const isValid = calculatedHash.toLowerCase() === secureHash.toLowerCase();
  const responseCode = query.vnp_ResponseCode ?? "";
  const isSuccess = isValid && responseCode === "00";

  const txnRef = query.vnp_TxnRef ?? "";
  const orderId = parseInt(txnRef.split("_")[0] ?? "0", 10);
  const amount = parseInt(query.vnp_Amount ?? "0", 10) / 100;
  const transactionNo = query.vnp_TransactionNo ?? "";

  const message =
    responseCode === "00"
      ? "Giao dịch thành công."
      : responseCode === "24"
        ? "Khách hàng hủy giao dịch."
        : `Giao dịch không thành công (Mã lỗi ${responseCode}).`;

  return {
    isValid,
    isSuccess,
    orderId,
    amount,
    transactionNo,
    responseCode,
    message
  };
}

