# BookGuard DATN — Thư An v1.6

BookGuard là hệ thống bán sách trực tuyến đầy đủ nghiệp vụ, đồng thời là môi trường thực nghiệm cho đề tài **“Nghiên cứu, thiết kế và đánh giá mô hình bảo mật nhiều lớp cho ứng dụng web bán hàng trực tuyến”**.

Dự án chạy hai hệ thống từ cùng một mã nguồn nghiệp vụ:

- **Baseline**: có chủ đích giữ đúng 10 điểm yếu phục vụ thực nghiệm.
- **Secure**: áp dụng kiểm soát bảo mật nhiều lớp và là bản định hướng triển khai thật.

Hai hệ thống có giao diện, chức năng và dữ liệu khởi tạo tương đương. Mỗi hệ thống dùng một database riêng để kết quả thử nghiệm không ảnh hưởng lẫn nhau.

Hướng dẫn tách môi trường, chạy riêng từng bản và kiểm chứng: [Twin environments](docs/twin-environments.md).
SQL Server vẫn dùng chung để tiết kiệm RAM; API, phiên đăng nhập, upload và hộp thư lab được tách riêng.
Mailpit Secure ở `8025`, Baseline ở `8026`. Sau nâng cấp cần đăng nhập lại.

## Nâng cấp v1.6

- Mã ưu đãi có điều kiện, thời gian hiệu lực, hạn mức và thống kê lượt dùng thật trong SQL Server.
- Checkout áp dụng ưu đãi, tạo đơn, trừ kho và giữ lượt dùng trong một transaction chống tranh chấp.
- Hoàn lượt dùng mã khi đơn bị hủy, không làm sai hạn mức khuyến mại.
- Admin quản lý ưu đãi và xem nhật ký thao tác gắn request ID.
- Khách hàng tải hóa đơn CSV đã chống formula injection.
- Migration phiên bản 3 nâng cấp dữ liệu cũ mà không sửa migration đã áp dụng.

## Nền tảng từ v1.5

- Migration SQL có phiên bản, checksum và bảng `SchemaMigrations`; mỗi migration chạy đúng một lần trong transaction và từ chối nếu nội dung đã áp dụng bị sửa.
- Quản lý tồn kho bằng sổ `InventoryMovements`: nhập/xuất/hoàn/điều chỉnh đều có số dư sau giao dịch, nguồn tham chiếu, người thao tác và thời gian.
- Email trạng thái đơn dùng transactional outbox `OrderNotifications`, có số lần thử, trạng thái gửi và tự thử lại thư bị gián đoạn khi API khởi động.
- Dashboard admin có biểu đồ doanh thu, trạng thái đơn, sách bán nổi bật và cảnh báo kho thấp từ truy vấn SQL thật.
- Trung tâm thực nghiệm nhập báo cáo security, functional, Playwright và k6 đã validate vào `ExperimentRuns`, chống nhập trùng bằng SHA-256 và giữ lịch sử nhiều lượt chạy.
- Playwright E2E kiểm tra mua–hủy–hoàn kho, vận hành admin/email và responsive mobile; trace, ảnh/video lỗi cùng HTML/JSON report được giữ để truy vết.
- Error Boundary cấp ứng dụng, trạng thái lỗi/rỗng/loading rõ ràng và responsive polish cho dashboard, bảng kho, drawer và màn hình 320 px.
- Quality gate có **20 unit test**, typecheck toàn bộ 5 workspace và production build; 3 E2E được chạy riêng khi stack thật đang hoạt động.

## Nền tảng từ v1.4

- Dữ liệu thực nghiệm được đưa đúng phạm vi đề cương: **36 đầu sách, 60 đơn hàng mẫu**, cùng seed cho hai database.
- Secure dùng access token ngắn hạn và refresh token xoay vòng; database chỉ lưu SHA-256, có phát hiện token cũ bị tái sử dụng và thu hồi theo phiên.
- Checkout có idempotency key, khóa transaction và kiểm tra tồn kho để thao tác gửi lặp không tạo hai đơn.
- Mọi thay đổi trạng thái đơn được lưu trong `OrderStatusHistory` và hiển thị thành timeline cho khách hàng lẫn quản trị viên.
- UI neo-editorial tương phản cao, card sách/checkout/đơn hàng/admin nhất quán; thêm toast, hộp xác nhận, retry state và thanh điều hướng nhanh trên mobile.
- k6 chạy riêng Baseline/Secure và lưu hai tệp JSON để lấy số liệu đối chiếu thật.
- Quality gate hiện có 12 unit test cùng typecheck và production build.

## Nền tảng từ v1.3

- Xác minh email bằng liên kết SMTP có hạn dùng, dùng một lần và hỗ trợ gửi lại an toàn.
- Quản lý phiên đăng nhập theo thiết bị: xem lịch sử 30 ngày, thu hồi từng phiên hoặc đăng xuất toàn bộ.
- Đổi mật khẩu có kiểm tra mật khẩu hiện tại; tự vô hiệu hóa phiên cũ và giữ phiên hiện tại bằng token mới.
- Danh sách yêu thích lưu trong SQL Server, hiển thị xuyên suốt danh mục, chi tiết sách và trang riêng.
- Xuất báo cáo đối chiếu bảo mật thật thành CSV UTF-8 trực tiếp từ trang quản trị.
- Schema nâng cấp tại chỗ, không buộc xóa dữ liệu của bản v1.2.

