import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { ApiError, assetUrl } from "../lib/api";
import { currency } from "../lib/format";

export function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const { notify } = useToast();
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  async function changeQuantity(itemId: number, quantity: number) {
    setBusyItemId(itemId);
    try {
      await updateItem(itemId, quantity);
      notify({ tone: "success", title: "Đã cập nhật số lượng" });
    } catch (cause) {
      notify({ tone: "error", title: "Chưa thể cập nhật giỏ hàng", message: cause instanceof ApiError ? cause.message : "Vui lòng thử lại." });
    } finally {
      setBusyItemId(null);
    }
  }

  async function remove(itemId: number, title: string) {
    setBusyItemId(itemId);
    try {
      await removeItem(itemId);
      notify({ tone: "info", title: "Đã bỏ khỏi giỏ", message: title });
    } catch (cause) {
      notify({ tone: "error", title: "Chưa thể xóa sách", message: cause instanceof ApiError ? cause.message : "Vui lòng thử lại." });
    } finally {
      setBusyItemId(null);
    }
  }

  if (loading) return <div className="page-loading">Đang tải giỏ hàng…</div>;

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const total = Number(cart?.total ?? 0);

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#0b0907] text-[#ede7dc]">
      <section className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4 text-[#c8a94d] text-[10px] uppercase tracking-[.3em] font-mono">
            <span className="block w-8 h-px bg-[#c8a94d]" /> Giỏ hàng
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium">
            {itemCount === 0 ? "Giỏ hàng trống" : `${itemCount} sản phẩm`}
          </h1>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        {!cart || cart.items.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full border border-[#2b2520] flex items-center justify-center mx-auto mb-6 text-[#7a6f64]">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <p className="font-serif text-2xl mb-3">Chưa có sách nào</p>
            <p className="text-[#7a6f64] text-sm mb-8">Khám phá kho sách và chọn những cuốn bạn yêu thích.</p>
            <Link to="/catalog" className="btn-gold inline-block px-8 py-3 text-sm font-semibold no-underline">Khám phá sách</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-10">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#22201d]">
                <span className="text-[10px] text-[#7a6f64] uppercase tracking-[.2em] font-mono">Sản phẩm</span>
                <Link to="/catalog" className="flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#c8a94d] no-underline">← Tiếp tục mua sắm</Link>
              </div>

              <div>
                {cart.items.map((item) => (
                  <article key={item.id} className="flex gap-5 py-5 items-center border-b border-[#22201d]">
                    <Link to={`/books/${item.slug}`} className="shrink-0 w-16 h-[88px] overflow-hidden bg-[#765037] block">
                      {item.coverUrl ? <img src={assetUrl(item.coverUrl)} alt={item.title} className="w-full h-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} /> : <span className="w-full h-full flex items-center justify-center font-serif text-2xl">{item.title.slice(0, 1)}</span>}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/books/${item.slug}`} className="font-serif text-[#ede7dc] text-base leading-snug no-underline hover:text-[#c8a94d] line-clamp-2">{item.title}</Link>
                      <div className="text-xs text-[#7a6f64] mt-1">{item.author}</div>
                    </div>
                    <div className="flex items-center border border-[#2b2520] shrink-0">
                      <button type="button" disabled={busyItemId === item.id} onClick={() => item.quantity > 1 ? void changeQuantity(item.id, item.quantity - 1) : void remove(item.id, item.title)} className="w-9 h-9 text-[#7a6f64] hover:text-[#ede7dc]">−</button>
                      <span className="w-8 text-center text-sm font-mono">{item.quantity}</span>
                      <button type="button" disabled={busyItemId === item.id || item.quantity >= item.stock} onClick={() => void changeQuantity(item.id, item.quantity + 1)} className="w-9 h-9 text-[#7a6f64] hover:text-[#ede7dc] disabled:opacity-30">+</button>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <div className="font-mono text-[#c8a94d] text-sm font-semibold">{currency.format(Number(item.lineTotal))}</div>
                      {item.quantity > 1 && <div className="text-[#7a6f64] text-[10px] font-mono mt-1">{currency.format(Number(item.price))} × {item.quantity}</div>}
                    </div>
                    <button type="button" aria-label={`Xóa ${item.title}`} disabled={busyItemId === item.id} onClick={() => void remove(item.id, item.title)} className="shrink-0 w-8 h-8 text-[#7a6f64] hover:text-red-400">×</button>
                  </article>
                ))}
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 h-fit bg-[#131110] border border-[#22201d] p-6">
              <div className="text-[10px] tracking-[.2em] text-[#c8a94d] uppercase font-mono mb-5">Tóm tắt đơn hàng</div>
              <div className="space-y-3 mb-5 text-sm">
                <div className="flex justify-between"><span className="text-[#7a6f64]">Tạm tính</span><span className="font-mono">{currency.format(total)}</span></div>
                <div className="flex justify-between"><span className="text-[#7a6f64]">Phí vận chuyển</span><span className="text-[#b5a99b]">Tính khi xác nhận</span></div>
              </div>
              <div className="border-t border-[#22201d] pt-4 mb-6 flex justify-between items-baseline">
                <span>Tổng cộng</span><span className="font-serif text-2xl text-[#c8a94d] font-semibold">{currency.format(total)}</span>
              </div>
              <Link to="/checkout" className="btn-gold w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold no-underline">Tiến hành thanh toán →</Link>
              <div className="mt-4 flex justify-center gap-4 text-[#7a6f64] text-[10px]"><span>✓ Bảo mật SSL</span><span>✓ Kiểm tra tồn kho</span></div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
