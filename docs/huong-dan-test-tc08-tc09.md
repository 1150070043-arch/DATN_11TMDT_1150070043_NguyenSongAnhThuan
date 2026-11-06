# Hướng dẫn tester TC08 và TC09 BookGuard

Người phụ trách: **Anh Thuan**.

Tài liệu hướng dẫn thao tác trên trình duyệt thật cho hai tình huống: trang khác origin đọc lịch sử mua hàng do CORS sai (TC08), và API hồ sơ trả dư trường nhạy cảm (TC09). Kết quả trong các bảng là **kỳ vọng**. Tester ghi kết quả thực tế của từng lượt; không coi lỗi mạng, chưa đăng nhập hoặc dữ liệu rỗng là bằng chứng bảo mật.

## 1. Chuẩn bị môi trường một lần

### 1.1. Khởi động hai bản với database audit

Mở Docker Desktop, đợi Engine hoạt động. Mở PowerShell tại thư mục gốc dự án, nơi có `package.json` và `docker-compose.yml`. Dùng `.env` đã cấu hình của dự án; không gửi file này cho người khác.

Nếu máy chưa có dependencies, chạy `npm ci` trước. Chạy lần lượt các lệnh dưới đây; chỉ tiếp tục khi lệnh trước thành công:

```powershell
npm run build --workspace @bookguard/api
node --env-file=.env scripts/audit-db.mjs
docker compose -f docker-compose.yml -f docker-compose.audit.yml up -d --build api-baseline api-secure web-baseline web-secure
```

Lệnh `audit-db.mjs` tạo/nâng cấp hai database audit, không reset database thường và không xóa dữ liệu audit đã có. Hai case không cần reset hoặc sửa file `database/BookGuard.sql`.

Kiểm tra:

```powershell
(Invoke-RestMethod http://localhost:4001/api/health).data
(Invoke-RestMethod http://localhost:4002/api/health).data
```

Chỉ bắt đầu khi cả hai có `database: connected`, `auditFixture: true`, `status: ok`; `mode` lần lượt là `baseline` và `secure`.

### 1.2. Mở trang ưu đãi giả lập

Mở **PowerShell thứ hai** tại thư mục gốc, chạy:

```powershell
npm run demo:security
```

Giữ terminal này mở. Dòng thông báo phải có `http://localhost:5500`. Đây là trang giả lập do dự án cung cấp, chỉ phục vụ ở loopback. Server không ghi cookie hoặc nội dung đơn hàng ra log/file, không chuyển dữ liệu đến dịch vụ bên ngoài. Không mở file HTML bằng `file://` hoặc thay hostname thành `127.0.0.1`.

### 1.3. Địa chỉ và tài khoản

| Thành phần | Baseline | Secure |
| --- | --- | --- |
| Đăng nhập | http://localhost:5173/login | http://localhost:5174/login |
| Hồ sơ | http://localhost:5173/profile | http://localhost:5174/profile |
| Lịch sử đơn | http://localhost:5173/orders | http://localhost:5174/orders |
| Trang kiểm tra TC09 | http://localhost:5173/lab/profile-exposure.html | http://localhost:5174/lab/profile-exposure.html |
| API trực tiếp | http://localhost:4001 | http://localhost:4002 |

Tài khoản seed lab: email **`customer.a@bookguard.local`**, mật khẩu **`Customer@123`**. Đây là dữ liệu giả của môi trường nghiên cứu. Nếu đã đổi mật khẩu tài khoản audit, dùng mật khẩu hiện tại.

Trong mỗi lượt, **website và trang `localhost:5500` phải mở trong cùng browser profile** để dùng cùng cookie phiên. Có thể dùng một profile cho cả hai bản vì tên cookie đã tách biệt; hoặc hai profile riêng, nhưng mỗi profile đều phải mở trang ưu đãi riêng. Không đăng nhập ở cửa sổ thường rồi thử trang giả trong Incognito.

Sau khi đổi sang database audit, đăng xuất và đăng nhập lại ở cả hai website. Đăng nhập sau cùng nếu vừa chạy bài brute force; tài khoản bị giới hạn phải chờ hết cửa sổ giới hạn trước.

## 2. TC08 Security Misconfiguration

