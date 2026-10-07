import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, assetUrl } from '../lib/api';
import type { Book, Category, Order } from '../types';
import * as D from './Reference';

type DesignBook = typeof D.BOOKS[number];
const RuntimeCtx = createContext({ books: [] as Book[], add: async (_book: DesignBook, _qty?: number) => false, select: (_book: DesignBook) => {} });
const route: Record<D.Page, string> = { home: '/', catalog: '/catalog', book: '/catalog', cart: '/cart', checkout: '/checkout', confirm: '/confirmation', admin: '/admin', settings: '/profile', login: '/login', register: '/register', forgot: '/forgot-password', wishlist: '/wishlist', orders: '/orders', '404': '/404' };
const normalize = (text?: string) => (text ?? '').toLocaleLowerCase('vi').normalize('NFC');

export function toDesign(book: Book): DesignBook {
  const reference = D.BOOKS.find(item => normalize(item.title) === normalize(book.title));
  const cached = reference && reference.isbn !== '9780061241628' ? `/design/covers/${reference.isbn}-L.jpg` : undefined;
  const cover = book.coverUrl?.startsWith('/uploads/') ? assetUrl(book.coverUrl) : cached ?? reference?.cover ?? assetUrl(book.coverUrl);
  return { id: book.id, title: book.title ?? '', author: book.author ?? '', price: Number(book.price ?? 0), stock: book.stock ?? 0, category: (book.categoryName === 'Lịch sử - xã hội' ? 'Lịch sử - Xã hội' : book.categoryName) ?? 'Khác', description: book.description ?? '', isbn: book.isbn ?? '', cover };
}

