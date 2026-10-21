import { config } from "../apps/api/dist/config.js";
import { sendMail } from "../apps/api/dist/lib/mailer.js";

// Run with: node --env-file=.env scripts/test-smtp.mjs [optional-recipient@example.com]
const targetRecipient = process.argv[2] || config.smtp.fromAddress || "admin@example.com";

console.log("=== KIỂM TRA KẾT NỐI SMTP THỰC TẾ (BOOKGUARD) ===");
console.log(`- SMTP Host       : ${config.smtp.host}`);
console.log(`- SMTP Port       : ${config.smtp.port}`);
console.log(`- TLS Direct      : ${config.smtp.secure ? "Có (SMTPS - Cổng 465)" : "Không (Plain socket; không hỗ trợ STARTTLS)"}`);
console.log(`- Tài khoản gửi   : ${config.smtp.user ? config.smtp.user : "(Không dùng tài khoản - Anonymous)"}`);
console.log(`- Email người gửi : ${config.smtp.fromName} <${config.smtp.fromAddress}>`);
console.log(`- Email nhận thử  : ${targetRecipient}`);
console.log("--------------------------------------------------");
console.log("Đang thiết lập kết nối và gửi thư kiểm tra...");

const startTime = Date.now();

try {
  await sendMail({
    to: targetRecipient,
    subject: `[BookGuard Test] Kiểm tra kết nối SMTP lúc ${new Date().toLocaleTimeString("vi-VN")}`,
    text: [
      "Xin chào Quản trị viên,",
      "",
      "Email này được gửi từ công cụ kiểm định SMTP của hệ thống BookGuard (Thư An Bookstore).",
      "",
      `Thời gian gửi : ${new Date().toISOString()}`,
      `SMTP Host     : ${config.smtp.host}:${config.smtp.port}`,
      `Người gửi     : ${config.smtp.fromName} <${config.smtp.fromAddress}>`,
      `Môi trường    : ${config.mode} (${config.nodeEnv})`,
      "",
      "Nếu bạn nhận được email này, cấu hình SMTP thực tế của bạn đã hoạt động chính xác!"
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:20px auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
        <h2 style="color:#0f5132;margin-top:0">✓ Kết nối SMTP thành công!</h2>
        <p>Email này xác nhận hệ thống <strong>BookGuard (Thư An Bookstore)</strong> đã kết nối và gửi thư thành công qua máy chủ SMTP thực tế.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr style="background:#f8f9fa">
            <td style="padding:8px;border:1px solid #dee2e6"><strong>SMTP Host:</strong></td>
            <td style="padding:8px;border:1px solid #dee2e6">${config.smtp.host}:${config.smtp.port}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #dee2e6"><strong>Chế độ TLS:</strong></td>
            <td style="padding:8px;border:1px solid #dee2e6">${config.smtp.secure ? "Bật (Direct TLS 465)" : "Tắt"}</td>
          </tr>
          <tr style="background:#f8f9fa">
            <td style="padding:8px;border:1px solid #dee2e6"><strong>Tài khoản:</strong></td>
            <td style="padding:8px;border:1px solid #dee2e6">${config.smtp.user || "Anonymous"}</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #dee2e6"><strong>Thời gian:</strong></td>
            <td style="padding:8px;border:1px solid #dee2e6">${new Date().toISOString()}</td>
          </tr>
        </table>
        <p style="color:#6c757d;font-size:12px;margin-bottom:0">BookGuard Operations Toolkit · Đồ án tốt nghiệp</p>
      </div>
    `
  }, config.smtp);

  const duration = Date.now() - startTime;
  console.log(`\n✓ THÀNH CÔNG: Đã gửi email kiểm tra thành công trong ${duration}ms!`);
  console.log(`Hãy kiểm tra hộp thư đến (hoặc hòm thư rác/Spam) của: ${targetRecipient}`);
} catch (error) {
  const duration = Date.now() - startTime;
  console.error(`\n✗ THẤT BẠI sau ${duration}ms:`);
  console.error("SMTP_TEST_FAILED: kiểm tra kết nối, transport và thông tin xác thực tại nhà cung cấp.");
  console.log("\n--- HƯỚNG DẪN KHẮC PHỤC LỖI SMTP PHỔ BIẾN ---");
  console.log("1. Với Gmail: Cần bật 2FA trên tài khoản Google và tạo 'Mật khẩu ứng dụng' (App Password, 16 chữ cái). Không dùng mật khẩu đăng nhập tài khoản chính.");
  console.log("2. Cổng và mã hóa: Dùng TLS trực tiếp với SMTP_SECURE=true (thường cổng 465). Client chưa hỗ trợ STARTTLS/587; plain socket chỉ dùng trong lab nội bộ.");
  console.log("3. Địa chỉ người gửi: Đảm bảo MAIL_FROM_ADDRESS trùng khớp với tài khoản SMTP đã đăng ký.");
  console.log("4. Tường lửa / Nhà mạng: Một số nhà mạng hoặc VPS chặn cổng 25/587 gửi ra ngoài, khuyến nghị ưu tiên cổng 465 TLS.");
  process.exit(1);
}
