# Vận hành BookGuard — Secure production

Cấu hình production chạy một bản Secure sau Caddy; SQL/API/web không có cổng public. Kiểm chứng ngày 12/10/2026 dùng project Docker biệt lập, HTTPS bằng CA nội bộ, Mailpit và offsite mô phỏng local. Chưa nghiệm thu domain, SMTP, cloud backup hay VNPay thật.

## Khởi động và admin ban đầu

Tạo `.env.production` từ [.env.production.example](../.env.production.example) trên máy triển khai. Điền domain, mật khẩu SQL/runtime, hai secret độc lập, SMTP và địa chỉ gửi. File thật được gitignore và dockerignore; vẫn phải bảo vệ quyền đọc trên máy. Giữ `COMPOSE_PROJECT_NAME=bookguard-prod` ổn định để dùng đúng volumes; không dùng `.env` của lab làm production.

`MSSQL_PID` chọn edition SQL phù hợp deployment; mẫu mặc định Express. Kiểm tra giới hạn/điều kiện sử dụng trước khi chọn edition. Baseline chỉ dùng trong lab và không có trong Compose production.

Từ thư mục gốc repository:

```powershell
npm run build --workspace @bookguard/api
npm run ops:check:production
docker compose --env-file=.env.production -f deploy/docker-compose.prod.yml up -d --build
```

Preflight chỉ kiểm tra cấu hình, không gửi HTTP/SMTP/alert hoặc triển khai. Nó phát hiện secret mẫu, SQL/API/web có published port, tên DB/user/password không khớp, target provision sai, cookie/proxy sai và runtime không hợp lệ. Output cho biết alert/VNPay/offsite có cấu hình hay chưa; không in secret. Preflight đạt không chứng minh DNS/chứng chỉ/provider hoạt động.

`db-init-secure` chạy `init secure`, dùng đúng `SECURE_DB_*`, migration v1–v8 và cấp quyền runtime theo bảng. Production không seed demo/reset; catalog ban đầu rỗng và chưa có admin. Không đưa database lab có tài khoản demo ra public. Local Compose có cờ lab riêng, giữ seed/twin cho đồ án.

Điền `INITIAL_ADMIN_EMAIL` và mật khẩu riêng 16–128 ký tự gồm chữ hoa/thường, số và ký hiệu. Operator xác minh địa chỉ email khi tạo tài khoản. Chạy tác vụ một lần:

```powershell
docker compose --env-file=.env.production -f deploy/docker-compose.prod.yml run --rm --no-deps create-admin
```

Nếu đã có admin, lệnh không đổi mật khẩu/thêm admin/nâng quyền customer. Sau khi xác nhận đăng nhập được, xóa `INITIAL_ADMIN_PASSWORD` khỏi cấu hình. Đây không phải công cụ reset mật khẩu. Mã `INVALID_INITIAL_ADMIN_EMAIL`/`INVALID_INITIAL_ADMIN_PASSWORD` báo đầu vào chưa hợp lệ; `PRODUCTION_PROVISIONING_FORBIDDEN` báo reset hoặc target khác Secure.

## HTTPS, SMTP và thanh toán

Caddy quản lý HTTPS cho domain đã trỏ DNS. Chỉ proxy publish 80/443; API dùng `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS=1` và origin đúng domain. Khi thêm CDN/load balancer phải rà soát chuỗi proxy và origin. Template dùng image digest đã kiểm chứng, HSTS/security headers và lọc query/header nhạy cảm khỏi log. Trước public, thử từ mạng ngoài: DNS, chain chứng chỉ, redirect, web/API, đăng nhập và cookie Secure. CA nội bộ của diễn tập không thay chứng chỉ public.

SMTP client hỗ trợ **TLS trực tiếp**, thường cổng 465 với `SMTP_SECURE=true`. Chưa hỗ trợ STARTTLS/587; plain socket chỉ dùng cho Mailpit trong lab. User/password phải đi cùng nhau. Xác minh transport, quyền gửi và domain tại nhà cung cấp; chỉ gửi thư thử khi đã chủ động chọn người nhận. Provider chấp nhận SMTP chưa chứng minh thư đến Inbox.

