import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError, assetUrl } from "../lib/api";
import { currency, dateTime } from "../lib/format";
import type { Book } from "../types";

export function BookDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { notify } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [adding, setAdding] = useState(false);
  const baseline = import.meta.env.VITE_SECURITY_MODE === "baseline";

  async function loadBook() {
    if (!slug) return;
    setLoading(true);
    try {
      const result = await api<Book>(`/api/books/${encodeURIComponent(slug)}`);
      setBook(result.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải thông tin sách.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBook();
  }, [slug]);

  async function addToCart() {
    if (!book) return;
    if (!user) {
      navigate("/login", { state: { from: `/books/${book.slug}` } });
      return;
    }
    setAdding(true);
    try {
      await addItem(book.id, quantity);
      notify({ tone: "success", title: "Đã thêm vào giỏ", message: `${book.title} × ${quantity}` });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể thêm sách vào giỏ.";
      setError(message);
      notify({ tone: "error", title: "Chưa thể thêm sách", message });
    } finally {
      setAdding(false);
    }
  }

  async function toggleWishlist() {
    if (!book) return;
    if (!user) {
      navigate("/login", { state: { from: `/books/${book.slug}` } });
      return;
    }
    setSavingWishlist(true);
    setError("");
    const next = !book.isWishlisted;
    try {
      await api(`/api/profile/wishlist/${book.id}`, { method: next ? "PUT" : "DELETE" });
      setBook((current) => current ? { ...current, isWishlisted: next } : current);
      notify({ tone: "success", title: next ? "Đã lưu vào yêu thích" : "Đã bỏ khỏi yêu thích", message: book.title });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật danh sách yêu thích.");
      notify({ tone: "error", title: "Chưa thể cập nhật yêu thích" });
    } finally {
      setSavingWishlist(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!book) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/api/books/${book.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, content })
      });
      setContent("");
      setRating(5);
      await loadBook();
      notify({ tone: "success", title: "Đã đăng đánh giá", message: "Cảm nhận của bạn đã xuất hiện trên trang sách." });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể gửi đánh giá.";
      setError(message);
      notify({ tone: "error", title: "Đánh giá chưa được đăng", message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-loading">Đang mở sách…</div>;
  if (!book) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">{error || "Không tìm thấy sách."}</div>
      </div>
    );
  }

  return (
    <div className="container py-5 detail-page">
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Sách</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{book.title}</li>
        </ol>
      </nav>

      <div className="row g-5">
        <div className="col-md-5 col-lg-4">
          <div className="detail-cover">
            <span className="detail-edition">Thư An select</span>
            <div className="book-cover-fallback">{book.title.slice(0, 1)}</div>
            {book.coverUrl && (
              <img
                src={assetUrl(book.coverUrl)}
                alt={`Bìa sách ${book.title}`}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </div>
        </div>
        <div className="col-md-7 col-lg-8">
          <div className="eyebrow">{book.categoryName}</div>
          <h1 className="detail-title">{book.title}</h1>
          <p className="detail-author">Tác giả <strong>{book.author}</strong></p>
          <p className="detail-description">{book.description}</p>
          <div className="detail-metadata">
            <span>Thể loại <strong>{book.categoryName}</strong></span>
            {book.isbn && <span>ISBN <strong>{book.isbn}</strong></span>}
          </div>
          <div className="purchase-panel">
            <div>
              <div className="detail-price">{currency.format(Number(book.price))}</div>
              <div className={book.stock > 0 ? "text-success" : "text-danger"}>
                {book.stock > 0 ? `Sẵn hàng · ${book.stock} cuốn` : "Tạm hết hàng"}
              </div>
            </div>
            <div className="purchase-actions">
              <label className="detail-quantity">
                <span>Số lượng</span>
                <select
                  className="form-select"
                  value={quantity}
                  disabled={book.stock < 1 || adding}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                >
                  {Array.from({ length: Math.min(book.stock, 10) }, (_, index) => index + 1).map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-accent btn-lg"
                type="button"
                disabled={book.stock < 1 || adding}
                onClick={() => void addToCart()}
              >
                {adding ? "Đang thêm…" : "Thêm vào giỏ"}
              </button>
              <button
                className={`btn btn-lg wishlist-detail-button ${book.isWishlisted ? "is-active" : ""}`}
                type="button"
                disabled={savingWishlist}
                onClick={() => void toggleWishlist()}
                aria-pressed={Boolean(book.isWishlisted)}
              >
                <span aria-hidden="true">{book.isWishlisted ? "♥" : "♡"}</span>
                {book.isWishlisted ? "Đã yêu thích" : "Lưu yêu thích"}
              </button>
            </div>
          </div>
          <div className="detail-services" aria-label="Thông tin mua hàng">
            <span><strong>COD</strong>Thanh toán khi nhận</span>
            <span><strong>01</strong>Quản lý đơn trong tài khoản</span>
            <span><strong>✓</strong>Đóng gói bảo vệ bìa sách</span>
          </div>
        </div>
      </div>

      <section className="reviews-section">
        <div className="row g-5">
          <div className="col-lg-7">
            <div className="eyebrow">Bạn đọc nhận xét</div>
            <h2 className="section-title">Đánh giá về cuốn sách</h2>
            {(book.reviews?.length ?? 0) === 0 ? (
              <p className="text-secondary">Chưa có đánh giá. Hãy là người đầu tiên chia sẻ cảm nhận.</p>
            ) : (
              <div className="review-list">
                {book.reviews!.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="d-flex justify-content-between gap-3">
                      <strong>{review.userName}</strong>
                      <span className="review-stars" aria-label={`${review.rating} trên 5 sao`}>
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </span>
                    </div>
                    {baseline ? (
                      <div
                        className="review-content"
                        // SECURITY LAB: intentional rendering flaw for TC02.
                        dangerouslySetInnerHTML={{ __html: review.content }}
                      />
                    ) : (
                      <p className="review-content">{review.content}</p>
                    )}
                    <small className="text-secondary">{dateTime.format(new Date(review.createdAt))}</small>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="col-lg-5">
            <div className="review-form-card">
              <h3>Viết đánh giá</h3>
              {user ? (
                <form onSubmit={(event) => void submitReview(event)}>
                  <fieldset className="rating-fieldset">
                    <legend className="form-label">Số sao</legend>
                    <div className="star-rating" role="radiogroup" aria-label="Chọn số sao">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          className={value <= rating ? "is-active" : ""}
                          type="button"
                          role="radio"
                          aria-checked={rating === value}
                          aria-label={`${value} sao`}
                          key={value}
                          onClick={() => setRating(value)}
                        >★</button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="form-label" htmlFor="review">Cảm nhận của bạn</label>
                  <textarea
                    id="review"
                    className="form-control mb-3"
                    rows={5}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    minLength={2}
                    maxLength={2000}
                    required
                  />
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <button className="btn btn-ink" type="submit" disabled={submitting}>
                    {submitting ? "Đang gửi…" : "Gửi đánh giá"}
                  </button>
                </form>
              ) : (
                <p className="mb-0">
                  <Link to="/login" state={{ from: `/books/${book.slug}` }}>Đăng nhập</Link>{" "}
                  để viết đánh giá.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
