import { currency } from "../../lib/format";

export type DashboardInsights = {
  ordersByStatus: Array<{ status: string; total: number }>;
  revenueByDay: Array<{ day: string; orders: number; revenue: number }>;
  lowStock: Array<{ id: number; title: string; stock: number; isPublished: boolean }>;
  topSelling: Array<{ bookId: number; title: string; quantity: number }>;
};

const statusLabels: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy"
};

export function AdminCharts({ insights }: { insights: DashboardInsights }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RevenueChart values={insights.revenueByDay} />
      <StatusChart values={insights.ordersByStatus} />
      <article className="bg-[#0e0c0a] border border-[#231e1a] rounded-lg p-5 shadow-sm">
        <header className="flex items-start justify-between pb-3 border-b border-[#1e1915] mb-4">
          <div>
            <span className="block text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono font-medium mb-1">Cần xử lý</span>
            <h2 className="font-display text-lg text-[#ede7dc] font-normal">Tồn kho thấp</h2>
          </div>
          <small className="text-xs font-mono text-[#8c8275]">8 đầu sách thấp nhất</small>
        </header>
        <div className="space-y-2.5">
          {insights.lowStock.map((book, index) => (
            <div className="flex items-center justify-between p-2.5 rounded bg-[#120f0d] border border-[#1e1915] text-xs" key={book.id}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-[#c8a94d]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <strong className="block text-xs font-medium text-[#ede7dc] truncate">{book.title}</strong>
                  <small className="text-[11px] text-[#8c8275]">{book.isPublished ? "Đang bán" : "Đã ẩn"}</small>
                </div>
              </div>
              <b className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${book.stock <= 10 ? "bg-rose-950/60 text-rose-300 border border-rose-700/50" : "text-[#ede7dc]"}`}>
                {book.stock}
              </b>
            </div>
          ))}
        </div>
      </article>

      <article className="bg-[#0e0c0a] border border-[#231e1a] rounded-lg p-5 shadow-sm">
        <header className="flex items-start justify-between pb-3 border-b border-[#1e1915] mb-4">
          <div>
            <span className="block text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono font-medium mb-1">Đã hoàn tất</span>
            <h2 className="font-display text-lg text-[#ede7dc] font-normal">Sách bán nổi bật</h2>
          </div>
          <small className="text-xs font-mono text-[#8c8275]">Theo số lượng</small>
        </header>
        <div className="space-y-2.5">
          {insights.topSelling.length === 0 ? (
            <p className="text-xs font-mono text-[#8c8275] py-8 text-center">Chưa có đơn hoàn tất để xếp hạng.</p>
          ) : insights.topSelling.map((book, index) => (
            <div className="flex items-center justify-between p-2.5 rounded bg-[#120f0d] border border-[#1e1915] text-xs" key={book.bookId}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-[#c8a94d]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <strong className="block text-xs font-medium text-[#ede7dc] truncate">{book.title}</strong>
                  <small className="text-[11px] text-[#8c8275]">Đơn hoàn tất</small>
                </div>
              </div>
              <b className="font-mono text-xs text-[#c8a94d] font-semibold">{book.quantity} cuốn</b>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function RevenueChart({ values }: { values: DashboardInsights["revenueByDay"] }) {
  const width = 640;
  const height = 220;
  const left = 30;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const max = Math.max(...values.map((item) => Number(item.revenue)), 1);
  const points = values.map((item, index) => {
    const x = values.length <= 1 ? width / 2 : left + (index / (values.length - 1)) * (width - left - right);
    const y = top + (1 - Number(item.revenue) / max) * (height - top - bottom);
    return { ...item, x, y };
  });

  return (
    <article className="md:col-span-2 bg-[#0e0c0a] border border-[#231e1a] rounded-lg p-5 shadow-sm">
      <header className="flex items-start justify-between pb-3 border-b border-[#1e1915] mb-4">
        <div>
          <span className="block text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono font-medium mb-1">30 ngày gần nhất</span>
          <h2 className="font-display text-lg text-[#ede7dc] font-normal">Nhịp doanh thu</h2>
        </div>
        <strong className="font-mono text-base font-bold text-[#c8a94d]">{currency.format(values.reduce((sum, item) => sum + Number(item.revenue), 0))}</strong>
      </header>
      {points.length === 0 ? <p className="text-xs font-mono text-[#8c8275] py-8 text-center">Chưa có doanh thu từ đơn hoàn tất trong giai đoạn này.</p> : (
        <svg className="w-full h-auto mt-2" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ doanh thu 30 ngày gần nhất">
          <line stroke="#231e1a" strokeDasharray="3 3" x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} />
          <polyline stroke="#c8a94d" strokeWidth="2.5" fill="none" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
          {points.map((point, index) => (
            <g key={`${point.day}-${index}`}>
              <circle cx={point.x} cy={point.y} r="4.5" fill="#c8a94d" stroke="#0b0907" strokeWidth="2"><title>{`${point.day}: ${currency.format(Number(point.revenue))}`}</title></circle>
              {(index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 4) === 0) && (
                <text x={point.x} y={height - 10} textAnchor="middle" fill="#8c8275" fontSize="11" fontFamily="DM Mono, monospace">{point.day.slice(5)}</text>
              )}
            </g>
          ))}
        </svg>
      )}
    </article>
  );
}

function StatusChart({ values }: { values: DashboardInsights["ordersByStatus"] }) {
  const maximum = Math.max(...values.map((item) => Number(item.total)), 1);
  return (
    <article className="md:col-span-2 bg-[#0e0c0a] border border-[#231e1a] rounded-lg p-5 shadow-sm">
      <header className="pb-3 border-b border-[#1e1915] mb-4">
        <span className="block text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono font-medium mb-1">Toàn bộ dữ liệu</span>
        <h2 className="font-display text-lg text-[#ede7dc] font-normal">Trạng thái đơn hàng</h2>
      </header>
      <svg className="w-full h-auto" viewBox="0 0 520 238" role="img" aria-label="Biểu đồ số đơn theo trạng thái">
        {values.map((item, index) => {
          const y = 14 + index * 44;
          const barWidth = Math.max(2, (Number(item.total) / maximum) * 260);
          return (
            <g key={item.status}>
              <text x="0" y={y + 17} fill="#b5a99b" fontSize="12" fontWeight="500">{statusLabels[item.status] ?? item.status}</text>
              <rect x="150" y={y} width="260" height="24" rx="4" fill="#16120f" stroke="#231e1a" />
              <rect x="150" y={y} width={barWidth} height="24" rx="4" fill="#c8a94d" />
              <text x="426" y={y + 17} fill="#ede7dc" fontSize="13" fontWeight="bold" fontFamily="DM Mono, monospace">{item.total}</text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}