Outbox ghi cùng transaction nghiệp vụ, worker gửi sau commit, có lease/retry/backoff và tối đa 10 lần thử. Đợt diễn tập này không gửi email cho người thật.

VNPay/querydr chưa bật vì chưa có merchant riêng. Compose đã truyền đủ `VNPAY_QUERY_*`. Khi có merchant, cấu hình IPN/return URL và thử sandbox thật trước nhận tiền. Xem [thanh toán](payment-upgrade-2026-10-12.md) và [giữ kho](backend-stock-holds-2026-10-12.md); `refund_pending` cần đối soát, không tự hoàn tiền.

## Backup và khôi phục

```powershell
# Hai twin local:
npm run db:backup
# Secure production, SQL nằm trong Docker, không cần publish 1433:
npm run db:backup:production
```

Mỗi job khóa `.backup.lock`, chạy `COPY_ONLY,CHECKSUM` và `RESTORE VERIFYONLY`, restore vào SQL probe UUID rồi `DBCC CHECKDB`. Job xuất `.bak` cùng uploads vào thư mục ID riêng, tính SHA-256/size bằng stream và ghi manifest trước upload. Nó không dò “thư mục mới nhất”. `.bak` tạm do job tạo trong volume SQL và probe SQL được dọn sau kiểm tra; bundle host được giữ lại.

SQL backup có transaction consistency; uploads là snapshot file đang hoạt động, không nguyên tử với SQL. Khi cần recovery point đồng bộ, chặn ghi ở ingress và tạm ngừng tác vụ ghi phù hợp. Script dùng API container đang chạy làm công cụ kết nối SQL; nếu dừng API phải giữ container/tooling khả dụng hoặc chuẩn bị container công cụ riêng. Không khẳng định snapshot DB/ảnh nhất quán ở mọi tải ghi.

`BACKUP_ROOT` phải nằm trong checkout và không trỏ symlink ra ngoài. Bảo vệ bundle bằng quyền đọc/ACL và chính sách mã hóa của host/storage vì chứa dữ liệu người dùng. Không commit backup hoặc report có dữ liệu thật.

### Offsite và retention

Chọn S3 hoặc cặp argument arrays:

```env
BACKUP_OFFSITE_S3_BUCKET=bookguard-private-backups
# Optional HTTPS endpoint:
# BACKUP_OFFSITE_S3_ENDPOINT=https://storage.example.com
```

AWS CLI và credentials do môi trường/credential provider của scheduler cung cấp. Lệnh dùng argument arrays, không nối shell hoặc in provider response. [AWS CLI hỗ trợ endpoint tùy chọn](https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html).

Với rclone cần cả upload và download:

```env
BACKUP_OFFSITE_UPLOAD_ARGS=["rclone","copy","%DIR%","remote:bookguard/%STAMP%"]
BACKUP_OFFSITE_DOWNLOAD_ARGS=["rclone","copy","remote:bookguard/%STAMP%","%DIR%"]
```

Shell string `BACKUP_OFFSITE_CMD` cũ bị từ chối; chuyển sang cặp arrays. Chạy:

```powershell
npm run db:backup:offsite:production
# Chỉ thêm prune sau khi kiểm chứng quy trình/chính sách lưu:
npm run db:backup:offsite:production -- --prune
```

Thiếu remote hoặc upload/download/checksum/restore lỗi thì job exit lỗi, không báo đạt hoặc retention. Job tải remote về, đối chiếu manifest/checksum, khôi phục SQL và kiểm tra uploads rồi mới ghi receipt `remote_verified`.

Retention chỉ chạy khi thêm `--prune`, chỉ xóa bundle cũ có receipt verified khớp manifest; giữ ít nhất hai bản verified mới nhất và bản hiện tại. Bundle chưa sync, thư mục legacy và receipt mô phỏng không được dọn. `.bak` do script cũ tạo trong SQL volume giữ nguyên để rà soát riêng. Không dùng lệnh xóa rộng. Retention remote thuộc chính sách của storage.

