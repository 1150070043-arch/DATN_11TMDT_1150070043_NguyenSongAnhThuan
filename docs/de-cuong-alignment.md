# Đối chiếu BookGuard v1.5 với đề cương DATN

Tài liệu này nối từng yêu cầu chính trong đề cương với phần triển khai có thể kiểm
tra trong mã nguồn. Kết quả thực nghiệm chỉ được kết luận sau khi chạy trên Docker;
không dùng trạng thái kỳ vọng thay cho số liệu thật.

| Nội dung đề cương | Triển khai v1.5 | Nơi kiểm tra |
|---|---|---|
| Hai website có cùng chức năng | Một source nghiệp vụ chạy hai mode `baseline` và `secure`; hai frontend cùng component | `apps/api/src/config.ts`, `docker-compose.yml` |
| Hai tập dữ liệu tương đương | Hai database riêng được reset từ cùng một seed | `apps/api/src/db/seed.ts` |
| 30–50 sản phẩm mẫu | 36 sách thuộc 6 thể loại | `books` và unit test seed |
| 50–100 đơn mẫu | 60 đơn, nhiều trạng thái và lịch sử chuyển trạng thái | `sampleOrderCount` và unit test seed |
| Website bán hàng chạy được | Tài khoản, danh mục, tìm/lọc/phân trang, chi tiết, review, yêu thích, giỏ, COD, đơn hàng, hồ sơ, admin | `apps/web/src/pages`, `apps/api/src/routes` |
| Baseline chứa điểm yếu có kiểm soát | Các nhánh cố ý yếu đều có chú thích `SECURITY LAB`; production yêu cầu xác nhận `ALLOW_INSECURE_LAB` | `apps/api/src`, `apps/web/src` |
| Secure theo mô hình nhiều lớp | HTTP/CORS, input-output, xác thực-phiên, RBAC/ownership, transaction/least privilege, logging | `docs/architecture.md` |
| 10 tình huống tấn công cố định | Runner gửi cùng payload vào Baseline và Secure, ghi status, bằng chứng và thời gian | `tests/security/src/run.ts` |
| Kiểm thử chức năng | Runner chạy luồng giỏ–đặt hàng–idempotency–timeline–hủy trên cả hai API | `tests/functional/src/run.ts` |
| E2E trình duyệt thật | Playwright chạy mua–hủy, admin kho/email và responsive mobile; giữ trace/ảnh/video khi lỗi | `tests/e2e/specs` |
| Báo cáo so sánh | JSON/Markdown do runner sinh; admin validate, nhập lịch sử SQL và xuất CSV | `reports/generated`, `experiments.ts`, `admin-operations.routes.ts` |
| Đánh giá hiệu năng trước/sau | Hai workload k6 giống nhau ghi JSON riêng cho Baseline/Secure | `tests/performance/bookstore.js`, `docker-compose.yml` |
| CPU/RAM khi đo tải | Script chạy k6 đồng thời lấy mẫu Docker Stats, ghi CPU trung bình và RAM đỉnh vào report | `scripts/run-experiments.ps1` |
| SQL Server 2022 | Hai database, migration version/checksum, constraint/index/FK, ledger và transaction | `apps/api/src/db/migrations.ts` |
| React + Vite + Bootstrap | React/TypeScript, build Vite, Bootstrap làm lớp bố cục và theme tùy biến | `apps/web` |
| Node.js + Express | Express/TypeScript, middleware xác thực, CSRF, rate limit, validation và xử lý lỗi | `apps/api` |

## Sáu lớp bảo mật được áp dụng

1. **HTTP và giao tiếp:** allowlist CORS, Helmet, giới hạn body, CSP và header tại
   Nginx Secure, cookie Secure khi dùng HTTPS.
2. **Input/output:** Zod, SQL parameter, DTO, React render text, kiểm tra extension,
   MIME, magic bytes và dung lượng upload.
3. **Xác thực và phiên:** Argon2id, email verification, access JWT ngắn hạn,
   refresh token xoay vòng chỉ lưu hash, token version và thu hồi phiên.
4. **Phân quyền:** RBAC ở API, kiểm tra ownership đơn hàng, admin không thể tự khóa.
5. **Database và dữ liệu:** tài khoản DB riêng, constraint/index, checkout
   idempotent và transaction serializable khi kho/trạng thái thay đổi.
6. **Logging và truy vết:** request ID, security event có mức độ, lỗi 5xx không lộ
   chi tiết ở Secure và trang quản trị đọc báo cáo thật.

## Mười phép thử giữ cố định

| Mã | Tình huống | Khác biệt cần quan sát |
|---|---|---|
| TC01 | SQL Injection | nối chuỗi ở Baseline; parameterized query ở Secure |
| TC02 | Stored XSS | lưu/render HTML ở Baseline; lọc và render text ở Secure |
| TC03 | CSRF | Baseline nhận request; Secure yêu cầu double-submit token |
| TC04 | JWT bị sửa | Baseline decode; Secure verify chữ ký và phiên SQL |
| TC05 | Brute force | Baseline không giới hạn; Secure trả 429 và ghi log |
| TC06 | Broken Access Control | Baseline bỏ kiểm tra role; Secure bắt buộc admin |
| TC07 | IDOR | Baseline bỏ ownership; Secure từ chối đơn của người khác |
| TC08 | Misconfiguration | Baseline phản chiếu origin/lộ framework; Secure allowlist/ẩn header |
| TC09 | Sensitive Data Exposure | Baseline trả trường credential; Secure chỉ trả DTO |
| TC10 | Unsafe File Upload | Baseline nhận file giả; Secure kiểm tra nhiều lớp |

## Minh chứng còn phải sinh trên máy chạy Docker

- `security-results.json` và `security-results.md` sau khi reset rồi chạy 10 test.
- `k6-baseline.json` và `k6-secure.json` sau ít nhất ba lượt cùng cấu hình.
- CPU/RAM do `scripts/run-experiments.ps1` ghi vào báo cáo k6, cùng cấu hình máy và phiên bản Docker/SQL Server.
- `playwright-results.json` và HTML/trace của 3 E2E trình duyệt.
- Báo cáo ZAP Secure và ảnh chụp các luồng nghiệp vụ phục vụ chương kết quả.

Các tệp trên là số liệu của buổi thực nghiệm, nên dự án không đóng gói sẵn kết quả
“đạt” giả. Xem lệnh chạy trong `BAT_DAU_O_DAY.md`.
