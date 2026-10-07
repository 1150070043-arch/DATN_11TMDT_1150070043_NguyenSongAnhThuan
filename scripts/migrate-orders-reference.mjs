import fs from 'node:fs';
const file = 'apps/web/src/pages/OrdersPage.tsx';
let source = fs.readFileSync(file, 'utf8');
source = source.replace('import { ConfirmDialog }', 'import { statusColor } from "../design/Reference";\nimport { ConfirmDialog }');
const start = source.indexOf('    <div className="container py-5 orders-page">');
const end = source.indexOf('      {selected && (', start);
if (start < 0 || end < 0) throw Error('Expected order layout boundaries');
source = source.slice(0, start) + `    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        <Link to="/profile" className="text-xs text-[#7a6f64] hover:text-[#c8a94d]">← Tài khoản</Link>
        <div className="flex items-center justify-between gap-4 mt-6 mb-10"><div><div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-2">Lịch sử đơn hàng</div><h1 className="font-display text-4xl text-[#ede7dc] font-medium">Đơn hàng của tôi</h1></div><Link className="text-xs text-[#c8a94d]" to="/catalog">Tiếp tục chọn sách →</Link></div>
        {createdOrderId && <div role="status" className="bg-[#131110] border border-[#22201d] p-5 mb-6 flex justify-between text-sm"><span>Đặt hàng thành công · Đơn #{createdOrderId}</span><button onClick={() => void openOrder(createdOrderId)} className="text-[#c8a94d]">Xem đơn</button></div>}
        {error && <div role="alert" className="text-red-400 border border-red-900 p-4 mb-6">{error}</div>}
        <div className="flex flex-wrap gap-2 mb-6" aria-label="Lọc đơn hàng theo trạng thái">{filters.map(filter => <button key={filter.value} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={'px-4 py-2 rounded-sm text-xs border ' + (statusFilter === filter.value ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907]' : 'border-[#2b2520] text-[#7a6f64]')}>{filter.label} · {filter.value === 'all' ? orders.length : orders.filter(order => order.status === filter.value).length}</button>)}</div>
        <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
          {loading ? <p className="text-sm text-[#7a6f64]">Đang tải đơn hàng…</p> : visibleOrders.length === 0 ? <div className="py-12 text-center"><h2 className="font-display text-2xl text-[#ede7dc] mb-3">{orders.length === 0 ? 'Bạn chưa có đơn hàng' : 'Không có đơn ở trạng thái này'}</h2><Link className="text-sm text-[#c8a94d]" to="/catalog">Khám phá tủ sách →</Link></div> : visibleOrders.map(order => <button type="button" key={order.id} disabled={openingId === order.id} onClick={() => void openOrder(order.id)} aria-label={'Xem chi tiết đơn ' + order.id} className="reference-order-row table-row py-5 flex items-center gap-5 w-full text-left">
            <span className="w-10 h-10 rounded-sm bg-[#1c1815] border border-[#22201d] flex items-center justify-center text-[#c8a94d] font-mono text-xs font-bold shrink-0">#{order.id}</span>
            <span className="flex-1 min-w-0"><span className="block text-sm text-[#ede7dc] font-medium truncate">{order.customerName}</span><span className="block text-xs text-[#7a6f64] font-mono mt-0.5">{dateTime.format(new Date(order.createdAt))}</span></span>
            <span className={'badge ' + statusColor(statusLabel[order.status]) + ' shrink-0'}>{statusLabel[order.status]}</span><span className="text-sm font-mono text-[#c8a94d] shrink-0 w-28 text-right">{currency.format(Number(order.totalAmount))}</span>
          </button>)}
        </div>
      </div>
      <div className="legacy-ui reference-dialogs">
` + source.slice(end);
source = source.replace(/    <\/div>\r?\n  \);\r?\n}\s*$/, '      </div>\n    </div>\n  );\n}\n');
fs.writeFileSync(file, source);
