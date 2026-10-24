# Kịch bản trình bày BookGuard — Anh Thuan

Tài liệu thao tác cho bản hiện tại. Các kết quả bên dưới là **kết quả cần quan sát**, không phải biên bản một lượt chạy đã được thực hiện. Chỉ kết luận đạt sau khi xem kết quả thực tế.

## 1. Chọn phần trình bày theo thời gian

| Thời lượng | Nội dung | Mục tiêu |
| --- | --- | --- |
| 1 phút | Giới thiệu Secure/Baseline | Một mã nguồn nghiệp vụ, hai cấu hình kiểm soát, hai database riêng |
| 3 phút | Tìm sách → chi tiết → mua ngay → đặt COD | Chứng minh sản phẩm có nghiệp vụ hoạt động |
| 2 phút | Admin xử lý đơn, sổ kho và email | Nối thao tác khách hàng với vận hành |
| 2 phút | TC07 — IDOR | Kiểm tra quyền sở hữu từng đơn hàng |
| 2 phút | TC01 — SQL Injection | Đối chiếu nối chuỗi SQL với truy vấn tham số hóa |
| 2 phút | TC02 — Stored XSS | Đối chiếu dữ liệu được lưu và cách trình duyệt hiển thị |
| 1 phút | TC06 — RBAC | Chứng minh kiểm tra quyền ở backend |
| 2–3 phút | Báo cáo 10 kịch bản và sự kiện bảo mật | Cho thấy bằng chứng có thể kiểm tra lại |
| 1 phút | Tổng kết | Nêu các lớp bảo vệ và giới hạn đã kiểm thử |

Nếu chỉ có 10 phút: giữ luồng mua hàng, TC07, TC01 và báo cáo. Nếu có 20 phút: thêm TC02, TC06 và một tình huống dự phòng ở mục 6.

## 2. Chuẩn bị trước buổi trình bày

### Địa chỉ và tài khoản

| Thành phần | Baseline | Secure |
| --- | --- | --- |
| Website | http://localhost:5173 | http://localhost:5174 |
| API | http://localhost:4001 | http://localhost:4002 |
| Hộp thư lab | http://localhost:8026 | http://localhost:8025 |

| Vai trò | Email | Mật khẩu dữ liệu mẫu |
| --- | --- | --- |
| Admin | `admin@bookguard.local` | `Admin@12345` |
| Khách A | `customer.a@bookguard.local` | `Customer@123` |
| Khách B | `customer.b@bookguard.local` | `Customer@123` |

Dùng hai browser profile riêng cho Baseline và Secure; mở sẵn DevTools → Network để xem status, request và response. Tài khoản trong bảng là tài khoản lab, không phải tài khoản cá nhân.

### Chọn dữ liệu audit cho phần khai thác

Các demo có ghi dữ liệu như XSS, CSRF, upload và mua hàng nên thực hiện trên hai database audit. Không cần reset database thường để chuẩn bị kịch bản.

Chạy từ thư mục gốc, với Docker và `.env` hiện có:

```powershell
npm run build --workspace @bookguard/api
node --env-file=.env scripts/audit-db.mjs
docker compose -f docker-compose.yml -f docker-compose.audit.yml up -d --build api-baseline api-secure web-baseline web-secure
```

Kiểm tra cả hai API trước khi bắt đầu:

```powershell
(Invoke-RestMethod http://localhost:4001/api/health).data
(Invoke-RestMethod http://localhost:4002/api/health).data
```

Phải có `auditFixture: true`, `database: connected` và đúng `mode`. Overlay dùng cùng các cổng website nhưng đổi API sang `BookGuardAuditBaseline` / `BookGuardAuditSecure`. Đăng xuất rồi đăng nhập lại sau khi đổi database; phiên của database cũ không dùng để trình bày.

Để tạo lại seed **chỉ trong audit**, thực hiện trong buổi tập khi chấp nhận bỏ dữ liệu audit cũ:

```powershell
docker compose -f docker-compose.yml -f docker-compose.audit.yml stop api-baseline api-secure
node --env-file=.env scripts/audit-db.mjs --reset
docker compose -f docker-compose.yml -f docker-compose.audit.yml up -d api-baseline api-secure web-baseline web-secure
```

Sau khi trình bày, chuyển lại database thường bằng:

```powershell
docker compose up -d api-baseline api-secure web-baseline web-secure
```

