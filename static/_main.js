// _main.js
// 🏛️ Sellnance Main Entry Point

import { store } from "./_store.js";
import {
  searchSymbols,
  clearSearch,
  selectSymbol,
} from "./ui_control.js";

// 하위 서브시스템 등록
import "./ui_dialog.js";
import "./_market_rules.js";
import "./chart_layout.js";
import "./chart_timezone.js";
import "./sim_engine.js";
import "./stream.js";
import "./table.js";
import "./start.js";
import "./quickview.js";

// 분리된 3대 모듈
import {
  getKrwPrecision,
  updateHeaderDisplay,
  toggleHeaderTop,
} from "./header_display.js";

import {
  setupSliderEvents,
  setupButtonEvents,
  setupSearchNavigation,
  initGlobalEventListeners,
} from "./main_events.js";

import {
  restoreSavedUserSettings,
  initDashboardEngine,
  updateStatusBadge,
  startPerformanceDebugger,
  setupRouteAndHistory,
  scheduleDailyReset,
  setupTabVisibilityRecovery,
} from "./main_init.js";

// 🚀 전역 store 및 헬퍼 바인딩
window.store = store;
window.searchSymbols = searchSymbols;
window.clearSearch = clearSearch;
window.selectSymbol = selectSymbol;
window.getKrwPrecision = getKrwPrecision;
window.updateHeaderDisplay = updateHeaderDisplay;
window.toggleHeaderTop = toggleHeaderTop;

// 🚀 DOM 로드 완료 시 사용자 설정 복원
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    restoreSavedUserSettings();
    if (typeof window.restoreControlPanelUI === "function") {
      window.restoreControlPanelUI();
    }
  });
} else {
  restoreSavedUserSettings();
  if (typeof window.restoreControlPanelUI === "function") {
    window.restoreControlPanelUI();
  }
}

// 🚀 UI 인터랙션 및 전역 이벤트 리스너 바인딩
setupSliderEvents();
setupButtonEvents();
setupSearchNavigation();
initGlobalEventListeners();

// 🚀 성능 디버거 및 상태 뱃지 타이머 시작
startPerformanceDebugger();
setInterval(updateStatusBadge, 1000);

// 🚀 초기 라우트 / 히스토리 및 정밀 타이머 가동
setupRouteAndHistory();
scheduleDailyReset();
setupTabVisibilityRecovery();

// 🚀 초기 필터 UI 상태 동기화 (3단 토글 슬라이더 위치 등)
if (typeof window.switchFilter === "function") {
  window.switchFilter(store.filterMode);
}

// 📱 PWA Service Worker 등록 (설치 안내 프롬프트는 임시 비활성화)
// import { initPwaInstallPrompt } from "./pwa_install.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/static/sw.js")
      .then((reg) => console.log("✅ PWA SW registered:", reg.scope))
      .catch((err) => console.warn("PWA SW registration failed:", err));

    // PWA 설치 모달 비활성화 (주석 처리)
    // initPwaInstallPrompt();
  });
} else {
  // initPwaInstallPrompt();
}
