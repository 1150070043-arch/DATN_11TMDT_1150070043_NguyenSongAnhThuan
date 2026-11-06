const modes = ['baseline', 'secure'];
const node = id => document.getElementById(id);
async function checkEnvironment() {
  const response = await fetch('/environment', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không kiểm tra được môi trường.');
  const states = await response.json();
  for (const mode of modes) node(mode).disabled = !states.some(state => state.mode === mode && state.ready);
  node('environment').textContent = states.map(state => `${state.mode}: ${state.ready ? 'API audit sẵn sàng' : 'chưa sẵn sàng — kiểm tra Docker và auditFixture'}`).join(' · ');
  return states;
}
node('refresh').addEventListener('click', () => checkEnvironment().catch(error => { node('environment').textContent = error.message; }));
for (const mode of modes) node(mode).addEventListener('click', async () => {
  const status = node(`${mode}-status`);
  const result = node(`${mode}-result`);
  result.replaceChildren(); status.textContent = 'Đang kiểm tra…'; node(mode).disabled = true;
  try {
    const states = await checkEnvironment();
    if (!states.some(state => state.mode === mode && state.ready)) throw new Error('API audit chưa sẵn sàng. Chưa thể kết luận.');
    node(mode).disabled = true;
    let response;
    try {
      response = await fetch(`http://localhost:${mode === 'baseline' ? 4001 : 4002}/api/orders`, {
        credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000)
      });
    } catch {
      status.textContent = 'KHÔNG ĐỌC ĐƯỢC RESPONSE — kiểm tra Network/Console để xác nhận CORS, HTTP 200 và phiên đang đăng nhập. Chưa tự kết luận đạt.';
      return;
    }
    if (response.status === 401) { status.textContent = 'HTTP 401 — chưa đăng nhập hoặc phiên hết hạn. Đăng nhập lại rồi thử; chưa thể kết luận.'; return; }
    if (!response.ok) { status.textContent = `HTTP ${response.status} — lỗi ngoài kịch bản, chưa thể kết luận.`; return; }
    const body = await response.json();
    if (!Array.isArray(body.data) || body.data.length === 0 || body.data.some(order => !Number.isInteger(order.id) || !Number.isFinite(Number(order.totalAmount)))) {
      status.textContent = 'Chưa có danh sách đơn hợp lệ để chứng minh. Kiểm tra /orders và dữ liệu seed.'; return;
    }
    status.textContent = `ĐỌC ĐƯỢC LỊCH SỬ MUA HÀNG — HTTP ${response.status}; ${body.data.length} đơn. Trang khác origin đã đọc được dữ liệu.`;
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const label of ['Mã đơn', 'Tổng tiền', 'Trạng thái']) { const th = document.createElement('th'); th.textContent = label; head.append(th); }
    const rows = table.createTBody();
    for (const order of body.data) {
      const row = rows.insertRow();
      for (const value of [order.id, new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(order.totalAmount)), order.status]) row.insertCell().textContent = String(value ?? '');
    }
    result.append(table);
  } catch (error) { status.textContent = error.message || 'Lỗi ngoài kịch bản, chưa thể kết luận.'; }
  finally { await checkEnvironment().catch(() => { for (const mode of modes) node(mode).disabled = true; }); }
});
checkEnvironment().catch(() => { node('environment').textContent = 'Không kiểm tra được môi trường. Kiểm tra demo server và Docker.'; });