Không dùng `down -v` cho việc chuyển môi trường.

### Ghi sẵn dữ liệu cần dùng

- Một sách còn hàng, tên sách và tồn kho ban đầu.
- Một mã đơn của Khách A **trên mỗi bản**, để thử bằng Khách B. Kiểm tra đơn tồn tại và đúng chủ trước; không mặc định dùng `161`.
- Một mã đơn mới của lượt mua thử, để admin xử lý.
- Báo cáo bảo mật của lượt tập thành công, kèm thời điểm chạy. Giữ bản có timestamp để không lẫn với lượt khác.

## 3. Demo sản phẩm: chọn sách đến theo dõi đơn

### P01 — Khám phá và mua sách, khoảng 3 phút

1. Mở Secure tại http://localhost:5174 bằng Khách A.
2. Lướt banner tự chuyển slide; mở **Về chúng tôi**, rồi quay về **Sách**.
3. Lọc thể loại hoặc tìm theo tác giả. Mở một sách còn hàng.
4. Chỉ phần giới thiệu, tác giả, thể loại, ISBN và tồn kho. Bấm bìa để phóng lớn rồi đóng bằng Escape. Mỗi sách hiện có một ảnh bìa; không gọi đó là bộ ảnh trang ruột.
5. Chọn số lượng 1, bấm **Mua ngay**. Xác nhận sách có trong phần tóm tắt thanh toán. Luồng này dùng giỏ hiện tại; dọn các sản phẩm thử không muốn đặt trước buổi demo.
6. Điền thông tin nhận hàng giả của buổi demo, chọn **Trả tiền khi nhận hàng** và xác nhận đơn. Chỉ dùng mã ưu đãi đã kiểm tra còn hiệu lực; mã sai phải hiển thị lỗi, không bỏ qua điều kiện.
7. Ghi mã đơn vừa tạo. Mở **Đơn hàng** và xem trạng thái/timeline của đơn đó.

**Cần quan sát:** có một đơn đúng sản phẩm, số lượng, thành tiền và người đặt; giỏ được cập nhật; trang chi tiết đơn mở được bằng chính tài khoản đã đặt.

**Câu trình bày:** “Phần bán hàng là nghiệp vụ thật. Dữ liệu này cũng là đối tượng cần bảo vệ trong các phép thử bảo mật tiếp theo.”

### P02 — Quản trị, sổ kho và email, khoảng 2 phút

1. Đăng nhập admin trên Secure, mở **Đơn hàng**, tìm đúng mã vừa ghi.
2. Xem chi tiết rồi chuyển đơn sang bước kế tiếp hợp lệ bằng thao tác mà giao diện cho phép.
3. Mở **Tồn kho**, tìm sách vừa đặt và xem biến động có tham chiếu tới đơn. Nếu muốn minh họa nhập kho, nhập thêm 1 cuốn với lý do rõ ràng trên dữ liệu audit.
4. Mở **Nhật ký kiểm toán** để chỉ người thực hiện, thao tác và thời điểm tương ứng.
5. Mở Mailpit Secure tại http://localhost:8025, tìm email theo mã đơn. Chờ worker xử lý nếu email còn chờ gửi.

**Cần quan sát:** trạng thái khách hàng và admin khớp nhau; biến động tồn kho có nguồn; email gắn đúng đơn. Không suy ra doanh thu tăng từ một đơn chưa hoàn tất.

**Câu trình bày:** “Một thao tác nghiệp vụ có trạng thái đơn, biến động kho và dấu vết kiểm toán, giúp truy lại khi có lỗi hoặc hành vi bất thường.”

## 4. Bốn tình huống bảo mật nên thao tác trực tiếp

### TC07 — IDOR: Khách B đọc đơn của Khách A

**Chuẩn bị:** đăng nhập Khách A ở từng bản, mở một đơn của A và ghi mã riêng của từng database. Nếu dùng seed audit đồng nhất, mã có thể trùng nhau; vẫn cần kiểm tra chủ đơn.

1. Chuyển sang Khách B trong browser Baseline.
2. Mở `http://localhost:5173/confirmation/<mã-đơn-của-A-trên-Baseline>`.
3. Quan sát API `GET /api/orders/<id>` trong Network và thông tin đơn trên trang.
4. Trên Secure, cũng đăng nhập Khách B rồi mở `http://localhost:5174/confirmation/<mã-đơn-của-A-trên-Secure>`.

