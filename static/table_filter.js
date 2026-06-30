// table_filter.js
import { store, CONFIG } from "./_store.js";
import { renderTable, clearAllPendingFavActions } from "./table_render.js";
import { loadTableData } from "./table_api.js";

export function isStockCoin(row) {
  if (!row) return false;
  if (row.Is_Stock === true) return true;
  const name = (row.Name || "").toLowerCase();
  if (name.includes("rootstock")) return false; // Rootstock (RIF) 등 일반 크립토 제외
  return name.includes("stock") || name.includes("derivative");
}

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
  if (store.currentTab === "FAV") {
    const favorites = JSON.parse(
      localStorage.getItem("sellnance_favs") || "[]",
    );
    filteredData = filteredData.filter((d) => favorites.includes(d.UID));
  } else if (store.currentTab === "FAV2") {
    const favorites2 = JSON.parse(
      localStorage.getItem("sellnance_favs2") || "[]",
    );
    filteredData = filteredData.filter((d) => favorites2.includes(d.UID));
  }

  // 2. 마켓/통화 필터링 (구버전의 코인 거르기 로직 삭제됨)
  // 사용자의 요청으로, 상단 BINANCE/UPBIT 토글은 단순히 "통화(USD/KRW) 및 언어" 설정일 뿐
  // 특정 코인을 숨기는 역할(Filtering)은 하단 '독립적인 거래소 필터바'가 전담합니다.

  // 3. 시총 필터링 (1M 미만 숨기기 토글)
  if (store.hideSmallCap) {
    filteredData = filteredData.filter(
      (d) => (d.MarketCap_Raw || 0) >= 1000000,
    );
  }

  // 3.5. 커스텀 필터링 (Market Cap & Volume 범위 필터)
  filteredData = filteredData.filter((d) => {
    // Mcap 검사
    const mcap = d.MarketCap_Raw || 0;
    if (
      mcap < store.customMcapMin ||
      mcap >
      (store.customMcapMax >= 10000000000000 ? Infinity : store.customMcapMax)
    ) {
      return false;
    }
    // Volume 검사 (Upbit_Vol은 KRW 단위이므로, USD 필터 조건과 비교 시 환율로 나누어 USD로 변환)
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

  // [주식 토큰 기본 필터링] B-STOCK 필터가 활성화된 상태이거나 즐겨찾기 탭이 아닐 경우 주식 코인을 목록에서 기본 제외 (유저 요청으로 임시 비활성화)
  // const isBStockFilterActive = store.exchFilterStates?.BINANCE_STOCK === 1;
  // const isFavoritesTab =
  //   store.currentTab === "FAV" || store.currentTab === "FAV2";
  // if (!isBStockFilterActive && !isFavoritesTab) {
  //   filteredData = filteredData.filter((d) => !isStockCoin(d));
  // }

  // 5. 거래소 다중 체크 포함(AND/OR/ONLY) & 제외(AND NOT) 복합 필터링
  const activeExchFilters = Object.entries(store.exchFilterStates || {}).filter(
    ([_, state]) => state !== 0,
  );

  const filterMode = store.exchFilterMode || "AND";

  if (activeExchFilters.length > 0 || filterMode === "ONLY") {
    // 포함 필터들 (state > 0)
    const includeFilters = activeExchFilters.filter(([_, state]) => state > 0);
    // 제외 필터들 (state === -1)
    const excludeFilters = activeExchFilters.filter(
      ([_, state]) => state === -1,
    );

    filteredData = filteredData.filter((row) => {
      const listed = row.Listed_Exchanges || [];
      const hasUpbit = row.Upbit === "O" || listed.includes("UPBIT");

      // ─── [A] 수동 제외(Exclude) 필터 검사 (AND NOT) ───
      const isExcluded = excludeFilters.some(([exchId]) => {
        if (exchId === "UPBIT") return hasUpbit;
        if (exchId === "BITHUMB") return listed.includes("BITHUMB");
        if (exchId === "BINANCE") {
          return listed.includes("BINANCE") && !isStockCoin(row);
        }
        if (exchId === "BINANCE_FUTURES") {
          return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
        }
        if (exchId === "BINANCE_STOCK") {
          return isStockCoin(row);
        }
        return listed.some((ex) => ex.startsWith(exchId));
      });
      if (isExcluded) return false;

      // ─── [B] ONLY(순수 독점) 모드 자동 배제 검사 ───
      if (filterMode === "ONLY") {
        const targetExchs = [
          "BINANCE",
          "BINANCE_FUTURES",
          "BINANCE_STOCK",
          "UPBIT",
          "BITHUMB",
          "BYBIT",
          "OKX",
          "BITGET",
          "GATEIO",
          "COINBASE",
        ];
        // 명시적으로 포함되지 않은 타 거래소들 목록
        const unselectedExchs = targetExchs.filter(
          (exId) => !includeFilters.some(([incId]) => incId === exId),
        );

        // 이 코인이 미선택된 다른 거래소에 단 하나라도 상장되어 있으면 탈락!
        const hasUnselectedExch = unselectedExchs.some((exchId) => {
          if (exchId === "UPBIT") return hasUpbit;
          if (exchId === "BITHUMB") return listed.includes("BITHUMB");
          if (exchId === "BINANCE") {
            return listed.includes("BINANCE") && !isStockCoin(row);
          }
          if (exchId === "BINANCE_FUTURES") {
            return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
          }
          if (exchId === "BINANCE_STOCK") {
            return isStockCoin(row);
          }
          return listed.some((ex) => ex.startsWith(exchId));
        });
        if (hasUnselectedExch) return false;
      }

      // ─── [C] 포함(Include) 필터 검사 ───
      if (includeFilters.length > 0) {
        const checkMatch = ([exchId, state]) => {
          if (exchId === "BINANCE") {
            return listed.includes("BINANCE") && !isStockCoin(row);
          }
          if (exchId === "BINANCE_FUTURES") {
            return listed.includes("BINANCE_FUTURES") && !isStockCoin(row);
          }
          if (exchId === "BINANCE_STOCK") {
            return isStockCoin(row);
          }
          if (exchId === "UPBIT") {
            return hasUpbit; // 업비트 현물
          }
          if (exchId === "BITHUMB") {
            return listed.includes("BITHUMB"); // 빗썸 현물
          }
          return listed.some((ex) => ex.startsWith(exchId));
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

  return filteredData;
}

export function switchTab(tab) {
  if (typeof clearAllPendingFavActions === "function") {
    clearAllPendingFavActions();
  }

  if (tab === "FAV" && store.currentTab === "FAV") {
    tab = "ALL";
  }
  if (tab === "FAV2" && store.currentTab === "FAV2") {
    tab = "ALL";
  }

  store.currentTab = tab;
  store.currentRenderLimit = 1000;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
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

  // 🚀 [추가] 필터 모드가 변경되면, 이미 선택된 코인이 있을 경우 우측 패널(헤더 및 차트)도 새 우선순위에 맞춰 재갱신
  if (
    store.currentSelectedSymbol &&
    typeof window.selectSymbol === "function"
  ) {
    // 탭 전환 등 기타 요인을 배제하고, 동일 심볼에 대해 currentMarket을 재산출하여 차트/헤더를 업데이트하도록 재호출
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

  // Sync tableViewMode
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
    if (store.hideSmallCap) {
      btn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
      btn.classList.add(
        "bg-theme-down",
        "text-white",
        "border-theme-down",
        "shadow-md",
        "opacity-100",
      );
      btn.innerText = "🚫 Hiding Mcap < 1M";
    } else {
      btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
      btn.classList.remove(
        "bg-theme-down",
        "text-white",
        "border-theme-down",
        "shadow-md",
        "opacity-100",
      );
      btn.innerText = "🚫 Hiding Mcap < 1M";
    }
  }

  store.currentRenderLimit = 1000;
  renderTable();
}

export function maskApiKey(key) {
  if (!key) return "";
  const len = key.length;
  if (len <= 8) return key;

  const start = key.slice(0, 4);
  const end = key.slice(-4);
  const dots = "*".repeat(len - 8);
  return `${start}${dots}${end}`;
}

export async function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.classList.remove("hidden");

  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    store.settings = data;
    const input = document.getElementById("setting-cmc-key");
    const btn = input.nextElementSibling;
    input.type = "text";
    input.value = maskApiKey(data.CMC_API_KEY || "");
    input.dataset.masked = "true";
    if (btn) btn.innerText = "🙈";
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

export function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
}

export async function saveSettings() {
  const input = document.getElementById("setting-cmc-key");
  let newKey = input.value.trim();

  if (newKey.includes("*") && store.settings) {
    newKey = store.settings.CMC_API_KEY || "";
  }

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CMC_API_KEY: newKey }),
    });

    if (res.ok) {
      alert("Settings saved successfully! Restarting data fetch...");
      closeSettingsModal();
      loadTableData(true);
    }
  } catch (e) {
    alert("Failed to save settings.");
  }
}

