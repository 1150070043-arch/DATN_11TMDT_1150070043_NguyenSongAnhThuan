import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { Book, Category } from "../types";
import { FinalBookCard } from "./HomePage";

type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

function paginationWindow(current: number, total: number): PaginationItem[] {
  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  pages.forEach((value, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && value - previous > 1) {
      result.push(index === 1 ? "ellipsis-left" : "ellipsis-right");
    }
    result.push(value);
  });
  return result;
}

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void api<Category[]>("/api/books/categories", { signal: controller.signal })
      .then((result) => setCategories(result.data))
      .catch(() => {
        if (!controller.signal.aborted) setCategories([]);
      });
    return () => controller.abort();
  }, []);

  const search = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "12", sort: "newest" });
    if (submittedQuery) params.set("q", submittedQuery);
    if (category) params.set("category", category);
    return params.toString();
  }, [submittedQuery, category, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api<Book[]>(`/api/books?${search}`, { signal: controller.signal })
      .then((result) => {
        const nextTotal = Number(result.meta?.total ?? result.data.length);
        const lastPage = Math.max(1, Math.ceil(nextTotal / 12));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setBooks(result.data);
        setTotal(nextTotal);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.message : "Không thể tải danh sách sách.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / 12));
  const pagination = useMemo(() => paginationWindow(page, totalPages), [page, totalPages]);

  function changePage(nextPage: number) {
    setPage(nextPage);
    document.getElementById("catalog-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setQuery("");
    setSubmittedQuery("");
    setCategory("");
    setPage(1);
  }

  return (
    <div className="min-h-screen pt-24 pb-20 bg-[#0b0907] text-[#ede7dc]">
      <section className="border-b border-[#22201d] bg-[#0f0d0b]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <div className="flex items-center gap-3 mb-5 text-[#c8a94d] text-[10px] uppercase tracking-[.3em] font-mono">
            <span className="block w-8 h-px bg-[#c8a94d]" /> Kho sách
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 id="catalog-heading" className="font-serif text-5xl md:text-7xl font-light leading-none mb-4">
                Tất cả <em className="text-[#c8a94d]">đầu sách</em>
              </h1>
              <p className="text-[#8f887d] text-sm tracking-wide">
                {total > 0 ? `${total} tác phẩm được tuyển chọn dành cho bạn` : "Khám phá những tác phẩm đáng đọc"}
              </p>
            </div>
            <span className="font-mono text-[10px] tracking-[.24em] uppercase text-[#666057]">Thất Tịnh · Collection 2026</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-10 md:mt-12">
        <form
          className="flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between mb-10"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedQuery(query.trim());
            setPage(1);
          }}
        >
          <div className="relative w-full lg:w-80">
            <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#706a61]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
            </svg>
            <label htmlFor="book-search" className="visually-hidden">Tìm theo tên sách hoặc tác giả</label>
            <input
              id="book-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent border-0 border-b border-[#39342e] rounded-none pl-7 pr-2 py-3 text-sm text-[#ede7dc] placeholder:text-[#625c53] focus:outline-none focus:border-[#c8a94d] transition-colors"
              placeholder="Tìm tên sách, tác giả..."
              maxLength={100}
            />
            <button type="submit" className="visually-hidden">Tìm sách</button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide" aria-label="Lọc sách theo thể loại">
            <button
              className={`shrink-0 px-4 py-2 text-[10px] uppercase tracking-[.18em] border transition-colors ${category === "" ? "border-[#c8a94d] bg-[#c8a94d] text-[#0b0907]" : "border-[#312d28] text-[#8f887d] hover:border-[#c8a94d] hover:text-[#c8a94d]"}`}
              type="button"
              aria-pressed={category === ""}
              onClick={() => { setCategory(""); setPage(1); }}
            >Tất cả</button>
            {categories.map((item) => (
              <button
                className={`shrink-0 px-4 py-2 text-[10px] uppercase tracking-[.18em] border transition-colors ${category === String(item.id) ? "border-[#c8a94d] bg-[#c8a94d] text-[#0b0907]" : "border-[#312d28] text-[#8f887d] hover:border-[#c8a94d] hover:text-[#c8a94d]"}`}
                type="button"
                key={item.id}
                aria-pressed={category === String(item.id)}
                onClick={() => { setCategory(String(item.id)); setPage(1); }}
              >{item.name}</button>
            ))}
          </div>
        </form>

        {(submittedQuery || category) && (
          <div className="flex items-center justify-between border-y border-[#22201d] py-3 mb-8 text-xs text-[#8f887d]">
            <span>Đang hiển thị kết quả đã lọc{submittedQuery ? ` cho “${submittedQuery}”` : ""}</span>
            <button type="button" onClick={clearFilters} className="text-[#c8a94d] uppercase tracking-[.15em] text-[10px]">Xóa bộ lọc</button>
          </div>
        )}

        {error && (
          <div className="border border-red-900/60 bg-red-950/20 px-5 py-4 mb-8 flex items-center justify-between text-sm text-red-200" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="text-[#c8a94d] uppercase tracking-widest text-[10px]">Thử lại</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-10" aria-label="Đang tải sách">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="aspect-[2/3] bg-[#171411] animate-pulse border border-[#24201c]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center border-y border-[#22201d]">
            <p className="font-serif text-3xl mb-3">Chưa tìm thấy sách phù hợp</p>
            <p className="text-[#777067] text-sm mb-7">Thử một từ khóa ngắn hơn hoặc chọn lại thể loại.</p>
            <button type="button" onClick={clearFilters} className="btn-gold px-6 py-3 text-xs uppercase tracking-widest">Xóa bộ lọc</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 md:gap-x-7 gap-y-12">
              {books.map((book) => <FinalBookCard book={book} key={book.id} />)}
            </div>

            {totalPages > 1 && (
              <nav className="mt-16 pt-8 border-t border-[#22201d] flex items-center justify-between" aria-label="Phân trang danh mục sách">
                <button type="button" onClick={() => changePage(page - 1)} disabled={page === 1} className="text-[10px] uppercase tracking-[.2em] text-[#8f887d] hover:text-[#c8a94d] disabled:opacity-30">← Trang trước</button>
                <div className="flex items-center gap-2">
                  {pagination.map((item) => typeof item === "number" ? (
                    <button
                      type="button"
                      key={item}
                      aria-current={item === page ? "page" : undefined}
                      aria-label={`Trang ${item}`}
                      onClick={() => changePage(item)}
                      className={`w-9 h-9 text-xs border transition-colors ${item === page ? "border-[#c8a94d] bg-[#c8a94d] text-[#0b0907]" : "border-[#312d28] text-[#8f887d] hover:border-[#c8a94d]"}`}
                    >{item}</button>
                  ) : <span key={item} className="text-[#625c53] px-1">…</span>)}
                </div>
                <button type="button" onClick={() => changePage(page + 1)} disabled={page === totalPages} className="text-[10px] uppercase tracking-[.2em] text-[#8f887d] hover:text-[#c8a94d] disabled:opacity-30">Trang sau →</button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
