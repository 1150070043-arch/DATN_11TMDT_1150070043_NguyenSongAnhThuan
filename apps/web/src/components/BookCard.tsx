import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, ApiError, assetUrl } from "../lib/api";
import { currency } from "../lib/format";
import type { Book } from "../types";

export function BookCard({
  book,
  onWishlistChange
}: {
  book: Book;
  onWishlistChange?: (isWishlisted: boolean) => void;
}) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addFailed, setAddFailed] = useState(false);
  const [wishlisted, setWishlisted] = useState(Boolean(book.isWishlisted));
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [wishlistFailed, setWishlistFailed] = useState(false);

  async function handleAdd() {
    if (!user) {
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    setAdding(true);
    setAddFailed(false);
    try {
      await addItem(book.id);
      setAdded(true);
      notify({ tone: "success", title: "Đã thêm vào giỏ", message: `Sách: ${book.title}` });
    } catch (cause) {
      setAdded(false);
      setAddFailed(true);
      notify({
        tone: "error",
        title: "Chưa thể thêm sách",
        message: cause instanceof ApiError ? cause.message : "Vui lòng thử lại sau."
      });
    } finally {
      setAdding(false);
    }
  }

  async function toggleWishlist() {
    if (!user) {
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (savingWishlist) return;
    setSavingWishlist(true);
    setWishlistFailed(false);
    const next = !wishlisted;
    try {
      await api(`/api/profile/wishlist/${book.id}`, {
        method: next ? "PUT" : "DELETE"
      });
      setWishlisted(next);
      onWishlistChange?.(next);
      notify({
        tone: "success",
        title: next ? "Đã lưu vào yêu thích" : "Đã bỏ khỏi yêu thích",
        message: book.title
      });
    } catch (cause) {
      setWishlistFailed(true);
      notify({
        tone: "error",
        title: "Chưa thể cập nhật yêu thích",
        message: cause instanceof ApiError ? cause.message : "Vui lòng thử lại sau."
      });
    } finally {
      setSavingWishlist(false);
    }
  }

  return (
    <article className="book-card h-100">
      <button
        className={`wishlist-button ${wishlisted ? "is-active" : ""} ${wishlistFailed ? "has-error" : ""}`}
        type="button"
        disabled={savingWishlist}
        onClick={() => void toggleWishlist()}
        aria-label={wishlisted ? `Bỏ ${book.title} khỏi yêu thích` : `Lưu ${book.title} vào yêu thích`}
        aria-pressed={wishlisted}
        title={wishlistFailed ? "Không thể cập nhật. Bấm để thử lại." : undefined}
      >
        <span aria-hidden="true">{wishlisted ? "♥" : "♡"}</span>
      </button>
      {wishlistFailed && <span className="visually-hidden" role="alert">Không thể cập nhật yêu thích. Vui lòng thử lại.</span>}
      <Link className="book-cover-wrap" to={`/books/${book.slug}`} aria-label={`Xem ${book.title}`}>
        <span className="book-cover-category">{book.categoryName}</span>
        <span className={`book-stock-pill ${book.stock < 1 ? "sold-out" : ""}`}>
          {book.stock > 0 ? "Còn hàng" : "Hết hàng"}
        </span>
        <div className="book-cover-fallback">{book.title.slice(0, 1)}</div>
        {book.coverUrl && (
          <img
            className="book-cover"
            src={assetUrl(book.coverUrl)}
            alt={`Bìa sách ${book.title}`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
      </Link>
      <div className="book-card-body">
        <div className="book-category">Thư An tuyển chọn</div>
        <h2 className="book-title">
          <Link to={`/books/${book.slug}`}>{book.title}</Link>
        </h2>
        <p className="book-author">{book.author}</p>
        <div className="book-card-footer mt-auto">
          <div>
            <div className="book-price">{currency.format(Number(book.price))}</div>
            <small>{book.stock > 0 ? `${book.stock} cuốn sẵn sàng` : "Tạm hết hàng"}</small>
          </div>
          <button
            className={`btn add-book-button ${added ? "is-added" : ""} ${addFailed ? "is-error" : ""}`}
            type="button"
            disabled={book.stock < 1 || adding}
            onClick={() => void handleAdd()}
            aria-label={`Thêm ${book.title} vào giỏ hàng`}
            aria-live="polite"
          >
            <span>{adding ? "Đang thêm" : added ? "Đã thêm" : addFailed ? "Thử lại" : "Thêm vào giỏ"}</span>
            <b aria-hidden="true">{added ? "✓" : addFailed ? "!" : "+"}</b>
          </button>
        </div>
      </div>
    </article>
  );
}
