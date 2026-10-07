import { useMemo, useState } from "react";
import { formatEventTime } from "../../lib/format";

export type SecurityEventItem = {
  id: number;
  requestId: string;
  eventType: string;
  severity: string;
  method?: string;
  path?: string;
  details?: string;
  createdAt: string;
};

const methodBadgeStyle: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  POST: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  PATCH: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  DELETE: "bg-rose-500/10 text-rose-400 border-rose-500/25"
};

export function SecurityEventsPanel({ events }: { events: SecurityEventItem[] }) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = events.length;
    const critical = events.filter((e) => e.severity?.toLowerCase() === "critical" || e.severity?.toLowerCase() === "error").length;
    const warning = events.filter((e) => e.severity?.toLowerCase() === "warn" || e.severity?.toLowerCase() === "warning").length;
    const info = events.filter((e) => e.severity?.toLowerCase() === "info").length;
    return { total, critical, warning, info };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSeverity =
        severityFilter === "all" ||
        (severityFilter === "critical" && (e.severity?.toLowerCase() === "critical" || e.severity?.toLowerCase() === "error")) ||
        (severityFilter === "warning" && (e.severity?.toLowerCase() === "warn" || e.severity?.toLowerCase() === "warning")) ||
        (severityFilter === "info" && e.severity?.toLowerCase() === "info");

      if (!matchesSeverity) return false;
      if (!query.trim()) return true;

      const q = query.toLowerCase();
      return (
        e.eventType?.toLowerCase().includes(q) ||
        e.requestId?.toLowerCase().includes(q) ||
        e.path?.toLowerCase().includes(q) ||
        e.method?.toLowerCase().includes(q) ||
        e.details?.toLowerCase().includes(q)
      );
    });
  }, [events, query, severityFilter]);

  function copyRequestId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function copyPayload(details: string) {
    void navigator.clipboard.writeText(details);
    setCopiedId("payload");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Sleek Baseline Warning Banner */}
      {import.meta.env.VITE_SECURITY_MODE === "baseline" && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-3 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-300">Môi trường Baseline (5173):</span>
            <span className="text-amber-200/90">Hệ thống đối chứng cố tình tắt Lớp 6 (Audit Logging) để phục vụ kiểm thử.</span>
          </div>
          <a
            href="http://localhost:5174/admin"
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-bold text-xs whitespace-nowrap transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Mở Cổng Secure (5174)</span>
            <span>&rarr;</span>
          </a>
        </div>
      )}

      {/* Hero Header & KPI Cards */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              REALTIME FEED
            </span>
            <span className="text-xs text-slate-400 font-mono">Bảo mật bất biến</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Giám sát An ninh
          </h1>
        </div>

        {/* 4 Sleek Metric Widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          {/* Total */}
          <div className="admin-card-hover bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 rounded-xl px-4 py-3 min-w-[110px] shadow-sm cursor-default">
            <div className="text-[10px] text-slate-400 font-mono font-semibold tracking-wider uppercase">TỔNG SỰ KIỆN</div>
            <div className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">{stats.total}</div>
          </div>

          {/* Critical */}
          <div className={`admin-card-hover rounded-xl px-4 py-3 min-w-[110px] border shadow-sm transition-all cursor-default ${
            stats.critical > 0
              ? "bg-rose-950/20 border-rose-500/40"
              : "bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-slate-800/90"
          }`}>
            <div className="text-[10px] font-mono font-semibold tracking-wider uppercase flex items-center gap-1.5 text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${stats.critical > 0 ? "bg-rose-400 animate-ping" : "bg-emerald-400"}`} />
              NGUY CẤP
            </div>
            <div className={`text-2xl font-bold font-mono mt-1 tabular-nums ${stats.critical > 0 ? "text-rose-400" : "text-slate-300"}`}>
              {stats.critical}
            </div>
          </div>

          {/* Warning */}
          <div className="admin-card-hover bg-amber-950/15 border border-amber-500/30 rounded-xl px-4 py-3 min-w-[110px] shadow-sm cursor-default">
            <div className="text-[10px] text-amber-400 font-mono font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              CẢNH BÁO
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">{stats.warning}</div>
          </div>

          {/* Info */}
          <div className="admin-card-hover bg-emerald-950/15 border border-emerald-500/30 rounded-xl px-4 py-3 min-w-[110px] shadow-sm cursor-default">
            <div className="text-[10px] text-emerald-400 font-mono font-semibold tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              THÔNG TIN
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">{stats.info}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f172a]/70 border border-slate-800/90 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md backdrop-blur-sm">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: "all", label: `Tất cả (${stats.total})` },
            { key: "warning", label: `Cảnh báo (${stats.warning})` },
            { key: "info", label: `Thông tin (${stats.info})` },
            { key: "critical", label: `Nguy cấp (${stats.critical})` }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSeverityFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                severityFilter === tab.key
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md"
                  : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo sự kiện, IP, Path, ID..."
            className="w-full pl-9 pr-8 py-2 bg-[#090d16] border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-all shadow-inner"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Events Table Container */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {filteredEvents.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-500 text-xl">
              🛡️
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Không có sự kiện an ninh
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {events.length === 0
                ? "Chưa phát sinh vi phạm hoặc hệ thống đang ở chế độ đối chứng."
                : "Không có sự kiện nào khớp với từ khóa tìm kiếm."}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-800/80 text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase bg-[#090d16]">
              <div className="col-span-3 sm:col-span-2">Thời gian</div>
              <div className="col-span-3 sm:col-span-2">Mức độ</div>
              <div className="col-span-6 sm:col-span-4">Sự kiện & Request ID</div>
              <div className="hidden sm:block col-span-4">Endpoint / Method</div>
            </div>

            {/* Event Rows */}
            <div className="divide-y divide-slate-800/60">
              {filteredEvents.map((item) => {
                const isExpanded = expandedId === item.id;
                const isCrit = item.severity?.toLowerCase() === "critical" || item.severity?.toLowerCase() === "error";
                const isWarn = item.severity?.toLowerCase() === "warn" || item.severity?.toLowerCase() === "warning";
                const methodBadge = item.method ? (methodBadgeStyle[item.method] ?? "bg-slate-800 text-slate-300 border-slate-700") : null;

                return (
                  <div key={item.id} className="transition-colors hover:bg-slate-900/50">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : item.id); }}
                      className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center cursor-pointer select-none text-xs"
                    >
                      {/* Timestamp: Clean compact single line */}
                      <div className="col-span-3 sm:col-span-2 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {formatEventTime(item.createdAt)}
                      </div>

                      {/* Severity Badge: Modern sleek pill */}
                      <div className="col-span-3 sm:col-span-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold tracking-wide border ${
                            isCrit
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : isWarn
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCrit ? "bg-rose-400 animate-ping" : isWarn ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                          />
                          {item.severity}
                        </span>
                      </div>

                      {/* Event Type & Request ID with subtle copy icon */}
                      <div className="col-span-6 sm:col-span-4">
                        <div className={`font-mono font-semibold text-xs truncate ${
                          item.eventType.includes("BLOCKED") || item.eventType.includes("ATTACK")
                            ? "text-amber-300"
                            : item.eventType.includes("FAILED")
                            ? "text-rose-300"
                            : "text-slate-200"
                        }`}>
                          {item.eventType}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 font-mono mt-0.5">
                          <span className="text-slate-500 text-[11px] bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                            {item.requestId ? item.requestId.slice(0, 8) + '…' : '—'}
                          </span>
                          {item.requestId && (
                            <button
                              type="button"
                              title="Sao chép Request ID"
                              onClick={(e) => { e.stopPropagation(); copyRequestId(item.requestId); }}
                              className="text-slate-500 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
                            >
                              {copiedId === item.requestId ? (
                                <span className="text-emerald-400 text-[10px] font-bold">✓</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Endpoint & Method Badge */}
                      <div className="col-span-12 sm:col-span-4 flex items-center justify-between gap-2 mt-1 sm:mt-0">
                        <div className="font-mono text-xs text-slate-300 truncate flex items-center gap-2">
                          {item.method && methodBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${methodBadge}`}>
                              {item.method}
                            </span>
                          )}
                          <span className="text-slate-300 text-xs truncate">{item.path || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-slate-400">
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180 text-amber-400" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details Pane */}
                    {isExpanded && (
                      <div className="px-5 py-3.5 bg-[#090d16] border-t border-slate-800/80 font-mono text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                            Chi tiết Payload / Hành vi:
                          </span>
                          {item.details && (
                            <button
                              type="button"
                              onClick={() => copyPayload(item.details ?? "")}
                              className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              {copiedId === "payload" ? "✓ Đã sao chép" : "Sao chép payload"}
                            </button>
                          )}
                        </div>
                        <div className="p-3 bg-[#050811] border border-slate-800 rounded-lg text-slate-200 whitespace-pre-wrap break-words text-xs shadow-inner leading-relaxed">
                          {item.details || "Không có thông tin chi tiết."}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
