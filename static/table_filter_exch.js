// table_filter_exch.js
// 거래소 다중 필터(AND/OR/ONLY) 및 5대 프리셋 관리 전담 모듈

import { store } from "./_store.js";
import { renderTable } from "./table_render.js";
import { saveControlPanelSession } from "./table_filter.js";

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
  const container = document.getElementById("exchange-filter-container");
  if (!container) return;

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

  const modeToggleHtml = `
    <button onclick="window.switchExchFilterMode()" 
            class="flex items-center justify-center px-2 border rounded-xl transition-all duration-300 h-9 text-[9px] min-w-[54px] hover:scale-105 active:scale-95 ${modeBtnClass}" 
            title="조건 결합 모드 (클릭하여 AND -> OR -> ONLY 순환)">
      ${modeLabels[currentMode]}
    </button>
  `;

  // 🚀 우측 끝에 초기화(리셋) 버튼
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
              class="relative flex items-center justify-center p-1.5 border rounded-xl transition-all duration-300 w-9 h-9 hover:scale-105 active:scale-95 ${borderStyle}"
              style="${bgStyle} ${filterStyle}" title="${ex.name || ex.id} (클릭: 순환 토글 / 우클릭: 제외 토글)">
        <img src="${imgUrl}" alt="${ex.name || ex.id}" class="w-full h-full object-contain rounded" style="${imgStyle}" />
        ${stateBadge}
        ${typeBadge}
      </button>
    `;
    })
    .join("");

  container.innerHTML = buttonsHtml + modeToggleHtml + resetBtnHtml;

  // 🚀 아랫줄의 #exchange-presets-container 프리셋 제어바 렌더링
  const presetsContainer = document.getElementById("exchange-presets-container");
  if (presetsContainer) {
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

  if (store.exchFilterStates) {
    Object.keys(store.exchFilterStates).forEach((key) => {
      store.exchFilterStates[key] = 0;
    });
  }
  store.exchFilterMode = "AND";
  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();

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
