import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages는 저장소 이름이 경로에 붙는다(/repo-name/).
  // 상대 경로로 빌드하면 저장소 이름을 몰라도 그대로 동작한다.
  base: "./",
  test: {
    environment: "node", // 엔진은 브라우저가 필요 없다
    include: ["tests/**/*.test.ts"],
  },
});