export function DesignLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addItem } = useCart();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('bookguard-theme') === 'light' ? 'light' : 'dark');
  const [toasts, setToasts] = useState<D.Toast[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const page = Object.entries(route).find(([, value]) => value === location.pathname)?.[0] as D.Page | undefined ?? ((location.pathname.startsWith('/books/') || location.pathname.startsWith('/book/')) ? 'book' : '404');
  const toast = useCallback((msg: string, type: D.Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(current => [...current, { id, msg, type }]);
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    async function loadBooks() {
      const first = await api<Book[]>('/api/books?limit=40&sort=newest', { signal: abort.signal });
      const pages = Math.ceil(Number(first.meta?.total ?? first.data.length) / 40);
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => api<Book[]>(`/api/books?limit=40&sort=newest&page=${index + 2}`, { signal: abort.signal })));
      return [...first.data, ...rest.flatMap(result => result.data)];
    }
    Promise.all([loadBooks(), api<Category[]>('/api/books/categories', { signal: abort.signal })])
      .then(([result, cats]) => { setBooks(result); setCategories(cats.data); setError(''); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải sách'); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const reload = () => { if (user) void api<Book[]>('/api/profile/wishlist').then(result => setWishlistCount(result.data.length)).catch(() => {}); else setWishlistCount(0); };
    reload(); window.addEventListener('wishlist-changed', reload);
    return () => window.removeEventListener('wishlist-changed', reload);
  }, [user, location.pathname]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('bookguard-theme', theme); }, [theme]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    const observe = () => document.querySelectorAll('.reveal:not(.visible)').forEach(node => observer.observe(node));
    const mutation = new MutationObserver(observe);
    mutation.observe(document.getElementById('main-content')!, { childList: true, subtree: true });
    observe();
    return () => { mutation.disconnect(); observer.disconnect(); };
  }, [location.pathname, books]);

  const designBooks = useMemo(() => {
    const rank = (book: Book) => { const index = D.BOOKS.findIndex(item => normalize(item.title) === normalize(book.title)); return index < 0 ? 100 : index; };
    return [...books].sort((a, b) => rank(a) - rank(b)).map(toDesign);
  }, [books]);
  const designCategories = useMemo(() => categories.map(category => {
    const template = D.CATEGORIES.find(item => normalize(item.name) === normalize(category.name)) ?? D.CATEGORIES[0];
    return { ...template, id: category.slug, name: category.name === 'Lịch sử - xã hội' ? 'Lịch sử - Xã hội' : category.name, count: books.filter(book => book.categoryId === category.id).length };
  }).sort((a,b) => D.CATEGORIES.findIndex(item => item.name === a.name) - D.CATEGORIES.findIndex(item => item.name === b.name)), [books, categories]);
  async function add(book: DesignBook, qty = 1) {
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return false; }
    try { await addItem(book.id, qty); toast(`Đã thêm "${book.title}" vào giỏ`, 'success'); return true; }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Không thể thêm sách', 'error'); return false; }
  }
  function select(book: DesignBook) { const real = books.find(item => item.id === book.id); if (real) navigate(`/books/${real.slug}`); }
  const isAdmin = location.pathname.startsWith('/admin') || page === 'admin';
  const showFooter = !isAdmin && ['home', 'catalog', 'book', 'cart', 'wishlist'].includes(page);
  return <D.ThemeCtx.Provider value={theme}><D.ToastCtx.Provider value={toast}>
    <D.DataCtx.Provider value={{ books: designBooks, categories: designCategories, orders: [], accounts: [], events: [] }}>
      <RuntimeCtx.Provider value={{ books, add, select }}>
        <div className="min-h-screen" data-theme={theme} style={{ background: isAdmin ? '#0b0907' : (theme === 'light' ? '#f4ede0' : '#0b0907'), color: isAdmin ? '#ede7dc' : (theme === 'light' ? '#1a1410' : '#ede7dc') }}>
          {!isAdmin && user?.role === 'admin' && (
            <div className="bg-[#1a1410] border-b border-[#c8a94d]/40 text-[#c8a94d] px-6 py-2 text-xs font-mono flex items-center justify-between sticky top-0 z-[60]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c8a94d] animate-pulse" />
                <span>Bạn đang đăng nhập với quyền <strong>Quản trị viên (Admin)</strong></span>
              </div>
              <button
                onClick={() => navigate('/admin')}
                className="px-3 py-1 bg-[#c8a94d] text-[#0b0907] rounded font-semibold text-xs hover:bg-[#d4b75c] transition-colors cursor-pointer"
              >
                Vào Cổng Quản Trị &rarr;
              </button>
            </div>
          )}
          {!isAdmin && <D.Navbar page={page} setPage={next => navigate(route[next])} cart={cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0} onCartClick={() => navigate('/cart')} theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} wishlistCount={wishlistCount} onWishlistClick={() => navigate('/wishlist')} />}
          <main id="main-content" className={isAdmin ? 'h-screen overflow-hidden' : undefined}>
            {error && ['home', 'catalog'].includes(page) && <div className="fixed top-20 left-6 right-6 z-40 p-4 border border-red-900 bg-[#131110] text-red-300" role="alert">{error}</div>}
            <Outlet />
          </main>
          {showFooter && <D.Footer setPage={next => navigate(route[next])} />}
          <D.ToastContainer toasts={toasts} remove={id => setToasts(current => current.filter(item => item.id !== id))} />
        </div>
      </RuntimeCtx.Provider>
    </D.DataCtx.Provider>
  </D.ToastCtx.Provider></D.ThemeCtx.Provider>;
}

