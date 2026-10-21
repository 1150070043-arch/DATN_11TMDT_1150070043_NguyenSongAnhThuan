# CI BookGuard

Workflow: `.github/workflows/ci.yml`, chạy khi mở PR, push vào `main` hoặc chọn `workflow_dispatch`.

| Job | Kiểm tra | Điều kiện lỗi |
| --- | --- | --- |
| `verify` | `npm ci`, audit mức moderate, typecheck, API unit, build, operations guards, CI guards, actionlint | Lệnh trả mã lỗi |
| `ux` | Desktop 23, mobile/keyboard 56, responsive layout 126 trên Chromium/WebKit/Firefox, payment UX 3 | Có test lỗi, skip, flaky hoặc báo cáo thiếu/cũ |
| `sql` | Commerce 19, auth 13, security 12, payment provider 10, giữ kho 17, UI thật 7 | Sai số lượng test, lỗi, skip hoặc flaky E2E |
| `production` | Provision schema v8 không seed demo, tạo admin, HTTPS, cookie/CSRF, quyền SQL, alert fixture, backup/restore/DBCC/upload | Bất kỳ bước nào lỗi; cleanup lỗi cũng làm job thất bại |

Ba job tích hợp chạy sau `verify`; mỗi job dùng runner riêng. Không có bước deploy. Một lượt mới cùng PR/branch hủy lượt cũ. Actions được khóa bằng commit SHA; actionlint khóa phiên bản và SHA256. Token GitHub chỉ có `contents: read`, checkout không lưu credential.

## Chạy trên máy

Cần Node >=22, Docker với Compose và Playwright browsers. Chạy từ thư mục gốc:

```powershell
npm ci
npm audit --audit-level=moderate
npm run verify
npm run test:operations
npm run test:ci
npx playwright install chromium webkit firefox
npm run test:ux
npm run test:ux:mobile
npm run test:ui:layout
npm run test:payments:ux
npm run ci:sql
npm run test:operations:production
```

`ci:sql` tự tạo project `bookguard-ci-<UUID>`, SQL Server và volume riêng, hai database cố định `BookGuardAuditBaseline`/`BookGuardAuditSecure`. Password/JWT sinh mới từng lượt. Script không đọc `.env` của dự án; biến môi trường có credential SQL, mail, thanh toán và GitHub không được truyền cho fixture. API và web dùng port 14001/14002, 15173/15174; SQL dùng 13433; Mailpit dùng 11025/11026, 18025/18026. Các port chỉ bind loopback. Port đang bị chiếm làm lượt chạy thất bại, không dừng service khác.

Trước mỗi nhóm test, script reset database trong project vừa tạo và restart API để tách dữ liệu, session và bộ đếm rate limit giữa các nhóm. Rate limit vẫn hoạt động. Worker giữ kho của API Docker tắt trong fixture để không tranh công việc với fixture worker được test riêng; nhóm giữ kho chạy worker thật trong app fixture. Email đi vào Mailpit riêng; thanh toán dùng simulator và chữ ký fixture, không gọi ngân hàng.

`test:operations:production` tự build cả frontend và backend từ checkout, dùng project `bookguard-ops-drill-<UUID>`, HTTPS loopback với CA nội bộ và offsite simulator local. Nó không cần image frontend của lần chạy trước. Đây là kiểm tra template production; không phải deploy public hay bằng chứng giao dịch VNPay thật.

Sau lượt chạy thành công hoặc lỗi thông thường, script dọn container/volume của đúng project được tạo và xóa file env/Compose chứa credential fixture. Timeout của từng lệnh và từng job giới hạn lượt chạy. Khi bị kill cưỡng bức, `finally` có thể không chạy; GitHub hosted runner bị loại bỏ sau job. Trên máy local, nếu còn project fixture, chỉ dọn đúng project đó sau khi kiểm tra tên và cấu hình, không dùng prune toàn Docker.

## Báo cáo

`npm run ci:evidence -- <verify|ux|sql|production>` tạo JSON ở `reports/ci/evidence/`. Workflow truyền thời điểm bắt đầu job; báo cáo cũ hoặc thiếu được đánh dấu không hợp lệ. Bộ xuất chỉ giữ số lượng, boolean và tên gate nằm trong danh sách cố định. Mỗi artifact chứa đúng một JSON đã lọc, giữ 7 ngày. Không upload HTML, trace, ảnh/video, raw logs, env, resolved Compose hoặc backup database. Log local của SQL fixture nằm trong `reports/ci/`, đã gitignore/dockerignore.

Nếu job đỏ, xem bước lỗi trên GitHub và artifact đếm test. Muốn điều tra sâu, chạy lại gate local; dữ liệu fixture local không được coi là artifact công khai.

## Bật chặn merge trên GitHub

Sau khi workflow được push và chạy lần đầu, cấu hình branch rule cho `main` yêu cầu bốn status check: `verify`, `ux`, `sql`, `production`. File workflow không tự cấu hình branch protection. Không dùng `pull_request_target`; PR chạy với quyền đọc và không cần repository secrets. Chưa cấu hình hoặc chạy workflow trên GitHub chỉ bằng việc sửa file local.

Tham khảo: [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use), [actionlint v1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12).
