import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { coverImage } from '../lib/cover-images';
import { useModalFocus } from '../lib/useModalFocus';

export function Arrow({ back = false }: { back?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={back ? 'M20 12H4m6-6-6 6 6 6' : 'M4 12h16m-6-6 6 6-6 6'} /></svg>;
}

export function StorefrontMotion() {
  const { pathname } = useLocation();
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        if (!media.matches) entry.target.animate([{ opacity: .25, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
        observer.unobserve(entry.target);
      }
    }, { threshold: .08 });
    const scan = () => document.querySelectorAll('#main-content .reveal, #main-content [data-reveal]').forEach(element => {
      if (seen.has(element)) return;
      seen.add(element);
      if (element.getBoundingClientRect().top > window.innerHeight * .9) observer.observe(element);
    });
    scan();
    const mutations = new MutationObserver(scan);
    const main = document.getElementById('main-content');
    if (main) mutations.observe(main, { childList: true, subtree: true });
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const distance = document.documentElement.scrollHeight - innerHeight;
        if (progress.current) progress.current.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
      });
    };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { observer.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [pathname]);
  return <div ref={progress} className="storefront-reading-progress" aria-hidden="true" />;
}

const journey = [
  { title: 'Tìm một cuốn sách', tag: 'Khám phá', description: 'Dạo qua các thể loại, tìm theo tên sách hoặc tác giả. Một chủ đề quen, hay một điều bạn chưa từng nghĩ tới?', action: 'Khám phá danh mục', route: '/catalog', symbol: '01' },
  { title: 'Hiểu trước khi chọn', tag: 'Tìm hiểu', description: 'Đọc giới thiệu, xem thông tin sách và những nhận xét của độc giả. Chọn điều phù hợp với sự tò mò của bạn.', action: 'Tìm cuốn sách của bạn', route: '/catalog', symbol: '02' },
  { title: 'Đặt sách theo cách bạn muốn', tag: 'Đặt sách', description: 'Lưu vào giỏ để chọn thêm, hoặc bấm Mua ngay để tới thanh toán. Kiểm tra thông tin nhận hàng trước khi xác nhận.', action: 'Mở giỏ sách', route: '/cart', symbol: '03' },
  { title: 'Chờ một hành trình mới', tag: 'Theo dõi', description: 'Theo dõi trạng thái trong mục Đơn hàng. Khi cần hỏi thêm về sách hoặc đơn đã đặt, Thư An có một nơi để bạn gửi lời nhắn.', action: 'Theo dõi đơn hàng', route: '/orders', symbol: '04' },
];

export function ReadingJourney() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const step = journey[active];
  return <section className="reading-journey" data-reveal aria-labelledby="journey-title">
    <div className="experience-container">
      <div className="section-heading"><div><span className="story-kicker">Từ chọn sách đến mở trang đầu</span><h2 id="journey-title">Một hành trình <em>thật đơn giản.</em></h2></div><p>Chọn từng bước để xem cách tìm, đặt và theo dõi cuốn sách của bạn.</p></div>
      <div className="journey-layout">
        <div className="journey-steps" role="tablist" aria-label="Hành trình mua sách">{journey.map((item, index) => <button type="button" role="tab" id={`journey-step-${index}`} aria-controls="journey-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} key={item.tag} onClick={() => setActive(index)} onKeyDown={event => {
          if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (active + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 3)) % 4;
          setActive(next); document.getElementById(`journey-step-${next}`)?.focus();
        }}><span>{item.symbol}</span><b>{item.tag}</b><Arrow /></button>)}</div>
        <div id="journey-panel" role="tabpanel" aria-labelledby={`journey-step-${active}`} className="journey-panel"><div key={active} className="flow-enter"><span className="journey-number" aria-hidden="true">{step.symbol}</span><span className="story-kicker">Bước {step.symbol} / 04</span><h3>{step.title}</h3><p>{step.description}</p><button className="story-link" onClick={() => navigate(step.route)}>{step.action}<Arrow /></button></div></div>
      </div>
    </div>
  </section>;
}

export function BookGallery({ cover, title, fallback }: { cover: string; title: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useModalFocus<HTMLDivElement>(open, () => setOpen(false));
  useEffect(() => { setFailed(false); setOpen(false); setZoomed(false); }, [cover]);
  return <>
    <button type="button" className="detail-cover-button" disabled={!cover || failed} aria-label={`Phóng lớn bìa ${title}`} onClick={() => { setZoomed(false); setOpen(true); }}>
      {cover && !failed ? <img {...coverImage(cover, '(max-width: 767px) 260px, 340px')} alt={`Bìa sách ${title}`} fetchPriority="high" decoding="async" onError={() => setFailed(true)} /> : fallback}
      {cover && !failed && <span className="detail-zoom-hint"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M10 7v6m-3-3h6" /></svg>Xem bìa lớn</span>}
    </button>
    {open && createPortal(<div className="book-lightbox" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="cover-dialog-title" tabIndex={-1} className="book-lightbox-dialog">
        <header><h2 id="cover-dialog-title">{title}</h2><div><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? 'Thu nhỏ' : 'Phóng to'}</button><button type="button" aria-label="Đóng ảnh bìa" onClick={() => setOpen(false)}>Đóng <span aria-hidden="true">×</span></button></div></header>
        <div className={`lightbox-image ${zoomed ? 'is-zoomed' : ''}`}><img src={cover} alt={`Bìa sách ${title}`} /></div>
      </div>
    </div>, document.body)}
  </>;
}
