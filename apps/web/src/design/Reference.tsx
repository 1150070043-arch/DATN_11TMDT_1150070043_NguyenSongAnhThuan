import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo, type ReactNode } from 'react'
import { api, assetUrl, setCsrfToken } from '../lib/api'
import { useAuth as useSession } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import type { Review, UserSession, Order, User } from '../types'

export const ThemeCtx = createContext<'dark' | 'light'>('dark')

export function useTheme() { return useContext(ThemeCtx) }

export type Page = 'home' | 'catalog' | 'admin' | 'book' | 'cart' | 'checkout' | 'confirm' | 'settings' | 'login' | 'register' | 'forgot' | 'wishlist' | 'orders' | '404'

export type AdminTab = 'overview' | 'orders' | 'books' | 'inventory' | 'offers' | 'categories' | 'accounts' | 'experiments' | 'security-compare' | 'security-events' | 'audit'

export type CartItem = { book: typeof BOOKS[0]; qty: number }

export const CATEGORIES = [
  { id: 'van-hoc', name: 'Văn học', count: 9, img: 'photo-1481627834876-b7833e8f5570', color: '#8b5e3c' },
  { id: 'cong-nghe', name: 'Công nghệ', count: 7, img: 'photo-1518770660439-4636190af475', color: '#2d6a8f' },
  { id: 'kinh-doanh', name: 'Kinh doanh', count: 4, img: 'photo-1507679799987-c73779587ccf', color: '#3d5a80' },
  { id: 'ky-nang', name: 'Kỹ năng', count: 6, img: 'photo-1434030216411-0b793f4b4173', color: '#5a4032' },
  { id: 'lich-su', name: 'Lịch sử - Xã hội', count: 6, img: 'photo-1461360370896-922624d12aa1', color: '#3b3035' },
  { id: 'thieu-nhi', name: 'Thiếu nhi', count: 4, img: 'photo-1512436991641-6745cdb1723f', color: '#4a3b28' },
]

