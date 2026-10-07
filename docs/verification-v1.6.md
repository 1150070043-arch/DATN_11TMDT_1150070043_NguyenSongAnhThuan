# Biên bản kiểm tra BookGuard v1.6.0

- TypeScript API: đạt.
- TypeScript web: đạt.
- API build và 23/23 unit test: đạt.
- Web production build: đạt.
- Docker Compose YAML: hợp lệ (12 service, cấu hình không đổi từ v1.5).
- Playwright E2E: giữ nguyên 3 kịch bản của v1.5; chưa chạy browser/container trong môi trường đóng gói này.
- Docker runtime/SQL migration smoke test: cần chạy bằng Docker Desktop theo `BAT_DAU_O_DAY.md`.

Các dependency không đổi so với v1.5; bản v1.6 chỉ bổ sung code ứng dụng và migration số 3.
