# BookGuard DATN v1.5.0

## Mục tiêu

V1.5 biến các phần “vận hành và thực nghiệm” thành luồng end-to-end có dữ liệu,
không thêm biểu đồ minh họa hoặc nút không hoạt động. Secure vẫn là sản phẩm chính;
Baseline chỉ giữ các khác biệt bảo mật cần thiết cho thí nghiệm.

## Backend và SQL

- Migration có version tăng dần, tên duy nhất, SHA-256 checksum và transaction.
- `InventoryMovements` là ledger bất biến cho số dư đầu, xuất bán, hoàn kho và
  điều chỉnh thủ công; mọi nghiệp vụ cập nhật `Books.Stock` và ledger cùng lúc.
- Admin chỉ điều chỉnh kho qua endpoint chuyên biệt, phải có lý do, có khóa hàng
  serializable và giới hạn chống số dư âm/overflow.
- `OrderNotifications` triển khai transactional outbox: đơn và email được xếp hàng
  trong cùng transaction; SMTP chạy sau commit, ghi sent/failed và thử tối đa ba lần.
- `ExperimentRuns` lưu lịch sử báo cáo đã validate; content hash chặn nhập trùng,
  trường metric không có giữ `NULL` thay vì tự dựng số.

## Frontend và UX

- Tổng quan admin có line chart doanh thu, bar chart trạng thái, top sách bán và
  danh sách kho thấp; tất cả đọc từ API/SQL.
- Tab Tồn kho có KPI, tìm kiếm, điều chỉnh với số dư dự kiến và sổ biến động sticky.
- Tab Thực nghiệm có so sánh k6, tiến độ test, lịch sử lượt chạy và trạng thái rỗng
  hướng dẫn đúng lệnh cần chạy.
- Chi tiết đơn hiển thị trạng thái email. Error Boundary không lộ stack trace và
  cung cấp mã sự cố, tải lại hoặc quay về cửa hàng.
- Responsive được tinh chỉnh cho biểu đồ, toolbar, bảng cuộn, drawer và màn 320 px;
  SVG chart có nhãn truy cập được và không phụ thuộc thư viện ngoài.

## Kiểm thử

- 20 unit test kiểm tra migration, seed, state machine, ledger math, parser báo cáo,
  upload, SMTP/email escaping và token/session.
- 3 Playwright E2E: catalog mobile, khách mua–hủy–hoàn kho, admin biểu đồ–ledger–
  chuyển trạng thái–email SMTP.
- Playwright lưu JSON/HTML và trace/screenshot/video khi lỗi. Security, functional
  và k6 lưu thêm bản timestamp để dashboard giữ lịch sử nhiều lượt.
- `scripts/run-experiments.ps1` chạy trọn bộ và lấy CPU trung bình/RAM đỉnh qua
  Docker Stats. Dashboard hiển thị “Chưa đo” nếu báo cáo không có hai metric này.

## Nghiệm thu

`npm run verify` kiểm tra typecheck, unit test và production build mà không cần
Docker. Playwright runtime, SQL, SMTP, security và k6 cần stack Docker đang chạy;
xem lệnh đầy đủ trong `BAT_DAU_O_DAY.md`.
