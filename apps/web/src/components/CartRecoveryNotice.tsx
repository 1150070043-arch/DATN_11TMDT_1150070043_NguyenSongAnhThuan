import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

export function CartRecoveryNotice({ inline = false }: { inline?: boolean }) {
  const { recovery, loading, mutating, loadCart } = useCart();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (!recovery || pathname.startsWith("/admin") || (!inline && ["/cart", "/checkout"].includes(pathname))) return null;
  async function recover() {
    try {
      await loadCart();
      if (recovery?.kind === "uncertain" && pathname !== "/cart") navigate("/cart");
    } catch { /* Keep the recovery notice until a read succeeds. */ }
  }
  return <aside aria-label="Đồng bộ giỏ hàng" role={recovery.kind === "uncertain" ? "alert" : "status"}
    className={`${inline ? "my-6" : "fixed bottom-4 inset-x-4 z-[70] mx-auto max-w-xl"} rounded border border-amber-500/60 bg-[#15110b] p-4 text-[#ede7dc] shadow-xl`}>
    <p className="text-sm leading-relaxed">{recovery.message}</p>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button type="button" disabled={loading || mutating} onClick={() => void recover()} className="min-h-11 rounded bg-[#c8a94d] px-4 text-sm font-semibold text-[#0b0907] disabled:opacity-50">
        {loading ? "Đang tải giỏ…" : "Tải lại giỏ"}
      </button>
      {pathname !== "/cart" && <Link to="/cart" className="flex min-h-11 items-center text-sm underline">Xem giỏ hàng</Link>}
    </div>
  </aside>;
}
