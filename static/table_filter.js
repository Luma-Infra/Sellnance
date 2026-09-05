// table_filter.js
// 테이블 데이터 필터링 코어 & 제어 패널 세션 총괄 모듈

import { store, CONFIG } from "./_store.js";
import { renderTable, clearAllPendingFavActions } from "./table_render.js";
import { loadTableData } from "./table_api.js";

// 📦 분리된 하위 모듈들 임포트 & re-export (하위 호환성 100% 보장)
export {
  toggleExchFilter,
  updateExchFilterUI,
  switchExchFilterMode,
  toggleExchExclude,
  resetExchFilters,
  selectExchPreset,
  saveCurrentPreset,
  deleteCurrentPreset,
} from "./table_filter_exch.js";

export {
  sliderToMcap,
  mcapToSlider,
  sliderToVol,
  volToSlider,
  formatFilterValue,
  formatKoreanMoney,
  syncCustomFilterBtnUI,
  updateCustomFilterUI,
  toggleCustomFilter,
  setVolSource,
  applyCustomFilter,
  resetCustomFilter,
  initCustomFilterEvents,
} from "./table_filter_custom.js";

export {
  maskApiKey,
  openSettingsModal,
  closeSettingsModal,
  saveSettings,
  togglePasswordVisibility,
  clearCmcKey,
} from "./settings_modal.js";

import { updateExchFilterUI } from "./table_filter_exch.js";
import {
  mcapToSlider,
  volToSlider,
  syncCustomFilterBtnUI,
  updateCustomFilterUI,
  initCustomFilterEvents,
} from "./table_filter_custom.js";

// ==========================================
// 1. 코인 유형 판별 헬퍼
// ==========================================
export function isStockCoin(row) {
  if (!row) return false;
  if (row.Is_Stock === true) return true;
  const name = (row.Name || "").toLowerCase();
  if (name.includes("rootstock")) return false; // Rootstock (RIF) 등 일반 크립토 제외
  return name.includes("stock") || name.includes("derivative");
}

