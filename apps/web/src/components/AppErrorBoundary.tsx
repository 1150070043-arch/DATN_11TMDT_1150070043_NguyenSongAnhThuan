import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { hasError: boolean; incidentId: string };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, incidentId: "" };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      incidentId: `UI-${Date.now().toString(36).toUpperCase()}`
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("bookguard_ui_error", {
      incidentId: this.state.incidentId,
      name: error.name,
      message: error.message,
      componentStack: info.componentStack
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="error-boundary-page">
        <section className="error-boundary-card" role="alert">
          <div className="error-boundary-mark" aria-hidden="true">!</div>
          <div className="eyebrow">Giao diện vừa gặp sự cố</div>
          <h1>Trang này chưa thể hiển thị</h1>
          <p>Dữ liệu của bạn chưa bị thay đổi. Hãy tải lại trang; nếu lỗi lặp lại, gửi mã sự cố bên dưới cho người quản trị.</p>
          <code>{this.state.incidentId}</code>
          <div className="error-boundary-actions">
            <button className="btn btn-accent" type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
            <button className="btn btn-outline-dark" type="button" onClick={() => window.location.assign("/")}>Về cửa hàng</button>
          </div>
        </section>
      </main>
    );
  }
}
