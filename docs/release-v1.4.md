# BookGuard DATN v1.4.0

## Mục tiêu

V1.4 tập trung đúng trọng tâm đề cương: hai hệ thống có cùng nghiệp vụ và dữ liệu,
backend Secure đủ chặt để làm bản triển khai, giao diện có cá tính rõ và mọi luồng
chính cho phản hồi dễ hiểu. Không có dashboard, nút hoặc số liệu giả lập.

## Backend và dữ liệu

- Seed hai database từ cùng 36 sách, 6 thể loại và 60 đơn mẫu. Số lượng này nằm
  trong phạm vi 30–50 sản phẩm và 50–100 đơn nêu trong đề cương.
- Access token Secure mặc định 15 phút; refresh token 7 ngày được tạo ngẫu nhiên,
  lưu hash SHA-256, xoay sau mỗi lần dùng và liên kết với phiên thiết bị.
- Đổi/đặt lại mật khẩu, khóa tài khoản, đăng xuất hoặc thu hồi thiết bị đều vô hiệu
  hóa refresh token liên quan.
- Checkout Secure bắt buộc idempotency key. Đặt đơn, trừ kho, tạo chi tiết, ghi
  lịch sử và xóa giỏ chạy trong transaction serializable.
- Trạng thái đơn đi qua state machine; mọi thay đổi lưu trong `OrderStatusHistory`,
  hủy đơn hoàn kho đúng một lần.
- API trả lỗi validation theo trường, phân biệt payload quá lớn, dữ liệu trùng,
  xung đột tham chiếu và database tạm thời không sẵn sàng; lỗi 5xx Secure không
  lộ chi tiết nội bộ.

## Frontend và UX

- Hệ thị giác neo-editorial mới với midnight, cobalt, coral và electric green;
  hero, card sách, form, trang nội dung và admin dùng cùng token.
- Toast có live region, hộp xác nhận truy cập được, retry state cho danh mục và
  lỗi kết nối có timeout rõ ràng.
- Checkout có tiến trình ba bước và chống double submit ở cả frontend/backend.
- Trang đơn có bộ lọc nhanh, success state, drawer chi tiết và timeline SQL thật.
- Mobile có bottom dock, bố cục từ 320 px, skip link, focus ring và hỗ trợ
  `prefers-reduced-motion`.

## Thực nghiệm

- Functional runner kiểm tra luồng đăng nhập–giỏ–checkout–idempotency–timeline–hủy
  trên cả Baseline và Secure, rồi lưu `functional-results.json`.
- 10 security test cố định vẫn so cùng payload giữa Baseline/Secure.
- k6 có hai service riêng, ghi `k6-baseline.json` và `k6-secure.json` để so sánh
  latency, p95, throughput và error rate từ dữ liệu thật.

## Nghiệm thu mã nguồn

Chạy `npm run verify` để thực hiện typecheck, 12 unit test và production build.
Việc smoke-test container/SQL và sinh báo cáo thực nghiệm cần Docker Desktop, thực
hiện sau bằng các lệnh trong `BAT_DAU_O_DAY.md`.