export function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  const btn = input.nextElementSibling;
  if (!store.settings) return;
  const raw = store.settings.CMC_API_KEY || "";

  if (input.dataset.masked === "true") {
    input.value = raw;
    input.dataset.masked = "false";
    if (btn) btn.innerText = "🙉";
  } else {
    input.value = maskApiKey(raw);
    input.dataset.masked = "true";
    if (btn) btn.innerText = "🙈";
  }
}

export function clearCmcKey() {
  const input = document.getElementById("setting-cmc-key");
  if (input) {
    input.value = "";
    input.dataset.masked = "false";
    input.focus();
  }
}

// 🚀 [추가] 거래소 필터링 개별 사이클 조절 함수
export function toggleExchFilter(exchId, event) {
  // 클릭 종류 판별 (이벤트가 있으면 기본 동작 방지)
  if (event) event.preventDefault();

  const current = store.exchFilterStates[exchId] || 0;

  // 모든 버튼은 동일하게 해제(0) -> 포함(1) -> 제외(-1) -> 해제(0)
  if (current === 0) store.exchFilterStates[exchId] = 1;
  else if (current === 1) store.exchFilterStates[exchId] = -1;
  else store.exchFilterStates[exchId] = 0;

  // 렌더러 리밋 초기화 후 테이블 갱신
  store.currentRenderLimit = 1000;
  renderTable();

  // 상단 필터 UI 배지 및 스타일 동적 갱신
  updateExchFilterUI();
}

