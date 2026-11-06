const button = document.getElementById('inspect');
const status = document.getElementById('status');
const metadata = document.getElementById('metadata');
const table = document.getElementById('fields');
const allowed = new Set(['id', 'email', 'fullname', 'phone', 'addressline', 'avatarurl', 'role', 'emailverified', 'emailverifiedat', 'createdat']);
const sensitive = /password|secret|token|credential|salt|hash/i;
button.addEventListener('click', async () => {
  table.hidden = true; table.tBodies[0].replaceChildren(); metadata.textContent = '';
  status.textContent = 'Đang kiểm tra…'; button.disabled = true;
  try {
    if (location.hostname !== 'localhost' || !['5173', '5174'].includes(location.port)) throw new Error('Chỉ chạy trang lab tại localhost:5173 hoặc localhost:5174.');
    const healthResponse = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const health = (await healthResponse.json()).data;
    const expectedMode = location.port === '5173' ? 'baseline' : 'secure';
    if (!healthResponse.ok || !health?.auditFixture || health.database !== 'connected' || health.mode !== expectedMode) throw new Error('Cần đúng API audit cho website này (auditFixture: true). Chưa thể kết luận.');
    const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.status === 401) throw new Error('HTTP 401 — đăng nhập lại khách hàng trên website này rồi thử. Chưa thể kết luận.');
    if (!response.ok) throw new Error(`HTTP ${response.status} — lỗi ngoài kịch bản, chưa thể kết luận.`);
    const body = await response.json();
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new Error('Response không phải hồ sơ hợp lệ. Chưa thể kết luận.');
    const fields = Object.keys(body.data).sort();
    if (!Number.isInteger(body.data.id ?? body.data.Id) || typeof (body.data.email ?? body.data.Email) !== 'string') throw new Error('Response thiếu ID/email hồ sơ. Chưa thể kết luận.');
    const secrets = fields.filter(field => sensitive.test(field));
    const extra = fields.filter(field => !allowed.has(field.toLowerCase()));
    for (const field of fields) {
      const row = table.tBodies[0].insertRow();
      row.insertCell().textContent = field;
      const cell = row.insertCell();
      cell.textContent = sensitive.test(field) ? 'NHẠY CẢM — không được trả về client' : allowed.has(field.toLowerCase()) ? 'Trường hồ sơ được phép trong DTO' : 'Trường nội bộ ngoài DTO';
      if (!allowed.has(field.toLowerCase())) cell.className = 'danger';
    }
    table.hidden = false;
    metadata.textContent = `${health.mode} · HTTP ${response.status} · ${fields.length} trường · ${secrets.length} trường nhạy cảm · Request ID: ${body.requestId ?? response.headers.get('x-request-id') ?? 'xem Network'}`;
    status.textContent = secrets.length ? `PHÁT HIỆN DỮ LIỆU NHẠY CẢM: ${secrets.join(', ')}. Giá trị đã được ẩn trên trang demo.`
      : extra.length ? `CẦN KIỂM TRA DTO: có ${extra.length} trường ngoài danh sách cho phép.`
        : 'DTO ĐƯỢC GIỚI HẠN — không có trường credential hoặc trường ngoài danh sách cho phép trong response đã kiểm tra.';
  } catch (error) { status.textContent = error.message || 'Không đọc được API. Kiểm tra kết nối; chưa thể kết luận.'; }
  finally { button.disabled = false; }
});
