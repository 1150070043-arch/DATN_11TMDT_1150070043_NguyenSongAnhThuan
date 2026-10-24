import crypto from "node:crypto";
import net, { type Socket } from "node:net";
import tls, { type TLSSocket } from "node:tls";
import { config } from "../config.js";

export type MailContent = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
};

type LineWaiter = {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
};

function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function messageSource(content: MailContent, smtp: SmtpSettings): string {
  const boundary = `bookguard-${crypto.randomBytes(12).toString("hex")}`;
  const messageId = `<${crypto.randomUUID()}@bookguard.local>`;
  return [
    `From: ${encodeHeader(smtp.fromName)} <${smtp.fromAddress}>`,
    `To: <${content.to}>`,
    ...(content.replyTo ? [`Reply-To: <${content.replyTo}>`] : []),
    `Subject: ${encodeHeader(content.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.html),
    `--${boundary}--`,
    ""
  ].join("\r\n");
}

function lineReader(socket: Socket | TLSSocket) {
  let buffer = "";
  const lines: string[] = [];
  const waiters: LineWaiter[] = [];
  let terminalError: Error | undefined;

  function deliver(line: string) {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(line);
    else lines.push(line);
  }

  function fail(error: Error) {
    terminalError = error;
    for (const waiter of waiters.splice(0)) waiter.reject(error);
  }

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const newline = buffer.indexOf("\n");
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      deliver(line);
    }
  });
  socket.on("error", (error) => fail(error));
  socket.on("end", () => fail(new Error("SMTP connection ended unexpectedly.")));

  return async function readLine(): Promise<string> {
    const line = lines.shift();
    if (line !== undefined) return line;
    if (terminalError) throw terminalError;
    return new Promise<string>((resolve, reject) => waiters.push({ resolve, reject }));
  };
}

async function expectResponse(readLine: () => Promise<string>, expected: number): Promise<string[]> {
  const responseLines: string[] = [];
  while (true) {
    const line = await readLine();
    responseLines.push(line);
    const match = /^(\d{3})([ -])/.exec(line);
    if (!match || match[2] !== " ") continue;
    const code = Number(match[1]);
    if (code !== expected) {
      throw new Error(`SMTP expected ${expected} but received ${code}.`);
    }
    return responseLines;
  }
}

function connect(smtp: SmtpSettings): Promise<Socket | TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = smtp.secure
      ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host })
      : net.createConnection({ host: smtp.host, port: smtp.port });
    const event = smtp.secure ? "secureConnect" : "connect";
    socket.once(event, () => resolve(socket));
    socket.once("error", reject);
    socket.setTimeout(10_000, () => socket.destroy(new Error("SMTP connection timed out.")));
  });
}

async function command(
  socket: Socket | TLSSocket,
  readLine: () => Promise<string>,
  value: string,
  expected: number
): Promise<void> {
  socket.write(`${value}\r\n`);
  await expectResponse(readLine, expected);
}

export async function sendMail(content: MailContent, smtp: SmtpSettings = config.smtp): Promise<void> {
  if (content.replyTo && /[\r\n<>]/.test(content.replyTo)) throw new Error("Invalid reply-to address");
  const socket = await connect(smtp);
  const readLine = lineReader(socket);
  try {
    await expectResponse(readLine, 220);
    await command(socket, readLine, "EHLO bookguard.local", 250);
    if (smtp.user) {
      await command(socket, readLine, "AUTH LOGIN", 334);
      await command(socket, readLine, Buffer.from(smtp.user).toString("base64"), 334);
      await command(socket, readLine, Buffer.from(smtp.password).toString("base64"), 235);
    }
    await command(socket, readLine, `MAIL FROM:<${smtp.fromAddress}>`, 250);
    await command(socket, readLine, `RCPT TO:<${content.to}>`, 250);
    await command(socket, readLine, "DATA", 354);
    socket.write(`${messageSource(content, smtp)}\r\n.\r\n`);
    await expectResponse(readLine, 250);
    await command(socket, readLine, "QUIT", 221);
  } finally {
    socket.destroy();
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const orderStatusContent = {
  pending: {
    label: "Đã tiếp nhận",
    heading: "Đơn hàng đã được tiếp nhận",
    message: "Thất Tịnh đã nhận đơn và đang kiểm tra thông tin trước khi xác nhận."
  },
  confirmed: {
    label: "Đã xác nhận",
    heading: "Đơn hàng đã được xác nhận",
    message: "Đơn hàng đã được xác nhận và đang được chuẩn bị để bàn giao."
  },
  shipping: {
    label: "Đang giao",
    heading: "Sách đang trên đường đến bạn",
    message: "Đơn hàng đã được bàn giao cho bộ phận vận chuyển."
  },
  completed: {
    label: "Hoàn tất",
    heading: "Đơn hàng đã hoàn tất",
    message: "Cảm ơn bạn đã chọn sách tại Thất Tịnh. Chúc bạn có một trải nghiệm đọc thật vui."
  },
  cancelled: {
    label: "Đã hủy",
    heading: "Đơn hàng đã được hủy",
    message: "Đơn hàng đã được hủy và số lượng sách liên quan đã được hoàn lại kho."
  }
} as const;

export type MailOrderStatus = keyof typeof orderStatusContent;

export function orderStatusMailContent(input: {
  to: string;
  customerName: string;
  orderId: number;
  status: MailOrderStatus;
  totalAmount: number;
}): MailContent {
  const copy = orderStatusContent[input.status];
  const safeName = escapeHtml(input.customerName);
  const total = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(input.totalAmount);
  return {
    to: input.to,
    subject: `${copy.label} · Đơn hàng #${input.orderId} · Thất Tịnh`,
    text: [
      `Xin chào ${input.customerName},`,
      "",
      `${copy.heading} (#${input.orderId}).`,
      copy.message,
      `Tổng giá trị: ${total}`,
      "",
      "Email này được gửi tự động khi trạng thái đơn hàng thay đổi."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:32px;color:#10251f">
        <div style="font-size:12px;letter-spacing:2px;color:#c45118;font-weight:700">THẤT TỊNH BOOKSTORE</div>
        <p style="margin:24px 0 8px;color:#68766f">Xin chào ${safeName},</p>
        <h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.1;margin:0 0 16px">${copy.heading}</h1>
        <p>${copy.message}</p>
        <div style="margin:24px 0;padding:18px;background:#f4f0e8;border-left:4px solid #c45118">
          <div style="font-size:13px;color:#68766f">MÃ ĐƠN HÀNG</div>
          <strong style="display:block;font-size:24px;margin:4px 0 12px">#${input.orderId}</strong>
          <div style="font-size:13px;color:#68766f">TỔNG GIÁ TRỊ</div>
          <strong style="display:block;font-size:20px;margin-top:4px">${total}</strong>
        </div>
        <p style="font-size:13px;color:#68766f">Email này được gửi tự động khi trạng thái đơn hàng thay đổi.</p>
      </div>
    `
  };
}

export async function sendOrderStatusEmail(input: Parameters<typeof orderStatusMailContent>[0]): Promise<void> {
  await sendMail(orderStatusMailContent(input));
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, ttlMinutes: number): Promise<void> {
  const safeUrl = escapeHtml(resetUrl);
  await sendMail({
    to,
    subject: "Đặt lại mật khẩu Thất Tịnh",
    text: [
      "Bạn vừa yêu cầu đặt lại mật khẩu tài khoản Thất Tịnh.",
      "",
      `Mở liên kết này trong ${ttlMinutes} phút:`,
      resetUrl,
      "",
      "Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10251f">
        <div style="font-size:12px;letter-spacing:2px;color:#c45118;font-weight:700">THẤT TỊNH BOOKSTORE</div>
        <h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.1">Đặt lại mật khẩu</h1>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu tài khoản Thất Tịnh.</p>
        <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 20px;background:#10251f;color:white;text-decoration:none;border-radius:4px">Tạo mật khẩu mới</a></p>
        <p style="font-size:13px;color:#68766f">Liên kết có hiệu lực trong ${ttlMinutes} phút và chỉ dùng được một lần.</p>
        <p style="font-size:13px;color:#68766f">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      </div>
    `
  });
}

