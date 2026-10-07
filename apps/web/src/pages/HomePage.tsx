import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError, assetUrl } from "../lib/api";
import { currency } from "../lib/format";
import type { Book, Category } from "../types";

const slides = [
  {
    eyebrow: "Nhà sách trực tuyến", titleA: "Thư", titleB: "An",
    sub: "Những cuốn sách được chọn kỹ cho một đời sống nhiều chiều sâu.",
    cta1: "Khám phá sách", cta2: "Xem danh mục",
    image: "photo-1507842217343-583bb7270b66", accent: "#c8a94d",
    overlay: "from-[#0b0907] via-[#0b0907]/60 to-[#0b0907]/10"
  },
  {
    eyebrow: "Biên tập viên chọn", titleA: "Sách hay", titleB: "tháng 9",
    sub: "Những tựa sách đang làm thay đổi cách bạn đọc, nghĩ và sống.",
    cta1: "Xem danh sách", cta2: "Tất cả sách",
    image: "photo-1544716278-ca5e3f4abd8c", accent: "#bf6c3e",
    overlay: "from-[#0b0907] via-[#0a0805]/70 to-transparent"
  },
  {
    eyebrow: "Một thế giới trong từng trang", titleA: "Đọc sâu", titleB: "sống rộng",
    sub: "Văn học, Công nghệ, Kỹ năng, Kinh doanh, Lịch sử — tất cả trong một nhà sách.",
    cta1: "Xem danh mục", cta2: "Về chúng tôi",
    image: "photo-1481627834876-b7833e8f5570", accent: "#7a6a9e",
    overlay: "from-[#09080f] via-[#09080f]/65 to-transparent"
  }
];

const categoryImages = [
  ["photo-1481627834876-b7833e8f5570", "#8b5e3c"],
  ["photo-1518770660439-4636190af475", "#2d6a8f"],
  ["photo-1507679799987-c73779587ccf", "#3d5a80"],
  ["photo-1434030216411-0b793f4b4173", "#5a4032"],
  ["photo-1461360370896-922624d12aa1", "#3b3035"],
  ["photo-1512436991641-6745cdb1723f", "#4a3b28"]
];

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 mb-3"><div className="w-6 h-px bg-[#c8a94d]" /><span className="text-[10px] tracking-[0.3em] text-[#c8a94d] uppercase font-medium font-mono">{children}</span></div>;
}

