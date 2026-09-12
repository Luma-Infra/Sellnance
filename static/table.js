// table.js
// --- ⭐️ 테이블 통합 진입점 (Entry Point) ⭐️ ---
import { store, CONFIG } from "./_store.js";
import { loadTableData, loadTableDataSilent } from "./table_api.js";
import {
  renderTable,
  createRowElement,
  updateRowInnerHTML,
  applySelectedHighlight,
  initInfiniteScroll,
  toggleFavorite,
  applyPriceFlash,
  updateVisibleSymbols,
  updateHeaderStar,
} from "./table_render.js";
import { sortTable, applyRealtimeSort } from "./table_sort.js";
import {
  switchTab,
  switchFilter,
  switchView,
  toggleCurrency,
  setCurrencyMode,
  updateCurrencyUI,
  toggleSmallCap,
  openSettingsModal,
  closeSettingsModal,
  saveSettings,
  togglePasswordVisibility,
  clearCmcKey,
  toggleExchFilter,
  updateExchFilterUI,
  resetExchFilters,
  toggleExchExclude,
  getFilteredData,
  switchExchFilterMode,
  selectExchPreset,
  saveCurrentPreset,
  deleteCurrentPreset,
  restoreControlPanelUI,
  saveControlPanelSession,
} from "./table_filter.js";

// ⭐️ 1. 좌우 넓이 드래그 조절 기능 (UI 공통 제어) ⭐️
const leftPanel = document.getElementById("left-panel");
let isResizing = false;
let animationFrameId = null;

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  animationFrameId = requestAnimationFrame(() => {
    const containerWidth = document.body.clientWidth;
    let newWidth = (e.clientX / containerWidth) * 100;

    if (newWidth < 25) newWidth = 25;
    if (newWidth > 75) newWidth = 75;

    leftPanel.style.width = newWidth + "%";
  });
});

document.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.classList.remove("resizing-active");
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

// ⭐️ 2. 초기화 및 이벤트 바인딩 ⭐️
let lastClickedSymbol = null;
let lastClickedTime = 0;

document.addEventListener("DOMContentLoaded", () => {
  const listBody = document.getElementById("coin-list-body");
  // loadTableData();

  if (listBody) {
    listBody.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn")) return;

      const rowDiv = e.target.closest("#coin-list-body .coin-row");
      if (rowDiv && rowDiv.dataset.sym) {
        // 🚀 [자원 절약] 상장 폐지(Delisted) 코인은 클릭 시 차트 로드 및 자원 낭비 원천 차단 (즉시 리턴)
        if (rowDiv.dataset.delisted === "true") return;
        const uid = rowDiv.dataset.uid;
        const rowObj = (uid ? store.tickerRowMap?.get(String(uid)) : null) || store.tickerRowMap?.get(rowDiv.dataset.sym.toUpperCase());
        if (rowObj?.isDelisted) return;

        const ticker = rowDiv.dataset.sym;

        // 🚀 같은 코인 500ms 광클 방어 (다른 코인은 즉시 전환 허용)
        const now = Date.now();
        if (ticker === lastClickedSymbol && now - lastClickedTime < 500) {
          return;
        }
        lastClickedSymbol = ticker;
        lastClickedTime = now;

        store.currentSelectedSymbol = ticker;
        if (typeof window.selectSymbol === "function") {
          window.selectSymbol(ticker, null, uid, true);
        }
        applySelectedHighlight();

        const isTouch = typeof window.isTouchDevice === "function"
          ? window.isTouchDevice()
          : ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window) || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

        if (
          window.innerWidth <= CONFIG.SCREEN_WIDTH &&
          isTouch
        ) {
          if (typeof window.switchMobileTab === "function") {
            window.switchMobileTab("chart");
          } else if (typeof window.showMobileChart === "function") {
            window.showMobileChart();
          }
        }
      }
    });
  }
});

// ⭐️ [불변 단조 시계(Immutable Monotonic Clock) & 거래소 실시간 보정 엔진] ⭐️
// 사용자 PC OS 시계의 왜곡/조작/무효값에 100% 면역인 절대 시계 복원 레이어
let _syncedExchangeEpoch = 0;
let _syncedPerfTime = 0;

