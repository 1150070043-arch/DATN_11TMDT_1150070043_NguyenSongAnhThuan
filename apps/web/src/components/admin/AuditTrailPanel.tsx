import { useMemo, useState } from "react";
import { formatEventTime } from "../../lib/format";

export type AuditEventItem = {
  id: number;
  action: string;
  entityType: string;
  entityId?: string | null;
  detailJson?: string | null;
  requestId?: string | null;
  createdAt: string;
  adminName: string;
};

export function AuditTrailPanel({ events }: { events: AuditEventItem[] }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (actionFilter !== "all" && !e.action?.toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.adminName?.toLowerCase().includes(q) ||
        e.action?.toLowerCase().includes(q) ||
        e.entityType?.toLowerCase().includes(q) ||
        String(e.entityId ?? "").toLowerCase().includes(q) ||
        String(e.detailJson ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, query, actionFilter]);

  function getActionBadge(action: string) {
    const act = action.toLowerCase();
    if (act.includes("khóa") || act.includes("hủy") || act.includes("xóa") || act.includes("ẩn")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    }
    if (act.includes("tạo") || act.includes("thêm") || act.includes("mở") || act.includes("bán lại")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
    if (act.includes("kho") || act.includes("tồn") || act.includes("số lượng")) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
    return "bg-slate-800 text-slate-300 border-slate-700";
  }

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/25">
              IMMUTABLE AUDIT
            </span>
            <span className="text-xs text-slate-400 font-mono">Trách nhiệm giải trình</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Nhật ký kiểm toán
          </h1>
        </div>

        <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-sm shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs font-mono text-slate-300">
            Tổng cộng <strong className="text-amber-400 font-bold">{events.length}</strong> bản ghi
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {[
            { key: "all", label: "Tất cả" },
            { key: "kho", label: "Kho & Tồn" },
            { key: "đơn", label: "Đơn hàng" },
            { key: "tài khoản", label: "Tài khoản" },
            { key: "sách", label: "Sách & Giá" }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActionFilter(item.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                actionFilter === item.key
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md"
                  : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo Admin, Thao tác, ID..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#090d16] border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all shadow-inner"
          />
          <svg
            className="absolute left-3 top-2 w-4 h-4 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-14 text-center text-slate-400 text-xs font-mono">
            Chưa có bản ghi kiểm toán nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-800 text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-mono bg-[#090d16]">
              <div className="col-span-3">Thời gian</div>
              <div className="col-span-3">Người thực hiện</div>
              <div className="col-span-3">Hành động</div>
              <div className="col-span-3">Đối tượng tác động</div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {filtered.map((event) => {
                const isExpanded = expandedId === event.id;
                return (
                  <div key={event.id} className="transition-colors hover:bg-slate-900/50">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : event.id); }}
                      className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center cursor-pointer select-none text-xs"
                    >
                      {/* Timestamp */}
                      <div className="col-span-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {formatEventTime(event.createdAt)}
                      </div>

                      {/* Admin User */}
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] text-amber-400 font-bold shrink-0 font-mono">
                          {event.adminName?.[0]?.toUpperCase() || "A"}
                        </div>
                        <span className="text-slate-100 font-medium truncate">{event.adminName}</span>
                      </div>

                      {/* Action Badge */}
                      <div className="col-span-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${getActionBadge(event.action)}`}>
                          {event.action}
                        </span>
                      </div>

                      {/* Entity Target */}
                      <div className="col-span-3 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-slate-300 truncate">
                          {event.entityType} {event.entityId && <code className="text-amber-400 font-bold ml-1 bg-slate-900 px-1 py-0.2 rounded border border-slate-800 text-[11px]">#{event.entityId}</code>}
                        </span>
                        {event.detailJson && (
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-180 text-amber-400" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Expandable JSON Detail */}
                    {isExpanded && event.detailJson && (
                      <div className="px-5 py-3 bg-[#090d16] border-t border-slate-800 font-mono text-xs space-y-2">
                        <div className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">
                          Chi tiết thay đổi trạng thái (Payload):
                        </div>
                        <pre className="p-3 bg-[#050811] border border-slate-800 rounded-lg text-slate-200 overflow-x-auto text-xs shadow-inner leading-relaxed">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(event.detailJson), null, 2);
                            } catch {
                              return event.detailJson;
                            }
                          })()}
                        </pre>
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