### 2.1. Mục tiêu và điều kiện đạt

Khách hàng đang đăng nhập, mở một trang ưu đãi không thuộc origin của BookGuard. Trang đó gọi `GET /api/orders` với `credentials: include`. Phép thử chỉ đọc lịch sử của chính khách đang đăng nhập, không đổi ID để lấy đơn người khác và không sửa trạng thái đơn.

| Quan sát | Baseline kỳ vọng | Secure kỳ vọng |
| --- | --- | --- |
| Đọc lịch sử ở website chính bằng phiên khách | HTTP 200, có đơn | HTTP 200, có đơn |
| Origin của trang giả | `http://localhost:5500` | `http://localhost:5500` |
| API `/api/orders` trên Network khi trang giả gọi | HTTP 200 | HTTP 200 |
| `Access-Control-Allow-Origin` | `http://localhost:5500` | `http://localhost:5174` theo cấu hình mặc định |
| `Access-Control-Allow-Credentials` | `true` | `true` |
| JavaScript trên trang giả đọc body | Đọc được | Bị trình duyệt chặn do origin không khớp |
| Bảng đơn hàng trên trang giả | Có mã đơn, tổng tiền, trạng thái | Không có dữ liệu đơn |

**CORS có thể chặn việc đọc response trong khi server vẫn xử lý GET và trả 200. Không yêu cầu Secure phải trả 403.** CORS được trình duyệt thực thi; gọi bằng Postman/PowerShell không thay cho phần demo browser.

### 2.2. Thao tác bên Baseline 5173

1. Trong Chrome/Edge, mở `http://localhost:5173/login`.
2. Nhập email `customer.a@bookguard.local`, mật khẩu `Customer@123`; bấm **Đăng nhập**.
3. Mở `http://localhost:5173/orders`. Xác nhận có lịch sử đơn hàng. Ghi ít nhất một mã đơn và tổng tiền để đối chiếu. Nếu không có đơn, dừng và kiểm tra đúng seed audit/tài khoản; dữ liệu rỗng chưa chứng minh rò rỉ.
4. Mở **tab mới trong cùng browser profile**, truy cập `http://localhost:5500`.
5. Đợi dòng **baseline: API audit sẵn sàng** và nút **Nhận ưu đãi qua Baseline** được bật. Nếu chưa sẵn sàng, kiểm tra Docker/health rồi bấm **Kiểm tra lại môi trường**.
6. Nhấn **F12**. Trong **Network**, bật **Preserve log**, chọn bộ lọc **Fetch/XHR**, nhập `orders` vào ô lọc. Có thể xóa các dòng Network cũ trước khi thử.
7. Bấm **Nhận ưu đãi qua Baseline** trên trang giả.
8. Quan sát dòng **ĐỌC ĐƯỢC LỊCH SỬ MUA HÀNG — HTTP 200** và bảng mã đơn, tổng tiền, trạng thái ngay trên trang ưu đãi.
9. Đối chiếu mã đơn với bước 3. Bảng này là dữ liệu API trả về thật; không phải bảng minh họa gắn cứng.
10. Chọn request `http://localhost:4001/api/orders` trong Network. Trong **Headers**, kiểm tra request `Origin: http://localhost:5500`; response có `Access-Control-Allow-Origin: http://localhost:5500` và `Access-Control-Allow-Credentials: true`.
11. Chụp màn hình địa chỉ trang giả, bảng đơn và các header liên quan. Không chụp tab Cookies hoặc toàn bộ giá trị cookie.

**Kết luận Baseline:** trang khác origin đã đọc được lịch sử mua hàng bằng phiên khách đang mở. Nguyên nhân là cấu hình cho phép origin tùy ý kèm credentials.

### 2.3. Thao tác bên Secure 5174

