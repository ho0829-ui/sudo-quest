import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages는 저장소 이름이 경로에 붙는다(/repo-name/).
  // 상대 경로로 빌드하면 저장소 이름을 몰라도 그대로 동작한다.
  base: "./",
  build: {
    rollupOptions: {
      output: {
        // react·react-dom은 거의 바뀌지 않는다. 따로 두면 앱만 다시 배포해도 브라우저 캐시를 그대로 쓴다.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react-vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": loadEnv(mode, ".", "BACKEND_").BACKEND_PROXY_TARGET || "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "node", // 엔진은 브라우저가 필요 없다
    include: ["tests/**/*.test.ts"],
  },
}));