export function Home() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  const { add, select } = useContext(RuntimeCtx);
  const navigate = useNavigate();
  return <D.HomePage onCatalog={() => navigate('/catalog')} onAdd={add} onSelect={select} />;
}
export function Catalog() { const { add, select } = useContext(RuntimeCtx); return <D.CatalogPage onAdd={add} onSelect={select} />; }
export function Detail() {
  const { slug } = useParams(); const { add, select } = useContext(RuntimeCtx); const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null); const [error, setError] = useState('');
  useEffect(() => { setBook(null); void api<Book>(`/api/books/${encodeURIComponent(slug ?? '')}`).then(result => setBook(result.data)).catch(cause => setError(cause.message)); }, [slug]);
  if (!book) return <div className="pt-32 min-h-screen max-w-7xl mx-auto px-6">{error || 'Đang mở sách…'}</div>;
  return <D.ReviewDataCtx.Provider value={{ reviews: book.reviews ?? [], reload: async () => { const result = await api<Book>(`/api/books/${book.slug}`); setBook(result.data); } }}><D.BookDetailPage key={book.id} book={toDesign(book)} onAdd={add} onSelect={select} onBack={() => navigate('/catalog')} /></D.ReviewDataCtx.Provider>;
}
export function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;
  const getDestination = (targetUser?: { role?: string } | null) => {
    const role = (targetUser ?? user)?.role;
    if (role === 'admin') {
      return from?.startsWith('/admin') ? from : '/admin';
    }
    if (from && from !== '/' && from.startsWith('/') && !from.startsWith('//')) return from;
    return '/';
  };
  if (user) return <Navigate to={getDestination(user)} replace />;
  return register ? (
    <D.RegisterPage onLogin={() => navigate('/login')} onBack={() => navigate('/login')} />
  ) : (
    <D.LoginPage onLogin={(loggedUser) => navigate(getDestination(loggedUser))} onRegister={() => navigate('/register')} onForgot={() => navigate('/forgot-password')} />
  );
}
export function Forgot() { const navigate = useNavigate(); return <D.ForgotPasswordPage onBack={() => navigate('/login')} />; }
export function Settings() { const navigate = useNavigate(); return <D.SettingsPage onBack={() => navigate('/')} />; }
export function NotFound() { const navigate = useNavigate(); return <D.NotFoundPage onHome={() => navigate('/')} />; }
export function Cart() {
  const { books } = useContext(RuntimeCtx); const { cart, loading, updateItem, removeItem } = useCart(); const navigate = useNavigate(); const toast = D.useToast();
  if (loading) return <div className="pt-32 px-6">Đang tải giỏ hàng…</div>;
  const items = (cart?.items ?? []).map(item => ({ book: toDesign(books.find(book => book.id === item.bookId) ?? { ...item, id: item.bookId, categoryId: 0, categoryName: '', description: '' }), qty: item.quantity }));
  return <D.CartPage items={items} onContinue={() => navigate('/catalog')} onCheckout={() => navigate('/checkout')}
    onUpdate={(bookId, qty) => { const item = cart?.items.find(item => item.bookId === bookId); if (item) void updateItem(item.id, qty).catch(cause => toast(cause.message, 'error')); }}
    onRemove={bookId => { const item = cart?.items.find(item => item.bookId === bookId); if (item) void removeItem(item.id).catch(cause => toast(cause.message, 'error')); }} />;
}
export function Wishlist() {
  const { add, select } = useContext(RuntimeCtx); const [books, setBooks] = useState<Book[]>([]); const navigate = useNavigate(); const toast = D.useToast();
  useEffect(() => { void api<Book[]>('/api/profile/wishlist').then(result => setBooks(result.data)).catch(cause => toast(cause.message, 'error')); }, [toast]);
  return <D.WishlistPage wishlist={books.map(toDesign)} onAdd={add} onSelect={select} onCatalog={() => navigate('/catalog')} onRemove={id => { void api(`/api/profile/wishlist/${id}`, { method: 'DELETE' }).then(() => { setBooks(current => current.filter(book => book.id !== id)); window.dispatchEvent(new Event('wishlist-changed')); }).catch(cause => toast(cause.message, 'error')); }} />;
}

export function Checkout() {
  const { books } = useContext(RuntimeCtx); const { cart, clearLocal, loading } = useCart(); const navigate = useNavigate();
  const completed = useRef(false);
  if (loading) return <div className="pt-32 px-6">Đang tải giỏ hàng…</div>;
  if (!cart?.items.length) return completed.current ? <div className="pt-32 px-6">Đang mở xác nhận đơn hàng…</div> : <Navigate to="/cart" replace />;
  const items = cart.items.map(item => ({ book: toDesign(books.find(book => book.id === item.bookId) ?? { ...item, id: item.bookId, categoryId: 0, categoryName: '', description: '' }), qty: item.quantity }));
  return <D.CheckoutPage items={items} onBack={() => navigate('/cart')} onConfirm={id => { completed.current = true; clearLocal(); navigate(`/confirmation/${id}`, { state: { items } }); }} />;
}