// ==========================================
// 2. 핵심 테이블 데이터 필터링 엔진
// ==========================================
export function getFilteredData() {
  let filteredData = [...store.currentTableData];

  // 0. 텍스트 검색 필터링 (가장 우선)
  if (store.searchQuery && store.searchQuery.trim() !== "") {
    const q = store.searchQuery.trim().toUpperCase();
    filteredData = filteredData.filter((r) => {
      const disp = (r.DisplayTicker || "").toUpperCase();
      const name = (r.Name || "").toUpperCase();
      const sym = (r.Symbol || "").toUpperCase();
      const raw = (r.Ticker || "").toUpperCase();
      return (
        disp.includes(q) ||
        name.includes(q) ||
        sym.includes(q) ||
        raw.includes(q)
      );
    });

    // 🚀 검색 결과 우선순위 정렬 (티커 우선 + 완전일치 최우선)
    filteredData.sort((a, b) => {
      const getScore = (r) => {
        const disp = (r.DisplayTicker || "").toUpperCase();
        const sym = (r.Symbol || "").toUpperCase();
        const raw = (r.Ticker || "").toUpperCase();
        const name = (r.Name || "").toUpperCase();

        if (disp === q || sym === q || raw === q) return 0; // 완전일치 티커
        if (disp.startsWith(q) || sym.startsWith(q) || raw.startsWith(q)) return 1; // 전방일치 티커
        if (disp.includes(q) || sym.includes(q) || raw.includes(q)) return 2; // 부분일치 티커
        if (name.startsWith(q)) return 3; // 전방일치 코인명
        if (name.includes(q)) return 4; // 부분일치 코인명
        return 5;
      };

      const scoreA = getScore(a);
      const scoreB = getScore(b);
      return scoreA - scoreB;
    });
  }

  // 1. 탭 필터링 (ALL, FAV, FAV2)
  let delistedRows = [];
  if (store.currentTab === "FAV" || store.currentTab === "FAV2") {
    const favKey = store.currentTab === "FAV" ? "sellnance_favs" : "sellnance_favs2";
    const favorites = JSON.parse(localStorage.getItem(favKey) || "[]");

    // 🚀 즐겨찾기 메타데이터 캐시 로드 & 현재 살아있는 코인 메타데이터 자동 동기화
    let favMeta = JSON.parse(localStorage.getItem("sellnance_fav_meta") || "{}");
    (store.currentTableData || []).forEach((d) => {
      if (d.UID && (d.Name || d.Name_KR)) {
        favMeta[d.UID] = {
          name: d.Name || d.Symbol || d.Ticker,
          name_kr: d.Name_KR || d.Name || d.Symbol || d.Ticker,
          symbol: d.DisplayTicker || d.Symbol || d.Ticker,
        };
      }
    });
    localStorage.setItem("sellnance_fav_meta", JSON.stringify(favMeta));

    // 현재 서버 데이터에 존재하는 코인들만 1차 필터링
    filteredData = filteredData.filter((d) => favorites.includes(d.UID));

    // 🚀 [이스터에그] 즐겨찾기에 남아있으나 현재 상장 폐지된 코인 껍데기(Ghost Row) 생성
    const currentUids = new Set(store.currentTableData.map((d) => d.UID));
    const delistedUids = favorites.filter((uid) => !currentUids.has(uid));

    delistedRows = delistedUids.map((uid) => {
      const meta = favMeta[uid] || {};
      const cleanSym = meta.symbol || String(uid)
        .replace(/^\d+_/, "")
        .replace(/_(BINANCE|UPBIT|BITHUMB|BYBIT)$/i, "")
        .toUpperCase();
      const realName = meta.name || cleanSym;
      const realNameKR = meta.name_kr || realName;

      const ghost = {
        UID: uid,
        Ticker: cleanSym,
        DisplayTicker: cleanSym,
        Symbol: cleanSym,
        Name: realName,
        Name_KR: realNameKR,
        Price_Formatted: "-",
        Price_Raw: 0,
        Price_KRW: 0,
        Change_Today_Formatted: "-",
        Change_Today_Raw: 0,
        Change_24h_Formatted: "-",
        Change_24h_Raw: 0,
        Kimchi_Formatted: "-",
        Kimchi_Raw: null,
        Volume_Formatted: "-",
        Volume_Raw: 0,
        Upbit_Vol_Formatted: "-",
        Upbit_Vol: 0,
        MarketCap_Formatted: "-",
        MarketCap_Raw: 0,
        Funding_Formatted: "-",
        Listed_Exchanges: [],
        isDelisted: true,
        Logo: `<span class="text-[18px] select-none flex items-center justify-center opacity-70 cursor-help" title="상장 폐지된 코인입니다. (FAV 이스터에그)">💀</span>`,
      };

      if (store.tickerRowMap) {
        store.tickerRowMap.set(cleanSym, ghost);
        store.tickerRowMap.set(cleanSym.toUpperCase(), ghost);
        store.tickerRowMap.set(String(uid), ghost);
      }
      return ghost;
    });
  }

  // 2. 시총 필터링 (1M 미만 숨기기 토글)
  if (store.hideSmallCap) {
    filteredData = filteredData.filter(
      (d) => (d.MarketCap_Raw || 0) >= 1000000,
    );
  }

  // 3. 커스텀 필터링 (Market Cap & Volume 범위 필터)
  filteredData = filteredData.filter((d) => {
    const mcap = d.MarketCap_Raw || 0;
    if (
      mcap < store.customMcapMin ||
      mcap > (store.customMcapMax >= 10000000000000 ? Infinity : store.customMcapMax)
    ) {
      return false;
    }

    const rate = store.marketDataMap?.krw_usd_rate || 1400;
    const vol =
      store.customVolSource === "UPBIT"
        ? (d.Upbit_Vol || 0) / rate
        : d.Volume_Raw || 0;
    if (
      vol < store.customVolMin ||
      vol > (store.customVolMax >= 100000000000 ? Infinity : store.customVolMax)
    ) {
      return false;
    }
    return true;
  });

  // 4. 바운더리 필터링
  const boundary = store.settings?.SORT_BOUNDARY;
  if (boundary) {
    filteredData = filteredData.filter((d) => {
      const c24 = Math.abs(d.Change_24h_Raw || 0);
      return c24 <= boundary;
    });
  }

  // 5. 거래소 다중 체크 포함(AND/OR/ONLY) & 제외(AND NOT) 복합 필터링
  const activeExchFilters = Object.entries(store.exchFilterStates || {}).filter(
    ([_, state]) => state !== 0,
  );

  const filterMode = store.exchFilterMode || "AND";

  if (activeExchFilters.length > 0 || filterMode === "ONLY") {
    const includeFilters = activeExchFilters.filter(([_, state]) => state > 0);
    const excludeFilters = activeExchFilters.filter(([_, state]) => state === -1);

    filteredData = filteredData.filter((row) => {
      const listed = row.Listed_Exchanges || [];
      const hasUpbit = row.Upbit === "O" || listed.includes("UPBIT");

      // [A] 수동 제외(Exclude) 필터 검사 (AND NOT)
      const isExcluded = excludeFilters.some(([exchId]) => {
        if (exchId === "UPBIT") return hasUpbit;
        if (exchId === "BITHUMB") return listed.includes("BITHUMB");
        if (exchId === "BINANCE_STOCK") return isStockCoin(row);
        if (exchId === "BINANCE_SPOT") return (listed.includes("BINANCE_SPOT") || listed.includes("BINANCE")) && !isStockCoin(row);
        if (exchId === "BINANCE_FUTURES") return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
        if (exchId === "BYBIT_SPOT") return listed.includes("BYBIT_SPOT") || listed.includes("BYBIT");
        if (exchId === "BYBIT_FUTURES") return listed.includes("BYBIT_FUTURES");
        if (exchId === "OKX_SPOT") return listed.includes("OKX_SPOT") || listed.includes("OKX");
        if (exchId === "BITGET_SPOT") return listed.includes("BITGET_SPOT") || listed.includes("BITGET");
        if (exchId === "GATEIO_SPOT") return listed.includes("GATEIO_SPOT") || listed.includes("GATEIO");
        if (exchId === "COINBASE_SPOT") return listed.includes("COINBASE_SPOT") || listed.includes("COINBASE");
        return listed.includes(exchId);
      });
      if (isExcluded) return false;

      // [B] ONLY(순수 독점) 모드 자동 배제 검사 (완전 엄격 독점)
      if (filterMode === "ONLY") {
        const targetExchs = [
          "BINANCE_SPOT",
          "BINANCE_FUTURES",
          "BINANCE_STOCK",
          "UPBIT",
          "BITHUMB",
          "BYBIT_SPOT",
          "BYBIT_FUTURES",
          "OKX_SPOT",
          "BITGET_SPOT",
          "GATEIO_SPOT",
          "COINBASE_SPOT",
        ];
        const unselectedExchs = targetExchs.filter(
          (exId) => !includeFilters.some(([incId]) => incId === exId),
        );

        const hasUnselectedExch = unselectedExchs.some((exchId) => {
          if (exchId === "UPBIT") return hasUpbit;
          if (exchId === "BITHUMB") return listed.includes("BITHUMB");
          if (exchId === "BINANCE_STOCK") return isStockCoin(row);
          if (exchId === "BINANCE_SPOT") return (listed.includes("BINANCE_SPOT") || listed.includes("BINANCE")) && !isStockCoin(row);
          if (exchId === "BINANCE_FUTURES") return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
          if (exchId === "BYBIT_SPOT") return listed.includes("BYBIT_SPOT") || listed.includes("BYBIT");
          if (exchId === "BYBIT_FUTURES") return listed.includes("BYBIT_FUTURES");
          if (exchId === "OKX_SPOT") return listed.includes("OKX_SPOT") || listed.includes("OKX");
          if (exchId === "BITGET_SPOT") return listed.includes("BITGET_SPOT") || listed.includes("BITGET");
          if (exchId === "GATEIO_SPOT") return listed.includes("GATEIO_SPOT") || listed.includes("GATEIO");
          if (exchId === "COINBASE_SPOT") return listed.includes("COINBASE_SPOT") || listed.includes("COINBASE");
          return listed.includes(exchId);
        });
        if (hasUnselectedExch) return false;
      }

      // [C] 포함(Include) 필터 검사
      if (includeFilters.length > 0) {
        const checkMatch = ([exchId, state]) => {
          if (exchId === "BINANCE_SPOT") return (listed.includes("BINANCE_SPOT") || listed.includes("BINANCE")) && !isStockCoin(row);
          if (exchId === "BINANCE_FUTURES") return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
          if (exchId === "BINANCE_STOCK") return isStockCoin(row);
          if (exchId === "BYBIT_SPOT") return listed.includes("BYBIT_SPOT") || listed.includes("BYBIT");
          if (exchId === "BYBIT_FUTURES") return listed.includes("BYBIT_FUTURES");
          if (exchId === "OKX_SPOT") return listed.includes("OKX_SPOT") || listed.includes("OKX");
          if (exchId === "BITGET_SPOT") return listed.includes("BITGET_SPOT") || listed.includes("BITGET");
          if (exchId === "GATEIO_SPOT") return listed.includes("GATEIO_SPOT") || listed.includes("GATEIO");
          if (exchId === "COINBASE_SPOT") return listed.includes("COINBASE_SPOT") || listed.includes("COINBASE");
          if (exchId === "UPBIT") return hasUpbit;
          if (exchId === "BITHUMB") return listed.includes("BITHUMB");
          return listed.includes(exchId);
        };

        if (filterMode === "AND" || filterMode === "ONLY") {
          return includeFilters.every(checkMatch);
        } else {
          return includeFilters.some(checkMatch);
        }
      }

      if (filterMode === "ONLY" && includeFilters.length === 0) {
        return false;
      }

      return true;
    });
  }

  return delistedRows.length > 0
    ? [...filteredData, ...delistedRows]
    : filteredData;
}

