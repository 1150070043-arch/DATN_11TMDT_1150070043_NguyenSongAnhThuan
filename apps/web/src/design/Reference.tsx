import { StorefrontHeader, type StorefrontHeaderProps } from './StorefrontHeader'
import { HeroSlider } from './StorefrontHero'
import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth as useSession } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Review } from '../types'
import { coverImage } from '../lib/cover-images'
import { RuntimeCtx } from './RuntimeData'
import { BookGallery, ReadingJourney } from './StorefrontExperience'
import { BrandMark } from '../components/BrandMark'

export const ThemeCtx = createContext<'dark' | 'light'>('dark')

export function useTheme() { return useContext(ThemeCtx) }

export type Page = 'home' | 'catalog' | 'about' | 'contact' | 'admin' | 'book' | 'cart' | 'checkout' | 'confirm' | 'settings' | 'login' | 'register' | 'forgot' | 'wishlist' | 'orders' | '404'

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
export const CatalogLoadingCtx = createContext(false)

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

export function Navbar(props: StorefrontHeaderProps) {
  return <StorefrontHeader {...props} toast={useToast()} />
}

export { HeroSlider, SLIDES } from './StorefrontHero'

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
          <div className={`font-display italic text-white/90 font-semibold leading-snug break-words line-clamp-2 ${large ? 'text-2xl' : 'text-sm'}`}>
            {line1}
          </div>
          {line2 && (
            <div className={`font-display text-white/70 font-light leading-snug break-words line-clamp-2 ${large ? 'text-2xl' : 'text-sm'}`}>
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

export function BookCard({ book, onAdd, onSelect, onRemove, priority = false }: { book: typeof BOOKS[0]; onAdd: (b: typeof BOOKS[0]) => void; onSelect?: () => void; onRemove?: () => void | Promise<void>; priority?: boolean }) {
  const { buy } = useContext(RuntimeCtx)
  const { mutating, recovery } = useCart()
  const cartBlocked = mutating || Boolean(recovery)
  const [imgError, setImgError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const removingRef = useRef(false)
  const addingRef = useRef(false)
  const coverRef = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(priority)
  useEffect(() => {
    if (priority || nearViewport) return
    if (!('IntersectionObserver' in window)) { setNearViewport(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearViewport(true); observer.disconnect() }
    }, { rootMargin: '100px' })
    if (coverRef.current) observer.observe(coverRef.current)
    return () => observer.disconnect()
  }, [priority, nearViewport])
  async function add(checkout = false) {
    if (addingRef.current || cartBlocked || book.stock < 1) return
    addingRef.current = true; setAdding(true); setBuying(checkout)
    try { if (checkout) await buy(book); else await onAdd(book) } finally { addingRef.current = false; setAdding(false); setBuying(false) }
  }
  async function remove() {
    if (!onRemove || removingRef.current) return
    removingRef.current = true; setRemoving(true)
    try { await onRemove() } finally { removingRef.current = false; setRemoving(false) }
  }

  const catColor: Record<string, string> = {
    'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035',
    'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28',
  }
  const bg = catColor[book.category] || '#2b2520'

  return (
    <div
      className="book-card group relative bg-[#131110] rounded-sm border border-[#22201d] hover:border-[#c8a94d]/30 cursor-pointer"
      onClick={onSelect}
    >
      {/* Cover */}
      <div ref={coverRef} className="book-cover img-zoom relative aspect-[3/4] overflow-hidden" style={{ backgroundColor: bg }}>
        {!imgError && book.cover ? (
          priority || nearViewport ? <img
            {...coverImage(book.cover, '(max-width: 640px) calc(50vw - 32px), (max-width: 1024px) calc(33vw - 32px), 240px')}
            alt={book.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          /> : <div aria-hidden="true" className="w-full h-full" />
        ) : (
          <FallbackCover title={book.title} author={book.author} bg={bg} />
        )}
      </div>
      <div className="book-info">
        <div className="book-category text-[#7a6f64] uppercase font-mono" title={book.category}>{book.category}</div>
        <h3 className="book-title font-display text-[#ede7dc]"><button type="button" title={book.title} className="text-left" onClick={event => { event.stopPropagation(); onSelect?.() }}><span>{book.title}</span></button></h3>
        <div className="book-author text-[#7a6f64]" title={book.author}>{book.author}</div>
        <div className="book-actions">
          <div className="book-price text-[#c8a94d] font-semibold">{fmt(book.price)}</div>
          <button
            type="button"
            disabled={adding || cartBlocked || book.stock < 1}
            aria-label={`Thêm ${book.title} vào giỏ`}
            onClick={(e) => { e.stopPropagation(); void add() }}
            className="book-add book-secondary font-semibold rounded-sm disabled:opacity-60"
          >
            {book.stock < 1 ? 'Hết hàng' : adding && !buying ? 'Đang thêm…' : 'Thêm vào giỏ'}
          </button>
          <button type="button" disabled={adding || cartBlocked || book.stock < 1} aria-label={`Mua ngay ${book.title}`} onClick={event => { event.stopPropagation(); void add(true) }} className="book-buy btn-gold text-[#0b0907] font-semibold rounded-sm disabled:opacity-60">{buying ? 'Đang xử lý…' : 'Mua ngay'}</button>
          {onRemove && <button type="button" disabled={removing} onClick={event => { event.stopPropagation(); void remove() }} aria-label={`Bỏ ${book.title} khỏi yêu thích`} className="book-remove text-[#7a6f64] border border-[#2b2520] rounded-sm hover:text-[#c8a94d] disabled:opacity-60">{removing ? 'Đang bỏ…' : 'Bỏ yêu thích'}</button>}
        </div>
      </div>
    </div>
  )
}

export function RevealItem({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="reveal min-w-0" style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}

export function FeaturedSection({ onAdd, onSelect }: { onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  const { books: BOOKS } = useContext(DataCtx)
  const loading = useContext(CatalogLoadingCtx)
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="reveal mb-12">
        <SectionLabel>Khám phá</SectionLabel>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl md:text-4xl text-[#ede7dc] font-medium">Sách gợi ý</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {loading && <BookPlaceholders count={4} />}
        {BOOKS.slice(0, 4).map((book, i) => (
          <RevealItem key={book.id} delay={i * 100}>
            <BookCard book={book} onAdd={onAdd} onSelect={() => onSelect(book)} />
          </RevealItem>
        ))}
      </div>
    </section>
  )
}

function BookPlaceholders({ count }: { count: number }) {
  return <>{Array.from({ length: count }, (_, index) => <div key={index} aria-hidden="true" className="book-card border border-[#22201d] bg-[#131110]">
    <div className="book-cover aspect-[3/4] bg-[#1a1613]" />
    <div className="book-info"><div className="book-category bg-[#2b2520] rounded-sm" /><div className="book-title bg-[#2b2520] rounded-sm" /><div className="book-author bg-[#2b2520] rounded-sm" /><div className="book-actions"><div className="book-price bg-[#2b2520] rounded-sm">&nbsp;</div><div className="book-add bg-[#2b2520] rounded-sm" /></div></div>
  </div>)}</>;
}

export function CategoriesSection({ onCatalog }: { onCatalog: (category?: string) => void }) {
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
                  onClick={() => onCatalog(cat.id)}
                  className="group relative w-full aspect-[4/3] overflow-hidden rounded-sm border border-[#22201d] hover:border-[#c8a94d]/30 transition-colors"
                  style={{ backgroundColor: cat.color }}
                >
                  <img
                    src={`https://images.unsplash.com/${cat.img}?w=600&h=450&fit=crop&auto=format&q=70`}
                    alt={cat.name}
                    loading="lazy"
                    decoding="async"
                    width={600}
                    height={450}
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
            <span className="text-xs tracking-[0.25em] text-[#7a6f64] uppercase font-mono">Thất Tịnh · Biên soạn 2026</span>
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
          <div className="storefront-footer-brand flex items-center gap-3 mb-4">
            <BrandMark />
            <div>
              <div className={`storefront-footer-name font-display font-semibold ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Thất Tịnh</div>
              <div className="text-[9px] tracking-[0.2em] text-[#7a6f64] uppercase">Nhà sách trực tuyến</div>
            </div>
          </div>
          <p className="text-[#7a6f64] text-sm leading-relaxed max-w-xs">Những cuốn sách được chọn kỹ cho một đời sống nhiều chiều sâu.</p>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] text-[#c8a94d] uppercase font-mono mb-5">Khám phá</div>
          <ul className="space-y-3">
            {[['catalog', 'Danh mục sách'], ['about', 'Về chúng tôi'], ['contact', 'Liên hệ'], ['wishlist', 'Sách yêu thích'], ['orders', 'Đơn hàng của tôi'], ['settings', 'Tài khoản']].map(([p, l]) => (
              <li key={l}><button onClick={() => setPage(p as Page)} className={`storefront-footer-link transition-colors ${light ? 'text-[#6b5e50] hover:text-[#1a1410]' : 'text-[#7a6f64] hover:text-[#ede7dc]'}`}>{l}</button></li>
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
        <span>© 2026 Thất Tịnh Bookstore</span>
        <span>Được xây dựng cho trải nghiệm mua sách an toàn</span>
      </div>
    </footer>
  )
}

export function CatalogPage({ onAdd, onSelect }: { onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  const { books: BOOKS, categories: CATEGORIES } = useContext(DataCtx)
  const loading = useContext(CatalogLoadingCtx)
  const light = useTheme() === 'light'
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const activeCategory = params.get('category') ?? 'all'
  const setActiveCategory = (value: string) => setParams(current => {
    const next = new URLSearchParams(current)
    if (value === 'all') next.delete('category'); else next.set('category', value)
    return next
  })
  const [serverIds, setServerIds] = useState<number[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [sort, setSort] = useState('default')
  const categoriesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = categoriesRef.current
    const selected = row?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (!row || !selected) return
    const revealSelected = () => {
      const left = selected.offsetLeft - 4, right = selected.offsetLeft + selected.offsetWidth + 4
      if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left)
      else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth
    }
    revealSelected()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(revealSelected)
    observer?.observe(row); observer?.observe(selected)
    return () => observer?.disconnect()
  }, [activeCategory, CATEGORIES])

  useEffect(() => {
    const q = search.trim()
    const abort = new AbortController()
    setSearchError('')
    setServerIds(null)
    if (!q) {
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      async function searchBooks() {
        const path = `/api/books?q=${encodeURIComponent(q)}&limit=40`
        const first = await api<{ id: number }[]>(path, { signal: abort.signal })
        const pages = Math.ceil(Number(first.meta?.total ?? first.data.length) / 40)
        const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => api<{ id: number }[]>(`${path}&page=${index + 2}`, { signal: abort.signal })))
        if (!abort.signal.aborted) setServerIds([...first.data, ...rest.flatMap(result => result.data)].map(item => item.id))
      }
      void searchBooks()
        .catch(cause => { if (!abort.signal.aborted) setSearchError(cause instanceof Error ? cause.message : 'Không thể tìm sách') })
        .finally(() => { if (!abort.signal.aborted) setSearching(false) })
    }, 200)
    return () => { clearTimeout(timer); abort.abort() }
  }, [search, attempt])

  const sourceBooks = serverIds !== null ? BOOKS.filter(b => serverIds.includes(b.id)) : BOOKS
  const filtered = sourceBooks.filter(b => {
    const matchCat = activeCategory === 'all' || b.category === CATEGORIES.find(c => c.id === activeCategory)?.name
    return matchCat
  }).sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'title' ? a.title.localeCompare(b.title, 'vi') : 0)

  return (
    <div className="catalog-page min-h-screen pb-12">
      {/* Page header */}
      <div className={`border-b ${light ? 'border-[#d5cfc4] bg-[#ede4d4]' : 'border-[#22201d] bg-[#0f0d0b]'}`}>
        <div className="catalog-heading max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className={`font-display text-2xl md:text-3xl font-medium ${light ? 'text-[#1a1410]' : 'text-[#ede7dc]'}`}>Sách</h1>
          <p role="status" className="catalog-count text-[#7a6f64]">{loading ? 'Đang tải sách…' : searching ? 'Đang tìm sách…' : searchError ? '—' : `${filtered.length} sách`}</p>
        </div>
      </div>

      <div className="catalog-content max-w-7xl mx-auto px-4 sm:px-6">
        {/* Filters */}
        <div className="catalog-toolbar">
          <div className="catalog-search relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6f64]" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm sách…"
              aria-label="Tìm theo tên sách hoặc tác giả"
              className={`w-full pl-10 pr-4 py-2.5 border text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] ${light ? 'bg-white border-[#d5cfc4] text-[#1a1410]' : 'bg-[#131110] border-[#2b2520] text-[#ede7dc]'}`}
            />
          </div>
          <select aria-label="Sắp xếp sách" value={sort} onChange={event => setSort(event.target.value)} className={`catalog-sort border rounded-sm px-3 py-2 text-sm ${light ? 'bg-white border-[#d5cfc4]' : 'bg-[#131110] border-[#2b2520]'}`}>
            <option value="default">Đề xuất</option><option value="price-asc">Giá tăng</option><option value="price-desc">Giá giảm</option><option value="title">Tên A–Z</option>
          </select>
          <div ref={categoriesRef} className="catalog-categories flex gap-2" role="group" aria-label="Thể loại sách">
            <button
              onClick={() => setActiveCategory('all')}
              aria-pressed={activeCategory === 'all'}
              className={`px-4 py-2 text-xs rounded-sm border transition-colors ${activeCategory === 'all' ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907] font-semibold' : light ? 'border-[#c8bfb0] text-[#6b5e50] hover:border-[#c8a94d]/60' : 'border-[#2b2520] text-[#7a6f64] hover:border-[#c8a94d]/40'}`}
            >
              Tất cả
            </button>
            {loading && Array.from({ length: 6 }, (_, index) => <span key={index} aria-hidden="true" className="h-11 w-20 rounded-sm bg-[#1a1613]" />)}
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                aria-pressed={activeCategory === c.id}
                className={`px-4 py-2 text-xs rounded-sm border transition-colors ${activeCategory === c.id ? 'bg-[#c8a94d] border-[#c8a94d] text-[#0b0907] font-semibold' : light ? 'border-[#c8bfb0] text-[#6b5e50] hover:border-[#c8a94d]/60' : 'border-[#2b2520] text-[#7a6f64] hover:border-[#c8a94d]/40'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5" aria-busy="true"><BookPlaceholders count={10} /></div> : searchError ? <div className="text-center py-12"><p role="alert">{searchError}</p><button onClick={() => setAttempt(value => value + 1)} className="btn-gold px-5 py-3 mt-4 text-[#0b0907]">Thử lại</button></div> : searching ? <div className="text-center py-12" role="status">Đang tìm sách…</div> : filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
            {filtered.map((book, i) => (
              <RevealItem key={book.id} delay={Math.min(i, 5) * 100}>
                <BookCard book={book} onAdd={onAdd} onSelect={() => onSelect(book)} priority={i < 2} />
              </RevealItem>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-[#7a6f64]">
            <div className="font-display text-2xl mb-2">Không tìm thấy</div>
            <div className="text-sm">Thử tìm với từ khóa khác</div>
            <button className="btn-gold px-5 py-3 mt-4 text-[#0b0907]" onClick={() => { setSearch(''); setActiveCategory('all') }}>Xóa bộ lọc</button>
          </div>
        )}
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
  const { mutating, recovery } = useCart()
  const cartBlocked = mutating || Boolean(recovery)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)
  const { buy } = useContext(RuntimeCtx)
  const addingRef = useRef(false)
  const [activeTab, setActiveTab] = useState<'desc' | 'details'>('desc')
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


  const catColor: Record<string, string> = {
    'Công nghệ': '#2d6a8f', 'Kỹ năng': '#5a4032', 'Lịch sử - Xã hội': '#3b3035',
    'Văn học': '#8b5e3c', 'Kinh doanh': '#3d5a80', 'Thiếu nhi': '#4a3b28',
  }
  const bg = catColor[book.category] || '#2b2520'

  const related = BOOKS.filter(b => b.id !== book.id && b.category === book.category).slice(0, 4)
  const others = related.length < 3 ? BOOKS.filter(b => b.id !== book.id).slice(0, 4) : related

  async function handleAdd(checkout = false) {
    if (addingRef.current || cartBlocked || book.stock < 1) return
    addingRef.current = true; setAdding(true); setBuying(checkout)
    try {
      const success = checkout ? await buy(book, qty) : await onAdd(book, qty)
      if (success && !checkout) { setAdded(true); setTimeout(() => setAdded(false), 2000) }
    } finally { addingRef.current = false; setAdding(false); setBuying(false) }
  }

  return (
    <div className="min-h-screen book-detail-page">
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
        <div className="relative max-w-7xl mx-auto px-6 detail-overview">
          <div className="detail-overview-grid">

            {/* Gallery column */}
            <div className="reveal flex flex-col gap-4">
              {/* Main image */}
              <div className="relative detail-gallery">
                <div className="absolute -inset-3 rounded-sm opacity-25 blur-2xl" style={{ backgroundColor: bg }} />
                <BookGallery cover={book.cover} title={book.title} fallback={<FallbackCover title={book.title} author={book.author} bg={bg} large />} />
                {/* Stock badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-sm ${book.stock < 10 ? 'bg-red-900/70 text-red-300 border-red-800/50' : 'bg-emerald-900/70 text-emerald-300 border-emerald-800/50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${book.stock < 10 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    {book.stock < 1 ? 'Hết hàng' : book.stock < 10 ? `Còn ${book.stock} cuốn` : `Còn hàng · ${book.stock} cuốn`}
                  </div>
                </div>
              </div>

            </div>

            {/* Info column */}
            <div className="reveal detail-summary" style={{ transitionDelay: '100ms' }}>
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

              {/* Description */}
              <p className="text-[#b5a99b] text-base leading-relaxed mb-6 max-w-lg">
                {book.description || 'Giới thiệu chi tiết đang được cập nhật. Bạn có thể xem thông tin sách và gửi câu hỏi cho Thất Tịnh.'}
              </p>
              <div className="detail-facts"><div><span>Thể loại</span><strong>{book.category}</strong></div><div><span>Tình trạng</span><strong>{book.stock > 0 ? 'Sẵn sàng đặt sách' : 'Tạm hết hàng'}</strong></div></div>
              <div className="detail-shortcuts"><button type="button" onClick={() => document.getElementById('book-description')?.scrollIntoView({ block: 'start' })}>Đọc giới thiệu <span aria-hidden="true">↘</span></button><button type="button" onClick={() => document.getElementById('book-reviews')?.scrollIntoView({ block: 'start' })}>Xem đánh giá <span aria-hidden="true">↘</span></button></div>

              {/* Price block */}
              <div className="flex items-baseline gap-4 mb-8 detail-price-row">
                <span className="font-display text-4xl text-[#c8a94d] font-semibold">{fmt(book.price)}</span>
              </div>

              {/* Qty + Add to cart */}
              <div className="flex items-center gap-4 mb-6 detail-cart-row">
                {/* Qty stepper */}
                <div className="flex items-center border border-[#2b2520] rounded-sm">
                  <button
                    aria-label="Giảm số lượng"
                    disabled={adding || qty <= 1}
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-10 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
                  </button>
                  <span className="w-10 text-center text-[#ede7dc] font-mono text-sm">{qty}</span>
                  <button
                    aria-label="Tăng số lượng"
                    disabled={adding || qty >= book.stock}
                    onClick={() => setQty(q => Math.min(book.stock, q + 1))}
                    className="w-10 h-11 flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc] transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>

                {/* Add to cart */}
                <button
                  disabled={adding || cartBlocked || book.stock < 1}
                  onClick={() => void handleAdd()}
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
                      {book.stock < 1 ? 'Hết hàng' : adding ? 'Đang thêm…' : 'Thêm vào giỏ hàng'}
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

              <button type="button" disabled={adding || cartBlocked || book.stock < 1} onClick={() => void handleAdd(true)} className="book-buy btn-gold text-[#0b0907] font-semibold rounded-sm disabled:opacity-60 max-w-lg mb-6 detail-buy-now">{buying ? 'Đang xử lý…' : 'Mua ngay'}</button>
              <button type="button" onClick={() => navigate('/contact?topic=books')} className="detail-help">Cần biết thêm về cuốn sách? <span>Hỏi Thất Tịnh ↗</span></button>

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
                aria-current={activeTab === t ? 'location' : undefined}
                onClick={() => { setActiveTab(t); document.getElementById(t === 'desc' ? 'book-description' : 'book-specifications')?.scrollIntoView({ block: 'start' }); }}
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

      <div className="max-w-7xl mx-auto px-6 detail-reading-layout">
          <section id="book-description" className="detail-description reveal" aria-labelledby="book-description-title">
            <span className="story-kicker">Dành một chút thời gian tìm hiểu</span>
            <h2 id="book-description-title">Về cuốn sách này</h2>
            <p className="text-[#b5a99b] leading-relaxed text-base mb-6">{book.description || 'Nội dung giới thiệu đang được cập nhật.'}</p>
            <div className="detail-author-note"><span>Tác giả</span><strong>{book.author}</strong><p>Khám phá cuốn sách theo góc nhìn của tác giả, rồi chia sẻ cảm nhận của chính bạn với những độc giả khác.</p></div>
          </section>
          <section id="book-specifications" className="detail-specifications reveal" aria-labelledby="book-specifications-title">
            <h2 id="book-specifications-title">Thông tin sách</h2>
            <dl className="space-y-0">
              {[
                ['Tên sách', book.title],
                ['Tác giả', book.author],
                ['Thể loại', book.category],
                ['ISBN', book.isbn || 'Đang cập nhật'],
                ['Tồn kho', `${book.stock} cuốn`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-3.5 border-b border-[#22201d] last:border-b-0 text-sm">
                  <dt className="text-[#7a6f64] font-mono text-xs uppercase tracking-wider shrink-0">{k}</dt>
                  <dd className="text-[#ede7dc] text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
      </div>

      {/* Related books */}
      {/* Reviews Section */}
      <section id="book-reviews"><ReviewsSection bookId={book.id} bookTitle={book.title} /></section>

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

export type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

export const ToastCtx = createContext<(msg: string, type?: Toast['type']) => void>(() => {})

export function useToast() { return useContext(ToastCtx) }

export function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl text-sm font-medium pointer-events-auto transition-all animate-[fade-up_0.3s_ease-out]
            ${t.type === 'success' ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' : t.type === 'error' ? 'bg-red-900/90 text-red-200 border border-red-700' : 'bg-[#1c1815] text-[#ede7dc] border border-[#2b2520]'}`}>
          {t.type === 'success' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>}
          {t.type === 'error' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>}
          {t.type === 'info' && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>}
          {t.msg}
          <button aria-label="Đóng thông báo" onClick={() => remove(t.id)} className="ml-2 opacity-60 hover:opacity-100">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
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

export function HomePage({ onCatalog, onAdd, onSelect }: { onCatalog: (category?: string) => void; onAdd: (b: typeof BOOKS[0]) => void; onSelect: (b: typeof BOOKS[0]) => void }) {
  return (
    <>
      <HeroSlider onExplore={onCatalog} />
      <FeaturedSection onAdd={onAdd} onSelect={onSelect} />
      <CategoriesSection onCatalog={onCatalog} />
      <ReadingJourney />
    </>
  )
}
