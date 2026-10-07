# Kiểm chứng tách môi trường — 2026-09-19

## Đã chạy

- `npm run typecheck`: đạt, cả 5 workspace.
- `npm test`: 26 unit test đạt, gồm 3 test cấu hình cách ly mới.
- `npm run test:isolation`: 3 test cấu hình và 3 Playwright test đạt.
- `npm run test:isolation:storage`: đạt; SQL login đọc được DB của mình,
  bị từ chối đọc DB bên kia (kiểm tra lỗi quyền SQL, không chỉ lỗi mạng).
- Build Docker cho API, init jobs, web Baseline/Secure: đạt.
- `docker compose config --quiet`: đạt.
- Tắt web/API/Mailpit Baseline rồi gọi health Secure: vẫn `ok`, DB `connected`.
  Sau đó đã bật lại Baseline.
- Init từng bản chạy đúng database tương ứng, `reset: false`, không có migration
  mới cần áp dụng ở dữ liệu hiện tại.

## Dữ liệu trước/sau nâng cấp

| Database | Sách trước/sau | Đơn hàng trước/sau |
| --- | --- | --- |
| BookGuardBaseline | 36 / 36 | 61 / 61 |
| BookGuardSecure | 36 / 36 | 72 / 72 |

Không chạy reset DB, không xóa volume, không chuyển dữ liệu sang SQL Server khác.
Test phiên đăng nhập tạo và thu hồi các phiên thử nghiệm; không sửa đơn hàng.

## Phạm vi bằng chứng

Playwright kiểm tra đăng nhập đồng thời với cookie jar chung, refresh/logout độc lập,
từ chối JWT của môi trường khác; kiểm tra UI báo CHƯA ĐẠT khi mock một report thất bại.
Mock report chỉ dùng cho kiểm thử render, không ghi đè báo cáo security thật.
Storage check xác minh upload volume/network riêng, report mount read-only,
init job không nhận password DB bên kia, Baseline không nhận password SMTP thật.

Không chạy lại bộ 10 kịch bản tấn công trong lượt nâng cấp này và không chứng nhận
“chặn 10/10” cho phiên bản mới dựa trên các test cách ly.

Web Secure được kiểm thử qua Vite local trên cổng 5174; production image đã build
nhưng lúc kiểm tra cổng này đang do Vite sử dụng nên chưa khởi động được container
web-secure. Hai API và web-baseline đang chạy Docker. Cần dừng tiến trình dev trùng
cổng trước khi chuyển toàn bộ sang Docker.