// ==========================================
// 3. 세션 스토리지 보존 및 복원 총괄
// ==========================================
export function saveControlPanelSession() {
  try {
    if (typeof sessionStorage === "undefined") return;
    const data = {
      hideSmallCap: store.hideSmallCap,
      currentTab: store.currentTab || "ALL",
      exchFilterStates: store.exchFilterStates,
      exchFilterMode: store.exchFilterMode || "AND",
      activePresetIndex: store.activePresetIndex,
      customMcapMin: store.customMcapMin,
      customMcapMax: store.customMcapMax,
      customVolMin: store.customVolMin,
      customVolMax: store.customVolMax,
      customVolSource: store.customVolSource,
    };
    sessionStorage.setItem(
      "sellnance_session_control_panel",
      JSON.stringify(data),
    );
  } catch (e) {
    console.warn("Failed to save control panel session:", e);
  }
}

export function restoreControlPanelUI() {
  // 1. hideSmallCap 버튼 스타일 복원
  const btnSmallCap = document.getElementById("btn-small-cap");
  if (btnSmallCap) {
    if (store.hideSmallCap) {
      btnSmallCap.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
      btnSmallCap.classList.add(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "shadow-md",
        "opacity-100",
      );
    } else {
      btnSmallCap.classList.remove(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "shadow-md",
        "opacity-100",
      );
      btnSmallCap.classList.add(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
    }
    btnSmallCap.innerHTML = `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg><span>Mcap &lt; 1M</span>`;
  }

  // 2. 카테고리 탭 버튼 복원
  const catTabs = document.querySelectorAll(
    "#tab-buttons-group > button[id^='tab-']",
  );
  if (catTabs.length > 0) {
    catTabs.forEach((btn) => {
      btn.classList.remove("bg-theme-accent", "text-white", "shadow-md");
      btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
    });
    const curTabKey = (store.currentTab || "ALL").toLowerCase();
    const activeTabBtn = document.getElementById(`tab-${curTabKey}`);
    if (activeTabBtn) {
      activeTabBtn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
      activeTabBtn.classList.add("bg-theme-accent", "text-white", "shadow-md");
    }
  }

  // 3. 커스텀 필터 슬라이더 입력값 및 볼륨 소스 동기화
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");
  const minVolEl = document.getElementById("vol-min");
  const maxVolEl = document.getElementById("vol-max");

  if (minMcapEl && typeof store.customMcapMin === "number") {
    minMcapEl.value = mcapToSlider(store.customMcapMin);
  }
  if (maxMcapEl && typeof store.customMcapMax === "number") {
    maxMcapEl.value = mcapToSlider(store.customMcapMax);
  }
  if (minVolEl && typeof store.customVolMin === "number") {
    minVolEl.value = volToSlider(store.customVolMin);
  }
  if (maxVolEl && typeof store.customVolMax === "number") {
    maxVolEl.value = volToSlider(store.customVolMax);
  }

  const btnBinance = document.getElementById("vol-source-binance");
  const btnUpbit = document.getElementById("vol-source-upbit");
  if (store.customVolSource === "BINANCE") {
    if (btnBinance)
      btnBinance.className =
        "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
    if (btnUpbit)
      btnUpbit.className =
        "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
  } else if (store.customVolSource === "UPBIT") {
    if (btnBinance)
      btnBinance.className =
        "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
    if (btnUpbit)
      btnUpbit.className =
        "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
  }

  // 4. 커스텀 필터 버튼 하이라이트 동기화
  syncCustomFilterBtnUI();

  // 5. 상단 거래소 필터바 및 프리셋 버튼 UI 동기화
  if (typeof updateExchFilterUI === "function") {
    updateExchFilterUI();
  }

  // 6. 커스텀 필터 슬라이더 UI 텍스트 및 트랙 동기화
  if (typeof updateCustomFilterUI === "function") {
    updateCustomFilterUI();
  }
}

// ==========================================
// 4. 카테고리 탭 & 뷰 & 통화 & 소형주 토글
// ==========================================
export function switchTab(tab) {
  if (typeof clearAllPendingFavActions === "function") {
    clearAllPendingFavActions();
  }
  updateFavoritesCount();

  if (tab === "FAV" && store.currentTab === "FAV") {
    tab = "ALL";
  }
  if (tab === "FAV2" && store.currentTab === "FAV2") {
    tab = "ALL";
  }

  store.currentTab = tab;
  store.currentRenderLimit = 1000;

  document
    .querySelectorAll("#tab-buttons-group > button[id^='tab-']")
    .forEach((btn) => {
      btn.classList.remove("bg-theme-accent", "text-white", "shadow-md");
      btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
    });

  const activeBtn = document.getElementById(`tab-${tab.toLowerCase()}`);
  if (activeBtn) {
    activeBtn.classList.remove(
      "text-theme-text",
      "opacity-50",
      "border-theme-border",
    );
    activeBtn.classList.add("bg-theme-accent", "text-white", "shadow-md");
  }

  renderTable();
  saveControlPanelSession();
}

export function switchFilter(mode) {
  store.currentMarket = mode;
  store.currentChartMarket = mode;
  const slider = document.getElementById("filter-slider");
  const btnAll = document.getElementById("filter-all-main");
  const btnBinance = document.getElementById("filter-binance");
  const btnUpbit = document.getElementById("filter-upbit");

  const updateUI = (activeBtn, offset) => {
    [btnAll, btnBinance, btnUpbit].forEach((btn) => {
      if (btn) {
        btn.classList.remove("text-white", "font-bold");
        btn.classList.add("text-theme-text", "opacity-50");
      }
    });
    if (activeBtn) {
      activeBtn.classList.remove("text-theme-text", "opacity-50");
      activeBtn.classList.add("text-white", "font-bold");
    }
    if (slider) slider.style.left = offset;
  };

  if (mode === "BINANCE") {
    store.filterMode = "BINANCE";
    store.currencyMode = "USD";
    store.lang = "EN";
    updateUI(btnBinance, "4px");
  } else if (mode === "UPBIT") {
    store.filterMode = "UPBIT";
    store.currencyMode = "KRW";
    store.lang = "KR";
    updateUI(btnUpbit, "calc(50% + 2px)");
  } else {
    store.filterMode = mode;
    document.querySelectorAll(".filter-type-btn").forEach((btn) => {
      btn.classList.remove("bg-theme-accent", "text-white", "shadow-sm");
      btn.classList.add("text-theme-text", "opacity-50", "hover:opacity-100");
    });
    const activeBtn = document.getElementById(`filter-${mode.toLowerCase()}`);
    if (activeBtn) {
      activeBtn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "hover:opacity-100",
      );
      activeBtn.classList.add("bg-theme-accent", "text-white", "shadow-sm");
    }
  }

  store.currentRenderLimit = 1000;
  renderTable();

  if (
    store.currentSelectedSymbol &&
    typeof window.selectSymbol === "function"
  ) {
    window.selectSymbol(store.currentSelectedSymbol);
  }
}