1. Mở `http://localhost:5174/login` trong browser profile đang dùng trang giả. Đăng nhập cùng tài khoản khách.
2. Mở `http://localhost:5174/orders`. Xác nhận lịch sử đơn hiển thị bình thường. Trong Network của website chính, xác nhận request lịch sử đơn trả **200**. Đây là bước chứng minh Secure có phiên hợp lệ và API vẫn hoạt động.
3. Quay lại tab `http://localhost:5500`. Nếu dùng profile riêng, mở trang này trong profile Secure.
4. Đợi **secure: API audit sẵn sàng**. Mở F12 → Network và Console; xóa log cũ nếu cần.
5. Bấm **Nhận ưu đãi qua Secure**.
6. Trang giả hiển thị **KHÔNG ĐỌC ĐƯỢC RESPONSE** và không có bảng dữ liệu đơn phía Secure. Thông báo cố ý yêu cầu kiểm tra Network/Console, không tự coi mọi lỗi fetch là chặn CORS thành công.
7. Trong Network, chọn request `http://localhost:4002/api/orders`. Kiểm tra response HTTP **200**, request origin `http://localhost:5500`, response `Access-Control-Allow-Origin: http://localhost:5174`.
8. Trong **Console**, kiểm tra thông báo CORS do origin được cho phép không trùng origin của trang gọi. DevTools có thể ghi `(blocked:cors)`, `net::ERR_FAILED 200 (OK)` hoặc diễn đạt tương đương; nội dung chính phải là lỗi CORS, không phải `ERR_CONNECTION_REFUSED`.
9. Chụp màn hình trang giả không có đơn và thông báo Console/header CORS. Ghi kèm bằng chứng bước 2 để loại trừ lỗi đăng nhập/API.

**Kết luận Secure:** website chính vẫn đọc được lịch sử, nhưng JavaScript trên trang khác origin không đọc được response nhờ giới hạn origin. CORS không thay thế xác thực hoặc kiểm tra quyền sở hữu.

### 2.4. Câu trình bày có thể dùng

“Khách đang đăng nhập BookGuard rồi mở trang ưu đãi giả. Ở Baseline, cấu hình CORS phản chiếu origin và cho gửi cookie, nên trang giả đọc được lịch sử mua hàng. Ở Secure, API vẫn phục vụ khách hợp lệ nhưng trình duyệt không cho trang giả đọc nội dung vì origin không được phép.”

### 2.5. Phép thử âm và trường hợp chưa kết luận

| Tình huống | Cách nhận biết | Kết luận và xử lý |
| --- | --- | --- |
| Baseline chưa đăng nhập | Trang báo HTTP 401 | Chưa chứng minh khai thác. Đăng nhập trên cùng profile rồi thử lại |
| Secure hết phiên | Website chính `/orders` hoặc API trả 401 | Chưa chứng minh CORS. Đăng nhập lại trước |
| API/server dừng | Nút bị khóa; health lỗi; Console lỗi kết nối | Chưa kết luận. Khởi động dịch vụ và kiểm tra môi trường |
| Dùng database thường | Health có `auditFixture: false` | Trang demo không bật thao tác; chuyển đúng audit |
| Không có đơn | Baseline báo chưa có danh sách đơn hợp lệ | Kiểm tra tài khoản/seed audit |
| Đăng nhập `localhost`, thử bằng `127.0.0.1` | Cookie không đi cùng request như mong muốn | Dùng đúng `http://localhost` ở mọi bước |
| HTTP 429 hoặc 5xx | Request không trả 200 | Chưa kết luận; chờ giới hạn hoặc xử lý lỗi trước |
| Secure đọc được và hiện bảng | JavaScript đọc được body ở trang giả | Không đạt; lưu header để kiểm tra WEB_ORIGIN/cấu hình đang chạy |

Hai port khác nhau là hai **origin**. Cùng scheme và hostname `http://localhost` vẫn là cùng **site**; vì vậy cookie `SameSite=Lax` không làm mất phiên trong phép thử này. Không suy rộng thành mọi website ở domain bên ngoài đều nhận được cookie với cấu hình hiện tại.

## 3. TC09 Sensitive Data Exposure

### 3.1. Mục tiêu và điều kiện đạt

Khách mở hồ sơ của chính mình. API được phép trả dữ liệu hồ sơ cần cho chức năng, nhưng không được trả mật khẩu/hash hoặc thông tin xác thực nội bộ. Không đổi user ID, không cần truy cập tài khoản người khác.

