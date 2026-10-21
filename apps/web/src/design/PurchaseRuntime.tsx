import { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api, ApiError } from '../lib/api';
import { AsyncState } from '../components/AsyncState';
import { CartRecoveryNotice } from '../components/CartRecoveryNotice';
import type { Book, Order } from '../types';
import { useToast } from './Reference';
import { RuntimeCtx, toDesign } from './RuntimeData';
import * as D from './PurchaseReference';
export function Cart() {
  const { books } = useContext(RuntimeCtx); const { cart, loading, error, recovery, mutating, loadCart, updateItem, removeItem } = useCart(); const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const inFlight = useRef(false);
  async function change(action: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMutationError('');
    try { await action(); } catch (cause) {
      if (!(cause instanceof ApiError && ['CART_RESULT_UNCERTAIN', 'CART_SYNC_REQUIRED'].includes(cause.code))) setMutationError(cause instanceof Error ? cause.message : 'Không thể cập nhật giỏ');
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!recovery && (error || (loading && !cart))) return <AsyncState error={error} label="Đang tải giỏ hàng…" onRetry={() => void loadCart().catch(() => {})} />;
  if (!cart?.items.length && recovery) return <div className="pt-32 px-6 max-w-7xl mx-auto"><h1 className="font-display text-3xl">Giỏ hàng đang chờ cập nhật</h1><CartRecoveryNotice inline /></div>;
  const items = (cart?.items ?? []).map(item => ({ book: toDesign({ categoryId: 0, categoryName: '', description: '', ...books.find(book => book.id === item.bookId), ...item, id: item.bookId }), qty: item.quantity }));
  return <D.CartPage items={items} error={mutationError} notice={<CartRecoveryNotice inline />} busy={busy || loading || mutating || Boolean(recovery)} onContinue={() => navigate('/catalog')} onCheckout={() => navigate('/checkout')}
    onUpdate={(bookId, qty) => { const item = cart?.items.find(item => item.bookId === bookId); if (item) void change(() => updateItem(item.id, qty)); }}
    onRemove={bookId => { const item = cart?.items.find(item => item.bookId === bookId); if (item) void change(() => removeItem(item.id)); }} />;
}

export function Wishlist() {
  const { add, select } = useContext(RuntimeCtx); const [books, setBooks] = useState<Book[]>([]); const navigate = useNavigate(); const toast = useToast();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    void api<Book[]>('/api/profile/wishlist', { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) setBooks(result.data); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [attempt]);
  if (loading || error) return <AsyncState error={error} label="Đang tải sách yêu thích…" onRetry={() => setAttempt(value => value + 1)} />;
  return <D.WishlistPage wishlist={books.map(toDesign)} onAdd={add} onSelect={select} onCatalog={() => navigate('/catalog')} onRemove={id => api(`/api/profile/wishlist/${id}`, { method: 'DELETE' }).then(() => { setBooks(current => current.filter(book => book.id !== id)); window.dispatchEvent(new Event('wishlist-changed')); }).catch(cause => toast(cause.message, 'error'))} />;
}


export function Checkout() {
  const { books } = useContext(RuntimeCtx); const { cart, clearLocal, loading, error, recovery, mutating, loadCart } = useCart(); const navigate = useNavigate();
  const completed = useRef(false);
  if (recovery || mutating) return <div className="pt-32 px-6 max-w-7xl mx-auto"><h1 className="font-display text-3xl">Cập nhật giỏ hàng trước khi đặt hàng</h1><CartRecoveryNotice inline /></div>;
  if (error || (loading && !cart)) return <AsyncState error={error} label="Đang tải giỏ hàng…" onRetry={() => void loadCart().catch(() => {})} />;
  if (!cart?.items.length) return completed.current ? <div className="pt-32 px-6">Đang mở xác nhận đơn hàng…</div> : <Navigate to="/cart" replace />;
  const items = cart.items.map(item => ({ book: toDesign({ categoryId: 0, categoryName: '', description: '', ...books.find(book => book.id === item.bookId), ...item, id: item.bookId }), qty: item.quantity }));
  return <D.CheckoutPage items={items} onBack={() => navigate('/cart')} onConfirm={id => { completed.current = true; clearLocal(); navigate(`/confirmation/${id}`, { state: { items } }); }} />;
}


export function Confirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setOrder(null); setError(null);
    void api<Order>(`/api/orders/${encodeURIComponent(id ?? '')}`, { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) setOrder(result.data); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause); });
    return () => abort.abort();
  }, [id, attempt]);
  if (!order) {
    const denied = error instanceof ApiError && error.status === 403;
    const missing = error instanceof ApiError && error.status === 404;
    return <>
      <AsyncState label="Đang tải đơn hàng…" error={error ? (denied ? 'Bạn không có quyền xem đơn hàng này.' : missing ? 'Không tìm thấy đơn hàng.' : error.message) : undefined}
        onRetry={denied || missing ? undefined : () => setAttempt(value => value + 1)} />
      {error && <div className="text-center pb-16"><button className="btn-gold px-6 py-3 text-[#0b0907]" onClick={() => navigate('/orders')}>Xem đơn hàng của tôi</button></div>}
    </>;
  }
  const items = (order.items ?? []).map(item => ({ book: { id: item.bookId, title: item.bookTitle, price: Number(item.unitPrice), author: '', category: '', stock: 0, isbn: '', cover: '', description: '' }, qty: item.quantity }));
  return <D.ConfirmPage orderNum={`#${order.id}`} actualTotal={Number(order.totalAmount)} actualStatus={order.status} createdAt={order.createdAt} items={items} onHome={() => navigate('/')} onOrders={() => navigate('/orders', { state: { createdOrderId: order.id } })} />;
}
