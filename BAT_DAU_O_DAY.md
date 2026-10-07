# Bắt đầu ở đây

Tài liệu này dành cho lần đầu mở dự án. Bạn chưa cần đọc toàn bộ mã nguồn.

## 1. Hiểu đúng hai phiên bản

- **Secure** tại http://localhost:5174 là website chính để trình bày sản phẩm.
- **Baseline** tại http://localhost:5173 chỉ dùng trong phòng lab để chứng minh 10 lỗ hổng.
- Hai phiên bản có cùng chức năng nhưng dùng database riêng để phép so sánh có thể lặp lại.

Không đưa Baseline lên hosting công khai và không nhập dữ liệu thật vào Baseline.

## 2. Cài và chạy

Cách dễ nhất trên Windows là cài Docker Desktop, bật WSL 2 và khởi động Docker Desktop.
Node.js 22 chỉ cần khi muốn phát triển ngoài container.

Kiểm tra Docker trước khi chạy dự án:

~~~powershell
docker --version
docker compose version
~~~

Nếu PowerShell báo `docker is not recognized`, Docker Desktop chưa được cài hoặc terminal chưa nhận PATH. Hãy cài/mở Docker Desktop, chờ trạng thái Engine running, đóng PowerShell/VS Code rồi mở lại và chạy hai lệnh kiểm tra trên.

Trong PowerShell, chuyển vào thư mục dự án rồi chạy:

~~~powershell
Copy-Item .env.example .env
~~~

Mở tệp .env và thay mọi giá trị bắt đầu bằng ChangeThis hoặc replace-with.
Mỗi secret phải là một chuỗi ngẫu nhiên riêng dài ít nhất 32 ký tự.

Có thể tạo nhanh một secret bằng Node.js:

~~~powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
~~~

Khởi động toàn bộ hệ thống:

~~~powershell
docker compose up --build
~~~

Khi các service đã healthy, mở Secure tại http://localhost:5174. Email xác minh tài khoản và đặt lại mật khẩu xuất hiện tại http://localhost:8025.

## 3. Tài khoản mẫu

| Quyền | Email | Mật khẩu |
|---|---|---|
| Quản trị | admin@bookguard.local | Admin@12345 |
| Khách A | customer.a@bookguard.local | Customer@123 |
| Khách B | customer.b@bookguard.local | Customer@123 |

Đây là dữ liệu giả được tạo lại khi reset.

## 4. Kiểm tra sản phẩm

Trên Secure, thử lần lượt:

1. Đăng ký tài khoản khách, mở Mailpit và xác minh email rồi đăng nhập.
2. Tìm sách, xem chi tiết, thêm giỏ, đổi số lượng và đặt hàng.
3. Mở lịch sử đơn, xem chi tiết và hủy một đơn đang chờ.
4. Lưu vài sách yêu thích rồi kiểm tra trang **Yêu thích**.
5. Trong trang tài khoản, đổi mật khẩu, xem lịch sử đăng nhập và thử thu hồi một phiên.
6. Thử quên mật khẩu, mở Mailpit, bấm liên kết và đặt mật khẩu mới.
7. Đăng nhập admin, xem biểu đồ, quản lý sách/thể loại, upload bìa, khóa/mở tài khoản và xử lý đơn.
8. Mở tab **Tồn kho**, điều chỉnh một đầu sách có lý do và kiểm tra bản ghi mới trong sổ biến động.
9. Đổi trạng thái một đơn, kiểm tra Mailpit và trạng thái **Đã gửi** trong chi tiết đơn.
10. Chạy thực nghiệm rồi mở tab **Thực nghiệm**, đồng bộ báo cáo và kiểm tra lịch sử.

## 5. Chạy thực nghiệm luận án

Reset hai database về cùng trạng thái (lịch sử migration vẫn được giữ):

~~~powershell
docker compose run --rm db-init node dist/db/cli.js reset
~~~

Trên Windows, cách đầy đủ nhất để chạy security, functional, k6 và lấy mẫu CPU/RAM là:

~~~powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-experiments.ps1
~~~

Script mặc định tự reset hai database về cùng seed rồi tạo báo cáo latest và bản
timestamp. `-SkipReset` chỉ dành cho lượt thử không dùng làm kết quả chính thức.
Đăng nhập admin, mở **Thực nghiệm** và
bấm **Đồng bộ báo cáo** để validate, chống nhập trùng và lưu lịch sử vào SQL.

Nếu chỉ muốn chạy 10 kịch bản cố định:

~~~powershell
docker compose --profile tools run --rm security-tests
~~~

Chạy luồng nghiệp vụ end-to-end trên cả Baseline và Secure:

~~~powershell
docker compose --profile tools run --rm functional-tests
~~~

Runner này tạo/hủy một đơn kiểm thử ở mỗi database. Hãy reset lại trước khi lấy
số liệu bảo mật hoặc hiệu năng chính thức.

Kết quả thật nằm trong:

- reports/generated/security-results.json
- reports/generated/security-results.md

Đo hiệu năng hai phiên bản trong cùng điều kiện:

~~~powershell
docker compose --profile tools run --rm performance-baseline
docker compose --profile tools run --rm performance-secure
~~~

Hai tệp kết quả được lưu tại `reports/generated/k6-baseline.json` và
`reports/generated/k6-secure.json`. Script `run-experiments.ps1` tự lấy mẫu
Docker Stats và bổ sung CPU trung bình/RAM đỉnh vào chính báo cáo k6.

Quét DAST bằng OWASP ZAP:

~~~powershell
docker compose --profile dast run --rm zap-scan
~~~

Chỉ dùng số liệu do các lệnh trên sinh ra trên máy thực nghiệm. Ghi kèm cấu hình
CPU/RAM và chạy nhiều lượt trong cùng điều kiện.

## 6. Bản đồ mã nguồn

| Muốn tìm | Thư mục |
|---|---|
| Giao diện React | apps/web/src |
| API và nghiệp vụ | apps/api/src/routes |
| Kiểm soát bảo mật | apps/api/src/security và apps/api/src/middleware |
| Cấu trúc SQL Server | apps/api/src/db/schema.ts |
| Migration có phiên bản | apps/api/src/db/migrations.ts |
| Ledger kho và dashboard thực nghiệm | apps/api/src/routes/admin.routes.ts, apps/api/src/lib/experiments.ts |
| Dữ liệu mẫu | apps/api/src/db/seed.ts |
| 10 test bảo mật | tests/security/src/run.ts |
| Test chức năng end-to-end | tests/functional/src/run.ts |
| Playwright trình duyệt | tests/e2e/specs |
| Test hiệu năng | tests/performance/bookstore.js |
| Tài liệu kiến trúc | docs |

Những điểm yếu có chủ đích đều được đánh dấu SECURITY LAB để không nhầm với code Secure.

## 7. Kiểm tra trước khi nộp

~~~powershell
npm ci
npm run verify
~~~

Khi hệ thống Docker đang chạy, cài Chromium một lần rồi chạy 3 E2E:

~~~powershell
npx playwright install chromium
docker compose run --rm db-init node dist/db/cli.js reset
npm run test:e2e
~~~

Playwright thao tác dữ liệu thật trên Secure. Reset lại database sau khi chạy nếu
muốn bắt đầu một lượt trình diễn sạch.

Sau khi đổi database hoặc nghiệp vụ, reset dữ liệu và chạy lại bộ security test.