| Quan sát | Baseline kỳ vọng | Secure kỳ vọng |
| --- | --- | --- |
| Truy cập hồ sơ chính chủ | Thành công | Thành công |
| `GET /api/auth/me` | HTTP 200 | HTTP 200 |
| Trường `PasswordSecret` hoặc `passwordSecret` | Có | Không có |
| Trường khác ngoài DTO hồ sơ | Có thể có trường nội bộ do `SELECT u.*` | Chỉ các trường DTO cho phép |
| Trang kiểm tra | Báo **PHÁT HIỆN DỮ LIỆU NHẠY CẢM** | Báo **DTO ĐƯỢC GIỚI HẠN** |

DTO Secure hiện có: `id`, `email`, `fullName`, `phone`, `addressLine`, `avatarUrl`, `role`, `emailVerified`, `emailVerifiedAt`, `createdAt`. Không đánh dấu số điện thoại/địa chỉ của chính khách là lỗi chỉ vì đó là PII: đây là dữ liệu cần cho nghiệp vụ hồ sơ. Case tập trung vào trả dư trường không được phép.

### 3.2. Thao tác bên Baseline 5173

1. Mở `http://localhost:5173/login`; đăng nhập tài khoản khách như mục 1.3.
2. Mở `http://localhost:5173/profile`. Quan sát giao diện hồ sơ hiển thị tên, email, điện thoại/địa chỉ; giao diện không có nghĩa đã hiển thị mọi trường server trả về.
3. Mở F12 → **Network**, chọn **Fetch/XHR**, nhập `me` vào bộ lọc. Tải lại trang hồ sơ.
4. Chọn request có đường dẫn **`/api/auth/me`**, không chọn `/api/auth/csrf`. Kiểm tra HTTP **200**.
5. Trong **Preview/Response**, mở object `data` và tìm tên **`PasswordSecret`**. Không sao chép giá trị ra báo cáo, không chiếu nguyên response khi trình bày.
6. Để có màn hình bằng chứng không chứa giá trị credential, mở `http://localhost:5173/lab/profile-exposure.html` trong cùng profile.
7. Bấm **Kiểm tra dữ liệu API**. Trang đọc API cùng origin qua proxy của website và kiểm tra đúng database audit trước khi lấy hồ sơ.
8. Quan sát dòng **PHÁT HIỆN DỮ LIỆU NHẠY CẢM**, bảng có hàng **PasswordSecret** với phân loại **NHẠY CẢM — không được trả về client**. Các trường nội bộ ngoài DTO cũng được đánh dấu.
9. Ghi số trường, mode, HTTP status và Request ID trên trang. Chụp trang kiểm tra; trang chỉ hiển thị tên trường/phân loại, không hiển thị giá trị mật khẩu hoặc token.

**Kết luận Baseline:** backend trả dư trường nhạy cảm dù giao diện hồ sơ không dùng đến nó. Chỉ che bằng giao diện chưa ngăn được người dùng kiểm tra response.

### 3.3. Thao tác bên Secure 5174

1. Mở `http://localhost:5174/login`; đăng nhập cùng tài khoản khách.
2. Mở `http://localhost:5174/profile`. Xác nhận nghiệp vụ xem hồ sơ vẫn hoạt động.
3. Mở F12 → Network → Fetch/XHR, lọc `me`, tải lại trang. Chọn `/api/auth/me`, xác nhận HTTP **200**.
4. Mở `data` trong Preview/Response. Tìm `PasswordSecret` và `passwordSecret`: cả hai không được xuất hiện. Kiểm tra danh sách trường phù hợp DTO mục 3.1.
5. Mở `http://localhost:5174/lab/profile-exposure.html` trong cùng profile; bấm **Kiểm tra dữ liệu API**.
6. Quan sát **DTO ĐƯỢC GIỚI HẠN**, HTTP **200**, **0 trường nhạy cảm** và không có hàng ngoài DTO bị đánh dấu đỏ. Hồ sơ vẫn có ID/email hợp lệ; không phải response rỗng hoặc lỗi xác thực.
7. Chụp trang kiểm tra và ghi Request ID, so cạnh ảnh Baseline.

**Kết luận Secure:** API chỉ chọn trường cần cho hồ sơ và không đưa credential ra client. Hash mật khẩu vẫn là dữ liệu nhạy cảm, không được trả ra chỉ vì đã hash.

### 3.4. Phép thử âm

