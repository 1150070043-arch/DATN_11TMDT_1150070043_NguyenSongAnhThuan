# BE giữ kho — Thời hạn thanh toán và tự nhả kho, 12/10/2026

Đơn VNPay mới có thời hạn giữ kho cố định; hết hạn chưa thanh toán thì hủy đơn, trả tồn kho và lượt sử dụng coupon trong cùng transaction. Đã cập nhật hai API Docker tại máy local và migration schema v8 cho cả database thường lẫn database audit.

## Hành vi sau nâng cấp

| Tình huống | Kết quả |
|---|---|
| Checkout VNPay mới | Lưu `StockHoldUntil` sau 30 phút và `StockReleaseAfter` sau 35 phút, tính từ cùng thời điểm SQL. |
| Tạo lại link hoặc gửi lại checkout với cùng khóa idempotency | Giữ nguyên hạn ban đầu. Link mỗi lần tối đa 15 phút và không vượt `StockHoldUntil`; thời hạn lưu trong PaymentAttempts khớp thời hạn đã ký trong URL. |
| Đã hết 30 phút, còn trong 5 phút chờ xác nhận | Không tạo/tái sử dụng link thanh toán. IPN hợp lệ báo đã thu tiền vẫn được ghi nhận; chưa trả tồn kho. |
| Hết cả thời gian chờ, đơn pending/confirmed vẫn chưa thanh toán | Worker hủy đơn, hoàn kho/coupon một lần, ghi lịch sử và outbox thông báo. Không xử lý đơn COD, đơn đã giao, đã thu tiền hoặc đang hoàn tiền. |
| Hủy thủ công, hai worker hoặc checkout tranh chấp cùng đơn/tồn kho | Khóa SQL và kiểm tra lại trạng thái trong transaction ngăn hoàn kho hai lần, bán vượt tồn và trả lượt coupon hai lần. |
| IPN hoặc kết quả đối soát hợp lệ đến sau thời hạn nhả kho | Đơn bị hủy không được khôi phục để giao; khoản đã thu chuyển sang `refund_pending` để admin đối soát. |
| Callback sai chữ ký/sai số tiền | Không được dùng để thay đổi trạng thái hoặc kích hoạt nhả kho. |
| Worker tạm ngừng | API tạo link và xử lý kết quả thanh toán vẫn kiểm tra thời hạn; worker chạy lại sẽ xử lý các đơn đủ điều kiện còn tồn. |

Nếu dữ liệu có payment attempt đã thu/hoàn tiền hoặc attempt chưa hết hạn bất thường, worker giữ nguyên đơn để tránh giải phóng hàng khi giao dịch còn hiệu lực. Outbox được ghi cùng transaction; gửi thông báo do worker thông báo hiện có thực hiện sau khi commit.

