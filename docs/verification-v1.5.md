# Biên bản kiểm tra v1.5

Ngày kiểm tra mã nguồn: 2026-09-09.

## Đã thực hiện trong môi trường build

| Cổng chất lượng | Kết quả |
|---|---|
| TypeScript API, web, functional, security, Playwright | Đạt |
| Unit test API | 20/20 đạt |
| SMTP local conversation trong unit test | Đạt |
| Production build API và Vite web | Đạt |
| `npm audit` | 0 vulnerability đã biết |
| Playwright compile và test discovery | 3 test/3 file được nhận |
| Parse `docker-compose.yml` | Hợp lệ, 12 service |

`npm run verify` là lệnh tái hiện typecheck, unit test và production build.

## Cần thực hiện trên máy có Docker Desktop

Môi trường build không có Docker Engine, SQL Server container hoặc PowerShell nên
không ghi sẵn trạng thái “đạt” cho các bước sau:

1. Chạy migration thật trên cả hai SQL Server database.
2. Chạy 3 Playwright E2E qua Chromium với website Secure.
3. Chạy 10 security case, functional runner, k6 và lấy mẫu Docker Stats.
4. Đồng bộ các báo cáo vừa sinh vào dashboard `ExperimentRuns`.

Lệnh và thứ tự đầy đủ nằm trong `BAT_DAU_O_DAY.md`. Các thư mục báo cáo trong gói
bàn giao để trống có chủ đích; chỉ số dùng trong luận án phải do máy thực nghiệm
sinh ra.
