// chart_sync.js - 🚀 메인/볼륨/김프 멀티 차트 간 시간축, 가격축 너비, 스케일 모드 및 줌 동기화 전담 엔진
import { store } from "./_store.js";
import { resetChartScale } from "./chart_utils.js";
import { syncCrosshair } from "./chart_crosshair.js";

export { syncCrosshair };


// ==========================================
// 2. 가로 시간축(TimeScale) 1:1 상호 동기화 엔진
// ==========================================
let isSyncingRange = false;
export function syncTimeScales(sourceChart, targetChart) {
  if (!sourceChart || !targetChart) return;
  sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (isSyncingRange || !range) return;
    isSyncingRange = true;
    try {
      targetChart.timeScale().setVisibleLogicalRange(range);
    } finally {
      isSyncingRange = false;
    }
  });
}

// ==========================================
// 3. Y축(Price Scale) 가로폭 락킹 & 동기화 엔진
// ==========================================
let currentMaxRight = 0;
let isSyncingWidth = false;
let lastWidthSyncTime = 0;
let widthSyncPending = false;

export const performSyncPriceScaleWidths = (force = false) => {
  const c1 = store.chart;
  const c2 = store.chartVol;
  if (!c1 && !c2 || isSyncingWidth) return;
  isSyncingWidth = true;

  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  const isKimchiVisible =
    !!store.paneConfig?.kimchi && !store.isKimchiDisabled;
  const BASE_LEFT_WIDTH = !isSmallMobile && isKimchiVisible ? 60 : 0;

  try {
    if (force) {
      currentMaxRight = 0;
      store.savedPriceScaleWidth = null;
      if (c1) {
        c1.priceScale("right").applyOptions({
          minimumWidth: 0,
          autoScale: !store.isPriceScaleUserZoomed,
        });
      }
      if (c2) {
        c2.priceScale("right").applyOptions({
          minimumWidth: 0,
          autoScale: !store.isVolPriceScaleUserZoomed,
        });
      }
    }

    let measuredRight = 0;
    if (c1) {
      const rWidth = c1.priceScale("right").width();
      if (rWidth > measuredRight) measuredRight = rWidth;
    }
    if (c2) {
      const rWidth = c2.priceScale("right").width();
      if (rWidth > measuredRight) measuredRight = rWidth;
    }

    // 🚀 [원자적 상하 우측 너비 일치] 메인과 볼륨 중 더 넓은 너비로 단일 틱에서 양방향 완벽 동기화 (덜그럭 0%)
    const targetWidth = Math.max(currentMaxRight, measuredRight);

    if (targetWidth > 0 && (targetWidth !== currentMaxRight || force)) {
      currentMaxRight = targetWidth;
      store.savedPriceScaleWidth = targetWidth;
      if (c1) {
        c1.priceScale("right").applyOptions({
          minimumWidth: targetWidth,
          autoScale: !store.isPriceScaleUserZoomed,
        });
      }
      if (c2) {
        c2.priceScale("right").applyOptions({
          minimumWidth: targetWidth,
          autoScale: !store.isVolPriceScaleUserZoomed,
        });
      }
    }

    // 🚀 좌측 김프 스케일: 메인/볼륨 모두 60px 완전 불변 고정하여 김프 데이터 유입 시 메인 차트 1px 흔들림 100% 원천 차단
    if (c1 && c1.priceScale("left").width() !== BASE_LEFT_WIDTH && BASE_LEFT_WIDTH > 0) {
      c1.priceScale("left").applyOptions({ minimumWidth: BASE_LEFT_WIDTH, visible: true });
    }
    if (c2 && c2.priceScale("left").width() !== BASE_LEFT_WIDTH && BASE_LEFT_WIDTH > 0) {
      c2.priceScale("left").applyOptions({ minimumWidth: BASE_LEFT_WIDTH, visible: true });
    }
  } finally {
    isSyncingWidth = false;
  }
};