export const BOOKS = [
  { id: 1, title: "The Web Application Hacker's Handbook", author: 'Dafydd Stuttard', price: 545000, category: 'Công nghệ', stock: 12, cover: 'https://covers.openlibrary.org/b/isbn/1118026470-L.jpg', description: 'Hướng dẫn kiểm tra bảo mật ứng dụng web toàn diện nhất.', isbn: '1118026470' },
  { id: 2, title: 'Atomic Habits', author: 'James Clear', price: 168000, category: 'Kỹ năng', stock: 25, cover: 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', description: 'Thay đổi thói quen nhỏ, tạo kết quả phi thường.', isbn: '9780735211292' },
  { id: 3, title: 'Sapiens', author: 'Yuval Noah Harari', price: 245000, category: 'Lịch sử - Xã hội', stock: 18, cover: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', description: 'Lược sử loài người từ thời kỳ đồ đá tới thế kỷ 21.', isbn: '9780062316097' },
  { id: 4, title: 'Nhà Giả Kim', author: 'Paulo Coelho', price: 88000, category: 'Văn học', stock: 30, cover: 'https://covers.openlibrary.org/b/isbn/9780061241628-L.jpg', description: 'Cuộc hành trình đi tìm kho báu và bản thân.', isbn: '9780061241628' },
  { id: 5, title: 'Clean Code', author: 'Robert C. Martin', price: 360000, category: 'Công nghệ', stock: 8, cover: 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg', description: 'Nghệ thuật viết code sạch và dễ bảo trì.', isbn: '9780132350884' },
  { id: 6, title: 'Tư Duy Nhanh Và Chậm', author: 'Daniel Kahneman', price: 210000, category: 'Kỹ năng', stock: 15, cover: 'https://covers.openlibrary.org/b/isbn/9780374533557-L.jpg', description: 'Khám phá hai hệ thống tư duy chi phối hành vi.', isbn: '9780374533557' },
  { id: 7, title: 'Đắc Nhân Tâm', author: 'Dale Carnegie', price: 98000, category: 'Kỹ năng', stock: 40, cover: 'https://covers.openlibrary.org/b/isbn/9780671027032-L.jpg', description: 'Nghệ thuật giao tiếp và tạo ảnh hưởng lâu dài.', isbn: '9780671027032' },
  { id: 8, title: 'Zero to One', author: 'Peter Thiel', price: 185000, category: 'Kinh doanh', stock: 20, cover: 'https://covers.openlibrary.org/b/isbn/9780804139021-L.jpg', description: 'Bí quyết xây dựng startup đi từ 0 đến 1.', isbn: '9780804139021' },
]

export const ORDERS = [
  { id: 160, customer: 'Nguyễn Minh An', date: '11:02 16 thg 9, 2026', status: 'Đã hủy', total: 1090000, items: "The Web Application Hacker's Handbook × 2" },
  { id: 159, customer: 'Trần Hải Bình', date: '10:45 16 thg 9, 2026', status: 'Đã giao', total: 336000, items: 'Atomic Habits × 2' },
  { id: 158, customer: 'Nguyễn Minh An', date: '09:30 16 thg 9, 2026', status: 'Đang giao', total: 245000, items: 'Sapiens × 1' },
  { id: 157, customer: 'Trần Hải Bình', date: '08:00 16 thg 9, 2026', status: 'Chờ xác nhận', total: 545000, items: "Web Hacker's Handbook × 1" },
  { id: 156, customer: 'Nguyễn Minh An', date: '07:15 15 thg 9, 2026', status: 'Đã giao', total: 98000, items: 'Đắc Nhân Tâm × 1' },
]

export const ACCOUNTS = [
  { name: 'Quản trị BookGuard', email: 'admin@bookguard.local', role: 'admin', verified: true, status: 'Hoạt động', created: '11:02 17 thg 9, 2026' },
  { name: 'Nguyễn Minh An', email: 'customer.a@bookguard.local', role: 'customer', verified: true, status: 'Hoạt động', created: '11:02 17 thg 9, 2026' },
  { name: 'Trần Hải Bình', email: 'customer.b@bookguard.local', role: 'customer', verified: true, status: 'Hoạt động', created: '11:02 17 thg 9, 2026' },
]

export const SECURITY_EVENTS = [
  { time: '11:15 17 thg 9, 2026', event: 'LOGIN_SUCCEEDED', id: 'd9bf854b-c0d2-4f59-89cb-8718aa1da023', level: 'info', request: 'POST /api/auth/login', detail: '{"userId":1,"sessionId":"cb86f784-fc74-4..."}' },
  { time: '11:15 17 thg 9, 2026', event: 'CSRF_BLOCKED', id: '46be6cd6-0778-4acc-b491-47cb9e4c5f8c', level: 'warning', request: 'POST /api/auth/refresh', detail: '{"hasCookie":false,"hasHeader":false}' },
  { time: '11:15 17 thg 9, 2026', event: 'LOGIN_SUCCEEDED', id: '875bfc25-a219-4471-9c65-0de59c961c02', level: 'info', request: 'POST /api/auth/login', detail: '{"userId":3,"sessionId":"6ceb16a6-f277-..."}' },
  { time: '11:14 17 thg 9, 2026', event: 'CSRF_BLOCKED', id: '7e8f9e5c-8670-4268-a3c3-f7c8b79700cb', level: 'warning', request: 'POST /api/auth/refresh', detail: '{"hasCookie":false,"hasHeader":false}' },
]

export const DataCtx = createContext({ books: [] as typeof BOOKS, categories: CATEGORIES, orders: [] as typeof ORDERS, accounts: [] as typeof ACCOUNTS, events: [] as typeof SECURITY_EVENTS })
export const ReviewDataCtx = createContext({ reviews: [] as Review[], reload: async () => {} })

export function useScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const handler = () => setY(window.scrollY)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return y
}

export function fmt(price: number) {
  return price.toLocaleString('vi-VN') + '\u00A0₫'
}

export function statusColor(s: string) {
  if (s === 'Đã giao' || s === 'Hoàn tất') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
  if (s === 'Đã hủy') return 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
  if (s === 'Đang giao') return 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
  return 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
}

export function levelColor(l: string) {
  if (l === 'warning') return 'bg-amber-900/40 text-amber-400 border border-amber-800/50'
  return 'bg-sky-900/40 text-sky-400 border border-sky-800/50'
}

export function Navbar({ page, setPage, cart, onCartClick, theme, onToggleTheme, wishlistCount, onWishlistClick }: { page: Page; setPage: (p: Page) => void; cart: number; onCartClick: () => void; theme: 'dark' | 'light'; onToggleTheme: () => void; wishlistCount: number; onWishlistClick: () => void }) {
  const { user, logout } = useSession()
  const scrollY = useScrollY()
  const solid = scrollY > 60
  const [mobileOpen, setMobileOpen] = useState(false)
  const light = theme === 'light'

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${solid ? (light ? 'bg-[#f4ede0]/95 backdrop-blur-md border-b border-[#d5cfc4]' : 'bg-[#0b0907]/95 backdrop-blur-md border-b border-[#22201d]') : 'bg-transparent'}`}>
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => setPage('home')} className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-sm bg-[#c8a94d] flex items-center justify-center">
            <span className="font-display font-bold text-[#0b0907] text-lg leading-none">T</span>
          </div>
          <div>
            <div className={`font-display font-semibold text-base leading-tight tracking-tight group-hover:text-[#c8a94d] transition-colors ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Thư An</div>
            <div className="text-[10px] tracking-[0.2em] text-[#7a6f64] uppercase leading-none">Nhà sách trực tuyến</div>
          </div>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {([['home', 'Trang chủ'], ['catalog', 'Sách']] as [Page, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`text-sm tracking-wide transition-colors ${page === p ? 'text-[#c8a94d]' : light ? 'text-[#5a4f44] hover:text-[#1a1410]' : 'text-[#b5a99b] hover:text-[#ede7dc]'}`}
            >
              {label}
            </button>
          ))}
          {user?.role === 'admin' && (
            <button
              onClick={() => setPage('admin')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#c8a94d] text-[#0b0907] font-semibold text-xs hover:bg-[#d4b75c] transition-colors cursor-pointer shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0b0907]" />
              Cổng Quản trị
            </button>
          )}
          <button onClick={() => setPage('settings')}
            className={`flex items-center gap-1.5 text-sm tracking-wide transition-colors ${page === 'settings' ? 'text-[#c8a94d]' : light ? 'text-[#5a4f44] hover:text-[#1a1410]' : 'text-[#b5a99b] hover:text-[#ede7dc]'}`}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Tài khoản
          </button>
          <button onClick={() => user ? void logout().then(() => setPage('login')) : setPage('login')}
            className={`px-4 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${page === 'login' || page === 'register' ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907]' : light ? 'border-[#c8a94d]/60 text-[#c8a94d] hover:bg-[#c8a94d]/10' : 'border-[#c8a94d]/50 text-[#c8a94d] hover:bg-[#c8a94d]/10'}`}>
            {user ? 'Đăng xuất' : 'Đăng nhập'}
          </button>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <button onClick={() => setPage('catalog')} aria-label="Tìm sách" className="hidden md:flex w-9 h-9 items-center justify-center text-[#7a6f64] hover:text-[#c8a94d] transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          {/* Theme toggle */}
          <button onClick={onToggleTheme} title={light ? 'Chuyển sang tối' : 'Chuyển sang sáng'}
            className={`hidden md:flex w-9 h-9 items-center justify-center transition-colors rounded-sm ${light ? 'text-[#5a4f44] hover:text-[#c8a94d] hover:bg-[#e8dfd0]' : 'text-[#7a6f64] hover:text-[#c8a94d] hover:bg-[#1c1815]'}`}>
            {light ? (
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            ) : (
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5"/>
                <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            )}
          </button>
          {/* Wishlist */}
          <button aria-label="Sách yêu thích" onClick={onWishlistClick} className={`relative hidden md:flex w-9 h-9 items-center justify-center transition-colors ${page === 'wishlist' ? 'text-[#c8a94d]' : light ? 'text-[#5a4f44] hover:text-[#c8a94d]' : 'text-[#7a6f64] hover:text-[#c8a94d]'}`}>
            <svg width="17" height="17" fill={wishlistCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            {wishlistCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{wishlistCount}</span>}
          </button>
          <button aria-label="Giỏ hàng" onClick={onCartClick} className={`relative flex w-9 h-9 items-center justify-center transition-colors ${light ? 'text-[#5a4f44] hover:text-[#1a1410]' : 'text-[#7a6f64] hover:text-[#ede7dc]'}`}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            {cart > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-[#c8a94d] text-[#0b0907] text-[9px] font-bold flex items-center justify-center px-1">{cart}</span>}
          </button>
          <button aria-label="Menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} className={`md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 ${light ? 'text-[#5a4f44]' : 'text-[#b5a99b]'}`}>
            <span className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`block w-5 h-[1.5px] bg-current transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-[1.5px] bg-current transition-transform ${mobileOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className={`md:hidden border-t px-6 py-6 flex flex-col gap-4 ${light ? 'border-[#d5cfc4] bg-[#f4ede0]' : 'border-[#22201d] bg-[#0b0907]'}`}>
          <button onClick={onToggleTheme} className={`flex items-center gap-2 text-sm py-2 border-b ${light ? 'border-[#d5cfc4] text-[#5a4f44]' : 'border-[#22201d] text-[#7a6f64]'}`}>
            {light ? '🌙 Chuyển sang tối' : '☀️ Chuyển sang sáng'}
          </button>
          {([['home', 'Trang chủ'], ['catalog', 'Sách'], ['admin', 'Quản trị'], ['settings', 'Tài khoản'], ['wishlist', 'Sách yêu thích'], ['orders', 'Đơn hàng của tôi'], ['login', 'Đăng nhập']] as [Page, string][]).map(([p, label]) => (
            <button key={p} onClick={() => { setPage(p); setMobileOpen(false) }}
              className={`text-left text-base py-2 border-b ${light ? 'border-[#d5cfc4]' : 'border-[#22201d]'} ${page === p ? 'text-[#c8a94d]' : light ? 'text-[#5a4f44]' : 'text-[#b5a99b]'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}

export const SLIDES = [
  {
    id: 1,
    eyebrow: 'Nhà sách trực tuyến',
    titleA: 'Thư',
    titleB: 'An',
    sub: 'Những cuốn sách được chọn kỹ cho một đời sống nhiều chiều sâu.',
    cta1: 'Khám phá sách', cta2: 'Xem danh mục',
    img: 'photo-1507842217343-583bb7270b66',
    accent: '#c8a94d',
    overlay: 'from-[#0b0907] via-[#0b0907]/60 to-[#0b0907]/10',
  },
  {
    id: 2,
    eyebrow: 'Biên tập viên chọn',
    titleA: 'Sách hay',
    titleB: 'tháng 9',
    sub: 'Từ Atomic Habits đến Sapiens — những tựa sách đang làm thay đổi cách bạn nghĩ.',
    cta1: 'Xem danh sách', cta2: 'Tất cả sách',
    img: 'photo-1544716278-ca5e3f4abd8c',
    accent: '#bf6c3e',
    overlay: 'from-[#0b0907] via-[#0a0805]/70 to-transparent',
  },
  {
    id: 3,
    eyebrow: 'Ưu đãi đặc biệt',
    titleA: 'Miễn phí',
    titleB: 'vận chuyển',
    sub: 'Cho đơn hàng từ 500.000 ₫ — giao nhanh toàn quốc trong 1–3 ngày làm việc.',
    cta1: 'Mua ngay', cta2: 'Điều kiện áp dụng',
    img: 'photo-1512820790803-83ca734da794',
    accent: '#5a8e6b',
    overlay: 'from-[#080a08] via-[#080a08]/65 to-transparent',
  },
  {
    id: 4,
    eyebrow: 'Kho sách phong phú',
    titleA: '36 đầu sách',
    titleB: '6 thể loại',
    sub: 'Văn học, Công nghệ, Kỹ năng, Kinh doanh, Lịch sử — tất cả trong một nhà sách.',
    cta1: 'Xem danh mục', cta2: 'Về chúng tôi',
    img: 'photo-1481627834876-b7833e8f5570',
    accent: '#7a6a9e',
    overlay: 'from-[#09080f] via-[#09080f]/65 to-transparent',
  },
]

export function HeroSlider({ onExplore }: { onExplore: () => void }) {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback((idx: number) => {
    if (animating) return
    setAnimating(true)
    setCurrent(idx)
    setTimeout(() => setAnimating(false), 700)
  }, [animating])

  const next = useCallback(() => go((current + 1) % SLIDES.length), [current, go])
  const prev = useCallback(() => go((current - 1 + SLIDES.length) % SLIDES.length), [current, go])

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(next, 5500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [next, paused])

  const slide = SLIDES[current]

  return (
    <section
      className="relative h-screen min-h-[640px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides — stacked, cross-fade */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
        >
          <div className="absolute inset-0 scale-[1.04]" style={{ transition: 'transform 6s ease-out', transform: i === current ? 'scale(1)' : 'scale(1.04)' }}>
            <img
              src={`https://images.unsplash.com/${s.img}?w=1920&h=1080&fit=crop&auto=format&q=75`}
              alt=""
              className="w-full h-full object-cover opacity-30"
            />
          </div>
          <div className={`absolute inset-0 bg-gradient-to-t ${s.overlay}`} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0907]/75 via-transparent to-transparent" />
        </div>
      ))}

      {/* Slide counter — top right */}
      <div className="absolute top-24 right-8 z-10 hidden md:flex flex-col items-end gap-2">
        <span className="font-mono text-xs text-[#7a6f64]">
          <span style={{ color: slide.accent }}>{String(current + 1).padStart(2, '0')}</span>
          <span className="mx-1 text-[#2b2520]">/</span>
          {String(SLIDES.length).padStart(2, '0')}
        </span>
        <div className="w-px h-12 relative overflow-hidden bg-[#2b2520]">
          <div className="absolute top-0 left-0 w-full bg-[#c8a94d] transition-all duration-700" style={{ height: `${((current + 1) / SLIDES.length) * 100}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end pb-24 md:pb-28 max-w-7xl mx-auto px-6 w-full">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6 overflow-hidden">
          <div className="w-8 h-px" style={{ backgroundColor: slide.accent, transition: 'background-color 0.5s' }} />
          <span className="text-[10px] tracking-[0.35em] uppercase font-mono transition-colors duration-500" style={{ color: slide.accent }}>
            {slide.eyebrow}
          </span>
        </div>

        {/* Title — big display */}
        <h1
          key={`title-${current}`}
          className="font-display font-semibold leading-[0.85] tracking-tight text-[#ede7dc] mb-8"
          style={{ fontSize: 'clamp(3.5rem,11vw,10rem)', animation: 'fade-up 0.7s ease both' }}
        >
          <span className="block">{slide.titleA}</span>
          <span className="block italic" style={{ color: slide.accent === '#c8a94d' ? '#ede7dc' : slide.accent, opacity: 0.9 }}>{slide.titleB}</span>
        </h1>

        {/* Sub + CTAs */}
        <div
          key={`sub-${current}`}
          className="flex flex-col md:flex-row md:items-end gap-6 md:gap-14"
          style={{ animation: 'fade-up 0.7s 0.12s ease both' }}
        >
          <p className="text-base text-[#b5a99b] max-w-sm leading-relaxed font-light">{slide.sub}</p>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onExplore} className="btn-gold text-[#0b0907] text-sm font-semibold px-6 py-3 rounded-sm">
              {slide.cta1}
            </button>
            <button onClick={onExplore} className="text-sm text-[#b5a99b] border border-[#2b2520] px-6 py-3 rounded-sm hover:border-[#c8a94d]/40 hover:text-[#ede7dc] transition-colors">
              {slide.cta2}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Progress bar */}
        <div className="h-px bg-[#22201d]">
          <div
            className="h-full transition-all ease-linear"
            style={{ backgroundColor: slide.accent, width: paused ? `${((current + 1) / SLIDES.length) * 100}%` : '100%', transition: paused ? 'none' : 'width 5.5s linear' }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-3">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                className="group flex items-center gap-2"
              >
                <div className={`rounded-full transition-all duration-400 ${i === current ? 'w-6 h-1.5' : 'w-1.5 h-1.5 bg-[#2b2520] group-hover:bg-[#7a6f64]'}`}
                  style={i === current ? { backgroundColor: slide.accent } : {}} />
              </button>
            ))}
          </div>

          {/* Slide thumbnails (desktop) */}
          <div className="hidden lg:flex items-center gap-4">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                className={`text-xs font-mono transition-all duration-300 pb-1 border-b ${i === current ? 'text-[#ede7dc] border-current' : 'text-[#7a6f64] border-transparent hover:text-[#b5a99b]'}`}
              >
                {s.titleA}
              </button>
            ))}
          </div>

          {/* Arrows */}
          <div className="flex items-center gap-2">
            <button onClick={prev} className="w-9 h-9 rounded-full border border-[#2b2520] hover:border-[#c8a94d]/50 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button onClick={next} className="w-9 h-9 rounded-full border border-[#2b2520] hover:border-[#c8a94d]/50 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Ticker() {
  const items = [...CATEGORIES, ...CATEGORIES]
  return (
    <div className="border-y border-[#22201d] py-4 overflow-hidden bg-[#0f0d0b]">
      <div className="flex animate-marquee whitespace-nowrap select-none">
        {items.map((c, i) => (
          <span key={i} className="flex items-center gap-6 px-8">
            <span className="text-[10px] tracking-[0.25em] text-[#7a6f64] uppercase">{c.name}</span>
            <span className="text-[#c8a94d]/40">◆</span>
          </span>
        ))}
        {items.map((c, i) => (
          <span key={`b${i}`} className="flex items-center gap-6 px-8">
            <span className="text-[10px] tracking-[0.25em] text-[#7a6f64] uppercase">{c.name}</span>
            <span className="text-[#c8a94d]/40">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-6 h-px bg-[#c8a94d]" />
      <span className="text-[10px] tracking-[0.3em] text-[#c8a94d] uppercase font-medium font-mono">{children}</span>
    </div>
  )
}

export function FallbackCover({ title, author, bg, large }: { title: string; author: string; bg: string; large?: boolean }) {
  const words = title.split(' ')
  const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ')
  const line2 = words.slice(Math.ceil(words.length / 2)).join(' ')
  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: bg }}>
      {/* Top stripe */}
      <div className="h-1.5 w-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
      {/* Decorative lines */}
      <div className="flex-1 flex flex-col justify-between p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.5) 18px, rgba(255,255,255,0.5) 19px)' }} />
        <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10" style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="relative z-10">
          <div className="w-6 h-0.5 mb-3" style={{ background: 'rgba(255,255,255,0.5)' }} />
          <div className={`font-display italic text-white/90 font-semibold leading-snug ${large ? 'text-2xl' : 'text-sm'}`}>
            {line1}
          </div>
          {line2 && (
            <div className={`font-display text-white/70 font-light leading-snug ${large ? 'text-2xl' : 'text-sm'}`}>
              {line2}
            </div>
          )}
        </div>
        <div className="relative z-10">
          <div className="w-full h-px mb-3 opacity-20" style={{ background: 'white' }} />
          <div className={`text-white/60 tracking-widest uppercase ${large ? 'text-xs' : 'text-[9px]'}`}>{author}</div>
        </div>
      </div>
      <div className="h-1.5 w-full" style={{ background: 'rgba(0,0,0,0.2)' }} />
    </div>
  )
}

export function BookCard({ book, onAdd, onSelect }: { book: typeof BOOKS[0]; onAdd: (b: typeof BOOKS[0]) => void; onSelect?: () => void }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -12
    setTilt({ x, y })
  }, [])

  const catColor: Record<string, string> = {
    'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035',
    'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28',
  }
  const bg = catColor[book.category] || '#2b2520'

  return (
    <div
      className="book-card group relative bg-[#131110] rounded-sm overflow-hidden border border-[#22201d] hover:border-[#c8a94d]/30 cursor-pointer"
      style={{ transform: hovered ? `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(1.02)` : undefined, boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.5)' : undefined }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }) }}
      onClick={onSelect}
    >
      {/* Cover */}
      <div className="img-zoom aspect-[3/4] overflow-hidden" style={{ backgroundColor: bg }}>
        {!imgError ? (
          <img
            src={book.cover}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FallbackCover title={book.title} author={book.author} bg={bg} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0907]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(book) }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 btn-gold text-[#0b0907] text-xs font-semibold px-5 py-2.5 rounded-sm whitespace-nowrap opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
        >
          Thêm vào giỏ
        </button>
      </div>
      {/* Info */}
      <div className="p-4">
        <div className="text-[10px] tracking-[0.2em] text-[#7a6f64] uppercase mb-1 font-mono">{book.category}</div>
        <h3 className="font-display text-[#ede7dc] text-[0.95rem] leading-snug mb-1 line-clamp-2">{book.title}</h3>
        <div className="text-[#7a6f64] text-xs mb-3">{book.author}</div>
        <div className="text-[#c8a94d] font-semibold text-sm">{fmt(book.price)}</div>
      </div>
    </div>
  )
}

export function RevealItem({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="reveal" style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}

export function FeaturedSection({ onAdd, onSelect }: { onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  const { books: BOOKS } = useContext(DataCtx)
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="reveal mb-12">
        <SectionLabel>Nổi bật tháng này</SectionLabel>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Những lựa chọn<br /><em>của biên tập viên</em></h2>
          <span className="hidden md:block text-[#7a6f64] text-sm">Được chọn từ hơn 36 đầu sách</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {BOOKS.slice(0, 4).map((book, i) => (
          <RevealItem key={book.id} delay={i * 100}>
            <BookCard book={book} onAdd={onAdd} onSelect={() => onSelect(book)} />
          </RevealItem>
        ))}
      </div>
    </section>
  )
}

export function CategoriesSection({ onCatalog }: { onCatalog: () => void }) {
  const { categories: CATEGORIES } = useContext(DataCtx)
  return (
    <section className="py-24 bg-[#0f0d0b] border-y border-[#22201d]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="reveal mb-12">
          <SectionLabel>Danh mục</SectionLabel>
          <h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Khám phá theo<br /><em>chủ đề yêu thích</em></h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat, i) => (
              <RevealItem key={cat.id} delay={i * 100}>
                <button
                  onClick={onCatalog}
                  className="group relative w-full aspect-[4/3] overflow-hidden rounded-sm border border-[#22201d] hover:border-[#c8a94d]/30 transition-colors"
                  style={{ backgroundColor: cat.color }}
                >
                  <img
                    src={`https://images.unsplash.com/${cat.img}?w=600&h=450&fit=crop&auto=format&q=70`}
                    alt={cat.name}
                    className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500 scale-105 group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="font-display text-xl text-white font-medium leading-tight">{cat.name}</div>
                    <div className="text-white/50 text-xs mt-1 font-mono">{cat.count} đầu sách</div>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="16" height="16" fill="none" stroke="#c8a94d" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>
                  </div>
                </button>
              </RevealItem>
            ))}
        </div>
      </div>
    </section>
  )
}

export function BestsellerSection({ onAdd, onSelect }: { onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  const { books: BOOKS } = useContext(DataCtx)
  const rowRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => {
    rowRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="reveal flex items-end justify-between mb-10">
          <div>
            <SectionLabel>Bán chạy</SectionLabel>
            <h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Được yêu thích<br /><em>nhất tuần qua</em></h2>
          </div>
          <div className="hidden md:flex gap-2">
            {[-1, 1].map(dir => (
              <button key={dir} onClick={() => scroll(dir)}
                className="w-10 h-10 rounded-full border border-[#2b2520] hover:border-[#c8a94d]/60 flex items-center justify-center text-[#7a6f64] hover:text-[#c8a94d] transition-colors">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  {dir === -1 ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div ref={rowRef} className="scroll-row flex gap-5 overflow-x-auto pl-6 md:pl-[max(1.5rem,calc(50vw-42rem))] pr-6 pb-4 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {BOOKS.slice(0).reverse().map((book, i) => (
          <div key={book.id} className="flex-none w-[220px]" style={{ transitionDelay: `${i * 60}ms` }}>
            <BookCard book={book} onAdd={onAdd} onSelect={() => onSelect(book)} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function EditorialSection() {
  return (
    <section className="py-32 bg-[#0f0d0b] border-y border-[#22201d]">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <div className="reveal">
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#c8a94d]/50 to-transparent mx-auto mb-12" />
          <blockquote className="font-display text-3xl md:text-5xl lg:text-6xl text-[#ede7dc] font-light italic leading-tight mb-10">
            "Một cuốn sách hay là một người bạn<br className="hidden md:block" /> không bao giờ phản bội."
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-px bg-[#c8a94d]/50" />
            <span className="text-xs tracking-[0.25em] text-[#7a6f64] uppercase font-mono">Thư An · Biên soạn 2026</span>
            <div className="w-8 h-px bg-[#c8a94d]/50" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function StatsSection() {
  const stats = [
    { value: '36+', label: 'Đầu sách' },
    { value: '6', label: 'Thể loại' },
    { value: '160+', label: 'Đơn hàng' },
    { value: '3', label: 'Tài khoản' },
  ]
  return (
    <section className="py-20 border-b border-[#22201d]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-[#22201d]">
          {stats.map((s) => (
            <div key={s.label} className="px-8 py-8 text-center">
              <div className="font-display text-4xl md:text-5xl text-[#c8a94d] font-semibold mb-2">{s.value}</div>
              <div className="text-xs tracking-[0.2em] text-[#7a6f64] uppercase font-mono">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [sent] = useState(false)
  const toast = useToast()
  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="reveal">
          <div className="max-w-2xl">
            <SectionLabel>Bản tin</SectionLabel>
            <h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium mb-4">Nhận gợi ý sách<br /><em>hàng tuần từ chúng tôi</em></h2>
            <p className="text-[#7a6f64] text-base mb-8 leading-relaxed">Mỗi thứ Hai, chúng tôi gửi một cuốn sách đáng đọc — kèm đoạn trích ngắn và lý do tại sao nó quan trọng với bạn.</p>
            {sent ? (
              <div className="flex items-center gap-3 text-[#c8a94d]">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                <span className="text-sm">Đã đăng ký thành công!</span>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (email) toast('Bản tin email chưa được triển khai trong phiên bản này.', 'info') }} className="flex gap-3 flex-col sm:flex-row max-w-md">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 bg-[#131110] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] font-mono"
                />
                <button type="submit" className="btn-gold text-[#0b0907] text-sm font-semibold px-6 py-3 rounded-sm whitespace-nowrap">
                  Đăng ký
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Footer({ setPage }: { setPage: (p: Page) => void }) {
  const light = useTheme() === 'light'
  return (
    <footer className={`border-t ${light ? 'border-[#d5cfc4] bg-[#ede4d4]' : 'border-[#22201d] bg-[#0a0806]'}`}>
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-sm bg-[#c8a94d] flex items-center justify-center">
              <span className="font-display font-bold text-[#0b0907] text-base">T</span>
            </div>
            <div>
              <div className={`font-display font-semibold text-sm ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Thư An</div>
              <div className="text-[9px] tracking-[0.2em] text-[#7a6f64] uppercase">Nhà sách trực tuyến</div>
            </div>
          </div>
          <p className="text-[#7a6f64] text-sm leading-relaxed max-w-xs">Những cuốn sách được chọn kỹ cho một đời sống nhiều chiều sâu.</p>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">Khám phá</div>
          <ul className="space-y-3">
            {[['catalog', 'Danh mục sách'], ['wishlist', 'Sách yêu thích'], ['orders', 'Đơn hàng của tôi'], ['settings', 'Tài khoản']].map(([p, l]) => (
              <li key={l}><button onClick={() => setPage(p as Page)} className={`text-sm transition-colors ${light ? 'text-[#6b5e50] hover:text-[#1a1410]' : 'text-[#7a6f64] hover:text-[#ede7dc]'}`}>{l}</button></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">BookGuard DATN</div>
          <p className="text-sm text-[#7a6f64] leading-relaxed mb-3">Đồ án nghiên cứu bảo mật nhiều lớp cho ứng dụng web bán sách.</p>
          <p className="text-sm text-[#7a6f64]">Ảnh bìa được cung cấp bởi <span className={light ? 'text-[#5a4f44]' : 'text-[#b5a99b]'}>Open Library</span></p>
        </div>
      </div>
      <div className={`border-t px-6 py-5 max-w-7xl mx-auto flex items-center justify-between text-xs text-[#7a6f64] ${light ? 'border-[#d5cfc4]' : 'border-[#22201d]'}`}>
        <span>© 2026 Thư An Bookstore</span>
        <span>Được xây dựng cho trải nghiệm mua sách an toàn</span>
      </div>
    </footer>
  )
}

export function CatalogPage({ onAdd, onSelect }: { onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  const { books: BOOKS, categories: CATEGORIES } = useContext(DataCtx)
  const light = useTheme() === 'light'
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [serverIds, setServerIds] = useState<number[] | null>(null)

  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setServerIds(null)
      return
    }
    const timer = setTimeout(() => {
      void api<{ id: number }[]>(`/api/books?q=${encodeURIComponent(q)}&limit=40`)
        .then(res => setServerIds(res.data.map(item => item.id)))
        .catch(() => setServerIds([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [search])

  const sourceBooks = serverIds !== null ? BOOKS.filter(b => serverIds.includes(b.id)) : BOOKS
  const filtered = sourceBooks.filter(b => {
    const matchCat = activeCategory === 'all' || b.category === CATEGORIES.find(c => c.id === activeCategory)?.name
    return matchCat
  })

  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Page header */}
      <div className={`border-b ${light ? 'border-[#d5cfc4] bg-[#ede4d4]' : 'border-[#22201d] bg-[#0f0d0b]'}`}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <SectionLabel>Kho sách</SectionLabel>
          <h1 className={`font-display text-5xl md:text-6xl font-medium mt-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Tất cả đầu sách</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6f64]" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên sách hoặc tác giả..."
              aria-label="Tìm theo tên sách hoặc tác giả"
              className={`w-full pl-10 pr-4 py-2.5 border text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-white border-[#d5cfc4] text-[#1a1410]' : 'bg-[#131110] border-[#2b2520] text-[#ede7dc]'}`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 text-xs rounded-sm border transition-colors ${activeCategory === 'all' ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907] font-semibold' : light ? 'border-[#c8bfb0] text-[#6b5e50] hover:border-[#c8a94d]/60' : 'border-[#2b2520] text-[#7a6f64] hover:border-[#c8a94d]/40'}`}
            >
              Tất cả
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-4 py-2 text-xs rounded-sm border transition-colors ${activeCategory === c.id ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907] font-semibold' : light ? 'border-[#c8bfb0] text-[#6b5e50] hover:border-[#c8a94d]/60' : 'border-[#2b2520] text-[#7a6f64] hover:border-[#c8a94d]/40'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
            {filtered.map((book, i) => (
              <RevealItem key={book.id} delay={Math.min(i, 5) * 100}>
                <BookCard book={book} onAdd={onAdd} onSelect={() => onSelect(book)} />
              </RevealItem>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-[#7a6f64]">
            <div className="font-display text-2xl mb-2">Không tìm thấy</div>
            <div className="text-sm">Thử tìm với từ khóa khác</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminPanel({ activeTab, onTabChange, children, syncLabel = 'Dữ liệu đã đồng bộ' }: { activeTab?: AdminTab; onTabChange?: (tab: AdminTab) => void; children?: ReactNode; syncLabel?: string }) {
  const [internalTab, setInternalTab] = useState<AdminTab>('overview')
  const tab = activeTab ?? internalTab
  const setTab = onTabChange ?? setInternalTab
  const { user, logout } = useSession()
  const navigate = useNavigate()

  const [theme, setTheme] = useState<'dark' | 'light' | 'midnight'>(() => {
    return (localStorage.getItem('bookguard_admin_theme') as 'dark' | 'light' | 'midnight') || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('bookguard_admin_theme', theme)
    document.documentElement.setAttribute('data-admin-theme', theme)
  }, [theme])

  const businessTabs: [AdminTab, string, string][] = [
    ['overview', 'Tổng quan', 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
    ['orders', 'Đơn hàng', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
    ['books', 'Kho sách', 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'],
    ['inventory', 'Tồn kho', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
    ['categories', 'Thể loại', 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'],
    ['offers', 'Ưu đãi & Voucher', 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'],
    ['accounts', 'Người dùng', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'],
  ]

  const securityTabs: [AdminTab, string, string, string?][] = [
    ['security-compare', 'Đối chiếu an ninh', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 'BÁO CÁO'],
    ['security-events', 'Sự kiện bảo mật', 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 'LIVE'],
    ['audit', 'Nhật ký kiểm toán', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'],
    ['experiments', 'Đo tải & Benchmark', 'M13 10V3L4 14h7v7l9-11h-7z'],
  ]

  return (
    <div className={`reference-admin theme-${theme} h-screen w-screen overflow-hidden flex flex-col font-opensans relative`}>
      {/* Dynamic Ambient Aurora Background (Breathing motion and multi-layered depth) */}
      <div className="admin-ambient-aurora">
        <div className="aurora-orb-1" />
        <div className="aurora-orb-2" />
        <div className="aurora-orb-3" />
      </div>

      {/* Top Dedicated Admin Header: 64px, modern sleek obsidian/light bar */}
      <header className="h-16 shrink-0 border-b border-slate-800/80 bg-[#0b101c] px-6 flex items-center justify-between z-30 shadow-md relative">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-extrabold text-slate-950 text-lg shadow-md">
            T
          </div>
          <div>
            <div className="font-bold text-base text-white leading-tight flex items-center gap-2">
              <span>BookGuard</span>
              <span className="text-slate-600 font-normal">/</span>
              <span className="text-slate-400 font-medium text-xs">Admin Portal</span>
            </div>
          </div>
          <span className="ml-3 hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase">
            {import.meta.env.VITE_SECURITY_MODE === 'secure' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                SECURE · 6 LỚP
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                BASELINE · ĐỐI CHỨNG
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* THEME TOGGLE: DARK / LIGHT / MIDNIGHT (Equal pure icon buttons) */}
          <div className="flex items-center bg-[#060a14]/90 border border-slate-800 rounded-xl p-1 gap-1 theme-switcher-group shadow-inner">
            <button
              type="button"
              title="Giao diện Tối"
              aria-label="Giao diện Tối"
              onClick={() => setTheme('dark')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'dark'
                  ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">🌙</span>
            </button>
            <button
              type="button"
              title="Giao diện Sáng"
              aria-label="Giao diện Sáng"
              onClick={() => setTheme('light')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'light'
                  ? 'bg-amber-500/20 text-amber-500 font-bold border border-amber-500/40 shadow-sm active-light'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">☀️</span>
            </button>
            <button
              type="button"
              title="Giao diện Cyber"
              aria-label="Giao diện Cyber"
              onClick={() => setTheme('midnight')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer text-sm shrink-0 ${
                theme === 'midnight'
                  ? 'bg-sky-400/20 text-sky-300 font-bold border border-sky-400/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm select-none" aria-hidden="true">🌌</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium text-slate-300">{syncLabel}</span>
          </div>

          <div className="flex items-center gap-3.5 pl-4 border-l border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-slate-850 border border-slate-700/80 flex items-center justify-center font-mono text-xs font-bold text-amber-400">
              AD
            </div>
            <span className="text-sm font-semibold text-slate-200 hidden sm:inline">{user?.fullName || 'Quản trị viên'}</span>
            <button
              type="button"
              onClick={() => { void logout().then(() => navigate('/login')) }}
              className="text-xs font-mono text-slate-400 hover:text-rose-400 transition-colors cursor-pointer ml-1 font-semibold"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Body: Slim Fixed Sidebar + Scrollable Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar: 256px wide, sleek dark obsidian */}
        <aside className="w-64 h-full shrink-0 border-r border-slate-800/80 bg-[#0b101c] flex flex-col overflow-y-auto select-none">
          <nav className="flex-1 py-4 space-y-6">
            {/* Section 1: Business Operations */}
            <div>
              <div className="px-4 mb-2 text-[11px] tracking-wider text-slate-500 uppercase font-mono font-bold">
                Vận hành
              </div>
              <div className="space-y-1">
                {businessTabs.map(([t, label, icon]) => (
                  <button
                    key={t}
                    aria-current={tab === t ? 'page' : undefined}
                    onClick={() => setTab(t)}
                    className={`sidebar-link w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-all text-left cursor-pointer rounded-lg mx-2 ${
                      tab === t
                        ? 'active text-white bg-[#162036] font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                    }`}
                  >
                    <svg
                      className={`shrink-0 transition-colors ${tab === t ? 'text-amber-400' : 'text-slate-400'}`}
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: Security & Defense Center */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="px-4 mb-2 flex items-center justify-between text-[11px] tracking-wider text-slate-500 uppercase font-mono font-bold">
                <span>An ninh & Kiểm toán</span>
              </div>
              <div className="space-y-1">
                {securityTabs.map(([t, label, icon, badge]) => (
                  <button
                    key={t}
                    aria-current={tab === t ? 'page' : undefined}
                    onClick={() => setTab(t)}
                    className={`sidebar-link w-full flex items-center justify-between px-3.5 py-2 text-sm transition-all text-left cursor-pointer rounded-lg mx-2 ${
                      tab === t
                        ? 'active text-white bg-[#162036] font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <svg
                        className={`shrink-0 transition-colors ${tab === t ? 'text-amber-400' : 'text-slate-400'}`}
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                      <span className="truncate">{label}</span>
                    </div>
                    {badge && (
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1.5 ${
                        badge.includes('10/10')
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : badge === 'LIVE'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {badge === 'LIVE' && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                          </span>
                        )}
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Area: SCROLLABLE INDEPENDENTLY & FULL WIDTH with Tab Animation */}
        <main className="flex-1 h-full overflow-y-auto bg-[#090d16] relative z-10">
          <div key={tab} className="admin-tab-content p-6 md:p-8 lg:p-10 w-full max-w-none">
            {children ?? <>
            {tab === 'overview' && <AdminOverview />}
            {tab === 'orders' && <AdminOrders />}
            {tab === 'books' && <AdminBooks />}
            {tab === 'categories' && <AdminCategories />}
            {tab === 'accounts' && <AdminAccounts />}
            {tab === 'security-events' && <AdminSecurityEvents />}
            {tab === 'inventory' && <AdminInventory />}
            {tab === 'audit' && <AdminAudit />}
            </>}
          </div>
        </main>
      </div>
    </div>
  )
}

export function AdminOverview({ summary, onOpenOrder }: { summary?: { orders: number; revenue: number; books: number; customers: number; pendingOrders: number }; onOpenOrder?: (id: number) => void }) {
  const { orders: ORDERS, categories } = useContext(DataCtx)
  const stats = [
    { label: 'Tổng đơn hàng', value: String(summary?.orders ?? 0), delta: `${summary?.pendingOrders ?? 0} chờ xử lý`, color: 'text-white' },
    { label: 'Doanh thu', value: fmt(Number(summary?.revenue ?? 0)), delta: 'Đã hoàn tất', color: 'text-amber-400' },
    { label: 'Đầu sách', value: String(summary?.books ?? 0), delta: `${categories.length} danh mục`, color: 'text-white' },
    { label: 'Khách hàng', value: String(summary?.customers ?? 0), delta: 'Đã đăng ký', color: 'text-white' },
  ]
  return (
    <div className="w-full space-y-6 text-slate-100 font-opensans">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Tổng quan kinh doanh</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map(s => (
          <div key={s.label} className="admin-card-hover bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 rounded-xl p-4 shadow-sm cursor-default">
            <div className="text-[11px] text-slate-400 font-mono mb-1.5 uppercase tracking-wider font-semibold">{s.label}</div>
            <div className={`text-xl sm:text-2xl 2xl:text-3xl font-bold font-mono mb-1 tracking-tight truncate whitespace-nowrap leading-snug ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 font-mono">{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-[#090d16] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Giao dịch gần đây</h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
            {ORDERS.length} đơn hàng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-24">Mã đơn</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4 w-36">Thời gian</th>
                <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-36 text-right">Tổng tiền</th>
                <th className="py-3 px-4 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {ORDERS.slice(0, 6).map(o => (
                <tr
                  key={o.id}
                  onClick={() => onOpenOrder?.(o.id)}
                  className="hover:bg-slate-900/50 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-amber-400">
                    <span className="bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded text-[11px]">#{o.id}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-100 font-medium text-xs sm:text-sm">{o.customer}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">{o.date}</td>
                  <td className="py-3 px-4 text-center"><span className={`badge ${statusColor(o.status)}`}>{o.status}</span></td>
                  <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">{fmt(o.total)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onOpenOrder?.(o.id) }}
                      className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      Chi tiết →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminOrders({ onOpen }: { onOpen?: (id: number) => void }) {
  const { orders: ORDERS } = useContext(DataCtx)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modalOrder, setModalOrder] = useState<typeof ORDERS[0] | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'id' | 'total' | 'date'>('id')
  const [sortAsc, setSortAsc] = useState(false)

  const statusOptions = [
    { key: 'all', label: 'Tất cả' },
    { key: 'Chờ xác nhận', label: 'Chờ xác nhận' },
    { key: 'Đang xử lý', label: 'Đang xử lý' },
    { key: 'Đang giao', label: 'Đang giao' },
    { key: 'Hoàn tất', label: 'Hoàn tất' },
    { key: 'Đã hủy', label: 'Đã hủy' },
  ]

  const totalRevenue = useMemo(() => {
    return ORDERS.filter(o => o.status !== 'Đã hủy').reduce((acc, o) => acc + o.total, 0)
  }, [ORDERS])

  const pendingCount = useMemo(() => {
    return ORDERS.filter(o => o.status === 'Chờ xác nhận' || o.status === 'Đang xử lý').length
  }, [ORDERS])

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = ORDERS.filter(o => {
      const matchStatus = statusFilter === 'all' || o.status === statusFilter
      const matchQuery = !q || (
        String(o.id).includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.items.toLowerCase().includes(q) ||
        o.date.toLowerCase().includes(q)
      )
      return matchStatus && matchQuery
    })

    list.sort((a, b) => {
      if (sortBy === 'total') {
        return sortAsc ? a.total - b.total : b.total - a.total
      } else if (sortBy === 'date') {
        return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
      } else {
        return sortAsc ? a.id - b.id : b.id - a.id
      }
    })

    return list
  }, [ORDERS, query, statusFilter, sortBy, sortAsc])

  const selectedOrder = useMemo(() => {
    return ORDERS.find(o => o.id === selectedId) || null
  }, [ORDERS, selectedId])

  const handleOpenDetail = (id: number) => {
    if (onOpen) {
      onOpen(id)
    } else {
      const found = ORDERS.find(o => o.id === id)
      if (found) setModalOrder(found)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Hoàn tất':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
      case 'Đang giao':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
      case 'Đã xác nhận':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
      case 'Đang xử lý':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
      case 'Chờ xác nhận':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
      case 'Đã hủy':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    }
  }

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & SEARCH / CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={statusFilter === 'all' && !query}
            onClick={() => { setStatusFilter('all'); setQuery(''); }}
            title={statusFilter !== 'all' || query ? "Quay lại danh sách tất cả đơn" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              statusFilter !== 'all' || query
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Đơn hàng</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all' ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📦</span>
              <span>Tất cả đơn ({ORDERS.length})</span>
            </button>

            {statusFilter !== 'all' && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span className="truncate max-w-[200px]">{statusFilter}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search + Status dropdown */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Mã đơn, khách hàng..."
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            {statusOptions.map(st => {
              const count = st.key === 'all' ? ORDERS.length : ORDERS.filter(o => o.status === st.key).length
              return (
                <option key={st.key} value={st.key}>
                  {st.label} ({count})
                </option>
              )
            })}
          </select>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Hiển thị thao tác khi chọn đơn - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedOrder
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedOrder ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn đơn:</span>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                #{selectedOrder.id}
              </span>
              <span className="text-xs font-semibold text-white">{selectedOrder.customer}</span>
              <span className="text-xs font-mono font-bold text-amber-400">{fmt(selectedOrder.total)}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(selectedOrder.status)}`}>
                {selectedOrder.status}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenDetail(selectedOrder.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md"
              >
                <span>🔍</span>
                <span>Xem chi tiết đơn hàng</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span>📦 Tổng <strong className="text-white font-mono">{filteredOrders.length}</strong> đơn</span>
              <span>💰 Doanh thu: <strong className="text-amber-400 font-mono">{fmt(totalRevenue)}</strong></span>
              <span>⏳ <strong className="text-amber-400 font-mono">{pendingCount}</strong> cần xử lý</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để xem chi tiết</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'id') {
                    if (!sortAsc) setSortAsc(true)
                    else { setSortBy('total'); setSortAsc(false); }
                  } else if (sortBy === 'total') {
                    if (!sortAsc) setSortAsc(true)
                    else { setSortBy('id'); setSortAsc(false); }
                  } else {
                    setSortBy('id'); setSortAsc(false);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                title="Đổi thứ tự sắp xếp"
              >
                <span>↕</span>
                <span>Sắp xếp:</span>
                <span className="text-amber-400 font-mono font-bold">
                  {sortBy === 'id' ? (sortAsc ? 'Mã đơn ↑' : 'Mới nhất') : (sortAsc ? 'Giá tăng dần' : 'Giá cao nhất')}
                </span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Danh sách"
                >
                  ▦ Danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Thẻ"
                >
                  ⊞ Thẻ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (NO ACTION COLUMN - ZERO RADIO DOTS) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {viewMode === 'details' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-24">Mã đơn</th>
                  <th className="py-2.5 px-4">Khách hàng & Sản phẩm</th>
                  <th className="py-2.5 px-4 w-36">Ngày đặt</th>
                  <th className="py-2.5 px-4 w-36 text-center">Trạng thái</th>
                  <th className="py-2.5 px-4 w-36 text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => {
                    const isSelected = selectedId === o.id
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(isSelected ? null : o.id)}
                        onDoubleClick={() => handleOpenDetail(o.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để mở chi tiết"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-xs">
                            #{o.id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                            {o.customer}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
                            {o.items}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {o.date}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${getStatusBadge(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">
                          {fmt(o.total)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* GRID / CARDS VIEW */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full py-14 text-center text-slate-500 font-mono">
                Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc.
              </div>
            ) : (
              filteredOrders.map(o => {
                const isSelected = selectedId === o.id
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedId(isSelected ? null : o.id)}
                    onDoubleClick={() => handleOpenDetail(o.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400/30'
                        : 'bg-[#090d16] border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                    title="Nhấp để chọn · Nhấp đúp để mở chi tiết"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-mono font-bold text-amber-400 text-xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        #{o.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </div>
                    <div className={`font-semibold text-sm mb-1 ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                      {o.customer}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mb-3 min-h-[32px]">
                      {o.items}
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80">
                      <span className="text-[11px] font-mono text-slate-500">{o.date}</span>
                      <span className="font-mono text-sm font-bold text-amber-400">{fmt(o.total)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* 4. ORDER DETAIL MODAL (Fallback when onOpen is not provided) */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setModalOrder(null)}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl text-slate-100 my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-4 mb-5 border-b border-slate-800">
              <div>
                <div className="text-xs sm:text-sm tracking-wider text-amber-400 uppercase font-semibold mb-1">Quản lý đơn hàng · Chi tiết giao dịch</div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">Đơn #{modalOrder.id}</h3>
              </div>
              <button onClick={() => setModalOrder(null)} className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-base">
                ✕
              </button>
            </div>
            <div className="space-y-3.5 mb-5">
              {[['Trạng thái', modalOrder.status], ['Ngày đặt', modalOrder.date], ['Người nhận', modalOrder.customer]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center bg-[#090d16] border border-slate-800 px-4 py-2.5 rounded-lg text-sm">
                  <span className="text-xs sm:text-sm text-slate-400 uppercase font-medium">{k}</span>
                  <span className={`text-sm sm:text-base font-semibold ${k === 'Trạng thái' ? '' : 'text-slate-100'}`}>
                    {k === 'Trạng thái' ? <span className={`px-3 py-1 rounded text-xs sm:text-sm font-semibold ${getStatusBadge(v)}`}>{v}</span> : v}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 mb-5">
              <div className="text-xs sm:text-sm text-slate-400 mb-2 uppercase tracking-wider font-semibold">Sản phẩm</div>
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-slate-100 font-semibold">{modalOrder.items}</span>
                <span className="text-amber-400 font-bold text-base sm:text-lg">{fmt(modalOrder.total)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center font-medium text-base sm:text-lg pt-4 border-t border-slate-800">
              <span className="text-slate-300 font-semibold">Tổng cộng:</span>
              <span className="text-amber-400 text-2xl sm:text-3xl font-extrabold">{fmt(modalOrder.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminBooks({ onCreate, onEdit }: { onCreate?: () => void; onEdit?: (id: number) => void }) {
  const { books: BOOKS, categories: CATEGORIES } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'title' | 'price' | 'stock'>('title')
  const [sortAsc, setSortAsc] = useState(true)

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = BOOKS.filter(b => {
      const matchCat = categoryFilter === 'all' || b.category === categoryFilter
      const matchQ = !q || (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q)
      )
      return matchCat && matchQ
    })

    list.sort((a, b) => {
      if (sortBy === 'title') {
        return sortAsc ? a.title.localeCompare(b.title, 'vi') : b.title.localeCompare(a.title, 'vi')
      } else if (sortBy === 'price') {
        return sortAsc ? a.price - b.price : b.price - a.price
      } else {
        return sortAsc ? a.stock - b.stock : b.stock - a.stock
      }
    })

    return list
  }, [BOOKS, query, categoryFilter, sortBy, sortAsc])

  const selectedBook = useMemo(() => {
    return BOOKS.find(b => b.id === selectedId) || null
  }, [BOOKS, selectedId])

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={categoryFilter === 'all' && !query}
            onClick={() => { setCategoryFilter('all'); setQuery(''); }}
            title={categoryFilter !== 'all' ? "Quay lại toàn bộ kho sách" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              categoryFilter !== 'all' || query
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setCategoryFilter('all'); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'all' ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📘</span>
              <span>Toàn bộ đầu sách</span>
            </button>

            {categoryFilter !== 'all' && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📂</span>
                  <span className="truncate max-w-[200px]">{categoryFilter}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box, Category filter & Add button */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-56">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tên sách, tác giả, ISBN..."
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-200 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400"
          >
            <option value="all">Tất cả ({BOOKS.length})</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.count})</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onCreate?.()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>+</span>
            <span>Thêm sách</span>
          </button>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác khi chọn dòng - Không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedBook
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedBook ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedBook.title}
              </span>
              <span className="text-xs text-slate-400 font-mono">({selectedBook.author})</span>
              <span className="text-xs text-amber-400 font-mono font-bold">{fmt(selectedBook.price)}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onEdit?.(selectedBook.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-amber-400/40"
              >
                <span>✏️</span>
                <span>Chỉnh sửa thông tin sách</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>📚 Tổng số <strong className="text-white font-mono">{filteredBooks.length}</strong> đầu sách</span>
              <span>📂 <strong className="text-amber-400 font-mono">{CATEGORIES.length}</strong> thể loại</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để chỉnh sửa</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'title') {
                    if (sortAsc) setSortAsc(false)
                    else { setSortBy('price'); setSortAsc(true); }
                  } else if (sortBy === 'price') {
                    if (sortAsc) setSortAsc(false)
                    else { setSortBy('stock'); setSortAsc(false); }
                  } else {
                    setSortBy('title'); setSortAsc(true);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                title="Đổi thứ tự sắp xếp"
              >
                <span>↕</span>
                <span>Sắp xếp:</span>
                <span className="text-amber-400 font-mono font-bold">
                  {sortBy === 'title' ? (sortAsc ? 'Tên A → Z' : 'Tên Z → A') : sortBy === 'price' ? (sortAsc ? 'Giá tăng dần' : 'Giá giảm dần') : 'Tồn kho'}
                </span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('details')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Danh sách"
                >
                  ▦ Danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiển thị dạng Lưới"
                >
                  ⊞ Lưới
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (NO ACTION COLUMN) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {viewMode === 'details' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Sách & Tác giả</th>
                  <th className="py-2.5 px-4 w-36">Thể loại</th>
                  <th className="py-2.5 px-4 w-32 font-mono">ISBN</th>
                  <th className="py-2.5 px-4 w-28 text-center">Tồn kho</th>
                  <th className="py-2.5 px-4 w-36 text-right">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đầu sách nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map(b => {
                    const isSelected = selectedId === b.id
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedId(isSelected ? null : b.id)}
                        onDoubleClick={() => onEdit?.(b.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để chỉnh sửa sách"
                      >
                        {/* Cover + Title & Author */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-12 shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative flex items-center justify-center">
                              {b.cover ? (
                                <img
                                  src={b.cover}
                                  alt={b.title}
                                  className="w-full h-full object-cover relative z-10"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : null}
                              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-amber-400/60 select-none pointer-events-none">
                                {b.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {b.title}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{b.author}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700/80">
                            {b.category}
                          </span>
                        </td>

                        {/* ISBN */}
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          {b.isbn || '—'}
                        </td>

                        {/* Stock */}
                        <td className="py-3 px-4 text-center">
                          {b.stock <= 10 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              {b.stock} (Sắp hết)
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-slate-200">{b.stock}</span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-mono text-xs sm:text-sm font-bold text-amber-400 whitespace-nowrap">
                          {fmt(b.price)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredBooks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(isSelected ? null : b.id)}
                  onDoubleClick={() => onEdit?.(b.id)}
                  className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để chỉnh sửa"
                >
                  <div className="w-full h-36 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative mb-2.5 flex items-center justify-center">
                    {b.cover ? (
                      <img
                        src={b.cover}
                        alt={b.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : null}
                    <span className="absolute font-mono text-lg font-bold text-amber-400/50">
                      {b.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{b.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{b.author}</div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <span className="font-mono text-xs font-bold text-amber-400">{fmt(b.price)}</span>
                    <span className="text-[10px] font-mono text-slate-400">Tồn: {b.stock}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


export function AdminCategories({ onCreate, onEdit, onRemove }: { onCreate?: () => void; onEdit?: (slug: string) => void; onRemove?: (slug: string) => void }) {
  const { categories: CATEGORIES, books: BOOKS } = useContext(DataCtx)
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [openedSlug, setOpenedSlug] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'name' | 'count'>('name')
  const [sortAsc, setSortAsc] = useState(true)

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let list = [...CATEGORIES]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return sortAsc ? a.name.localeCompare(b.name, 'vi') : b.name.localeCompare(a.name, 'vi')
      } else {
        return sortAsc ? a.count - b.count : b.count - a.count
      }
    })
    return list
  }, [CATEGORIES, query, sortBy, sortAsc])

  // Total books count
  const totalBooks = useMemo(() => {
    return CATEGORIES.reduce((acc, c) => acc + c.count, 0) || BOOKS.length
  }, [CATEGORIES, BOOKS])

  // Selected category object
  const selectedCategory = useMemo(() => {
    return CATEGORIES.find(c => c.id === selectedSlug) || null
  }, [CATEGORIES, selectedSlug])

  // Opened category object
  const openedCategory = useMemo(() => {
    return CATEGORIES.find(c => c.id === openedSlug) || null
  }, [CATEGORIES, openedSlug])

  // Books inside opened category
  const booksInOpenedCategory = useMemo(() => {
    if (!openedSlug) return []
    const cat = CATEGORIES.find(c => c.id === openedSlug)
    if (!cat) return []
    let list = BOOKS.filter(b => b.category === cat.name || b.category.toLowerCase() === openedSlug.toLowerCase())
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
    }
    return list
  }, [openedSlug, CATEGORIES, BOOKS, query])

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Back button (active when inside a category) */}
          <button
            type="button"
            disabled={!openedSlug}
            onClick={() => { setOpenedSlug(null); setQuery(''); }}
            title={openedSlug ? "Quay lại danh sách thể loại" : "Đang ở thư mục gốc"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              openedSlug
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setOpenedSlug(null); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                !openedSlug ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📂</span>
              <span>Thể loại</span>
            </button>

            {openedCategory && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📘</span>
                  <span className="truncate max-w-[200px]">{openedCategory.name}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box & Add button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={openedCategory ? `Tìm trong ${openedCategory.name}...` : "Tìm thể loại..."}
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          <button
            type="button"
            onClick={() => onCreate ? onCreate() : setShowModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <span>+</span>
            <span>Thêm thể loại</span>
          </button>
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác xuất hiện khi chọn thư mục - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedCategory && !openedSlug
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedCategory && !openedSlug ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedCategory.name}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">({selectedCategory.count} đầu sách)</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Mở thư mục xem sách */}
              <button
                type="button"
                onClick={() => setOpenedSlug(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700"
              >
                <span>📂</span>
                <span>Mở xem sách</span>
              </button>

              {/* Sửa / Đổi tên */}
              <button
                type="button"
                onClick={() => onEdit?.(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-amber-400/40"
              >
                <span>✏️</span>
                <span>Đổi tên & Sửa</span>
              </button>

              {/* Xóa */}
              <button
                type="button"
                onClick={() => onRemove?.(selectedCategory.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-rose-500/40"
              >
                <span>🗑️</span>
                <span>Xóa</span>
              </button>

              {/* Bỏ chọn */}
              <button
                type="button"
                onClick={() => setSelectedSlug(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              {openedSlug ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <span>📘 Danh sách sách trong thể loại:</span>
                  <span className="font-bold text-white">{openedCategory?.name}</span>
                  <span className="text-[11px] font-mono text-amber-400">({booksInOpenedCategory.length} sách)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span>📁 Tổng số <strong className="text-white font-mono">{filteredCategories.length}</strong> thể loại</span>
                  <span>📚 <strong className="text-amber-400 font-mono">{totalBooks}</strong> đầu sách</span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline italic">Nhấp dòng để chọn · Nhấp đúp để mở xem sách</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!openedSlug && (
                <>
                  {/* Sort */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'name') {
                        if (sortAsc) setSortAsc(false)
                        else { setSortBy('count'); setSortAsc(false); }
                      } else {
                        setSortBy('name'); setSortAsc(true);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                    title="Đổi thứ tự sắp xếp"
                  >
                    <span>↕</span>
                    <span>Sắp xếp:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {sortBy === 'name' ? (sortAsc ? 'A → Z' : 'Z → A') : 'Số sách ↓'}
                    </span>
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('details')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Danh sách"
                    >
                      ▦ Danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Lưới thư mục"
                    >
                      ⊞ Lưới
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (Clean, full width, no duplicated menus or columns) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {openedSlug ? (
          /* INSIDE OPENED CATEGORY: LIST OF BOOKS */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4">Tên tác phẩm</th>
                  <th className="py-2.5 px-4 w-48">Tác giả</th>
                  <th className="py-2.5 px-4 w-32 text-right">Giá bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {/* Back to parent folder row */}
                <tr
                  onClick={() => { setOpenedSlug(null); setQuery(''); }}
                  className="hover:bg-slate-800/60 transition-colors cursor-pointer text-slate-400 group"
                >
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-amber-400 group-hover:-translate-x-1 inline-block transition-transform">←</span>
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-300 group-hover:text-amber-300" colSpan={3}>
                    📁 .. Quay lại danh mục thể loại cha
                  </td>
                </tr>

                {booksInOpenedCategory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-slate-500 font-mono">
                      Thể loại này hiện chưa có cuốn sách nào.
                    </td>
                  </tr>
                ) : (
                  booksInOpenedCategory.map(b => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-default"
                    >
                      <td className="py-2.5 px-4 text-center text-slate-500">
                        📘
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-200">
                        {b.title}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {b.author}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-400 font-bold">
                        {fmt(b.price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'details' ? (
          /* ROOT CATEGORIES LIST TABLE (NO ACTION COLUMN - ACTIONS ARE IN TOP CONTEXT BAR) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Tên thể loại</th>
                  <th className="py-2.5 px-4 w-36 text-center">Số đầu sách</th>
                  <th className="py-2.5 px-4 w-44">Tỷ lệ lưu trữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy thể loại nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map(c => {
                    const isSelected = selectedSlug === c.id
                    const percentage = totalBooks > 0 ? Math.round((c.count / totalBooks) * 100) : 0
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedSlug(isSelected ? null : c.id)}
                        onDoubleClick={() => setOpenedSlug(c.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để mở xem sách"
                      >
                        {/* Name + Folder Icon + Slug */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-base">
                              📁
                            </div>
                            <div>
                              <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {c.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                /{c.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Book Count */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                            c.count > 0
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-500'
                          }`}>
                            {c.count} sách
                          </span>
                        </td>

                        {/* Storage ratio progress bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(c.count > 0 ? 5 : 0, percentage))}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 w-8 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ROOT CATEGORIES GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredCategories.map(c => {
              const isSelected = selectedSlug === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedSlug(isSelected ? null : c.id)}
                  onDoubleClick={() => setOpenedSlug(c.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer select-none text-center ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để mở xem sách"
                >
                  <div className="text-3xl mb-2">📁</div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{c.name}</div>
                  <div className="text-[11px] font-mono text-amber-400/80 mt-1">{c.count} đầu sách</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fallback Standalone Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl text-slate-100 my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">Kho sách Thư An</div>
                <h3 className="text-2xl font-bold text-white">Thêm thể loại mới</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-sm">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-mono uppercase tracking-wider mb-1.5">Tên thể loại</label>
                <input type="text" placeholder="Ví dụ: Công nghệ thông tin" className="w-full bg-[#090d16] border border-slate-700 text-slate-100 px-3.5 py-2 text-sm rounded-lg focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-mono uppercase tracking-wider mb-1.5">Slug định danh</label>
                <input type="text" placeholder="cong-nghe-thong-tin" className="w-full bg-[#090d16] border border-slate-700 text-amber-400 font-mono px-3.5 py-2 text-xs rounded-lg focus:outline-none focus:border-amber-400" />
                <p className="text-[11px] text-slate-500 font-mono mt-1">Dùng chữ thường, số và dấu gạch ngang.</p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 mt-5">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                  Hủy
                </button>
                <button type="button" className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md transition-all cursor-pointer">
                  Tạo thể loại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminAccounts({ onStatus }: { onStatus?: (email: string) => void }) {
  const { accounts } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts.filter(a => {
      const matchRole = roleFilter === 'all' || a.role.toLowerCase() === roleFilter.toLowerCase()
      const matchQ = !q || `${a.name} ${a.email} ${a.role}`.toLowerCase().includes(q)
      return matchRole && matchQ
    })
  }, [accounts, query, roleFilter])

  return (
    <div className="w-full space-y-6 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Quản lý tài khoản</h2>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg font-medium self-start sm:self-auto">
          Tổng cộng <strong className="text-amber-400">{accounts.length}</strong> người dùng
        </div>
      </div>

      {/* Unified Table Card */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Integrated Toolbar */}
        <div className="p-3.5 border-b border-slate-800/80 bg-[#090d16] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              aria-label="Tìm tài khoản"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Họ tên, email hoặc vai trò..."
              className="w-full bg-[#090d16] border border-slate-700/80 text-slate-200 px-3.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-amber-400 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {['all', 'admin', 'customer'].map(rf => (
              <button
                key={rf}
                type="button"
                onClick={() => setRoleFilter(rf)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  roleFilter === rf
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {rf === 'all' ? 'Tất cả' : rf === 'admin' ? 'Quản trị viên' : 'Khách hàng'}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Người dùng</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 w-32 text-center">Xác minh</th>
                <th className="py-3 px-4 w-28 text-center">Vai trò</th>
                <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                <th className="py-3 px-4 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs font-mono text-slate-400">
                    Không tìm thấy tài khoản nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(a => {
                  const initials = a.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
                  const isAdmin = a.role.toLowerCase() === 'admin'
                  return (
                    <tr key={a.email} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold ${
                            isAdmin ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30' : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {initials}
                          </div>
                          <span className="text-slate-100 font-medium text-xs sm:text-sm">{a.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 truncate">{a.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${a.verified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {a.verified ? '✓ Đã xác minh' : 'Chưa xác minh'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-mono font-semibold uppercase text-[11px] ${isAdmin ? 'bg-amber-400/15 text-amber-400 border border-amber-400/25' : 'bg-sky-500/10 text-sky-400 border border-sky-500/25'}`}>
                          {a.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${a.status === 'Hoạt động' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isAdmin ? (
                          <button
                            onClick={() => onStatus?.(a.email)}
                            className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              a.status === 'Hoạt động'
                                ? 'border border-rose-500/30 text-rose-400 hover:border-rose-500 hover:text-white hover:bg-rose-950/40'
                                : 'border border-emerald-500/30 text-emerald-400 hover:border-emerald-500 hover:text-white hover:bg-emerald-950/40'
                            }`}
                          >
                            {a.status === 'Hoạt động' ? 'Khóa' : 'Mở khóa'}
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-slate-500 font-medium">Cố định</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminSecurityEvents() {
  const { events: SECURITY_EVENTS } = useContext(DataCtx)
  return (
    <div className="space-y-6 text-slate-100 font-opensans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Sự kiện bảo mật</h2>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg">
          Tổng cộng <strong className="text-amber-400">{SECURITY_EVENTS.length}</strong> sự kiện
        </div>
      </div>

      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#090d16] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4 w-40">Thời gian</th>
                <th className="py-3 px-4">Sự kiện & Request ID</th>
                <th className="py-3 px-4 w-32 text-center">Mức độ</th>
                <th className="py-3 px-4">Request / Endpoint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {SECURITY_EVENTS.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs font-mono text-slate-400">
                    Chưa có sự kiện bảo mật nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                SECURITY_EVENTS.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{e.time}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-100 font-mono font-bold">{e.event}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">{e.id}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${levelColor(e.level)}`}>{e.level}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 font-mono truncate">{e.request}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AdminInventory({
  onSelect,
  books: propBooks,
  movements: propMovements,
}: {
  onSelect?: (id: number) => void
  books?: any[]
  movements?: any[]
}) {
  const { books: contextBooks } = useContext(DataCtx)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [openedBookId, setOpenedBookId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details')
  const [sortBy, setSortBy] = useState<'stock' | 'title'>('stock')
  const [sortAsc, setSortAsc] = useState(true)

  // Normalize source books
  const allBooks = useMemo(() => {
    const raw = (propBooks && propBooks.length > 0) ? propBooks : contextBooks
    return raw.map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      stock: Number(b.stock) || 0,
      category: b.category || b.categoryName || 'Sách',
      lastMovementAt: b.lastMovementAt,
    }))
  }, [propBooks, contextBooks])

  const stats = useMemo(() => {
    const totalTitles = allBooks.length
    const totalUnits = allBooks.reduce((sum, b) => sum + b.stock, 0)
    const lowStock = allBooks.filter(b => b.stock > 0 && b.stock <= 10).length
    const outOfStock = allBooks.filter(b => b.stock === 0).length
    return { totalTitles, totalUnits, lowStock, outOfStock }
  }, [allBooks])

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allBooks.filter(b => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'low' && b.stock > 0 && b.stock <= 10) ||
        (filter === 'out' && b.stock === 0)
      const matchQ = !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)
      return matchFilter && matchQ
    })

    list.sort((a, b) => {
      if (sortBy === 'stock') {
        return sortAsc ? a.stock - b.stock : b.stock - a.stock
      } else {
        return sortAsc ? a.title.localeCompare(b.title, 'vi') : b.title.localeCompare(a.title, 'vi')
      }
    })

    return list
  }, [allBooks, query, filter, sortBy, sortAsc])

  const selectedBook = useMemo(() => {
    return allBooks.find(b => b.id === selectedId) || null
  }, [allBooks, selectedId])

  const openedBook = useMemo(() => {
    return allBooks.find(b => b.id === openedBookId) || null
  }, [allBooks, openedBookId])

  const bookMovements = useMemo(() => {
    if (!openedBookId || !propMovements) return []
    return propMovements.filter((m: any) => m.bookId === openedBookId)
  }, [openedBookId, propMovements])

  const movementLabels: Record<string, string> = {
    opening: 'Số dư đầu',
    sale: 'Xuất bán',
    return: 'Hoàn kho',
    adjustment: 'Điều chỉnh',
  }

  return (
    <div className="w-full space-y-4 font-opensans text-slate-100 select-none">
      {/* 1. TOP BREADCRUMB ADDRESS BAR & QUICK CONTROLS */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            disabled={!openedBookId}
            onClick={() => { setOpenedBookId(null); setQuery(''); }}
            title={openedBookId ? "Quay lại danh sách tồn kho" : "Đang ở danh mục kho"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              openedBookId
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/30 cursor-pointer shadow-sm font-bold'
                : 'text-slate-600 bg-slate-900/40 border border-slate-800/60 cursor-not-allowed opacity-40 font-bold'
            }`}
          >
            ←
          </button>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090d16] border border-slate-800 rounded-lg text-xs font-medium flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📁</span>
              <span>Kho sách</span>
            </span>
            <span className="text-slate-600 font-bold select-none">›</span>

            <button
              type="button"
              onClick={() => { setOpenedBookId(null); setQuery(''); }}
              className={`hover:text-amber-400 px-1 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                !openedBookId ? 'text-amber-400 font-semibold' : 'text-slate-300'
              }`}
            >
              <span>📦</span>
              <span>Quản lý tồn kho</span>
            </button>

            {openedBook && (
              <>
                <span className="text-slate-600 font-bold select-none">›</span>
                <span className="text-amber-300 font-semibold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1.5">
                  <span>📋</span>
                  <span className="truncate max-w-[220px]">Sổ biến động: {openedBook.title}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Search box & Status filter pills */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-60">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={openedBook ? "Tìm trong lịch sử..." : "Tìm tên sách, tác giả..."}
              className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>

          {!openedBookId && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
              {[
                { key: 'all', label: 'Tất cả', count: stats.totalTitles },
                { key: 'low', label: 'Sắp hết', count: stats.lowStock, alert: stats.lowStock > 0 },
                { key: 'out', label: 'Hết hàng', count: stats.outOfStock, danger: stats.outOfStock > 0 },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key as typeof filter)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filter === f.key
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    filter === f.key
                      ? 'bg-slate-950/20 text-slate-950 font-bold'
                      : f.danger ? 'text-rose-400 bg-rose-500/10' : f.alert ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. SMART CONTEXT ACTION BAR (Thao tác xuất hiện khi chọn dòng - Tuyệt đối không cần cột Thao tác) */}
      <div className={`rounded-xl border p-2.5 transition-all flex flex-wrap items-center justify-between gap-2.5 ${
        selectedBook && !openedBookId
          ? 'bg-amber-400/10 border-amber-400/40 shadow-md ring-1 ring-amber-400/20'
          : 'bg-[#0f172a]/50 border-slate-800'
      }`}>
        {selectedBook && !openedBookId ? (
          /* ACTIVE SELECTION ACTIONS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">✓</span>
              <span className="text-xs text-slate-300">Đã chọn:</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                {selectedBook.title}
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                selectedBook.stock === 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : selectedBook.stock <= 10
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                Tồn: {selectedBook.stock} cuốn
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">({selectedBook.category})</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Điều chỉnh tồn kho */}
              <button
                type="button"
                onClick={() => onSelect?.(selectedBook.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-md"
              >
                <span>⚡</span>
                <span>Điều chỉnh tồn kho</span>
              </button>

              {/* Xem sổ biến động */}
              {propMovements && propMovements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenedBookId(selectedBook.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700"
                >
                  <span>📋</span>
                  <span>Xem sổ biến động</span>
                </button>
              )}

              {/* Bỏ chọn */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Bỏ chọn"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-xs ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* IDLE SUMMARY & CONTROLS */
          <div className="flex items-center justify-between w-full gap-2 flex-wrap text-xs text-slate-400">
            <div className="flex items-center gap-3">
              {openedBook ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <span>📋 Lịch sử biến động:</span>
                  <span className="font-bold text-white">{openedBook.title}</span>
                  <span className="text-[11px] font-mono text-amber-400">({bookMovements.length} giao dịch)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span>📦 <strong className="text-white font-mono">{stats.totalTitles}</strong> đầu sách</span>
                  <span>📊 <strong className="text-amber-400 font-mono">{stats.totalUnits}</strong> cuốn trong kho</span>
                  <span>⚠️ <strong className="text-amber-400 font-mono">{stats.lowStock}</strong> sắp hết</span>
                  <span>🚫 <strong className="text-rose-400 font-mono">{stats.outOfStock}</strong> hết hàng</span>
                  <span className="text-[11px] text-slate-500 hidden lg:inline italic">Nhấp dòng để chọn · Nhấp đúp để điều chỉnh kho</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {openedBook && (
                <button
                  type="button"
                  onClick={() => onSelect?.(openedBook.id)}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm"
                >
                  <span>⚡</span>
                  <span>Điều chỉnh ngay</span>
                </button>
              )}

              {!openedBookId && (
                <>
                  {/* Sort */}
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'stock') {
                        if (sortAsc) setSortAsc(false)
                        else { setSortBy('title'); setSortAsc(true); }
                      } else {
                        setSortBy('stock'); setSortAsc(true);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors text-xs"
                    title="Đổi thứ tự sắp xếp"
                  >
                    <span>↕</span>
                    <span>Sắp xếp:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {sortBy === 'stock' ? (sortAsc ? 'Tồn ít nhất ↑' : 'Tồn nhiều nhất ↓') : 'Tên A → Z'}
                    </span>
                  </button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('details')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'details' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Danh sách"
                    >
                      ▦ Danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hiển thị dạng Lưới"
                    >
                      ⊞ Lưới
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT: TABLE OR GRID (Clean, full width, no "Thao tác" column) */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {openedBookId ? (
          /* DRILL-DOWN: MOVEMENT LEDGER FOR THE OPENED BOOK */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4 w-10"></th>
                  <th className="py-2.5 px-4 w-36">Loại biến động</th>
                  <th className="py-2.5 px-4 w-32 text-center">Biến động</th>
                  <th className="py-2.5 px-4 w-32 text-center">Tồn sau</th>
                  <th className="py-2.5 px-4">Ghi chú & Căn cứ</th>
                  <th className="py-2.5 px-4 w-44 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {/* Back to inventory row */}
                <tr
                  onClick={() => { setOpenedBookId(null); setQuery(''); }}
                  className="hover:bg-slate-800/60 transition-colors cursor-pointer text-slate-400 group"
                >
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-amber-400 group-hover:-translate-x-1 inline-block transition-transform font-bold">←</span>
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-300 group-hover:text-amber-300" colSpan={5}>
                    📦 .. Quay lại danh mục quản lý tồn kho
                  </td>
                </tr>

                {bookMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-500 font-mono">
                      Chưa có lịch sử biến động kho cho cuốn sách này.
                    </td>
                  </tr>
                ) : (
                  bookMovements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors cursor-default">
                      <td className="py-2.5 px-4 text-center text-slate-500">
                        {m.quantityDelta > 0 ? '🟢' : '🔴'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-200">
                        {movementLabels[m.movementType] || m.movementType}
                        {m.referenceId ? ` (#${m.referenceId})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold">
                        <span className={m.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono text-slate-300 font-bold">
                        {m.balanceAfter} cuốn
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {m.note || 'Không có ghi chú'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-400 text-[11px]">
                        {new Date(m.createdAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'details' ? (
          /* ROOT INVENTORY LIST TABLE (NO ACTION COLUMN - ACTIONS ARE IN TOP CONTEXT BAR) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#090d16] text-slate-400 font-semibold text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-4">Đầu sách & Tác giả</th>
                  <th className="py-2.5 px-4 w-40 text-center">Tình trạng tồn</th>
                  <th className="py-2.5 px-4 w-32 text-center">Tồn kho</th>
                  <th className="py-2.5 px-4 w-48">Mức độ dự trữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-slate-500 font-mono">
                      Không tìm thấy đầu sách nào phù hợp với bộ lọc tồn kho.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map(b => {
                    const isSelected = selectedId === b.id
                    // Safe inventory benchmark: 30 units = full bar
                    const percentage = Math.min(100, Math.round((b.stock / 30) * 100))
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedId(isSelected ? null : b.id)}
                        onDoubleClick={() => onSelect?.(b.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-amber-400/15 text-white border-l-4 border-amber-400 shadow-sm'
                            : 'hover:bg-slate-800/40 text-slate-200'
                        }`}
                        title="Nhấp để chọn · Nhấp đúp để điều chỉnh tồn kho"
                      >
                        {/* Title & Author & Category */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-base">
                              {b.stock === 0 ? '🚫' : b.stock <= 10 ? '⚠️' : '📦'}
                            </div>
                            <div>
                              <div className={`font-semibold text-sm ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                                {b.title}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>{b.author}</span>
                                <span className="text-slate-600">·</span>
                                <span className="font-mono text-slate-500">[{b.category}]</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {b.stock === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Hết hàng
                            </span>
                          ) : b.stock <= 10 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Sắp hết ({b.stock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Sẵn hàng
                            </span>
                          )}
                        </td>

                        {/* Stock count */}
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono text-sm font-bold ${
                            b.stock === 0
                              ? 'text-rose-400'
                              : b.stock <= 10
                              ? 'text-amber-400'
                              : 'text-slate-100'
                          }`}>
                            {b.stock} cuốn
                          </span>
                        </td>

                        {/* Stock level visual bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  b.stock === 0
                                    ? 'bg-rose-500'
                                    : b.stock <= 10
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.max(b.stock > 0 ? 6 : 0, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ROOT INVENTORY GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredBooks.map(b => {
              const isSelected = selectedId === b.id
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(isSelected ? null : b.id)}
                  onDoubleClick={() => onSelect?.(b.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer select-none text-center ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-md ring-1 ring-amber-400'
                      : 'bg-[#090d16] border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                  title="Nhấp để chọn · Nhấp đúp để điều chỉnh kho"
                >
                  <div className="text-3xl mb-2">
                    {b.stock === 0 ? '🚫' : b.stock <= 10 ? '⚠️' : '📦'}
                  </div>
                  <div className="font-semibold text-xs text-white line-clamp-1">{b.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{b.author}</div>
                  <div className={`mt-2 font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                    b.stock === 0
                      ? 'bg-rose-500/10 text-rose-400'
                      : b.stock <= 10
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    Tồn: {b.stock} cuốn
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminAudit() {
  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">Bảo mật & Kiểm toán</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Nhật ký quản trị</h2>
      </div>
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-16 text-center shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-amber-400 text-2xl">
          🛡️
        </div>
        <div className="text-lg font-bold text-white mb-2">Chưa có thao tác được ghi nhận</div>
        <div className="text-xs text-slate-400 font-mono">Các thao tác quản trị sẽ được ghi lại tự động tại đây.</div>
      </div>
    </div>
  )
}

export function BookDetailPage({
  book,
  onBack,
  onAdd,
  onSelect,
}: {
  book: typeof BOOKS[0]
  onBack: () => void
  onAdd: (b: typeof BOOKS[0], quantity?: number) => void | boolean | Promise<boolean>
  onSelect: (b: typeof BOOKS[0]) => void
}) {
  const { books: BOOKS } = useContext(DataCtx)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [activeTab, setActiveTab] = useState<'desc' | 'details'>('desc')
  const [activeImg, setActiveImg] = useState(0)
  const { user } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [wished, setWished] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)
  const [wishReady, setWishReady] = useState(!user)
  useEffect(() => {
    if (!user) { setWished(false); setWishReady(true); return }
    let active = true
    setWishReady(false)
    void api<{ id: number }[]>('/api/profile/wishlist')
      .then(result => { if (active) setWished(result.data.some(item => item.id === book.id)) })
      .catch(() => {})
      .finally(() => { if (active) setWishReady(true) })
    return () => { active = false }
  }, [user?.id, book.id])
  async function toggleWish() {
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return }
    if (wishBusy || !wishReady) return
    setWishBusy(true)
    try { await api(`/api/profile/wishlist/${book.id}`, { method: wished ? 'DELETE' : 'PUT' }); setWished(!wished); window.dispatchEvent(new Event('wishlist-changed')); toast(wished ? 'Đã bỏ khỏi danh sách yêu thích' : 'Đã lưu sách yêu thích', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể lưu sách', 'error') }
    finally { setWishBusy(false) }
  }

  // Extra gallery images per category (Unsplash)
  const galleryImgs: Record<string, string[]> = {
    'Công nghệ': ['photo-1518770660439-4636190af475','photo-1461749280684-dccba630e2f6','photo-1555066931-4365d14bab8c'],
    'Kỹ năng': ['photo-1434030216411-0b793f4b4173','photo-1488190211105-8b0e65b80b4e','photo-1484480974693-6ca0a78fb36b'],
    'Văn học': ['photo-1481627834876-b7833e8f5570','photo-1512436991641-6745cdb1723f','photo-1495446815901-a7297e633e8d'],
    'Kinh doanh': ['photo-1507679799987-c73779587ccf','photo-1454165804606-c3d57bc86b40','photo-1559136555-9303baea8ebd'],
    'Lịch sử - Xã hội': ['photo-1461360370896-922624d12aa1','photo-1529148482759-b35b25c5f217','photo-1513475382585-d06e58bcb0e0'],
    'Thiếu nhi': ['photo-1512436991641-6745cdb1723f','photo-1472162072942-cd5147eb3902','photo-1481627834876-b7833e8f5570'],
  }
  const extraImgs = galleryImgs[book.category] || galleryImgs['Văn học']

  const catColor: Record<string, string> = {
    'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035',
    'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28',
  }
  const bg = catColor[book.category] || '#2b2520'

  const related = BOOKS.filter(b => b.id !== book.id && b.category === book.category).slice(0, 4)
  const others = related.length < 3 ? BOOKS.filter(b => b.id !== book.id).slice(0, 4) : related

  async function handleAdd() {
    const success = await onAdd(book, qty)
    if (success) { setAdded(true); setTimeout(() => setAdded(false), 2000) }
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Back breadcrumb */}
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-sm group"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="transition-transform group-hover:-translate-x-0.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Quay lại
          </button>
          <span className="text-[#2b2520]">/</span>
          <span className="text-[#7a6f64] text-sm">{book.category}</span>
          <span className="text-[#2b2520]">/</span>
          <span className="text-[#b5a99b] text-sm truncate max-w-xs">{book.title}</span>
        </div>
      </div>

      {/* Hero section */}
      <div className="relative overflow-hidden">
        {/* Blurred bg glow from cover */}
        <div
          className="absolute inset-0 opacity-10 blur-3xl scale-150"
          style={{ backgroundColor: bg }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-[340px_1fr] lg:grid-cols-[400px_1fr] gap-12 lg:gap-20 items-start">

            {/* Gallery column */}
            <div className="reveal flex flex-col gap-4">
              {/* Main image */}
              <div className="relative">
                <div className="absolute -inset-3 rounded-sm opacity-25 blur-2xl" style={{ backgroundColor: bg }} />
                <div className="relative rounded-sm overflow-hidden shadow-2xl aspect-[3/4]" style={{ backgroundColor: bg }}>
                  {activeImg === 0 ? (
                    !imgError ? (
                      <img src={book.cover} alt={book.title} className="w-full h-full object-cover transition-opacity duration-300" onError={() => setImgError(true)} />
                    ) : (
                      <FallbackCover title={book.title} author={book.author} bg={bg} large />
                    )
                  ) : (
                    <img
                      key={activeImg}
                      src={`https://images.unsplash.com/${extraImgs[activeImg - 1]}?w=600&h=800&fit=crop&auto=format&q=80`}
                      alt={`Ảnh ${activeImg + 1}`}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                  )}
                </div>
                {/* Stock badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-sm ${book.stock < 10 ? 'bg-red-900/70 text-red-300 border-red-800/50' : 'bg-emerald-900/70 text-emerald-300 border-emerald-800/50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${book.stock < 10 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    {book.stock < 10 ? `Còn ${book.stock} cuốn` : `Còn hàng · ${book.stock} cuốn`}
                  </div>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 mt-2">
                {/* Cover thumb */}
                <button
                  onClick={() => setActiveImg(0)}
                  className={`relative flex-none w-16 aspect-[3/4] rounded-sm overflow-hidden border-2 transition-all ${activeImg === 0 ? 'border-[#c8a94d]' : 'border-[#22201d] opacity-60 hover:opacity-80'}`}
                  style={{ backgroundColor: bg }}
                >
                  {!imgError
                    ? <img src={book.cover} alt="cover" className="w-full h-full object-cover" />
                    : <FallbackCover title={book.title} author={book.author} bg={bg} />}
                </button>
                {/* Extra thumbs */}
                {extraImgs.map((photo, i) => (
                  <button
                    key={photo}
                    onClick={() => setActiveImg(i + 1)}
                    className={`relative flex-none w-16 aspect-[3/4] rounded-sm overflow-hidden border-2 transition-all bg-[#1c1815] ${activeImg === i + 1 ? 'border-[#c8a94d]' : 'border-[#22201d] opacity-60 hover:opacity-80'}`}
                  >
                    <img
                      src={`https://images.unsplash.com/${photo}?w=200&h=260&fit=crop&auto=format&q=70`}
                      alt={`ảnh ${i + 2}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Label overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-end p-1">
                      <span className="text-[8px] text-white/70 leading-none">{['Bên trong', 'Chi tiết', 'Bối cảnh'][i]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info column */}
            <div className="reveal" style={{ transitionDelay: '100ms' }}>
              {/* Category + label */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-px bg-[#c8a94d]" />
                <span className="text-[10px] tracking-[0.3em] text-[#c8a94d] uppercase font-mono">{book.category}</span>
              </div>

              {/* Title */}
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-[#ede7dc] font-semibold leading-tight mb-4">
                {book.title}
              </h1>

              {/* Author */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-7 h-7 rounded-full bg-[#1c1815] border border-[#2b2520] flex items-center justify-center">
                  <span className="font-display text-[#c8a94d] text-xs font-bold">{book.author[0]}</span>
                </div>
                <span className="text-[#b5a99b] text-sm">{book.author}</span>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-2 mb-8">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= 4 ? '#c8a94d' : 'none'} stroke="#c8a94d" strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-[#7a6f64] text-xs font-mono">4.2 · 128 đánh giá</span>
              </div>

              {/* Description */}
              <p className="text-[#b5a99b] text-base leading-relaxed mb-10 max-w-lg">
                {book.description}
              </p>

              {/* Price block */}
              <div className="flex items-baseline gap-4 mb-8">
                <span className="font-display text-4xl text-[#c8a94d] font-semibold">{fmt(book.price)}</span>
                <span className="text-[#7a6f64] text-sm line-through font-mono">{fmt(Math.round(book.price * 1.15))}</span>
                <span className="text-emerald-400 text-xs font-mono bg-emerald-900/30 border border-emerald-800/40 px-2 py-0.5 rounded-sm">-13%</span>
              </div>

              {/* Qty + Add to cart */}
              <div className="flex items-center gap-4 mb-6">
                {/* Qty stepper */}
                <div className="flex items-center border border-[#2b2520] rounded-sm">
                  <button
                    aria-label="Giảm số lượng"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-10 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
                  </button>
                  <span className="w-10 text-center text-[#ede7dc] font-mono text-sm">{qty}</span>
                  <button
                    aria-label="Tăng số lượng"
                    onClick={() => setQty(q => Math.min(book.stock, q + 1))}
                    className="w-10 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>

                {/* Add to cart */}
                <button
                  disabled={book.stock < 1}
                  onClick={handleAdd}
                  className={`flex-1 max-w-xs flex items-center justify-center gap-2 py-3 px-6 rounded-sm font-semibold text-sm transition-all duration-300 ${
                    added
                      ? 'bg-emerald-600 text-white border border-emerald-500'
                      : 'btn-gold text-[#0b0907]'
                  }`}
                >
                  {added ? (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                      Đã thêm vào giỏ
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                      </svg>
                      Thêm vào giỏ hàng
                    </>
                  )}
                </button>

                {/* Wishlist */}
                <button aria-label={wished ? 'Bỏ yêu thích' : 'Lưu sách yêu thích'} aria-pressed={wished} disabled={wishBusy || !wishReady} onClick={() => void toggleWish()} className="w-11 h-11 flex items-center justify-center border border-[#2b2520] rounded-sm text-[#7a6f64] hover:text-red-400 hover:border-red-900/50 transition-colors">
                  <svg width="18" height="18" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-5 pt-6 border-t border-[#22201d]">
                {[
                  ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 'Thanh toán bảo mật'],
                  ['M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', 'Miễn phí vận chuyển'],
                  ['M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', 'Đổi trả 7 ngày'],
                ].map(([path, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <svg width="15" height="15" fill="none" stroke="#c8a94d" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
                    </svg>
                    <span className="text-xs text-[#7a6f64]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Mô tả / Chi tiết */}
      <div className="border-y border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {(['desc', 'details'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`py-4 text-sm border-b-2 transition-colors ${
                  activeTab === t
                    ? 'border-[#c8a94d] text-[#ede7dc]'
                    : 'border-transparent text-[#7a6f64] hover:text-[#b5a99b]'
                }`}
              >
                {t === 'desc' ? 'Mô tả sách' : 'Thông tin chi tiết'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'desc' ? (
          <div className="max-w-2xl reveal">
            <p className="text-[#b5a99b] leading-relaxed text-base mb-6">{book.description}</p>
            <p className="text-[#b5a99b] leading-relaxed text-base mb-6">
              Đây là một trong những cuốn sách được đánh giá cao trong thể loại {book.category.toLowerCase()}. Tác giả {book.author} đã dành nhiều năm nghiên cứu và tổng hợp kiến thức chuyên sâu, mang lại cho độc giả góc nhìn toàn diện và thực tiễn.
            </p>
            <p className="text-[#b5a99b] leading-relaxed text-base">
              Cuốn sách phù hợp với những ai muốn nâng cao kiến thức trong lĩnh vực {book.category.toLowerCase()}, từ người mới bắt đầu cho đến những người đã có kinh nghiệm.
            </p>
          </div>
        ) : (
          <div className="max-w-lg reveal">
            <div className="space-y-0">
              {[
                ['Tên sách', book.title],
                ['Tác giả', book.author],
                ['Thể loại', book.category],
                ['ISBN', book.isbn],
                ['Ngôn ngữ', 'Tiếng Anh / Việt'],
                ['Số trang', '320 trang'],
                ['Nhà xuất bản', 'NXB Thế Giới'],
                ['Năm xuất bản', '2023'],
                ['Tồn kho', `${book.stock} cuốn`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-3.5 border-b border-[#22201d] last:border-b-0 text-sm">
                  <span className="text-[#7a6f64] font-mono text-xs uppercase tracking-wider w-32 shrink-0">{k}</span>
                  <span className="text-[#ede7dc] text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Related books */}
      {/* Reviews Section */}
      <ReviewsSection bookId={book.id} bookTitle={book.title} />

      {others.length > 0 && (
        <div className="border-t border-[#22201d] py-16 bg-[#0f0d0b]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="reveal mb-10">
              <SectionLabel>{related.length >= 3 ? 'Cùng thể loại' : 'Có thể bạn thích'}</SectionLabel>
              <h2 className="font-display text-3xl text-[#ede7dc] font-medium">
                {related.length >= 3 ? `Thêm sách ${book.category}` : 'Những lựa chọn khác'}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {others.map((b, i) => (
                <RevealItem key={b.id} delay={i * 80}>
                  <BookCard book={b} onAdd={onAdd} onSelect={() => onSelect(b)} />
                </RevealItem>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const SEED_REVIEWS: Record<number, { author: string; stars: number; date: string; body: string }[]> = {
  1: [
    { author: 'Minh Tuấn', stars: 5, date: '12/09/2026', body: 'Cuốn sách rất hay, ngôn ngữ dễ hiểu và logic rõ ràng. Tôi đã đọc xong trong 3 ngày.' },
    { author: 'Lan Anh', stars: 4, date: '05/09/2026', body: 'Nội dung phong phú, nhiều ví dụ thực tế. Trừ một sao vì bìa sách hơi dễ bị nhăn.' },
  ],
  2: [
    { author: 'Hoàng Nam', stars: 5, date: '08/09/2026', body: 'Một trong những cuốn sách hay nhất tôi từng đọc năm nay. Cực kỳ khuyến khích!' },
  ],
}

export function ReviewsSection({ bookId, bookTitle }: { bookId: number; bookTitle: string }) {
  const { user } = useSession()
  const { reviews: persistedReviews, reload } = useContext(ReviewDataCtx)
  const navigate = useNavigate()
  const light = useTheme() === 'light'
  const toast = useToast()
  const reviews = persistedReviews.map(review => ({ author: review.userName, stars: review.rating, date: new Date(review.createdAt).toLocaleDateString('vi-VN'), body: review.content }))
  const [hoverStar, setHoverStar] = useState(0)
  const [star, setStar] = useState(0)
  const [body, setBody] = useState('')
  const [name, setName] = useState(user?.fullName ?? '')
  const [submitting, setSubmitting] = useState(false)
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return }
    if (!star) { toast('Vui lòng chọn số sao', 'error'); return }
    if (!body.trim()) { toast('Vui lòng nhập nhận xét', 'error'); return }
    if (!name.trim()) { toast('Vui lòng nhập tên', 'error'); return }
    setSubmitting(true)
    try { await api(`/api/books/${bookId}/reviews`, { method: 'POST', body: JSON.stringify({ rating: star, content: body }) }); await reload(); setStar(0); setBody(''); toast('Cảm ơn bạn đã đánh giá!', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể gửi đánh giá', 'error') }
    finally { setSubmitting(false) }
  }

  return (
    <div className={`border-t py-16 ${light ? 'border-[#d5cfc4]' : 'border-[#22201d]'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-[1fr_360px] gap-16">
          {/* Reviews list */}
          <div>
            <div className="reveal flex items-end gap-5 mb-10">
              <div>
                <SectionLabel>Nhận xét độc giả</SectionLabel>
                <h2 className={`font-display text-3xl font-medium mt-1 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Đánh giá sách</h2>
              </div>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s <= Math.round(avg) ? '#c8a94d' : 'none'} stroke="#c8a94d" strokeWidth="1.5">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-[#7a6f64]">{avg.toFixed(1)} · {reviews.length} đánh giá</span>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className={`rounded-sm border p-8 text-center ${light ? 'border-[#d5cfc4]' : 'border-[#22201d]'}`}>
                <p className="text-[#7a6f64] text-sm">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((r, i) => (
                  <div key={i} className={`p-5 rounded-sm border ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c8a94d] to-[#bf6c3e] flex items-center justify-center text-[#0b0907] font-bold text-sm shrink-0">
                          {r.author[0]}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{r.author}</div>
                          <div className="text-[10px] text-[#7a6f64] font-mono">{r.date}</div>
                        </div>
                      </div>
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= r.stars ? '#c8a94d' : 'none'} stroke="#c8a94d" strokeWidth="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                    </div>
                    {import.meta.env.VITE_SECURITY_MODE === 'baseline' ?
                      // SECURITY LAB: preserve the existing TC02 baseline-only demonstration.
                      <p className={`text-sm leading-relaxed ${light ? 'text-[#5a4f44]' : 'text-[#b5a99b]'}`} dangerouslySetInnerHTML={{ __html: r.body }} /> :
                      <p className={`text-sm leading-relaxed ${light ? 'text-[#5a4f44]' : 'text-[#b5a99b]'}`}>{r.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit form */}
          <div>
            <div className={`rounded-sm border p-6 sticky top-24 ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
              <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-4">Viết đánh giá</div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <div className="text-xs text-[#7a6f64] mb-2">Chọn số sao</div>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" aria-label={`${s} sao`} aria-pressed={star === s}
                        onMouseEnter={() => setHoverStar(s)} onMouseLeave={() => setHoverStar(0)}
                        onClick={() => setStar(s)}
                        className="transition-transform hover:scale-110">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill={s <= (hoverStar || star) ? '#c8a94d' : 'none'} stroke="#c8a94d" strokeWidth="1.5">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    ))}
                    {star > 0 && <span className="ml-2 text-xs text-[#c8a94d] self-center">{['', 'Tệ', 'Không hay', 'Bình thường', 'Hay', 'Xuất sắc'][star]}</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Tên của bạn</label>
                  <input aria-label="Tên của bạn" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A"
                    className={`w-full px-3 py-2.5 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
                </div>
                <div>
                  <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Nhận xét</label>
                  <textarea aria-label="Nhận xét" value={body} onChange={e => setBody(e.target.value)} rows={4}
                    placeholder={`Cảm nhận của bạn về "${bookTitle}"…`}
                    className={`w-full px-3 py-2.5 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] resize-none ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full btn-gold text-[#0b0907] font-semibold py-2.5 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting ? <><svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang gửi…</> : 'Gửi đánh giá'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CartPage({
  items,
  onUpdate,
  onRemove,
  onCheckout,
  onContinue,
}: {
  items: CartItem[]
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
          <div className="grid lg:grid-cols-[1fr_360px] gap-10">
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
                        {!hasErr ? (
                          <img src={item.book.cover} alt={item.book.title} className="w-full h-full object-cover"
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
                        <button aria-label={`Giảm số lượng ${item.book.title}`} onClick={() => item.qty > 1 ? onUpdate(item.book.id, item.qty - 1) : onRemove(item.book.id)}
                          className="w-8 h-9 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-lg leading-none">−</button>
                        <span className="w-8 text-center text-sm text-[#ede7dc] font-mono">{item.qty}</span>
                        <button onClick={() => onUpdate(item.book.id, item.qty + 1)}
                          className="w-8 h-9 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-lg leading-none">+</button>
                      </div>
                      {/* Price */}
                      <div className="text-right shrink-0 w-28">
                        <div className="font-mono text-[#c8a94d] text-sm font-semibold">{fmt(item.book.price * item.qty)}</div>
                        {item.qty > 1 && <div className="text-[#7a6f64] text-xs font-mono">{fmt(item.book.price)} × {item.qty}</div>}
                      </div>
                      {/* Remove */}
                      <button aria-label={`Xóa ${item.book.title} khỏi giỏ`} onClick={() => onRemove(item.book.id)}
                        className="shrink-0 w-7 h-7 flex items-center justify-center text-[#7a6f64] hover:text-red-400 transition-colors">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
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
                <button onClick={onCheckout} className="w-full btn-gold text-[#0b0907] font-semibold py-3.5 rounded-sm text-sm flex items-center justify-center gap-2">
                  Tiến hành thanh toán
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                <div className="mt-4 flex items-center justify-center gap-4 text-[#7a6f64]">
                  {['Bảo mật SSL', 'Đổi trả 7 ngày'].map(t => (
                    <div key={t} className="flex items-center gap-1.5">
                      <svg width="11" height="11" fill="none" stroke="#c8a94d" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                      <span className="text-[10px]">{t}</span>
                    </div>
                  ))}
                </div>
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
    <div className="flex items-center gap-0">
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
              <div className={`w-12 md:w-20 h-px mx-3 ${done ? 'bg-[#c8a94d]/50' : 'bg-[#2b2520]'}`} />
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
  const [form, setForm] = useState({ name: user?.fullName ?? '', phone: user?.phone ?? '', email: user?.email ?? '', address: user?.addressLine ?? '', ward: '', district: '', city: 'TP. Hồ Chí Minh', payment: 'cod' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState<null | { code: string; discount: number; label: string }>(null)
  const [couponError, setCouponError] = useState('')
  const toast = useToast()
  const subtotal = items.reduce((s, i) => s + i.book.price * i.qty, 0)
  const discount = couponApplied ? Math.round(subtotal * couponApplied.discount) : 0
  const shipping = 0
  const total = subtotal - discount + shipping

  function applyCoupon() {
    const code = coupon.trim().toUpperCase()
    if (!code) { setCouponError('Vui lòng nhập mã ưu đãi'); return }
    setCouponApplied({ code, discount: 0, label: 'Kiểm tra ưu đãi khi xác nhận đơn' })
    setCouponError('')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Vui lòng nhập họ tên'
    if (!form.phone.trim()) e.phone = 'Vui lòng nhập số điện thoại'
    if (!form.email.trim()) e.email = 'Vui lòng nhập email'
    if (!form.address.trim()) e.address = 'Vui lòng nhập địa chỉ'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSubmitting(true)
    try {
      const result = await api<{ id: number; paymentUrl?: string; qrCode?: string }>('/api/orders', {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey.current },
        body: JSON.stringify({
          customerName: form.name,
          phone: form.phone,
          shippingAddress: [form.address, form.ward, form.district, form.city].filter(Boolean).join(', '),
          couponCode: couponApplied?.code,
          paymentMethod: form.payment
        })
      })
      if (form.payment !== 'cod' && result.data.paymentUrl) {
        toast('Đang chuyển hướng đến cổng thanh toán...', 'info')
        window.location.href = result.data.paymentUrl
        return
      }
      onConfirm(String(result.data.id))
    } catch (error) { toast(error instanceof Error ? error.message : 'Không thể tạo đơn', 'error') }
    finally { setSubmitting(false) }
  }

  const payments = [
    { id: 'cod', label: 'Thanh toán khi nhận hàng', sub: 'COD — nhân viên giao hàng thu tiền tận nơi', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'vnpay', label: 'Cổng thanh toán VNPAY (Sandbox)', sub: 'Thẻ ATM nội địa NCB, Thẻ Visa/Mastercard, VNPAY-QR', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  ]

  const imgErrors: Record<number, boolean> = {}
  const catColor: Record<string, string> = { 'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035', 'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28' }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <StepIndicator current={2} />
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#ede7dc] transition-colors group">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            Giỏ hàng
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-[1fr_380px] gap-10">
            {/* Left: form */}
            <div className="space-y-8">
              {/* Customer info */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">01 · Thông tin khách hàng</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: 'name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A', type: 'text' },
                    { key: 'phone', label: 'Số điện thoại', placeholder: '0912 345 678', type: 'tel' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{f.label}</label>
                      <input aria-label={f.label} required type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                        className={`w-full bg-[#1c1815] border px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none placeholder-[#7a6f64] transition-colors ${errors[f.key] ? 'border-red-700' : 'border-[#2b2520] focus:border-[#c8a94d]/60'}`} />
                      {errors[f.key] && <p className="text-red-400 text-xs mt-1">{errors[f.key]}</p>}
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Email</label>
                    <input aria-label="Email" disabled type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com"
                      className={`w-full bg-[#1c1815] border px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none placeholder-[#7a6f64] transition-colors ${errors.email ? 'border-red-700' : 'border-[#2b2520] focus:border-[#c8a94d]/60'}`} />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">02 · Địa chỉ giao hàng</div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Địa chỉ</label>
                    <input aria-label="Địa chỉ" required minLength={8} type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Số nhà, tên đường..."
                      className={`w-full bg-[#1c1815] border px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none placeholder-[#7a6f64] transition-colors ${errors.address ? 'border-red-700' : 'border-[#2b2520] focus:border-[#c8a94d]/60'}`} />
                    {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Phường / Xã</label>
                      <input aria-label="Phường / Xã" type="text" value={form.ward} onChange={e => set('ward', e.target.value)}
                        className="w-full bg-[#1c1815] border border-[#2b2520] px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64]" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Quận / Huyện</label>
                      <input aria-label="Quận / Huyện" type="text" value={form.district} onChange={e => set('district', e.target.value)}
                        className="w-full bg-[#1c1815] border border-[#2b2520] px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Tỉnh / Thành phố</label>
                    <select aria-label="Tỉnh / Thành phố" value={form.city} onChange={e => set('city', e.target.value)}
                      className="w-full bg-[#1c1815] border border-[#2b2520] px-4 py-3 text-sm text-[#ede7dc] rounded-sm focus:outline-none focus:border-[#c8a94d]/60">
                      {['TP. Hồ Chí Minh','Hà Nội','Đà Nẵng','Cần Thơ','Hải Phòng','Bình Dương','Đồng Nai'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">03 · Phương thức thanh toán</div>
                <div className="space-y-3">
                  {payments.map(p => (
                    <label key={p.id}
                      className={`flex items-center gap-4 p-4 rounded-sm border cursor-pointer transition-all ${form.payment === p.id ? 'border-[#c8a94d]/50 bg-[#c8a94d]/5' : 'border-[#2b2520] hover:border-[#2b2520]/80'}`}>
                      <input type="radio" name="payment" value={p.id} checked={form.payment === p.id} onChange={() => set('payment', p.id)} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.payment === p.id ? 'border-[#c8a94d]' : 'border-[#2b2520]'}`}>
                        {form.payment === p.id && <div className="w-2 h-2 rounded-full bg-[#c8a94d]" />}
                      </div>
                      <svg className="shrink-0" width="20" height="20" fill="none" stroke={form.payment === p.id ? '#c8a94d' : '#7a6f64'} strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                      </svg>
                      <div>
                        <div className="text-sm text-[#ede7dc] font-medium">{p.label}</div>
                        <div className="text-xs text-[#7a6f64] mt-0.5">{p.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: summary */}
            <div className="lg:sticky lg:top-24 h-fit space-y-4">
              <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6">
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-4">Đơn hàng của bạn</div>
                <div className="space-y-4 mb-5">
                  {items.map(item => {
                    const bg = catColor[item.book.category] || '#2b2520'
                    return (
                      <div key={item.book.id} className="flex gap-3 items-center">
                        <div className="w-10 h-14 rounded-sm overflow-hidden shrink-0" style={{ backgroundColor: bg }}>
                          <img src={item.book.cover} alt="" className="w-full h-full object-cover"
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
                      <button type="button" onClick={() => { setCouponApplied(null); setCoupon('') }} className="text-[10px] text-emerald-400/60 hover:text-red-400 transition-colors">✕ Bỏ</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input value={coupon} onChange={e => { setCoupon(e.target.value); setCouponError('') }}
                          onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                          placeholder="Nhập mã ưu đãi..."
                          className="flex-1 bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-3 py-2 text-xs rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] font-mono uppercase" />
                        <button type="button" onClick={applyCoupon} className="px-4 py-2 bg-[#c8a94d]/20 border border-[#c8a94d]/40 text-[#c8a94d] text-xs font-semibold rounded-sm hover:bg-[#c8a94d]/30 transition-colors whitespace-nowrap">
                          Áp dụng
                        </button>
                      </div>
                      {couponError && <p className="text-[10px] text-red-400 mt-1.5">{couponError}</p>}
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

              <button type="submit" disabled={submitting}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-sm font-semibold text-sm transition-all ${submitting ? 'bg-[#2b2520] text-[#7a6f64] cursor-not-allowed' : 'btn-gold text-[#0b0907]'}`}>
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-[#7a6f64] border-t-transparent rounded-full animate-spin" />Đang xử lý...</>
                ) : (
                  <>Đặt hàng<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></>
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

export function ConfirmPage({
  orderNum,
  items,
  onHome,
  onOrders,
  actualTotal,
}: {
  orderNum: string
  items: CartItem[]
  onHome: () => void
  onOrders: () => void
  actualTotal?: number
}) {
  const total = actualTotal ?? items.reduce((s, i) => s + i.book.price * i.qty, 0)
  const now = new Date()
  const eta = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const etaStr = `${eta.getDate()} thg ${eta.getMonth() + 1}, ${eta.getFullYear()}`

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      {/* Step */}
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <StepIndicator current={3} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-16 px-6">
        <div className="max-w-2xl w-full text-center">
          {/* Success icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-emerald-900/30 border border-emerald-700/40 animate-[float_3s_ease-in-out_infinite]" />
            <div className="absolute inset-3 rounded-full bg-emerald-800/30 flex items-center justify-center">
              <svg width="32" height="32" fill="none" stroke="#34d399" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-8 h-px bg-[#c8a94d]/50" />
            <span className="text-[10px] tracking-[0.3em] text-[#c8a94d] uppercase font-mono">Đặt hàng thành công</span>
            <div className="w-8 h-px bg-[#c8a94d]/50" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-semibold mb-3">Cảm ơn bạn!</h1>
          <p className="text-[#b5a99b] text-base mb-8">Đơn hàng của bạn đã được tiếp nhận và đang chờ xác nhận.</p>

          {/* Order card */}
          <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6 mb-8 text-left">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#22201d]">
              <div>
                <div className="text-[10px] text-[#7a6f64] uppercase tracking-wider font-mono mb-1">Mã đơn hàng</div>
                <div className="font-mono text-[#c8a94d] font-semibold text-lg">{orderNum}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#7a6f64] uppercase tracking-wider font-mono mb-1">Dự kiến giao</div>
                <div className="text-sm text-[#ede7dc]">{etaStr}</div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-5">
              {items.map(item => (
                <div key={item.book.id} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c8a94d]/50 shrink-0" />
                  <span className="flex-1 text-sm text-[#b5a99b] truncate">{item.book.title}</span>
                  <span className="text-xs text-[#7a6f64] font-mono shrink-0">× {item.qty}</span>
                  <span className="text-xs text-[#c8a94d] font-mono shrink-0 w-24 text-right">{fmt(item.book.price * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#22201d] pt-4 flex justify-between font-semibold">
              <span className="text-[#ede7dc]">Tổng cộng</span>
              <span className="font-display text-xl text-[#c8a94d]">{fmt(total)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6 mb-8 text-left">
            <div className="text-[10px] text-[#c8a94d] uppercase tracking-wider font-mono mb-5">Hành trình đơn hàng</div>
            {[
              { label: 'Đã đặt hàng', time: `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} ${now.getDate()} thg ${now.getMonth()+1}`, done: true },
              { label: 'Chờ xác nhận', time: 'Sẽ xác nhận trong 30 phút', done: false },
              { label: 'Đang giao hàng', time: 'Dự kiến 1–2 ngày', done: false },
              { label: 'Giao thành công', time: `Dự kiến ${etaStr}`, done: false },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${step.done ? 'bg-[#c8a94d] border-[#c8a94d]' : 'border-[#2b2520]'}`}>
                    {step.done && <svg width="10" height="10" fill="none" stroke="#0b0907" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>}
                  </div>
                  {i < arr.length - 1 && <div className="w-px flex-1 my-1 bg-[#22201d]" />}
                </div>
                <div className="pb-5">
                  <div className={`text-sm font-medium ${step.done ? 'text-[#ede7dc]' : 'text-[#7a6f64]'}`}>{step.label}</div>
                  <div className="text-xs text-[#7a6f64] mt-0.5 font-mono">{step.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onHome} className="btn-gold text-[#0b0907] font-semibold px-8 py-3 rounded-sm text-sm">
              Về trang chủ
            </button>
            <button onClick={onOrders} className="border border-[#2b2520] text-[#b5a99b] hover:border-[#c8a94d]/40 hover:text-[#ede7dc] px-8 py-3 rounded-sm text-sm transition-colors">
              Xem đơn hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { user, refreshUser, logout } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const avatarInput = useRef<HTMLInputElement>(null)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [address, setAddress] = useState(user?.addressLine ?? '')
  const [editingAddress, setEditingAddress] = useState(false)
  const [passwords, setPasswords] = useState(['', '', ''])
  useEffect(() => {
    void api<UserSession[]>('/api/auth/sessions').then(result => setSessions(result.data)).catch(() => {})
    void api<Order[]>('/api/orders').then(result => setOrders(result.data)).catch(() => {})
  }, [])
  const ORDERS = orders.map(order => ({ id: order.id, customer: order.customerName, date: new Date(order.createdAt).toLocaleString('vi-VN'), status: ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Đã giao', cancelled: 'Đã hủy' })[order.status], total: Number(order.totalAmount), items: `Đơn sách #${order.id}` }))
  type SettingsTab = 'profile' | 'password' | 'address' | 'notifications' | 'security' | 'orders'
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({ name: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', bio: localStorage.getItem(`bookguard-bio-${user?.id}`) ?? '' })
  const [notifs, setNotifs] = useState({ orderUpdate: true, promo: false, newBook: true, newsletter: false })
  const twoFA = false

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (tab === 'password') {
        if (passwords[1] !== passwords[2]) { toast('Mật khẩu xác nhận không khớp', 'error'); return }
        const result = await api<{ csrfToken?: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwords[0], newPassword: passwords[1] }) })
        setCsrfToken(result.data.csrfToken); setPasswords(['', '', ''])
      } else {
        await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ fullName: profile.name, phone: profile.phone, addressLine: address }) })
        localStorage.setItem(`bookguard-bio-${user?.id}`, profile.bio)
        await refreshUser(); setEditingAddress(false)
      }
      setSaved(true); window.setTimeout(() => setSaved(false), 2500)
    } catch (error) { toast(error instanceof Error ? error.message : 'Không thể lưu thay đổi', 'error') }
  }
  async function uploadAvatar(file: File) {
    const body = new FormData(); body.append('avatar', file)
    try { await api('/api/profile/avatar', { method: 'POST', body }); await refreshUser(); toast('Đã cập nhật ảnh đại diện', 'success') }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể tải ảnh lên', 'error') }
  }

  const menu: [SettingsTab, string, string][] = [
    ['profile', 'Hồ sơ', 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
    ['password', 'Mật khẩu', 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'],
    ['address', 'Địa chỉ', 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'],
    ['notifications', 'Thông báo', 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'],
    ['security', 'Bảo mật', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
    ['orders', 'Đơn hàng', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'],
  ]

  return (
    <div className="min-h-screen pt-16">
      <div className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-[#7a6f64] hover:text-[#ede7dc] transition-colors text-sm group">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
            Quay lại
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <SectionLabel>Tài khoản</SectionLabel>
          <h1 className="font-display text-4xl text-[#ede7dc] font-medium">Cài đặt</h1>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          {/* Sidebar */}
          <div className="space-y-1">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 p-4 mb-4 bg-[#131110] border border-[#22201d] rounded-sm">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#c8a94d] to-[#bf6c3e] flex items-center justify-center text-[#0b0907] font-display font-bold text-2xl">{user?.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : profile.name.slice(0, 1)}</div>
              <div className="text-center">
                <div className="text-sm text-[#ede7dc] font-medium">{profile.name}</div>
                <div className="text-xs text-[#7a6f64] font-mono truncate max-w-[150px]">{profile.email}</div>
              </div>
            </div>

            {menu.map(([t, label, icon]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`sidebar-link w-full flex items-center gap-3 px-4 py-3 text-sm rounded-sm transition-colors text-left ${tab === t ? 'active text-[#ede7dc] bg-[#1c1815]' : 'text-[#7a6f64] hover:text-[#ede7dc] hover:bg-[#1c1815]/50'}`}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-[#131110] border border-[#22201d] rounded-sm p-6 md:p-8">

            {tab === 'profile' && (
              <form onSubmit={save}>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Hồ sơ cá nhân</div>
                <div className="space-y-5">
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#22201d]">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#c8a94d] to-[#bf6c3e] flex items-center justify-center text-[#0b0907] font-display font-bold text-3xl shrink-0">{user?.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" className="w-full h-full object-cover" /> : profile.name.slice(0, 1)}</div>
                    <div>
                      <input ref={avatarInput} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file) }} />
                      <button type="button" onClick={() => avatarInput.current?.click()} className="text-xs text-[#c8a94d] border border-[#c8a94d]/40 px-4 py-2 rounded-sm hover:bg-[#c8a94d]/10 transition-colors">Đổi ảnh đại diện</button>
                      <p className="text-[10px] text-[#7a6f64] mt-1.5">PNG, JPG · tối đa 2MB</p>
                    </div>
                  </div>
                  {[['name', 'Họ và tên', 'text'], ['email', 'Email', 'email'], ['phone', 'Số điện thoại', 'tel']].map(([k, l, t]) => (
                    <div key={k}>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                      <input aria-label={l} disabled={k === 'email'} type={t} value={(profile as Record<string, string>)[k]}
                        onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Giới thiệu bản thân</label>
                    <textarea rows={3} value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Viết vài dòng về bản thân..."
                      className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] resize-none" />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button type="submit" className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all ${saved ? 'bg-emerald-700 text-white' : 'btn-gold text-[#0b0907]'}`}>
                      {saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {tab === 'password' && (
              <form onSubmit={save}>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Đổi mật khẩu</div>
                <div className="space-y-5 max-w-md">
                  {[['Mật khẩu hiện tại'], ['Mật khẩu mới'], ['Xác nhận mật khẩu mới']].map(([l], index) => (
                    <div key={l}>
                      <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                      <input aria-label={l} type="password" placeholder="••••••••" required value={passwords[index]} onChange={event => setPasswords(current => current.map((value, i) => index === i ? event.target.value : value))}
                        className="w-full bg-[#1c1815] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64]" />
                    </div>
                  ))}
                  <div className="bg-[#1c1815] rounded-sm p-4 text-xs text-[#7a6f64] space-y-1">
                    {['Ít nhất 10 ký tự', 'Chứa chữ hoa và chữ thường', 'Chứa ít nhất một số'].map(r => (
                      <div key={r} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#7a6f64]" />
                        {r}
                      </div>
                    ))}
                  </div>
                  <button type="submit" className={`px-6 py-2.5 rounded-sm text-sm font-semibold transition-all ${saved ? 'bg-emerald-700 text-white' : 'btn-gold text-[#0b0907]'}`}>
                    {saved ? '✓ Đã cập nhật' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'address' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Địa chỉ giao hàng</div>
                {[{ label: 'Nhà riêng', addr: address || 'Chưa có địa chỉ', default: true }].map(a => (
                  <div key={a.label} className="mb-4 p-5 border border-[#22201d] rounded-sm hover:border-[#2b2520] transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#ede7dc] font-medium">{a.label}</span>
                        {a.default && <span className="badge bg-[#c8a94d]/20 text-[#c8a94d] border border-[#c8a94d]/30">Mặc định</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingAddress(true)} className="text-xs text-[#7a6f64] hover:text-[#c8a94d] transition-colors">Sửa</button>
                        {!a.default && <button className="text-xs text-[#7a6f64] hover:text-red-400 transition-colors">Xóa</button>}
                      </div>
                    </div>
                    <p className="text-sm text-[#b5a99b]">{a.addr}</p>
                  </div>
                ))}
                {editingAddress && <form onSubmit={save} className="space-y-4 mb-4"><textarea aria-label="Địa chỉ giao hàng" className="w-full p-3 bg-[#1c1815] border border-[#2b2520] rounded-sm" value={address} onChange={event => setAddress(event.target.value)} /><button className="btn-gold text-[#0b0907] px-5 py-3">Lưu địa chỉ</button></form>}
                <button onClick={() => setEditingAddress(true)} className="flex items-center gap-2 text-sm text-[#c8a94d] border border-[#c8a94d]/30 px-4 py-2.5 rounded-sm hover:bg-[#c8a94d]/10 transition-colors mt-2">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  Thêm địa chỉ mới
                </button>
              </div>
            )}

            {tab === 'notifications' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Tùy chọn thông báo</div>
                <div className="space-y-0">
                  {[
                    { key: 'orderUpdate', label: 'Cập nhật đơn hàng', sub: 'Khi đơn hàng thay đổi trạng thái' },
                    { key: 'promo', label: 'Khuyến mãi & ưu đãi', sub: 'Mã giảm giá và chương trình đặc biệt' },
                    { key: 'newBook', label: 'Sách mới nhập kho', sub: 'Thông báo khi thêm đầu sách mới' },
                    { key: 'newsletter', label: 'Bản tin hàng tuần', sub: 'Email tổng hợp sách hay mỗi thứ Hai' },
                  ].map(n => (
                    <div key={n.key} className="flex items-center justify-between py-5 border-b border-[#22201d] last:border-b-0">
                      <div>
                        <div className="text-sm text-[#ede7dc] font-medium">{n.label}</div>
                        <div className="text-xs text-[#7a6f64] mt-0.5">{n.sub}</div>
                      </div>
                      <button
                        onClick={() => { setNotifs(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof notifs] })); toast('Tùy chọn xem trước; đăng ký email chưa được hỗ trợ.', 'info') }}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${notifs[n.key as keyof typeof notifs] ? 'bg-[#c8a94d]' : 'bg-[#2b2520]'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifs[n.key as keyof typeof notifs] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Bảo mật tài khoản</div>
                <div className="space-y-6">
                  {/* 2FA */}
                  <div className="p-5 border border-[#22201d] rounded-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm text-[#ede7dc] font-medium mb-1">Xác thực 2 bước (2FA)</div>
                        <div className="text-xs text-[#7a6f64]">Bảo vệ tài khoản bằng mã OTP từ ứng dụng xác thực</div>
                      </div>
                      <button onClick={() => toast('Xác thực hai bước chưa được hỗ trợ.', 'info')}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${twoFA ? 'bg-[#c8a94d]' : 'bg-[#2b2520]'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${twoFA ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {twoFA && (
                      <div className="mt-3 bg-[#1c1815] rounded-sm p-3 text-xs text-[#7a6f64]">
                        Quét mã QR bằng Google Authenticator hoặc Authy để kích hoạt.
                      </div>
                    )}
                  </div>

                  {/* Active sessions */}
                  <div>
                    <div className="text-xs text-[#7a6f64] uppercase tracking-wider font-mono mb-4">Phiên đang hoạt động</div>
                    {sessions.filter(session => session.isActive).map(session => ({ id: session.id, device: session.userAgent?.includes('Windows') ? 'Trình duyệt · Windows' : 'Trình duyệt', location: session.ipAddress ?? '', time: new Date(session.lastSeenAt).toLocaleString('vi-VN'), current: session.isCurrent })).map(s => (
                      <div key={s.device} className="flex items-center justify-between py-4 border-b border-[#22201d] last:border-b-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${s.current ? 'bg-emerald-400' : 'bg-[#2b2520]'}`} />
                          <div>
                            <div className="text-sm text-[#ede7dc]">{s.device}</div>
                            <div className="text-xs text-[#7a6f64] font-mono">{s.location} · {s.time}</div>
                          </div>
                        </div>
                        {!s.current && (
                          <button onClick={() => { void api(`/api/auth/sessions/${s.id}`, { method: 'DELETE' }).then(() => setSessions(current => current.filter(session => session.id !== s.id))).catch(error => toast(error.message, 'error')) }} className="text-xs text-red-400/70 hover:text-red-400 border border-red-900/40 hover:border-red-700/60 px-3 py-1.5 rounded-sm transition-colors">
                            Đăng xuất
                          </button>
                        )}
                        {s.current && <span className="badge bg-emerald-900/30 text-emerald-400 border border-emerald-800/40">Thiết bị này</span>}
                      </div>
                    ))}
                    <button onClick={() => { void Promise.all(sessions.filter(session => session.isActive && !session.isCurrent).map(session => api(`/api/auth/sessions/${session.id}`, { method: 'DELETE' }))).then(() => setSessions(current => current.filter(session => session.isCurrent))).catch(error => toast(error.message, 'error')) }} className="mt-4 text-xs text-red-400/70 hover:text-red-400 transition-colors">Đăng xuất tất cả thiết bị khác</button>
                    <button onClick={() => { void logout().then(() => navigate('/login')) }} className="block mt-4 text-xs text-[#c8a94d]">Đăng xuất tài khoản</button>
                  </div>

                  {/* Danger zone */}
                  <div className="border border-red-900/30 rounded-sm p-5">
                    <div className="text-xs text-red-400 uppercase tracking-wider font-mono mb-3">Vùng nguy hiểm</div>
                    <p className="text-sm text-[#7a6f64] mb-4">Xóa tài khoản sẽ xóa vĩnh viễn tất cả dữ liệu, đơn hàng và lịch sử của bạn.</p>
                    <button onClick={() => toast('Vui lòng liên hệ quản trị viên để yêu cầu xóa tài khoản.', 'info')} className="text-xs text-red-400/70 hover:text-red-400 border border-red-900/40 hover:border-red-700/60 px-4 py-2 rounded-sm transition-colors">
                      Xóa tài khoản
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'orders' && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-6">Lịch sử đơn hàng</div>
                <div className="space-y-0">
                  {ORDERS.map(o => (
                    <div key={o.id} role="button" tabIndex={0} onClick={() => navigate('/orders', { state: { selectedOrderId: o.id } })} onKeyDown={event => { if (event.key === 'Enter') navigate('/orders', { state: { selectedOrderId: o.id } }) }} className="reference-order-row py-5 flex items-center gap-5 cursor-pointer border-b border-[#22201d] last:border-b-0 hover:bg-[#16223b] px-3 rounded transition-colors">
                      <div className="w-10 h-10 rounded-sm bg-[#1c1815] border border-[#22201d] flex items-center justify-center text-[#c8a94d] font-mono text-xs font-bold shrink-0">
                        #{o.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#ede7dc] font-medium truncate">{o.items}</div>
                        <div className="text-xs text-[#7a6f64] font-mono mt-0.5">{o.date}</div>
                      </div>
                      <span className={`badge ${statusColor(o.status)} shrink-0`}>{o.status}</span>
                      <div className="text-sm font-mono text-[#c8a94d] shrink-0 w-28 text-right">{fmt(o.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

export const ToastCtx = createContext<(msg: string, type?: Toast['type']) => void>(() => {})

export function useToast() { return useContext(ToastCtx) }

export function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl text-sm font-medium pointer-events-auto transition-all animate-[fade-up_0.3s_ease-out]
            ${t.type === 'success' ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' : t.type === 'error' ? 'bg-red-900/90 text-red-200 border border-red-700' : 'bg-[#1c1815] text-[#ede7dc] border border-[#2b2520]'}`}>
          {t.type === 'success' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>}
          {t.type === 'error' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>}
          {t.type === 'info' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>}
          {t.msg}
          <button onClick={() => remove(t.id)} className="ml-2 opacity-60 hover:opacity-100">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export function LoginPage({ onLogin, onRegister, onForgot }: { onLogin: (user?: User) => void; onRegister: () => void; onForgot: () => void }) {
  const { login } = useSession()
  const light = useTheme() === 'light'
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast('Vui lòng nhập đầy đủ thông tin', 'error'); return }
    setLoading(true)
    try { const loggedUser = await login(email, password); toast('Đăng nhập thành công!', 'success'); onLogin(loggedUser) }
    catch (error) { toast(error instanceof Error ? error.message : 'Đăng nhập thất bại', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-sm bg-[#c8a94d] flex items-center justify-center mx-auto mb-5">
            <span className="font-display font-bold text-[#0b0907] text-2xl">T</span>
          </div>
          <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Đăng nhập</h1>
          <p className="text-sm text-[#7a6f64]">Chào mừng trở lại với Thư An</p>
        </div>

        <div className={`rounded-sm border p-8 ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Email</label>
              <input aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com" autoComplete="email"
                className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
            </div>
            <div>
              <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Mật khẩu</label>
              <div className="relative">
                <input aria-label="Mật khẩu" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  className={`w-full px-4 py-3 pr-11 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6f64] hover:text-[#c8a94d] transition-colors">
                  {showPwd ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <button type="button" onClick={onForgot} className="text-xs text-[#c8a94d] hover:underline">Quên mật khẩu?</button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang đăng nhập…</> : 'Đăng nhập'}
            </button>

            <div className="relative flex items-center gap-3">
              <div className={`flex-1 h-px ${light ? 'bg-[#d5cfc4]' : 'bg-[#22201d]'}`} />
              <span className="text-xs text-[#7a6f64]">hoặc</span>
              <div className={`flex-1 h-px ${light ? 'bg-[#d5cfc4]' : 'bg-[#22201d]'}`} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setEmail('customer.a@bookguard.local'); setPassword('Customer@123') }}
                className={`w-full border py-2.5 rounded-sm text-xs font-medium transition-colors cursor-pointer ${light ? 'border-[#d5cfc4] text-[#5a4f44] hover:bg-[#f0e9de]' : 'border-[#2b2520] text-[#b5a99b] hover:bg-[#1c1815]'}`}>
                Khách demo
              </button>
              <button type="button" onClick={() => { setEmail('admin@bookguard.local'); setPassword('Admin@12345') }}
                className="w-full border border-[#c8a94d]/40 py-2.5 rounded-sm text-xs font-medium text-[#c8a94d] hover:bg-[#c8a94d]/10 transition-colors cursor-pointer">
                Admin demo
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-[#7a6f64] mt-6">
          Chưa có tài khoản?{' '}
          <button onClick={onRegister} className="text-[#c8a94d] hover:underline">Đăng ký ngay</button>
        </p>
      </div>
    </div>
  )
}

export function RegisterPage({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const { register } = useSession()
  const light = useTheme() === 'light'
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast('Vui lòng điền đầy đủ', 'error'); return }
    if (form.password !== form.confirm) { toast('Mật khẩu xác nhận không khớp', 'error'); return }
    if (form.password.length < 8) { toast('Mật khẩu tối thiểu 8 ký tự', 'error'); return }
    setLoading(true)
    try { await register(form.name, form.email, form.password); setDone(true) }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể tạo tài khoản', 'error') }
    finally { setLoading(false) }
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" fill="none" stroke="#4ade80" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h2 className={`font-display text-2xl font-medium mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Kiểm tra hộp thư</h2>
        <p className="text-sm text-[#7a6f64] mb-2">Chúng tôi đã gửi email xác minh đến</p>
        <p className={`text-sm font-medium font-mono mb-6 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{form.email}</p>
        <p className="text-xs text-[#7a6f64] mb-8">Mở email và nhấp vào liên kết xác minh để kích hoạt tài khoản.</p>
        <button onClick={onLogin} className="btn-gold text-[#0b0907] font-semibold px-8 py-3 rounded-sm text-sm">Đến trang đăng nhập</button>
        <p className="text-xs text-[#7a6f64] mt-4">Không nhận được email? <button onClick={() => void api('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: form.email }) }).then(() => toast('Đã yêu cầu gửi lại email xác minh', 'success')).catch(error => toast(error.message, 'error'))} className="text-[#c8a94d] hover:underline">Gửi lại</button></p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-sm bg-[#c8a94d] flex items-center justify-center mx-auto mb-5">
            <span className="font-display font-bold text-[#0b0907] text-2xl">T</span>
          </div>
          <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Tạo tài khoản</h1>
          <p className="text-sm text-[#7a6f64]">Tham gia cộng đồng độc giả Thư An</p>
        </div>

        <div className={`rounded-sm border p-8 ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
          <form onSubmit={submit} className="space-y-4">
            {[['name', 'Họ và tên', 'text', 'Nguyễn Minh An'], ['email', 'Email', 'email', 'ban@example.com'], ['password', 'Mật khẩu', 'password', '••••••••'], ['confirm', 'Xác nhận mật khẩu', 'password', '••••••••']].map(([k, l, t, ph]) => (
              <div key={k}>
                <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">{l}</label>
                <input aria-label={l} type={t} placeholder={ph} value={(form as Record<string, string>)[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
              {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang tạo…</> : 'Tạo tài khoản'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#7a6f64] mt-6">
          Đã có tài khoản?{' '}
          <button onClick={onBack} className="text-[#c8a94d] hover:underline">Đăng nhập</button>
        </p>
      </div>
    </div>
  )
}

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const light = useTheme() === 'light'
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { toast('Vui lòng nhập email', 'error'); return }
    setLoading(true)
    try { await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setSent(true) }
    catch (error) { toast(error instanceof Error ? error.message : 'Không thể gửi email', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#7a6f64] hover:text-[#c8a94d] transition-colors mb-8">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
          Quay lại đăng nhập
        </button>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#c8a94d]/20 border border-[#c8a94d]/40 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" fill="none" stroke="#c8a94d" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h2 className={`font-display text-2xl font-medium mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Đã gửi email</h2>
            <p className="text-sm text-[#7a6f64] mb-2">Kiểm tra hộp thư tại</p>
            <p className={`text-sm font-mono font-medium mb-6 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{email}</p>
            <p className="text-xs text-[#7a6f64]">Link đặt lại mật khẩu có hiệu lực trong 30 phút.</p>
          </div>
        ) : (
          <>
            <h1 className={`font-display text-3xl font-medium mb-2 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Quên mật khẩu</h1>
            <p className="text-sm text-[#7a6f64] mb-8">Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#7a6f64] font-mono uppercase tracking-wider mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com"
                  className={`w-full px-4 py-3 text-sm rounded-sm border focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-[#f8f4ef] border-[#d5cfc4] text-[#1a1410]' : 'bg-[#1c1815] border-[#2b2520] text-[#ede7dc]'}`} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-gold text-[#0b0907] font-semibold py-3 rounded-sm text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <><svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Đang gửi…</> : 'Gửi link đặt lại'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export function WishlistPage({ wishlist, onRemove, onAdd, onSelect, onCatalog }: {
  wishlist: typeof BOOKS; onRemove: (id: number) => void
  onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void; onCatalog: () => void
}) {
  const light = useTheme() === 'light'
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlist.map(book => (
              <div key={book.id} className={`group rounded-sm border overflow-hidden ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#22201d]'}`}>
                <div className="relative cursor-pointer img-zoom" onClick={() => onSelect(book)}>
                  {imgErrors[book.id] ? (
                    <FallbackCover title={book.title} author={book.author} bg="#5a4032" />
                  ) : (
                    <img src={book.cover} alt={book.title} className="w-full h-52 object-cover"
                      onError={() => setImgErrors(e => ({ ...e, [book.id]: true }))} />
                  )}
                  <button onClick={e => { e.stopPropagation(); onRemove(book.id) }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-900/80 text-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-800">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="currentColor" stroke="none"/></svg>
                  </button>
                </div>
                <div className="p-4">
                  <div className="text-[10px] text-[#c8a94d] font-mono uppercase tracking-wider mb-1">{book.category}</div>
                  <button onClick={() => onSelect(book)} className={`text-sm font-medium text-left line-clamp-2 mb-1 hover:text-[#c8a94d] transition-colors ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>{book.title}</button>
                  <div className="text-xs text-[#7a6f64] mb-3">{book.author}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-[#c8a94d]">{fmt(book.price)}</span>
                    <button onClick={() => onAdd(book)} className="text-xs bg-[#c8a94d] text-[#0b0907] px-3 py-1.5 rounded-sm font-semibold hover:bg-[#e8c87a] transition-colors">
                      + Giỏ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  const light = useTheme() === 'light'
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="text-center">
        <div className={`font-display text-[8rem] md:text-[12rem] font-bold leading-none mb-4 select-none ${light ? 'text-[#e0d8cc]' : 'text-[#1c1815]'}`}>404</div>
        <h1 className={`font-display text-2xl md:text-3xl font-medium mb-3 ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Trang không tồn tại</h1>
        <p className="text-sm text-[#7a6f64] mb-10 max-w-sm mx-auto">Trang bạn đang tìm kiếm đã bị xóa, đổi tên hoặc chưa bao giờ tồn tại.</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={onHome} className="btn-gold text-[#0b0907] font-semibold px-8 py-3 rounded-sm text-sm">Về trang chủ</button>
          <button onClick={() => window.history.back()} className={`border px-8 py-3 rounded-sm text-sm transition-colors ${light ? 'border-[#d5cfc4] text-[#5a4f44] hover:bg-[#f0e9de]' : 'border-[#2b2520] text-[#b5a99b] hover:bg-[#1c1815]'}`}>Quay lại</button>
        </div>
      </div>
    </div>
  )
}

export function HomePage({ onCatalog, onAdd, onSelect }: { onCatalog: () => void; onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  return (
    <>
      <HeroSlider onExplore={onCatalog} />
      <Ticker />
      <FeaturedSection onAdd={onAdd} onSelect={onSelect} />
      <CategoriesSection onCatalog={onCatalog} />
      <BestsellerSection onAdd={onAdd} onSelect={onSelect} />
      <EditorialSection />
      <StatsSection />
      <NewsletterSection />
    </>
  )
}
