// main_init.js
// 🚀 대시보드 엔진 초기화, 사용자 세팅 복원, 라우팅, 디버거 및 자정 리셋 스케줄러

import { store } from "./_store.js";
import { loadSymbols } from "./chart_api.js";
import { selectSymbol, switchViewMode } from "./ui_control.js";
import { initChart } from "./chart.js";
import { initSniperSocket } from "./stream_table.js";
import { initMeasureEvents } from "./chart_measure.js";
import { initDrawingEvents, initDrawingToolbar } from "./chart_draw.js";
import { initOrderbookDOM } from "./orderbook.js";
import { restoreThemeSettings } from "./theme_manager.js";

// 🚀 [로고 이미지 폴백 엔진] 깨진 코인 로고를 감지하여 테마별 루마 디어 svg로 자동 치환
export function handleLogoError(img) {
  if (!img || img._fallbackApplied) return;
  img._fallbackApplied = true;
  img.classList.add("fallback-logo");
  const isUpbitTheme = document.body.classList.contains("theme-upbit");
  img.src = isUpbitTheme
    ? "/static/luma-deer-svg-light.svg"
    : "/static/luma-deer-svg-dark.svg";
}
window.handleLogoError = handleLogoError;

// 캡처링 단계에서 모든 동적/정적 <img>의 로드 실패를 즉시 가로채기
window.addEventListener(
  "error",
  (e) => {
    if (e.target && e.target.tagName === "IMG") {
      const img = e.target;
      if (
        img.src.includes("coinmarketcap.com/static/img/coins") ||
        img.closest(".col-asset") ||
        img.closest("#head-asset-name")
      ) {
        handleLogoError(img);
      }
    }
  },
  true,
);

// 🚀 사용자의 테마, 사이드바, 테이블 뷰 모드 설정을 로컬 저장소로부터 복원하는 함수
export function restoreSavedUserSettings() {
  try {
    // 1. 테마 및 컬러 모드 복원
    restoreThemeSettings();

    // 2. 사이드바 폴딩 상태 복원
    const isSidebarCollapsed =
      localStorage.getItem("sellnance_sidebar_collapsed") === "true";
    if (isSidebarCollapsed) {
      store.isSidebarOpen = false;
      const leftPanel = document.getElementById("left-panel");
      if (leftPanel) {
        leftPanel.classList.remove("md:flex");
        leftPanel.classList.add("md:hidden");
      }
      const toggleText = document.getElementById("sidebar-toggle-text");
      if (toggleText) toggleText.innerText = "▶ 펼치기";
    }

    // 3. 차트 헤더 폴딩 상태 복원
    const isHeaderCollapsed =
      localStorage.getItem("sellnance_header_collapsed") === "true";
    if (isHeaderCollapsed) {
      const assetRow = document.getElementById("head-asset-row");
      const infoRow = document.getElementById("head-info-row");
      const badgesRow = document.getElementById("head-badges-row");
      const btn = document.getElementById("toggle-header-top-btn");

      const elements = [assetRow, infoRow, badgesRow];
      elements.forEach((el) => {
        if (el) {
          el.style.display = "none";
          el.classList.add("hidden");
        }
      });
      if (btn) btn.innerText = "▼ 헤더 펼치기";
    }

    // 4. 좌우 패널 스왑 상태 복원
    const isPanelSwapped =
      localStorage.getItem("sellnance_panel_swapped") === "true";
    if (isPanelSwapped) {
      const container = document.getElementById("panel-split-container");
      if (container) {
        container.classList.remove("md:flex-row");
        container.classList.add("md:flex-row-reverse");
      }
    }

    // 5. 테이블 상세/간편 뷰 모드 복원
    const isMobile = window.innerWidth < 1200;
    const savedViewMode = isMobile
      ? "simple"
      : localStorage.getItem("sellnance_table_view_mode") || "basic";
    if (typeof switchViewMode === "function") {
      switchViewMode(savedViewMode);
    }

    // 6. 세션에 저장된 컨트롤 패널 UI 즉시 복원
    if (typeof window.restoreControlPanelUI === "function") {
      window.restoreControlPanelUI();
    }

    // 7. 차트 캔들 색상 버튼 상태 복원
    if (typeof window.updateCandleThemeButtons === "function") {
      window.updateCandleThemeButtons();
    }
  } catch (e) { }
}

let _isDashboardEngineStarted = false;

export async function initDashboardEngine() {
  if (_isDashboardEngineStarted) return;
  _isDashboardEngineStarted = true;

  restoreSavedUserSettings();
  if (typeof window.restoreControlPanelUI === "function") {
    window.restoreControlPanelUI();
  }
  if (typeof initOrderbookDOM === "function") initOrderbookDOM();

  try {
    // 1️⃣ [차트 선제 점화]
    if (typeof window.initChart === "function") await window.initChart();
    else if (typeof initChart === "function") await initChart();

    // 2️⃣ [병렬 데이터 로드]
    await Promise.all([
      loadSymbols(),
      typeof window.loadTableData === "function" ? window.loadTableData() : Promise.resolve(),
    ]);

    // 3️⃣ [엔진 준비]
    if (store.currentTableData && store.currentTableData.length > 0) {
      initMeasureEvents();
      initDrawingEvents();
      initDrawingToolbar();
      if (typeof window.initInfiniteScroll === "function") window.initInfiniteScroll();
      if (typeof window.initAllExchangeFeeds === "function") {
        window.initAllExchangeFeeds();
      }

      store.isEngineStarted = true;
      initSniperSocket();
    }
  } catch (err) {
    console.error("Dashboard engine init error:", err);
  }
}
window.initDashboardEngine = initDashboardEngine;