export function switchView(mode) {
  store.viewMode = mode;
  const detailedBtn = document.getElementById("view-detailed") || document.getElementById("view-mode-basic-btn");
  const simpleBtn = document.getElementById("view-simple") || document.getElementById("view-mode-simple-btn");

  if (detailedBtn) {
    detailedBtn.className =
      mode === "detailed" || mode === "basic"
        ? "px-3 py-1 text-[10px] font-bold rounded bg-theme-accent text-white transition-all shadow-md"
        : "px-3 py-1 text-[10px] font-medium rounded opacity-50 hover:opacity-100 transition-all text-theme-text";
  }
  if (simpleBtn) {
    simpleBtn.className =
      mode === "simple"
        ? "px-3 py-1 text-[10px] font-bold rounded bg-theme-accent text-white transition-all shadow-md"
        : "px-3 py-1 text-[10px] font-medium rounded opacity-50 hover:opacity-100 transition-all text-theme-text";
  }

  if (mode === "simple") {
    store.tableViewMode = "simple";
    const panel = document.getElementById("left-panel");
    if (panel) {
      panel.classList.remove("view-mode-basic", "view-mode-expert");
      panel.classList.add("view-mode-simple");
    }
  } else if (mode === "detailed" || mode === "basic") {
    store.tableViewMode = "basic";
    const panel = document.getElementById("left-panel");
    if (panel) {
      panel.classList.remove("view-mode-simple", "view-mode-expert");
      panel.classList.add("view-mode-basic");
    }
  }

  renderTable();
}

