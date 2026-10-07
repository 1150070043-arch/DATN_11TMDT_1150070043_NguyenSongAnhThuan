import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { api, ApiError } from "../../lib/api";
import { dateTime } from "../../lib/format";

type ExperimentRun = {
  id: number;
  runType: "security" | "functional" | "performance";
  mode: "baseline" | "secure" | "comparison";
  executedAt: string;
  passed: boolean | null;
  totalCases: number | null;
  passedCases: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  throughput: number | null;
  errorRate: number | null;
  cpuPercent: number | null;
  memoryMb: number | null;
};

type ExperimentData = {
  summary: {
    totalRuns: number;
    securityRuns: number;
    functionalRuns: number;
    performanceRuns: number;
    lastExecutedAt?: string | null;
  };
  history: ExperimentRun[];
  latest: ExperimentRun[];
};

type SyncResult = {
  sync: { imported: number; unchanged: number; rejected: Array<{ file: string; reason: string }> };
  dashboard: ExperimentData;
};

const runLabels: Record<ExperimentRun["runType"], string> = {
  security: "Bảo mật (OWASP)",
  functional: "Nghiệp vụ (E2E)",
  performance: "Hiệu năng (k6)"
};

const modeLabels: Record<ExperimentRun["mode"], string> = {
  baseline: "Baseline",
  secure: "Secure",
  comparison: "Đối chiếu"
};