| Quan sát | Baseline | Secure |
| --- | --- | --- |
| Status của API chi tiết đơn | `200` | `403` |
| Nội dung đơn của A | B đọc được | Không trả cho B |

**Câu trình bày:** “Đăng nhập thành công chưa đủ. Backend còn phải kiểm tra đơn đang yêu cầu có thuộc tài khoản hiện tại hay không.”

Nếu thấy `404`, kiểm tra lại mã đơn; đó chưa phải bằng chứng chặn IDOR. Nếu thấy `401`, đăng nhập lại; đó là lỗi phiên, chưa phải phép đối chiếu quyền sở hữu.

### TC01 — SQL Injection: vượt điều kiện tìm kiếm

1. Mở `/catalog` ở hai bản. Tìm `zz_demo_khong_co_sach` để cho thấy kết quả rỗng bình thường.
2. Thay từ khóa bằng đúng payload của runner:

```text
' OR 1=1)--
```

3. Chờ tìm kiếm hoàn tất; chỉ kết quả hiển thị và request `GET /api/books?q=...` trong Network.

| Quan sát | Baseline | Secure |
| --- | --- | --- |
| HTTP | `200` | `200` |
| Kết quả tìm payload | Trả các sách do điều kiện SQL bị thay đổi | Không tìm thấy sách khớp chuỗi payload |

**Câu trình bày:** “Bản Secure truyền từ khóa dưới dạng tham số. Dấu nháy và các từ khóa SQL trở thành dữ liệu tìm kiếm, không được ghép vào câu lệnh.”

Không gọi đây là “đã đọc được toàn bộ database”: demo này chứng minh vượt điều kiện truy vấn danh mục sách.

### TC02 — Stored XSS: đánh giá sách chứa HTML có hành vi

Thực hiện trên audit và dùng payload chỉ tạo thông báo tại browser lab:

```html
Anh Thuan demo XSS <img src=x onerror="alert('DEMO TC02')">
```

1. Đăng nhập khách, mở cùng một tựa sách ở từng bản, kéo đến **Đánh giá sách**.
2. Chọn số sao, điền payload và gửi. Đóng thông báo nếu Baseline kích hoạt ngay.
3. Tải lại trang để cho thấy nội dung được lưu, không chỉ là thay đổi tạm trong DOM.
4. So sánh nội dung response chi tiết sách/review và cách hiển thị ở Secure.

| Quan sát | Baseline | Secure |
| --- | --- | --- |
| Tạo đánh giá với payload có chữ đi kèm | `201` | `201` |
| HTML nguy hiểm trong dữ liệu lưu | Còn lại | Thẻ bị loại bỏ |
| Thực thi handler trên trình duyệt | Có thể kích hoạt alert trong lab | Không thực thi |

**Câu trình bày:** “Không phải cứ tạo đánh giá thành công là có lỗ hổng. Cần xem dữ liệu nguy hiểm còn được lưu hay không và có được đưa vào ngữ cảnh HTML thực thi hay không.”

Secure có thể trả `422` nếu gửi nội dung chỉ có thẻ và sau khi làm sạch không còn chữ. Vì vậy dùng nguyên payload có phần chữ như trên để kết quả nhất quán với runner. Sau demo, rời trang có payload hoặc reset lại audit trước khi chạy một lượt đo mới.

### TC06 — Khách hàng gọi API quản trị

1. Đăng nhập bằng tài khoản khách ở cả hai bản.
2. Không chỉ thử mở `/admin`: frontend có thể chặn điều hướng trên cả hai bản. Cần gọi API trực tiếp bằng phiên khách.
3. Trong Console của trang Baseline hoặc Secure, chạy đoạn sau. Địa chỉ được chọn theo đúng cổng của trang đang mở:

```javascript
const adminApi = location.port === '5173' ? 'http://localhost:4001' : 'http://localhost:4002';
const adminResponse = await fetch(`${adminApi}/api/admin/users`, { credentials: 'include' });
const adminBody = await adminResponse.json();
console.log({ status: adminResponse.status, code: adminBody.error?.code, userCount: Array.isArray(adminBody.data) ? adminBody.data.length : undefined });
```

**Cần quan sát:** Baseline `200` và trả danh sách; Secure `403`. Người đang đăng nhập vẫn là khách hàng.