// 🚀 [추가] 상단 거래소 필터바 상태 표시 업데이트
export function updateExchFilterUI() {
  const container = document.getElementById("exchange-filter-container");
  if (!container) return;

  const list = [
    { id: "BINANCE", cmcId: 270, label: "S", name: "B-SPOT" },
    { id: "BINANCE_FUTURES", cmcId: 270, label: "F", name: "B-FUT" },
    { id: "BINANCE_STOCK", cmcId: 270, label: "ST", name: "B-STOCK" },
    { id: "UPBIT", cmcId: 351, name: "UPBIT" },
    { id: "BITHUMB", cmcId: 200, name: "BITHUMB" },
    { id: "BYBIT", cmcId: 521, name: "BYBIT" },
    { id: "OKX", cmcId: 294, name: "OKX" },
    { id: "BITGET", cmcId: 513, name: "BITGET" },
    { id: "GATEIO", cmcId: 302, name: "GATEIO" },
    { id: "COINBASE", cmcId: 89, name: "COINBASE" },
  ];

  // 🚀 [추가] 3단 스위치 모드 토글 HTML (AND / OR / ONLY)
  const currentMode = store.exchFilterMode || "AND";
  const modeLabels = { AND: "AND", OR: "OR", ONLY: "ONLY" };

  // 3단 상태별 슬라이더 테두리 및 텍스트 강조 컬러셋팅
  let modeBtnClass = "bg-theme-panel/10 border-theme-border/30 text-theme-text";
  if (currentMode === "AND")
    modeBtnClass =
      "bg-theme-accent/20 border-theme-accent text-theme-accent font-bold";
  else if (currentMode === "OR")
    modeBtnClass =
      "bg-green-500/10 border-green-500/50 text-green-400 font-bold";
  else if (currentMode === "ONLY")
    modeBtnClass =
      "bg-orange-500/25 border-orange-500/80 text-orange-400 font-bold";

  const modeToggleHtml = `
    <button onclick="window.switchExchFilterMode()" 
            class="flex items-center justify-center px-2 border rounded-xl transition-all duration-300 h-9 text-[9px] min-w-[54px] hover:scale-105 active:scale-95 ${modeBtnClass}" 
            title="조건 결합 모드 (클릭하여 AND -> OR -> ONLY 순환)">
      ${modeLabels[currentMode]}
    </button>
  `;

  // 🚀 우측 끝에 깔끔하게 초기화(리셋) 버튼 추가
  const resetBtnHtml = `
    <button onclick="window.resetExchFilters()" 
            class="flex items-center justify-center p-1 border border-theme-border/30 rounded-xl transition-all duration-300 w-9 h-9 hover:scale-105 active:scale-95 bg-theme-panel/10 hover:bg-theme-accent/20 hover:border-theme-accent text-theme-text opacity-70 hover:opacity-100" 
            title="필터 초기화">
      <span class="text-[12px]">⟳</span>
    </button>
  `;

  const buttonsHtml = list
    .map((ex) => {
      const state = store.exchFilterStates[ex.id] || 0;
      let badgeText = ex.label || "";

      // 상태에 따른 외형 제어 (유명 3사 외 구분 없는 버튼 상태 처리 포함)
      let borderStyle = "border-theme-border/30";
      let filterStyle = "filter: grayscale(1); opacity: 0.45;";
      let bgStyle = "background: transparent;";
      let badgeBg = "bg-theme-accent";

      if (state === 1) {
        borderStyle = "border-theme-accent";
        bgStyle =
          "background: color-mix(in srgb, var(--accent) 12%, transparent);";
        filterStyle = "filter: none; opacity: 1;";
      } else if (state === -1) {
        badgeText = "🚫" + (ex.label || "");
        borderStyle = "border-theme-down";
        filterStyle = "filter: grayscale(0.5) contrast(0.8); opacity: 0.85;";
        bgStyle = "background: rgba(239, 83, 80, 0.1);";
        badgeBg = "bg-theme-down";
      }

      // B-SPOT, B-FUT, B-STOCK의 경우 비활성화(state === 0) 상태에서도 라벨이 표시되어 구분 가능해야 함
      if (state === 0 && ex.label) {
        badgeBg = "bg-theme-border/40 text-theme-text opacity-60";
      }

      const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
      const imgStyle =
        ex.id === "BINANCE_STOCK" ? "filter: hue-rotate(180deg);" : "";

      // 🚀 일반 클릭으로 사이클 변경, 우클릭은 즉시 '제외(-1)' 또는 '해제(0)'로 단축 제어할 수 있도록 contextmenu 핸들링 추가
      return `
      <button onclick="window.toggleExchFilter('${ex.id}', event)" 
              oncontextmenu="event.preventDefault(); window.toggleExchExclude('${ex.id}');"
              class="relative flex items-center justify-center p-1.5 border rounded-xl transition-all duration-300 w-9 h-9 hover:scale-105 active:scale-95 ${borderStyle}"
              style="${bgStyle} ${filterStyle}" title="${ex.name || ex.id} (클릭: 순환 토글 / 우클릭: 제외 토글)">
        <img src="${imgUrl}" alt="${ex.name || ex.id}" class="w-full h-full object-contain rounded" style="${imgStyle}" />
        ${badgeText
          ? `<div class="absolute -top-1 -right-1 ${badgeBg} text-white text-[8px] px-0.5 rounded-sm leading-none font-bold scale-[0.8]">${badgeText}</div>`
          : ""
        }
      </button>
    `;
    })
    .join("");

  container.innerHTML = buttonsHtml + modeToggleHtml + resetBtnHtml;

  // 🚀 [추가] 아랫줄의 #exchange-presets-container 프리셋 제어바 렌더링
  const presetsContainer = document.getElementById(
    "exchange-presets-container",
  );
  if (presetsContainer) {
    let presets = JSON.parse(
      localStorage.getItem("sellnance_exch_presets") || "[]",
    );
    while (presets.length < 5) presets.push(null);

    // 선택된 프리셋이 없을 때는 저장/삭제 버튼을 숨기기 위해 undefined 유지
    // if (store.activePresetIndex === undefined) {
    //   store.activePresetIndex = 0;
    // }

    const presetButtonsHtml = presets
      .map((preset, idx) => {
        const hasPreset = !!preset;
        const num = idx + 1;
        const isActive = store.activePresetIndex === idx;

        let title = `프리셋 ${num}\n`;
        let borderStyle =
          "border-theme-border/30 text-theme-text opacity-40 hover:opacity-100 hover:scale-105 bg-theme-panel/5";

        if (hasPreset) {
          const incs = Object.entries(preset.states)
            .filter(([_, s]) => s === 1)
            .map(([k]) => k.replace("BINANCE_", "B-"));
          const decs = Object.entries(preset.states)
            .filter(([_, s]) => s === -1)
            .map(([k]) => k.replace("BINANCE_", "B-"));

          title += `결합모드: ${preset.mode}\n`;
          if (incs.length > 0) title += `포함: ${incs.join(", ")}\n`;
          if (decs.length > 0) title += `제외: ${decs.join(", ")}\n`;
          title += `(클릭: 선택 및 불러오기)`;

          if (isActive) {
            borderStyle =
              "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold scale-105 ring-2 ring-theme-accent/20";
          } else {
            borderStyle =
              "border-theme-border text-theme-accent/70 bg-theme-panel/30 hover:border-theme-accent hover:text-theme-accent hover:scale-105";
          }
        } else {
          title += "(비어 있음 - 선택 후 우측 [저장] 클릭 시 저장)";
          if (isActive) {
            borderStyle =
              "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold scale-105 ring-2 ring-theme-accent/20";
          }
        }

        return `
        <button onclick="window.selectExchPreset(${idx})" 
                class="flex items-center justify-center border rounded-xl text-[9px] w-6 h-6 transition-all duration-300 font-bold ${borderStyle}"
                title="${title}">
          P${num}
        </button>
      `;
      })
      .join("");

    presetsContainer.innerHTML = `
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[9px] font-bold opacity-60 mr-1 uppercase tracking-wider text-theme-text">거래소 프리셋 </span>
        ${presetButtonsHtml}
      </div>
      <div class="flex items-center gap-1.5 shrink-0 transition-opacity duration-300 ${store.activePresetIndex !== undefined ? "opacity-100" : "opacity-0 pointer-events-none hidden"}">
        <button onclick="window.saveCurrentPreset()" 
                class="px-2.5 py-0.5 border border-green-500/40 hover:bg-green-500/20 text-green-400 rounded-lg transition-all duration-200 text-[9px] font-bold hover:scale-105 active:scale-95 shadow-sm"
                title="현재 필터 설정을 선택된 프리셋 번호에 저장합니다.">저장</button>
        <button onclick="window.deleteCurrentPreset()" 
                class="px-2.5 py-0.5 border border-red-500/40 hover:bg-red-500/20 text-red-400 rounded-lg transition-all duration-200 text-[9px] font-bold hover:scale-105 active:scale-95 shadow-sm"
                title="선택된 프리셋 번호의 데이터를 삭제합니다.">삭제</button>
      </div>
    `;
  }
}

