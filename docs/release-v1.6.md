# BookGuard DATN v1.6.0

## Phạm vi nâng cấp

- Khuyến mại thật: mã giảm theo phần trăm hoặc số tiền, giá trị đơn tối thiểu, mức giảm tối đa, thời gian hiệu lực và giới hạn lượt dùng.
- Checkout áp dụng ưu đãi trong cùng transaction `SERIALIZABLE` với tạo đơn và trừ kho; lượt dùng được khóa để tránh vượt hạn mức khi có yêu cầu đồng thời.
- Migration số 3 bổ sung `Coupons`, `CouponRedemptions`, `AdminAuditEvents` và các cột đối soát giá trên `Orders`.
- Trang quản trị ưu đãi responsive, có trạng thái rỗng/lỗi/đang tải và thao tác kích hoạt hoặc tạm dừng.
- Nhật ký quản trị lưu người thao tác, hành động, đối tượng và request ID.
- Khách hàng tải hóa đơn CSV từ đơn thuộc quyền sở hữu; dữ liệu được escape để chống CSV formula injection.
- Checkout giữ idempotency key và transaction tồn kho của v1.5, đồng thời hiển thị ô mã ưu đãi dễ dùng trên mobile.

## Ghi chú dữ liệu

Migration không sửa lịch sử migration 1–2. Đơn cũ được backfill `SubtotalAmount = TotalAmount`, `DiscountAmount = 0`.
