import { useState, useEffect, useRef, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { Link } from 'react-router-dom';
import { useAuth as useSession } from '../context/AuthContext';
import type { Order } from '../types';
import { useToast, useTheme, fmt, SectionLabel, FallbackCover, BookCard, type BOOKS, type CartItem } from './Reference';
import { coverImage } from '../lib/cover-images';
export function CartPage({
  items,
  busy = false,
  error = '',
  notice,
  onUpdate,
  onRemove,
  onCheckout,
  onContinue,
}: {
  items: CartItem[]
  busy?: boolean
  error?: string
  notice?: ReactNode
  onUpdate: (id: number, qty: number) => void
  onRemove: (id: number) => void
  onCheckout: () => void
  onContinue: () => void
}) {
  const subtotal = items.reduce((s, i) => s + i.book.price * i.qty, 0)
  const shipping = 0
  const total = subtotal + shipping
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const catColor: Record<string, string> = {
    'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035',
    'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28',
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <SectionLabel>Giỏ hàng</SectionLabel>
          <h1 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium mt-2">
            {items.length === 0 ? 'Giỏ hàng trống' : `${items.reduce((s, i) => s + i.qty, 0)} sản phẩm`}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {notice}
        {items.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full border border-[#2b2520] flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" fill="none" stroke="#7a6f64" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>
            <p className="font-display text-2xl text-[#ede7dc] mb-3">Chưa có sách nào</p>
            <p className="text-[#7a6f64] text-sm mb-8">Khám phá kho sách và chọn những cuốn bạn yêu thích.</p>
            <button onClick={onContinue} className="btn-gold text-[#0b0907] text-sm font-semibold px-8 py-3 rounded-sm">
              Khám phá sách
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#22201d]">
                <span className="text-xs text-[#7a6f64] uppercase tracking-wider font-mono">Sản phẩm</span>
                <button onClick={onContinue} className="flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#c8a94d] transition-colors">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
                  Tiếp tục mua sắm
                </button>
              </div>

              <div className="space-y-0">
                {items.map(item => {
                  const bg = catColor[item.book.category] || '#2b2520'
                  const hasErr = imgErrors[item.book.id]
                  return (
                    <div key={item.book.id} className="reference-cart-row flex gap-5 py-5 items-center border-b border-[#22201d] last:border-b-0">
                      {/* Thumbnail */}
                      <div className="shrink-0 w-16 h-[88px] rounded-sm overflow-hidden" style={{ backgroundColor: bg }}>
                        {!hasErr && item.book.cover ? (
                          <img {...coverImage(item.book.cover, '80px')} decoding="async" alt={item.book.title} className="w-full h-full object-cover"
                            onError={() => setImgErrors(e => ({ ...e, [item.book.id]: true }))} />
                        ) : (
                          <FallbackCover title={item.book.title} author={item.book.author} bg={bg} />
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#7a6f64] font-mono uppercase tracking-wider mb-1">{item.book.category}</div>
                        <div className="font-display text-[#ede7dc] text-sm leading-snug line-clamp-2 mb-1">{item.book.title}</div>
                        <div className="text-xs text-[#7a6f64]">{item.book.author}</div>
                      </div>
                      {/* Qty */}
                      <div className="flex items-center border border-[#2b2520] rounded-sm shrink-0">
                        <button disabled={busy || item.qty <= 1} aria-label={`Giảm số lượng ${item.book.title}`} onClick={() => onUpdate(item.book.id, item.qty - 1)}
                          className="w-11 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-lg leading-none">−</button>
                        <span className="w-8 text-center text-sm text-[#ede7dc] font-mono">{item.qty}</span>
                        <button disabled={busy || item.qty >= item.book.stock} aria-label={`Tăng số lượng ${item.book.title}`} onClick={() => onUpdate(item.book.id, item.qty + 1)}
                          className="w-11 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-lg leading-none">+</button>
                      </div>
                      {/* Price */}
                      <div className="text-right shrink-0 w-28">
                        <div className="font-mono text-[#c8a94d] text-sm font-semibold">{fmt(item.book.price * item.qty)}</div>
                        {item.qty > 1 && <div className="text-[#7a6f64] text-xs font-mono">{fmt(item.book.price)} × {item.qty}</div>}
                      </div>
                      {/* Remove */}
                      <button disabled={busy} aria-label={`Xóa ${item.book.title} khỏi giỏ`} onClick={() => onRemove(item.book.id)}
                        className="shrink-0 w-11 h-11 flex items-center justify-center text-[#7a6f64] hover:text-red-400 transition-colors">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
              {error && <p role="alert" className="text-sm text-red-400 mt-4">{error}</p>}
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">Tóm tắt đơn hàng</div>
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7a6f64]">Tạm tính</span>
                    <span className="text-[#ede7dc] font-mono">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7a6f64]">Phí vận chuyển</span>
                    <span className={shipping === 0 ? 'text-emerald-400 font-mono' : 'text-[#ede7dc] font-mono'}>
                      {shipping === 0 ? 'Miễn phí' : fmt(shipping)}
                    </span>
                  </div>
                  {shipping > 0 && subtotal < 500000 && (
                    <div className="text-xs text-[#7a6f64] bg-[#1c1815] rounded-sm px-3 py-2">
                      Mua thêm <span className="text-[#c8a94d] font-mono">{fmt(500000 - subtotal)}</span> để được miễn phí ship
                    </div>
                  )}
                </div>
                <div className="border-t border-[#22201d] pt-4 mb-6 flex justify-between items-baseline">
                  <span className="text-[#ede7dc] font-medium">Tổng cộng</span>
                  <span className="font-display text-2xl text-[#c8a94d] font-semibold">{fmt(total)}</span>
                </div>
                {items.some(item => item.qty > item.book.stock) && <p role="alert" className="text-sm text-red-400 mb-4">Số lượng trong giỏ vượt tồn kho. Giảm số lượng hoặc xóa sách hết hàng để tiếp tục.</p>}
                <button disabled={busy || items.some(item => item.qty > item.book.stock)} onClick={onCheckout} className="w-full btn-gold text-[#0b0907] font-semibold py-3.5 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  Tiến hành thanh toán
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Giỏ hàng', 'Thông tin', 'Xác nhận']
  return (
    <div className="flex items-center gap-0" role="group" aria-label={`Bước ${current} trên 3: ${steps[current - 1]}`}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-medium border transition-colors ${
                done ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907]'
                : active ? 'border-[#c8a94d] text-[#c8a94d]'
                : 'border-[#2b2520] text-[#7a6f64]'
              }`}>
                {done ? <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> : idx}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-[#ede7dc]' : done ? 'text-[#7a6f64]' : 'text-[#7a6f64]'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-5 sm:w-12 md:w-20 h-px mx-2 sm:mx-3 ${done ? 'bg-[#c8a94d]/50' : 'bg-[#2b2520]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}


export function CheckoutPage({
  items,
  onBack,
  onConfirm,
}: {
  items: CartItem[]
  onBack: () => void
  onConfirm: (num: string) => void
}) {
  const { user } = useSession()
  const idempotencyKey = useRef(crypto.randomUUID())
  const [form, setForm] = useState({ name: user?.fullName ?? '', phone: user?.phone ?? '', email: user?.email ?? '', address: user?.addressLine ?? '', payment: 'cod' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState<null | { code: string; discount: number; subtotal: number; label: string }>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const submittingRef = useRef(false)
  const submittedBody = useRef<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [vnpayAvailable, setVnpayAvailable] = useState(false)
  const [methodsError, setMethodsError] = useState(false)
  const [methodsAttempt, setMethodsAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setMethodsError(false)
    void api<{ vnpay: boolean }>('/api/payments/methods', { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) setVnpayAvailable(result.data.vnpay) })
      .catch(() => { if (!abort.signal.aborted) setMethodsError(true) })
    return () => abort.abort()
  }, [methodsAttempt])
  const [couponError, setCouponError] = useState('')
  const toast = useToast()
  const cartSubtotal = items.reduce((s, i) => s + i.book.price * i.qty, 0)
  const subtotal = couponApplied?.subtotal ?? cartSubtotal
  const discount = couponApplied?.discount ?? 0
  useEffect(() => { setCouponApplied(null) }, [cartSubtotal])
  const shipping = 0
  const total = subtotal - discount + shipping

  async function applyCoupon() {
    if (checkingCoupon || submitting || uncertain) return
    const code = coupon.trim().toUpperCase()
    if (!code) { setCouponError('Vui lòng nhập mã ưu đãi'); return }
    setCheckingCoupon(true); setCouponError('')
    try {
      const result = await api<{ subtotal: number; discount: number }>('/api/orders/quote', { method: 'POST', body: JSON.stringify({ couponCode: code }) })
      setCouponApplied({ code, discount: result.data.discount, subtotal: result.data.subtotal, label: `Giảm ${fmt(result.data.discount)}` })
    } catch (cause) { setCouponApplied(null); setCouponError(cause instanceof Error ? cause.message : 'Không thể kiểm tra mã ưu đãi') }
    finally { setCheckingCoupon(false) }
  }

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setSubmitError('')
  }

  function validate() {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Họ tên cần ít nhất 2 ký tự'
    if (!/^[0-9+(). -]{8,20}$/.test(form.phone.trim())) e.phone = 'Số điện thoại cần từ 8 đến 20 ký tự hợp lệ'
    if (form.address.trim().length < 8) e.address = 'Địa chỉ cần ít nhất 8 ký tự'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current || checkingCoupon) return
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      document.getElementById(`checkout-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    submittingRef.current = true; setSubmitting(true); setErrors({}); setSubmitError('')
    submittedBody.current ??= JSON.stringify({
      customerName: form.name.trim(), phone: form.phone.trim(), shippingAddress: form.address.trim(),
      couponCode: couponApplied?.code, paymentMethod: form.payment
    })
    let completed = false
    try {
      const result = await api<{ id: number; paymentUrl?: string; qrCode?: string }>('/api/orders', {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey.current },
        body: submittedBody.current
      })
      if (form.payment !== 'cod' && result.data.paymentUrl) {
        toast('Đang chuyển hướng đến cổng thanh toán...', 'info')
        window.location.href = result.data.paymentUrl
        completed = true
        return
      }
      completed = true
      onConfirm(String(result.data.id))
    } catch (error) {
      const ambiguous = !(error instanceof ApiError) || error.status === 0 || error.status >= 500
      setUncertain(ambiguous)
      setSubmitError(error instanceof Error ? error.message : 'Không thể tạo đơn')
      if (!ambiguous) { submittedBody.current = null; idempotencyKey.current = crypto.randomUUID() }
    } finally {
      if (!completed) { submittingRef.current = false; setSubmitting(false) }
    }
  }

  const payments = [
    { id: 'cod', label: 'Trả tiền khi nhận hàng', sub: 'Thanh toán cho nhân viên giao hàng.', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'vnpay', label: 'VNPAY (Sandbox)', sub: 'ATM, thẻ quốc tế hoặc QR.', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  ]

  const imgErrors: Record<number, boolean> = {}
  const catColor: Record<string, string> = { 'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035', 'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28' }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <h1 className="sr-only">Thông tin đặt hàng</h1>
          <StepIndicator current={2} />
          <button disabled={submitting} onClick={onBack} className="min-h-11 shrink-0 flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#ede7dc] transition-colors group">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            Giỏ hàng
          </button>
        </div>
      </div>

      <form className="checkout-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-10">
            {/* Left: form */}
            <fieldset disabled={submitting || uncertain} className="min-w-0 space-y-8">
              <legend className="sr-only">Thông tin nhận hàng và thanh toán</legend>
              {/* Customer info */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">01 · Thông tin khách hàng</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A', type: 'text' },
                    { key: 'phone', label: 'Số điện thoại', placeholder: '0912 345 678', type: 'tel' },
                  ].map(f => (
                    <div key={f.key}>
                      <label htmlFor={`checkout-${f.key}`} className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{f.label}</label>
                      <input id={`checkout-${f.key}`} aria-label={f.label} inputMode={f.key === 'phone' ? 'tel' : 'text'} enterKeyHint="next" onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); document.getElementById(f.key === 'name' ? 'checkout-phone' : 'checkout-address')?.focus() } }} aria-invalid={Boolean(errors[f.key])} aria-describedby={errors[f.key] ? `checkout-${f.key}-error` : undefined} autoComplete={f.key === 'name' ? 'name' : 'tel'} minLength={f.key === 'name' ? 2 : 8} maxLength={f.key === 'name' ? 160 : 20} required type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                        className={`w-full bg-[#1c1815] border px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none placeholder-[#7a6f64] transition-colors ${errors[f.key] ? 'border-red-700' : 'border-[#2b2520] focus:border-[#c8a94d]/60'}`} />
                      {errors[f.key] && <p id={`checkout-${f.key}-error`} role="alert" className="text-red-400 text-xs mt-1">{errors[f.key]}</p>}
                    </div>
                  ))}
                  <p className="sm:col-span-2 text-xs text-[#7a6f64] break-words">Email xác nhận: <span className="text-[#ede7dc]">{form.email}</span></p>
                </div>
              </div>

              {/* Shipping address */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">02 · Địa chỉ giao hàng</div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="checkout-address" className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Địa chỉ</label>
                    <textarea id="checkout-address" aria-label="Địa chỉ" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'checkout-address-error checkout-address-hint' : 'checkout-address-hint'} autoComplete="street-address" required minLength={8} maxLength={500} rows={3} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
                      className={`w-full bg-[#1c1815] border px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none placeholder-[#7a6f64] transition-colors ${errors.address ? 'border-red-700' : 'border-[#2b2520] focus:border-[#c8a94d]/60'}`} />
                    <p id="checkout-address-hint" className="text-xs text-[#7a6f64] mt-2">Nhập đầy đủ địa chỉ nhận hàng.</p>
                    {errors.address && <p id="checkout-address-error" role="alert" className="text-red-400 text-xs mt-1">{errors.address}</p>}
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">03 · Phương thức thanh toán</div>
                {methodsError && <p role="status" className="text-xs text-[#b5a99b] mb-3">Chưa kiểm tra được VNPAY. Bạn vẫn có thể chọn trả khi nhận hàng. <button type="button" className="min-h-11 underline text-[#c8a94d]" onClick={() => setMethodsAttempt(value => value + 1)}>Thử tải VNPAY</button></p>}
                <div className="space-y-3">
                  {payments.filter(payment => payment.id === 'cod' || vnpayAvailable).map(p => (
                    <label key={p.id}
                      className={`payment-option flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-sm border cursor-pointer transition-all ${form.payment === p.id ? 'border-[#c8a94d]/50 bg-[#c8a94d]/5' : 'border-[#2b2520] hover:border-[#2b2520]/80'}`}>
                      <input type="radio" name="payment" value={p.id} checked={form.payment === p.id} onChange={() => set('payment', p.id)} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.payment === p.id ? 'border-[#c8a94d]' : 'border-[#2b2520]'}`}>
                        {form.payment === p.id && <div className="w-2 h-2 rounded-full bg-[#c8a94d]" />}
                      </div>
                      <svg className="shrink-0" width="20" height="20" fill="none" stroke={form.payment === p.id ? '#c8a94d' : '#7a6f64'} strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                      </svg>
                      <div className="min-w-0 break-words">
                        <div className="text-sm text-[#ede7dc] font-medium">{p.label}</div>
                        <div className="text-xs text-[#7a6f64] mt-0.5">{p.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Right: summary */}
            <div className="min-w-0 lg:sticky lg:top-24 h-fit space-y-4">
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-4">Đơn hàng của bạn</div>
                <div className="space-y-4 mb-5">
                  {items.map(item => {
                    const bg = catColor[item.book.category] || '#2b2520'
                    return (
                      <div key={item.book.id} className="flex gap-3 items-center">
                        <div className="w-10 h-14 rounded-sm overflow-hidden shrink-0" style={{ backgroundColor: bg }}>
                          <img {...coverImage(item.book.cover, '40px')} decoding="async" alt="" className="w-full h-full object-cover"
                            onError={(e) => { imgErrors[item.book.id] = true; (e.target as HTMLImageElement).style.display = 'none' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#ede7dc] leading-snug line-clamp-2">{item.book.title}</div>
                          <div className="text-[10px] text-[#7a6f64] mt-0.5">× {item.qty}</div>
                        </div>
                        <div className="text-xs font-mono text-[#c8a94d] shrink-0">{fmt(item.book.price * item.qty)}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Coupon */}
                <div className="border-t border-[#22201d] pt-4">
                  {couponApplied ? (
                    <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-700/30 px-3 py-2 rounded-sm">
                      <div>
                        <div className="text-xs text-emerald-400 font-mono font-bold">{couponApplied.code}</div>
                        <div className="text-[10px] text-emerald-300/70">{couponApplied.label}</div>
                      </div>
                      <button type="button" disabled={submitting || uncertain} onClick={() => { setCouponApplied(null); setCoupon('') }} className="min-h-11 min-w-11 text-xs text-emerald-400 hover:text-red-400 transition-colors">✕ Bỏ</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input aria-label="Mã ưu đãi" autoCapitalize="characters" autoComplete="off" enterKeyHint="done" disabled={checkingCoupon || submitting || uncertain} value={coupon} onChange={e => { setCoupon(e.target.value); setCouponError('') }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon() } }}
                          placeholder="Nhập mã ưu đãi..."
                          className="min-w-0 flex-1 bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-3 py-2 text-xs rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] font-mono uppercase" />
                        <button type="button" disabled={checkingCoupon || submitting || uncertain} onClick={() => void applyCoupon()} className="min-h-11 px-4 py-2 bg-[#c8a94d]/20 border border-[#c8a94d]/40 text-[#c8a94d] text-xs font-semibold rounded-sm hover:bg-[#c8a94d]/30 transition-colors whitespace-nowrap">
                          {checkingCoupon ? 'Đang kiểm tra…' : 'Áp dụng'}
                        </button>
                      </div>
                      {couponError && <p role="alert" className="text-xs text-red-400 mt-1.5">{couponError}</p>}
                      <p className="text-[10px] text-[#7a6f64] mt-1.5">Ưu đãi được xác nhận khi đặt hàng.</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#22201d] pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7a6f64]">Tạm tính</span>
                    <span className="text-[#ede7dc] font-mono">{fmt(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-400">Ưu đãi ({couponApplied?.code})</span>
                      <span className="text-emerald-400 font-mono">−{fmt(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#7a6f64]">Vận chuyển</span>
                    <span className={shipping === 0 ? 'text-emerald-400 font-mono' : 'text-[#ede7dc] font-mono'}>
                      {shipping === 0 ? 'Miễn phí' : fmt(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t border-[#22201d]">
                    <span className="text-[#ede7dc]">Tổng cộng</span>
                    <span className="font-display text-xl text-[#c8a94d]">{fmt(total)}</span>
                  </div>
                </div>
              </div>

              {submitError && <div role="alert" className="border border-red-700/50 p-4 text-sm text-red-400 rounded-sm">
                <p>{submitError}</p>
                {uncertain && <p className="mt-2">Chưa xác nhận được đơn đã tạo hay chưa. Thử lại tại đây giữ nguyên yêu cầu; hãy kiểm tra đơn hàng trước khi tải lại trang hoặc đặt đơn mới.</p>}
                <Link to="/orders" className="inline-flex min-h-11 items-center underline mt-1">Xem đơn hàng của tôi</Link>
              </div>}
              <button type="submit" disabled={submitting || checkingCoupon}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-sm font-semibold text-sm transition-all ${submitting ? 'bg-[#2b2520] text-[#7a6f64] cursor-not-allowed' : 'btn-gold text-[#0b0907]'}`}>
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-[#7a6f64] border-t-transparent rounded-full animate-spin" />Đang xử lý...</>
                ) : (
                  <>{uncertain ? 'Thử lại đặt hàng' : 'Đặt hàng'}<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></>
                )}
              </button>
              <p className="text-center text-[10px] text-[#7a6f64]">Bằng cách đặt hàng, bạn đồng ý với điều khoản dịch vụ của chúng tôi</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}


export function ConfirmPage({ orderNum, items, onHome, onOrders, actualTotal, actualStatus = 'pending', createdAt }: {
  orderNum: string; items: CartItem[]; onHome: () => void; onOrders: () => void;
  actualTotal?: number; actualStatus?: Order['status']; createdAt?: string;
}) {
  const total = actualTotal ?? items.reduce((sum, item) => sum + item.book.price * item.qty, 0)
  const status = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Đã giao', cancelled: 'Đã hủy' }[actualStatus]
  return <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6">
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-3xl mb-3">Đơn hàng {orderNum}</h1>
      <p role="status" className="text-[#c8a94d] mb-2">{status}</p>
      {createdAt && <p className="text-sm text-[#b5a99b] mb-6">Đặt lúc {new Date(createdAt).toLocaleString('vi-VN')}</p>}
      <div className="bg-[#131110] border border-[#22201d] rounded-sm p-5 sm:p-6 mb-6">
        <ul className="space-y-4 mb-5">{items.map(item => <li key={item.book.id} className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="min-w-0 flex-1">{item.book.title} × {item.qty}</span>
          <span className="text-[#c8a94d]">{fmt(item.book.price * item.qty)}</span>
        </li>)}</ul>
        <div className="flex justify-between gap-3 border-t border-[#22201d] pt-4"><span>Tổng cộng</span><strong className="text-[#c8a94d]">{fmt(total)}</strong></div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onOrders} className="btn-gold px-6 py-3 text-[#0b0907]">Xem chi tiết đơn hàng</button>
        <button onClick={onHome} className="border border-[#2b2520] px-6 py-3">Về trang chủ</button>
      </div>
    </div>
  </div>
}


export function WishlistPage({ wishlist, onRemove, onAdd, onSelect, onCatalog }: {
  wishlist: typeof BOOKS; onRemove: (id: number) => void | Promise<void>
  onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void; onCatalog: () => void
}) {
  const light = useTheme() === 'light'

  return (
    <div className="min-h-screen pt-16">
      <div className={`border-b ${light ? 'border-[#d5cfc4] bg-[#ede4d4]' : 'border-[#22201d] bg-[#0f0d0b]'}`}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <SectionLabel>Bộ sưu tập</SectionLabel>
          <h1 className={`font-display text-4xl md:text-5xl font-medium mt-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>
            Sách yêu thích
            {wishlist.length > 0 && <span className="ml-3 text-2xl text-[#7a6f64] font-sans font-normal">{wishlist.length} cuốn</span>}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {wishlist.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full border border-[#2b2520] flex items-center justify-center mx-auto mb-6">
              <svg width="26" height="26" fill="none" stroke="#7a6f64" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </div>
            <p className={`font-display text-2xl mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Chưa có sách yêu thích</p>
            <p className="text-sm text-[#7a6f64] mb-8">Thêm sách vào danh sách yêu thích để dễ tìm lại sau.</p>
            <button onClick={onCatalog} className="btn-gold text-[#0b0907] text-sm font-semibold px-8 py-3 rounded-sm">Khám phá sách</button>
          </div>
        ) : (
          <div className="wishlist-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {wishlist.map(book => <BookCard key={book.id} book={book} onAdd={onAdd} onSelect={() => onSelect(book)} onRemove={() => onRemove(book.id)} />)}
          </div>
        )}
      </div>
    </div>
  )
}