export function calibrateTrueTime(serverTimestampMs) {
  let ts = Number(serverTimestampMs);
  // 초(seconds, 10자리) 단위 타임스탬프인 경우 밀리초(13자리)로 자동 승격 보정
  if (ts > 1000000000 && ts < 10000000000) {
    ts *= 1000;
  }
  if (!Number.isFinite(ts) || ts < 1700000000000) return;
  const perfNow = (typeof performance !== "undefined" && typeof performance.now === "function")
    ? performance.now()
    : 0;

  // 거래소 간 ms~초 단위 미세 편차(Jitter)로 시계가 요동치지 않도록 1.5초 이상 유의미한 드리프트 발생 시에만 완만하게 재보정
  if (!_syncedExchangeEpoch || Math.abs((_syncedExchangeEpoch + (perfNow - _syncedPerfTime)) - ts) > 1500) {
    _syncedExchangeEpoch = ts;
    _syncedPerfTime = perfNow;
  }
}
window.calibrateTrueTime = calibrateTrueTime;

export function getTrueEpochNow() {
  const hasPerf = typeof performance !== "undefined" && typeof performance.now === "function";
  if (_syncedExchangeEpoch > 0 && hasPerf) {
    // 🔒 [1순위: 거래소 실서버 타임스탬프 + 브라우저 하드웨어 불변 단조 타이머]
    // 사용자 PC 시계가 1990년이든 2099년이든 100% 면역 (GC 할당 0)
    return _syncedExchangeEpoch + (performance.now() - _syncedPerfTime);
  }
  if (hasPerf && performance.timeOrigin) {
    // 🔒 [2순위: 브라우저 내장 불변 시간 원점 + 단조 타이머]
    return performance.timeOrigin + performance.now();
  }
  // 최후 Fallback
  return Date.now();
}
window.getTrueEpochNow = getTrueEpochNow;

// ⭐️ 3. [실시간 정렬 엔진: 하이브리드 가속 스케줄러] ⭐️
export function isTurboWindow() {
  // KST = UTC + 9시간 (+32,400,000ms)
  // Zero-GC: new Date() 객체 생성 없이 정수/원시 연산으로만 0.0001ms 만에 판별
  const trueEpoch = getTrueEpochNow();
  const kstSecInDay = Math.floor(((trueEpoch + 32400000) % 86400000) / 1000);

  // 08:59:30 KST (32370초) ~ 09:02:00 KST (32520초)
  // (서버-클라이언트 간의 네트워크 래그 및 9시 정각 경주마 선점을 위해 30초 전부터 터보 가동)
  return kstSecInDay >= 32370 && kstSecInDay <= 32520;
}
window.isTurboWindow = isTurboWindow;

// ⭐️ [9시 KST 일봉 리셋: 어제 찌꺼기 데이터 일괄 플러시 & 신규 진실값 보호] ⭐️
let _lastFlushedUtcDay = null;

export function flushResetStaleDayChanges() {
  const trueNow = typeof getTrueEpochNow === "function" ? getTrueEpochNow() : Date.now();
  const currentUtcDay = new Date(trueNow).toISOString().slice(0, 10);

  // 최초 페이지 로딩 시점에는 현재 날짜만 기록하고 스킵
  if (!_lastFlushedUtcDay) {
    _lastFlushedUtcDay = currentUtcDay;
    return;
  }

  // UTC 날짜가 변경되는 9시 정각(UTC 00:00:00) 순간 단 1회 발동
  if (currentUtcDay !== _lastFlushedUtcDay) {
    _lastFlushedUtcDay = currentUtcDay;

    const allRows = store.currentTableData || [];
    let flushedCount = 0;
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      // [값 보호] 이미 오늘(9시 이후) 신규 소켓 틱을 받아 갱신된 코인은 건드리지 않고 보존
      if (row._lastUtcDay === currentUtcDay) continue;

      // 9시 이전 과거(어제) 데이터에 멈춰있는 코인만 0%로 초기화
      row.Change_Today_Raw = 0;
      row.Change_Today_Futures = 0;
      row.Change_Today_Spot = 0;
      row.Change_Today_Upbit = 0;
      row.Change_Today_Bithumb = 0;
      row.futures_utc0_open_Raw = null;
      row.spot_utc0_open_Raw = null;
      row.utc0_open_Raw = null;
      row.utc0_open_KRW = null;
      row._lastUtcDay = currentUtcDay;
      flushedCount++;
    }

    if (flushedCount > 0 && typeof window.renderTable === "function") {
      window.renderTable(true);
    }
  }
}
window.flushResetStaleDayChanges = flushResetStaleDayChanges;

