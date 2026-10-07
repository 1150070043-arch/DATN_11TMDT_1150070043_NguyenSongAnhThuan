# Hệ thống thiết kế giao diện Thư An

## Định hướng

Phiên bản 1.5 tiếp tục ngôn ngữ **neo-editorial commerce**: tinh thần của một hiệu sách tuyển chọn nhưng có độ tương phản, nhịp khối và CTA mạnh như một sản phẩm thương mại hiện đại. Giao diện tránh phụ thuộc vào mẫu Bootstrap mặc định nhưng vẫn giữ Bootstrap làm lớp bố cục ổn định.

Ba nguyên tắc chính:

1. Nội dung và bìa sách là trọng tâm thị giác.
2. Thao tác mua hàng luôn rõ, có trạng thái và dùng được bằng bàn phím.
3. Baseline và Secure có cùng trải nghiệm để kết quả thực nghiệm bảo mật có thể so sánh trực tiếp.

## Design token

Các token nằm tại `apps/web/src/theme.css` và được tải sau lớp cấu trúc `styles.css`.

| Token | Giá trị | Vai trò |
|---|---:|---|
| `--ink` | `#07152f` | Nền midnight, chữ chính, hành động quan trọng |
| `--cobalt` | `#2457f5` | Điều hướng, trạng thái chọn và nhịp thương hiệu |
| `--accent` | `#ff563d` | CTA và điểm nhấn có mức ưu tiên cao |
| `--electric` | `#b8ff3d` | Điểm nhấn tương phản cho hero/mobile |
| `--leaf` | `#087f5b` | Trạng thái an toàn và phản hồi thành công |
| `--paper` | `#f7f9fd` | Nền nội dung sáng, trung tính |
| `--line` | `#dce3ef` | Viền và phân cấp bề mặt |

Heading dùng nhóm serif hệ thống; nội dung và điều khiển dùng sans-serif hệ thống. Cách này giữ được cá tính nhưng không phát sinh phụ thuộc font bên ngoài.

## Thành phần chính

- Header sticky có nhận diện thương hiệu, điều hướng theo vai trò và số lượng giỏ hàng.
- Hero dùng ba bìa sách từ API, không dùng ảnh trang trí giả.
- Bộ lọc thể loại dạng chip có `aria-pressed`; sắp xếp vẫn dùng `select` chuẩn.
- Card sách thể hiện thể loại, tồn kho, giá và trạng thái thêm vào giỏ.
- Trang chi tiết có khối mua hàng tương phản cao và thông tin dịch vụ.
- Các form, bảng dữ liệu, drawer, badge và metric card dùng cùng token.
- Trang quản trị có bộ lọc tại chỗ, drawer chi tiết và dashboard bảo mật lấy dữ liệu báo cáo thật.
- Admin chart dùng SVG có nhãn, title và số liệu kèm theo; chart không phải ảnh tĩnh và không thêm thư viện runtime.
- Tab tồn kho tách “chỉnh nội dung sách” khỏi “đổi số lượng”, hiển thị số dư dự kiến trước khi xác nhận và ledger ngay cạnh danh sách.
- Trung tâm thực nghiệm phân biệt rõ dữ liệu chưa chạy, metric chưa đo và lượt chạy chưa đạt; không dùng placeholder mang hình dáng số liệu.
- Error Boundary cấp ứng dụng giữ thông báo ngắn, không lộ stack trace, có mã sự cố và hai đường phục hồi dễ hiểu.
- Trang khôi phục mật khẩu dùng cùng bố cục xác thực và cung cấp đường dẫn Mailpit trong môi trường cục bộ.
- Toast dùng live region để xác nhận thành công/lỗi mà không làm mất ngữ cảnh.
- Hộp xác nhận tùy biến thay `window.confirm`, hỗ trợ Escape, focus ban đầu và trạng thái đang xử lý.
- Checkout có stepper; trang đơn hàng có bộ lọc, card dễ quét và timeline lấy từ lịch sử SQL thật.
- Mobile có bottom dock cho bốn thao tác dùng nhiều nhất; desktop giữ điều hướng đầy đủ trên header.

## Responsive và khả năng tiếp cận

- Breakpoint chính: 1200, 992, 768 và 576 px.
- Từ 320 px, nút thêm giỏ chuyển sang biểu tượng để không ép chiều rộng card.
- Khu vực thể loại cuộn ngang trên màn hình hẹp, không làm vỡ bố cục.
- Tab admin cuộn ngang có scroll padding; bảng dữ liệu rộng giữ vùng cuộn riêng thay vì làm tràn toàn trang.
- Dashboard bốn cột chuyển thành hai rồi một cột; biểu đồ giữ `viewBox` nên không mất nhãn ở màn hình nhỏ.
- Focus của input/select có viền màu và vùng sáng rõ.
- Chuyển động được vô hiệu hóa khi người dùng bật `prefers-reduced-motion`.
- Ảnh bìa luôn có nội dung thay thế và fallback chữ khi ảnh lỗi.
- Có skip link, live region, `alertdialog`, nhãn form và focus ring rõ trên mọi điều khiển.

## Quy ước phát triển

- Không đặt màu mới trực tiếp trong component nếu đã có token tương ứng.
- Component mới phải có loading, empty và error state nếu phụ thuộc dữ liệu.
- Nút chỉ dùng icon phải có `aria-label` mô tả hành động.
- Bìa sách bên ngoài tiếp tục ghi nguồn Open Library tại footer.