**Câu trình bày:** “Ẩn nút quản trị chỉ là giao diện. Quyền quản trị phải được xác minh lại trên từng API.”

## 5. Đưa bằng chứng lên màn hình tổng kết

Chạy lượt tập tự động **trước buổi trình bày**, vì suite sẽ chuẩn hóa dữ liệu audit và tạo dữ liệu kiểm thử:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-experiments.ps1 -Suite security
```

Lệnh hiện tại dùng audit overlay, reset audit, chạy bài bảo mật trên browser và runner API, rồi xuất sự kiện. Không có tham số `-SkipReset` trong script hiện tại. Không chạy lệnh này giữa lúc đang cần giữ các đơn demo audit vừa tạo.

Sau khi lệnh kết thúc thành công:

1. Mở `reports/generated/security-results.md` để trình bày bảng 10 kịch bản.
2. Mở `reports/generated/security-results.json` để chỉ `generatedAt`, status, evidence, request ID nếu có và thời gian đo.
3. Đăng nhập admin Secure, mở **Đối chiếu an ninh**. Kiểm tra dữ liệu trên màn hình đúng với report vừa chạy.
4. Mở **Thực nghiệm**, dùng thao tác đồng bộ báo cáo để lưu lịch sử lượt chạy, rồi kiểm tra thời điểm của lượt vừa nhập.
5. Mở **Sự kiện bảo mật**, đối chiếu request ID/thời điểm của các tình huống có ghi sự kiện. Không phải mọi kiểu tấn công đều có một mã sự kiện riêng.

Chỉ nói “10/10 đạt” khi chính báo cáo của lượt đang trình bày ghi nhận điều đó. Báo cáo API về XSS cần đi cùng kiểm tra trình duyệt để chứng minh hành vi thực thi; riêng status `201` không đủ.

## 6. Sáu tình huống kỹ thuật dự phòng: hoàn chỉnh bộ TC01–TC10

### TC03 — Request thay đổi hồ sơ thiếu CSRF token

**Thao tác:** đăng nhập khách trên audit. Gọi `PATCH /api/profile` có cookie phiên nhưng không có `x-csrf-token`. Đoạn dưới đọc lại hồ sơ rồi gửi **cùng dữ liệu** để tránh đổi tên/địa chỉ của tài khoản demo:

```javascript
const csrfApi = location.port === '5173' ? 'http://localhost:4001' : 'http://localhost:4002';
const csrfHealth = await (await fetch(`${csrfApi}/api/health`)).json();
if (!csrfHealth.data.auditFixture) throw new Error('Chỉ chạy minh họa này trên audit.');
const csrfMe = (await (await fetch(`${csrfApi}/api/auth/me`, { credentials: 'include' })).json()).data;
const csrfResponse = await fetch(`${csrfApi}/api/profile`, {
  method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ fullName: csrfMe.fullName ?? csrfMe.FullName, phone: csrfMe.phone ?? csrfMe.Phone ?? '', addressLine: csrfMe.addressLine ?? csrfMe.AddressLine ?? '' })
});
console.log({ status: csrfResponse.status, body: await csrfResponse.json() });
```

**Cần quan sát:** Baseline `200`; Secure `403` với `CSRF_REJECTED`. Đây là minh họa kiểm tra token ở backend, chưa phải một trang tấn công cross-site hoàn chỉnh. Bài browser trong `test:security:browser` còn kiểm tra form đăng nhập từ origin khác không thay thế được tài khoản Secure đang mở.

**Giải thích:** cookie được trình duyệt gửi theo request chưa chứng minh người dùng chủ động tạo thao tác đó; Secure kiểm tra origin và token cho các thao tác ghi phù hợp.

### TC04 — Sửa JWT nhưng giữ chữ ký cũ

**Cách trình bày ổn định:** dùng kết quả TC04 của runner. Runner đăng nhập khách, sửa payload JWT thành role admin và user ID khác nhưng không ký lại, sau đó gọi `/api/admin/users`.

**Cần quan sát:** Baseline `200`; Secure `401`. Chỉ ra chữ ký không còn khớp, không trình chiếu nguyên token phiên.

Nếu hội đồng muốn thao tác tay: dùng DevTools → Application/Storage → Cookies của profile lab, sao chép cookie phiên để phân tích payload tại máy, sửa payload rồi thay lại giá trị cookie tương ứng. Cookie Secure là `bg_secure_session`, Baseline là `bg_baseline_session`; giữ nguyên phần chữ ký để đúng tình huống. Không dùng website giải mã JWT bên ngoài để xử lý token phiên.

**Giải thích:** decode được payload không có nghĩa token đáng tin. Secure phải xác minh chữ ký và các điều kiện phiên. Đăng xuất/đăng nhập lại sau tình huống này trước khi demo bài khác.

### TC05 — Giới hạn thử đăng nhập sai

**Thao tác:** chọn email lab không tồn tại, duy nhất cho lượt demo, ví dụ `demo-lock-<timestamp>@bookguard.local`. Giữ nguyên email đó và thử sai mật khẩu 7 lần ở mỗi bản; xem Network.

**Cần quan sát:** Baseline vẫn trả `401`; Secure bắt đầu giới hạn sau 5 lần thất bại trong cửa sổ 15 phút, các lần sau trả `429`, mã `LOGIN_RATE_LIMITED`. Không dùng tài khoản admin/khách đang cần đăng nhập cho phần khác.

**Giải thích:** hạn chế số lần đoán mật khẩu theo IP và email làm giảm khả năng thử liên tục. Chạy bài này cuối phần tương tác. `429` từ giới hạn API chung với mã khác chưa đủ làm bằng chứng cho TC05.

### TC08 — CORS và lộ thông tin framework

Chạy trong PowerShell, không cần đăng nhập:

```powershell
foreach ($port in 4001, 4002) {
  $response = Invoke-WebRequest -UseBasicParsing "http://localhost:$port/api/health" -Headers @{ Origin = 'http://evil.example' }
  [pscustomobject]@{
    Port = $port
    Status = $response.StatusCode
    AllowOrigin = $response.Headers['Access-Control-Allow-Origin']
    PoweredBy = $response.Headers['X-Powered-By']
  }
}
```

**Cần quan sát:** cả hai có thể trả `200`. Baseline phản chiếu origin lạ và có `X-Powered-By`; Secure không cho phép origin lạ đó và ẩn header framework. Với cấu hình hiện tại, header Secure có thể ghi origin tin cậy cố định, không nhất thiết bị xóa hoàn toàn.

**Giải thích:** browser chỉ cho mã ở origin phù hợp đọc response. CORS không thay kiểm tra quyền và không ngăn một HTTP client ngoài browser gửi request.

### TC09 — DTO hồ sơ làm lộ trường nhạy cảm

Đăng nhập khách, mở response `GET /api/auth/me` trong Network hoặc chạy:

```javascript
const exposureApi = location.port === '5173' ? 'http://localhost:4001' : 'http://localhost:4002';
const exposureResponse = await fetch(`${exposureApi}/api/auth/me`, { credentials: 'include' });
const exposureBody = await exposureResponse.json();
console.log({ status: exposureResponse.status, fields: Object.keys(exposureBody.data ?? {}) });
```

**Cần quan sát:** cả hai `200`; Baseline có trường `PasswordSecret`, Secure chỉ trả các trường hồ sơ được chọn. Chỉ trình bày tên trường, không cần chiếu giá trị credential.

**Giải thích:** dữ liệu trả về cần được giới hạn bằng DTO. API thành công không có nghĩa response được phép chứa mọi cột trong database.

### TC10 — Upload tệp không phải ảnh

Thực hiện trên audit với tài khoản lab dành cho thử upload. Nội dung sau chỉ là chuỗi đánh dấu, không phải chương trình thực thi:

```javascript
const uploadApi = location.port === '5173' ? 'http://localhost:4001' : 'http://localhost:4002';
const uploadHealth = await (await fetch(`${uploadApi}/api/health`)).json();
if (!uploadHealth.data.auditFixture) throw new Error('Chỉ chạy minh họa này trên audit.');
const uploadCsrf = (await (await fetch(`${uploadApi}/api/auth/csrf`, { credentials: 'include' })).json()).data.csrfToken;
const uploadForm = new FormData();
uploadForm.append('avatar', new Blob(['MZ harmless thesis marker'], { type: 'application/x-msdownload' }), 'marker.exe');
const uploadResponse = await fetch(`${uploadApi}/api/profile/avatar`, {
  method: 'POST', credentials: 'include', headers: uploadCsrf ? { 'x-csrf-token': uploadCsrf } : {}, body: uploadForm
});
console.log({ status: uploadResponse.status, body: await uploadResponse.json() });
```

**Cần quan sát:** Baseline `201`; Secure `422` và sự kiện `UPLOAD_REJECTED`. Ở Baseline, avatar của tài khoản lab có thể bị thay thành marker; dùng lại seed audit trong buổi tập để dọn tác động này.

**Giải thích:** thuộc tính `accept` ở ô chọn file không bảo vệ API. Secure kiểm tra phần mở rộng, MIME, kích thước và định dạng nhận diện từ bytes của tệp. Không tự đặt `Content-Type` cho request `FormData`, browser cần tự tạo boundary.

## 7. Các luồng dự phòng để giới thiệu phần sản phẩm

| Tình huống | Cách trình bày | Điểm cần nhìn |
| --- | --- | --- |
| Liên hệ không cần tài khoản | `/contact` → chọn chủ đề → điền thông tin giả → xem lại → gửi | Chỉ có thông báo thành công/mã tham chiếu khi gửi được; kiểm tra thư lab đúng chủ đề |
| Đăng ký và xác minh email | Đăng ký bằng email lab mới → mở Mailpit → xác minh → đăng nhập | Liên kết xác minh có hạn dùng; trạng thái xác minh thay đổi |
| Quên mật khẩu | Gửi yêu cầu bằng tài khoản lab phụ → mở thư → đặt mật khẩu mới | Token dùng một lần; không lấy tài khoản đang dùng cho các bài chính |
| Quản lý phiên | Đăng nhập một tài khoản ở hai profile riêng → thu hồi một phiên trong hồ sơ | Request được bảo vệ ở phiên bị thu hồi không còn được chấp nhận |
| Coupon | Chọn mã có thật trong admin → áp dụng mã đúng, rồi thử mã sai | Số giảm và tổng tiền đúng; lỗi có giải thích, không tạo đơn khi chỉ đang kiểm tra mã |
| Hủy đơn và trả kho | Chọn đơn audit còn cho phép hủy → ghi tồn trước → hủy → xem sổ kho | Trả kho/lượt coupon đúng một lần; bấm lại không hoàn hai lần |
| Thanh toán | Chỉ thao tác VNPay khi môi trường sandbox đã được cấu hình và thử trước | Redirect về trang không tự chứng minh đã trả tiền; cần kết quả xác minh server |
| Hiệu năng và vận hành | Mở báo cáo đã chạy từ script và minh chứng backup/restore riêng | Thời điểm, workload, tài nguyên, giới hạn đo; không coi số cũ là benchmark hiện tại |

## 8. Các lỗi dễ làm phần demo mất thuyết phục

- Dùng mã đơn `161` khi đơn không tồn tại, hoặc đang thuộc chính người đi thử.
- So Secure đã đăng nhập với Baseline chưa đăng nhập rồi kết luận khác biệt quyền.
- Gọi `403` do thiếu CSRF là bằng chứng chặn SQL Injection, hoặc gọi `429` do giới hạn API chung là bằng chứng brute force.
- Dựa vào menu bị ẩn thay cho kiểm tra API quản trị.
- Nói Secure XSS phải luôn trả `403/422`, trong khi payload có chữ được làm sạch rồi lưu với `201`.
- Khẳng định HTTP `200` là an toàn hoặc bị khai thác mà chưa xem nội dung response.
- Chạy script chuẩn hóa dữ liệu audit giữa phần demo rồi tìm lại một đơn vừa bị reset.
- Dùng báo cáo cũ nhưng nói là số liệu vừa đo; nói “an toàn tuyệt đối” từ 10 tình huống cố định.

## 9. Lời kết có thể dùng

“BookGuard giữ cùng nghiệp vụ bán sách để đối chiếu hai cách triển khai. Qua các tình huống đã chạy, bản Secure áp dụng kiểm soát đầu vào và đầu ra, xác thực, phân quyền theo vai trò và quyền sở hữu, bảo vệ request thay đổi dữ liệu, kiểm soát upload và ghi nhận sự kiện. Kết quả là bằng chứng trong phạm vi những tình huống, dữ liệu và môi trường đã đo; chưa phải kết luận an toàn cho mọi kiểu tấn công.”
