import { useState } from "react";
import { downloadApiFile, ApiError } from "../../lib/api";
import { formatCompactDate } from "../../lib/format";

export type SecurityObservation = {
  protected: boolean;
  status: number;
  evidence: string;
  durationMs?: number;
};

export type SecurityReport = {
  available: boolean;
  reason?: string;
  summary?: {
    generatedAt: string;
    total: number;
    passed: number;
    baselineVulnerable: number;
    secureProtected: number;
  };
  results?: Array<{
    id: string;
    name: string;
    reference?: string;
    baseline: SecurityObservation;
    secure: SecurityObservation;
    passed: boolean;
  }>;
};

const defenseDetails: Record<string, { category: string; description: string; defenseMechanism: string }> = {
  TC01: {
    category: "Kiểm soát đầu vào & SQLi",
    description: "Kẻ tấn công chèn chuỗi ' OR 1=1 -- vào ô tìm kiếm nhằm bẻ gãy câu lệnh SQL và trích xuất dữ liệu trái phép.",
    defenseMechanism: "Parameterized Queries (mssql) kết hợp Zod schema validation. Dữ liệu đầu vào bị cô lập hoàn toàn khỏi cú pháp SQL."
  },
  TC02: {
    category: "Kiểm soát đầu vào & XSS",
    description: "Gửi mã độc script (<script>alert(1)</script>) vào họ tên hoặc nội dung để thực thi mã trên trình duyệt nạn nhân.",
    defenseMechanism: "React auto-escaping kết hợp kiểm soát dữ liệu hiển thị, triệt tiêu khả năng thực thi JavaScript độc hại."
  },
  TC03: {
    category: "Xác thực & CSRF",
    description: "Trang web bên ngoài kích hoạt request ngầm mạo danh phiên đăng nhập của người dùng.",
    defenseMechanism: "Double-Submit Cookie Anti-CSRF Token (x-csrf-token) kết hợp cookie SameSite=Lax. Từ chối yêu cầu thiếu token hợp lệ (HTTP 403)."
  },
  TC04: {
    category: "Xác thực & JWT",
    description: "Giả mạo payload JWT hoặc sửa chữ ký token nhằm leo thang đặc quyền quản trị.",
    defenseMechanism: "Chữ ký HMAC-SHA256 với secret 256-bit + kiểm tra token version trong cơ sở dữ liệu. Token giả bị hủy lập tức (HTTP 401)."
  },
  TC05: {
    category: "Xác thực & Brute-force",
    description: "Dò quét mật khẩu tự động liên tục với tần suất cao không qua kiểm soát số lần.",
    defenseMechanism: "Thuật toán băm Argon2id + Bộ đếm Rate Limiting theo IP và tài khoản. Khóa và trả về HTTP 429 sau 5 lần thất bại."
  },
  TC06: {
    category: "Kiểm soát truy cập & RBAC",
    description: "Khách hàng thường cố tình gọi trực tiếp vào các API quản trị nội bộ (/api/admin/*).",
    defenseMechanism: "Middleware RBAC (Role-Based Access Control) kiểm tra vai trò admin trên từng endpoint, chặn bằng HTTP 403 Forbidden."
  },
  TC07: {
    category: "Kiểm soát truy cập & IDOR",
    description: "Người dùng A sửa ID trên URL/API (/api/orders/{id}) để xem trộm đơn hàng của người dùng B.",
    defenseMechanism: "Object-Level Ownership Verification: Kiểm tra quyền sở hữu bản ghi theo user session, chặn HTTP 403 và phát sinh sự kiện IDOR_BLOCKED."
  },
  TC08: {
    category: "Hạ tầng & Headers",
    description: "Lộ chữ ký công nghệ (X-Powered-By: Express), CORS lỏng lẻo và thiếu security headers.",
    defenseMechanism: "Helmet Security Headers (HSTS, CSP, X-Content-Type-Options) + Ẩn header nhạy cảm + CORS whitelist nghiêm ngặt."
  },
  TC09: {
    category: "Hạ tầng & Dữ liệu PII",
    description: "API trả về thông tin nhạy cảm (password hash, secret keys) trong payload JSON.",
    defenseMechanism: "DTO (Data Transfer Object) Data Masking: Lọc chỉ xuất các trường công khai, loại bỏ triệt để dữ liệu nhạy cảm."
  },
  TC10: {
    category: "Hạ tầng & Tải tệp tải lên",
    description: "Tải lên tệp thực thi (.php, .exe, .sh) giả mạo tệp ảnh để kiểm soát hệ thống.",
    defenseMechanism: "Xác thực 3 lớp: định dạng mở rộng, MIME type whitelist, và kiểm tra Magic Bytes nhị phân thực tế của tệp ảnh (HTTP 422)."
  }
};

