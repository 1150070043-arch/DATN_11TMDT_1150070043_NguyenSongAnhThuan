import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { currency, dateTime } from "../../lib/format";
import { useToast } from "../../context/ToastContext";

type Coupon = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumOrder: number;
  maximumDiscount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
const nextMonth = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16);

export function CouponsPanel() {
  const { notify } = useToast();
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percent",
    discountValue: 10,
    minimumOrder: 0,
    maximumDiscount: 100000,
    usageLimit: 100,
    startsAt: tomorrow(),
    endsAt: nextMonth()
  });

  async function load() {
    try {
      setItems((await api<Coupon[]>("/api/admin/coupons")).data);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải mã ưu đãi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString()
        })
      });
      notify({ tone: "success", title: `Đã tạo mã ưu đãi ${form.code}` });
      setShowForm(false);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tạo mã ưu đãi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Coupon) {
    try {
      await api(`/api/admin/coupons/${item.id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive })
      });
      notify({ tone: "success", title: item.isActive ? "Đã tạm dừng mã" : "Đã kích hoạt mã" });
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật mã.");
    }
  }

  if (loading) {
    return (
      <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-12 text-center text-xs font-mono text-[#8c8275]">
        Đang tải danh sách chương trình ưu đãi…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#231e1a]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] tracking-[0.25em] text-[#c8a94d] uppercase font-mono font-medium">Khuyến mại & Voucher</span>
          </div>
          <h1 className="font-display text-3xl text-[#ede7dc] font-normal tracking-tight">
            Quản lý mã ưu đãi
          </h1>
          <p className="text-sm text-[#8c8275] mt-1.5 leading-relaxed">
            Thiết lập mã giảm giá theo phần trăm hoặc số tiền cố định, giới hạn lượt dùng và thời gian áp dụng.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#c8a94d] text-[#0b0907] font-bold text-xs font-mono rounded hover:bg-[#d8b95d] transition-colors shadow-sm cursor-pointer self-start md:self-auto"
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
          </svg>
          <span>{showForm ? "Đóng biểu mẫu" : "Tạo mã ưu đãi mới"}</span>
        </button>
      </div>

      {error && (
        <div className="border border-rose-900/60 bg-rose-950/40 text-rose-300 text-xs px-4 py-3 rounded-md font-mono">
          {error}
        </div>
      )}

      {/* Creation Form Panel */}
      {showForm && (
        <form onSubmit={(e) => void submit(e)} className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-6 space-y-5 shadow-sm">
          <div className="text-sm font-display font-medium text-[#ede7dc] pb-3 border-b border-[#231e1a]">
            Thông tin mã ưu đãi mới
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Mã code</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d] font-bold tracking-wider"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                required
                minLength={3}
                maxLength={40}
                placeholder="VD: DATN2026"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Loại giảm giá</label>
              <select
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "fixed" })}
              >
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (đ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Giá trị giảm</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="number"
                min="1"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Đơn tối thiểu (đ)</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="number"
                min="0"
                value={form.minimumOrder}
                onChange={(e) => setForm({ ...form, minimumOrder: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Giảm tối đa (đ)</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="number"
                min="1"
                value={form.maximumDiscount}
                onChange={(e) => setForm({ ...form, maximumDiscount: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Giới hạn số lượt dùng</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Ngày bắt đầu</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-[#8c8275] font-bold uppercase mb-1.5">Ngày kết thúc</label>
              <input
                className="w-full px-3.5 py-2.5 bg-[#0e0c0a] border border-[#2b2520] rounded text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#231e1a]">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#c8a94d] text-[#0b0907] font-bold text-xs font-mono rounded hover:bg-[#d8b95d] transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu mã ưu đãi"}
            </button>
          </div>
        </form>
      )}

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="col-span-full bg-[#120f0d] border border-[#231e1a] rounded-lg p-12 text-center text-xs font-mono text-[#8c8275]">
            Chưa có mã ưu đãi nào được tạo. Hãy tạo mã đầu tiên để người dùng có thể áp dụng khi thanh toán.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`bg-[#120f0d] border rounded-lg p-5 space-y-3.5 transition-all shadow-sm ${
                item.isActive ? "border-[#231e1a] hover:border-[#c8a94d]/50" : "border-[#1c1714] opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-[#c8a94d] tracking-wider bg-[#c8a94d]/10 border border-[#c8a94d]/30 px-2.5 py-0.5 rounded">
                  {item.code}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-medium ${
                    item.isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-[#1a1613] text-[#8c8275] border border-[#2b2520]"
                  }`}
                >
                  {item.isActive ? "HOẠT ĐỘNG" : "TẠM DỪNG"}
                </span>
              </div>

              <div className="font-display text-2xl text-[#ede7dc] font-normal">
                {item.discountType === "percent"
                  ? `Giảm ${Number(item.discountValue)}%`
                  : `Giảm ${currency.format(Number(item.discountValue))}`}
              </div>

              <div className="text-xs text-[#8c8275] font-mono space-y-1.5 pt-1">
                <div>Đơn tối thiểu: <strong className="text-[#ede7dc]">{currency.format(Number(item.minimumOrder))}</strong></div>
                {item.maximumDiscount && <div>Giảm tối đa: <strong className="text-[#ede7dc]">{currency.format(Number(item.maximumDiscount))}</strong></div>}
                <div>Đã dùng: <strong className="text-[#ede7dc]">{item.usedCount} / {item.usageLimit ?? "∞"}</strong> lượt</div>
                <div>Hết hạn: <strong className="text-[#ede7dc]">{dateTime.format(new Date(item.endsAt))}</strong></div>
              </div>

              <div className="pt-3 border-t border-[#231e1a] flex justify-end">
                <button
                  type="button"
                  onClick={() => void toggle(item)}
                  className="px-3.5 py-1.5 bg-[#16120f] border border-[#2b2520] hover:border-[#c8a94d] text-xs font-mono text-[#b5a99b] hover:text-[#ede7dc] rounded transition-colors cursor-pointer font-medium"
                >
                  {item.isActive ? "Tạm dừng" : "Kích hoạt lại"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
