import { useEffect, useRef, useState } from 'react';

export const SLIDES = [
  { id: 'reading', titleA: 'Tìm cuốn sách', titleB: 'tiếp theo của bạn.', sub: 'Góc đọc nhỏ. Thế giới lớn.', cta: 'Khám phá sách' },
  { id: 'library', titleA: 'Mỗi trang sách,', titleB: 'một góc nhìn mới.', sub: 'Để sự tò mò dẫn lối.', cta: 'Xem sách' },
  { id: 'shelves', titleA: 'Chậm lại một chút.', titleB: 'Đọc thêm một trang.', sub: 'Dành một khoảng riêng cho bạn.', cta: 'Chọn sách' },
];

export function HeroSlider({ onExplore }: { onExplore: () => void }) {
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const start = useRef<{ x: number; y: number } | null>(null);
  const playing = !focused && visible && !reduced;
  const slide = SLIDES[active];
  function move(next: number) { setActive((next + SLIDES.length) % SLIDES.length); }
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive(index => (index + 1) % SLIDES.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing, active]);
  return <section className="storefront-hero" aria-label="Gợi ý đọc sách" aria-roledescription="carousel"
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(active + (event.key === 'ArrowRight' ? 1 : -1)); } }}>
    <div className="hero-panel">
      <div key={slide.id} className="hero-copy" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
        <span className="hero-eyebrow">Nhà sách Thư An</span>
        <h1><span>{slide.titleA}</span>{' '}<span>{slide.titleB}</span></h1>
        <p>{slide.sub}</p>
        <button onClick={() => onExplore()} className="hero-cta">{slide.cta}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></button>
      </div>
      <div className="hero-art" aria-hidden="true" onPointerDown={event => {
        if (event.pointerType !== 'mouse') { start.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }
      }} onPointerCancel={() => { start.current = null; }} onPointerUp={event => {
        if (!start.current) return;
        const dx = event.clientX - start.current.x; const dy = event.clientY - start.current.y; start.current = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) move(active + (dx < 0 ? 1 : -1));
      }}>
        {SLIDES.map((item, index) => <img key={item.id} src={`/design/hero/${item.id}-1440.webp`} srcSet={`/design/hero/${item.id}-640.webp 640w, /design/hero/${item.id}-1440.webp 1440w`} sizes="(min-width: 1024px) 55vw, 100vw" alt="" width="1440" height="1000" className={index === active ? 'is-active' : ''} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'low'} decoding="async" />)}
      </div>
      <div className="hero-controls">
        <div className="hero-dots" aria-label="Chọn slide">{SLIDES.map((item, index) => <button key={item.id} onClick={() => move(index)} aria-label={`Slide ${index + 1}`} aria-current={index === active ? 'true' : undefined}><span /></button>)}</div>
      </div>
    </div>
  </section>;
}