const testNameVi: Record<string, string> = {
  TC01: "Tấn công chèn mã SQL (SQL Injection)",
  TC02: "Lưu trữ mã độc kịch bản (Stored XSS)",
  TC03: "Giả mạo yêu cầu chéo trang (Cross-Site Request Forgery - CSRF)",
  TC04: "Xác thực thất bại & Giả mạo token JWT",
  TC05: "Tấn công vét cạn mật khẩu (Brute Force)",
  TC06: "Phá vỡ kiểm soát phân quyền (Broken Access Control - RBAC)",
  TC07: "Tham chiếu đối tượng trực tiếp không an toàn (IDOR)",
  TC08: "Sai lỗi cấu hình an ninh hệ thống (Security Misconfiguration)",
  TC09: "Lộ lọt thông tin dữ liệu nhạy cảm (Sensitive Data Exposure)",
  TC10: "Tải lên tệp tin độc hại nguy hiểm (Unsafe File Upload)"
};

function translateEvidence(evidence: string): string {
  if (!evidence) return "";

  if (evidence.startsWith("payload result count=")) {
    const count = evidence.replace("payload result count=", "");
    return count === "0"
      ? "Truy vấn an toàn: Trả về 0 bản ghi (ngăn chặn triệt để chuỗi SQL Injection)"
      : `Truy vấn bị bẻ gãy: Trả về ${count} bản ghi dữ liệu rò rỉ trái phép`;
  }
  if (evidence === "dangerous HTML remained in response") {
    return "Mã HTML/JavaScript độc hại chưa qua làm sạch vẫn tồn tại nguyên vẹn trong phản hồi máy chủ";
  }
  if (evidence === "dangerous HTML removed") {
    return "Mã HTML/JavaScript độc hại đã bị cơ chế phòng thủ loại bỏ / tự động mã hóa an toàn (auto-escape)";
  }
  if (evidence === "state-changing request without CSRF token returned HTTP 200") {
    return "Yêu cầu thay đổi trạng thái thiếu Anti-CSRF token vẫn được chấp thuận thành công (HTTP 200)";
  }
  if (evidence === "state-changing request without CSRF token returned HTTP 403") {
    return "Yêu cầu thiếu Anti-CSRF token hợp lệ đã bị chặn với mã từ chối HTTP 403 Forbidden";
  }
  if (evidence === "tampered token returned HTTP 200") {
    return "Chữ ký JWT bị làm giả nhưng máy chủ vẫn xác thực thành công (HTTP 200)";
  }
  if (evidence === "tampered token returned HTTP 401") {
    return "Chữ ký JWT giả mạo bị phát hiện và từ chối ngay lập tức với HTTP 401 Unauthorized";
  }
  if (evidence === "seventh failed login returned HTTP 401") {
    return "Đăng nhập sai liên tiếp 7 lần nhưng không bị giới hạn tần suất, chỉ trả về HTTP 401 thông thường";
  }
  if (evidence === "seventh failed login returned HTTP 429") {
    return "Đăng nhập sai vượt ngưỡng cho phép, kích hoạt Rate Limiting chặn với HTTP 429 Too Many Requests";
  }
  if (evidence === "customer access to admin API returned HTTP 200") {
    return "Tài khoản khách hàng thông thường gọi API quản trị nội bộ thành công với HTTP 200 (leo thang đặc quyền)";
  }
  if (evidence === "customer access to admin API returned HTTP 403") {
    return "Tài khoản khách hàng bị Middleware RBAC chặn truy cập API quản trị với HTTP 403 Forbidden";
  }
  if (evidence === "customer A reading customer B order returned HTTP 200") {
    return "Khách hàng A thay đổi mã ID trên request và đọc trộm đơn hàng của khách hàng B (HTTP 200)";
  }
  if (evidence === "customer A reading customer B order returned HTTP 403") {
    return "Kiểm tra quyền sở hữu bản ghi (Ownership check) phát hiện vi phạm và chặn với HTTP 403 Forbidden";
  }
  if (evidence.includes("allow-origin=http://evil.example")) {
    return "CORS cho phép origin độc hại (allow-origin=http://evil.example), làm lộ máy chủ X-Powered-By: Express";
  }
  if (evidence.includes("allow-origin=http://localhost:5174")) {
    return "CORS chỉ cho phép origin tin cậy (http://localhost:5174), đã ẩn hoàn toàn header máy chủ X-Powered-By";
  }
  if (evidence === "credential field exposed") {
    return "Dữ liệu JSON trả về làm lộ lọt thông tin nhạy cảm (mật khẩu đã băm/thông tin xác thực)";
  }
  if (evidence === "response DTO contains no credential field") {
    return "Cơ chế DTO Data Masking đã lọc sạch, không chứa bất kỳ trường thông tin xác thực nhạy cảm nào";
  }
  if (evidence === "disallowed executable upload returned HTTP 201") {
    return "Tệp thực thi độc hại (.php/.exe/.sh) ngụy trang ảnh đã được lưu thành công vào hệ thống (HTTP 201)";
  }
  if (evidence === "disallowed executable upload returned HTTP 422") {
    return "Kiểm tra Magic Bytes nhị phân phát hiện tệp thực thi giả mạo và từ chối lưu với HTTP 422 Unprocessable";
  }

  return evidence;
}

