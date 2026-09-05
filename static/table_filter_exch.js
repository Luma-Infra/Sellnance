// table_filter_exch.js
// 거래소 다중 필터(AND/OR/ONLY) 및 5대 프리셋 관리 전담 모듈

import { store } from "./_store.js";
import { renderTable } from "./table_render.js";
import { saveControlPanelSession } from "./table_filter.js";
import { showToast } from "./ui_dialog.js";

// 🚀 거래소 필터링 개별 사이클 조절 함수
export function toggleExchFilter(exchId, event) {
  if (event) event.preventDefault();

  const current = store.exchFilterStates[exchId] || 0;

  // 모든 버튼은 동일하게 해제(0) -> 포함(1) -> 제외(-1) -> 해제(0)
  if (current === 0) store.exchFilterStates[exchId] = 1;
  else if (current === 1) store.exchFilterStates[exchId] = -1;
  else store.exchFilterStates[exchId] = 0;

  // 렌더러 리밋 초기화 후 테이블 갱신
  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();

  // 상단 필터 UI 배지 및 스타일 동적 갱신
  updateExchFilterUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();
}

// 🚀 상단 거래소 필터바 및 프리셋 상태 표시 업데이트
export function updateExchFilterUI() {
  const mainContainer = document.getElementById("exchange-filter-container");
  const customContainer = document.getElementById("custom-exchange-filter-container");
  if (!mainContainer && !customContainer) return;

  const list = [
    { id: "BINANCE_SPOT", cmcId: 270, label: "S", name: "B-SPOT" },
    { id: "BINANCE_FUTURES", cmcId: 270, label: "F", name: "B-FUT" },
    { id: "BINANCE_STOCK", cmcId: 270, label: "ST", name: "B-STOCK" },
    { id: "UPBIT", cmcId: 351, name: "UPBIT" },
    { id: "BITHUMB", cmcId: 200, name: "BITHUMB" },
    { id: "BYBIT_SPOT", cmcId: 521, label: "S", name: "BYBIT" },
    { id: "BYBIT_FUTURES", cmcId: 521, label: "F", name: "BYB-F" },
    { id: "OKX_SPOT", cmcId: 294, name: "OKX" },
    { id: "BITGET_SPOT", cmcId: 513, name: "BITGET" },
    { id: "GATEIO_SPOT", cmcId: 302, name: "GATEIO" },
    { id: "COINBASE_SPOT", cmcId: 89, name: "COINBASE" },
  ];

  // 🚀 3단 스위치 모드 토글 HTML (AND / OR / ONLY)
  const currentMode = store.exchFilterMode || "AND";
  const modeLabels = { AND: "AND", OR: "OR", ONLY: "ONLY" };

  let modeBtnClass = "bg-theme-panel/10 border-theme-border/30 text-theme-text";
  if (currentMode === "AND") {
    modeBtnClass = "bg-theme-accent/20 border-theme-accent text-theme-accent font-bold";
  } else if (currentMode === "OR") {
    modeBtnClass = "bg-green-500/10 border-green-500/50 text-green-400 font-bold";
  } else if (currentMode === "ONLY") {
    modeBtnClass = "bg-orange-500/25 border-orange-500/80 text-orange-400 font-bold";
  }

  // 1️⃣ [PC 상단 메인 필터바 (#exchange-filter-container)] - 스크롤 원천 차단 & 1줄 균등/쾌적 배치
  if (mainContainer) {
    const pcModeToggleHtml = `
      <button onclick="window.switchExchFilterMode()" 
              class="flex items-center justify-center border rounded-xl transition-all duration-300 text-[9.5px] font-bold tracking-tight hover:scale-105 active:scale-95 shrink-0 select-none cursor-pointer ${modeBtnClass}" 
              style="width: 52px; min-width: 52px; max-width: 52px; height: 34px;"
              title="조건 결합 모드 (AND -> OR -> ONLY 순환)">
        ${modeLabels[currentMode]}
      </button>
    `;

    const pcResetBtnHtml = `
      <button onclick="window.resetExchFilters()" 
              class="flex items-center justify-center p-1 border border-theme-border/30 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 bg-theme-panel/10 hover:bg-theme-accent/20 hover:border-theme-accent text-theme-text opacity-70 hover:opacity-100 shrink-0 select-none cursor-pointer" 
              style="width: 34px; min-width: 34px; max-width: 34px; height: 34px;">
        <span class="text-[12px]">⟳</span>
      </button>
    `;

    const pcButtonsHtml = list
      .map((ex) => {
        const state = store.exchFilterStates[ex.id] || 0;

        let borderStyle = "border-theme-border/30";
        let filterStyle = "filter: grayscale(1); opacity: 0.45;";
        let bgStyle = "background: transparent;";

        if (state === 1) {
          borderStyle = "border-theme-accent";
          bgStyle = "background: color-mix(in srgb, var(--accent) 12%, transparent);";
          filterStyle = "filter: none; opacity: 1;";
        } else if (state === -1) {
          borderStyle = "border-theme-down";
          filterStyle = "filter: grayscale(0.5) contrast(0.8); opacity: 0.85;";
          bgStyle = "background: rgba(239, 83, 80, 0.1);";
        }

        let stateBadge = "";
        if (state === 1) {
          stateBadge = `<div class="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] w-3 h-3 flex items-center justify-center rounded-full leading-none font-bold scale-[0.85] shadow-sm">✓</div>`;
        } else if (state === -1) {
          stateBadge = `<div class="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-3 h-3 flex items-center justify-center rounded-full leading-none font-bold scale-[0.85] shadow-sm">✕</div>`;
        }

        let typeBadge = "";
        if (ex.id === "BINANCE_SPOT" || ex.id === "BYBIT_SPOT") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-gray-600 text-white text-[8px] px-0.5 rounded leading-none font-black shadow-sm">S</div>`;
        } else if (ex.id === "BINANCE_FUTURES" || ex.id === "BYBIT_FUTURES") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-[#f0b90b] text-black text-[8px] px-0.5 rounded leading-none font-black shadow-sm">F</div>`;
        } else if (ex.id === "BINANCE_STOCK") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] px-0.5 rounded leading-none font-black shadow-sm">ST</div>`;
        }

        const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
        const imgStyle = ex.id === "BINANCE_STOCK" ? "filter: hue-rotate(180deg);" : "";

        return `
        <button onclick="window.toggleExchFilter('${ex.id}', event)" 
                oncontextmenu="event.preventDefault(); window.toggleExchExclude('${ex.id}');"
                class="relative flex items-center justify-center p-1 border rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shrink-0 ${borderStyle}"
                style="width: 34px; min-width: 34px; max-width: 34px; height: 34px; ${bgStyle} ${filterStyle}" title="${ex.name || ex.id} (클릭: 순환 토글 / 우클릭: 제외 토글)">
          <img src="${imgUrl}" alt="${ex.name || ex.id}" class="w-full h-full object-contain rounded" style="${imgStyle}" />
          ${stateBadge}
          ${typeBadge}
        </button>
      `;
      })
      .join("");

    mainContainer.innerHTML = pcButtonsHtml + pcModeToggleHtml + pcResetBtnHtml;
  }

  // 2️⃣ [모바일 커스텀 필터 모달 (#custom-exchange-filter-container)] - 7x2 그리드 유지
  if (customContainer) {
    const mobModeToggleHtml = `
      <button onclick="window.switchExchFilterMode()" 
              class="flex items-center justify-center px-1 border rounded-xl transition-all duration-300 h-9 text-[9.5px] font-bold tracking-tight hover:scale-105 active:scale-95 col-span-2 w-full select-none cursor-pointer ${modeBtnClass}" 
              title="조건 결합 모드 (AND -> OR -> ONLY 순환)">
        ${modeLabels[currentMode]}
      </button>
    `;

    const mobResetBtnHtml = `
      <button onclick="window.resetExchFilters()" 
              class="flex items-center justify-center p-1 border border-theme-border/30 rounded-xl transition-all duration-300 w-full h-9 hover:scale-105 active:scale-95 bg-theme-panel/10 hover:bg-theme-accent/20 hover:border-theme-accent text-theme-text opacity-70 hover:opacity-100 shrink-0 col-span-1 cursor-pointer select-none" 
              title="필터 초기화">
        <span class="text-[12px]">⟳</span>
      </button>
    `;

    const mobButtonsHtml = list
      .map((ex) => {
        const state = store.exchFilterStates[ex.id] || 0;

        let borderStyle = "border-theme-border/30";
        let filterStyle = "filter: grayscale(1); opacity: 0.45;";
        let bgStyle = "background: transparent;";

        if (state === 1) {
          borderStyle = "border-theme-accent";
          bgStyle = "background: color-mix(in srgb, var(--accent) 12%, transparent);";
          filterStyle = "filter: none; opacity: 1;";
        } else if (state === -1) {
          borderStyle = "border-theme-down";
          filterStyle = "filter: grayscale(0.5) contrast(0.8); opacity: 0.85;";
          bgStyle = "background: rgba(239, 83, 80, 0.1);";
        }

        let stateBadge = "";
        if (state === 1) {
          stateBadge = `<div class="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] w-3 h-3 flex items-center justify-center rounded-full leading-none font-bold scale-[0.85] shadow-sm">✓</div>`;
        } else if (state === -1) {
          stateBadge = `<div class="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-3 h-3 flex items-center justify-center rounded-full leading-none font-bold scale-[0.85] shadow-sm">✕</div>`;
        }

        let typeBadge = "";
        if (ex.id === "BINANCE_SPOT" || ex.id === "BYBIT_SPOT") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-gray-600 text-white text-[8px] px-0.5 rounded leading-none font-black shadow-sm">S</div>`;
        } else if (ex.id === "BINANCE_FUTURES" || ex.id === "BYBIT_FUTURES") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-[#f0b90b] text-black text-[8px] px-0.5 rounded leading-none font-black shadow-sm">F</div>`;
        } else if (ex.id === "BINANCE_STOCK") {
          typeBadge = `<div class="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] px-0.5 rounded leading-none font-black shadow-sm">ST</div>`;
        }

        const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
        const imgStyle = ex.id === "BINANCE_STOCK" ? "filter: hue-rotate(180deg);" : "";

        return `
        <button onclick="window.toggleExchFilter('${ex.id}', event)" 
                oncontextmenu="event.preventDefault(); window.toggleExchExclude('${ex.id}');"
                class="relative flex items-center justify-center p-1.5 border rounded-xl transition-all duration-300 w-full h-9 hover:scale-105 active:scale-95 shrink-0 col-span-1 ${borderStyle}"
                style="${bgStyle} ${filterStyle}" title="${ex.name || ex.id} (클릭: 순환 토글 / 우클릭: 제외 토글)">
          <img src="${imgUrl}" alt="${ex.name || ex.id}" class="w-full h-full object-contain rounded" style="${imgStyle}" />
          ${stateBadge}
          ${typeBadge}
        </button>
      `;
      })
      .join("");

    customContainer.innerHTML = mobButtonsHtml + mobModeToggleHtml + mobResetBtnHtml;
  }

  // 🚀 아랫줄의 #exchange-presets-container 프리셋 제어바 렌더링
  const presetContainers = document.querySelectorAll(
    "#exchange-presets-container, #custom-exchange-presets-container",
  );
  if (presetContainers.length > 0) {
    let presets = JSON.parse(
      localStorage.getItem("sellnance_exch_presets") || "[]",
    );
    while (presets.length < 5) presets.push(null);

    const presetButtonsHtml = presets
      .map((preset, idx) => {
        const hasPreset = !!preset;
        const num = idx + 1;
        const isActive = store.activePresetIndex === idx;

        let title = `프리셋 ${num}\n`;
        let btnStyle = "";

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
            btnStyle =
              "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold shadow-xs ring-1 ring-theme-accent/30";
          } else {
            btnStyle =
              "border-theme-border/70 text-theme-text/90 bg-theme-panel/30 hover:border-theme-accent/60 hover:text-theme-accent hover:bg-theme-panel/60 font-semibold";
          }
        } else {
          title += "(비어 있음 - 선택 후 우측에서 저장 가능)";
          if (isActive) {
            btnStyle =
              "border-theme-accent text-theme-accent bg-theme-accent/15 font-bold shadow-xs ring-1 ring-theme-accent/30";
          } else {
            btnStyle =
              "border-theme-border/30 text-theme-text/40 bg-theme-panel/10 hover:border-theme-border/60 hover:text-theme-text/70 hover:bg-theme-panel/30";
          }
        }

        return `
        <button onclick="window.selectExchPreset(${idx})" 
                class="flex items-center justify-center border rounded-md text-[10px] w-6 h-6 transition-all duration-200 shrink-0 cursor-pointer active:scale-95 ${btnStyle}"
                title="${title}">
          P${num}
        </button>
      `;
      })
      .join("");

    const pcPresetsContainer = document.getElementById("exchange-presets-container");
    const mobPresetsContainer = document.getElementById("custom-exchange-presets-container");

    const isPresetActive = store.activePresetIndex !== undefined;
    const currentPresetNum = (store.activePresetIndex ?? 0) + 1;

    // 🚀 느좋(감성 & 미니멀) 캡슐형 저장/삭제 툴바: 촌스러운 원색 테두리 제거 및 고감도 글래스모피즘 적용
    const actionGroupHtml = `
      <div class="inline-flex items-center p-0.5 rounded-lg border border-theme-border/40 bg-theme-panel/30 backdrop-blur-xs transition-all duration-200 ${isPresetActive ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}">
        <button onclick="window.saveCurrentPreset()" 
                class="flex items-center justify-center w-5.5 h-5.5 rounded-md text-theme-text/50 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-90 transition-all duration-150 cursor-pointer"
                title="현재 필터 설정을 P${currentPresetNum}에 저장">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
        <div class="w-px h-3 bg-theme-border/40 mx-0.5"></div>
        <button onclick="window.deleteCurrentPreset()" 
                class="flex items-center justify-center w-5.5 h-5.5 rounded-md text-theme-text/50 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all duration-150 cursor-pointer"
                title="P${currentPresetNum} 프리셋 데이터 삭제">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    if (pcPresetsContainer) {
      pcPresetsContainer.innerHTML = `
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[9px] font-bold opacity-60 mr-0.5 uppercase tracking-wider text-theme-text whitespace-nowrap">프리셋</span>
          ${presetButtonsHtml}
          <div class="ml-1.5 flex items-center">
            ${actionGroupHtml}
          </div>
        </div>
      `;
    }

    if (mobPresetsContainer) {
      mobPresetsContainer.innerHTML = `
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[9px] font-bold opacity-60 mr-1 uppercase tracking-wider text-theme-text whitespace-nowrap">프리셋</span>
            ${presetButtonsHtml}
          </div>
          <div class="flex items-center shrink-0">
            ${actionGroupHtml}
          </div>
        </div>
      `;
    }
  }
}

// 🚀 3단 결합 조건 모드 스위칭 함수 (AND -> OR -> ONLY -> AND)
export function switchExchFilterMode() {
  const current = store.exchFilterMode || "AND";
  if (current === "AND") store.exchFilterMode = "OR";
  else if (current === "OR") store.exchFilterMode = "ONLY";
  else store.exchFilterMode = "AND";

  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();
  updateExchFilterUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();
}

// 🚀 우클릭 시 제외(-1) 상태로 다이렉트 변환하는 편의 지름길 함수
export function toggleExchExclude(exchId) {
  const current = store.exchFilterStates[exchId] || 0;
  if (current === -1) {
    store.exchFilterStates[exchId] = 0; // 이미 제외면 해제
  } else {
    store.exchFilterStates[exchId] = -1; // 아니면 즉시 제외 적용
  }
  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();
  updateExchFilterUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();
}

// 🚀 모든 거래소 필터 상태 해제 함수
export function resetExchFilters() {
  if (!store.exchFilterStates) return;
  Object.keys(store.exchFilterStates).forEach((key) => {
    store.exchFilterStates[key] = 0;
  });
  store.exchFilterMode = "AND"; // 리셋 시 결합 조건도 AND 기본값으로 회귀
  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();
  updateExchFilterUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();
}

// 🚀 거래소 필터 프리셋 저장/선택/삭제 기능
export function selectExchPreset(index) {
  if (store.activePresetIndex === index) {
    store.activePresetIndex = undefined;
    if (store.exchFilterStates) {
      Object.keys(store.exchFilterStates).forEach((key) => {
        store.exchFilterStates[key] = 0;
      });
    }
    store.exchFilterMode = "AND";
    store.currentRenderLimit = 1000;
    if (typeof renderTable === "function") renderTable();
    updateExchFilterUI();
    if (typeof saveControlPanelSession === "function") saveControlPanelSession();
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
  if (typeof renderTable === "function") renderTable();
  updateExchFilterUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();
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

  showToast(`프리셋 ${index + 1} 저장됨`, "success", 2000);
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

  if (store.exchFilterStates) {
    Object.keys(store.exchFilterStates).forEach((key) => {
      store.exchFilterStates[key] = 0;
    });
  }
  store.exchFilterMode = "AND";
  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();

  updateExchFilterUI();

  showToast(`프리셋 ${index + 1} 삭제됨`, "info", 2000);
}

// 글로벌 window 바인딩
if (typeof window !== "undefined") {
  window.toggleExchFilter = toggleExchFilter;
  window.updateExchFilterUI = updateExchFilterUI;
  window.switchExchFilterMode = switchExchFilterMode;
  window.toggleExchExclude = toggleExchExclude;
  window.resetExchFilters = resetExchFilters;
  window.selectExchPreset = selectExchPreset;
  window.saveCurrentPreset = saveCurrentPreset;
  window.deleteCurrentPreset = deleteCurrentPreset;
}
