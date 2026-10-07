import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { api, ApiError } from "../lib/api";
import type { Book } from "../types";

export function WishlistPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadWishlist() {
    setLoading(true);
    await api<Book[]>("/api/profile/wishlist")
      .then((result) => {
        setBooks(result.data);
        setError("");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? cause.message : "Không thể tải danh sách yêu thích.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void loadWishlist();
  }, []);

  return (
    <div className="container py-5">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Tủ sách cá nhân</div>
          <h1>Sách yêu thích</h1>
          <p className="text-secondary mb-0">Lưu lại những cuốn bạn muốn đọc hoặc mua sau.</p>
        </div>
        {!loading && <span className="wishlist-total">{books.length} cuốn sách</span>}
      </div>

      {error && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-3" role="alert">
          <span>{error}</span>
          <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => void loadWishlist()}>Thử lại</button>
        </div>
      )}
      {loading ? (
        <div className="row g-4" aria-label="Đang tải sách yêu thích">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="col-6 col-md-4 col-xl-3" key={index}>
              <div className="book-skeleton" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state wishlist-empty">
          <div className="empty-heart" aria-hidden="true">♡</div>
          <h2>Danh sách yêu thích đang trống</h2>
          <p>Bấm biểu tượng trái tim ở một cuốn sách để lưu lại tại đây.</p>
          <Link className="btn btn-ink" to="/">Khám phá sách</Link>
        </div>
      ) : (
        <div className="row g-4 g-xl-5">
          {books.map((book) => (
            <div className="col-6 col-md-4 col-xl-3" key={book.id}>
              <BookCard
                book={book}
                onWishlistChange={(isWishlisted) => {
                  if (!isWishlisted) {
                    setBooks((current) => current.filter((item) => item.id !== book.id));
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
