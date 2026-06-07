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
} from "./table_render.js";
import { sortTable, applyRealtimeSort } from "./table_sort.js";
import {
  switchTab,
  switchFilter,
  switchView,
  toggleCurrency,
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
  const tbody = document.getElementById("table-body");
  // loadTableData();

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn")) return;

      const tr = e.target.closest("tr");
      if (tr && tr.dataset.sym) {
        const ticker = tr.dataset.sym;

        // 🚀 같은 코인 500ms 광클 방어 (다른 코인은 즉시 전환 허용)
        const now = Date.now();
        if (ticker === lastClickedSymbol && now - lastClickedTime < 500) {
          return;
        }
        lastClickedSymbol = ticker;
        lastClickedTime = now;

        store.currentSelectedSymbol = ticker;
        if (typeof window.selectSymbol === "function") {
          window.selectSymbol(ticker);
        }
        applySelectedHighlight();

        if (
          window.innerWidth <= CONFIG.SCREEN_WIDTH &&
          typeof window.showMobileChart === "function"
        ) {
          window.showMobileChart();
        }
      }
    });
  }
});

// ⭐️ 3. [HTS급 실시간 정렬 엔진] 1초마다 순위 재배치 및 가시 영역 고속 FLIP 실행 ⭐️
setInterval(() => {
  const slowCols = ["MarketCap", "Kimchi", "Gap", "Funding", "VMC", "Listing_Date", "Ticker"];
  if (store.currentSortCol && store.sortState !== "" && store.isEngineStarted) {
    if (!slowCols.includes(store.currentSortCol)) {
      applyRealtimeSort();
    }
  }
}, 1000);

// ⭐️ 4. 전역(window) 수출 구간 (HTML onclick 및 외부 모듈 연동용) ⭐️
window.loadTableData = loadTableData;
window.sortTable = sortTable;
window.renderTable = renderTable;
window.applyRealtimeSort = applyRealtimeSort;
window.applySelectedHighlight = applySelectedHighlight;
window.initInfiniteScroll = initInfiniteScroll;
window.toggleFavorite = toggleFavorite;
window.applyPriceFlash = applyPriceFlash;
window.switchTab = switchTab;
window.switchFilter = switchFilter;
window.switchView = switchView;
window.toggleCurrency = toggleCurrency;
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

// DOM 로드 완료 후 상단 거래소 필터바 UI 최초 초기화
document.addEventListener("DOMContentLoaded", () => {
  if (typeof updateExchFilterUI === "function") {
    updateExchFilterUI();
  }
});
