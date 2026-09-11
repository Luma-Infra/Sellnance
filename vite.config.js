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
    rollupOptions: {
      input: {
        // 엔트리 포인트 경로 설정
        main: resolve(__dirname, "templates/index.html"),
      },
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("node_modules")) {
            return "vendor";
          }
          if (
            normalizedId.includes("/static/chart") ||
            normalizedId.includes("/static/sim_engine")
          ) {
            return "c1";
          }
          if (
            normalizedId.includes("/static/stream") ||
            normalizedId.includes("/static/feed_") ||
            normalizedId.includes("/static/orderbook")
          ) {
            return "c2";
          }
          if (normalizedId.includes("/static/table")) {
            return "c3";
          }
          if (
            normalizedId.includes("/static/ui_") ||
            normalizedId.includes("/static/quickview") ||
            normalizedId.includes("/static/start")
          ) {
            return "c4";
          }
        },
      },
    },
  },
});
