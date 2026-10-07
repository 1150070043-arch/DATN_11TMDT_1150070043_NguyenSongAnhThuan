import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AdminCharts, type DashboardInsights } from "../components/admin/AdminCharts";
import { ExperimentDashboard } from "../components/admin/ExperimentDashboard";
import { InventoryPanel } from "../components/admin/InventoryPanel";
import { SecurityComparison, type SecurityReport } from "../components/admin/SecurityComparison";
import { SecurityEventsPanel, type SecurityEventItem } from "../components/admin/SecurityEventsPanel";
import { AuditTrailPanel, type AuditEventItem } from "../components/admin/AuditTrailPanel";
import * as D from "../design/Reference";
import { toDesign } from "../design/Runtime";
import { CouponsPanel } from "../components/admin/CouponsPanel";
import { useToast } from "../context/ToastContext";
import { api, ApiError, assetUrl } from "../lib/api";
import { currency, dateTime, statusLabel, formatCompactDate, formatEventTime } from "../lib/format";
import type { Book, Category, Order } from "../types";

type Dashboard = DashboardInsights & {
  summary: {
    customers: number;
    books: number;
    orders: number;
    revenue: number;
    pendingOrders: number;
  };
  recentOrders: Order[];
};

type AdminUser = {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
};

type AdminCategory = Category & {
  bookCount: number;
};

const emptyBook = {
  title: "",
  slug: "",
  author: "",
  isbn: "",
  description: "",
  price: 0,
  stock: 0,
  coverUrl: "",
  categoryId: 1,
  isPublished: true
};

const emptyCategory = { name: "", slug: "" };

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

