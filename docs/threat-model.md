# Mô hình đe dọa

## Phạm vi

Bản Secure bảo vệ tài khoản, phiên đăng nhập, hồ sơ khách hàng, giỏ hàng, đơn hàng,
tồn kho, tệp tải lên và nhật ký bảo mật. Thanh toán chỉ dùng COD; dự án không lưu
thẻ ngân hàng.

## Tác nhân và biên tin cậy

| Tác nhân | Quyền hợp lệ | Rủi ro cần kiểm soát |
|---|---|---|
| Khách chưa đăng nhập | Xem và tìm sách | Injection, dò endpoint, gây tải |
| Khách hàng | Hồ sơ, giỏ và đơn của chính mình | Chiếm phiên, CSRF, IDOR, upload độc hại |
| Quản trị viên | Sách, đơn, tài khoản và log | Lạm quyền, chiếm tài khoản quản trị |
| Dịch vụ API | Đọc/ghi dữ liệu nghiệp vụ | Lộ secret, quyền database quá rộng |
| Người vận hành | Cấu hình và backup | Cấu hình sai, công khai Baseline |

Frontend là vùng không tin cậy. Mọi xác thực, phân quyền, kiểm tra quyền sở hữu và
kiểm tra dữ liệu đều được thực hiện lại tại API.

## STRIDE và biện pháp

| Nhóm | Kịch bản chính | Kiểm soát trong Secure | Bằng chứng |
|---|---|---|---|
| Spoofing | Sửa JWT, dò mật khẩu hoặc chiếm liên kết khôi phục | Verify chữ ký, issuer, audience, expiry, Argon2id, giới hạn đăng nhập/reset, token reset hash hóa và dùng một lần | TC04, TC05 và unit test token |
| Tampering | Sửa request hoặc tồn kho | Zod, SQL tham số hóa, transaction serializable, khóa bản ghi | TC01 và checkout |
| Repudiation | Phủ nhận request bị chặn | Request ID, log thời gian, IP, user và đường dẫn | Security events |
| Information disclosure | API trả mật khẩu hoặc stack trace | DTO chỉ gồm trường hợp lệ, lỗi an toàn, cookie HttpOnly | TC09 |
| Denial of service | Brute force hoặc request dồn dập | Rate limit riêng cho login và toàn API, giới hạn body/upload | TC05 |
| Elevation of privilege | Customer gọi API quản trị hoặc đọc đơn khác | RBAC phía server và kiểm tra chủ sở hữu | TC06, TC07 |

## Rủi ro còn lại và giả định

- Secure cần được đặt sau HTTPS khi triển khai ngoài máy cá nhân.
- Secret phải được quản lý ngoài mã nguồn và thay định kỳ.
- Database, volume upload, backup và log cần quyền truy cập tối thiểu.
- Magic-byte validation giảm rủi ro upload nhưng production quy mô lớn nên quét malware
  và lưu tệp trên object storage tách biệt.
- SMTP production phải dùng TLS trực tiếp và tài khoản gửi có quyền tối thiểu; không ghi token đặt lại mật khẩu vào log.
- Baseline chứa lỗ hổng có chủ đích, chỉ được phép chạy trong lab cô lập.