// 🚀 [추가] 3단 결합 조건 모드 스위칭 함수 (AND -> OR -> ONLY -> AND)
export function switchExchFilterMode() {
  const current = store.exchFilterMode || "AND";
  if (current === "AND") store.exchFilterMode = "OR";
  else if (current === "OR") store.exchFilterMode = "ONLY";
  else store.exchFilterMode = "AND";

  store.currentRenderLimit = 1000;
  renderTable();
  updateExchFilterUI();
}

// 🚀 [추가] 우클릭 시 제외(-1) 상태로 다이렉트 변환하는 편의 지름길 함수
export function toggleExchExclude(exchId) {
  const current = store.exchFilterStates[exchId] || 0;
  if (current === -1) {
    store.exchFilterStates[exchId] = 0; // 이미 제외면 해제
  } else {
    store.exchFilterStates[exchId] = -1; // 아니면 즉시 제외 적용
  }
  store.currentRenderLimit = 1000;
  renderTable();
  updateExchFilterUI();
}

// 🚀 [추가] 모든 거래소 필터 상태 해제 함수
export function resetExchFilters() {
  if (!store.exchFilterStates) return;
  Object.keys(store.exchFilterStates).forEach((key) => {
    store.exchFilterStates[key] = 0;
  });
  store.exchFilterMode = "AND"; // 🚀 리셋 시 결합 조건도 AND 기본값으로 회귀
  store.currentRenderLimit = 1000;
  renderTable();
  updateExchFilterUI();
}