function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const currentRef = useRef(current);
  currentRef.current = current;
  const go = useCallback((index: number) => setCurrent((index + slides.length) % slides.length), []);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => go(currentRef.current + 1), 5500);
    return () => window.clearInterval(timer);
  }, [go, paused]);
  const slide = slides[current];
  return (
    <section className="relative h-screen min-h-[640px] overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((item, index) => <div key={item.titleA} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: index === current ? 1 : 0, zIndex: index === current ? 1 : 0 }}>
        <div className="absolute inset-0 scale-[1.04]" style={{ transition: "transform 6s ease-out", transform: index === current ? "scale(1)" : "scale(1.04)" }}>
          <img src={`https://images.unsplash.com/${item.image}?w=1920&h=1080&fit=crop&auto=format&q=75`} alt="" className="w-full h-full object-cover opacity-30" />
        </div>
        <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0907]/75 via-transparent to-transparent" />
      </div>)}
      <div className="absolute top-24 right-8 z-10 hidden md:flex flex-col items-end gap-2">
        <span className="font-mono text-xs text-[#7a6f64]"><span style={{ color: slide.accent }}>{String(current + 1).padStart(2, "0")}</span><span className="mx-1 text-[#2b2520]">/</span>03</span>
        <div className="w-px h-12 relative overflow-hidden bg-[#2b2520]"><div className="absolute top-0 left-0 w-full transition-all duration-700" style={{ height: `${((current + 1) / slides.length) * 100}%`, backgroundColor: slide.accent }} /></div>
      </div>
      <div className="relative z-10 h-full flex flex-col justify-end pb-24 md:pb-28 max-w-7xl mx-auto px-6 w-full">
        <div className="flex items-center gap-3 mb-6"><div className="w-8 h-px" style={{ backgroundColor: slide.accent }} /><span className="text-[10px] tracking-[0.35em] uppercase font-mono" style={{ color: slide.accent }}>{slide.eyebrow}</span></div>
        <h1 key={`title-${current}`} className="font-display font-semibold leading-[0.85] tracking-tight text-[#ede7dc] mb-8" style={{ fontSize: "clamp(3.5rem,11vw,10rem)", animation: "fade-up .7s ease both" }}>
          <span className="block">{slide.titleA}</span><span className="block italic" style={{ color: slide.accent === "#c8a94d" ? "#ede7dc" : slide.accent, opacity: .9 }}>{slide.titleB}</span>
        </h1>
        <div key={`sub-${current}`} className="flex flex-col md:flex-row md:items-end gap-6 md:gap-14" style={{ animation: "fade-up .7s .12s ease both" }}>
          <p className="text-base text-[#b5a99b] max-w-sm leading-relaxed font-light">{slide.sub}</p>
          <div className="flex items-center gap-3 shrink-0"><Link to="/catalog" className="btn-gold text-[#0b0907] text-sm font-semibold px-6 py-3 rounded-sm no-underline">{slide.cta1}</Link><Link to="/catalog" className="text-sm text-[#b5a99b] border border-[#2b2520] px-6 py-3 rounded-sm hover:border-[#c8a94d]/40 hover:text-[#ede7dc] transition-colors no-underline">{slide.cta2}</Link></div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="h-px bg-[#22201d]"><div className="h-full transition-all ease-linear" style={{ backgroundColor: slide.accent, width: paused ? `${((current + 1) / slides.length) * 100}%` : "100%", transition: paused ? "none" : "width 5.5s linear" }} /></div>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">{slides.map((item, index) => <button key={item.titleA} onClick={() => go(index)} className="group flex items-center gap-2 border-0 bg-transparent p-0"><span className={`rounded-full transition-all ${index === current ? "w-6 h-1.5" : "w-1.5 h-1.5 bg-[#2b2520]"}`} style={index === current ? { backgroundColor: slide.accent } : undefined} /></button>)}</div>
          <div className="hidden lg:flex items-center gap-4">{slides.map((item, index) => <button key={item.titleA} onClick={() => go(index)} className={`text-xs font-mono bg-transparent pb-1 border-0 border-b ${index === current ? "text-[#ede7dc] border-current" : "text-[#7a6f64] border-transparent"}`}>{item.titleA}</button>)}</div>
          <div className="flex gap-2"><button onClick={() => go(current - 1)} aria-label="Ảnh trước" className="w-9 h-9 rounded-full border border-[#2b2520] bg-transparent flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc]"><span>‹</span></button><button onClick={() => go(current + 1)} aria-label="Ảnh sau" className="w-9 h-9 rounded-full border border-[#2b2520] bg-transparent flex items-center justify-center text-[#7a6f64] hover:text-[#ede7dc]"><span>›</span></button></div>
        </div>
      </div>
    </section>
  );
}

function Ticker({ categories }: { categories: Category[] }) {
  const source = categories.length ? categories : [{ id: 1, name: "Văn học", slug: "van-hoc" }, { id: 2, name: "Công nghệ", slug: "cong-nghe" }, { id: 3, name: "Kinh doanh", slug: "kinh-doanh" }, { id: 4, name: "Kỹ năng", slug: "ky-nang" }];
  const items = [...source, ...source, ...source, ...source];
  return <div className="border-y border-[#22201d] py-4 overflow-hidden bg-[#0f0d0b]"><div className="flex animate-marquee whitespace-nowrap select-none w-max">{items.map((item, index) => <span key={`${item.id}-${index}`} className="flex items-center gap-6 px-8"><span className="text-[10px] tracking-[0.25em] text-[#7a6f64] uppercase">{item.name}</span><span className="text-[#c8a94d]/40">◆</span></span>)}</div></div>;
}

