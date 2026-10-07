# BookGuard DATN v1.2.0

Ngày phát hành: 08/09/2026

## Phạm vi hoàn thành

- Khôi phục mật khẩu end-to-end bằng SQL token lifecycle và SMTP.
- Mailpit cục bộ trong Docker Compose để nhận email kiểm thử thật.
- CRUD thể loại, upload bìa sách, khóa/mở tài khoản và chi tiết đơn cho admin.
- Phân trang danh mục phía server.
- Dashboard Baseline/Secure đọc báo cáo kiểm thử thực tế, có status, bằng chứng, tham chiếu và thời gian chạy.
- Unit test bổ sung, lệnh `npm run verify` và GitHub Actions quality gate.

## Nguyên tắc dữ liệu

Dashboard không tự tạo số liệu. Khi chưa chạy security test, giao diện hiển thị trạng thái chưa có báo cáo và chính lệnh cần chạy. Thanh toán hiện là COD; dự án không giả lập giao dịch thành công của cổng thanh toán bên thứ ba.

## Tiêu chí nghiệm thu

1. `npm ci` hoàn tất với lockfile.
2. `npm run verify` đạt.
3. `docker compose config` hợp lệ.
4. Hai API và hai web app healthy sau `docker compose up --build`.
5. Security runner sinh `security-results.json` và `security-results.md`; admin đọc được cùng dữ liệu.
6. Luồng quên mật khẩu tạo email trong Mailpit và token chỉ dùng được một lần.