// 🚀 [신규] 브라우저 로컬 타이머 루프 구동 (서버 부하 0%)
export function updateStatusBadge() {
  const timerEl = document.getElementById("status-timer");
  const usersEl = document.getElementById("status-users");
  if (!timerEl || !usersEl) return;

  const users = store.activeUsers || 1;
  usersEl.innerText = `${users} Active`;

  if (!store.lastUpdatedRaw) {
    timerEl.innerText = "--:--:-- 이후 시가총액 갱신";
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const hasKey =
    localStorage.getItem("CMC_API_KEY") &&
    localStorage.getItem("CMC_API_KEY").trim() !== "";
  const interval = hasKey ? 900 : 86400;
  const nextUpdate = Math.floor(store.lastUpdatedRaw) + interval;
  let diff = Math.floor(nextUpdate - now);

  if (diff < 0) {
    timerEl.innerText = hasKey
      ? "수집 완료 대기 중..."
      : "일일 수집 대기 중...";
    return;
  }

  const tooltip = document.getElementById("status-cache-tooltip");
  const dot = document.getElementById("status-timer-dot");

  if (hasKey) {
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    const formattedTime = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    timerEl.innerText = `${formattedTime} 이후 시가총액 갱신`;
    timerEl.title = "";
    timerEl.style.cursor = "default";
    if (dot)
      dot.className =
        "inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
    if (tooltip) tooltip.style.display = "none";
  } else {
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    const formattedTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    timerEl.innerText = `⚠️ ${formattedTime} (일일 캐시)`;
    timerEl.title = "";
    timerEl.style.cursor = "default";
    if (dot)
      dot.className =
        "inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse";
    if (tooltip) tooltip.style.display = "block";
  }
}
window.updateStatusBadge = updateStatusBadge;

// 🚀 [신규] 1초마다 성능 디버거 통계 수치 갱신
export function updatePerformanceDebugger() {
  if (!store.bypassCounters) return;
  const total = Object.values(store.bypassCounters).reduce((a, b) => a + b, 0);

  const totalEl = document.getElementById("perf-total-bypass");
  if (totalEl) totalEl.innerText = `Total: ${total}`;

  const keys = [
    "leftDom",
    "tabScroll",
    "tableUpdate",
    "kimchi",
    "radarBatch",
    "mouseEvent",
    "dynamicHtml",
    "throttleBypass",
    "throttlePass",
  ];
  keys.forEach((k) => {
    const el = document.getElementById(`bypass-cnt-${k}`);
    if (el) el.textContent = store.bypassCounters[k] || 0;
  });

  const riskEl = document.getElementById("perf-top-risk-analysis");
  if (riskEl) {
    let maxVal = -1;
    let maxKey = "NONE";
    Object.entries(store.bypassCounters).forEach(([k, v]) => {
      if (v > maxVal) {
        maxVal = v;
        maxKey = k;
      }
    });

    if (maxVal === 0) {
      riskEl.innerText = "안정 (소켓 수급 정체 혹은 렉 유발 없음)";
      riskEl.className =
        "text-[8.5px] font-semibold text-emerald-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans";
    } else {
      const labelMap = {
        leftDom: "좌측 테이블 DOM 최적화 차단",
        chartDom: "우측 차트 렌더러 지연 차단",
        orderbook: "실시간 호가창 렌더링 락",
        legend: "상단 가격 레전드 문자열 덮어쓰기",
        resize: "차트 리사이즈 오버헤드",
        mouseEvent: "차트 십자선 마우스 이벤트 지연",
        sort: "테이블 실시간 순위 재배치 루프",
        tabScroll: "테이블 전체 리렌더링 리플로우",
        tableUpdate: "개별 행 셀 텍스트 갱신 과부하",
        kimchi: "3초 주기 김프 연산 전파 루프",
        radarBatch: "3초 레이더 일괄 갱신 차단",
        dynamicHtml: "김프 전파 HTML 동적 렌더링 과부하",
      };
      riskEl.innerText = `⚠️ ${labelMap[maxKey] || maxKey} (${maxVal}회 Bypass)`;
      riskEl.className =
        "text-[8.5px] font-semibold text-rose-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans";
    }
  }
}
window.updatePerformanceDebugger = updatePerformanceDebugger;

let perfIntervalId = null;
let perfDebugStartTime = null;

export function startPerformanceDebugger() {
  if (perfIntervalId) clearInterval(perfIntervalId);
  perfDebugStartTime = Date.now();
  if (store.bypassCounters) {
    Object.keys(store.bypassCounters).forEach((k) => {
      store.bypassCounters[k] = 0;
    });
  }

  const timeEl = document.getElementById("perf-run-time-display");
  if (timeEl) timeEl.innerText = "(0s 경과)";

  updatePerformanceDebugger();
  perfIntervalId = setInterval(() => {
    if (perfDebugStartTime) {
      const elapsed = Math.floor((Date.now() - perfDebugStartTime) / 1000);
      const timeDisplay = document.getElementById("perf-run-time-display");
      if (timeDisplay) timeDisplay.innerText = `(${elapsed}s 경과)`;
    }
    updatePerformanceDebugger();
  }, 1000);
}
window.startPerformanceDebugger = startPerformanceDebugger;

export function stopPerformanceDebugger() {
  if (perfIntervalId) {
    clearInterval(perfIntervalId);
    perfIntervalId = null;
  }
}
window.stopPerformanceDebugger = stopPerformanceDebugger;

// 🚀 URL 경로(/BTC) 또는 해시(#BTC) 기반 자동 렌더링 도우미
export function getInitialRouteSymbol() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const reserved = ["api", "static", "assets", "index.html", "favicon.ico"];
  if (path && !reserved.includes(path.toLowerCase())) {
    return decodeURIComponent(path);
  }
  if (window.location.hash && window.location.hash.length > 1) {
    return decodeURIComponent(window.location.hash.substring(1));
  }
  return null;
}
window.getInitialRouteSymbol = getInitialRouteSymbol;

