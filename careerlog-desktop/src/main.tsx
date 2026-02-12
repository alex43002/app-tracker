import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { loadAuthToken } from "./store/auth";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

try {
  loadAuthToken();
} catch (err) {
  console.error("Failed to load auth token:", err);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
