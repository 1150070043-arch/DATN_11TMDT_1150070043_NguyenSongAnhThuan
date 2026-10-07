import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim();
    if (mode === "register") {
      if (cleanFullName.length < 2) {
        setError("Vui lòng nhập họ và tên (tối thiểu 2 ký tự).");
        return;
      }
      if (!cleanEmail.includes("@")) {
        setError("Vui lòng nhập địa chỉ email hợp lệ.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Hai mật khẩu chưa trùng khớp.");
        return;
      }
      if (import.meta.env.VITE_SECURITY_MODE !== "baseline") {
        if (password.length < 10) {
          setError("Mật khẩu phải có ít nhất 10 ký tự.");
          return;
        }
        if (!/[a-z]/.test(password)) {
          setError("Mật khẩu cần có ít nhất một chữ thường (a-z).");
          return;
        }
        if (!/[A-Z]/.test(password)) {
          setError("Mật khẩu cần có ít nhất một chữ hoa (A-Z).");
          return;
        }
        if (!/[0-9]/.test(password)) {
          setError("Mật khẩu cần có ít nhất một chữ số (0-9).");
          return;
        }
      }
    }
    setSubmitting(true);
    setError("");
    setNeedsVerification(false);
    try {
      let loggedUser = null;
      if (mode === "register") {
        const result = await register(cleanFullName, cleanEmail, password);
        if (result.emailVerificationRequired) {
          setRegisteredEmail(cleanEmail);
          return;
        }
        loggedUser = await login(cleanEmail, password);
      } else {
        loggedUser = await login(cleanEmail, password);
      }
      const state = location.state as { from?: string } | null;
      const returnPath = loggedUser?.role === "admin"
        ? (state?.from?.startsWith("/admin") ? state.from : "/admin")
        : (state?.from && state.from !== "/" && state.from.startsWith("/") && !state.from.startsWith("//") ? state.from : "/");
      notify({ tone: "success", title: mode === "login" ? "Đăng nhập thành công" : "Tài khoản đã sẵn sàng" });
      navigate(returnPath);
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.details && cause.details.length > 0) {
          const detailMessages = cause.details.map((d) => d.message).filter(Boolean);
          setError(detailMessages.join(" ") || cause.message);
        } else {
          setError(cause.message);
        }
      } else {
        setError("Không thể hoàn tất yêu cầu.");
      }
      setNeedsVerification(cause instanceof ApiError && cause.code === "EMAIL_NOT_VERIFIED");
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-24 pb-16 bg-[#0b0907]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center mx-auto mb-6 text-2xl text-emerald-400">✉</div>
          <h1 className="font-serif text-3xl text-[#ede7dc] mb-3">Kiểm tra hộp thư</h1>
          <p className="text-sm text-[#7a6f64] mb-2">Thư An đã gửi email xác minh đến</p>
          <p className="text-sm font-mono text-[#ede7dc] mb-7">{registeredEmail}</p>
          {import.meta.env.VITE_MAIL_UI_URL && (
            <a className="btn-gold block px-8 py-3 text-sm font-semibold mb-3" href={import.meta.env.VITE_MAIL_UI_URL} target="_blank" rel="noreferrer">Mở hộp thư kiểm thử</a>
          )}
          <Link className="text-xs text-[#c8a94d] hover:underline" to="/verify-email">Gửi lại email xác minh</Link>
          <div className="mt-5"><Link className="text-sm text-[#7a6f64] hover:text-[#ede7dc]" to="/login">← Quay lại đăng nhập</Link></div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 text-sm rounded-sm border bg-[#1c1815] border-[#2b2520] text-[#ede7dc] focus:outline-none focus:border-[#c8a94d]/60 placeholder:text-[#5f5850]";
  const labelClass = "block text-[10px] text-[#7a6f64] font-mono uppercase tracking-[.18em] mb-2";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-24 pb-16 bg-[#0b0907]">
      <div className="w-full max-w-md">
        <div className="text-center mb-9">
          <Link to="/" className="w-12 h-12 rounded-sm bg-[#c8a94d] flex items-center justify-center mx-auto mb-5 no-underline">
            <span className="font-serif font-bold text-[#0b0907] text-2xl">T</span>
          </Link>
          <h1 className="font-serif text-3xl text-[#ede7dc] mb-2">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
          <p className="text-sm text-[#7a6f64]">{mode === "login" ? "Chào mừng trở lại với Thư An" : "Tham gia cộng đồng độc giả Thư An"}</p>
        </div>

        <div className="rounded-sm border border-[#22201d] bg-[#131110] p-7 md:p-8">
          {error && <div className="border border-red-900/60 bg-red-950/20 text-red-200 text-sm px-4 py-3 mb-5" role="alert">{error}</div>}
          {needsVerification && <Link className="block text-center border border-[#3b3530] text-[#c8a94d] py-3 mb-4 text-sm" to="/verify-email">Gửi lại email xác minh</Link>}

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className={labelClass} htmlFor="full-name">Họ và tên</label>
                <input id="full-name" className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} autoComplete="name" placeholder="Nguyễn Minh An" />
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="email">Email</label>
              <input id="email" className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="ban@example.com" />
            </div>

            <div>
              <label className={labelClass} htmlFor="password">Mật khẩu</label>
              <div className="relative">
                <input
                  id="password"
                  className={`${inputClass} pr-11`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "register" && import.meta.env.VITE_SECURITY_MODE !== "baseline" ? 10 : 1}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                />
                <button type="button" aria-label={showPassword ? "Ẩn nội dung đã nhập" : "Hiện nội dung đã nhập"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6f64] hover:text-[#c8a94d]">
                  {showPassword ? "◉" : "◎"}
                </button>
              </div>
              {mode === "login" && <div className="flex justify-end mt-2"><Link className="text-xs text-[#c8a94d] hover:underline" to="/forgot-password">Quên mật khẩu?</Link></div>}
              {mode === "register" && import.meta.env.VITE_SECURITY_MODE !== "baseline" && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-[#625c53]">
                  <span className={password.length >= 10 ? "text-emerald-400" : ""}>10+ ký tự</span>
                  <span className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? "text-emerald-400" : ""}>Chữ hoa &amp; thường</span>
                  <span className={/[0-9]/.test(password) ? "text-emerald-400" : ""}>Có chữ số</span>
                </div>
              )}
            </div>

            {mode === "register" && (
              <div>
                <label className={labelClass} htmlFor="confirm-password">Xác nhận mật khẩu</label>
                <input id="confirm-password" className={inputClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" placeholder="••••••••" />
              </div>
            )}

            <button className="btn-gold w-full py-3 text-sm font-semibold mt-2 disabled:opacity-60" type="submit" disabled={submitting}>
              {submitting ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#7a6f64] mt-6 mb-0">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <Link className="text-[#c8a94d] hover:underline" to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}</Link>
        </p>
      </div>
    </div>
  );
}
