# Mục 5 — Thanh toán, 12/10/2026

## Thay đổi

Đã bổ sung đối soát VNPay khi mất IPN, sửa trạng thái hoàn tiền của đơn có nhiều khoản thu, và cải thiện giao diện quản trị. Bản mới đã build và chạy trên Docker local; không thêm migration, schema vẫn v7. Không sửa `.env` hoặc reset database thường.

### Khôi phục kết quả khi mất IPN

Admin có thể mở **Đơn hàng → Đối soát thanh toán & email đơn hàng → Giao dịch chưa xác nhận** để truy vấn VNPay. Danh sách gồm tối đa 50 attempt pending/failed trong 14 ngày gần nhất, kể cả đơn đã hủy để phát hiện khoản thu đến muộn. Đây là truy vấn chủ động của admin; chưa có worker tự truy vấn định kỳ.

Endpoint mới `POST /api/admin/payment-reconciliation/:attemptId/query` dùng `querydr`, lấy merchant/reference/date/amount từ cấu hình và attempt đã lưu. Ký request HMAC SHA-512 theo thứ tự trường của VNPay; kiểm tra chữ ký response, merchant, mã giao dịch và số tiền trước khi áp dụng kết quả. `vnp_ResponseCode=00` chỉ xác nhận truy vấn thành công; thanh toán chỉ được ghi nhận khi loại giao dịch và trạng thái thanh toán phù hợp.

IPN và truy vấn dùng chung `applyPaymentResult`: transaction SERIALIZABLE, khóa đơn trước attempt, chống ghi nhận trùng khi IPN/query chạy đồng thời. Audit áp dụng kết quả nằm trong cùng transaction với cập nhật đơn. Không giữ khóa SQL trong lúc chờ nhà cung cấp. Redirect trình duyệt tiếp tục chỉ đọc trạng thái; không dùng nội dung URL để xác nhận đã trả tiền.

Response lỗi chữ ký, sai mã, sai số tiền, timeout hoặc không xác định kết quả không thay đổi trạng thái thanh toán. Request có timeout, giới hạn response 32 KB và từ chối redirect; query endpoint phải HTTPS ngoài môi trường test loopback. Log lỗi IPN dùng mã lỗi an toàn, không in exception thô hoặc chữ ký.

### Hoàn tiền và đối soát khoản thu

Trước đây hoàn một attempt có thể khiến đơn có nhiều khoản thu thành `refunded` quá sớm. Hiện đơn giữ `refund_pending` khi còn attempt đã thu cần hoàn; chỉ thành `refunded` khi không còn khoản cần xử lý. Khoản thu mới đến sau khi hoàn xong mở lại `refund_pending`. Hoàn khoản thu trùng của đơn còn hợp lệ giữ khoản thanh toán chính và trạng thái `paid`.

Khoản thu khớp attempt nhưng lệch tổng đơn hiện tại vào đối soát, không tự xác nhận giao hàng. URL thanh toán kiểm tra giới hạn số tiền và mô tả ASCII theo hợp đồng VNPay.

**Nút “Ghi nhận đã hoàn tiền” chỉ ghi nhận khoản hoàn toàn phần đã thực hiện tại VNPay và có mã tham chiếu. Nó không gửi tiền, không gọi API refund và không xác minh mã tham chiếu với VNPay.** Admin chịu trách nhiệm kiểm tra giao dịch thật trong cổng nhà cung cấp trước khi ghi nhận. Chưa hỗ trợ hoàn một phần hoặc tự đồng bộ giao dịch đảo/hoàn từ nhà cung cấp.

### Giao diện

Phần giao dịch chưa xác nhận mặc định thu gọn. Form hoàn tiền giữ nội dung đang nhập khi truy vấn lỗi hoặc tải lại danh sách. Các thao tác khóa khi đang xử lý để tránh gửi trùng; thông báo phản ánh kết quả server. Khi truy vấn chưa bật, hiển thị hướng dẫn kiểm tra trong cổng quản trị VNPay.

## Cấu hình

Các biến mới có trong `.env.example` và được truyền vào hai API qua Compose:

```dotenv
VNPAY_QUERY_ENABLED=false
VNPAY_QUERY_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_QUERY_TIMEOUT_MS=8000
# VNPAY_QUERY_IP_ADDRESS=<public egress IP>
```

Mặc định truy vấn tắt. Chỉ bật khi merchant/key và endpoint đúng với môi trường VNPay của tài khoản; cấu hình IP phù hợp nếu nhà cung cấp yêu cầu. Timeout cho phép 1–15 giây. Giao dịch cũ thiếu URL/date/reference/merchant phù hợp bị từ chối truy vấn thay vì đoán dữ liệu.

Chưa kiểm thử giao dịch hoặc hoàn tiền trên VNPay thật trong đợt này. Để xác nhận tích hợp sandbox trước vận hành, cần chạy thanh toán của tài khoản merchant, IPN qua HTTPS truy cập được từ VNPay, truy vấn mất IPN và đối chiếu kết quả với cổng nhà cung cấp. Các test local bên dưới không thay thế bước đó.

Đối chiếu giao thức theo tài liệu chính thức: [Thanh toán VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html) và [Querydr / refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).

## Kiểm chứng

| Bộ kiểm tra | Kết quả |
|---|---|
| Typecheck toàn workspace, unit test, production build | Đạt; 49/49 unit |
| Thanh toán: API thực + SQL audit thật + HTTP provider giả lập có chữ ký | 10/10 |
| Giao diện đối soát trên Chromium, API fixture | 3/3; không có page error |
| Commerce trên hai twin audit: tồn kho, coupon, checkout đồng thời, IPN/refund/outbox, quyền SQL | 19/19 |
| E2E storefront/admin/twin isolation trên Docker audit | 7/7; không skip/flaky |
| Docker build cả hai API/web, Compose validation, diff whitespace | Đạt |
| npm audit | 0 vulnerability được báo cáo |

10 regression thanh toán kiểm tra quyền admin, mất IPN, IPN/query đồng thời, chữ ký/mã/số tiền sai, timeout và retry, failed rồi paid, nhiều khoản hoàn không phụ thuộc thứ tự, khoản thu muộn sau hoàn, giữ khoản thanh toán chính, số tiền lệch tổng đơn, không khóa SQL trong lúc chờ mạng và không ghi chữ ký vào log. Tất cả thanh toán và hoàn tiền trong test là fixture, không phát sinh giao dịch ngân hàng.

Lần typecheck đầu phát hiện functional workspace chưa nạp Express augmentation khi test mới import app thật; đã bổ sung `.d.ts`. Lần browser test đầu có selector `role=status` trùng khi vừa báo kết quả vừa tải lại; đã sửa test chọn đúng thông báo. Lần chạy cuối các bộ trên đều đạt.

Chạy lại:

```powershell
npm run verify
npm run test:payments
npm run test:payments:ux
```

`test:payments` cố định database `BookGuardAuditSecure`, tạo/xóa fixture riêng, không cần chuyển API Docker sang audit. `test:payments:ux` chạy Vite riêng port 5184 với API fixture. Commerce và E2E cần audit overlay; tuyệt đối không reset database thường để chạy test.

Artifact lưu tại `reports/payments/` (gitignore): kết quả SQL/provider, UX, commerce, E2E và fingerprint dữ liệu trước/sau. Không lưu merchant credential thật hoặc dump log thô.

## Dữ liệu và trạng thái cuối

Fingerprint trước/sau của Books/Orders, các session/token còn hiệu lực và bảng audit/security database thường khớp:

- Baseline: 36 sách / 61 đơn giữ nguyên.
- Secure: 36 sách / 73 đơn giữ nguyên.
- 11 session Secure còn hiệu lực cùng refresh token của các session sống giữ nguyên.
- Token reset/verify còn hiệu lực, SecurityEvents và AdminAuditEvents giữ nguyên.

Hai API và hai web đã trở lại database thường với image mới; SQL Server và hai Mailpit healthy. Schema v7, query VNPay tiếp tục tắt theo cấu hình hiện tại. Không chạy thanh toán thật hoặc xác nhận hoàn tiền trên dữ liệu thường.
