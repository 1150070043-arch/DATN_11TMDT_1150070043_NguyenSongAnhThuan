import { Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, ApiError } from '../lib/api';
import { AsyncState } from '../components/AsyncState';
import { CartRecoveryNotice } from '../components/CartRecoveryNotice';
import { scheduleBrandFonts } from '../lib/brand-fonts';
import type { Book, Category } from '../types';
import * as D from './Reference';
import { RuntimeCtx, toDesign, normalize, type DesignBook } from './RuntimeData';
import { StorefrontMotion } from './StorefrontExperience';
export { toDesign } from './RuntimeData';
const route: Record<D.Page, string> = { home: '/', catalog: '/catalog', about: '/about', contact: '/contact', book: '/catalog', cart: '/cart', checkout: '/checkout', confirm: '/confirmation', admin: '/admin', settings: '/profile', login: '/login', register: '/register', forgot: '/forgot-password', wishlist: '/wishlist', orders: '/orders', '404': '/404' };

export function DesignLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, addItem, recovery } = useCart();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
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
    setLoading(true);
    setError('');
    async function loadBooks() {
      const first = await api<Book[]>('/api/books?limit=40&sort=newest', { signal: abort.signal });
      const pages = Math.ceil(Number(first.meta?.total ?? first.data.length) / 40);
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => api<Book[]>(`/api/books?limit=40&sort=newest&page=${index + 2}`, { signal: abort.signal })));
      return [...first.data, ...rest.flatMap(result => result.data)];
    }
    Promise.all([loadBooks(), api<Category[]>('/api/books/categories', { signal: abort.signal })])
      .then(([result, cats]) => { if (!abort.signal.aborted) { setBooks(result); setCategories(cats.data); } })
      .catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không thể tải sách'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [attempt]);
  useEffect(() => {
    const reload = () => { if (user) void api<Book[]>('/api/profile/wishlist').then(result => setWishlistCount(result.data.length)).catch(() => {}); else setWishlistCount(0); };
    reload(); window.addEventListener('wishlist-changed', reload);
    return () => window.removeEventListener('wishlist-changed', reload);
  }, [user, location.pathname]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('bookguard-theme', theme); }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.surface = location.pathname.startsWith('/admin') ? 'admin' : 'storefront';
    return () => { delete document.documentElement.dataset.surface; };
  }, [location.pathname]);
  useEffect(() => {
    if (loading) return;
    return scheduleBrandFonts();
  }, [loading]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const designBooks = useMemo(() => {
    const rank = (book: Book) => { const index = D.BOOKS.findIndex(item => normalize(item.title) === normalize(book.title)); return index < 0 ? 100 : index; };
    return [...books].sort((a, b) => rank(a) - rank(b)).map(toDesign);
  }, [books]);
  const designCategories = useMemo(() => categories.map(category => {
    const template = D.CATEGORIES.find(item => normalize(item.name) === normalize(category.name)) ?? D.CATEGORIES[0];
    return { ...template, id: category.slug, name: category.name === 'Lịch sử - xã hội' ? 'Lịch sử - Xã hội' : category.name, count: books.filter(book => book.categoryId === category.id).length };
  }).sort((a,b) => D.CATEGORIES.findIndex(item => item.name === a.name) - D.CATEGORIES.findIndex(item => item.name === b.name)), [books, categories]);
  async function add(book: DesignBook, qty = 1, checkout = false) {
    if (!user) { navigate('/login', { state: { from: location.pathname + location.search } }); return false; }
    try {
      const result = await addItem(book.id, qty);
      if (checkout) navigate(result.synchronized ? '/checkout' : '/cart');
      else if (result.synchronized) toast(`Đã thêm "${book.title}" vào giỏ`, 'success');
      return true;
    } catch (cause) {
      if (!(cause instanceof ApiError && ['CART_RESULT_UNCERTAIN', 'CART_SYNC_REQUIRED'].includes(cause.code))) toast(cause instanceof Error ? cause.message : 'Không thể thêm sách', 'error');
      return false;
    }
  }
  function select(book: DesignBook) { const real = books.find(item => item.id === book.id); if (real) navigate(`/books/${real.slug}`); }
  const isAdmin = location.pathname.startsWith('/admin') || page === 'admin';
  const showFooter = !isAdmin && ['home', 'catalog', 'about', 'contact', 'book', 'cart', 'wishlist'].includes(page);
  return <D.ThemeCtx.Provider value={theme}><D.ToastCtx.Provider value={toast}>
    <D.CatalogLoadingCtx.Provider value={loading}>
    <D.DataCtx.Provider value={{ books: designBooks, categories: designCategories, orders: [], accounts: [], events: [] }}>
      <RuntimeCtx.Provider value={{ books, add, buy: (book, qty) => add(book, qty, true), select }}>
        <div className={isAdmin ? "min-h-screen admin-shell" : "min-h-screen storefront-shell"} data-theme={theme}>
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
          <a className="skip-link" href="#main-content">Đến nội dung chính</a>
          <CartRecoveryNotice />
          {!isAdmin && <StorefrontMotion />}
          <main id="main-content" tabIndex={-1} className={isAdmin ? 'h-screen overflow-hidden' : recovery && !['/cart', '/checkout'].includes(location.pathname) ? 'min-h-screen pb-48' : 'min-h-screen'}>
            {['home', 'catalog'].includes(page) && error
              ? <AsyncState error={error} label="Đang tải sách…" onRetry={() => setAttempt(value => value + 1)} />
              : <Suspense fallback={<AsyncState label="Đang mở trang…" />}>{isAdmin ? <Outlet /> : <div key={location.pathname} className="storefront-page-enter"><Outlet /></div>}</Suspense>}
          </main>
          {showFooter && <D.Footer setPage={next => navigate(route[next])} />}
          <D.ToastContainer toasts={toasts} remove={id => setToasts(current => current.filter(item => item.id !== id))} />
        </div>
      </RuntimeCtx.Provider>
    </D.DataCtx.Provider>
    </D.CatalogLoadingCtx.Provider>
  </D.ToastCtx.Provider></D.ThemeCtx.Provider>;
}

export function Home() {
  const { user } = useAuth();
  const { add, select } = useContext(RuntimeCtx);
  const navigate = useNavigate();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <D.HomePage onCatalog={category => navigate(category ? `/catalog?category=${encodeURIComponent(category)}` : '/catalog')} onAdd={add} onSelect={select} />;
}
export function Catalog() { const { add, select } = useContext(RuntimeCtx); return <D.CatalogPage onAdd={add} onSelect={select} />; }
export function Detail() {
  const { slug } = useParams(); const { add, select } = useContext(RuntimeCtx); const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null); const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setBook(null); setError('');
    void api<Book>(`/api/books/${encodeURIComponent(slug ?? '')}`, { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) setBook(result.data); })
      .catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [slug, attempt]);
  if (!book) return <AsyncState error={error} label="Đang mở sách…" onRetry={() => setAttempt(value => value + 1)} />;
  return <D.ReviewDataCtx.Provider value={{ reviews: book.reviews ?? [], reload: async () => { const result = await api<Book>(`/api/books/${book.slug}`); setBook(result.data); } }}><D.BookDetailPage key={book.id} book={toDesign(book)} onAdd={add} onSelect={select} onBack={() => navigate('/catalog')} /></D.ReviewDataCtx.Provider>;
}
export function NotFound() { const navigate = useNavigate(); return <D.NotFoundPage onHome={() => navigate('/')} />; }
