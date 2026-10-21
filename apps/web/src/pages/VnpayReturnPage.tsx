import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AsyncState } from "../components/AsyncState";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { currency } from "../lib/format";
import type { Order } from "../types";

export function VnpayReturnPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const id = Number(params.get("orderId"));
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [polling, setPolling] = useState(false);
  const validId = Number.isSafeInteger(id) && id > 0;
  useEffect(() => {
    if (!user || !validId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    setOrder(null); setError(""); setPolling(true);
    async function load() {
      try {
        const result = await api<Order>(`/api/orders/${id}`, { signal: abort.signal });
        if (abort.signal.aborted) return;
        setOrder(result.data);
        if (result.data.paymentStatus === "unpaid" && result.data.status !== "cancelled" && polls++ < 5) timer = setTimeout(() => void load(), 2000);
        else setPolling(false);
      } catch (cause) {
        if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : "Không thể kiểm tra thanh toán."); setPolling(false); }
      }
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [id, user?.id, validId, attempt]);
  if (authLoading) return <AsyncState label="Đang tải tài khoản…" />;
  if (!validId) return <AsyncState error="Không thể xác minh giao dịch. Vui lòng kiểm tra trong mục Đơn hàng." />;
  if (!user) return <div className="pt-32 pb-16 px-6 text-center"><p>Đăng nhập để kiểm tra kết quả thanh toán.</p><Link className="inline-block btn-gold px-6 py-3 mt-4 text-[#0b0907]" to="/login" state={{ from: location.pathname + location.search }}>Đăng nhập</Link></div>;
  if (!order) return <AsyncState error={error} label="Đang kiểm tra thanh toán…" onRetry={() => setAttempt(value => value + 1)} />;
  const refund = ["refund_pending", "refunded"].includes(order.paymentStatus ?? "");
  const paid = order.paymentStatus === "paid";
  const failed = order.paymentStatus === "failed" || order.status === "cancelled";
  return <div className="min-h-screen pt-28 pb-16 flex items-center justify-center px-4">
    <div className="max-w-md w-full bg-[#131110] border border-[#22201d] rounded-sm p-6 sm:p-8">
      <h1 className="font-display text-2xl text-[#ede7dc] mb-3">{refund ? (order.paymentStatus === "refunded" ? "Đã hoàn tiền" : "Đang chờ hoàn tiền") : paid ? "Thanh toán thành công" : failed ? "Thanh toán chưa hoàn tất" : "Đang chờ xác nhận thanh toán"}</h1>
      <p role="status" className="text-sm text-[#b5a99b] mb-6">{refund ? "Khoản thanh toán đã được ghi nhận. Xem đơn hàng để theo dõi việc hoàn tiền." : paid ? "Thanh toán đã được ghi nhận cho đơn hàng của bạn." : failed ? "Kiểm tra đơn hàng trước khi thử thanh toán lại." : polling ? "Đang kiểm tra kết quả từ VNPAY…" : "Chưa có xác nhận thanh toán. Nếu đã bị trừ tiền, kiểm tra đơn hàng trước khi thanh toán lại."}</p>
      {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}
      <dl className="text-sm space-y-3 mb-6">
        <div className="flex justify-between gap-3"><dt>Mã đơn hàng</dt><dd>#{order.id}</dd></div>
        <div className="flex justify-between gap-3"><dt>Số tiền</dt><dd className="text-[#c8a94d]">{currency.format(Number(order.totalAmount))}</dd></div>
        {paid && order.paymentTransactionId && <div className="flex justify-between gap-3"><dt>Mã giao dịch</dt><dd className="break-all">{order.paymentTransactionId}</dd></div>}
      </dl>
      {!paid && order.paymentStatus !== 'refunded' && <button className="w-full border border-[#c8a94d] px-5 py-3 mb-3 text-[#c8a94d]" onClick={() => setAttempt(value => value + 1)}>Kiểm tra lại</button>}
      <Link to="/orders" state={{ selectedOrderId: order.id }} className="block text-center btn-gold px-5 py-3 text-[#0b0907]">Xem đơn hàng</Link>
    </div>
  </div>;
}
import "../design/legacy-scoped.css";
import "../design/legacy-overrides.css";
