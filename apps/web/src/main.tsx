import React from "react";
import ReactDOM from "react-dom/client";
import "./design/reference.css";
import "./design/integration.css";
import "./design/storefront.css";
import "./design/readability.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