export function SecurityComparison({ report }: { report: SecurityReport }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("TC01");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  async function exportCsv() {
    setExporting(true);
    setExportError("");
    try {
      await downloadApiFile("/api/admin/security-report.csv", "bookguard-security-report.csv");
    } catch (cause) {
      setExportError(cause instanceof ApiError ? cause.message : "Không thể xuất báo cáo.");
    } finally {
      setExporting(false);
    }
  }

  if (!report.available || !report.summary || !report.results) {
    return (
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-12 text-center shadow-xl font-sans">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-amber-400">
          <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Chưa có dữ liệu kiểm thử thực nghiệm
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
          {report.reason ?? "Chạy runner kiểm thử bảo mật tự động trên Docker để nạp dữ liệu thật từ Baseline và Secure."}
        </p>
        <div className="inline-flex items-center gap-2 bg-[#090d16] border border-slate-800 px-4 py-2.5 rounded-lg font-mono text-xs text-slate-300 shadow-inner">
          <span className="text-amber-400 font-bold">$</span> docker compose --profile tools run --rm security-tests
        </div>
      </div>
    );
  }

  const completion = report.summary.total === 0
    ? 0
    : Math.round((report.summary.passed / report.summary.total) * 100);
  const baselineAverage = averageDuration(report.results.map((item) => item.baseline.durationMs));
  const secureAverage = averageDuration(report.results.map((item) => item.secure.durationMs));

  const categories = [
    { key: "all", label: `Tất cả (${report.results.length})` },
    { key: "Đầu vào", label: "Đầu vào (SQLi & XSS)" },
    { key: "Xác thực", label: "Xác thực & Phiên" },
    { key: "Kiểm soát", label: "Phân quyền & IDOR" },
    { key: "Hạ tầng", label: "Hạ tầng & Dữ liệu" }
  ];

  const filteredResults = report.results.filter((item) => {
    if (categoryFilter === "all") return true;
    const cat = defenseDetails[item.id]?.category ?? "";
    return cat.includes(categoryFilter);
  });

  return (
    <div className="space-y-4 text-slate-100 font-sans">
      {/* Sleek Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Đối chiếu An ninh
          </h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            OWASP Top 10
          </span>
          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            Baseline vs Secure
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Đo lúc: {formatCompactDate(report.summary.generatedAt)}
          </span>
          <button
            onClick={() => void exportCsv()}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>{exporting ? "Đang xuất..." : "Xuất CSV"}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs px-3.5 py-2 rounded-lg font-mono">
          {exportError}
        </div>
      )}

      {/* Sleek Minimalist Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="admin-card-hover bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Tỷ lệ phòng thủ</div>
            <div className="text-lg font-bold font-mono text-emerald-400">{completion}% <span className="text-xs font-normal text-slate-500">({report.summary.passed}/{report.summary.total})</span></div>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">ĐẠT CHUẨN</span>
        </div>

        <div className="admin-card-hover bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Bản gốc Baseline</div>
            <div className="text-lg font-bold font-mono text-rose-400">{report.summary.baselineVulnerable} <span className="text-xs font-normal text-slate-500">lỗ hổng</span></div>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25">100% LỖI</span>
        </div>

        <div className="admin-card-hover bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Bản bảo mật Secure</div>
            <div className="text-lg font-bold font-mono text-emerald-400">{report.summary.secureProtected} <span className="text-xs font-normal text-slate-500">bảo vệ</span></div>
          </div>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">AN TOÀN</span>
        </div>

        <div className="admin-card-hover bg-slate-900/60 border border-slate-800/80 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Độ trễ trung bình</div>
            <div className="text-lg font-bold font-mono text-slate-100">{secureAverage ?? "—"} <span className="text-xs font-normal text-slate-500">ms</span></div>
          </div>
          <span className="text-xs font-mono text-amber-400 font-medium">+{Math.max(0, (secureAverage ?? 0) - (baselineAverage ?? 0))}ms</span>
        </div>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat.key
                  ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-mono hidden sm:inline shrink-0">
          {filteredResults.length} kịch bản
        </span>
      </div>

      {/* Table Container */}
      <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-[#0a0f1d]/60 shadow-md">
        {/* Table Column Headers */}
        <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/80 text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
          <div className="md:col-span-5">Kịch bản kiểm thử</div>
          <div className="md:col-span-3">Bản gốc Baseline</div>
          <div className="md:col-span-3">Bản bảo mật Secure</div>
          <div className="md:col-span-1 text-right">Kết quả</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-800/50">
          {filteredResults.map((item) => {
            const isExpanded = expandedId === item.id;
            const extra = defenseDetails[item.id];

            return (
              <div key={item.id} className="transition-colors hover:bg-slate-900/40">
                {/* Main Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : item.id); }}
                  className="px-4 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center cursor-pointer select-none text-xs"
                >
                  {/* Test ID & Name */}
                  <div className="md:col-span-5 flex items-center gap-2.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/25 shrink-0">
                      {item.id}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-slate-100 truncate text-xs">
                        {testNameVi[item.id] || item.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {item.reference && <span>{item.reference}</span>}
                        {extra && <span className="ml-1.5 text-slate-500">· {extra.category}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Baseline Status (NO BULLET DOTS) */}
                  <div className="md:col-span-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
                      {item.baseline.status === 0 ? "Lỗi kết nối" : item.baseline.protected ? "Đã ngăn chặn" : "Bị khai thác"}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      HTTP {item.baseline.status}
                      {item.baseline.durationMs !== undefined && ` · ${item.baseline.durationMs}ms`}
                    </span>
                  </div>

                  {/* Secure Status (NO BULLET DOTS) */}
                  <div className="md:col-span-3 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      item.secure.status > 0 && item.secure.protected
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                    }`}>
                      {item.secure.status === 0 ? "Lỗi kết nối" : item.secure.protected ? "Đã ngăn chặn" : "Chưa ngăn chặn"}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      HTTP {item.secure.status}
                      {item.secure.durationMs !== undefined && ` · ${item.secure.durationMs}ms`}
                    </span>
                  </div>

                  {/* Outcome Badge & Chevron */}
                  <div className="md:col-span-1 flex items-center justify-end gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      item.passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-rose-950/60 text-rose-300 border-rose-700/50"
                    }`}>
                      {item.passed ? "ĐẠT" : "CHƯA"}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? "rotate-180 text-amber-400" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Minimalist Expanded Inspection Panel */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-[#060a14]/60 border-t border-slate-800/60 text-xs space-y-2.5">
                    {/* Attack description */}
                    {extra && (
                      <div className="text-slate-300 text-xs leading-relaxed">
                        <span className="text-amber-400 font-semibold mr-1.5">Kịch bản tấn công:</span>
                        {extra.description}
                      </div>
                    )}

                    {/* Side-by-side Evidence Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {/* Baseline Evidence */}
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                        <div className="text-[11px] font-semibold text-rose-400 mb-1 flex items-center justify-between">
                          <span>Bản gốc Baseline (Lỗ hổng)</span>
                          <span className="font-mono text-[10px] text-rose-400/80">HTTP {item.baseline.status}</span>
                        </div>
                        <p className="text-rose-300 text-xs leading-relaxed font-mono">
                          {translateEvidence(item.baseline.evidence)}
                        </p>
                      </div>

                      {/* Secure Evidence */}
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <div className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center justify-between">
                          <span>Bản bảo mật Secure (Bảo vệ)</span>
                          <span className="font-mono text-[10px] text-emerald-400/80">HTTP {item.secure.status}</span>
                        </div>
                        <p className="text-emerald-300 text-xs leading-relaxed font-mono">
                          {translateEvidence(item.secure.evidence)}
                        </p>
                      </div>
                    </div>

                    {/* Defense mechanism */}
                    {extra && (
                      <div className="text-slate-300 text-xs leading-relaxed pt-2 border-t border-slate-800/40 flex items-start gap-2">
                        <span className="text-emerald-400 font-semibold shrink-0">Phòng thủ:</span>
                        <span className="text-slate-300">{extra.defenseMechanism}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function averageDuration(values: Array<number | undefined>): number | null {
  const measured = values.filter((value): value is number => Number.isFinite(value));
  if (measured.length === 0) return null;
  return Math.round(measured.reduce((total, value) => total + value, 0) / measured.length);
}