## Nền tảng từ v1.2

- Luồng quên/đặt lại mật khẩu thật: token ngẫu nhiên chỉ lưu SHA-256, hết hạn, dùng một lần và gửi qua SMTP.
- Mailpit tích hợp trong Docker để kiểm tra email tại máy mà không cần tài khoản email cá nhân.
- Quản trị đầy đủ hơn: CRUD thể loại, upload ảnh bìa, khóa/mở khóa khách hàng, lọc bảng và xem chi tiết đơn.
- Dashboard đối chiếu Baseline/Secure đọc trực tiếp báo cáo JSON do bộ test sinh; không có số liệu minh họa gắn cứng.
- Danh mục sách phân trang phía server, có điều hướng bàn phím và responsive từ 320 px.
- Quality gate tự động gồm typecheck, unit test và production build trên GitHub Actions.

## Chức năng

### Khách hàng

- Đăng ký, xác minh email, đăng nhập, đăng xuất và cập nhật hồ sơ.
- Đổi mật khẩu, xem thiết bị đăng nhập và đăng xuất các phiên từ xa.
- Quên mật khẩu, nhận email và tạo mật khẩu mới.
- Xem, tìm kiếm, lọc, sắp xếp và phân trang sách.
- Xem chi tiết, tồn kho và đánh giá sách.
- Lưu và quản lý danh sách sách yêu thích.
- Thêm, sửa, xóa sản phẩm trong giỏ hàng.
- Đặt hàng với transaction và kiểm tra tồn kho.
- Xem chi tiết, theo dõi timeline trạng thái và hủy đơn đang chờ.
- Tải ảnh đại diện.

### Quản trị viên

- Xem thống kê khách hàng, sách, đơn và doanh thu.
- Xem biểu đồ doanh thu/trạng thái, sách bán nổi bật và cảnh báo kho thấp.
- Quản lý sách, thể loại và ảnh bìa tải trực tiếp.
- Điều chỉnh tồn kho có lý do và xem toàn bộ sổ biến động.
- Theo dõi, xem chi tiết và cập nhật trạng thái đơn theo đúng vòng đời.
- Theo dõi trạng thái email của từng thay đổi đơn qua outbox SQL.
- Tìm kiếm, khóa và mở khóa tài khoản khách hàng.
- Xem dashboard và xuất CSV kết quả kiểm thử Baseline/Secure từ dữ liệu thực tế.
- Đồng bộ lịch sử security, functional, Playwright và k6 vào dashboard thực nghiệm.
- Theo dõi sự kiện bảo mật của hệ thống Secure.

## Công nghệ

- Frontend: React, Vite, TypeScript, Bootstrap và hệ thống giao diện editorial tùy biến.
- Backend: Node.js, Express và TypeScript.
- Database: SQL Server 2022.
- Mật khẩu Secure: Argon2id.
- Đóng gói: Docker Compose.
- Kiểm thử: Node test runner, Playwright E2E, bộ test bảo mật tự động, OWASP ZAP và k6.

## Chạy toàn bộ hệ thống

Yêu cầu: Docker Desktop hoặc Docker Engine có Compose.

1. Tạo tệp cấu hình:

   Linux/macOS:

   ```bash
   cp .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Thay toàn bộ mật khẩu và secret mẫu trong `.env`.

3. Khởi động:

   ```bash
   docker compose up --build
   ```

4. Mở ứng dụng:

   - Baseline: http://localhost:5173
   - Secure: http://localhost:5174
   - Baseline API: http://localhost:4001/api/health
   - Secure API: http://localhost:4002/api/health
   - Hộp thư kiểm thử: http://localhost:8025

SQL Server chỉ bind vào `127.0.0.1`, không mở ra mạng ngoài.

## Tài khoản dữ liệu mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@bookguard.local` | `Admin@12345` |
| Customer A | `customer.a@bookguard.local` | `Customer@123` |
| Customer B | `customer.b@bookguard.local` | `Customer@123` |

Tất cả đều là tài khoản giả chỉ dùng trong môi trường nghiên cứu.
Bộ seed có 36 đầu sách thuộc 6 thể loại và 60 đơn mẫu, nằm trong đúng phạm vi dữ liệu của đề cương.

## Reset dữ liệu

```bash
docker compose run --rm db-init node dist/db/cli.js reset
```

Lệnh này đưa cả Baseline và Secure về cùng bộ dữ liệu gốc. Nên chạy trước mỗi lượt thí nghiệm chính thức.

## Chạy 10 bài kiểm thử bảo mật

Sau khi hai API đã healthy:

```bash
docker compose --profile tools run --rm security-tests
```

Kết quả thực tế được sinh tại:

- `reports/generated/security-results.json`
- `reports/generated/security-results-<timestamp>.json`
- `reports/generated/security-results.md`

