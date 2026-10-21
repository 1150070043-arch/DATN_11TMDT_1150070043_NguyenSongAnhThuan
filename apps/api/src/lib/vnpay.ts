import crypto from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "./http.js";

export function vnpaySignData(params: Record<string, string>): string {
  const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
  return Object.keys(params).filter(key => key.startsWith("vnp_") && !["vnp_SecureHash", "vnp_SecureHashType"].includes(key))
    .sort().map(key => `${encode(key)}=${encode(params[key]!)}`).join("&");
}

export function buildVnpayPaymentUrl(input: {
  orderId: number;
  amount: number;
  ipAddress: string;
  orderInfo?: string;
  returnUrl: string;
  expiresAt?: Date;
}): string {
  if (!config.vnpay.tmnCode || !config.vnpay.hashSecret) {
    throw new HttpError(503, "Thanh toán VNPay chưa được cấu hình. Vui lòng chọn thanh toán khi nhận hàng.", "PAYMENT_UNAVAILABLE");
  }
  const minorUnits = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(input.orderId) || input.orderId <= 0 || input.orderId > 2147483647 ||
      !Number.isFinite(input.amount) || input.amount <= 0 || !Number.isSafeInteger(minorUnits) || minorUnits < 1 || minorUnits > 999_999_999_999) {
    throw new HttpError(422, "Số tiền thanh toán không hợp lệ.", "PAYMENT_AMOUNT_INVALID");
  }
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
  const expiresAt = new Date(Math.min(date.getTime() + 15 * 60_000, input.expiresAt?.getTime() ?? Infinity));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= date.getTime() + 1000) {
    throw new HttpError(409, "Thời gian thanh toán của đơn đã hết. Vui lòng kiểm tra lại đơn hàng.", "STOCK_HOLD_ENDED");
  }
  const expires = formatter.formatToParts(expiresAt);
  const expireDate = ["year", "month", "day", "hour", "minute", "second"].map(type => expires.find(part => part.type === type)?.value ?? "").join("");

  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.vnpay.tmnCode,
    vnp_Amount: String(minorUnits),
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
    vnp_CurrCode: "VND",
    vnp_IpAddr: input.ipAddress || "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: (input.orderInfo || `Thanh toan don hang ${input.orderId}`).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 255),
    vnp_OrderType: "other",
    vnp_ReturnUrl: input.returnUrl,
    vnp_TxnRef: `${input.orderId}_${crypto.randomUUID().replaceAll("-", "")}`
  };

  const signData = vnpaySignData(vnpParams);
  const hmac = crypto.createHmac("sha512", config.vnpay.hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return `${config.vnpay.url}?${signData}&vnp_SecureHash=${signed}`;
}

export function verifyVnpayReturn(query: Record<string, string>): {
  isValid: boolean;
  isSuccess: boolean;
  orderId: number;
  amount: number;
  transactionNo: string;
  responseCode: string;
  txnRef: string;
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
      txnRef: "",
      message: "Chữ ký bảo mật không tồn tại."
    };
  }

  const cleanParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k !== "vnp_SecureHash" && k !== "vnp_SecureHashType" && typeof v === "string") {
      cleanParams[k] = v;
    }
  }

  const signData = vnpaySignData(cleanParams);
  const hmac = crypto.createHmac("sha512", config.vnpay.hashSecret);
  const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const validHash = /^[a-f0-9]{128}$/i.test(secureHash) && crypto.timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(secureHash, "hex"));
  const parsedId = Number((query.vnp_TxnRef ?? '').split('_')[0]);
  const validFields = /^[1-9]\d{0,11}$/.test(query.vnp_Amount ?? '') && /^[1-9]\d{0,9}_[a-f0-9]{1,64}$/.test(query.vnp_TxnRef ?? '')
    && Number.isSafeInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647
    && /^\d{2}$/.test(query.vnp_ResponseCode ?? '') && /^\d{2}$/.test(query.vnp_TransactionStatus ?? '')
    && /^\d{1,15}$/.test(query.vnp_TransactionNo ?? '');
  const isValid = Boolean(config.vnpay.hashSecret && config.vnpay.tmnCode) && validHash && validFields && query.vnp_TmnCode === config.vnpay.tmnCode;
  const responseCode = query.vnp_ResponseCode ?? "";
  const isSuccess = isValid && responseCode === "00" && query.vnp_TransactionStatus === "00";

  const txnRef = query.vnp_TxnRef ?? "";
  const orderId = isValid && Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  const amount = isValid ? Number(query.vnp_Amount) / 100 : 0;
  const transactionNo = query.vnp_TransactionNo ?? "";

  const message =
    !isValid ? "Không thể xác minh giao dịch thanh toán."
      : isSuccess
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
    txnRef,
    message
  };
}
