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
    const q = store.searchQuery.toUpperCase();
    filteredData = filteredData.filter((r) => {
      const disp = (r.DisplayTicker || "").toUpperCase();
      const name = (r.Name || "").toUpperCase();
      const sym = (r.Symbol || "").toUpperCase();
      const raw = (r.Ticker || "").toUpperCase();
      return disp.includes(q) || name.includes(q) || sym.includes(q) || raw.includes(q);
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
  if (store.currentSelectedSymbol && typeof window.selectSymbol === "function") {
    // 탭 전환 등 기타 요인을 배제하고, 동일 심볼에 대해 currentMarket을 재산출하여 차트/헤더를 업데이트하도록 재호출
    window.selectSymbol(store.currentSelectedSymbol);
  }
}

export function switchView(mode) {
  store.viewMode = mode;
  document.getElementById("view-detailed").className =
    mode === "detailed"
      ? "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all bg-theme-accent text-white shadow-sm"
      : "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all text-theme-text opacity-50 hover:opacity-100";
  document.getElementById("view-simple").className =
    mode === "simple"
      ? "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all bg-theme-accent text-white shadow-sm"
      : "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all text-theme-text opacity-50 hover:opacity-100";

  renderTable();
}

export function toggleCurrency() {
  store.currencyMode = store.currencyMode === "USD" ? "KRW" : "USD";
  store.lang = store.currencyMode === "USD" ? "EN" : "KR";
  const btn = document.getElementById("currency-toggle");
  if (btn) {
    btn.innerText = store.currencyMode === "USD" ? "USD ($) / EN" : "KRW (₩) / KR";
  }
  renderTable();

  if (store.currentSelectedSymbol) {
    const allSource = store.originalTableData || store.currentTableData || [];
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
            class="flex items-center justify-center px-2 border rounded-xl transition-all duration-300 h-8 text-[9px] min-w-[54px] hover:scale-105 active:scale-95 ${modeBtnClass}" 
            title="조건 결합 모드 (클릭하여 AND -> OR -> ONLY 순환)">
      ${modeLabels[currentMode]}
    </button>
  `;

  // 🚀 우측 끝에 깔끔하게 초기화(리셋) 버튼 추가
  const resetBtnHtml = `
    <button onclick="window.resetExchFilters()" 
            class="flex items-center justify-center p-1 border border-theme-border/30 rounded-xl transition-all duration-300 w-8 h-8 hover:scale-105 active:scale-95 bg-theme-panel/10 hover:bg-theme-accent/20 hover:border-theme-accent text-theme-text opacity-70 hover:opacity-100" 
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
              class="relative flex items-center justify-center p-1.5 border rounded-xl transition-all duration-300 w-8 h-8 hover:scale-105 active:scale-95 ${borderStyle}"
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
  const presetsContainer = document.getElementById("exchange-presets-container");
  if (presetsContainer) {
    let presets = JSON.parse(localStorage.getItem("sellnance_exch_presets") || "[]");
    while (presets.length < 5) presets.push(null);

    // 선택된 프리셋이 없을 때는 저장/삭제 버튼을 숨기기 위해 undefined 유지
    // if (store.activePresetIndex === undefined) {
    //   store.activePresetIndex = 0;
    // }

    const presetButtonsHtml = presets.map((preset, idx) => {
      const hasPreset = !!preset;
      const num = idx + 1;
      const isActive = store.activePresetIndex === idx;

      let title = `프리셋 ${num}\n`;
      let borderStyle = "border-theme-border/30 text-theme-text opacity-40 hover:opacity-100 hover:scale-105 bg-theme-panel/5";

      if (hasPreset) {
        const incs = Object.entries(preset.states).filter(([_, s]) => s === 1).map(([k]) => k.replace("BINANCE_", "B-"));
        const decs = Object.entries(preset.states).filter(([_, s]) => s === -1).map(([k]) => k.replace("BINANCE_", "B-"));

        title += `결합모드: ${preset.mode}\n`;
        if (incs.length > 0) title += `포함: ${incs.join(", ")}\n`;
        if (decs.length > 0) title += `제외: ${decs.join(", ")}\n`;
        title += `(클릭: 선택 및 불러오기)`;

        if (isActive) {
          borderStyle = "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold scale-105 ring-2 ring-theme-accent/20";
        } else {
          borderStyle = "border-theme-border text-theme-accent/70 bg-theme-panel/30 hover:border-theme-accent hover:text-theme-accent hover:scale-105";
        }
      } else {
        title += "(비어 있음 - 선택 후 우측 [저장] 클릭 시 저장)";
        if (isActive) {
          borderStyle = "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold scale-105 ring-2 ring-theme-accent/20";
        }
      }

      return `
        <button onclick="window.selectExchPreset(${idx})" 
                class="flex items-center justify-center border rounded-xl text-[9px] w-6 h-6 transition-all duration-300 font-bold ${borderStyle}"
                title="${title}">
          P${num}
        </button>
      `;
    }).join("");

    presetsContainer.innerHTML = `
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[9px] font-bold opacity-60 mr-1 uppercase tracking-wider text-theme-text">거래소 프리셋 </span>
        ${presetButtonsHtml}
      </div>
      <div class="flex items-center gap-1.5 shrink-0 transition-opacity duration-300 ${store.activePresetIndex !== undefined ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'}">
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

  let presets = JSON.parse(localStorage.getItem("sellnance_exch_presets") || "[]");
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

  let presets = JSON.parse(localStorage.getItem("sellnance_exch_presets") || "[]");
  while (presets.length < 5) {
    presets.push(null);
  }

  presets[index] = {
    states: { ...store.exchFilterStates },
    mode: store.exchFilterMode || "AND"
  };

  localStorage.setItem("sellnance_exch_presets", JSON.stringify(presets));
  updateExchFilterUI();

  if (window.Swal) {
    window.Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: `프리셋 ${index + 1} 저장됨`, showConfirmButton: false, timer: 2000, background: 'var(--panel)', color: 'var(--text)' });
  }
}

export function deleteCurrentPreset() {
  const index = store.activePresetIndex ?? 0;
  let presets = JSON.parse(localStorage.getItem("sellnance_exch_presets") || "[]");
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
    window.Swal.fire({ toast: true, position: 'bottom-end', icon: 'info', title: `프리셋 ${index + 1} 삭제됨`, showConfirmButton: false, timer: 2000, background: 'var(--panel)', color: 'var(--text)' });
  }
}

export function updateFavoritesCount() {
  const f1 = JSON.parse(localStorage.getItem("sellnance_favs") || "[]").length;
  const f2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]").length;
  const tabFav = document.getElementById("tab-fav");
  const tabFav2 = document.getElementById("tab-fav2");
  if (tabFav) tabFav.innerText = f1 > 0 ? `FAV (${f1})` : "FAV";
  if (tabFav2) tabFav2.innerText = f2 > 0 ? `FAV2 (${f2})` : "FAV2";
}

window.updateFavoritesCount = updateFavoritesCount;
document.addEventListener("DOMContentLoaded", () => setTimeout(updateFavoritesCount, 500));
