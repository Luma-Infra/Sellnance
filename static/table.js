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
  toggleLang,
  toggleSmallCap,
  openSettingsModal,
  closeSettingsModal,
  saveSettings,
  togglePasswordVisibility,
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
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("table-body");
  loadTableData();

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn")) return;

      const tr = e.target.closest("tr");
      if (tr && tr.dataset.sym) {
        const ticker = tr.dataset.sym;
        store.currentSelectedSymbol = ticker;
        if (typeof window.selectSymbol === "function") {
          window.selectSymbol(ticker);
        }
        applySelectedHighlight();

        if (window.innerWidth <= CONFIG.SCREEN_WIDTH && typeof window.showMobileChart === "function") {
          window.showMobileChart();
        }
      }
    });
  }
});

// ⭐️ 3. [HTS급 실시간 정렬 엔진] 1초마다 순위 재배치 및 가시 영역 고속 FLIP 실행 ⭐️
setInterval(() => {
  if (store.currentSortCol && store.sortState !== "" && store.isEngineStarted) {
    applyRealtimeSort();
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
window.toggleLang = toggleLang;
window.toggleSmallCap = toggleSmallCap;
window.updateVisibleSymbols = updateVisibleSymbols;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.togglePasswordVisibility = togglePasswordVisibility;