// 🚀 [추가] 거래소 필터 프리셋 저장/선택/삭제 기능 (라디오 버튼 방식 + 개별 저장/삭제 버튼)
export function selectExchPreset(index) {
  // 이미 활성화된 프리셋을 다시 누르면 선택 해제
  if (store.activePresetIndex === index) {
    store.activePresetIndex = undefined;
    if (store.exchFilterStates) {
      Object.keys(store.exchFilterStates).forEach((key) => {
        store.exchFilterStates[key] = 0;
      });
    }
    store.exchFilterMode = "AND";
    store.currentRenderLimit = 1000;
    renderTable();
    updateExchFilterUI();
    return;
  }

  store.activePresetIndex = index;

  let presets = JSON.parse(
    localStorage.getItem("sellnance_exch_presets") || "[]",
  );
  const preset = presets[index];
  if (preset) {
    store.exchFilterStates = { ...preset.states };
    store.exchFilterMode = preset.mode || "AND";
  } else {
    if (store.exchFilterStates) {
      Object.keys(store.exchFilterStates).forEach((key) => {
        store.exchFilterStates[key] = 0;
      });
    }
    store.exchFilterMode = "AND";
  }
  store.currentRenderLimit = 1000;
  renderTable();
  updateExchFilterUI();
}

export function saveCurrentPreset() {
  const index = store.activePresetIndex ?? 0;
  if (!store.exchFilterStates) return;

  let presets = JSON.parse(
    localStorage.getItem("sellnance_exch_presets") || "[]",
  );
  while (presets.length < 5) {
    presets.push(null);
  }

  presets[index] = {
    states: { ...store.exchFilterStates },
    mode: store.exchFilterMode || "AND",
  };

  localStorage.setItem("sellnance_exch_presets", JSON.stringify(presets));
  updateExchFilterUI();

  if (window.Swal) {
    window.Swal.fire({
      toast: true,
      position: "bottom-end",
      icon: "success",
      title: `프리셋 ${index + 1} 저장됨`,
      showConfirmButton: false,
      timer: 2000,
      background: "var(--panel)",
      color: "var(--text)",
    });
  }
}

export function deleteCurrentPreset() {
  const index = store.activePresetIndex ?? 0;
  let presets = JSON.parse(
    localStorage.getItem("sellnance_exch_presets") || "[]",
  );
  while (presets.length < 5) {
    presets.push(null);
  }

  presets[index] = null;
  localStorage.setItem("sellnance_exch_presets", JSON.stringify(presets));

  // 삭제 시 현재 활성화된 필터도 함께 초기화합니다.
  if (store.exchFilterStates) {
    Object.keys(store.exchFilterStates).forEach((key) => {
      store.exchFilterStates[key] = 0;
    });
  }
  store.exchFilterMode = "AND";
  store.currentRenderLimit = 1000;
  renderTable();

  updateExchFilterUI();

  if (window.Swal) {
    window.Swal.fire({
      toast: true,
      position: "bottom-end",
      icon: "info",
      title: `프리셋 ${index + 1} 삭제됨`,
      showConfirmButton: false,
      timer: 2000,
      background: "var(--panel)",
      color: "var(--text)",
    });
  }
}