1. Mở một browser profile chưa đăng nhập, truy cập trang kiểm tra Secure và bấm kiểm tra. Phải báo **HTTP 401**, không hiện bảng và không báo DTO an toàn.
2. Nếu API trả `429`, `500`, JSON lỗi hoặc thiếu ID/email hồ sơ, ghi **Chưa kết luận**; khắc phục rồi thử lại.
3. Nếu mở trang helper bằng database thường, trang phải báo cần API audit và không tiếp tục lấy `/api/auth/me`.
4. Nếu helper hiện “Cần kiểm tra DTO”, kiểm tra các trường mới thay vì tự đánh dấu đạt. Không coi “không có đúng tên PasswordSecret” là bảo đảm mọi trường đều an toàn.

### 3.5. Câu trình bày có thể dùng

“Khách có quyền xem hồ sơ của mình, nhưng không có nghĩa API được trả nguyên bản ghi Users. Baseline dùng SELECT u.* nên lộ trường PasswordSecret. Secure chọn các trường DTO phục vụ hồ sơ; cả hai trả 200 và chức năng vẫn dùng được, nhưng Secure không đưa thông tin xác thực ra trình duyệt.”

## 4. Mẫu ghi nhận kết quả của tester

Điền ngày giờ, trình duyệt/phiên bản, commit hoặc phiên bản mã nguồn, người kiểm thử và trạng thái health. Ghi mã ảnh bằng chứng thay vì chép credential/token.

| Mã | Kiểm tra | Kỳ vọng | Thực tế | Đạt/Không đạt/Chưa kết luận | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| TC08-B | Trang giả đọc đơn Baseline | HTTP 200, bảng đơn khớp website chính, ACAO phản chiếu 5500 | | | |
| TC08-S | Trang giả đọc đơn Secure | Phiên chính hợp lệ; GET 200 nhưng JS không đọc được, Console báo CORS | | | |
| TC08-N | Baseline chưa đăng nhập | HTTP 401, không coi khai thác thành công | | | |
| TC09-B | API hồ sơ Baseline | HTTP 200, có PasswordSecret, helper không hiện giá trị | | | |
| TC09-S | API hồ sơ Secure | HTTP 200, chỉ DTO, không có credential | | | |
| TC09-N | Secure chưa đăng nhập | HTTP 401, không coi DTO an toàn | | | |

Chỉ đánh dấu cả case đạt khi Baseline thể hiện đúng điểm yếu và Secure bảo vệ được cùng nghiệp vụ trong điều kiện hợp lệ. TC08 là kiểm soát origin; TC09 là kiểm soát trường trả về; TC07 IDOR là kiểm soát quyền sở hữu tài nguyên.

## 5. Chạy kiểm thử tự động cho hai luồng

Sau khi stack audit đã hoạt động và frontend đã build lại để có trang helper:

```powershell
npx playwright install chromium
npm run test:security:business
```

Lệnh tự mở demo server 5500 nếu chưa có; nếu đã chạy `npm run demo:security` thì dùng lại. Bộ test kiểm tra bằng Chromium thật: TC08 hai bản, TC09 hai bản, Baseline thiếu phiên, Secure thiếu phiên và helper từ chối database thường. Nó xác nhận Secure TC08 thực sự có request 200/phiên hợp lệ trước khi kết luận browser chặn đọc. Test database thường dùng response health giả lập, không đổi kết nối database thật.

Kết quả: `reports/generated/security-business-results.json`; ảnh khi lỗi ở `reports/security-business/artifacts`. Không bật trace/HAR cho lượt này nếu không có quy trình che credential, vì response Baseline chứa PasswordSecret. Các report tự sinh được gitignore; không commit chúng. Report này là bằng chứng browser bổ sung, không tự nhập vào dashboard báo cáo 10 case hiện tại.

Runner 10 case vẫn dùng `npm run test:security`; TC08 đã đổi sang kiểm tra header trên API lịch sử đơn **có đăng nhập**, TC09 tiếp tục kiểm tra API hồ sơ. Runner này còn có case ghi dữ liệu và brute force; chạy theo quy trình audit riêng khi cần toàn bộ 10 case, không cần chạy để demo riêng hai bài đọc dữ liệu này.

