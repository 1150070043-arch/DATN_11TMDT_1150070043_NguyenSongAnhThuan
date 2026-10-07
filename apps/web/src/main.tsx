import React from "react";
import ReactDOM from "react-dom/client";
import "./design/legacy-scoped.css";
import "./design/reference.css";
import "./design/integration.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
