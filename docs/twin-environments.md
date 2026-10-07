# Hai môi trường phục vụ bảo vệ đồ án

Một sản phẩm, hai bản triển khai độc lập ở cấp ứng dụng và dữ liệu. Dùng chung
source code để giữ nghiệp vụ tương đương khi thực nghiệm. Không phải hai máy chủ
vật lý độc lập và không nên mô tả là “cách ly 100%”.

| Hạng mục | Secure | Baseline |
| --- | --- | --- |
| Web | http://localhost:5174 | http://localhost:5173 |
| API | http://localhost:4002 | http://localhost:4001 |
| Database | BookGuardSecure | BookGuardBaseline |
| SQL login | bookguard_secure | bookguard_baseline |
| Upload volume | secure-uploads | baseline-uploads |
| Session cookie | bg_secure_session | bg_baseline_session |
| Mailpit UI | http://localhost:8025 | http://localhost:8026 |
| SMTP local | localhost:1025 | localhost:1026 |
| Docker network | secure | baseline |
| Init job | db-init-secure | db-init-baseline |

## Chạy demo

```powershell
docker compose up -d --build
```

Hoặc chỉ bật một bản (tự bật các dependency cần thiết):

```powershell
npm run up:secure
npm run up:baseline
```

Tắt riêng một bản, không tắt SQL Server đang phục vụ bản còn lại:

```powershell
npm run stop:baseline
npm run stop:secure
```

Không dùng `docker compose down -v`: lệnh đó xóa các volume chứa dữ liệu.
Các volume SQL và upload cũ được giữ nguyên; không reset/seed đè dữ liệu khi nâng cấp.
Init chạy migration và chỉ seed khi database chưa có sách, theo cơ chế sẵn có.

## Local dev

```powershell
docker compose up -d sqlserver mailpit mailpit-baseline db-init-baseline db-init-secure
```

Chạy mỗi lệnh trong một terminal riêng:

```powershell
npm run dev:api:secure
npm run dev:web:secure
npm run dev:api:baseline
npm run dev:web:baseline
```

Không chạy cùng lúc Docker API/web và local API/web ở cùng cổng. Vite sẽ báo lỗi
nếu cổng đã dùng, không âm thầm chuyển sang cổng của bản còn lại.

`BASELINE_UPLOAD_DIR` và `SECURE_UPLOAD_DIR` chỉ đường dẫn riêng của từng bản.
Nếu `.env` cũ chỉ có `UPLOAD_DIR`, đường dẫn đó nay là thư mục gốc; API thêm
`baseline/` hoặc `secure/`. Đường dẫn tương đối tính từ `apps/api` khi dùng npm dev.
Không tự chuyển các tệp local cũ vì chưa xác định chúng thuộc database nào.
Muốn giữ thư mục cũ cho đúng một bản, đặt biến upload riêng của bản đó trỏ về
thư mục cũ; bản còn lại phải dùng thư mục khác. Docker giữ nguyên mount `/app/uploads`.

Init riêng mà không chạm database còn lại:

```powershell
npm run db:init:secure
npm run db:init:baseline
```

Baseline luôn dùng hộp thư lab riêng, không nhận tài khoản SMTP thật của Secure.
Cấu hình SMTP Secure hiện có được giữ nguyên. Mailpit Secure cũ vẫn giữ lịch sử
email cũ, kể cả thư Baseline từng gửi trước khi tách; các email mới được tách riêng.

## Kiểm chứng

```powershell
npm run test:isolation
npm run test:isolation:storage
```

Lệnh đầu kiểm tra cấu hình và phiên đăng nhập hai bản trong cùng cookie jar,
refresh, logout từng bản, từ chối token của bản kia. Cần cả hai API đang chạy.
Lệnh storage dùng chính SQL login của từng API để thử đọc chéo database (phải
bị từ chối), kiểm tra volume upload và chỉ đọc dữ liệu; cần Docker đang chạy.

Sau nâng cấp phải đăng nhập lại vì cookie và JWT issuer/audience đã đổi. Cookie
cũ không được sử dụng. Không thay đổi mật khẩu hay xóa tài khoản/đơn hàng cũ.

Màn đối chiếu dùng kết quả report thay vì nhãn PASS/10/10 cố định. Report là
bằng chứng tại thời điểm chạy, không phải chứng nhận an toàn cho mọi tấn công.
Bộ security test sẵn có có thể tạo đánh giá, upload và thay đổi profile lab;
chỉ chạy trên dữ liệu thực nghiệm phù hợp.

## Những phần chủ động dùng chung và giới hạn

- SQL Server/container/volume vẫn dùng chung để tiết kiệm RAM. Hai database và
  login riêng; dừng SQL Server sẽ ảnh hưởng cả hai. Không cung cấp SA cho API.
- Báo cáo đối chiếu dùng chung có chủ đích, mount read-only vào API. Test runner
  mới có quyền ghi; test runner nối cả hai network để thực nghiệm.
- Cookie không cách ly theo cổng: tên riêng chống ghi đè nhầm nhưng không ngăn
  mọi tấn công giữa các ứng dụng cùng hostname. Các URL localhost chỉ dùng demo
  lab. Khi chạy payload XSS độc hại, dùng browser profile riêng cho mỗi bản;
  triển khai thật cần hostname/site riêng và HTTPS, không public Baseline.
- Docker network riêng không thay thế VM/firewall độc lập; SQL vẫn nối cả hai
  network. Nghiên cứu tấn công thoát container/hạ tầng cần lab VM riêng.
- Dữ liệu ban đầu có thể cùng seed, nhưng thay đổi đơn hàng/tài khoản sau đó
  không đồng bộ qua lại. Cần chuẩn hóa dữ liệu trước khi đo hiệu năng đối chứng.
