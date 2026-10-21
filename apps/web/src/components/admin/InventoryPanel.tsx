import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useToast } from "../../context/ToastContext";
import { api, ApiError } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { AdminInventory } from "../../design/AdminReference";

type InventoryBook = {
  id: number;
  title: string;
  author: string;
  stock: number;
  categoryName: string;
  isPublished: boolean;
  lastMovementAt?: string | null;
};

type InventoryMovement = {
  id: number;
  bookId: number;
  bookTitle: string;
  movementType: "opening" | "sale" | "return" | "adjustment";
  quantityDelta: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: number | null;
  note?: string | null;
  changedByName?: string | null;
  createdAt: string;
};

type InventoryData = {
  summary: { totalTitles: number; totalUnits: number; outOfStock: number; lowStock: number };
  books: InventoryBook[];
  movements: InventoryMovement[];
};

const movementLabels: Record<InventoryMovement["movementType"], string> = {
  opening: "Số dư đầu",
  sale: "Xuất bán",
  return: "Hoàn kho",
  adjustment: "Điều chỉnh"
};

export function InventoryPanel({ onChanged, referenceLayout = false }: { onChanged: () => Promise<void>; referenceLayout?: boolean }) {
  const { notify } = useToast();
  const [data, setData] = useState<InventoryData | null>(null);
  const [selected, setSelected] = useState<InventoryBook | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api<InventoryData>("/api/admin/inventory?limit=100");
      setData(result.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải dữ liệu tồn kho.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setSelected(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selected, saving]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data?.books ?? [];
    return (data?.books ?? []).filter((book) =>
      [book.title, book.author, book.categoryName].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [data, query]);

  function openAdjustment(book: InventoryBook) {
    setSelected(book);
    setDelta("");
    setNote("");
    setError("");
  }

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    const parsedDelta = Number(delta);
    if (!Number.isInteger(parsedDelta) || parsedDelta === 0) {
      setError("Số lượng thay đổi phải là số nguyên khác 0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api(`/api/admin/books/${selected.id}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify({ delta: parsedDelta, note })
      });
      setSelected(null);
      await Promise.all([load(), onChanged()]);
      notify({ tone: "success", title: "Đã cập nhật tồn kho", message: `${selected.title}: ${parsedDelta > 0 ? "+" : ""}${parsedDelta} cuốn` });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể điều chỉnh tồn kho.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <div className="page-loading compact">Đang đọc sổ kho…</div>;
  if (!data) return <div className="alert alert-danger">{error || "Không có dữ liệu tồn kho."}</div>;

  return (
    <section className={referenceLayout ? '' : 'inventory-panel'}>
      {referenceLayout ? (
        <AdminInventory
          onSelect={id => { const book = data.books.find(item => item.id === id); if (book) openAdjustment(book); }}
          books={data.books}
          movements={data.movements}
        />
      ) : <>
      <div className="inventory-summary">
        <article><span>Đầu sách</span><strong>{data.summary.totalTitles}</strong><small>đang được theo dõi</small></article>
        <article><span>Tổng số lượng</span><strong>{data.summary.totalUnits}</strong><small>cuốn trong kho</small></article>
        <article><span>Sắp hết</span><strong>{data.summary.lowStock}</strong><small>từ 1 đến 10 cuốn</small></article>
        <article className={data.summary.outOfStock > 0 ? "is-warning" : ""}><span>Hết hàng</span><strong>{data.summary.outOfStock}</strong><small>cần nhập thêm</small></article>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="inventory-layout">
        <div>
          <div className="admin-list-toolbar inventory-toolbar">
            <label><span>Tìm trong tồn kho</span><input className="form-control" type="search" value={query} placeholder="Tên sách, tác giả hoặc thể loại" onChange={(event) => setQuery(event.target.value)} /></label>
            <strong>{visibleBooks.length} đầu sách</strong>
          </div>
          <div className="content-card p-0 overflow-hidden">
            <div className="table-responsive">
              <table className="table align-middle mb-0 admin-table inventory-table">
                <thead><tr><th>Đầu sách</th><th>Thể loại</th><th className="text-end">Tồn</th><th>Cập nhật cuối</th><th /></tr></thead>
                <tbody>{visibleBooks.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-5 text-secondary">Không tìm thấy đầu sách phù hợp.</td></tr>
                ) : visibleBooks.map((book) => (
                  <tr key={book.id}>
                    <td><strong>{book.title}</strong><small>{book.author}</small></td>
                    <td>{book.categoryName}</td>
                    <td className="text-end"><span className={`stock-count ${book.stock <= 10 ? "is-low" : ""}`}>{book.stock}</span></td>
                    <td>{book.lastMovementAt ? dateTime.format(new Date(book.lastMovementAt)) : "Chưa có"}</td>
                    <td className="text-end"><button className="btn btn-sm btn-ink" type="button" onClick={() => openAdjustment(book)}>Điều chỉnh</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
        <aside className="movement-ledger">
          <div className="ledger-heading"><div><span className="eyebrow">Audit trail</span><h2>Sổ biến động</h2></div><button className="btn btn-sm btn-outline-dark" type="button" onClick={() => void load()}>Làm mới</button></div>
          <div className="ledger-list">
            {data.movements.length === 0 ? <p className="chart-empty">Chưa có biến động kho.</p> : data.movements.map((movement) => (
              <article key={movement.id}>
                <div className={`movement-sign ${movement.quantityDelta > 0 ? "positive" : "negative"}`}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</div>
                <div><strong>{movement.bookTitle}</strong><span>{movementLabels[movement.movementType]} · còn {movement.balanceAfter}{movement.referenceId ? ` · đơn #${movement.referenceId}` : ""}</span><small>{movement.note ?? "Không có ghi chú"} · {dateTime.format(new Date(movement.createdAt))}</small></div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      </>}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={() => !saving && setSelected(null)}
        >
          <form
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl text-slate-100 my-auto flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-adjustment-title"
            onSubmit={(event) => void saveAdjustment(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 mb-3.5 border-b border-slate-800">
              <div>
                <div className="text-[10px] tracking-wider text-amber-400 uppercase font-mono font-bold mb-0.5">
                  ⚡ Sổ biến động kho (Audit Logged)
                </div>
                <h3 id="stock-adjustment-title" className="text-xl font-bold text-white leading-snug">
                  Điều chỉnh tồn kho
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[280px]">
                    {selected.title}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    selected.stock === 0
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : selected.stock <= 10
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    Tồn: {selected.stock} cuốn
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => !saving && setSelected(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Projected Stock Preview Card */}
            {(() => {
              const parsedDelta = Number(delta) || 0;
              const projected = selected.stock + parsedDelta;
              return (
                <div className="flex items-center justify-between p-3 bg-[#090d16] border border-slate-800/80 rounded-xl mb-3.5">
                  <div>
                    <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">Tồn hiện tại</span>
                    <span className="font-mono text-xl font-bold text-slate-200">{selected.stock}</span>
                    <span className="text-[10px] text-slate-500 font-mono ml-1">cuốn</span>
                  </div>

                  <div className="text-slate-600 font-mono font-bold text-lg select-none px-2">→</div>

                  <div className="text-right">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-0.5">Dự kiến sau chỉnh</span>
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className={`font-mono text-xl font-bold ${
                        projected < 0 ? 'text-rose-400' : parsedDelta > 0 ? 'text-emerald-400' : parsedDelta < 0 ? 'text-amber-400' : 'text-slate-200'
                      }`}>
                        {projected < 0 ? `Âm kho (${projected})` : `${projected} cuốn`}
                      </span>
                      {parsedDelta !== 0 && (
                        <span className={`text-xs font-mono font-bold ${parsedDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({parsedDelta > 0 ? `+${parsedDelta}` : parsedDelta})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Delta Input + Quick Chips */}
            <div className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="stock-delta" className="text-xs text-slate-300 font-mono uppercase tracking-wider">
                  Số lượng thay đổi <span className="text-amber-400">*</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">Dương: Nhập (+) · Âm: Xuất (−)</span>
              </div>
              <input
                id="stock-delta"
                type="number"
                step="1"
                required
                autoFocus
                value={delta}
                placeholder="Ví dụ: 10 hoặc -3"
                onChange={(event) => setDelta(event.target.value)}
                className="w-full px-3.5 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-amber-400 font-mono font-bold text-base focus:outline-none focus:border-amber-400 placeholder-slate-600"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {[5, 10, 20, 50].map((n) => (
                  <button
                    key={`+${n}`}
                    type="button"
                    onClick={() => setDelta(String((Number(delta) || 0) + n))}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    +{n}
                  </button>
                ))}
                {[-1, -5, -10].map((n) => (
                  <button
                    key={`${n}`}
                    type="button"
                    onClick={() => setDelta(String((Number(delta) || 0) + n))}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDelta("")}
                  className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 transition-colors cursor-pointer ml-auto"
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Note (Audit Reason) + Quick Reason Presets */}
            <div className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="stock-note" className="text-xs text-slate-300 font-mono uppercase tracking-wider">
                  Lý do & Căn cứ kiểm toán <span className="text-amber-400">*</span>
                </label>
              </div>
              <textarea
                id="stock-note"
                minLength={4}
                maxLength={500}
                rows={2}
                required
                value={note}
                placeholder="Ví dụ: Nhập bổ sung từ NXB, kiểm kê kho định kỳ..."
                onChange={(event) => setNote(event.target.value)}
                className="w-full px-3.5 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400 placeholder-slate-600"
              />
              {/* Quick reason presets */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {[
                  "Nhập hàng từ NXB",
                  "Kiểm kê định kỳ",
                  "Xuất mẫu trưng bày",
                  "Hàng lỗi / đổi trả",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setNote(reason)}
                    className="px-2 py-0.5 rounded text-[10px] font-sans text-slate-400 bg-slate-900/80 border border-slate-800 hover:text-amber-300 hover:border-amber-400/40 transition-colors cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span>Hành động được lưu vết bất biến vào Sổ kiểm toán kho.</span>
              </div>
            </div>

            {error && (
              <div role="alert" className="border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs px-3.5 py-2 rounded-lg mb-3 font-mono">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => !saving && setSelected(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={saving || !delta || Number(delta) === 0}
                className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? "Đang ghi sổ…" : "Xác nhận điều chỉnh"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
