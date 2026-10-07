export function ModeStrip() {
  const mode = import.meta.env.VITE_SECURITY_MODE ?? "secure";
  return (
    <div className={`mode-strip mode-strip--${mode}`} role={mode === "baseline" ? "alert" : "status"}>
      <div className="container d-flex justify-content-between align-items-center gap-3">
        <span>
          <strong>{mode === "baseline" ? "BASELINE LAB" : "SECURE"}</strong>
          <span className="ms-2 d-none d-sm-inline">
            {mode === "baseline"
              ? "Môi trường cố ý có lỗ hổng, chỉ dùng cho thực nghiệm."
              : "Hệ thống đã áp dụng mô hình bảo mật nhiều lớp."}
          </span>
        </span>
        <span className="mode-dot" aria-hidden="true" />
      </div>
    </div>
  );
}
