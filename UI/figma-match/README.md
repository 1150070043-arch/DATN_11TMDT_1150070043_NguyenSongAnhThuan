# Đối chiếu giao diện Thất Tịnh

Mở `index.html` để xem ảnh mẫu ZIP và ứng dụng cạnh nhau.

- Nguồn thiết kế: `Upgrade bookstore interface.zip` do người dùng cung cấp.
- 50 ảnh desktop/mobile trong thư mục này; ảnh cũ ngoài thư mục không bị ghi đè.
- Desktop 1440 × 900; mobile 390 × 844. Checkout desktop chụp toàn trang.
- `report.json` ghi thông số tiêu đề, lỗi runtime, request API lỗi và tràn ngang.
- 12 nhóm tiêu đề đối chiếu trùng vị trí, kích thước, font, độ đậm và màu. Đây không phải phép chứng minh mọi pixel đều giống nhau.
- Không phát hiện lỗi runtime, request API lỗi hay tràn ngang trong lần chụp hoàn tất.

## Kiểm tra chức năng

`npm test`: 23/23 đạt.

`npm run test:e2e`: 4/4 đạt, gồm tìm sách trên mobile; đặt/hủy đơn và hoàn kho; điều chỉnh/hoàn nguyên tồn kho; lưu/bỏ yêu thích và tải lại trang; truy cập các phần tài khoản.

`npm run typecheck` và build hai frontend Docker thành công.

## Khác biệt có chủ đích / giới hạn

- Giá, tác giả, số sách, tồn kho, tài khoản, đơn hàng và đánh giá lấy từ API thật, không thay database bằng số minh họa của Figma.
- Giao diện dùng bố cục và component xuất từ ZIP; CSS Bootstrap cũ chỉ còn được giới hạn trong các phần tính năng kế thừa.
- Bảy ảnh bìa gốc được lưu tại `apps/web/public/design/covers` để tránh redirect bị CSP chặn. URL ảnh Nhà Giả Kim trong ZIP trả về ảnh rỗng; không tự bịa ảnh thay thế.
- Checkout hiện chỉ có backend COD. Chuyển khoản/MoMo, bản tin email và 2FA trong mẫu chưa có backend tương ứng; giao diện thông báo rõ thay vì báo thành công giả.
- Backend địa chỉ hiện chỉ có một địa chỉ mặc định. Các trang reset/xác minh email, lịch sử đơn và công cụ mở rộng dùng cùng bảng màu/font của mẫu vì ZIP không có đủ màn tương ứng.

## Mã nguồn cần chỉnh sau này

- `apps/web/src/design/Reference.tsx`: giao diện xuất từ ZIP đã nối hành vi thật.
- `apps/web/src/design/Runtime.tsx`: router, dữ liệu và API adapters.
- `apps/web/src/design/reference.css`: hệ thống style từ ZIP.
- `apps/web/src/design/integration.css`: điều chỉnh mobile và biểu mẫu kế thừa.

Không chạy lại các script import/migration một lần để ghi đè `Reference.tsx` và làm mất phần tích hợp.
