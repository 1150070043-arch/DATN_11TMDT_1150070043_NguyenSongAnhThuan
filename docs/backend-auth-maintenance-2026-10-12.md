# BE: dọn session/token và giữ đúng thứ tự phiên — 12/10/2026

Đã triển khai mục 3: worker dọn dữ liệu xác thực đã hết hiệu lực, công cụ dry-run/chạy thủ công, index phục vụ cleanup và sửa thứ tự giữ 10 phiên đăng nhập mới nhất. Hai API Docker đang chạy bản mới trên database thường, schema v7. Không reset hoặc seed lại dữ liệu thường, không sửa `.env`.

## Chính sách dọn

Worker chạy khi API khởi động và mỗi 60 phút. Mặc định giữ bản ghi thêm 7 ngày từ lúc hết hiệu lực; mỗi lô xóa tối đa 500 bản ghi ở từng bảng, mỗi lượt tối đa 10 lô. Nếu còn backlog, log có `backlogPossible`; lượt tiếp theo tiếp tục dọn.

| Dữ liệu | Điều kiện được dọn |
|---|---|
| `UserSessions` | Hết hạn hoặc bị thu hồi ít nhất 7 ngày; chỉ xóa sau khi không còn refresh token con |
| `RefreshTokens` có session | Session cha đủ điều kiện dọn, bao gồm các token đã rotate trong phiên đó |
| Refresh token legacy không có session | Hết hạn hoặc thu hồi ít nhất 7 ngày |
| `PasswordResetTokens`, `EmailVerificationTokens` | Hết hạn hoặc đã dùng ít nhất 7 ngày |

Không dọn refresh token của session còn hoạt động chỉ vì `RevokedAt` cũ. Token đã rotate vẫn là bằng chứng để phát hiện replay; thử dùng lại nó phải tiếp tục thu hồi cả phiên. Access JWT không có bảng lưu riêng, việc hết hạn vẫn do kiểm tra JWT xử lý.

