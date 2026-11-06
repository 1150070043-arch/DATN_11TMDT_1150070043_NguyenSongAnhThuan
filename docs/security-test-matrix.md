# Ma trận kiểm thử bảo mật

| Mã | Kịch bản cố định | Tham chiếu | Điểm kiểm thử | Baseline kỳ vọng | Secure kỳ vọng |
|---|---|---|---|---|---|
| TC01 | SQL Injection | OWASP WSTG-INPV-05 | `GET /api/books?q=` | Payload làm thay đổi truy vấn | Payload được xem là chuỗi dữ liệu |
| TC02 | Stored XSS | OWASP WSTG-INPV-02 | Review sách | HTML nguy hiểm được giữ và render | HTML nguy hiểm bị loại, React render text |
| TC03 | CSRF | OWASP WSTG-SESS-05 | `PATCH /api/profile` không token | Thay đổi được dữ liệu | HTTP 403 và security log |
| TC04 | Authentication Failure | OWASP WSTG-SESS-10 | JWT bị sửa payload/chữ ký | Token bị decode và chấp nhận | Token bị verify và từ chối |
| TC05 | Brute Force | OWASP WSTG-ATHN-03 | 7 lần đăng nhập sai | Không giới hạn | HTTP 429 và security log |
| TC06 | Broken Access Control | OWASP WSTG-ATHZ-02 | Customer gọi `/api/admin/users` | Truy cập được | HTTP 403 |
| TC07 | IDOR | OWASP WSTG-ATHZ-04 | Khách đọc một đơn hàng thuộc người khác | Đọc được | HTTP 403 |
| TC08 | Misconfiguration | OWASP Top 10 A05:2021; WSTG-CLNT-07 | CORS + header trên `GET /api/orders` có đăng nhập; trang ưu đãi 5500 | Origin lạ được phản chiếu; browser trang giả đọc được lịch sử đơn | Origin lạ không đọc được body trong browser; website chính vẫn xem đơn được |
| TC09 | Data Exposure | OWASP API3:2023 | `GET /api/auth/me` khi xem hồ sơ; helper cùng origin website | Trả cả trường credential | Chỉ trả DTO hồ sơ, không credential hoặc trường nội bộ ngoài DTO |
| TC10 | Unsafe File Upload | OWASP WSTG-BUSL-08 | Upload `.exe` giả | File được nhận | HTTP 422 và security log |

## Quy tắc ghi nhận

Hướng dẫn thao tác nghiệp vụ, ảnh bằng chứng và xử lý lỗi cho TC08/TC09: [Hướng dẫn tester](huong-dan-test-tc08-tc09.md). Chạy `npm run test:security:business` để kiểm chứng hai luồng bằng Chromium trên audit. Runner HTTP của TC08 kiểm tra header và dữ liệu đơn; kết luận browser đọc được hay bị CORS chặn phải có bằng chứng từ browser. TC09 giữ tên theo đề cương; lỗi API trả dư trường được tham chiếu cụ thể theo API3:2023, không đồng nhất với mọi lỗi mật mã.

Mỗi test lưu:

- HTTP status.
- Kết luận bị chặn/khai thác được.
- Bằng chứng ngắn gọn.
- Thời gian xử lý của từng request/kịch bản theo mili-giây.
- Kết quả so sánh đạt/chưa đạt.
- Thời gian tạo báo cáo.

Kết quả trong đề cương chỉ là kỳ vọng. Bảng dùng trong luận án phải lấy từ tệp do runner sinh sau khi reset dữ liệu và chạy test.
