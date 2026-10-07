import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError, assetUrl, setCsrfToken } from "../lib/api";
import { dateTime } from "../lib/format";
import type { UserSession } from "../types";

function deviceLabel(userAgent?: string | null): string {
  if (!userAgent) return "Thiết bị không xác định";
  const browser = userAgent.includes("Edg/")
    ? "Microsoft Edge"
    : userAgent.includes("Chrome/")
      ? "Google Chrome"
      : userAgent.includes("Firefox/")
        ? "Mozilla Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Trình duyệt khác";
  const platform = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Android")
      ? "Android"
      : userAgent.includes("iPhone") || userAgent.includes("iPad")
        ? "iOS"
        : userAgent.includes("Mac OS")
          ? "macOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "thiết bị không xác định";
  return `${browser} · ${platform}`;
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { notify } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [addressLine, setAddressLine] = useState(user?.addressLine ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const result = await api<UserSession[]>("/api/auth/sessions");
      setSessions(result.data);
    } catch (cause) {
      setSecurityError(cause instanceof ApiError ? cause.message : "Không thể tải lịch sử đăng nhập.");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setPhone(user?.phone ?? "");
    setAddressLine(user?.addressLine ?? "");
  }, [user]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName, phone, addressLine })
      });
      await refreshUser();
      setMessage("Đã cập nhật thông tin.");
      notify({ tone: "success", title: "Đã lưu hồ sơ" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setMessage("");
    setError("");
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      await api("/api/profile/avatar", { method: "POST", body: formData });
      await refreshUser();
      setMessage("Đã cập nhật ảnh đại diện.");
      notify({ tone: "success", title: "Đã đổi ảnh đại diện" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải ảnh lên.");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setSecurityMessage("");
    setSecurityError("");
    if (newPassword !== confirmPassword) {
      setSecurityError("Mật khẩu nhập lại chưa khớp.");
      return;
    }
    setChangingPassword(true);
    try {
      const result = await api<{ message: string; csrfToken?: string | null }>(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword })
        }
      );
      setCsrfToken(result.data.csrfToken);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityMessage(result.data.message);
      await loadSessions();
      notify({ tone: "success", title: "Đã đổi mật khẩu", message: "Các phiên cũ đã được đăng xuất." });
    } catch (cause) {
      setSecurityError(cause instanceof ApiError ? cause.message : "Không thể đổi mật khẩu.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function revokeSession(session: UserSession) {
    setSecurityMessage("");
    setSecurityError("");
    try {
      await api(`/api/auth/sessions/${session.id}`, { method: "DELETE" });
      if (session.isCurrent) {
        window.location.assign("/login");
        return;
      }
      setSessions((current) => current.map((item) => (
        item.id === session.id ? { ...item, isActive: false, revokedAt: new Date().toISOString() } : item
      )));
      setSecurityMessage("Đã đăng xuất phiên được chọn.");
      notify({ tone: "success", title: "Đã thu hồi phiên đăng nhập" });
    } catch (cause) {
      setSecurityError(cause instanceof ApiError ? cause.message : "Không thể thu hồi phiên đăng nhập.");
    }
  }

  async function logoutEverywhere() {
    setLoggingOutAll(true);
    setSecurityError("");
    try {
      await api("/api/auth/logout-all", { method: "POST" });
      window.location.assign("/login");
    } catch (cause) {
      setSecurityError(cause instanceof ApiError ? cause.message : "Không thể đăng xuất các thiết bị.");
      setLogoutAllOpen(false);
      setLoggingOutAll(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Tài khoản</div>
          <h1>Thông tin và bảo mật</h1>
        </div>
      </div>
      <div className="row g-4 align-items-start">
        <div className="col-lg-4">
          <aside className="profile-aside">
            <div className="profile-avatar">
              {user?.avatarUrl ? <img src={assetUrl(user.avatarUrl)} alt="Ảnh đại diện" /> : user?.fullName.slice(0, 1).toUpperCase()}
            </div>
            <strong>{user?.fullName}</strong>
            <span>{user?.email}</span>
            <span className={`verification-badge ${user?.emailVerified ? "verified" : "pending"}`}>
              {user?.emailVerified ? "✓ Email đã xác minh" : "Email chưa xác minh"}
            </span>
            <label className="btn btn-outline-dark mt-3">
              Đổi ảnh đại diện
              <input
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
            </label>
            <small className="text-secondary mt-2">PNG, JPEG hoặc WebP · tối đa 2 MB ở bản Secure.</small>
          </aside>
        </div>
        <div className="col-lg-8 d-grid gap-4">
          <form className="content-card" onSubmit={(event) => void save(event)}>
            <div className="card-heading-row">
              <div><div className="eyebrow">Hồ sơ</div><h2>Thông tin cá nhân</h2></div>
            </div>
            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="profile-email">Email</label>
              <input id="profile-email" className="form-control" value={user?.email ?? ""} disabled />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="profile-name">Họ và tên</label>
              <input id="profile-name" className="form-control" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={160} required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="profile-phone">Số điện thoại</label>
              <input id="profile-phone" className="form-control" type="tel" inputMode="tel" autoComplete="tel" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="profile-address">Địa chỉ mặc định</label>
              <textarea id="profile-address" className="form-control" rows={3} autoComplete="street-address" value={addressLine ?? ""} onChange={(e) => setAddressLine(e.target.value)} maxLength={500} />
            </div>
            <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
          </form>

          <form className="content-card" onSubmit={(event) => void changePassword(event)}>
            <div className="card-heading-row">
              <div><div className="eyebrow">Mật khẩu</div><h2>Đổi mật khẩu</h2></div>
              <span className="security-note">Các phiên cũ sẽ bị đăng xuất</span>
            </div>
            {securityMessage && <div className="alert alert-success">{securityMessage}</div>}
            {securityError && <div className="alert alert-danger">{securityError}</div>}
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="current-password">Mật khẩu hiện tại</label>
                <input id="current-password" className="form-control" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="new-password">Mật khẩu mới</label>
                <input id="new-password" className="form-control" type="password" autoComplete="new-password" minLength={import.meta.env.VITE_SECURITY_MODE === "baseline" ? 1 : 10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="confirm-password">Nhập lại mật khẩu</label>
                <input id="confirm-password" className="form-control" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </div>
            </div>
            {import.meta.env.VITE_SECURITY_MODE !== "baseline" && <p className="form-text mt-2">Ít nhất 10 ký tự, gồm chữ hoa, chữ thường và chữ số.</p>}
            <button className="btn btn-ink mt-3" type="submit" disabled={changingPassword}>{changingPassword ? "Đang cập nhật…" : "Đổi mật khẩu"}</button>
          </form>

          <section className="content-card" aria-labelledby="sessions-title">
            <div className="card-heading-row">
              <div><div className="eyebrow">Thiết bị</div><h2 id="sessions-title">Lịch sử đăng nhập</h2></div>
              <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setLogoutAllOpen(true)}>Đăng xuất tất cả</button>
            </div>
            {loadingSessions ? (
              <p className="text-secondary mb-0">Đang tải các phiên đăng nhập…</p>
            ) : sessions.length === 0 ? (
              <p className="text-secondary mb-0">Chưa có dữ liệu phiên đăng nhập.</p>
            ) : (
              <div className="session-list">
                {sessions.map((session) => (
                  <article className={`session-item ${session.isCurrent ? "current" : ""}`} key={session.id}>
                    <div className="session-device-icon" aria-hidden="true">▣</div>
                    <div>
                      <div className="session-title">
                        <strong>{deviceLabel(session.userAgent)}</strong>
                        {session.isCurrent && <span>Thiết bị này</span>}
                        {!session.isActive && <span className="inactive">Đã đăng xuất</span>}
                      </div>
                      <p>IP {session.ipAddress ?? "không xác định"} · Hoạt động gần nhất {dateTime.format(new Date(session.lastSeenAt))}</p>
                    </div>
                    {session.isActive && (
                      <button className="btn btn-sm btn-link text-danger" type="button" onClick={() => void revokeSession(session)}>Đăng xuất</button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={logoutAllOpen}
        title="Đăng xuất khỏi mọi thiết bị?"
        description="Tất cả phiên đăng nhập, bao gồm thiết bị hiện tại, sẽ bị thu hồi ngay lập tức."
        confirmLabel="Đăng xuất tất cả"
        destructive
        busy={loggingOutAll}
        onCancel={() => setLogoutAllOpen(false)}
        onConfirm={() => void logoutEverywhere()}
      />
    </div>
  );
}