## 6. Kết thúc buổi test

1. Đăng xuất các tài khoản lab trên website.
2. Trong terminal demo, bấm **Ctrl+C** để dừng port 5500. Đóng các tab demo và DevTools chứa response nhạy cảm.
3. Hai case không thêm/sửa đơn, hồ sơ hoặc credential; không cần reset dữ liệu để dọn. Đăng nhập có thể tạo phiên và nhật ký như nghiệp vụ bình thường.
4. Khi muốn quay lại database thường, chạy:

```powershell
docker compose up -d api-baseline api-secure web-baseline web-secure
```

5. Kiểm tra health và đăng nhập lại sau khi chuyển. Không dùng `docker compose down -v` để đổi môi trường.

## 7. Cập nhật trên máy của người kiểm thử

Bản cập nhật thêm trang demo, test và tài liệu; không đổi dependencies, schema SQL, `.env`, Docker Compose hoặc cấu hình kết nối đang có. Không sao chép `.env` từ máy người khác và không tạo lại file này khi đã có cấu hình riêng.

Trong thư mục clone hiện tại, kiểm tra rồi cập nhật:

```powershell
git status --short
git pull --ff-only origin main
```

Nếu Git báo thay đổi cục bộ xung đột hoặc branch đã phân kỳ, giữ lại các thay đổi riêng và xử lý trước khi pull tiếp; không dùng `reset --hard` hoặc `clean` để cập nhật. `.env` bị ignore nên không bị pull ghi đè; file cấu hình được Git theo dõi vẫn cần được kiểm tra nếu đã sửa riêng.

Frontend Docker cần build lại để có trang helper TC09. Dùng đúng project và các file Compose override đang sử dụng trên máy đó. Nếu dùng cấu hình mặc định của repo:

```powershell
docker compose up -d --build web-baseline web-secure
```

Lệnh trên chỉ cập nhật frontend theo stack đang dùng; không chuyển stack sang audit. Nếu đang dùng overlay riêng, giữ nguyên các tham số `-f ...` của máy đó trong lệnh build. Nếu chạy frontend bằng Vite, khởi động lại lệnh dev tương ứng. Không cần reset database, xóa Docker volume hoặc chạy lại file `BookGuard.sql` để nhận cập nhật này.

Chỉ khi bắt đầu demo TC08/TC09 mới chuẩn bị môi trường audit theo mục 1. Demo được kiểm thử với `http://localhost`, website 5173/5174, API 4001/4002 và trang giả 5500. Máy dùng hostname/port khác cần chạy môi trường lab đúng các địa chỉ này; helper cố ý từ chối địa chỉ khác thay vì tự đổi cấu hình đang có. Nếu port 5500 đang bận, dừng dịch vụ demo cũ hoặc giải phóng port trước khi chạy.

Lệnh `npm run demo:security` dùng Node hiện có và không thêm package. Chỉ cài Chromium bằng `npx playwright install chromium` nếu muốn chạy bộ test browser tự động.

## 8. Vị trí triển khai và tham khảo

- `scripts/security-demo-server.mjs`: server loopback cho trang giả, kiểm tra health hai API audit; không proxy dữ liệu đơn.
- `tests/security-demo/offers.html` và `offers.js`: browser gọi trực tiếp `/api/orders` ở API 4001/4002 bằng cookie hiện có.
- `apps/web/public/lab/profile-exposure.html` và `profile-exposure.js`: bảng tên trường trên origin website chính; giới hạn localhost 5173/5174 và audit, không thay đổi API.
- `apps/api/src/app.ts`: cấu hình CORS Baseline/Secure đã có.
- `apps/api/src/routes/auth.routes.ts`: nhánh Baseline trả `u.*`, Secure trả DTO đã có. Không thêm lỗ hổng vào bản Secure để tạo demo.
- [OWASP WSTG kiểm thử CORS](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/11-Client-side_Testing/07-Testing_Cross_Origin_Resource_Sharing/).
- [OWASP API3:2023 kiểm soát thuộc tính và dữ liệu trả dư](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/). Tên TC09 giữ theo đề cương; tham chiếu này sát với lỗi response trả dư hơn việc gán mọi trường hợp lộ dữ liệu cho lỗi mật mã.