export function Confirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Order>(`/api/orders/${id}`)
      .then(result => setOrder(result.data))
      .catch(cause => setError(cause.message));
  }, [id]);

  if (!order) {
    if (error) {
      return (
        <div className="min-h-[80vh] pt-28 pb-16 px-4 sm:px-6 flex items-center justify-center">
          <div className="max-w-xl w-full bg-[#120f0d] border border-[#2b2520] rounded-2xl p-7 sm:p-10 shadow-2xl text-center relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-[#c8a94d]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Security Shield Icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-rose-950/50 border border-rose-500/40 animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-b from-rose-900/40 to-[#120f0d] flex items-center justify-center border border-rose-500/25">
                <svg width="34" height="34" fill="none" stroke="#f43f5e" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.959 11.959 0 0 1 12 2.714ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              BẢO VỆ PHÂN QUYỀN ĐỐI TƯỢNG · 403 FORBIDDEN
            </div>

            <h1 className="font-display text-2xl sm:text-3xl text-[#ede7dc] font-bold mb-3 tracking-tight">
              Từ chối quyền truy cập đơn hàng
            </h1>

            {id && (
              <div className="inline-block bg-[#1a1613] border border-[#2b2520] text-[#c8a94d] font-mono text-xs px-3.5 py-1.5 rounded-md mb-4">
                Mã đơn tham chiếu: #{id}
              </div>
            )}

            <div className="bg-[#181310] border border-rose-500/25 rounded-xl p-4 mb-5 text-left">
              <div className="text-xs font-mono text-rose-400 font-semibold mb-1 flex items-center gap-1.5">
                <span>✕</span> Thông báo hệ thống:
              </div>
              <p className="text-rose-200 text-sm font-medium">
                {error}
              </p>
            </div>

            <p className="text-[#8c8275] text-xs leading-relaxed max-w-md mx-auto mb-8">
              Cơ chế phòng thủ <strong className="text-[#ede7dc]">Lớp 4 (RBAC & Phân quyền sở hữu)</strong> của BookGuard đã kích hoạt để ngăn chặn lỗ hổng <strong>IDOR (OWASP WSTG-ATHZ-04)</strong>. Bạn chỉ có thể xem các đơn hàng do chính tài khoản của bạn đặt mua.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/orders')}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#c8a94d] text-[#0b0907] rounded-lg font-semibold text-sm hover:bg-[#d4b75c] transition-colors cursor-pointer shadow-lg shadow-[#c8a94d]/10"
              >
                Xem đơn hàng của tôi
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#1a1613] text-[#ede7dc] border border-[#2b2520] rounded-lg font-medium text-sm hover:border-[#c8a94d] hover:text-[#c8a94d] transition-colors cursor-pointer"
              >
                Quay lại trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[80vh] pt-32 pb-16 px-6 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 border-2 border-[#c8a94d]/20 border-t-[#c8a94d] rounded-full animate-spin mb-4" />
        <div className="text-sm font-mono text-[#b5a99b]">Đang kiểm tra quyền truy cập và tải đơn hàng…</div>
      </div>
    );
  }

  const items = (location.state as { items?: D.CartItem[] })?.items ?? (order.items ?? []).map(item => ({ book: { id: item.bookId, title: item.bookTitle, price: Number(item.unitPrice), author: '', category: '', stock: 0, isbn: '', cover: '', description: '' }, qty: item.quantity }));
  return <D.ConfirmPage orderNum={`#${order.id}`} actualTotal={Number(order.totalAmount)} items={items} onHome={() => navigate('/')} onOrders={() => navigate('/orders', { state: { createdOrderId: order.id } })} />;
}
