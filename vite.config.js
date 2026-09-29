import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from "path";

// ESM 환경에서 __dirname을 안전하게 가져오는 방법
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // index.html이 들어있는 폴더
  root: "templates",
  // 정적 자산(favicon, svg 등)이 들어있는 폴더
  publicDir: "../public",
  resolve: {
    alias: {
      "/static": resolve(__dirname, "static"),
      "../static": resolve(__dirname, "static"),
    },
  },
  build: {
    // 빌드 결과물을 프로젝트 루트의 dist 폴더로 전송
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    // [최적화] 모든 형태(한 줄, 여러 줄, JSDoc, 라이선스)의 주석 및 디버거/로그 제거
    esbuild: {
      legalComments: "none",
      drop: ["debugger"],
      pure: ["console.log", "console.debug", "console.info"],
    },
    rollupOptions: {
      input: {
        // 엔트리 포인트 경로 설정
        ma100: resolve(__dirname, "templates/index.html"),
      },
      output: {
        entryFileNames: "assets/ap120-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("node_modules")) {
            return "vendor";
          }
          // 1. 차트 엔진 (가장 무겁고 독립적인 렌더링 레이어)
          if (
            normalizedId.includes("/static/chart") ||
            normalizedId.includes("/static/sim_engine")
          ) {
            return "ch120";
          }
          // 2. 실시간 시세 & 테이블 파이프라인 (유기적으로 결합된 단일 스트림)
          if (
            normalizedId.includes("/static/stream") ||
            normalizedId.includes("/static/feed_") ||
            normalizedId.includes("/static/orderbook") ||
            normalizedId.includes("/static/table")
          ) {
            return "ma140";
          }
          // 3. UI 및 퀵뷰 레이어
          if (
            normalizedId.includes("/static/ui_") ||
            normalizedId.includes("/static/quickview") ||
            normalizedId.includes("/static/start")
          ) {
            return "uc160";
          }
        },
      },
    },
  },
});