Diễn tập lại bundle bằng **đường dẫn chính xác**:

```powershell
npm run db:restore:drill -- backups/<id>
npm run db:restore:drill:production -- backups/production/<id>
```

Lệnh chỉ restore vào SQL probe/thư mục uploads tạm, không thay dữ liệu live. Khi khôi phục sự cố thật: chặn ghi, tải/verify bundle, restore DB sang target mới, phục hồi đúng uploads volume, provision login/user/quyền từ secret riêng, kiểm tra health/schema/nghiệp vụ rồi mới chuyển traffic. SQL backup không chứa server login hoặc file secret/certificate/proxy config; lưu chúng bằng cơ chế riêng. Toolkit không có lệnh tự ghi đè production database.

[Microsoft khuyến nghị test restore](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/back-up-and-restore-of-sql-server-databases?view=sql-server-ver17); toolkit kết hợp checksum với [DBCC CHECKDB](https://learn.microsoft.com/en-us/sql/t-sql/database-console-commands/dbcc-checkdb-transact-sql?view=sql-server-ver17).

### Scheduler và job bị ngắt

Scheduler chạy từ checkout, cùng project/env/`BACKUP_ROOT`, bằng `npm run db:backup:offsite:production`. Thu thập stdout/stderr và exit code; báo động nếu không có bản verified trong 24 giờ. Chưa cài cron/Task Scheduler trong đợt này.

Nếu process bị ngắt, xác minh không còn job chạy trước khi xóa **đúng lock file** `.backup.lock`. Không tự xóa lock chỉ dựa trên PID. Bundle chưa hoàn chỉnh được giữ để operator rà soát; retention không coi là verified.

## Alert và trạng thái vận hành

Webhook có thể để trống. Telegram cần cả token/chat ID. `deliverAlert` phân biệt `disabled`, `throttled`, `delivered`, `partial`, `failed`; `sendAlert` chỉ true khi các kênh cần gửi đã thành công. Không có provider thì không báo đã gửi.

Mỗi kênh retry lỗi mạng/HTTP 429/5xx, mặc định hai lần với timeout 8 giây/lần. Cooldown 300 giây chỉ bắt đầu sau thành công và riêng từng kênh. Có guard request đang chạy; log chỉ ghi channel/type/attempt/status hoặc mã lỗi, không URL token/provider response. Mất response sau khi provider nhận có thể dẫn tới thông báo trùng khi retry.

Integration HTTP 5xx, security critical và outbox hết retry giữ nguyên. Backup failure alert opt-in `BACKUP_SEND_ALERTS=true`; gửi alert lỗi không làm backup thành công. Khi chưa chủ động chọn kênh ngoài máy, giữ false và thử provider local.

```powershell
npm run ops:status
npm run ops:status:production
```

Output chỉ số tổng hợp: health/schema API, outbox tồn/hết retry, giữ kho quá hạn/legacy, khoản chờ đối soát và tuổi bản offsite verified. `needs_attention`/exit 2 báo backlog hoặc thiếu/stale offsite; `failed`/exit 1 báo lỗi kiểm tra. Receipt `simulated_verified` không tính là offsite thật. `healthy` không thay kiểm tra public HTTPS/provider. Cần monitor ngoài process vì API đã ngừng không thể tự gửi alert.

## Diễn tập local

```powershell
npm run verify
npm run test:operations
npm run test:operations:production
```

Script production tạo project/volumes mới, chỉ bind loopback 18083/18443, dùng CA nội bộ/Mailpit. Nó kiểm chứng startup, admin/login/cookie/CSRF, SQL ít quyền, alert local và backup/download/restore/DBCC/uploads; teardown chỉ xóa volumes của project UUID vừa tạo. Không public domain, gửi email thật, gọi VNPay thật hoặc sync cloud.