export async function sendEmailVerificationEmail(
  to: string,
  verificationUrl: string,
  ttlHours: number
): Promise<void> {
  const safeUrl = escapeHtml(verificationUrl);
  await sendMail({
    to,
    subject: "Xác minh email Thất Tịnh",
    text: [
      "Chào mừng bạn đến với Thất Tịnh.",
      "",
      `Mở liên kết này trong ${ttlHours} giờ để xác minh email:`,
      verificationUrl,
      "",
      "Nếu bạn không tạo tài khoản này, hãy bỏ qua email."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10251f">
        <div style="font-size:12px;letter-spacing:2px;color:#c45118;font-weight:700">THẤT TỊNH BOOKSTORE</div>
        <h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.1">Xác minh email</h1>
        <p>Chào mừng bạn đến với Thất Tịnh. Xác minh email để bảo vệ tài khoản và bắt đầu mua sách.</p>
        <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 20px;background:#10251f;color:white;text-decoration:none;border-radius:4px">Xác minh email</a></p>
        <p style="font-size:13px;color:#68766f">Liên kết có hiệu lực trong ${ttlHours} giờ và chỉ dùng được một lần.</p>
        <p style="font-size:13px;color:#68766f">Nếu bạn không tạo tài khoản này, hãy bỏ qua email.</p>
      </div>
    `
  });
}