export const syncPriceScaleWidths = (force = false) => {
  if (window.isResettingWidth) return;
  if (force) {
    performSyncPriceScaleWidths(true);
    return;
  }

  if (widthSyncPending) return;
  const now = performance.now();
  if (now - lastWidthSyncTime < 100) return;
  widthSyncPending = true;

  requestAnimationFrame(() => {
    widthSyncPending = false;
    lastWidthSyncTime = performance.now();
    performSyncPriceScaleWidths(false);
  });
};

export const resetPriceScaleWidthSync = () => {
  window.isResettingWidth = true;
  currentMaxRight = 0;
  store.isPriceScaleUserZoomed = false;
  store.isVolPriceScaleUserZoomed = false;
  store.isKimchiPriceScaleUserZoomed = false;
  store.savedPriceScaleWidth = null;

  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  const isKimchiVisible =
    !!store.paneConfig?.kimchi && !store.isKimchiDisabled;
  const BASE_LEFT_WIDTH = !isSmallMobile && isKimchiVisible ? 60 : 0;

  const c1 = store.chart;
  const c2 = store.chartVol;
  if (c1) {
    c1.priceScale("right").applyOptions({ minimumWidth: 0, autoScale: true });
    c1.priceScale("left").applyOptions({ minimumWidth: BASE_LEFT_WIDTH, visible: BASE_LEFT_WIDTH > 0, autoScale: true });
  }
  if (c2) {
    c2.priceScale("right").applyOptions({ minimumWidth: 0, autoScale: true });
    c2.priceScale("left").applyOptions({ minimumWidth: BASE_LEFT_WIDTH, visible: BASE_LEFT_WIDTH > 0, autoScale: true });
  }

  if (typeof updateScaleModeButtonsUI === "function") updateScaleModeButtonsUI();
  window.isResettingWidth = false;
};

// ==========================================
// 4. 스케일 모드 버튼(A / L) UI 및 오버레이 엔진
// ==========================================
export function updateScaleModeButtonsUI() {
  const mainL = document.getElementById("main-scale-l-btn");
  const volL = document.getElementById("vol-scale-l-btn");

  const activeBtnClass =
    "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
  const inactiveBtnClass =
    "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-accent hover:text-white active:bg-theme-accent active:text-white border border-theme-border/30";

  if (mainL) {
    mainL.className = store.isLogMode ? activeBtnClass : inactiveBtnClass;
  }
  if (volL) {
    volL.className = store.isLogMode ? activeBtnClass : inactiveBtnClass;
  }
}

export function setupScaleModeButtons() {
  const mainA = document.getElementById("main-scale-a-btn");
  const mainL = document.getElementById("main-scale-l-btn");
  const volA = document.getElementById("vol-scale-a-btn");
  const volL = document.getElementById("vol-scale-l-btn");

  [mainA, mainL, volA, volL].forEach((btn) => {
    if (btn) {
      ["pointerdown", "mousedown", "touchstart", "dblclick"].forEach((evt) => {
        btn.addEventListener(evt, (e) => e.stopPropagation());
      });
    }
  });

  // [메인 패널 A 버튼] 오직 메인 autofit A 버튼에서만 우측 너비 0 리셋 -> 트뷰 자동 계산 -> 상하 max 너비 원자적 동기화 수행
  if (mainA) {
    mainA.onclick = (e) => {
      e.stopPropagation();
      store.isPriceScaleUserZoomed = false;
      if (store.chart) {
        store.chart.priceScale("right").applyOptions({ autoScale: true });
      }
      performSyncPriceScaleWidths(true);
      updateScaleModeButtonsUI();
    };
  }

  if (mainL) {
    mainL.onclick = (e) => {
      e.stopPropagation();
      if (window.toggleLogScale) window.toggleLogScale();
      updateScaleModeButtonsUI();
    };
  }

  // [거래량/김프 패널 A 버튼] 메인 차트 상태나 너비는 강제로 풀지 않고, 하단 Vol/Kimchi Y축만 독립 오토스케일 복구
  if (volA) {
    volA.onclick = (e) => {
      e.stopPropagation();
      store.isVolPriceScaleUserZoomed = false;
      store.isKimchiPriceScaleUserZoomed = false;
      if (store.chartVol) {
        store.chartVol.priceScale("right").applyOptions({ autoScale: true });
        store.chartVol.priceScale("left").applyOptions({ autoScale: true });
      }
      performSyncPriceScaleWidths(false);
      updateScaleModeButtonsUI();
    };
  }

  if (volL) {
    volL.onclick = (e) => {
      e.stopPropagation();
      if (window.toggleLogScale) window.toggleLogScale();
      updateScaleModeButtonsUI();
    };
  }

  updateScaleModeButtonsUI();
}