export function toggleCurrency() {
  store.currencyMode = store.currencyMode === "USD" ? "KRW" : "USD";
  store.lang = store.currencyMode === "USD" ? "EN" : "KR";
  const btn = document.getElementById("currency-toggle");
  if (btn) {
    btn.innerText =
      store.currencyMode === "USD" ? "USD ($) / EN" : "KRW (₩) / KR";
  }
  renderTable();

  if (store.currentSelectedSymbol) {
    const allSource = store.currentTableData || store.originalTableData || [];
    const row = allSource.find(
      (r) =>
        r.DisplayTicker === store.currentSelectedSymbol ||
        r.Ticker === store.currentSelectedSymbol,
    );
    if (row && typeof window.updateHeaderDisplay === "function") {
      const p = store.getPrecision(store.currentSelectedSymbol);
      window.updateHeaderDisplay(row, undefined, p);
    }
  }
}

export function toggleSmallCap() {
  store.hideSmallCap = !store.hideSmallCap;

  const btn = document.getElementById("btn-small-cap");
  if (btn) {
    const btnHtml = `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg><span>Mcap &lt; 1M</span>`;

    if (store.hideSmallCap) {
      btn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
      btn.classList.add(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "shadow-md",
        "opacity-100",
      );
      btn.innerHTML = btnHtml;
    } else {
      btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
      btn.classList.remove(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "shadow-md",
        "opacity-100",
      );
      btn.innerHTML = btnHtml;
    }
  }

  store.currentRenderLimit = 1000;
  renderTable();
  saveControlPanelSession();
}

