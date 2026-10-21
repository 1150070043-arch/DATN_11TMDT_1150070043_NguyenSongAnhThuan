export function AsyncState({ error, onRetry, label = "Đang tải…" }: {
  error?: string;
  onRetry?: () => void;
  label?: string;
}) {
  return <div className="min-h-[50vh] pt-32 pb-16 px-6 flex flex-col items-center justify-center gap-4 text-center">
    <p role={error ? "alert" : "status"} className="text-base">{error || label}</p>
    {error && onRetry && <button type="button" onClick={onRetry} className="btn-gold px-6 py-3 rounded-sm text-[#0b0907] font-semibold">Thử lại</button>}
  </div>;
}