// ==========================================
// 5. 차트 전체 동기화 초기화 바인더
// ==========================================
export function initChartSync(elMain, elVol) {
  // 1. 크로스헤어 상호 연동
  syncCrosshair(store.chart, [
    { chart: store.chartVol, series: store.volumeSeries },
  ]);
  syncCrosshair(store.chartVol, [
    { chart: store.chart, series: store.candleSeries },
  ]);

  // 2. 가로 시간축 상호 연동
  if (store.chart && store.chartVol) {
    syncTimeScales(store.chart, store.chartVol);
    syncTimeScales(store.chartVol, store.chart);
  }

  // 3. 차트 크기 변경 시 가격축 너비 동기화
  if (store.chart) {
    store.chart.timeScale().subscribeSizeChange(() => syncPriceScaleWidths(false));
  }
  if (store.chartVol) {
    store.chartVol.timeScale().subscribeSizeChange(() => syncPriceScaleWidths(false));
  }

  // 4. 각 패널별 독립 더블 클릭 리셋
  if (elMain) {
    elMain.addEventListener("dblclick", () => {
      store.isPriceScaleUserZoomed = false;
      if (store.chart) {
        store.chart.priceScale("right").applyOptions({ autoScale: true });
      }
      performSyncPriceScaleWidths(true);
      updateScaleModeButtonsUI();
    });
  }
  if (elVol) {
    elVol.addEventListener("dblclick", () => {
      store.isVolPriceScaleUserZoomed = false;
      store.isKimchiPriceScaleUserZoomed = false;
      if (store.chartVol) {
        store.chartVol.priceScale("right").applyOptions({ autoScale: true });
        store.chartVol.priceScale("left").applyOptions({ autoScale: true });
      }
      performSyncPriceScaleWidths(true);
      updateScaleModeButtonsUI();
    });
  }

  // 5. 전역 헬퍼 바인딩
  window.syncPriceScaleWidths = syncPriceScaleWidths;
  window.resetPriceScaleWidthSync = resetPriceScaleWidthSync;
  window.setupScaleModeButtons = setupScaleModeButtons;
  window.updateScaleModeButtonsUI = updateScaleModeButtonsUI;

  resetPriceScaleWidthSync();
  setupScaleModeButtons();

  // 6. 드래그 인터랙션에 따른 상태 UI 동기화
  let dragStart = null;

  const handleScaleInteraction = (el, isMain, e) => {
    if (!el) return;

    // 휠 클릭(가운데 버튼 e.button === 1) 또는 우클릭은 스케일 조작에서 완전히 제외 (PASS)
    if (e.type === "mousedown" || e.type === "pointerdown") {
      if (e.button !== 0) return;
    }

    const clientX =
      e.clientX !== undefined
        ? e.clientX
        : e.touches && e.touches[0]
          ? e.touches[0].clientX
          : e.changedTouches && e.changedTouches[0]
            ? e.changedTouches[0].clientX
            : null;

    const clientY =
      e.clientY !== undefined
        ? e.clientY
        : e.touches && e.touches[0]
          ? e.touches[0].clientY
          : e.changedTouches && e.changedTouches[0]
            ? e.changedTouches[0].clientY
            : null;

    if (clientX === null) return;

    const targetEl = e.target;
    const td = targetEl ? targetEl.closest("td") : null;
    const tr = td ? td.parentElement : null;
    const tdIndex = tr ? Array.from(tr.children).indexOf(td) : -1;

    const rect = el.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const chartObj = isMain ? store.chart : store.chartVol;
    const rightScaleWidth = chartObj ? chartObj.priceScale("right").width() : 50;
    const leftScaleWidth = chartObj ? chartObj.priceScale("left").width() : 0;

    // 🚀 [엄격한 DOM 격리 분기] tdIndex 기준: 0=좌측스케일, 1=차트캔버스(절대침범금지), 2=우측스케일
    let isOverRightScale = false;
    let isOverLeftScale = false;

    if (tdIndex === 2) {
      isOverRightScale = true;
    } else if (tdIndex === 0 && leftScaleWidth > 0) {
      isOverLeftScale = true;
    } else if (tdIndex === 1) {
      // 캔버스 본체는 스케일 조작에서 100% 완전 제외 (오버레이/좌표 왜곡 원천 차단)
      isOverRightScale = false;
      isOverLeftScale = false;
    } else {
      // td를 직접 못 잡는 특수 상황의 보조 좌표 fallback
      isOverRightScale = cursorX >= rect.width - rightScaleWidth;
      isOverLeftScale = leftScaleWidth > 0 && cursorX <= leftScaleWidth;
    }

    // 마우스 좌클릭 드래그 감지 (단순 딸깍 클릭 무시, 실제 6px 이상 이동 시 수동 스케일 모드 플래그 활성화)
    if (e.type === "pointerdown" || e.type === "mousedown") {
      if (isOverRightScale || (!isMain && isOverLeftScale)) {
        dragStart = { isMain, isRight: isOverRightScale, startY: clientY, startX: clientX };
      }
      return;
    }

    if (e.type === "pointermove" || e.type === "mousemove") {
      if (dragStart && (e.buttons === 1 || e.which === 1)) {
        const deltaY = Math.abs(clientY - dragStart.startY);
        if (deltaY >= 6) {
          // 실제 6px 이상 수직 드래그하여 축을 늘리거나 줄인 경우에만 수동 모드 플래그 활성화
          if (dragStart.isMain && dragStart.isRight) {
            store.isPriceScaleUserZoomed = true;
          } else if (!dragStart.isMain && dragStart.isRight) {
            store.isVolPriceScaleUserZoomed = true;
          } else if (!dragStart.isMain && !dragStart.isRight) {
            store.isKimchiPriceScaleUserZoomed = true;
          }
          updateScaleModeButtonsUI();
          syncPriceScaleWidths(false);
          dragStart = null; // 1회 감지 후 리셋
        }
      }
      return;
    }

    if (e.type === "pointerup" || e.type === "mouseup" || e.type === "pointercancel") {
      dragStart = null;
    }
  };

  const onMainInteraction = (e) => handleScaleInteraction(elMain, true, e);
  const onVolInteraction = (e) => handleScaleInteraction(elVol, false, e);

  [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
  ].forEach((evt) => {
    if (elMain) elMain.addEventListener(evt, onMainInteraction, { passive: true, capture: true });
    if (elVol) elVol.addEventListener(evt, onVolInteraction, { passive: true, capture: true });
  });

  // 차트 영역 바깥에서 마우스를 뗐을 때도 안전하게 드래그 상태 해제
  if (typeof window !== "undefined") {
    window.addEventListener("pointerup", () => { dragStart = null; }, { passive: true });
    window.addEventListener("pointercancel", () => { dragStart = null; }, { passive: true });
  }
}