export function ExperimentDashboard() {
  const { notify } = useToast();
  const [data, setData] = useState<ExperimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api<ExperimentData>("/api/admin/experiments");
      setData(result.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải dữ liệu thực nghiệm.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function syncReports() {
    if (syncing) return;
    setSyncing(true);
    setError("");
    try {
      const result = await api<SyncResult>("/api/admin/experiments/sync", { method: "POST" });
      setData(result.data.dashboard);
      const rejected = result.data.sync.rejected.length;
      notify({
        tone: rejected > 0 ? "info" : "success",
        title: `Đã nạp ${result.data.sync.imported} kết quả mới vào SQL Server`,
        message: `${result.data.sync.unchanged} báo cáo đã tồn tại${rejected ? ` · ${rejected} tệp bị từ chối` : ""}.`
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể đồng bộ báo cáo.");
    } finally {
      setSyncing(false);
    }
  }

  const performance = useMemo(() => ({
    baseline: data?.latest.find((run) => run.runType === "performance" && run.mode === "baseline"),
    secure: data?.latest.find((run) => run.runType === "performance" && run.mode === "secure")
  }), [data]);

  if (loading && !data) {
    return (
      <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-12 text-center text-xs font-mono text-[#8c8275]">
        Đang nạp dữ liệu thực nghiệm từ cơ sở dữ liệu…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border border-rose-900/60 bg-rose-950/40 text-rose-300 p-6 rounded-lg text-xs font-mono">
        {error || "Không có dữ liệu thực nghiệm."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#231e1a]">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#c8a94d]/10 text-[#c8a94d] border border-[#c8a94d]/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              BENCHMARK & LOAD TESTING
            </span>
            <span className="text-xs text-[#8c8275] font-mono font-medium">· K6 + Docker Stats</span>
          </div>
          <h1 className="font-display text-3xl text-[#ede7dc] font-normal tracking-tight">
            Trung tâm đo tải & Thực nghiệm
          </h1>
          <p className="text-sm text-[#8c8275] mt-1.5 leading-relaxed">
            Đánh giá khoa học sự đánh đổi hiệu năng (Performance Trade-off) và lưu trữ lịch sử kiểm thử bất biến trong SQL Server.
          </p>
        </div>

        <button
          onClick={() => void syncReports()}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#16120f] border border-[#2b2520] hover:border-[#c8a94d] text-[#c8a94d] rounded text-xs font-mono font-medium transition-all shadow-sm disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          {syncing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Đang đồng bộ báo cáo…</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Đồng bộ báo cáo mới nhất</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="border border-rose-900/60 bg-rose-950/40 text-rose-300 text-xs px-4 py-3 rounded font-mono">
          {error}
        </div>
      )}

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-5 shadow-sm">
          <div className="text-[10px] text-[#8c8275] font-mono font-medium uppercase tracking-wider mb-2">TỔNG LƯỢT CHẠY</div>
          <div className="font-display text-3xl font-normal text-[#ede7dc] mb-1">{data.summary.totalRuns}</div>
          <div className="text-xs text-[#b5a99b] font-mono">
            {data.summary.lastExecutedAt ? `Gần nhất: ${dateTime.format(new Date(data.summary.lastExecutedAt))}` : "Chưa thực thi"}
          </div>
        </div>

        <div className="bg-[#120f0d] border border-emerald-500/30 rounded-lg p-5 shadow-sm">
          <div className="text-[10px] text-emerald-400 font-mono font-medium uppercase tracking-wider mb-2">BẢO MẬT (SECURITY)</div>
          <div className="font-display text-3xl font-normal text-emerald-400 mb-1">{data.summary.securityRuns}</div>
          <div className="text-xs text-[#b5a99b] font-mono">10 kịch bản đối chiếu OWASP</div>
        </div>

        <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-5 shadow-sm">
          <div className="text-[10px] text-[#c8a94d] font-mono font-medium uppercase tracking-wider mb-2">NGHIỆP VỤ (FUNCTIONAL)</div>
          <div className="font-display text-3xl font-normal text-[#c8a94d] mb-1">{data.summary.functionalRuns}</div>
          <div className="text-xs text-[#b5a99b] font-mono">Luồng giỏ hàng, đặt và hủy đơn</div>
        </div>

        <div className="bg-[#120f0d] border border-amber-500/30 rounded-lg p-5 shadow-sm">
          <div className="text-[10px] text-amber-400 font-mono font-medium uppercase tracking-wider mb-2">HIỆU NĂNG (K6 BENCHMARK)</div>
          <div className="font-display text-3xl font-normal text-amber-400 mb-1">{data.summary.performanceRuns}</div>
          <div className="text-xs text-[#b5a99b] font-mono">Đo tải Baseline vs Secure</div>
        </div>
      </div>

      {data.history.length === 0 ? (
        <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-[#1a1613] border border-[#2b2520] flex items-center justify-center mx-auto mb-4 text-[#c8a94d]">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="font-display text-xl text-[#ede7dc] font-normal mb-2">Chưa có bản ghi thực nghiệm nào</h3>
          <p className="text-sm text-[#8c8275] max-w-md mx-auto mb-4 leading-relaxed">
            Hãy chạy script thực nghiệm để sinh các tệp đo đạc tải và kiểm tra an ninh, sau đó nhấn nút "Đồng bộ báo cáo mới nhất" ở trên.
          </p>
          <code className="text-xs font-mono text-[#c8a94d] bg-[#0e0c0a] px-4 py-2 rounded border border-[#2b2520] inline-block">
            powershell -ExecutionPolicy Bypass -File .\scripts\run-experiments.ps1
          </code>
        </div>
      ) : (
        <>
          {/* Performance Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PerformanceComparison baseline={performance.baseline} secure={performance.secure} />
            <LatestEvidence values={data.latest.filter((run) => run.runType !== "performance")} />
          </div>

          {/* Execution History Table */}
          <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#231e1a] flex items-center justify-between bg-[#16120f]">
              <div>
                <h3 className="font-display text-lg text-[#ede7dc] font-normal">Lịch sử thực nghiệm lưu trữ trong SQL Server</h3>
                <p className="text-xs text-[#8c8275] mt-0.5">Bản ghi chống trùng lặp dữ liệu, phục vụ minh chứng bảo vệ đồ án.</p>
              </div>
              <span className="text-xs font-mono font-medium text-[#c8a94d] bg-[#0e0c0a] px-3 py-1 rounded border border-[#2b2520]">
                100 lượt gần nhất
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#231e1a] bg-[#16120f] text-xs font-mono uppercase tracking-wider text-[#8c8275] font-medium">
                    <th className="px-6 py-3.5">Thời gian</th>
                    <th className="px-6 py-3.5">Bộ test</th>
                    <th className="px-6 py-3.5">Phiên bản</th>
                    <th className="px-6 py-3.5">Kết quả</th>
                    <th className="px-6 py-3.5">p50 / p95</th>
                    <th className="px-6 py-3.5">Throughput</th>
                    <th className="px-6 py-3.5">CPU / RAM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1915] font-mono">
                  {data.history.map((run) => (
                    <tr key={run.id} className="hover:bg-[#181411] transition-colors">
                      <td className="px-6 py-3.5 text-[#b5a99b] whitespace-nowrap">
                        {dateTime.format(new Date(run.executedAt))}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-[#ede7dc]">
                        {runLabels[run.runType]}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          run.mode === "secure" ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50" : "bg-rose-950/60 text-rose-300 border border-rose-700/50"
                        }`}>
                          {modeLabels[run.mode]}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <RunOutcome run={run} />
                      </td>
                      <td className="px-6 py-3.5 text-[#ede7dc]">
                        {run.p50Ms === null ? "—" : `${formatMetric(run.p50Ms)} / ${formatMetric(run.p95Ms)} ms`}
                      </td>
                      <td className="px-6 py-3.5 text-[#ede7dc]">
                        {run.throughput === null ? "—" : `${formatMetric(run.throughput)} req/s`}
                      </td>
                      <td className="px-6 py-3.5 text-[#8c8275]">
                        {run.cpuPercent === null && run.memoryMb === null
                          ? "Chưa đo"
                          : `${formatMetric(run.cpuPercent)}% / ${formatMetric(run.memoryMb)} MB`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RunOutcome({ run }: { run: ExperimentRun }) {
  if (run.passed === null) {
    return <span className="text-xs font-mono text-[#8c8275]">Chưa đủ metric</span>;
  }
  const detail = run.totalCases === null ? "" : ` (${run.passedCases ?? 0}/${run.totalCases})`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium ${
        run.passed
          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50"
          : "bg-rose-950/60 text-rose-300 border border-rose-700/50"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${run.passed ? "bg-emerald-400" : "bg-rose-400"}`} />
      {run.passed ? "ĐẠT" : "CHƯA ĐẠT"}
      {detail}
    </span>
  );
}

function PerformanceComparison({ baseline, secure }: { baseline?: ExperimentRun; secure?: ExperimentRun }) {
  const runs = [baseline, secure].filter((run): run is ExperimentRun => Boolean(run));
  const maxP95 = Math.max(...runs.map((run) => Number(run.p95Ms ?? 0)), 1);

  return (
    <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono text-[#c8a94d] uppercase tracking-wider font-medium">K6 Benchmark gần nhất</div>
          <h3 className="font-display text-lg text-[#ede7dc] font-normal">So sánh độ trễ Baseline vs Secure</h3>
        </div>
        <span className="text-xs font-mono text-[#b5a99b] bg-[#0e0c0a] px-3 py-1 rounded border border-[#2b2520]">
          Ngưỡng p95 &lt; 500 ms
        </span>
      </div>

      {runs.length < 2 ? (
        <p className="text-xs text-[#8c8275] font-mono py-8 text-center">
          Cần thực hiện k6 load test cho cả 2 phiên bản để hiển thị biểu đồ so sánh.
        </p>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => {
            const isSecure = run.mode === "secure";
            const percent = Math.min(100, Math.max(8, (Number(run.p95Ms ?? 0) / maxP95) * 100));

            return (
              <div key={run.mode} className="space-y-2.5 p-4 bg-[#0e0c0a] rounded border border-[#231e1a]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className={`font-bold text-sm ${isSecure ? "text-emerald-400" : "text-rose-400"}`}>
                    {modeLabels[run.mode]}
                  </span>
                  <span className="text-[#ede7dc] font-bold text-sm">
                    {formatMetric(run.p95Ms)} ms <span className="text-[#8c8275] font-normal text-xs">(p95)</span>
                  </span>
                </div>

                <div className="w-full bg-[#1c1714] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                      isSecure ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#8c8275] font-mono pt-1">
                  <span>p50: <strong className="text-[#ede7dc]">{formatMetric(run.p50Ms)} ms</strong></span>
                  <span>Throughput: <strong className="text-[#ede7dc]">{formatMetric(run.throughput)} req/s</strong></span>
                  <span>Lỗi: <strong className={Number(run.errorRate) > 0 ? "text-rose-400" : "text-emerald-400"}>{formatMetric((run.errorRate ?? 0) * 100)}%</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#8c8275] font-mono leading-relaxed pt-3 border-t border-[#231e1a]">
        * Dữ liệu CPU trung bình và RAM đỉnh được tự động lấy mẫu qua Docker Stats khi thực thi script PowerShell.
      </p>
    </div>
  );
}

function LatestEvidence({ values }: { values: ExperimentRun[] }) {
  return (
    <div className="bg-[#120f0d] border border-[#231e1a] rounded-lg p-6 space-y-5 shadow-sm">
      <div>
        <div className="text-[10px] font-mono text-[#c8a94d] uppercase tracking-wider font-medium">Trạng thái xác minh</div>
        <h3 className="font-display text-lg text-[#ede7dc] font-normal">Bảo vệ & Nghiệp vụ gần nhất</h3>
      </div>

      {values.length === 0 ? (
        <p className="text-xs text-[#8c8275] font-mono py-8 text-center">
          Chưa có lượt chạy kiểm thử bảo mật hoặc nghiệp vụ nào được nạp.
        </p>
      ) : (
        <div className="space-y-4">
          {values.map((run) => {
            const completion = run.totalCases ? Math.round(((run.passedCases ?? 0) / run.totalCases) * 100) : null;
            const isPassed = run.passed;

            return (
              <div key={`${run.runType}-${run.mode}`} className="p-4 bg-[#0e0c0a] rounded border border-[#231e1a] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#ede7dc] text-sm">{runLabels[run.runType]} ({modeLabels[run.mode]})</span>
                  <span className={isPassed ? "text-emerald-400 font-bold text-sm" : "text-amber-400 font-bold text-sm"}>
                    {completion === null ? "—" : `${completion}%`}
                  </span>
                </div>

                <div className="w-full bg-[#1c1714] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                      isPassed ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${completion ?? 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#8c8275] font-mono pt-1">
                  <span>{run.totalCases === null ? "Chưa có số ca" : `${run.passedCases ?? 0}/${run.totalCases} ca kiểm thử đạt`}</span>
                  <span className="text-[#b5a99b]">{dateTime.format(new Date(run.executedAt))}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatMetric(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value));
}
