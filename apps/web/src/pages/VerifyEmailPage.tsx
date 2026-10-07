import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "idle"
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api<{ message: string }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    })
      .then((result) => {
        if (!active) return;
        setMessage(result.data.message);
        setStatus("success");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setMessage(cause instanceof ApiError ? cause.message : "Không thể xác minh email.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const result = await api<{ message: string }>("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setMessage(result.data.message);
      setStatus("success");
    } catch (cause) {
      setMessage(cause instanceof ApiError ? cause.message : "Không thể gửi email xác minh.");
      setStatus("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container auth-wrap py-5">
      <div className="verification-card">
        <div className="verification-icon" aria-hidden="true">
          {status === "success" ? "✓" : status === "error" ? "!" : "✉"}
        </div>
        <div className="eyebrow">Bảo vệ tài khoản</div>
        <h1>{status === "loading" ? "Đang xác minh email…" : "Xác minh email"}</h1>

        {status === "loading" && <div className="verification-loader" aria-label="Đang xử lý" />}
        {message && (
          <div className={`alert ${status === "error" ? "alert-danger" : "alert-success"}`}>
            {message}
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <form onSubmit={(event) => void resend(event)}>
            <p className="text-secondary">
              Nhập email tài khoản để nhận một liên kết xác minh mới.
            </p>
            <label className="form-label" htmlFor="verification-email">Email</label>
            <input
              id="verification-email"
              className="form-control mb-3"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button className="btn btn-accent w-100" type="submit" disabled={sending}>
              {sending ? "Đang gửi…" : "Gửi lại email xác minh"}
            </button>
          </form>
        )}

        {status === "success" && (
          <Link className="btn btn-ink w-100" to="/login">Đi đến đăng nhập</Link>
        )}
        <p className="auth-switch mb-0">
          <Link to="/">Quay lại nhà sách</Link>
        </p>
      </div>
    </div>
  );
}
