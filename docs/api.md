# API chính

Mọi response thành công có dạng `{ "data": ... }`. Response lỗi có `error.code`, `error.message` và `error.requestId`.

## Công khai

- `GET /api/health`
- `GET /api/books`
- `GET /api/books/categories`
- `GET /api/books/:slug`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh` (Secure; dùng refresh cookie và CSRF token)
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

`GET /api/books` nhận `q`, `category`, `sort`, `page` và `limit`; response trả thêm `meta.page`, `meta.limit` và `meta.total` để frontend phân trang phía server.
`GET /api/health` trả thêm `schemaVersion` lấy từ `SchemaMigrations`, giúp kiểm tra
container API đã chạy đúng phiên bản database trước khi test.

## Khách hàng đã đăng nhập

- `GET /api/auth/me`
- `GET /api/auth/csrf`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `POST /api/auth/change-password`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/:sessionId`
- `PATCH /api/profile`
- `POST /api/profile/avatar`
- `GET /api/profile/wishlist`
- `PUT /api/profile/wishlist/:bookId`
- `DELETE /api/profile/wishlist/:bookId`
- `POST /api/books/:bookId/reviews`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:orderId`
- `PATCH /api/orders/:orderId/cancel`

## Quản trị viên

- `GET /api/admin/dashboard`
- `GET /api/admin/inventory`
- `POST /api/admin/books/:bookId/stock-adjustments`
- `GET /api/admin/experiments`
- `POST /api/admin/experiments/sync`
- `GET /api/admin/users`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:orderId`
- `GET /api/admin/books`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:categoryId`
- `DELETE /api/admin/categories/:categoryId`
- `PATCH /api/admin/orders/:orderId/status`
- `POST /api/admin/books`
- `PUT /api/admin/books/:bookId`
- `DELETE /api/admin/books/:bookId`
- `PATCH /api/admin/books/:bookId/publication`
- `POST /api/admin/books/:bookId/cover` với multipart field `cover`
- `PATCH /api/admin/users/:userId/status`
- `GET /api/admin/security-report`
- `GET /api/admin/security-report.csv`
- `GET /api/admin/security-events`

Ở Secure, mọi request thay đổi trạng thái sau đăng nhập phải gửi cookie phiên và header `x-csrf-token`.

`POST /api/orders` ở Secure bắt buộc header `Idempotency-Key` là UUID. Gửi lại
cùng khóa với cùng tài khoản trả về đơn cũ và header `Idempotency-Replayed: true`,
không trừ kho hoặc tạo đơn lần hai. Chi tiết đơn trả thêm `statusHistory` theo thứ
tự thời gian.

Đơn hàng đi theo luồng `pending → confirmed → shipping → completed`. Chỉ đơn
`pending` hoặc `confirmed` mới có thể chuyển sang `cancelled`; hệ thống hoàn tồn
kho đúng một lần trong cùng transaction.

`POST /api/admin/books/:bookId/stock-adjustments` nhận `{ "delta": số_nguyên_khác_0,
"note": "lý do" }`. API khóa hàng sách ở mức serializable, từ chối số dư âm/vượt
giới hạn, cập nhật `Books.Stock` và ghi `InventoryMovements` trong cùng transaction.
`PUT /api/admin/books/:bookId` không cho thay đổi tồn kho trực tiếp.

`POST /api/admin/experiments/sync` chỉ đọc các tên báo cáo được hỗ trợ trong
`REPORTS_DIR`, giới hạn 2 MB/tệp, validate cấu trúc và dùng SHA-256 chống nhập
trùng. `GET /api/admin/experiments` trả summary, tối đa 100 lượt gần nhất và lượt
mới nhất theo loại/mode; trường chưa đo trả `null`, không suy diễn số liệu.

Mỗi thay đổi trạng thái đơn tạo một outbox record. Chi tiết đơn admin trả thêm
`emailNotifications` gồm trạng thái pending/processing/sent/failed và số lần thử.

Token đặt lại mật khẩu chỉ được gửi qua email, database chỉ lưu SHA-256. Token hết hạn theo `PASSWORD_RESET_TTL_MINUTES`, dùng một lần; đặt lại thành công tăng `TokenVersion` để vô hiệu hóa phiên cũ.

Token xác minh email cũng chỉ lưu SHA-256 và hết hạn theo `EMAIL_VERIFICATION_TTL_HOURS`. Mỗi lần đăng nhập tạo một bản ghi `UserSessions`; token truy cập Secure chỉ hợp lệ khi tài khoản, phiên và `TokenVersion` đều còn hiệu lực. Access token hết hạn theo `ACCESS_TOKEN_TTL_MINUTES`; refresh token xoay vòng và phiên gốc hết hạn theo `SESSION_TTL_DAYS`.
