import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError } from "../lib/api";
import { currency } from "../lib/format";

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, clearLocal } = useCart();
  const navigate = useNavigate();
  const { notify } = useToast();
  const idempotencyKey = useRef(crypto.randomUUID());
  const orderCompleted = useRef(false);
  const [customerName, setCustomerName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [shippingAddress, setShippingAddress] = useState(user?.addressLine ?? "");
  const [note, setNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "vnpay">("cod");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!cart || cart.items.length === 0) {
    if (orderCompleted.current) return <div className="page-loading">Đang hoàn tất đơn hàng…</div>;
    return <Navigate to="/cart" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ id: number; paymentUrl?: string; qrCode?: string }>("/api/orders", {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({
          customerName,
          phone,
          shippingAddress,
          note,
          couponCode: couponCode.trim() || undefined,
          paymentMethod
        })
      });
      orderCompleted.current = true;
      clearLocal();

      if (paymentMethod !== "cod" && result.data.paymentUrl) {
        notify({
          tone: "info",
          title: `Đã tạo đơn #${result.data.id}`,
          message: "Đang chuyển hướng đến cổng thanh toán..."
        });
        window.location.href = result.data.paymentUrl;
        return;
      }

      notify({ tone: "success", title: `Đã đặt đơn #${result.data.id}`, message: "Bạn có thể theo dõi tiến trình trong mục Đơn hàng." });
      navigate("/orders", { state: { createdOrderId: result.data.id } });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tạo đơn hàng.");
      notify({
        tone: "error",
        title: "Đơn hàng chưa được tạo",
        message: cause instanceof ApiError ? cause.message : "Vui lòng kiểm tra thông tin và thử lại."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Bước cuối</div>
          <h1>Thông tin giao sách</h1>
        </div>
        <Link to="/cart" className="text-link">← Quay lại giỏ hàng</Link>
      </div>
      <ol className="checkout-steps" aria-label="Tiến trình đặt hàng">
        <li className="is-complete"><span>1</span><b>Giỏ hàng</b></li>
        <li className="is-current" aria-current="step"><span>2</span><b>Giao sách</b></li>
        <li><span>3</span><b>Hoàn tất</b></li>
      </ol>
      <div className="row g-4">
        <div className="col-lg-7">
          <form className="content-card" onSubmit={(event) => void submit(event)}>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="customer-name">Người nhận</label>
              <input id="customer-name" className="form-control" autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required minLength={2} maxLength={160} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="phone">Số điện thoại</label>
              <input id="phone" className="form-control" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required pattern="[0-9+(). -]{8,20}" aria-describedby="phone-help" />
              <div className="form-text" id="phone-help">Dùng để liên hệ khi giao sách, từ 8 đến 20 ký tự.</div>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="address">Địa chỉ giao hàng</label>
              <textarea id="address" className="form-control" rows={3} autoComplete="street-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} required minLength={8} maxLength={500} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="note">Ghi chú <span className="text-secondary">(không bắt buộc)</span></label>
              <textarea id="note" className="form-control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </div>
            <div className="coupon-entry mb-4">
              <div>
                <label className="form-label mb-1" htmlFor="coupon-code">Mã ưu đãi</label>
                <div className="form-text mt-0">Điều kiện và lượt dùng được kiểm tra an toàn khi tạo đơn.</div>
              </div>
              <input id="coupon-code" className="form-control" value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="VD: BOOK10" minLength={3} maxLength={40} autoComplete="off" />
            </div>
            <div className="mb-4">
              <label className="form-label mb-2">Phương thức thanh toán</label>
              <div className="d-flex flex-column gap-2">
                <label className={`p-3 border rounded-2 d-flex align-items-center gap-3 cursor-pointer ${paymentMethod === 'cod' ? 'border-warning bg-dark' : 'border-secondary'}`}>
                  <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  <div>
                    <strong className="d-block">💵 Thanh toán khi nhận hàng (COD)</strong>
                    <small className="text-secondary">Nhân viên giao hàng thu tiền mặt tận nơi.</small>
                  </div>
                </label>
                <label className={`p-3 border rounded-2 d-flex align-items-center gap-3 cursor-pointer ${paymentMethod === 'vnpay' ? 'border-warning bg-dark' : 'border-secondary'}`}>
                  <input type="radio" name="paymentMethod" value="vnpay" checked={paymentMethod === 'vnpay'} onChange={() => setPaymentMethod('vnpay')} />
                  <div>
                    <strong className="d-block">💳 Cổng thanh toán VNPAY (Sandbox)</strong>
                    <small className="text-secondary">Thẻ ATM nội địa NCB, thẻ quốc tế Visa/Mastercard, VNPAY-QR.</small>
                  </div>
                </label>
              </div>
            </div>
            <button className="btn btn-accent btn-lg mt-4 checkout-submit" type="submit" disabled={submitting}>
              {submitting ? "Đang tạo đơn…" : "Xác nhận đặt hàng"}
            </button>
          </form>
        </div>
        <div className="col-lg-5">
          <aside className="order-summary">
            <h2>Đơn hàng</h2>
            <p className="summary-caption">{cart.items.reduce((sum, item) => sum + item.quantity, 0)} cuốn trong đơn</p>
            {cart.items.map((item) => (
              <div className="summary-line" key={item.id}>
                <span>{item.title} × {item.quantity}</span>
                <span>{currency.format(Number(item.lineTotal))}</span>
              </div>
            ))}
            <div className="summary-total">
              <span>Tổng tạm tính</span>
              <strong>{currency.format(Number(cart.total))}</strong>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
