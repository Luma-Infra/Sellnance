// table_filter_custom.js
// 시가총액 & 거래량 슬라이더 커스텀 필터 UI 및 연산 전담 모듈

import { store } from "./_store.js";
import { renderTable } from "./table_render.js";
import { saveControlPanelSession } from "./table_filter.js";

// 🚀 커스텀 로그 스케일 필터 범위 변환 함수
export function sliderToMcap(v) {
  const num = parseFloat(v);
  if (isNaN(num) || num <= 0) return 0;
  if (num <= 1) return num * 1000000;
  return Math.pow(10, num + 5);
}

export function mcapToSlider(m) {
  if (typeof m !== "number" || isNaN(m) || m <= 0) return 0;
  if (m <= 1000000) return m / 1000000;
  return Math.min(8, Math.max(0, Math.log10(m) - 5));
}

export function sliderToVol(v) {
  const num = parseFloat(v);
  if (isNaN(num) || num <= 0) return 0;
  if (num <= 1) return num * 100000;
  return Math.pow(10, num + 4);
}

export function volToSlider(vol) {
  if (typeof vol !== "number" || isNaN(vol) || vol <= 0) return 0;
  if (vol <= 100000) return vol / 100000;
  return Math.min(7, Math.max(0, Math.log10(vol) - 4));
}