export function updateFavoritesCount() {
  const f1 = JSON.parse(localStorage.getItem("sellnance_favs") || "[]").length;
  const f2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]").length;
  const tabFav = document.getElementById("tab-fav");
  const tabFav2 = document.getElementById("tab-fav2");
  if (tabFav) tabFav.innerHTML = `<span style="color: #e3b30a; margin-right: 2px">★</span>` + (f1 > 0 ? `FAV (${f1})` : "FAV");
  if (tabFav2) tabFav2.innerHTML = `<span style="color: #3b82f6; margin-right: 2px">★</span>` + (f2 > 0 ? `FAV (${f2})` : "FAV");
}

window.updateFavoritesCount = updateFavoritesCount;
document.addEventListener("DOMContentLoaded", () =>
  setTimeout(updateFavoritesCount, 500),
);

// 🚀 커스텀 로그 스케일 필터 범위 변환 함수
export function sliderToMcap(v) {
  if (v <= 0) return 0;
  if (v <= 1) return v * 1000000;
  return Math.pow(10, v + 5);
}

export function mcapToSlider(m) {
  if (m <= 0) return 0;
  if (m <= 1000000) return m / 1000000;
  return Math.log10(m) - 5;
}

export function sliderToVol(v) {
  if (v <= 0) return 0;
  if (v <= 1) return v * 100000;
  return Math.pow(10, v + 4);
}

export function volToSlider(vol) {
  if (vol <= 0) return 0;
  if (vol <= 100000) return vol / 100000;
  return Math.log10(vol) - 4;
}

function formatFilterValue(val, isMcap) {
  if (val <= 0) return "0";
  if (isMcap) {
    if (val >= 1e12) return (val / 1e12).toFixed(2) + "T";
    if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
    if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
    return val.toLocaleString();
  } else {
    if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
    if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
    if (val >= 1e3) return (val / 1e3).toFixed(2) + "K";
    return val.toLocaleString();
  }
}

function formatKoreanMoney(usdVal) {
  const rate = store.marketDataMap?.krw_usd_rate || 1400;
  const krwVal = usdVal * rate;
  if (krwVal <= 0) return "0원";
  if (krwVal >= 1e12) {
    return `${(krwVal / 1e12).toFixed(2)}조 원`;
  }
  if (krwVal >= 1e8) {
    return `${(krwVal / 1e8).toFixed(2)}억 원`;
  }
  if (krwVal >= 1e6) {
    return `${(krwVal / 1e6).toFixed(0)}백만 원`;
  }
  if (krwVal >= 1e4) {
    return `${(krwVal / 1e4).toFixed(0)}만 원`;
  }
  return `${krwVal.toFixed(0)}원`;
}

export function updateCustomFilterUI() {
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");
  const mcapRangeText = document.getElementById("mcap-range-text");
  const mcapHighlight = document.getElementById("mcap-track-highlight");

  const minVolEl = document.getElementById("vol-min");
  const maxVolEl = document.getElementById("vol-max");
  const volRangeText = document.getElementById("vol-range-text");
  const volHighlight = document.getElementById("vol-track-highlight");

  if (minMcapEl && maxMcapEl && mcapRangeText && mcapHighlight) {
    const minVal = parseFloat(minMcapEl.value);
    const maxVal = parseFloat(maxMcapEl.value);
    const minPct = (minVal / 8) * 100;
    const maxPct = (maxVal / 8) * 100;
    mcapHighlight.style.left = minPct + "%";
    mcapHighlight.style.width = maxPct - minPct + "%";

    const realMin = sliderToMcap(minVal);
    const realMax = sliderToMcap(maxVal);

    const usdMin = realMin <= 0 ? "0" : `${formatFilterValue(realMin, true)}`;
    const usdMax = `${formatFilterValue(realMax, true)}`;
    const krwMin = formatKoreanMoney(realMin);
    const krwMax = formatKoreanMoney(realMax);

    mcapRangeText.innerHTML = `
      <div class="font-semibold text-theme-accent text-[11.5px]">${usdMin} ~ ${usdMax}</div>
      <div class="text-theme-text opacity-60 text-[10px] mt-0.5">${krwMin} ~ ${krwMax}</div>
    `;

    store.tempMcapMin = realMin;
    store.tempMcapMax = realMax;
  }

  if (minVolEl && maxVolEl && volRangeText && volHighlight) {
    const minVal = parseFloat(minVolEl.value);
    const maxVal = parseFloat(maxVolEl.value);
    const minPct = (minVal / 7) * 100;
    const maxPct = (maxVal / 7) * 100;
    volHighlight.style.left = minPct + "%";
    volHighlight.style.width = maxPct - minPct + "%";

    const realMin = sliderToVol(minVal);
    const realMax = sliderToVol(maxVal);

    const isUpbit = store.tempVolSource === "UPBIT";
    const usdMin = realMin <= 0 ? "0" : `${formatFilterValue(realMin, false)}`;
    const usdMax = `${formatFilterValue(realMax, false)}`;
    const krwMin = formatKoreanMoney(realMin);
    const krwMax = formatKoreanMoney(realMax);

    if (isUpbit) {
      volRangeText.innerHTML = `
        <div class="font-semibold text-theme-accent text-[11.5px]">${krwMin} ~ ${krwMax}</div>
        <div class="text-theme-text opacity-60 text-[10px] mt-0.5">${usdMin} ~ ${usdMax}</div>
      `;
    } else {
      volRangeText.innerHTML = `
        <div class="font-semibold text-theme-accent text-[11.5px]">${usdMin} ~ ${usdMax}</div>
        <div class="text-theme-text opacity-60 text-[10px] mt-0.5">${krwMin} ~ ${krwMax}</div>
      `;
    }

    store.tempVolMin = realMin;
    store.tempVolMax = realMax;
  }
}

