// static/sandbox_injector.js
// 🛑 [JS OFF] 샌드박스 주입 모드 완전 비활성화 (백엔드 파이프라인 직접 주입 체제 가동)

import { store } from "./_store.js";

let isSandboxActive = false;

export async function toggleSandboxMode(forceState) {
  console.log("[SANDBOX] 🛑 샌드박스 모드가 비활성화되어 있습니다 (백엔드 직접 주입 체제 가동 중).");
  return;
}

if (typeof window !== "undefined") {
  window.toggleSandboxMode = toggleSandboxMode;
  window.isSandboxActive = () => false;
}
