import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { statusColor } from "../design/Reference";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OrderTimeline } from "../components/OrderTimeline";
import { useToast } from "../context/ToastContext";
import { api, ApiError, downloadApiFile } from "../lib/api";
import { currency, dateTime, statusLabel } from "../lib/format";
import type { Order, OrderStatus } from "../types";

const filters: Array<{ value: "all" | OrderStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã hủy" }
];

export function OrdersPage() {
  const location = useLocation();
  const { notify } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [cancelCandidate, setCancelCandidate] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const createdOrderId = (location.state as { createdOrderId?: number } | null)?.createdOrderId;
  const selectedOrderId = (location.state as { selectedOrderId?: number } | null)?.selectedOrderId;
  useEffect(() => { if (selectedOrderId) void openOrder(selectedOrderId); }, [selectedOrderId]);

  async function loadOrders() {
    setLoading(true);
    try {
      const result = await api<Order[]>("/api/orders");
      setOrders(result.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const visibleOrders = useMemo(
    () => statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter),
    [orders, statusFilter]
  );

  async function openOrder(id: number) {
    setOpeningId(id);
    setError("");
    try {
      const result = await api<Order>(`/api/orders/${id}`);
      setSelected(result.data);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể mở đơn hàng.";
      setError(message);
      notify({ tone: "error", title: "Chưa thể mở đơn", message });
    } finally {
      setOpeningId(null);
    }
  }

  async function cancelOrder() {
    if (!cancelCandidate) return;
    const cancelledOrderId = cancelCandidate;
    setCancelling(true);
    try {
      await api(`/api/orders/${cancelledOrderId}/cancel`, { method: "PATCH" });
      setSelected(null);
      setCancelCandidate(null);
      await loadOrders();
      notify({ tone: "success", title: `Đã hủy đơn #${cancelledOrderId}`, message: "Số lượng sách đã được hoàn lại kho." });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể hủy đơn hàng.";
      setError(message);
      notify({ tone: "error", title: "Chưa thể hủy đơn", message });
    } finally {
      setCancelling(false);
    }
  }

  async function payOrder(id: number) {
    try {
      const res = await api<{ paymentUrl: string }>(`/api/payments/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: "vnpay" })
      });
      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch (cause) {
      notify({ tone: "error", title: "Lỗi tạo thanh toán", message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        <Link to="/profile" className="text-xs text-[#7a6f64] hover:text-[#c8a94d]">← Tài khoản</Link>
        <div className="flex items-center justify-between gap-4 mt-6 mb-10"><div><div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-2">Lịch sử đơn hàng</div><h1 className="font-display text-4xl text-[#ede7dc] font-medium">Đơn hàng của tôi</h1></div><Link className="text-xs text-[#c8a94d]" to="/catalog">Tiếp tục chọn sách →</Link></div>
        {createdOrderId && <div role="status" className="bg-[#131110] border border-[#22201d] p-5 mb-6 flex justify-between text-sm"><span>Đặt hàng thành công · Đơn #{createdOrderId}</span><button onClick={() => void openOrder(createdOrderId)} className="text-[#c8a94d]">Xem đơn</button></div>}
        {error && <div role="alert" className="text-red-400 border border-red-900 p-4 mb-6">{error}</div>}
        <div className="flex flex-wrap gap-2 mb-6" aria-label="Lọc đơn hàng theo trạng thái">{filters.map(filter => <button key={filter.value} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={'px-4 py-2 rounded-sm text-xs border ' + (statusFilter === filter.value ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907]' : 'border-[#2b2520] text-[#7a6f64]')}>{filter.label} · {filter.value === 'all' ? orders.length : orders.filter(order => order.status === filter.value).length}</button>)}</div>
        <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
          {loading ? <p className="text-sm text-[#7a6f64]">Đang tải đơn hàng…</p> : visibleOrders.length === 0 ? <div className="py-12 text-center"><h2 className="font-display text-2xl text-[#ede7dc] mb-3">{orders.length === 0 ? 'Bạn chưa có đơn hàng' : 'Không có đơn ở trạng thái này'}</h2><Link className="text-sm text-[#c8a94d]" to="/catalog">Khám phá tủ sách →</Link></div> : visibleOrders.map(order => <button type="button" key={order.id} disabled={openingId === order.id} onClick={() => void openOrder(order.id)} aria-label={'Xem chi tiết đơn ' + order.id} className="reference-order-row py-5 flex items-center gap-5 w-full text-left border-b border-[#22201d] last:border-b-0 hover:bg-[#1a1715] px-4 rounded transition-colors cursor-pointer">
            <span className="w-10 h-10 rounded-sm bg-[#1c1815] border border-[#22201d] flex items-center justify-center text-[#c8a94d] font-mono text-xs font-bold shrink-0">#{order.id}</span>
            <span className="flex-1 min-w-0"><span className="block text-sm text-[#ede7dc] font-medium truncate">{order.customerName}</span><span className="block text-xs text-[#7a6f64] font-mono mt-0.5">{dateTime.format(new Date(order.createdAt))}</span></span>
            <span className={'badge ' + (order.paymentStatus === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800') + ' shrink-0'}>
              {(order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD')} · {order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
            </span>
            <span className={'badge ' + statusColor(statusLabel[order.status]) + ' shrink-0'}>{statusLabel[order.status]}</span>
            <span className="text-sm font-mono text-[#c8a94d] shrink-0 w-28 text-right">{currency.format(Number(order.totalAmount))}</span>
          </button>)}
        </div>
      </div>
      <div className="legacy-ui reference-dialogs">
      {selected && (
        <div className="modal-backdrop-custom" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="detail-drawer order-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="order-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-handle" aria-hidden="true" />
            <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
              <div>
                <div className="eyebrow">Chi tiết đơn hàng</div>
                <h2 id="order-title">Đơn #{selected.id}</h2>
              </div>
              <button className="btn-close" type="button" aria-label="Đóng" onClick={() => setSelected(null)} />
            </div>
            <div className="order-facts">
              <div><span>Trạng thái</span><strong>{statusLabel[selected.status]}</strong></div>
              <div><span>Ngày đặt</span><strong>{dateTime.format(new Date(selected.createdAt))}</strong></div>
              <div><span>Phương thức</span><strong>{selected.paymentMethod === 'vnpay' ? '💳 VNPay (Sandbox)' : '💵 COD (Tiền mặt)'}</strong></div>
              <div>
                <span>Thanh toán</span>
                <strong className={selected.paymentStatus === 'paid' ? 'text-success' : 'text-warning'}>
                  {selected.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                </strong>
              </div>
              {selected.paymentTransactionId && (
                <div className="order-fact-wide"><span>Mã giao dịch</span><strong className="font-monospace">{selected.paymentTransactionId}</strong></div>
              )}
              <div><span>Người nhận</span><strong>{selected.customerName}</strong></div>
              {selected.phone && <div><span>Điện thoại</span><strong>{selected.phone}</strong></div>}
              <div className="order-fact-wide"><span>Địa chỉ</span><strong>{selected.shippingAddress}</strong></div>
              {selected.note && <div className="order-fact-wide"><span>Ghi chú</span><strong>{selected.note}</strong></div>}
            </div>
            <OrderTimeline order={selected} />
            <div className="drawer-order-items">
              <div className="section-kicker">Sách trong đơn</div>
              {selected.items?.map((item) => (
                <div className="summary-line" key={item.id}>
                  <span>{item.bookTitle} <small>× {item.quantity}</small></span>
                  <span>{currency.format(Number(item.unitPrice) * item.quantity)}</span>
                </div>
              ))}
              {Number(selected.discountAmount ?? 0) > 0 && <>
                <div className="summary-line"><span>Tạm tính</span><span>{currency.format(Number(selected.subtotalAmount))}</span></div>
                <div className="summary-line discount-line"><span>Ưu đãi {selected.couponCode && <code>{selected.couponCode}</code>}</span><span>−{currency.format(Number(selected.discountAmount))}</span></div>
              </>}
              <div className="summary-total">
                <span>Tổng cộng</span>
                <strong>{currency.format(Number(selected.totalAmount))}</strong>
              </div>
            </div>

            {selected.paymentStatus !== "paid" && selected.status !== "cancelled" && (
              <div className="payment-actions my-3 p-3 bg-dark border border-warning rounded">
                <div className="text-warning small mb-2 font-monospace fw-bold">THANH TOÁN TRỰC TUYẾN</div>
                <button
                  className="btn btn-warning btn-sm"
                  type="button"
                  onClick={() => void payOrder(selected.id)}
                >
                  💳 Thanh toán qua VNPay
                </button>
              </div>
            )}

            <button className="btn btn-outline-dark mt-4 me-2" type="button"
              onClick={() => void downloadApiFile(`/api/orders/${selected.id}/invoice.csv`, `bookguard-order-${selected.id}.csv`)}>
              Tải hóa đơn CSV
            </button>
            {selected.status === "pending" && (
              <button className="btn btn-outline-danger mt-4" type="button" onClick={() => setCancelCandidate(selected.id)}>Hủy đơn hàng</button>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={cancelCandidate !== null}
        title={`Hủy đơn #${cancelCandidate ?? ""}?`}
        description="Thao tác này sẽ hủy đơn và hoàn lại số lượng sách vào kho. Bạn không thể tự khôi phục đơn sau đó."
        confirmLabel="Hủy đơn"
        destructive
        busy={cancelling}
        onCancel={() => setCancelCandidate(null)}
        onConfirm={() => void cancelOrder()}
      />
      </div>
    </div>
  );
}
