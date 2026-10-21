# Triển khai

Hướng dẫn production và kiểm chứng vận hành mới nhất: [Cẩm nang vận hành](operations-production-guide.md). Dùng Compose riêng cho production, không dùng seed/reset của lab. Các mục v1.4/v1.5 bên dưới mô tả nâng cấp lịch sử; schema hiện tại là v8, quyền Secure theo từng bảng và outbox retry tối đa 10 lần.

## Secure

Bản Secure có thể đặt sau Nginx, Caddy hoặc load balancer hỗ trợ TLS. Khi triển khai:

1. Dùng domain HTTPS.
2. Đặt `COOKIE_SECURE=true`.
3. Tạo `JWT_SECRET` và `CSRF_SECRET` độc lập, ngẫu nhiên, tối thiểu 32 ký tự.
4. Chỉ cho phép đúng frontend origin qua `WEB_ORIGIN`.
5. Giữ `TRUST_PROXY_HOPS=0` nếu API nhận kết nối trực tiếp; chỉ đổi thành đúng số
   proxy thực tế khi có reverse proxy tin cậy.
6. Không dùng tài khoản `sa` cho API.
7. Lưu upload trên volume bền vững hoặc object storage riêng.
8. Backup database, kiểm thử restore và bảo vệ log.
9. Không commit `.env`.
10. Cấu hình SMTP thật bằng `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_ADDRESS` và `MAIL_FROM_NAME`.

`SMTP_SECURE=true` dùng kết nối TLS trực tiếp (thường cổng 465). Bản Docker cục bộ dùng Mailpit không mã hóa trên mạng nội bộ Compose; giao diện và SMTP chỉ bind lần lượt vào `127.0.0.1:8025` và `127.0.0.1:1025`. Khi triển khai thật, bỏ Mailpit và trỏ các biến SMTP tới nhà cung cấp email được phép gửi cho domain của bạn.

## Baseline

Baseline chỉ chạy trên máy cá nhân hoặc mạng lab cô lập:

- Bind port vào `127.0.0.1`.
- Chỉ dùng dữ liệu seed giả.
- Không mở firewall/public tunnel.
- Không sử dụng mật khẩu thật.
- Tắt và xóa volume sau khi hoàn tất thực nghiệm nếu không còn cần thiết.

## Trước khi lấy số liệu luận án

1. Ghi lại cấu hình CPU, RAM và phiên bản phần mềm.
2. Reset dữ liệu.
3. Khởi động lại container và chờ healthcheck.
4. Warm-up hệ thống.
5. Chạy mỗi workload ít nhất ba lượt.
6. Lưu kết quả thô; báo cáo median, p95, throughput, error rate, CPU và RAM.

## Nâng cấp lên v1.5

Chạy lại `docker compose up --build`. `db-init` tạo bảng lịch sử migration, ghi
checksum cho schema lõi và áp dụng migration v1.5 đúng một lần. Dữ liệu cũ không
bị xóa; kho hiện tại được tạo một mốc `opening` nếu chưa có ledger. Không sửa nội
dung migration đã phát hành — hãy thêm version mới cho mọi thay đổi tiếp theo.

V1.5 tạo `InventoryMovements`, `OrderNotifications` và `ExperimentRuns`. Tài khoản
API Secure vẫn nhận quyền DML qua schema, không nhận quyền ALTER/CONTROL. Thư
trạng thái bị lỗi được giữ trong outbox và thử lại tối đa ba lần; cấu hình SMTP
thật phải được kiểm tra trước khi public Secure.

Thư mục `reports/generated` được mount read-only vào API. Admin chỉ có thể nhập
các file đã whitelist và validate; runner mới là phía ghi báo cáo. Với số liệu
CPU/RAM trên Windows, dùng `scripts/run-experiments.ps1`.

## Nâng cấp nền tảng lên v1.4

Chạy lại `docker compose up --build`. Service `db-init` tự thêm `IdempotencyKey`,
`RefreshTokens` và `OrderStatusHistory` mà không xóa đơn hiện có; đơn cũ chưa có
lịch sử sẽ được tạo một mốc trạng thái ban đầu. Các migration v1.3 cho xác minh
email, phiên đăng nhập và yêu thích vẫn chạy an toàn nếu database cũ hơn. Chỉ dùng
lệnh `reset` khi chủ động muốn thay toàn bộ dữ liệu bằng seed 36 sách/60 đơn.

Hai biến mới có giá trị mặc định an toàn cho local: `ACCESS_TOKEN_TTL_MINUTES=15`
và `SESSION_TTL_DAYS=7`. Khi triển khai HTTPS phải tiếp tục đặt
`COOKIE_SECURE=true`.
