import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthEditorial } from "../components/AuthEditorial";
import { api, ApiError } from "../lib/api";

const mailUiUrl = import.meta.env.VITE_MAIL_UI_URL as string | undefined;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setMessage(result.data.message);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể gửi yêu cầu lúc này.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-wrap py-5">
      <div className="auth-layout">
        <AuthEditorial />
        <div className="auth-card">
          <div className="eyebrow">Khôi phục tài khoản</div>
          <h1>Quên mật khẩu?</h1>
          <p className="text-secondary">Nhập email đã đăng ký. Hệ thống sẽ gửi một liên kết dùng một lần để tạo mật khẩu mới.</p>
          {message ? (
            <div className="recovery-success" role="status">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Yêu cầu đã được ghi nhận</strong>
                <p>{message}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="mb-4">
                <label className="form-label" htmlFor="recovery-email">Email</label>
                <input
                  id="recovery-email"
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <button className="btn btn-accent btn-lg w-100" type="submit" disabled={submitting}>
                {submitting ? "Đang gửi…" : "Gửi liên kết đặt lại"}
              </button>
            </form>
          )}
          {message && mailUiUrl && (
            <a className="btn btn-outline-dark w-100 mt-3" href={mailUiUrl} target="_blank" rel="noreferrer">
              Mở hộp thư hệ thống
            </a>
          )}
          <p className="auth-switch mb-0"><Link to="/login">← Quay lại đăng nhập</Link></p>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const secure = import.meta.env.VITE_SECURITY_MODE !== "baseline";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Hai mật khẩu chưa trùng khớp.");
      return;
    }
    if (secure) {
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
    setSubmitting(true);
    try {
      const result = await api<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setMessage(result.data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.details && cause.details.length > 0) {
        const detailMessages = cause.details.map((d) => d.message).filter(Boolean);
        setError(detailMessages.join(" ") || cause.message);
      } else {
        setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật mật khẩu.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container auth-wrap py-5">
      <div className="auth-layout">
        <AuthEditorial />
        <div className="auth-card">
          <div className="eyebrow">Bảo vệ tài khoản</div>
          <h1>Tạo mật khẩu mới</h1>
          {!token ? (
            <div className="alert alert-danger">Liên kết đặt lại mật khẩu không hợp lệ.</div>
          ) : message ? (
            <div className="recovery-success" role="status">
              <span aria-hidden="true">✓</span>
              <div><strong>Đã cập nhật mật khẩu</strong><p>{message} Bạn có thể đăng nhập ngay.</p></div>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="mb-3">
                <label className="form-label" htmlFor="new-password">Mật khẩu mới</label>
                <input
                  id="new-password"
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={secure ? 10 : 1}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label" htmlFor="confirm-password">Nhập lại mật khẩu</label>
                <input
                  id="confirm-password"
                  className="form-control"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={secure ? 10 : 1}
                  autoComplete="new-password"
                  required
                />
              </div>
              {secure && <p className="form-text mb-4">Ít nhất 10 ký tự, gồm chữ hoa, chữ thường và chữ số.</p>}
              <button className="btn btn-accent btn-lg w-100" type="submit" disabled={submitting}>
                {submitting ? "Đang cập nhật…" : "Lưu mật khẩu mới"}
              </button>
            </form>
          )}
          <p className="auth-switch mb-0"><Link to="/login">Đi đến đăng nhập</Link></p>
        </div>
      </div>
    </div>
  );
}
import "../design/legacy-scoped.css";
import "../design/legacy-overrides.css";