export function AdminPage() {
  const { notify } = useToast();
  const [adminTheme, setAdminTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_theme") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    const syncTheme = () => {
      const current = document.documentElement.getAttribute("data-admin-theme") || localStorage.getItem("admin_theme") || "dark";
      setAdminTheme(current);
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-admin-theme"] });
    return () => observer.disconnect();
  }, []);

  const [tab, setTab] = useState<"overview" | "orders" | "books" | "inventory" | "coupons" | "categories" | "users" | "experiments" | "comparison" | "security" | "audit">("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [securityReport, setSecurityReport] = useState<SecurityReport>({ available: false });
  const [bookForm, setBookForm] = useState(emptyBook);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    successMessage: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function runConfirmedAction() {
    if (!confirmation || confirmBusy) return;
    setConfirmBusy(true);
    setError("");
    try {
      await confirmation.action();
      notify({ tone: "success", title: confirmation.successMessage });
      setConfirmation(null);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Không thể hoàn tất thao tác.";
      setError(message);
      notify({ tone: "error", title: "Thao tác chưa hoàn tất", message });
      setConfirmation(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function loadAll() {
    if (dashboard) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [dashboardResult, ordersResult, booksResult, usersResult, eventsResult, auditResult, categoriesResult, reportResult] =
        await Promise.all([
          api<Dashboard>("/api/admin/dashboard"),
          api<Order[]>("/api/admin/orders"),
          api<Book[]>("/api/admin/books"),
          api<AdminUser[]>("/api/admin/users"),
          api<SecurityEventItem[]>("/api/admin/security-events"),
          api<AuditEventItem[]>("/api/admin/audit-events"),
          api<AdminCategory[]>("/api/admin/categories"),
          api<SecurityReport>("/api/admin/security-report")
        ]);
      setDashboard(dashboardResult.data);
      setOrders(ordersResult.data);
      setBooks(booksResult.data);
      setUsers(usersResult.data);
      setEvents(eventsResult.data);
      setAuditEvents(auditResult.data);
      setCategories(categoriesResult.data);
      setSecurityReport(reportResult.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải dữ liệu quản trị.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function updateStatus(orderId: number, status: Order["status"]) {
    setError("");
    try {
      await api(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadAll();
      notify({ tone: "success", title: `Đã cập nhật đơn #${orderId}`, message: statusLabel[status] });
      if (selectedOrder?.id === orderId) await openOrder(orderId);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể cập nhật đơn hàng.");
    }
  }

  function openCreateBook() {
    setEditingBookId(null);
    setBookForm({ ...emptyBook, categoryId: categories[0]?.id ?? 1 });
    setCoverFile(null);
    setShowBookForm(true);
  }

  function openEditBook(book: Book) {
    setEditingBookId(book.id);
    setBookForm({
      title: book.title,
      slug: book.slug,
      author: book.author,
      isbn: book.isbn ?? "",
      description: book.description,
      price: Number(book.price),
      stock: book.stock,
      coverUrl: book.coverUrl ?? "",
      categoryId: book.categoryId,
      isPublished: book.isPublished ?? true
    });
    setCoverFile(null);
    setShowBookForm(true);
  }

  async function saveBook(event: FormEvent) {
    event.preventDefault();
    if (savingBook) return;
    const wasEditing = editingBookId !== null;
    setSavingBook(true);
    setError("");
    try {
      const saved = await api<{ id: number }>(editingBookId ? `/api/admin/books/${editingBookId}` : "/api/admin/books", {
        method: editingBookId ? "PUT" : "POST",
        body: JSON.stringify(bookForm)
      });
      const savedBookId = editingBookId ?? saved.data.id;
      if (!editingBookId) setEditingBookId(savedBookId);
      if (coverFile) {
        const formData = new FormData();
        formData.append("cover", coverFile);
        await api(`/api/admin/books/${savedBookId}/cover`, { method: "POST", body: formData });
      }
      setBookForm({ ...emptyBook });
      setCoverFile(null);
      setEditingBookId(null);
      setShowBookForm(false);
      await loadAll();
      notify({ tone: "success", title: wasEditing ? "Đã cập nhật sách" : "Đã thêm sách mới" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể lưu sách.");
    } finally {
      setSavingBook(false);
    }
  }

  function openCreateCategory() {
    setEditingCategoryId(null);
    setCategoryForm({ ...emptyCategory });
    setShowCategoryForm(true);
  }

  function openEditCategory(category: AdminCategory) {
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, slug: category.slug });
    setShowCategoryForm(true);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (savingCategory) return;
    const wasEditing = editingCategoryId !== null;
    setSavingCategory(true);
    setError("");
    try {
      await api(
        editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories",
        {
          method: editingCategoryId ? "PUT" : "POST",
          body: JSON.stringify(categoryForm)
        }
      );
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryForm({ ...emptyCategory });
      await loadAll();
      notify({ tone: "success", title: wasEditing ? "Đã cập nhật thể loại" : "Đã thêm thể loại" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể lưu thể loại.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(category: AdminCategory) {
    if (category.bookCount > 0) {
      setError("Không thể xóa thể loại đang có sách.");
      return;
    }
    setConfirmation({
      title: `Xóa thể loại “${category.name}”?`,
      description: "Thể loại sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.",
      confirmLabel: "Xóa thể loại",
      destructive: true,
      successMessage: "Đã xóa thể loại",
      action: async () => {
        await api(`/api/admin/categories/${category.id}`, { method: "DELETE" });
        await loadAll();
      }
    });
  }

  async function setUserStatus(user: AdminUser) {
    const action = user.isActive ? "khóa" : "mở khóa";
    setConfirmation({
      title: `${action[0]?.toUpperCase()}${action.slice(1)} tài khoản?`,
      description: user.isActive
        ? `${user.email} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập lại cho đến khi được mở khóa.`
        : `${user.email} sẽ có thể đăng nhập và tiếp tục sử dụng hệ thống.`,
      confirmLabel: user.isActive ? "Khóa tài khoản" : "Mở khóa",
      destructive: user.isActive,
      successMessage: user.isActive ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản",
      action: async () => {
        await api(`/api/admin/users/${user.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !user.isActive })
        });
        await loadAll();
      }
    });
  }

  async function openOrder(orderId: number) {
    setError("");
    try {
      const result = await api<Order>(`/api/admin/orders/${orderId}`);
      setSelectedOrder(result.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể mở chi tiết đơn hàng.");
    }
  }

  async function setPublication(book: Book) {
    const nextValue = !(book.isPublished ?? true);
    if (!nextValue) {
      setConfirmation({
        title: `Ẩn “${book.title}” khỏi cửa hàng?`,
        description: "Sách sẽ không còn xuất hiện trong danh mục nhưng dữ liệu và lịch sử đơn hàng vẫn được giữ nguyên.",
        confirmLabel: "Ẩn sách",
        destructive: true,
        successMessage: "Đã ẩn sách khỏi cửa hàng",
        action: async () => {
          await api(`/api/admin/books/${book.id}/publication`, {
            method: "PATCH",
            body: JSON.stringify({ isPublished: false })
          });
          await loadAll();
        }
      });
      return;
    }
    try {
      await api(`/api/admin/books/${book.id}/publication`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: nextValue })
      });
      await loadAll();
      notify({ tone: "success", title: "Sách đã được bán lại" });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể đổi trạng thái sách.");
    }
  }

  if (loading) return <div className="pt-32 px-8 text-slate-400">Đang tải trang quản trị...</div>;

  return (
    <div className="reference-admin w-full h-full font-opensans">
      <D.DataCtx.Provider value={{
        books: books.map(toDesign),
        categories: categories.map(category => ({ id: category.slug, name: category.name, count: category.bookCount, img: '', color: '' })),
        orders: orders.map(order => ({ id: order.id, customer: order.customerName, date: formatCompactDate(order.createdAt), status: statusLabel[order.status], total: Number(order.totalAmount), items: order.items?.map(item => item.bookTitle + ' × ' + item.quantity).join(', ') ?? 'Xem chi tiết đơn hàng' })),
        accounts: users.map(user => ({ name: user.fullName, email: user.email, role: user.role, verified: user.emailVerified, status: user.isActive ? 'Hoạt động' : 'Đã khóa', created: user.createdAt })),
        events: events.map(event => ({ time: formatEventTime(event.createdAt), event: event.eventType, id: event.requestId, level: event.severity, request: [event.method, event.path].filter(Boolean).join(' '), detail: event.details ?? '' }))
      }}>
        <D.AdminPanel activeTab={({ users: 'accounts', coupons: 'offers', comparison: 'security-compare', security: 'security-events' } as Record<string, D.AdminTab>)[tab] ?? tab as D.AdminTab} onTabChange={next => setTab((({ accounts: 'users', offers: 'coupons', 'security-compare': 'comparison', 'security-events': 'security' } as Record<string, typeof tab>)[next] ?? next) as typeof tab)} syncLabel={error ? 'Có lỗi đồng bộ' : refreshing ? 'Đang đồng bộ…' : 'Dữ liệu đã đồng bộ'}>
          {error && <div role="alert" className="border border-red-900 bg-red-900/20 text-red-300 p-4 mb-6 text-xs font-mono">{error}</div>}
          {tab === 'overview' && (
            <div className="space-y-8 w-full">
              <D.AdminOverview summary={dashboard?.summary} onOpenOrder={id => void openOrder(id)} />
              {dashboard && (
                <div>
                  <AdminCharts insights={dashboard} />
                </div>
              )}
            </div>
          )}
          {tab === 'orders' && <D.AdminOrders onOpen={id => void openOrder(id)} />}
          {tab === 'books' && <D.AdminBooks onCreate={openCreateBook} onEdit={id => { const book = books.find(item => item.id === id); if (book) openEditBook(book); }} />}
          {tab === 'inventory' && <InventoryPanel referenceLayout onChanged={loadAll} />}
          {tab === 'categories' && <D.AdminCategories onCreate={openCreateCategory} onEdit={slug => { const category = categories.find(item => item.slug === slug); if (category) openEditCategory(category); }} onRemove={slug => { const category = categories.find(item => item.slug === slug); if (category) void removeCategory(category); }} />}
          {tab === 'users' && <D.AdminAccounts onStatus={email => { const user = users.find(item => item.email === email); if (user) void setUserStatus(user); }} />}
          {tab === 'coupons' && <CouponsPanel />}
          {tab === 'comparison' && <SecurityComparison report={securityReport} />}
          {tab === 'security' && <SecurityEventsPanel events={events} />}
          {tab === 'audit' && <AuditTrailPanel events={auditEvents} />}
          {tab === 'experiments' && <ExperimentDashboard />}
        </D.AdminPanel>
        <div className={`legacy-ui reference-dialogs reference-admin theme-${adminTheme}`}>
      {showBookForm && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
          role="presentation"
          onMouseDown={() => setShowBookForm(false)}
        >
          <form
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-7 w-full max-w-5xl shadow-2xl text-slate-100 my-auto flex flex-col max-h-[94vh]"
            onSubmit={(event) => void saveBook(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {error && (
              <div role="alert" className="border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs px-4 py-2.5 rounded-lg mb-3 font-mono">
                {error}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between pb-3.5 mb-4 border-b border-slate-800">
              <div>
                <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">
                  Kho sách Thư An · Cổng quản trị
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {editingBookId ? "Chỉnh sửa thông tin sách" : "Thêm đầu sách mới"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setShowBookForm(false)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* 2-Column Wide Layout (Fits viewport without vertical scrolling) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto pr-1">
              {/* Left Column (7 cols): Book details & pricing */}
              <div className="lg:col-span-7 space-y-3">
                {/* Book Title */}
                <div>
                  <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                    Tên sách <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bookForm.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setBookForm((current) => ({
                        ...current,
                        title,
                        slug: !editingBookId && (current.slug === "" || current.slug === slugify(current.title))
                          ? slugify(title)
                          : current.slug
                      }));
                    }}
                    placeholder="VD: The Web Application Hacker's Handbook"
                    className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-white font-medium text-sm focus:outline-none focus:border-amber-400 placeholder-slate-500"
                  />
                </div>

                {/* Author & Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      Tác giả <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bookForm.author}
                      onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                      placeholder="Tên tác giả..."
                      className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      Slug URL <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bookForm.slug}
                      onChange={(e) => setBookForm({ ...bookForm, slug: e.target.value })}
                      placeholder="ten-sach-viet-lien..."
                      className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-amber-400 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Category & ISBN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      Thể loại <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={bookForm.categoryId}
                      onChange={(e) => setBookForm({ ...bookForm, categoryId: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      Mã ISBN <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bookForm.isbn}
                      onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                      placeholder="10 hoặc 13 chữ số..."
                      className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Price & Stock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      Giá bán (VNĐ) <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={String(bookForm.price)}
                      onChange={(e) => setBookForm({ ...bookForm, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                      {editingBookId ? "Tồn kho (sửa tại Sổ kho)" : "Số lượng nhập ban đầu"}
                    </label>
                    <input
                      type="number"
                      disabled={editingBookId !== null}
                      value={String(bookForm.stock)}
                      onChange={(e) => setBookForm({ ...bookForm, stock: Number(e.target.value) })}
                      className={`w-full px-3 py-2 border rounded-lg font-mono text-xs ${
                        editingBookId !== null ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : 'bg-[#090d16] border-slate-700/80 text-slate-200 focus:outline-none focus:border-amber-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1">
                    Mô tả tóm tắt sách <span className="text-amber-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    minLength={10}
                    value={bookForm.description}
                    onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                    placeholder="Nội dung giới thiệu ngắn về tác phẩm..."
                    className="w-full px-3 py-1.5 bg-[#090d16] border border-slate-700/80 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Right Column (5 cols): Cover Image Preview & Source */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-3 bg-[#090d16]/70 border border-slate-800 rounded-xl p-4">
                <div>
                  <label className="block text-xs text-amber-400 font-mono uppercase tracking-wider mb-2 font-bold">
                    Hình ảnh bìa sách
                  </label>

                  {/* Live Preview Box */}
                  <div className="flex flex-col items-center justify-center p-2.5 bg-[#060810] border border-slate-800 rounded-lg mb-3 min-h-[140px]">
                    {coverFile ? (
                      <img
                        src={URL.createObjectURL(coverFile)}
                        alt="Preview bìa"
                        className="h-32 w-24 object-cover rounded shadow-md border border-amber-400/60"
                      />
                    ) : bookForm.coverUrl ? (
                      <img
                        src={bookForm.coverUrl.startsWith('/uploads/') ? assetUrl(bookForm.coverUrl) : bookForm.coverUrl}
                        alt="Bìa hiện tại"
                        className="h-32 w-24 object-cover rounded shadow-md border border-slate-800"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="text-center text-slate-500 py-4">
                        <svg className="mx-auto mb-1.5 text-slate-600" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] font-mono">Chưa có ảnh bìa</span>
                      </div>
                    )}
                  </div>

                  {/* Open Library URL */}
                  <div className="mb-2.5">
                    <label className="block text-[11px] text-slate-400 font-mono mb-1">
                      URL ảnh trực tuyến (Open Library)
                    </label>
                    <input
                      type="text"
                      inputMode="url"
                      value={bookForm.coverUrl}
                      onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })}
                      placeholder="https://covers.openlibrary.org/…"
                      className="w-full px-3 py-1.5 bg-[#060810] border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-400 placeholder-slate-600"
                    />
                  </div>

                  {/* Upload File */}
                  <div>
                    <label className="block text-[11px] text-slate-400 font-mono mb-1">
                      Hoặc tải tệp từ máy
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                      className="w-full px-2 py-1 bg-[#060810] border border-slate-800 rounded-lg text-slate-400 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-slate-950 cursor-pointer"
                    />
                    <div className="text-[11px] text-slate-500 font-mono mt-1">
                      PNG, JPEG, WebP · tối đa 3 MB.{coverFile ? ` Đã chọn: ${coverFile.name}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3.5 mt-4 border-t border-slate-800">
              <div>
                {editingBookId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      const book = books.find((item) => item.id === editingBookId);
                      if (book) void setPublication(book);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded-lg border transition-colors cursor-pointer ${
                      books.find((item) => item.id === editingBookId)?.isPublished
                        ? 'border-rose-500/30 text-rose-400 hover:bg-rose-950/40 hover:border-rose-500'
                        : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-500'
                    }`}
                  >
                    {books.find((item) => item.id === editingBookId)?.isPublished ? 'Ẩn sách khỏi cửa hàng' : 'Bán lại sách'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBookForm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingBook}
                  className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingBook ? "Đang lưu..." : editingBookId ? "Lưu thay đổi" : "Thêm sách mới"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showCategoryForm && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="presentation"
          onMouseDown={() => setShowCategoryForm(false)}
        >
          <form
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-7 w-full max-w-lg shadow-2xl text-slate-100 my-auto flex flex-col"
            onSubmit={(event) => void saveCategory(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {error && (
              <div role="alert" className="border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs px-4 py-2.5 rounded-lg mb-4 font-mono">
                {error}
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between pb-3.5 mb-5 border-b border-slate-800">
              <div>
                <div className="text-xs tracking-wider text-amber-400 uppercase font-mono font-bold mb-1">
                  Danh mục sản phẩm · Phân loại sách
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {editingCategoryId ? "Chỉnh sửa thể loại" : "Thêm thể loại mới"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setShowCategoryForm(false)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1.5" htmlFor="category-name">
                  Tên thể loại <span className="text-amber-400">*</span>
                </label>
                <input
                  id="category-name"
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setCategoryForm((current) => ({
                      name,
                      slug: editingCategoryId ? current.slug : slugify(name)
                    }));
                  }}
                  placeholder="Ví dụ: Công nghệ thông tin, Lịch sử, Kinh tế..."
                  minLength={2}
                  maxLength={120}
                  className="w-full px-3.5 py-2.5 bg-[#090d16] border border-slate-700/80 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-mono uppercase tracking-wider mb-1.5" htmlFor="category-slug">
                  Slug định danh URL <span className="text-amber-400">*</span>
                </label>
                <input
                  id="category-slug"
                  type="text"
                  required
                  value={categoryForm.slug}
                  onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value.toLowerCase() })}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  minLength={2}
                  maxLength={140}
                  placeholder="cong-nghe-thong-tin"
                  className="w-full px-3.5 py-2.5 bg-[#090d16] border border-slate-700/80 rounded-lg text-amber-400 font-mono text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                />
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Định danh đường dẫn URL (chữ thường, số và gạch ngang). Tự động sinh từ tên thể loại.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-5 mt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCategoryForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={savingCategory}
                className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {savingCategory ? "Đang lưu..." : editingCategoryId ? "Lưu thay đổi" : "Thêm thể loại"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
          role="presentation"
          onMouseDown={() => setSelectedOrder(null)}
        >
          <div
            className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-7xl shadow-2xl text-slate-100 my-auto flex flex-col max-h-[94vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-order-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="text-xs sm:text-sm tracking-wider text-amber-400 uppercase font-semibold mb-1">
                  Quản lý đơn hàng · Chi tiết giao dịch
                </div>
                <div className="flex items-center gap-3">
                  <h2 id="admin-order-title" className="text-2xl sm:text-3xl font-bold text-white">
                    Đơn #{selectedOrder.id}
                  </h2>
                  <span className={`px-3 py-1 rounded-md text-xs sm:text-sm font-semibold ${
                    selectedOrder.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : selectedOrder.status === 'shipping'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : selectedOrder.status === 'confirmed'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : selectedOrder.status === 'cancelled'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {statusLabel[selectedOrder.status]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Thời gian đặt hàng</div>
                  <div className="text-sm sm:text-base text-slate-200 font-semibold">{dateTime.format(new Date(selectedOrder.createdAt))}</div>
                </div>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-amber-400 flex items-center justify-center transition-colors cursor-pointer text-base shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 2-Column Balanced Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto pr-1 flex-1">
              {/* Left Column (6 cols): Customer Info, Timeline, Email logs */}
              <div className="lg:col-span-6 bg-[#090d16]/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Customer & Shipping Info */}
                  <div>
                    <div className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                      Thông tin khách hàng & Giao nhận
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm bg-[#060810] border border-slate-800 p-4 rounded-xl">
                      <div>
                        <span className="text-slate-400 block text-xs mb-0.5">Người nhận:</span>
                        <strong className="text-slate-100 text-sm sm:text-base font-semibold">{selectedOrder.customerName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs mb-0.5">Số điện thoại:</span>
                        <span className="text-slate-200 text-sm sm:text-base font-semibold">{selectedOrder.phone || 'Chưa cung cấp'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block text-xs mb-0.5">Địa chỉ giao hàng:</span>
                        <span className="text-slate-200 text-sm sm:text-base leading-relaxed">{selectedOrder.shippingAddress || 'Nhận tại cửa hàng'}</span>
                      </div>
                      {selectedOrder.note && (
                        <div className="sm:col-span-2 pt-2 border-t border-slate-800">
                          <span className="text-amber-400 text-xs font-semibold block mb-0.5">Ghi chú từ khách:</span>
                          <span className="text-slate-300 italic text-sm">{selectedOrder.note}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Timeline */}
                  {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
                    <div className="pt-3 border-t border-slate-800">
                      <div className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Hành trình xử lý
                      </div>
                      <div className="space-y-2.5 pl-2 border-l-2 border-slate-800 max-h-36 overflow-y-auto">
                        {selectedOrder.statusHistory.map((h, i) => (
                          <div key={h.id} className="relative pl-3.5">
                            <div className={`absolute -left-[12px] top-1.5 w-2 h-2 rounded-full ${
                              i === (selectedOrder.statusHistory?.length ?? 1) - 1 ? 'bg-amber-400 ring-2 ring-amber-400/30' : 'bg-slate-600'
                            }`} />
                            <div className="flex items-center justify-between text-sm">
                              <strong className="text-slate-100 font-semibold">{statusLabel[h.toStatus]}</strong>
                              <span className="text-slate-400 text-xs font-medium">{dateTime.format(new Date(h.createdAt))}</span>
                            </div>
                            {(h.note || h.changedByName) && (
                              <div className="text-xs text-slate-300 mt-1">
                                {[h.note, h.changedByName].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Notifications */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      Email thông báo
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{selectedOrder.emailNotifications?.length || 0} lượt gửi</span>
                  </div>
                  {selectedOrder.emailNotifications?.length ? (
                    <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                      {selectedOrder.emailNotifications.map(notification => (
                        <div key={notification.id} className="flex items-center justify-between p-2.5 bg-[#060810] border border-slate-800 rounded-lg text-sm">
                          <div>
                            <div className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
                              <span>{statusLabel[notification.orderStatus]}</span>
                              <span className="text-slate-400 text-xs font-normal">({notification.recipientEmail})</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {dateTime.format(new Date(notification.createdAt))}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                            notification.deliveryState === 'sent'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : notification.deliveryState === 'failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {notification.deliveryState === 'sent' ? '✓ Đã gửi' : notification.deliveryState === 'failed' ? 'Lỗi' : 'Đang gửi'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 py-1">Chưa có email trạng thái nào cho đơn này.</p>
                  )}
                </div>
              </div>

              {/* Right Column (6 cols): Status updater, Ordered Books & Financial Summary */}
              <div className="lg:col-span-6 bg-[#090d16]/70 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Status Updater */}
                  <div>
                    <div className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      Cập nhật trạng thái đơn
                    </div>
                    {['completed', 'cancelled'].includes(selectedOrder.status) ? (
                      <div className="p-3 bg-[#060810] border border-slate-800 rounded-lg text-sm text-slate-300 font-medium">
                        Đơn hàng đã kết thúc ({statusLabel[selectedOrder.status]}).
                      </div>
                    ) : (
                      <div>
                        <select
                          id="admin-order-status"
                          aria-label="Cập nhật trạng thái"
                          className="w-full bg-[#060810] border border-slate-700 text-slate-100 px-3.5 py-2.5 text-sm sm:text-base rounded-lg focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                          value={selectedOrder.status}
                          onChange={event => void updateStatus(selectedOrder.id, event.target.value as Order['status'])}
                        >
                          {([
                            selectedOrder.status,
                            ...({
                              pending: ['confirmed', 'cancelled'],
                              confirmed: ['shipping', 'cancelled'],
                              shipping: ['completed'],
                              completed: [],
                              cancelled: []
                            } as Record<Order['status'], Order['status'][]>)[selectedOrder.status]
                          ]).map(st => (
                            <option key={st} value={st}>
                              {st === selectedOrder.status ? `(Hiện tại) ${statusLabel[st]}` : `→ Chuyển sang: ${statusLabel[st]}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Ordered Books */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                        Sản phẩm trong đơn
                      </span>
                      <span className="text-slate-400 text-xs sm:text-sm font-semibold">{selectedOrder.items?.length || 0} mục</span>
                    </div>
                    <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto pr-1">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div className="text-slate-100 font-semibold line-clamp-2 leading-snug text-sm sm:text-base">{item.bookTitle}</div>
                            <div className="text-xs sm:text-sm text-slate-400 mt-1">
                              Đơn giá: {currency.format(Number(item.unitPrice))} × <span className="text-amber-400 font-bold">{item.quantity}</span>
                            </div>
                          </div>
                          <div className="text-sm sm:text-base font-bold text-amber-400 shrink-0">
                            {currency.format(Number(item.unitPrice) * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="pt-3.5 border-t border-slate-800 space-y-2 text-sm sm:text-base">
                  {Number(selectedOrder.discountAmount ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span>Tạm tính tiền hàng:</span>
                        <span className="text-slate-100 font-semibold">{currency.format(Number(selectedOrder.subtotalAmount))}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-medium">
                        <span>Giảm giá ({selectedOrder.couponCode || 'Voucher'}):</span>
                        <span className="font-semibold">−{currency.format(Number(selectedOrder.discountAmount))}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>Phí vận chuyển:</span>
                    <span className="text-emerald-400 font-semibold">Miễn phí (0 đ)</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="text-sm sm:text-base font-semibold text-slate-300 uppercase tracking-wider">Tổng cộng:</span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                      {currency.format(Number(selectedOrder.totalAmount))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-4 mt-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 rounded-lg border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-colors cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.title ?? "Xác nhận thao tác"}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        busy={confirmBusy}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void runConfirmedAction()}
      />
    </div>
    </D.DataCtx.Provider>
    </div>
  );
}