30 phút và 5 phút là chính sách của ứng dụng, có thể cấu hình. Thời hạn URL VNPay dùng `vnp_ExpireDate` theo định dạng và múi giờ của [tài liệu VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

## Đơn cũ và vận hành

Migration bổ sung ba cột nullable và index lọc cho việc tìm đơn quá hạn; không tự đặt thời hạn hoặc hủy các đơn có trước nâng cấp. Khi chủ đơn/admin chủ động gọi API thanh toán cho đơn cũ đủ điều kiện, đơn mới được gán thời hạn. COD mới vẫn không chịu chính sách VNPay, trừ khi chủ động chuyển sang thanh toán VNPay.

`GET /api/admin/stock-holds` chỉ dành cho admin, trả tối đa 100 đơn cần theo dõi, kèm các trạng thái `legacy`, `holding`, `awaiting_confirmation`, `overdue`, thời hạn và thông tin có attempt còn hiệu lực. API đọc danh sách/chi tiết đơn cũng trả ba trường thời hạn. Chưa bổ sung màn hình FE riêng cho danh sách giữ kho.

Kiểm tra database thường ghi nhận **1 đơn VNPay cũ ở Secure có link hết hạn nhưng chưa có thời hạn giữ kho**; Baseline có 0 đơn như vậy. Đơn này được giữ nguyên và có thể rà soát qua API admin, rồi sử dụng luồng hủy/đối soát hiện có theo kết quả kiểm tra. Không coi đơn cũ này là đã được tự nhả kho.

| Biến môi trường | Mặc định | Phạm vi |
|---|---|---|
| `STOCK_HOLD_ENABLED` | `true` | Bật/tắt worker nền; tắt không bỏ kiểm tra thời hạn trong API thanh toán. |
| `STOCK_HOLD_MINUTES` | `30` | 15–1440 phút. |
| `STOCK_HOLD_GRACE_MINUTES` | `5` | 1–60 phút. |
| `STOCK_HOLD_INTERVAL_SECONDS` | `60` | 10–3600 giây. |
| `STOCK_HOLD_BATCH_SIZE` | `25` | 1–100 đơn/lần. |

Thay đổi số phút chỉ tác động thời hạn được khởi tạo sau đó; không kéo dài thời hạn đã lưu. Worker không chạy chồng trong cùng process; khóa theo đơn bảo vệ khi nhiều API cùng chạy. Khi tắt ứng dụng, worker chờ lần xử lý đang chạy hoàn tất. Việc nhả kho diễn ra theo chu kỳ/batch, có thể chậm hơn mốc 35 phút khi có backlog hoặc lỗi SQL; cần theo dõi log `stock_hold_expiry_failed` và danh sách quá hạn.

## Các thay đổi chính

- [stock-holds.ts](../apps/api/src/lib/stock-holds.ts), [stock-hold-worker.ts](../apps/api/src/lib/stock-hold-worker.ts): tạo thời hạn, kiểm tra điều kiện, nhả kho có khóa SQL và chạy nền.
- [order-reservation.ts](../apps/api/src/lib/order-reservation.ts): dùng chung logic hoàn kho/coupon cho worker, khách hủy và admin hủy.
- [orders.routes.ts](../apps/api/src/routes/orders.routes.ts), [payments.routes.ts](../apps/api/src/routes/payments.routes.ts), [payment-settlement.ts](../apps/api/src/lib/payment-settlement.ts): gắn thời hạn khi checkout, chặn kéo dài khi retry, xử lý thanh toán đến muộn.
- [vnpay.ts](../apps/api/src/lib/vnpay.ts), [payment-attempts.ts](../apps/api/src/lib/payment-attempts.ts): giới hạn và lưu đúng thời hạn link đã ký.
- [payment-operations.routes.ts](../apps/api/src/routes/payment-operations.routes.ts): API admin rà soát giữ kho.
- [migrations.ts](../apps/api/src/db/migrations.ts): migration v8; giữ nguyên các migration v1–v7.
- [migrate-stock-holds.mjs](../scripts/migrate-stock-holds.mjs): nâng cấp database đã có schema v7/v8, không reset/seed lại dữ liệu.
- [.env.example](../.env.example), [docker-compose.yml](../docker-compose.yml), [compose production](../deploy/docker-compose.prod.yml): cấu hình thời hạn và worker. Chưa triển khai production.

## Kiểm chứng

| Bộ kiểm tra | Kết quả và phạm vi |
|---|---|
| `npm run verify` | 53/53 unit test; TypeScript và build API/FE thành công. |
| `npm run test:stock-holds` | 17/17 ca trên SQL audit thật và runtime API; IPN giả lập có chữ ký. |
| `npm run test:payments` | 10/10 ca SQL/API thật với HTTP simulator đối soát VNPay. |
| `npm run test:commerce` | 19/19 ca trên hai twin audit Docker, schema v8. |
| `npm run test:e2e` | 7/7 ca trình duyệt với API Docker audit; không skip/flaky. |
| Runtime Docker local | Hai API healthy, kết nối đúng database thường, schema v8/index đúng, worker bật và không có lỗi worker trong log từ lần khởi động hiện tại. |
| Đối chiếu dữ liệu thường | Books và toàn bộ cột Orders cũ khớp fingerprint trước/sau: Baseline 36 sách/61 đơn; Secure 36 sách/73 đơn. Ba cột thời hạn mới đều NULL cho đơn hiện có. Phiên đăng nhập/token còn hiệu lực và bản ghi bảo mật/audit khớp trước/sau. |
| Kiểm tra cấu hình/diff | `docker compose config --quiet` và `git diff --check` thành công. |

17 ca giữ kho bao gồm checkout/idempotency, nhả kho đúng một lần, loại trừ đơn không đủ điều kiện, hai worker đồng thời, tranh chấp bản sách cuối/coupon, khách/admin hủy tranh chấp với worker, IPN trong thời gian chờ và đến muộn, tranh chấp IPN/đối soát với nhả kho, retry không gia hạn, chặn thanh toán quá hạn, rollback khi cập nhật tồn kho lỗi, phân quyền admin và batch/worker sử dụng SQL runtime ít quyền. Dữ liệu fixture được tạo và dọn trong database audit riêng.

Kết quả máy đọc nằm tại `reports/stock-holds/`: `sql-regressions.json`, `payment-regressions.json`, `commerce-regressions.json`, `e2e-results.json`, `runtime.json`, các snapshot `business-*` và `auth-*`. Thư mục report được gitignore. Script xác minh runtime lần này có điều kiện “chưa có đơn thường được gán thời hạn” để chứng minh giữ nguyên dữ liệu; không dùng điều kiện đó làm health check sau khi khách tạo đơn mới.

Chưa có TmnCode/HashSecret sandbox của merchant nên kiểm chứng dùng simulator theo lựa chọn của người dùng; chưa thử giao dịch ngân hàng, IPN từ VNPay thật hay hoàn tiền thật. `refund_pending` là trạng thái yêu cầu đối soát, không tự chuyển tiền hoàn cho khách. Kiểm tra worker/outbox không chứng minh email đã đến hộp thư người nhận ngoài hệ thống local.
