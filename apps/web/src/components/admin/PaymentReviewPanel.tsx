import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { currency } from "../../lib/format";

type Review = { id: number; orderId: number; amount: number; transactionNo: string; reviewReason: string; customerName: string };
type Queue = { summary: Array<{ state: string; total: number }>; pending: Array<{ id: number; orderId: number; state: string; attemptCount: number }> };
type PendingPayment = { id: number; orderId: number; amount: number; state: string; customerName: string };

export function PaymentReviewPanel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [paymentsPending, setPaymentsPending] = useState<PendingPayment[]>([]);
  const [queryAvailable, setQueryAvailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function load() {
    setLoading(true); setError("");
    try {
      const [payments, notifications, pendingPayments] = await Promise.all([api<Review[]>("/api/admin/payment-reconciliation"), api<Queue>("/api/admin/order-notifications"), api<PendingPayment[]>("/api/admin/payment-pending")]);
      setReviews(payments.data); setQueue(notifications.data);
      setPaymentsPending(pendingPayments.data); setQueryAvailable(pendingPayments.meta?.queryAvailable === true);
      setLoaded(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải đối soát."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function queryPayment(id: number) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await api<{ message: string }>(`/api/admin/payment-reconciliation/${id}/query`, { method: "POST" });
      setNotice(response.data.message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể truy vấn thanh toán."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function recordRefund(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    pending.current = true; setBusy(true); setError("");
    try {
      await api(`/api/admin/payment-reconciliation/${id}/refund-confirmation`, { method: "POST", body: JSON.stringify({ providerReference: String(form.get("reference")).trim(), note: String(form.get("note")).trim() }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể ghi nhận hoàn tiền."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function retry(id: number) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await api(`/api/admin/order-notifications/${id}/retry`, { method: "POST" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể thử lại."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <details className="my-4 rounded border border-slate-700 bg-slate-900/40 p-4 text-slate-200">
    <summary className="cursor-pointer font-semibold">Đối soát thanh toán & email đơn hàng {reviews.length > 0 && `· ${reviews.length} khoản cần xử lý`}</summary>
    <div className="pt-4 space-y-4">
      {error && <div role="alert" className="text-red-300">{error} <button disabled={busy} onClick={() => void load()} className="underline">Thử lại</button></div>}
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {loading && <p role="status">Đang tải…</p>}
      {loaded && <>
        <p className="text-sm text-slate-300">Chỉ ghi nhận hoàn tiền sau khi VNPay đã xác nhận hoàn thành và cấp mã tham chiếu.</p>
        {reviews.length === 0 && <p className="text-sm">Không có khoản thu cần đối soát.</p>}
        {reviews.map(item => <form key={item.id} onSubmit={event => void recordRefund(event, item.id)} className="border border-slate-700 rounded p-3 space-y-3">
          <p className="text-sm font-semibold">Đơn #{item.orderId} · {currency.format(Number(item.amount))} · {item.customerName}</p>
          <p className="text-sm text-amber-300">{item.reviewReason}</p>
          <p className="text-xs text-slate-300">Giao dịch VNPay: {item.transactionNo}</p>
          <label className="block text-sm">Mã tham chiếu hoàn tiền<input required minLength={4} maxLength={100} name="reference" className="block w-full mt-1 rounded border border-slate-600 bg-slate-950 p-2" /></label>
          <label className="block text-sm">Ghi chú đối soát<textarea required minLength={10} maxLength={500} name="note" className="block w-full mt-1 rounded border border-slate-600 bg-slate-950 p-2" /></label>
          <button disabled={busy} className="rounded bg-amber-400 text-slate-950 px-4 py-2 text-sm disabled:opacity-50">Ghi nhận đã hoàn tiền</button>
        </form>)}
        {paymentsPending.length > 0 && <details className="border-t border-slate-700 pt-3">
          <summary className="cursor-pointer text-sm">Giao dịch chưa xác nhận · {paymentsPending.length}</summary>
          {!queryAvailable && <p className="text-sm mt-3 text-slate-300">Chưa bật truy vấn VNPay. Kiểm tra giao dịch trong cổng quản trị VNPay.</p>}
          <div className="mt-3 space-y-3">{paymentsPending.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Đơn #{item.orderId} · {currency.format(Number(item.amount))} · {item.customerName}</span>
            {queryAvailable && <button disabled={busy} onClick={() => void queryPayment(item.id)} className="min-h-11 border border-amber-400 rounded px-3 text-amber-300 disabled:opacity-50" aria-label={`Truy vấn VNPay giao dịch ${item.id}`}>Kiểm tra VNPay</button>}
          </div>)}</div>
        </details>}
        <p className="text-sm">Email: {queue?.summary.map(item => `${({ pending: "chờ gửi", processing: "đang gửi", sent: "đã gửi", failed: "lỗi" } as Record<string, string>)[item.state] ?? item.state}: ${item.total}`).join(" · ") || "Chưa có"}</p>
        {queue?.pending.filter(item => item.state === "failed").map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 text-sm"><span>Email đơn #{item.orderId} · {item.attemptCount} lần thử</span><button disabled={busy} onClick={() => void retry(item.id)} className="underline text-amber-300">Gửi lại</button></div>)}
        <button disabled={busy || loading} onClick={() => void load()} className="text-sm underline text-amber-300">Cập nhật</button>
      </>}
    </div>
  </details>;
}