export function toggleCustomFilter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("custom-filter-dropdown");
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains("hidden");

  // 타임프레임 드롭다운이 열려 있다면 닫음
  const tfDropdown = document.getElementById("tf-settings-dropdown");
  if (tfDropdown) {
    tfDropdown.classList.add("hidden", "opacity-0", "translate-y-[-10px]");
    tfDropdown.classList.remove("flex");
  }

  if (isHidden) {
    // 열 때 현재 커밋된 필터 값을 임시 변수로 동기화하고 UI 슬라이더에 반영
    store.tempMcapMin = store.customMcapMin;
    store.tempMcapMax = store.customMcapMax;
    store.tempVolMin = store.customVolMin;
    store.tempVolMax = store.customVolMax;
    store.tempVolSource = store.customVolSource;

    const minMcapEl = document.getElementById("mcap-min");
    const maxMcapEl = document.getElementById("mcap-max");
    const minVolEl = document.getElementById("vol-min");
    const maxVolEl = document.getElementById("vol-max");

    if (minMcapEl) minMcapEl.value = mcapToSlider(store.customMcapMin);
    if (maxMcapEl) maxMcapEl.value = mcapToSlider(store.customMcapMax);
    if (minVolEl) minVolEl.value = volToSlider(store.customVolMin);
    if (maxVolEl) maxVolEl.value = volToSlider(store.customVolMax);

    // 볼륨 소스 버튼 UI 복구
    const btnBinance = document.getElementById("vol-source-binance");
    const btnUpbit = document.getElementById("vol-source-upbit");
    if (store.tempVolSource === "BINANCE") {
      if (btnBinance)
        btnBinance.className =
          "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
      if (btnUpbit)
        btnUpbit.className =
          "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
    } else {
      if (btnBinance)
        btnBinance.className =
          "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
      if (btnUpbit)
        btnUpbit.className =
          "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
    }

    updateCustomFilterUI();

    const btn = document.getElementById("btn-custom-filter");
    if (btn) {
      const parent = document.getElementById("control-panel-parent");
      const parentRect = parent.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const relativeTop = btnRect.bottom - parentRect.top + 6;

      dropdown.style.top = `${relativeTop}px`;
      dropdown.style.left = "auto";
      dropdown.style.right = "8px";
    }

    dropdown.classList.remove("hidden");
    dropdown.classList.add("flex");
    setTimeout(() => {
      dropdown.classList.remove("opacity-0", "translate-y-[-10px]");
      dropdown.classList.add("opacity-100", "translate-y-0");
    }, 10);
  } else {
    dropdown.classList.add("opacity-0", "translate-y-[-10px]");
    dropdown.classList.remove("opacity-100", "translate-y-0");
    setTimeout(() => {
      dropdown.classList.add("hidden");
      dropdown.classList.remove("flex");
    }, 200);
  }
}

export function setVolSource(source) {
  store.tempVolSource = source;
  const btnBinance = document.getElementById("vol-source-binance");
  const btnUpbit = document.getElementById("vol-source-upbit");

  if (source === "BINANCE") {
    if (btnBinance)
      btnBinance.className =
        "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
    if (btnUpbit)
      btnUpbit.className =
        "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
  } else {
    if (btnBinance)
      btnBinance.className =
        "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";
    if (btnUpbit)
      btnUpbit.className =
        "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
  }

  updateCustomFilterUI();
}

export function applyCustomFilter() {
  // 임시 변수 값을 실제 커스텀 필터 변수로 복사 (적용 버튼을 누를 때만 테이블이 필터링됨)
  store.customMcapMin = store.tempMcapMin;
  store.customMcapMax = store.tempMcapMax;
  store.customVolMin = store.tempVolMin;
  store.customVolMax = store.tempVolMax;
  store.customVolSource = store.tempVolSource;

  // 테이블 렌더링 호출
  store.currentRenderLimit = 1000;
  renderTable();

  // 드롭다운 닫기
  toggleCustomFilter();
}

