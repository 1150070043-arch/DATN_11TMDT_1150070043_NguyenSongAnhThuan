import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Page } from './Reference';
import { BrandMark } from '../components/BrandMark';

export type StorefrontHeaderProps = {
  page: Page; setPage: (page: Page) => void; cart: number; onCartClick: () => void;
  theme: 'dark' | 'light'; onToggleTheme: () => void; wishlistCount: number; onWishlistClick: () => void;
};
function Icon({ children }: { children: ReactNode }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function StorefrontHeader({ page, setPage, cart, onCartClick, theme, onToggleTheme, wishlistCount, onWishlistClick, toast }: StorefrontHeaderProps & { toast: (message: string, type: 'error') => void }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const light = theme === 'light';
  useEffect(() => { setMobileOpen(false); }, [page]);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); menuButton.current?.focus(); }
    };
    const outside = (event: PointerEvent) => {
      if (!menuPanel.current?.contains(event.target as Node) && !menuButton.current?.contains(event.target as Node)) setMobileOpen(false);
    };
    const resized = () => { if (window.innerWidth >= 1280) setMobileOpen(false); };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resized);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resized); };
  }, [mobileOpen]);
  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); setPage('login'); setMobileOpen(false); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Không thể đăng xuất', 'error'); }
    finally { setLoggingOut(false); }
  }
  const primary: [Page, string][] = [['home', 'Trang chủ'], ['catalog', 'Sản phẩm'], ['about', 'Về chúng tôi'], ['contact', 'Liên hệ'], ...(user ? [['orders', 'Đơn hàng'] as [Page, string]] : [])];
  const mobile: [Page, string][] = [...primary, ['settings', 'Tài khoản'], ['wishlist', 'Sách yêu thích'], ...(user?.role === 'admin' ? [['admin', 'Quản trị'] as [Page, string]] : [])];
  const navButton = ([target, label]: [Page, string]) => <button key={target} onClick={() => { setPage(target); setMobileOpen(false); }} aria-current={page === target || (target === 'catalog' && page === 'book') ? 'page' : undefined} className="storefront-link">{label}</button>;
  return <header className="storefront-header fixed top-0 left-0 right-0 z-50">
    <nav className="storefront-nav max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between" aria-label="Điều hướng chính">
      <button onClick={() => setPage('home')} className="storefront-brand" aria-label="Thất Tịnh — Trang chủ">
        <BrandMark />
        <span>Thất Tịnh<span className="storefront-brand-dot">.</span></span>
      </button>
      <div className="storefront-primary hidden xl:flex">{primary.map(navButton)}{user?.role === 'admin' && navButton(['admin', 'Quản trị'])}</div>
      <div className="storefront-actions flex items-center">
        <button onClick={onToggleTheme} aria-label={light ? 'Chuyển sang tối' : 'Chuyển sang sáng'} title={light ? 'Chuyển sang tối' : 'Chuyển sang sáng'} className="storefront-icon">
          {light ? <Icon><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></Icon> : <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></Icon>}
        </button>
        <button aria-label="Sách yêu thích" title="Sách yêu thích" onClick={onWishlistClick} className="storefront-icon hidden xl:flex" aria-current={page === 'wishlist' ? 'page' : undefined}>
          <Icon><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></Icon>
          {wishlistCount > 0 && <span className="storefront-counter">{wishlistCount > 99 ? '99+' : wishlistCount}</span>}
        </button>
        <button aria-label="Giỏ hàng" title="Giỏ hàng" onClick={onCartClick} className="storefront-icon" aria-current={page === 'cart' ? 'page' : undefined}>
          <Icon><path d="M4 7h16l1 14H3L4 7Zm4 0V6a4 4 0 0 1 8 0v1" /></Icon>
          {cart > 0 && <span className="storefront-counter">{cart > 99 ? '99+' : cart}</span>}
        </button>
        {user && <button aria-label="Tài khoản" title="Tài khoản" onClick={() => setPage('settings')} className="storefront-icon hidden xl:flex" aria-current={page === 'settings' ? 'page' : undefined}><Icon><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Icon></button>}
        <button disabled={loggingOut} onClick={() => user ? void signOut() : setPage('login')} className="storefront-session hidden xl:flex">{user ? 'Đăng xuất' : 'Đăng nhập'}</button>
        <button ref={menuButton} aria-label="Menu" aria-expanded={mobileOpen} aria-controls="storefront-mobile-menu" onClick={() => setMobileOpen(open => !open)} className="storefront-icon xl:hidden">
          <Icon>{mobileOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</Icon>
        </button>
      </div>
    </nav>
    {mobileOpen && <div ref={menuPanel} id="storefront-mobile-menu" className="storefront-mobile-menu xl:hidden">
      {mobile.map(navButton)}
      <button disabled={loggingOut} onClick={() => user ? void signOut() : setPage('login')} className="storefront-link storefront-mobile-session">{user ? 'Đăng xuất' : 'Đăng nhập'}</button>
    </div>}
  </header>;
}
