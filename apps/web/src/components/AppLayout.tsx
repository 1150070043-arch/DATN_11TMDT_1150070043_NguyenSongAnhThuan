import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { ApiError, assetUrl } from "../lib/api";
import { ModeStrip } from "./ModeStrip";
import { BrandMark } from "./BrandMark";

function NavIcon({ name }: { name: "home" | "heart" | "bag" | "order" }) {
  const paths = {
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10" /><path d="M9.5 20v-6h5v6" /></>,
    heart: <path d="M20.5 5.8a5.2 5.2 0 0 0-7.4 0L12 6.9l-1.1-1.1a5.2 5.2 0 0 0-7.4 7.4L12 21l8.5-7.8a5.2 5.2 0 0 0 0-7.4Z" />,
    bag: <><path d="M5 8h14l-1.2 12H6.2L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    order: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("bookguard-theme");
    return saved === "light" ? "light" : "dark";
  });
  const { user, logout } = useAuth();
  const { cart, loadCart, clearLocal } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bookguard-theme", theme);
  }, [theme]);

  useEffect(() => {
    const update = () => setHeaderSolid(window.scrollY > 60);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      clearLocal();
      navigate("/");
      notify({ tone: "info", title: "Đã đăng xuất an toàn" });
    } catch (cause) {
      notify({
        tone: "error",
        title: "Không thể kết thúc phiên trên máy chủ",
        message: cause instanceof ApiError ? cause.message : "Phiên trên thiết bị này đã được xóa."
      });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="site-shell grain">
      <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>
      <ModeStrip />
      <header className={`site-header ${headerSolid || location.pathname !== "/" ? "is-solid" : ""}`}>
        <nav className="container navbar navbar-expand-lg site-navbar" aria-label="Điều hướng chính">
          <Link className="navbar-brand brand-mark" to="/" onClick={() => setMenuOpen(false)}>
            <BrandMark />
            <span className="brand-copy">
              <strong>Thất Tịnh</strong>
              <small>Nhà sách trực tuyến</small>
            </span>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            aria-expanded={menuOpen}
            aria-label="Mở menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
            <div className="navbar-nav nav-primary ms-lg-5 gap-lg-1">
              <NavLink className="nav-link" to="/" end onClick={() => setMenuOpen(false)}>Trang chủ</NavLink>
              <NavLink className="nav-link" to="/catalog" onClick={() => setMenuOpen(false)}>Sách</NavLink>
              <NavLink className="nav-link" to={user?.role === "admin" ? "/admin" : "/login"} onClick={() => setMenuOpen(false)}>Quản trị</NavLink>
              <NavLink className="nav-link" to={user ? "/profile" : "/login"} onClick={() => setMenuOpen(false)}>Tài khoản</NavLink>
            </div>
            <div className="nav-actions ms-auto d-flex flex-column flex-lg-row align-items-lg-center gap-2 mt-3 mt-lg-0">
              <div className="nav-utilities d-flex align-items-center gap-1">
                <Link className="nav-icon-button" to="/catalog" aria-label="Tìm kiếm sách" title="Tìm kiếm sách">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                </Link>
                <button
                  className="nav-icon-button"
                  type="button"
                  aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
                  title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
                  onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.4A8 8 0 0 1 8.6 3.5 8.5 8.5 0 1 0 20.5 15.4Z" /></svg>
                  )}
                </button>
                <NavLink className="nav-icon-button" to={user ? "/wishlist" : "/login"} aria-label="Sách yêu thích" title="Sách yêu thích">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.8a5.2 5.2 0 0 0-7.4 0L12 6.9l-1.1-1.1a5.2 5.2 0 0 0-7.4 7.4L12 21l8.5-7.8a5.2 5.2 0 0 0 0-7.4Z" /></svg>
                </NavLink>
              </div>
              {user ? (
                <>
                  <Link className="account-link" to="/profile" onClick={() => setMenuOpen(false)}>
                    <span className="account-avatar">
                      {user.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="" /> : user.fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{user.fullName}</span>
                  </Link>
                  <Link className="btn cart-button position-relative" to="/cart" onClick={() => setMenuOpen(false)}>
                    <svg className="cart-button-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 8h14l-1.2 11H6.2L5 8Z" />
                      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
                    </svg>
                    Giỏ hàng
                    {(cart?.items.length ?? 0) > 0 && (
                      <span className="cart-count">{cart!.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    )}
                  </Link>
                  <button className="btn btn-link text-secondary" type="button" disabled={loggingOut} onClick={() => void handleLogout()}>
                    {loggingOut ? "Đang thoát…" : "Đăng xuất"}
                  </button>
                </>
              ) : (
                <>
                  <Link className="nav-icon-button anonymous-cart" to="/login" aria-label="Giỏ hàng" title="Giỏ hàng"><NavIcon name="bag" /></Link>
                  <Link className="btn btn-accent" to="/login">Đăng nhập</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="site-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>

      {user && (
        <nav className="mobile-dock" aria-label="Điều hướng nhanh trên di động">
          <NavLink to="/" end><NavIcon name="home" /><span>Sách</span></NavLink>
          <NavLink to="/wishlist"><NavIcon name="heart" /><span>Yêu thích</span></NavLink>
          <NavLink className="mobile-dock-cart" to="/cart">
            <NavIcon name="bag" />
            <span>Giỏ</span>
            {(cart?.items.length ?? 0) > 0 && <b>{cart!.items.reduce((sum, item) => sum + item.quantity, 0)}</b>}
          </NavLink>
          <NavLink to="/orders"><NavIcon name="order" /><span>Đơn hàng</span></NavLink>
        </nav>
      )}

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link className="brand-mark brand-mark--footer" to="/">
              <BrandMark />
              <span className="brand-copy"><strong>Thất Tịnh</strong><small>Nhà sách trực tuyến</small></span>
            </Link>
            <p>Những cuốn sách được chọn kỹ cho một đời sống nhiều chiều sâu.</p>
          </div>
          <div className="footer-links">
            <span className="footer-label">Khám phá</span>
            <Link to="/catalog">Danh mục sách</Link>
            {user && <Link to="/wishlist">Sách yêu thích</Link>}
            {user && <Link to="/orders">Đơn hàng của tôi</Link>}
            {user ? <Link to="/profile">Tài khoản</Link> : <Link to="/login" aria-label="Tài khoản khách">Đăng nhập</Link>}
          </div>
          <div className="footer-project">
            <span className="footer-label">BookGuard DATN</span>
            <p>Đồ án nghiên cứu bảo mật nhiều lớp cho ứng dụng web bán sách.</p>
            <a href="https://openlibrary.org/" target="_blank" rel="noreferrer">
              Ảnh bìa được cung cấp bởi Open Library
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Thất Tịnh Bookstore</span>
          <span>Được xây dựng cho trải nghiệm mua sách an toàn.</span>
        </div>
      </footer>
    </div>
  );
}