export function FinalBookCard({ book }: { book: Book }) {
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  const { addItem } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  async function add(event: React.MouseEvent) {
    event.preventDefault(); event.stopPropagation();
    if (!user) { navigate("/login"); return; }
    setAdding(true);
    try { await addItem(book.id); notify({ tone: "success", title: "Đã thêm vào giỏ", message: `Sách: ${book.title}` }); }
    catch (cause) { notify({ tone: "error", title: "Chưa thể thêm sách", message: cause instanceof ApiError ? cause.message : "Vui lòng thử lại." }); }
    finally { setAdding(false); }
  }
  return <Link to={`/books/${book.slug}`} className="final-book-card group relative block bg-[#131110] rounded-sm overflow-hidden border border-[#22201d] hover:border-[#c8a94d]/30 no-underline h-full">
    <div className="final-img-zoom aspect-[3/4] overflow-hidden relative bg-[#2b2520]">
      {!error && book.coverUrl ? <img src={assetUrl(book.coverUrl)} alt={book.title} className="w-full h-full object-cover" onError={() => setError(true)} /> : <div className="w-full h-full flex flex-col justify-between p-5 bg-[#68472f] text-white"><div className="w-7 h-px bg-white/50" /><div><strong className="font-display italic text-xl block">{book.title}</strong><span className="text-[9px] tracking-widest uppercase text-white/60">{book.author}</span></div></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0907]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <button onClick={add} disabled={adding || book.stock < 1} className="absolute bottom-4 left-1/2 -translate-x-1/2 btn-gold text-[#0b0907] text-xs font-semibold px-5 py-2.5 rounded-sm whitespace-nowrap opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all border-0">{adding ? "Đang thêm…" : "Thêm vào giỏ"}</button>
    </div>
    <div className="p-4"><div className="text-[10px] tracking-[0.2em] text-[#7a6f64] uppercase mb-1 font-mono">{book.categoryName}</div><h3 className="font-display text-[#ede7dc] text-[.95rem] leading-snug mb-1 line-clamp-2">{book.title}</h3><div className="text-[#7a6f64] text-xs mb-3">{book.author}</div><div className="text-[#c8a94d] font-semibold text-sm">{currency.format(Number(book.price))}</div></div>
  </Link>;
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <div className="final-reveal" style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<Book[]>("/api/books?page=1&limit=12&sort=newest", { signal: controller.signal }),
      api<Category[]>("/api/books/categories", { signal: controller.signal })
    ]).then(([bookResult, categoryResult]) => { setBooks(bookResult.data); setCategories(categoryResult.data); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } }), { threshold: .08, rootMargin: "0px 0px -40px 0px" });
    const timer = window.setTimeout(() => document.querySelectorAll(".final-reveal").forEach(item => observer.observe(item)), 50);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [books, categories]);
  const featured = books.slice(0, 4);
  return <div className="home-final bg-[#0b0907] text-[#ede7dc] min-h-screen">
    <HeroSlider />
    <Ticker categories={categories} />
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <Reveal><div className="mb-12"><SectionLabel>Nổi bật tháng này</SectionLabel><div className="flex items-end justify-between"><h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Những lựa chọn<br /><em>của biên tập viên</em></h2><span className="hidden md:block text-[#7a6f64] text-sm">Được chọn từ hơn 36 đầu sách</span></div></div></Reveal>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">{featured.map((book, index) => <Reveal key={book.id} delay={index * 100}><FinalBookCard book={book} /></Reveal>)}</div>
    </section>
    <section className="py-24 bg-[#0f0d0b] border-y border-[#22201d]"><div className="max-w-7xl mx-auto px-6"><Reveal><div className="mb-12"><SectionLabel>Danh mục</SectionLabel><h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Khám phá theo<br /><em>chủ đề yêu thích</em></h2></div></Reveal><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{categories.slice(0, 6).map((category, index) => <Reveal key={category.id} delay={index * 100}><Link to="/catalog" className="group relative block w-full aspect-[4/3] overflow-hidden rounded-sm border border-[#22201d] hover:border-[#c8a94d]/30" style={{ backgroundColor: categoryImages[index]?.[1] }}><img src={`https://images.unsplash.com/${categoryImages[index]?.[0]}?w=600&h=450&fit=crop&auto=format&q=70`} alt={category.name} className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-all duration-700 scale-105 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" /><div className="absolute bottom-0 p-5"><div className="font-display text-xl text-white font-medium">{category.name}</div><div className="text-white/50 text-xs mt-1 font-mono">Khám phá đầu sách</div></div></Link></Reveal>)}</div></div></section>
    <section className="py-24"><div className="max-w-7xl mx-auto px-6"><Reveal><div className="mb-10"><SectionLabel>Bán chạy</SectionLabel><h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium">Được yêu thích<br /><em>nhất tuần qua</em></h2></div></Reveal></div><div className="final-scroll-row flex gap-5 overflow-x-auto px-6 pb-4 md:pl-[max(1.5rem,calc(50vw-40rem))]">{[...books].reverse().map(book => <div key={book.id} className="flex-none w-[220px]"><FinalBookCard book={book} /></div>)}</div></section>
    <section className="py-32 bg-[#0f0d0b] border-y border-[#22201d]"><div className="max-w-5xl mx-auto px-6 text-center"><Reveal><div className="w-px h-16 bg-gradient-to-b from-transparent via-[#c8a94d]/50 to-transparent mx-auto mb-12" /><blockquote className="font-display text-3xl md:text-5xl lg:text-6xl text-[#ede7dc] font-light italic leading-tight mb-10">“Một cuốn sách hay là một người bạn<br className="hidden md:block" /> không bao giờ phản bội.”</blockquote><div className="flex items-center justify-center gap-3"><div className="w-8 h-px bg-[#c8a94d]/50" /><span className="text-xs tracking-[.25em] text-[#7a6f64] uppercase font-mono">Thư An · Biên soạn 2026</span><div className="w-8 h-px bg-[#c8a94d]/50" /></div></Reveal></div></section>
    <section className="py-20 border-b border-[#22201d]"><div className="max-w-7xl mx-auto px-6"><Reveal><div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#22201d]">{[[`${books.length || 36}+`,"Đầu sách"],[String(categories.length || 6),"Thể loại"],["160+","Đơn hàng"],["3","Tài khoản"]].map(([value,label]) => <div key={label} className="px-8 py-8 text-center"><div className="font-display text-4xl md:text-5xl text-[#c8a94d] font-semibold mb-2">{value}</div><div className="text-xs tracking-[.2em] text-[#7a6f64] uppercase font-mono">{label}</div></div>)}</div></Reveal></div></section>
    <Newsletter />
  </div>;
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return <section className="py-28"><div className="max-w-7xl mx-auto px-6"><Reveal><div className="max-w-2xl"><SectionLabel>Bản tin</SectionLabel><h2 className="font-display text-4xl md:text-5xl text-[#ede7dc] font-medium mb-4">Nhận gợi ý sách<br /><em>hàng tuần từ chúng tôi</em></h2><p className="text-[#7a6f64] text-base mb-8 leading-relaxed">Mỗi thứ Hai, chúng tôi gửi một cuốn sách đáng đọc — kèm đoạn trích ngắn và lý do tại sao nó quan trọng với bạn.</p>{sent ? <div className="text-[#c8a94d] text-sm">✓ Đã đăng ký thành công!</div> : <form onSubmit={event => { event.preventDefault(); if (email) setSent(true); }} className="flex gap-3 flex-col sm:flex-row max-w-md"><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="email@example.com" className="flex-1 bg-[#131110] border border-[#2b2520] text-[#ede7dc] px-4 py-3 text-sm rounded-sm focus:outline-none focus:border-[#c8a94d]/60 placeholder-[#7a6f64] font-mono" /><button className="btn-gold text-[#0b0907] text-sm font-semibold px-6 py-3 rounded-sm border-0" type="submit">Đăng ký</button></form>}</div></Reveal></div></section>;
}