function runRealtimeSortCycle() {
  flushResetStaleDayChanges();
  if (store.blockLeftDom || store.blockSort) {
    const nowTime = Date.now();
    if (!window._lastSortTime) window._lastSortTime = 0;
    if (nowTime - window._lastSortTime < 500) {
      return;
    }
    window._lastSortTime = nowTime;
  }

  const slowCols = [
    "MarketCap",
    "Kimchi",
    "Gap",
    "Funding",
    "VMC",
    "Listing_Date",
    "Ticker",
  ];
  if (store.currentSortCol && store.sortState !== "") {
    if (!slowCols.includes(store.currentSortCol)) {
      applyRealtimeSort();
    }
  }
}

export function updateTurboBannerUI(isTurbo) {
  const dot = document.getElementById("turbo-status-dot");
  const text = document.getElementById("turbo-mode-status-text");
  const banner = document.getElementById("turbo-mode-banner");
  if (!banner) return;

  if (isTurbo) {
    banner.classList.remove("hidden");
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse";
    if (text) {
      text.className = "text-[9px] font-bold font-mono tracking-tight text-rose-400";
      text.textContent = "🔥 터보 가동 중 (고속 정렬)";
    }
    banner.classList.add("bg-rose-950/20");
  } else {
    // [평상시] 경주마 시간대(08:59:30~09:02:00)가 아닐 때는 배너 공간을 완전히 가려 기존 화면 유지
    banner.classList.add("hidden");
    banner.classList.remove("bg-rose-950/20");
  }
}
window.updateTurboBannerUI = updateTurboBannerUI;

let realtimeSortTimer = null;
function scheduleNextRealtimeSort() {
  if (realtimeSortTimer) {
    clearTimeout(realtimeSortTimer);
    realtimeSortTimer = null;
  }
  const isTurbo = isTurboWindow();
  const perf = CONFIG.TABLE_PERF || {};
  const intervalMs = isTurbo
    ? (perf.SORT_INTERVAL_TURBO_MS || 1000)
    : (perf.SORT_INTERVAL_NORMAL_MS || 1000);
  realtimeSortTimer = setTimeout(() => {
    runRealtimeSortCycle();
    scheduleNextRealtimeSort();
  }, intervalMs);
}
scheduleNextRealtimeSort();

// 4. 전역(window) 수출 구간 (HTML onclick 및 외부 모듈 연동용)
window.loadTableData = loadTableData;
window.loadTableDataSilent = loadTableDataSilent;
window.sortTable = sortTable;
window.renderTable = renderTable;
window.applyRealtimeSort = applyRealtimeSort;
window.applySelectedHighlight = applySelectedHighlight;
window.initInfiniteScroll = initInfiniteScroll;
window.toggleFavorite = toggleFavorite;
window.updateHeaderStar = updateHeaderStar;
window.applyPriceFlash = applyPriceFlash;
window.switchTab = switchTab;
window.switchFilter = switchFilter;
window.switchView = switchView;
window.toggleCurrency = toggleCurrency;
window.setCurrencyMode = setCurrencyMode;
window.updateCurrencyUI = updateCurrencyUI;
window.toggleSmallCap = toggleSmallCap;
window.updateVisibleSymbols = updateVisibleSymbols;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.togglePasswordVisibility = togglePasswordVisibility;
window.clearCmcKey = clearCmcKey;
window.toggleExchFilter = toggleExchFilter;
window.updateExchFilterUI = updateExchFilterUI;
window.resetExchFilters = resetExchFilters;
window.toggleExchExclude = toggleExchExclude;
window.getFilteredData = getFilteredData;
window.switchExchFilterMode = switchExchFilterMode;
window.selectExchPreset = selectExchPreset;
window.saveCurrentPreset = saveCurrentPreset;
window.deleteCurrentPreset = deleteCurrentPreset;
window.restoreControlPanelUI = restoreControlPanelUI;
window.saveControlPanelSession = saveControlPanelSession;

// DOM 로드 완료 후 상단 거래소 필터바 및 제어 패널 UI 최초 초기화
function initTableControlPanel() {
  if (typeof restoreControlPanelUI === "function") {
    restoreControlPanelUI();
  } else if (typeof updateExchFilterUI === "function") {
    updateExchFilterUI();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTableControlPanel);
} else {
  initTableControlPanel();
}