export function formatFilterValue(val, isMcap) {
  if (typeof val !== "number" || isNaN(val) || val <= 0) return "0";
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

export function formatKoreanMoney(usdVal) {
  if (typeof usdVal !== "number" || isNaN(usdVal) || usdVal <= 0) return "0원";
  const rate = store.marketDataMap?.krw_usd_rate || 1;
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

// 🚀 커스텀 필터 버튼의 활성/비활성 하이라이트 동기화
export function syncCustomFilterBtnUI() {
  const btnCustom = document.getElementById("btn-custom-filter");
  if (!btnCustom) return;
  const isCustomActive =
    (store.customMcapMin && store.customMcapMin > 0) ||
    (store.customMcapMax && store.customMcapMax < 10000000000000) ||
    (store.customVolMin && store.customVolMin > 0) ||
    (store.customVolMax && store.customVolMax < 100000000000) ||
    (store.customVolSource && store.customVolSource !== "BINANCE");

  if (isCustomActive) {
    btnCustom.classList.remove("opacity-50");
    btnCustom.classList.add(
      "bg-theme-accent/20",
      "border-theme-accent",
      "text-theme-accent",
      "opacity-100",
      "active-custom-filter",
    );
  } else {
    btnCustom.classList.remove(
      "bg-theme-accent/20",
      "border-theme-accent",
      "text-theme-accent",
      "opacity-100",
      "active-custom-filter",
    );
    btnCustom.classList.add("opacity-50");
  }
}

// 🚀 슬라이더 UI 텍스트 및 트랙 하이라이트 실시간 갱신
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

// 🚀 커스텀 필터 팝업 위치 동적 계산 (recent-search-chips와 동일한 fixed 오버레이 방식)
export function positionCustomFilterDropdown(dropdown) {
  const btn = document.getElementById("btn-custom-filter");
  if (!btn || !dropdown) return;

  // 부모의 overflow-hidden 클리핑 및 쌓임 맥락(Stacking Context)을 원천 차단하기 위해 body 직속으로 마운트
  if (dropdown.parentElement !== document.body) {
    document.body.appendChild(dropdown);
  }

  const rect = btn.getBoundingClientRect();
  const dropdownWidth = Math.min(340, window.innerWidth - 16);

  dropdown.style.position = "fixed";
  dropdown.style.zIndex = "250";
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.style.left = `${Math.max(8, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8))}px`;
  dropdown.style.width = `${dropdownWidth}px`;
  dropdown.style.maxWidth = "calc(100vw - 16px)";
  dropdown.style.maxHeight = "calc(100dvh - 120px)";
  dropdown.style.overflowY = "auto";
}

// 🚀 커스텀 필터 팝업 열기/닫기 토글
export function toggleCustomFilter(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("custom-filter-dropdown");
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains("hidden");
  const chevron = document.getElementById("custom-filter-chevron");

  // 타임프레임 드롭다운이 열려 있다면 닫음
  const tfDropdown = document.getElementById("tf-settings-dropdown");
  if (tfDropdown && !tfDropdown.classList.contains("hidden")) {
    tfDropdown.classList.add("hidden", "opacity-0", "translate-y-[-10px]");
    tfDropdown.classList.remove("flex");
  }

  if (isHidden) {
    // 열 때 현재 커밋된 필터 값을 임시 변수로 동기화하고 UI 슬라이더에 반영
    store.tempMcapMin = typeof store.customMcapMin === "number" ? store.customMcapMin : 0;
    store.tempMcapMax = typeof store.customMcapMax === "number" ? store.customMcapMax : 10000000000000;
    store.tempVolMin = typeof store.customVolMin === "number" ? store.customVolMin : 0;
    store.tempVolMax = typeof store.customVolMax === "number" ? store.customVolMax : 100000000000;
    store.tempVolSource = store.customVolSource || "BINANCE";

    const minMcapEl = document.getElementById("mcap-min");
    const maxMcapEl = document.getElementById("mcap-max");
    const minVolEl = document.getElementById("vol-min");
    const maxVolEl = document.getElementById("vol-max");

    if (minMcapEl) minMcapEl.value = mcapToSlider(store.tempMcapMin);
    if (maxMcapEl) maxMcapEl.value = mcapToSlider(store.tempMcapMax);
    if (minVolEl) minVolEl.value = volToSlider(store.tempVolMin);
    if (maxVolEl) maxVolEl.value = volToSlider(store.tempVolMax);

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
    if (typeof window.updateExchFilterUI === "function") {
      window.updateExchFilterUI();
    }
    if (typeof window.restoreControlPanelUI === "function") {
      window.restoreControlPanelUI();
    }
    positionCustomFilterDropdown(dropdown);

    if (chevron) chevron.classList.add("rotate-180");

    dropdown.classList.remove("hidden");
    dropdown.classList.add("flex");
    void dropdown.offsetWidth; // 강제 리플로우 (차트 tf 설정과 동일)
    dropdown.classList.remove("opacity-0", "translate-y-[-10px]");
    dropdown.classList.add("opacity-100", "translate-y-0");
  } else {
    if (chevron) chevron.classList.remove("rotate-180");

    dropdown.classList.remove("opacity-100", "translate-y-0");
    dropdown.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => {
      dropdown.classList.remove("flex");
      dropdown.classList.add("hidden");
    }, 200);
  }
}

// 🚀 커스텀 드롭다운 내부 퀵 프리셋: Mcap < 1M 적용
export function toggleSmallCapFromCustom(event) {
  if (event) event.stopPropagation();
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");

  // Mcap 슬라이더를 0 ~ 1M (값 1)로 설정
  if (minMcapEl) minMcapEl.value = 0;
  if (maxMcapEl) maxMcapEl.value = 1;

  updateCustomFilterUI();
  applyCustomFilter();
}

// 🚀 거래량 소스(바낸/업비트) 선택
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

// 🚀 커스텀 필터 적용
export function applyCustomFilter() {
  store.customMcapMin = store.tempMcapMin;
  store.customMcapMax = store.tempMcapMax;
  store.customVolMin = store.tempVolMin;
  store.customVolMax = store.tempVolMax;
  store.customVolSource = store.tempVolSource;

  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();

  syncCustomFilterBtnUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();

  toggleCustomFilter();
}

// 🚀 커스텀 필터 기본값 리셋
export function resetCustomFilter() {
  const minMcapEl = document.getElementById("mcap-min");
  const maxMcapEl = document.getElementById("mcap-max");
  const minVolEl = document.getElementById("vol-min");
  const maxVolEl = document.getElementById("vol-max");

  if (minMcapEl) minMcapEl.value = 0;
  if (maxMcapEl) maxMcapEl.value = 8;
  if (minVolEl) minVolEl.value = 0;
  if (maxVolEl) maxVolEl.value = 7;

  store.tempMcapMin = 0;
  store.tempMcapMax = 10000000000000;
  store.tempVolMin = 0;
  store.tempVolMax = 100000000000;
  store.tempVolSource = "BINANCE";

  store.customMcapMin = 0;
  store.customMcapMax = 10000000000000;
  store.customVolMin = 0;
  store.customVolMax = 100000000000;
  store.customVolSource = "BINANCE";

  updateCustomFilterUI();

  const btnBinance = document.getElementById("vol-source-binance");
  const btnUpbit = document.getElementById("vol-source-upbit");
  if (btnBinance)
    btnBinance.className =
      "px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-accent text-white shadow-sm cursor-pointer";
  if (btnUpbit)
    btnUpbit.className =
      "px-2.5 py-0.5 rounded text-[10px] font-medium text-theme-text opacity-50 cursor-pointer";

  syncCustomFilterBtnUI();
  if (typeof saveControlPanelSession === "function") saveControlPanelSession();

  store.currentRenderLimit = 1000;
  if (typeof renderTable === "function") renderTable();
}

// 🚀 슬라이더 입력 및 트랙 클릭 이벤트 초기화 함수
export function initCustomFilterEvents() {
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
}

function handleOutsideCustomFilterClick(e) {
  const dropdown = document.getElementById("custom-filter-dropdown");
  if (!dropdown || dropdown.classList.contains("hidden")) return;

  if (
    e.target &&
    e.target.closest &&
    (e.target.closest("#btn-custom-filter") ||
      e.target.closest("#custom-filter-dropdown") ||
      e.target.closest("button[onclick*='toggleCustomFilter']"))
  ) {
    return;
  }

  toggleCustomFilter();
}

document.addEventListener("pointerdown", handleOutsideCustomFilterClick, true);

window.addEventListener("resize", () => {
  const dropdown = document.getElementById("custom-filter-dropdown");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    positionCustomFilterDropdown(dropdown);
  }
});

// 글로벌 window 바인딩
if (typeof window !== "undefined") {
  window.toggleCustomFilter = toggleCustomFilter;
  window.toggleSmallCapFromCustom = toggleSmallCapFromCustom;
  window.setVolSource = setVolSource;
  window.applyCustomFilter = applyCustomFilter;
  window.resetCustomFilter = resetCustomFilter;
  window.syncCustomFilterBtnUI = syncCustomFilterBtnUI;
  window.updateCustomFilterUI = updateCustomFilterUI;
  window.positionCustomFilterDropdown = positionCustomFilterDropdown;
}