export function resetCustomFilter() {
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");
  const minVolEl = document.getElementById("vol-min");
  const maxVolEl = document.getElementById("vol-max");

  if (minMcapEl) minMcapEl.value = 0;
  if (maxMcapEl) maxMcapEl.value = 8;
  if (minVolEl) minVolEl.value = 0;
  if (maxVolEl) maxVolEl.value = 7;

  // 즉시 임시 값들을 기본값으로 리셋
  store.tempMcapMin = 0;
  store.tempMcapMax = 10000000000000;
  store.tempVolMin = 0;
  store.tempVolMax = 100000000000;
  store.tempVolSource = "BINANCE";

  // 실제 필터 값도 리셋
  store.customMcapMin = 0;
  store.customMcapMax = 10000000000000;
  store.customVolMin = 0;
  store.customVolMax = 100000000000;
  store.customVolSource = "BINANCE";

  updateCustomFilterUI();

  // 볼륨 소스 버튼 UI 복구
  const btnBinance = document.getElementById("vol-source-binance");
  const btnUpbit = document.getElementById("vol-source-upbit");
  if (btnBinance)
    btnBinance.className =
      "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
  if (btnUpbit)
    btnUpbit.className =
      "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";

  store.currentRenderLimit = 1000;
  renderTable();
}

window.toggleCustomFilter = toggleCustomFilter;
window.setVolSource = setVolSource;
window.applyCustomFilter = applyCustomFilter;
window.resetCustomFilter = resetCustomFilter;

// 슬라이더 및 드롭다운 외부 클릭 바인딩
document.addEventListener("DOMContentLoaded", () => {
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");
  const minVolEl = document.getElementById("vol-min");
  const maxVolEl = document.getElementById("vol-max");

  if (minMcapEl && maxMcapEl) {
    minMcapEl.addEventListener("input", () => {
      if (parseFloat(minMcapEl.value) > parseFloat(maxMcapEl.value)) {
        minMcapEl.value = maxMcapEl.value;
      }
      updateCustomFilterUI();
    });
    maxMcapEl.addEventListener("input", () => {
      if (parseFloat(maxMcapEl.value) < parseFloat(minMcapEl.value)) {
        maxMcapEl.value = minMcapEl.value;
      }
      updateCustomFilterUI();
    });
  }

  if (minVolEl && maxVolEl) {
    minVolEl.addEventListener("input", () => {
      if (parseFloat(minVolEl.value) > parseFloat(maxVolEl.value)) {
        minVolEl.value = maxVolEl.value;
      }
      updateCustomFilterUI();
    });
    maxVolEl.addEventListener("input", () => {
      if (parseFloat(maxVolEl.value) < parseFloat(minVolEl.value)) {
        maxVolEl.value = minVolEl.value;
      }
      updateCustomFilterUI();
    });
  }

  // 빈 트랙 영역 클릭 시 가까운 핸들을 이동시키는 UX 개선 기능
  const setupTrackClick = (containerId, minElId, maxElId, maxSliderVal) => {
    const container = document.getElementById(containerId);
    const minEl = document.getElementById(minElId);
    const maxEl = document.getElementById(maxElId);
    if (!container || !minEl || !maxEl) return;

    container.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;

      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const pct = Math.max(0, Math.min(1, clickX / width));
      const clickedVal = pct * maxSliderVal;

      const minVal = parseFloat(minEl.value);
      const maxVal = parseFloat(maxEl.value);

      const distMin = Math.abs(clickedVal - minVal);
      const distMax = Math.abs(clickedVal - maxVal);

      if (distMin < distMax) {
        minEl.value = Math.min(clickedVal, maxVal).toFixed(1);
      } else {
        maxEl.value = Math.max(clickedVal, minVal).toFixed(1);
      }

      updateCustomFilterUI();
    });
  };

  setupTrackClick("mcap-slider-container", "mcap-min", "mcap-max", 8);
  setupTrackClick("vol-slider-container", "vol-min", "vol-max", 7);

  // 외부 영역 클릭 시 드롭다운 닫기
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("custom-filter-dropdown");
    const btn = document.getElementById("btn-custom-filter");
    if (
      dropdown &&
      btn &&
      !dropdown.contains(e.target) &&
      !btn.contains(e.target)
    ) {
      if (!dropdown.classList.contains("hidden")) {
        dropdown.classList.add("opacity-0", "translate-y-[-10px]");
        dropdown.classList.remove("opacity-100", "translate-y-0");
        setTimeout(() => {
          dropdown.classList.add("hidden");
          dropdown.classList.remove("flex");
        }, 200);
      }
    }
  });

  setTimeout(updateCustomFilterUI, 100);
});
