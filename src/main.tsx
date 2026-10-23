import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* 마지막 안전망: App 바깥(레일·상단 바 포함)에서 난 오류도 흰 화면 대신 안내로 보인다. */}
    <ErrorBoundary label="앱">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
