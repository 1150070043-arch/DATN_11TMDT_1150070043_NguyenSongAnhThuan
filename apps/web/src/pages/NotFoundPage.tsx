import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="container py-5">
      <div className="empty-state">
        <div className="display-3 fw-bold text-ink">404</div>
        <h1>Trang này không có trong tủ sách</h1>
        <p>Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
        <Link className="btn btn-accent" to="/">Về trang sách</Link>
      </div>
    </div>
  );
}