// 🚀 프론트엔드 정밀 타이머 리셋 (매일 오전 9시 정각 KST)
export function scheduleDailyReset() {
  const now = new Date();
  const nextReset = new Date();
  nextReset.setUTCHours(0, 0, 0, 0);

  if (now >= nextReset) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  const timeUntilReset = nextReset.getTime() - now.getTime();

  setTimeout(() => {
    const rate = store.marketDataMap?.krw_usd_rate || 0;
    if (store.currentTableData && Array.isArray(store.currentTableData)) {
      store.currentTableData.forEach((row) => {
        if (row.Binance_Price_Futures || row.Price_Raw) {
          row.futures_utc0_open_Raw = row.Binance_Price_Futures || row.Price_Raw;
        }
        if (row.Binance_Price_Spot || row.Price_Raw) {
          row.spot_utc0_open_Raw = row.Binance_Price_Spot || row.Price_Raw;
        }
        if (row.Price_KRW || (row.Price_Raw && rate > 0)) {
          row.utc0_open_KRW = row.Price_KRW || (row.Price_Raw * rate);
        }
        if (row.Price_Raw) {
          row.utc0_open_Raw = row.Price_Raw;
        }

        row.Change_Today_Raw = 0;
        row.Change_Today_Futures = 0;
        row.Change_Today_Spot = 0;
        row.Change_Today_Binance = 0;
        row.Change_Today_Upbit = 0;
        row.Change_Today_Bithumb = 0;
        row.Change_Today_Bybit = 0;
      });

      if (typeof window.renderTable === "function") window.renderTable();
    }

    if (store.currentAsset && typeof window.selectSymbol === "function") {
      window.selectSymbol(store.currentAsset);
    }

    setTimeout(() => {
      if (typeof window.loadTableData === "function") {
        window.loadTableData(true, true);
      }
    }, 2000);

    scheduleDailyReset();
  }, timeUntilReset);
}

// 🚀 라우팅 및 탭 히스토리 초기화
export function setupRouteAndHistory() {
  try {
    const lastTF = localStorage.getItem("sellnance_last_tf");
    if (
      lastTF &&
      [
        "1m",
        "3m",
        "5m",
        "15m",
        "30m",
        "1h",
        "4h",
        "12h",
        "1d",
        "3d",
        "1w",
        "1M",
      ].includes(lastTF)
    ) {
      store.currentTF = lastTF;
    }
  } catch (e) { }

  const initialRouteSym = getInitialRouteSymbol();
  if (initialRouteSym) {
    if (typeof selectSymbol === "function") {
      selectSymbol(initialRouteSym);
    }
  }

  const handleHistoryNavigation = () => {
    const routeSym = getInitialRouteSymbol();
    if (routeSym && typeof selectSymbol === "function") {
      selectSymbol(routeSym);
    }
  };
  window.addEventListener("popstate", handleHistoryNavigation);
  window.addEventListener("hashchange", handleHistoryNavigation);
}

// 🔄 [장기 방치 자가치유]
export function setupTabVisibilityRecovery() {
  let tabHiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      tabHiddenAt = Date.now();
    } else if (document.visibilityState === "visible") {
      const elapsed = Date.now() - tabHiddenAt;
      if (tabHiddenAt > 0 && elapsed > 30 * 60 * 1000) {
        if (typeof window.refreshSniperTarget === "function") {
          window.refreshSniperTarget();
        }
        if (typeof window.loadTableData === "function") {
          window.loadTableData(false, true);
        }
      }
      tabHiddenAt = 0;
    }
  });
}
