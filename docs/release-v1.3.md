# BookGuard DATN v1.3.0

Ngày phát hành: 09/09/2026

## Mục tiêu

V1.3 hoàn thiện các luồng tài khoản và giữ chân người dùng theo hướng vận hành thật. Mọi dữ liệu mới đều đi qua API và được lưu trong SQL Server; không có nút hoặc số liệu minh họa gắn cứng.

## Chức năng mới

- Xác minh email qua SMTP bằng token ngẫu nhiên 256 bit, chỉ lưu SHA-256, hết hạn sau 24 giờ và chỉ dùng một lần.
- Gửi lại email xác minh có giới hạn tần suất và phản hồi chống dò tài khoản.
- Mỗi lần đăng nhập tạo một phiên riêng với địa chỉ IP, user-agent, thời điểm tạo, lần hoạt động gần nhất, hạn dùng và trạng thái thu hồi.
- Trang tài khoản cho phép xem lịch sử đăng nhập 30 ngày, đăng xuất từng phiên hoặc toàn bộ thiết bị.
- Đổi mật khẩu có xác minh mật khẩu hiện tại, băm Argon2id ở Secure, thu hồi phiên cũ và cấp lại phiên hiện tại.
- Danh sách sách yêu thích lưu trong bảng `WishlistItems`, có thao tác từ card sách, trang chi tiết và trang `/wishlist`.
- Trang quản trị xuất kết quả đối chiếu bảo mật sang CSV UTF-8 từ tệp kết quả kiểm thử mới nhất.

## Nâng cấp dữ liệu

Schema tự thêm các thành phần sau khi chạy `db-init`:

- `Users.EmailVerifiedAt`
- `EmailVerificationTokens`
- `UserSessions`
- `WishlistItems`

Tài khoản tồn tại trước v1.3 được đánh dấu đã xác minh ngay tại lần migration đầu tiên. Tài khoản tạo mới trên Secure phải xác minh email trước khi đăng nhập.

## Kiểm tra phát hành

- TypeScript: API, web và security test đều đạt.
- Unit test: 8/8 đạt, gồm kiểm tra token xác minh email và phiên SMTP thật cục bộ.
- Production build: API và web đều thành công.
- Docker smoke test: để chạy trên máy có Docker Engine theo `BAT_DAU_O_DAY.md`.

## Lưu ý bảo mật

Baseline vẫn cố ý giữ các điểm yếu phục vụ 10 kịch bản nghiên cứu. Không triển khai Baseline công khai và không sử dụng dữ liệu thật.