Mỗi lô là một transaction, xóa token con trước session cha. Khóa `sp_getapplock` có owner là transaction và timeout 0 để tiến trình thứ hai bỏ qua nếu có lượt dọn đang chạy; khóa độc lập theo database nên hai twin không khóa lẫn nhau. Tham chiếu: [Microsoft sp_getapplock](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql?view=sql-server-ver17), [DELETE TOP](https://learn.microsoft.com/en-us/sql/t-sql/statements/delete-transact-sql?view=sql-server-ver16).

Job không chồng nhau trong cùng process. Lỗi SQL rollback cả lô và được ghi bằng mã lỗi; lượt sau có thể thử lại. Khi shutdown, worker ngừng nhận lượt mới và chờ lượt đang chạy trước khi đóng pool. Log chỉ ghi số lượng, thời gian, mode và mã lỗi, không ghi token/hash token/địa chỉ khách hàng. `SecurityEvents` và `AdminAuditEvents` không nằm trong phạm vi dọn.

## Sửa lỗi thứ tự session

Kiểm tra đồng thời phát hiện `CreatedAt` có độ chính xác đến giây. Khi nhiều session cùng thời điểm, thứ tự theo GUID ngẫu nhiên có thể thu hồi một phiên vừa tạo và giữ phiên cũ hơn.

Migration 7 thêm `IssuedOrder` dạng SQL identity và cập nhật index theo user/thời điểm/thứ tự phát hành. Giới hạn session và danh sách phiên dùng `CreatedAt DESC, IssuedOrder DESC`; vẫn bảo vệ phiên đang tạo và giới hạn 10 phiên hoạt động theo từng user. UUID session, token và API response giữ nguyên cấu trúc. Thứ tự chính xác trước nâng cấp giữa những phiên có cùng timestamp không thể suy ngược; các phiên phát hành sau nâng cấp có thứ tự xác định.

Migration 6 thêm các cột `InvalidAfter` được tính từ expiry/revoke/use cùng index cho ba bảng session/reset/verify. Migrations 1–5 giữ nguyên; migration 6 đã được áp dụng trên audit trước khi thêm migration 7 nên cũng giữ nguyên checksum. Cả audit và database thường đã nâng cấp v7.

## Kết quả kiểm chứng

| Kiểm tra | Kết quả |
|---|---:|
| Typecheck toàn workspace, unit test và build | Pass; 35/35 unit |
| SQL/auth regressions riêng | 13/13 |
| Nghiệp vụ commerce hiện có với SQL thật | 19/19 |
| E2E trình duyệt hiện có | 7/7; không skip/flaky |
| Startup worker trên audit và database thường | Cả hai mode hoàn tất thành công |
| CLI | Dry-run Secure/Baseline và apply audit đã chạy thành công |

13 bài SQL kiểm tra migration chạy lại không thay đổi, runtime SQL permissions, dry-run không ghi dữ liệu, khóa cùng database/không khóa twin kia, rollback toàn lô, giới hạn lô, thứ tự xóa theo foreign key, retention, session/token còn hiệu lực, refresh đồng thời với nhiều cleanup runner, replay của token rotate đã thu hồi từ lâu, và 12 phiên có cùng timestamp chỉ giữ đúng 10 phiên cuối. Các fixture chỉ dùng `BookGuardAuditBaseline`/`BookGuardAuditSecure`, từ chối API thường và xóa dữ liệu của tài khoản fixture khi xong.

Bộ commerce ban đầu phát hiện lỗi thứ tự session; chạy lại sau migration 7 đã pass 19/19, bao gồm 24 đăng nhập đồng thời qua hai tài khoản và quyền SQL hạn chế của Secure. Helper E2E đăng nhập admin cũng được sửa để chờ đúng màn admin, không nhầm sang menu của khách khi lazy route đang chuyển.

Lượt dọn đầu trên database thường:

| Mode | Session | Refresh token | Reset mật khẩu | Xác minh email | Thời gian |
|---|---:|---:|---:|---:|---:|
| Baseline | 16 | 0 | 1 | 0 | 70 ms |
| Secure | 70 | 3 | 2 | 5 | 79 ms |
| Tổng | **86** | **3** | **3** | **5** | |

Đối chiếu SHA-256 trước/sau xác nhận 11 session Secure còn hoạt động, toàn bộ refresh token của session đang hoạt động, token reset/verify còn dùng được và hai bảng audit nguyên vẹn. Baseline lúc chụp không có session còn hiệu lực. Sau dọn, số bản ghi đủ điều kiện còn lại bằng 0 ở cả hai database. Sách/đơn hàng cũng khớp fingerprint: Baseline 36 sách/61 đơn; Secure 36 sách/73 đơn.

Đây là kết quả local và các fixture SQL cụ thể, chưa là chứng cứ vận hành dài ngày hoặc benchmark trên bảng hàng triệu bản ghi. Các bản ghi đã dọn là dữ liệu quá thời gian lưu giữ; không tự shrink file database.

## Cấu hình và vận hành

Các biến đã thêm vào `.env.example` và truyền qua compose cho cả hai API:

```dotenv
AUTH_CLEANUP_ENABLED=true
AUTH_CLEANUP_INTERVAL_MINUTES=60
AUTH_CLEANUP_RETENTION_DAYS=7
AUTH_CLEANUP_BATCH_SIZE=500
AUTH_CLEANUP_MAX_BATCHES=10
```

Giới hạn hợp lệ: interval 1–1440 phút; retention 1–365 ngày; batch 1–1000; max batches 1–50. `AUTH_CLEANUP_ENABLED=false` tắt worker; lệnh thủ công `--apply` là thao tác riêng được yêu cầu rõ ràng. Compose cần recreate API sau khi đổi cấu hình.

```powershell
# Xem trước; mặc định không xóa.
npm run auth:cleanup
npm run auth:cleanup -- --baseline --dry-run

# Chạy thủ công sau khi xem trước.
npm run auth:cleanup -- --apply

# Công cụ/test audit: cần API bật compose audit và schema v7.
npm run auth:cleanup -- --audit --dry-run
npm run test:auth-maintenance
```

CLI cần API đã build. Với bản triển khai v5/v6, chạy build API, sau đó `node --env-file=.env scripts/migrate-auth-maintenance.mjs` trước khi khởi động API mới; thêm `--audit` cho database audit. Script migration chỉ xử lý các database đã tồn tại ở v5–v7, không provision/reset/seed và kiểm tra checksum cũ.

Theo dõi `auth_cleanup_completed` và `auth_cleanup_failed` trong log API; kiểm tra `backlogPossible` nếu dữ liệu tồn đọng nhiều. Log lỗi không tự xóa audit hoặc làm API ngừng phục vụ.

Các artifact local, được gitignore và chỉ lưu số lượng/fingerprint:

- `reports/auth-maintenance/sql-regressions.json`: 13 bài SQL/auth.
- `runtime-audit.json`, `runtime-regular.json`: kết quả worker khởi động.
- `auth-before.json`, `auth-after.json`: session/token còn hiệu lực và audit log.
- `business-before.json`, `business-after.json`: sách/đơn hàng.
- `reports/generated/commerce-regressions.json`, `playwright-results.json`: nghiệp vụ và E2E hiện có.