Bộ test chỉ đạt khi Baseline khai thác được và Secure chặn được cùng một kịch bản.
Sau khi chạy, đăng nhập admin và mở tab **Đối chiếu bảo mật** để xem cùng dữ liệu trên giao diện hoặc xuất CSV.

## Kiểm thử chức năng end-to-end

Sau khi hai API đã healthy, chạy luồng mua hàng thật trên cả hai database:

```bash
docker compose --profile tools run --rm functional-tests
```

Runner kiểm tra đăng nhập, đọc danh mục, thêm/sửa giỏ, tạo đơn trong transaction,
gửi lại cùng idempotency key, đọc timeline, hủy đơn và kiểm tra trạng thái sau hủy.
Kết quả lưu tại `reports/generated/functional-results.json` và một bản có timestamp. Nên reset dữ liệu
trước lượt thực nghiệm bảo mật tiếp theo.

## Playwright E2E trên website thật

Sau khi stack Docker đang chạy và dữ liệu vừa reset:

```bash
npx playwright install chromium
npm run test:e2e
```

Ba kịch bản chạy tuần tự trên Secure, thao tác qua trình duyệt thật và lưu HTML,
JSON, trace/screenshot/video khi lỗi trong `reports/playwright`. Test tạo dữ liệu
vận hành, vì vậy hãy reset database trước và sau buổi nghiệm thu.

## Kiểm tra chất lượng mã nguồn

```bash
npm ci
npm run verify
```

`verify` chạy typecheck cho toàn bộ workspace, 20 unit test API và production build. Cùng lệnh này được chạy trong `.github/workflows/ci.yml`. E2E/functional/security/performance test cần hệ thống đang chạy và được thực hiện riêng.

## Kiểm thử hiệu năng

```bash
docker compose --profile tools run --rm performance-baseline
docker compose --profile tools run --rm performance-secure
```

Mặc định k6 chạy tải tăng dần lên 10 virtual users, kiểm tra tỷ lệ lỗi dưới 1% và p95 dưới 500 ms. Kết quả thô được lưu tại `reports/generated/k6-baseline.json` và `reports/generated/k6-secure.json`. Khi lấy số liệu luận án, chạy mỗi hệ thống nhiều lượt trong cùng điều kiện máy, đồng thời ghi CPU/RAM bằng `docker stats`.

Trên Windows có thể chạy trọn bộ và tự lấy mẫu CPU/RAM:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-experiments.ps1
```

Script mặc định reset hai database về cùng seed trước khi đo để bảo đảm công bằng.
Chỉ thêm `-SkipReset` khi chủ động muốn giữ dữ liệu hiện tại và không dùng lượt đó
làm số liệu so sánh chính thức.

Sau đó mở Admin → **Thực nghiệm** → **Đồng bộ báo cáo**. Dashboard chỉ hiển thị
dữ liệu đã nhập từ file thật; metric chưa đo được ghi rõ “Chưa đo”.

## Quét DAST bằng OWASP ZAP

Sau khi Secure đang chạy:

```bash
docker compose --profile dast run --rm zap-scan
```

Báo cáo HTML và JSON được lưu trong `reports/generated`. Kết quả ZAP bổ sung cho
10 test cố định; không thay thế việc phân tích từng kịch bản trong luận án.

## Phát triển không dùng container cho frontend/backend

API dev tự đọc tệp `.env` ở thư mục gốc. Chỉ chạy SQL Server, Mailpit và bước khởi tạo bằng container trước:

```bash
docker compose up -d sqlserver mailpit mailpit-baseline db-init-baseline db-init-secure
```

Sau đó mở bốn terminal riêng:

```bash
npm ci
npm run dev:api:baseline
npm run dev:api:secure
npm run dev:web:baseline
npm run dev:web:secure
```

Mỗi lệnh dev nên chạy trong một terminal riêng.

## Tài liệu

- [Bắt đầu ở đây](BAT_DAU_O_DAY.md)
- [Kiến trúc hệ thống](docs/architecture.md)
- [Đối chiếu mã nguồn với đề cương](docs/de-cuong-alignment.md)
- [Mô hình đe dọa](docs/threat-model.md)
- [Ma trận kiểm thử bảo mật](docs/security-test-matrix.md)
- [API chính](docs/api.md)
- [Hướng dẫn triển khai](docs/deployment.md)
- [Hệ thống thiết kế giao diện](docs/ui-design-system.md)
- [Vận hành Secure production](docs/operations-production-guide.md)
- [CI và các bộ kiểm tra](docs/ci-guide.md)
- [Dọn session và token](docs/backend-auth-maintenance-2026-10-12.md)
- [Thanh toán và đối soát](docs/payment-upgrade-2026-10-12.md)
- [Giữ kho và thời hạn thanh toán](docs/backend-stock-holds-2026-10-12.md)

## Cảnh báo bắt buộc

Baseline chứa lỗ hổng có chủ đích. Không dùng dữ liệu thật, không tái sử dụng mật khẩu thật và **không triển khai Baseline công khai trên Internet**. Ứng dụng Baseline sẽ từ chối khởi động ở production nếu chưa đặt rõ `ALLOW_INSECURE_LAB=true`.
