# Ma trận kiểm thử bảo mật

| Mã | Kịch bản cố định | Tham chiếu | Điểm kiểm thử | Baseline kỳ vọng | Secure kỳ vọng |
|---|---|---|---|---|---|
| TC01 | SQL Injection | OWASP WSTG-INPV-05 | `GET /api/books?q=` | Payload làm thay đổi truy vấn | Payload được xem là chuỗi dữ liệu |
| TC02 | Stored XSS | OWASP WSTG-INPV-02 | Review sách | HTML nguy hiểm được giữ và render | HTML nguy hiểm bị loại, React render text |
| TC03 | CSRF | OWASP WSTG-SESS-05 | `PATCH /api/profile` không token | Thay đổi được dữ liệu | HTTP 403 và security log |
| TC04 | Authentication Failure | OWASP WSTG-SESS-10 | JWT bị sửa payload/chữ ký | Token bị decode và chấp nhận | Token bị verify và từ chối |
| TC05 | Brute Force | OWASP WSTG-ATHN-03 | 7 lần đăng nhập sai | Không giới hạn | HTTP 429 và security log |
| TC06 | Broken Access Control | OWASP WSTG-ATHZ-02 | Customer gọi `/api/admin/users` | Truy cập được | HTTP 403 |
| TC07 | IDOR | OWASP WSTG-ATHZ-04 | Customer A đọc order 101 của B | Đọc được | HTTP 403 |
| TC08 | Misconfiguration | OWASP Top 10 A05:2021 | CORS + header | Origin lạ được phản chiếu, lộ framework | Origin lạ không được chấp nhận, ẩn framework |
| TC09 | Data Exposure | OWASP Top 10 A02:2021 | `GET /api/auth/me` | Trả cả trường credential | Chỉ trả DTO an toàn |
| TC10 | Unsafe File Upload | OWASP WSTG-BUSL-08 | Upload `.exe` giả | File được nhận | HTTP 422 và security log |

## Quy tắc ghi nhận

Mỗi test lưu:

- HTTP status.
- Kết luận bị chặn/khai thác được.
- Bằng chứng ngắn gọn.
- Thời gian xử lý của từng request/kịch bản theo mili-giây.
- Kết quả so sánh đạt/chưa đạt.
- Thời gian tạo báo cáo.

Kết quả trong đề cương chỉ là kỳ vọng. Bảng dùng trong luận án phải lấy từ tệp do runner sinh sau khi reset dữ liệu và chạy test.