export function updateFavoritesCount() {
  const f1Set = new Set(JSON.parse(localStorage.getItem("sellnance_favs") || "[]"));
  const f2Set = new Set(JSON.parse(localStorage.getItem("sellnance_favs2") || "[]"));

  if (store && store.pendingFavActions && store.pendingFavActions.size > 0) {
    store.pendingFavActions.forEach((action, uid) => {
      f1Set.delete(uid);
      f2Set.delete(uid);
      if (action.targetState === "FAV") {
        f1Set.add(uid);
      } else if (action.targetState === "FAV2") {
        f2Set.add(uid);
      }
    });
  }

  const f1 = f1Set.size;
  const f2 = f2Set.size;
  const tabFav = document.getElementById("tab-fav");
  const tabFav2 = document.getElementById("tab-fav2");
  if (tabFav) tabFav.innerHTML = `<span style="color: #e3b30a; margin-right: 2px">★</span>` + (f1 > 0 ? `FAV (${f1})` : "FAV");
  if (tabFav2) tabFav2.innerHTML = `<span style="color: #3b82f6; margin-right: 2px">★</span>` + (f2 > 0 ? `FAV 2 (${f2})` : "FAV 2");
}

// ==========================================
// 5. 초기 이벤트 바인딩 및 세션 복원 트리거
// ==========================================
function initControlPanel() {
  initCustomFilterEvents();
  restoreControlPanelUI();
  updateFavoritesCount();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initControlPanel);
} else {
  initControlPanel();
}

// 글로벌 window 바인딩 (인라인 HTML 및 타 모듈 호환)
if (typeof window !== "undefined") {
  window.isStockCoin = isStockCoin;
  window.getFilteredData = getFilteredData;
  window.switchTab = switchTab;
  window.switchFilter = switchFilter;
  window.switchView = switchView;
  window.toggleCurrency = toggleCurrency;
  window.toggleSmallCap = toggleSmallCap;
  window.updateFavoritesCount = updateFavoritesCount;
  window.restoreControlPanelUI = restoreControlPanelUI;
  window.saveControlPanelSession = saveControlPanelSession;
}
