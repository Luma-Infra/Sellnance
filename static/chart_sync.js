// chart_sync.js - 트뷰 v5 네이티브 멀티 페인 컨트롤러 (위치 스왑, 패널 숨김, 스케일 관리 등)
import { store } from "./_store.js";
import { syncCrosshair } from "./chart_crosshair.js";

export { syncCrosshair };

// ==========================================
// 1. 페인(패널) 위치 스왑 & 숨김/표시 컨트롤러
// ==========================================

// [패널 위치 스왑]
export function swapChartPanes() {
  if (!store.chart) return;
  const panes = store.chart.panes();
  if (!panes || panes.length < 2) return;

  try {
    store.chart.swapPanes(0, 1);
    store.isPanesSwapped = !store.isPanesSwapped;
    try {
      localStorage.setItem(
        "sellnance_chart_panes_swapped",
        String(store.isPanesSwapped),
      );
    } catch (e) {}
    updateScaleModeButtonsUI();
  } catch (e) {
    console.warn("swapPanes error:", e);
  }
}
if (typeof window !== "undefined") {
  window.swapChartPanes = swapChartPanes;
}

// [거래량 & 김프 분리 및 통합 동적 전환]
export function toggleKimchiSplit() {
  if (!store.chart || !store.kimchiSeries) return;

  const panes = store.chart.panes();
  if (!panes || panes.length < 2) return;

  try {
    if (panes.length === 2) {
      // 2단 -> 3단 분리
      // 0. 분리 전 2단 상태의 vol 패널 높이 비율 저장 (통합 복귀 시 2개 합산이 아닌 원래 vol 높이로 정확히 돌아가기)
      const p0SF = panes[0].getStretchFactor();
      const p1SF = panes[1].getStretchFactor();
      const total2 = p0SF + p1SF;
      if (total2 > 0) {
        store.savedVolRatioBeforeSplit = p1SF / total2;
      }

      // 1. 김프용 새 페인 생성 (preserveEmptyPane: true)
      store.kimchiPane = store.chart.addPane(true);
      const newPanes = store.chart.panes();
      const kIndex = newPanes.length - 1;

      // 2. 김프 시리즈를 새 페인으로 이동
      store.kimchiSeries.moveToPane(kIndex);
      store.kimchiSeries.applyOptions({
        priceScaleId: "right",
      });

      // 3. 비율 분할 (65% : 20% : 15%)
      if (newPanes[0]) newPanes[0].setStretchFactor(0.65);
      if (newPanes[1]) newPanes[1].setStretchFactor(0.2);
      if (newPanes[2]) newPanes[2].setStretchFactor(0.15);

      store.isKimchiSplit = true;
    } else {
      // 3단 -> 2단 결합
      // 0. 3단 상태에서 거래량(vol) 페인만의 순수 높이 비율 측정
      const currentPanes = store.chart.panes();
      let volIdx = currentPanes.findIndex((p) =>
        p.getSeries().includes(store.volumeSeries),
      );
      if (volIdx < 0) volIdx = 1;

      let volStretch = 0.2;
      let totalStretch = 0;
      for (const p of currentPanes) {
        const sf = p.getStretchFactor();
        totalStretch += sf;
        if (p.getSeries().includes(store.volumeSeries)) {
          volStretch = sf;
        }
      }
      // 3단 상태에서 거래량(vol) 패널이 차지하던 순수 비율
      let targetVolRatio = totalStretch > 0 ? volStretch / totalStretch : 0.2;
      // 분리 전 기억된 2단 원래 vol 비율이 있다면 우선 반영하여 복원
      if (
        typeof store.savedVolRatioBeforeSplit === "number" &&
        store.savedVolRatioBeforeSplit > 0.05 &&
        store.savedVolRatioBeforeSplit < 0.6
      ) {
        targetVolRatio = store.savedVolRatioBeforeSplit;
      } else {
        targetVolRatio = Math.max(0.1, Math.min(0.4, targetVolRatio));
      }

      // 1. 김프 시리즈를 거래량 페인으로 이동
      store.kimchiSeries.moveToPane(volIdx);
      store.kimchiSeries.applyOptions({
        priceScaleId: "left",
      });

      // 2. 김프 단독 페인(이제 빈 페인이 된 페인) 찾아서 삭제
      const afterPanes = store.chart.panes();
      const emptyIdx = afterPanes.findIndex((p) => p.getSeries().length === 0);
      if (emptyIdx >= 0) {
        store.chart.removePane(emptyIdx);
      } else if (afterPanes.length >= 3) {
        store.chart.removePane(afterPanes.length - 1);
      }
      store.kimchiPane = null;

      // 3. 2단 비율 복구: 통합한 2개(vol + kimchi)를 합친 높이가 아니라,
      // 거래량(vol) 높이만큼만 하단 패널에 할당하고 메인 캔들 차트 높이를 원래대로 복원
      const remainingPanes = store.chart.panes();
      const candleRatio = 1 - targetVolRatio;
      if (remainingPanes[0]) remainingPanes[0].setStretchFactor(candleRatio);
      if (remainingPanes[1]) remainingPanes[1].setStretchFactor(targetVolRatio);

      if (!store.chartSplits) store.chartSplits = {};
      store.chartSplits.s1 = candleRatio;
      try {
        localStorage.setItem("sellnance_chart_split_s1", String(candleRatio));
      } catch (e) {}

      store.isKimchiSplit = false;
    }

    try {
      localStorage.setItem(
        "sellnance_chart_kimchi_split",
        String(store.isKimchiSplit),
      );
    } catch (e) {}
  } catch (e) {
    console.warn("toggleKimchiSplit error:", e);
  }

  updateScaleModeButtonsUI();
}
if (typeof window !== "undefined") {
  window.toggleKimchiSplit = toggleKimchiSplit;
}

// [트뷰 스타일 페인 위로 이동 ▲]
export function moveActivePaneUp() {
  if (!store.chart) return;
  const panes = store.chart.panes();
  if (!panes || panes.length < 2) return;

  try {
    if (panes.length === 2) {
      store.chart.swapPanes(0, 1);
      store.isPanesSwapped = !store.isPanesSwapped;
    } else if (panes.length >= 3) {
      // 3단 페인 순환 이동 (위로 순환)
      store.chart.swapPanes(1, 0);
      store.chart.swapPanes(2, 1);
      store.isPanesSwapped = !store.isPanesSwapped;
    }
    try {
      localStorage.setItem(
        "sellnance_chart_panes_swapped",
        String(store.isPanesSwapped),
      );
    } catch (e) {}
    updateScaleModeButtonsUI();
  } catch (e) {
    console.warn("moveActivePaneUp error:", e);
  }
}
if (typeof window !== "undefined") {
  window.moveActivePaneUp = moveActivePaneUp;
}

// [트뷰 스타일 페인 아래로 이동 ▼]
export function moveActivePaneDown() {
  if (!store.chart) return;
  const panes = store.chart.panes();
  if (!panes || panes.length < 2) return;

  try {
    if (panes.length === 2) {
      store.chart.swapPanes(0, 1);
      store.isPanesSwapped = !store.isPanesSwapped;
    } else if (panes.length >= 3) {
      // 3단 페인 순환 이동 (아래로 순환)
      store.chart.swapPanes(0, 1);
      store.chart.swapPanes(1, 2);
      store.isPanesSwapped = !store.isPanesSwapped;
    }
    try {
      localStorage.setItem(
        "sellnance_chart_panes_swapped",
        String(store.isPanesSwapped),
      );
    } catch (e) {}
    updateScaleModeButtonsUI();
  } catch (e) {
    console.warn("moveActivePaneDown error:", e);
  }
}
if (typeof window !== "undefined") {
  window.moveActivePaneDown = moveActivePaneDown;
}

// [볼륨/김프 패널 표시/숨김]
export function toggleVolPane(visible) {
  if (!store.chart || !store.volPane) return;

  try {
    if (visible) {
      if (store.isKimchiSplit && store.kimchiPane) {
        if (store.candlePane) store.candlePane.setStretchFactor(0.65);
        if (store.volPane) store.volPane.setStretchFactor(0.2);
        store.kimchiPane.setStretchFactor(0.15);
      } else {
        const s1 = store.chartSplits?.s1 || 0.75;
        if (store.candlePane) store.candlePane.setStretchFactor(s1);
        store.volPane.setStretchFactor(1 - s1);
      }
      if (store.volumeSeries) {
        store.volumeSeries.applyOptions({
          visible: !!store.paneConfig?.volume,
        });
      }
      if (store.kimchiSeries) {
        store.kimchiSeries.applyOptions({
          visible: !!store.paneConfig?.kimchi && !store.isKimchiDisabled,
        });
      }
    } else {
      if (store.candlePane) store.candlePane.setStretchFactor(1);
      if (store.volPane) store.volPane.setStretchFactor(0.0001);
      if (store.kimchiPane) store.kimchiPane.setStretchFactor(0.0001);
      if (store.volumeSeries)
        store.volumeSeries.applyOptions({ visible: false });
      if (store.kimchiSeries)
        store.kimchiSeries.applyOptions({ visible: false });
    }
  } catch (e) {
    console.warn("toggleVolPane error:", e);
  }
}
if (typeof window !== "undefined") {
  window.toggleVolPane = toggleVolPane;
}

// [김프 좌측 토글]
export function toggleKimchiScale(visible = null) {
  if (visible === null) {
    store.paneConfig.kimchi = !store.paneConfig.kimchi;
  } else {
    store.paneConfig.kimchi = !!visible;
  }

  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  const isKimchiActuallyVisible =
    !!store.paneConfig.kimchi && !store.isKimchiDisabled && !isSmallMobile;

  if (store.chart) {
    store.chart.applyOptions({
      leftPriceScale: {
        visible: isKimchiActuallyVisible && !store.isKimchiSplit,
      },
    });
  }
  if (store.kimchiSeries) {
    store.kimchiSeries.applyOptions({ visible: isKimchiActuallyVisible });
  }
}
if (typeof window !== "undefined") {
  window.toggleKimchiScale = toggleKimchiScale;
}

// ==========================================
// 2. 스케일 모드 버튼(A / L) UI 및 오버레이 엔진
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

  // 3단 분리 토글 버튼 UI 갱신
  const splitBtn = document.getElementById("pane-split-toggle-btn");
  const splitIcon = document.getElementById("pane-split-icon");
  const splitText = document.getElementById("pane-split-text");
  if (splitBtn) {
    if (store.isKimchiSplit) {
      splitBtn.className =
        "px-1.5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent gap-0.5";
      if (splitIcon) splitIcon.textContent = "⧈";
      if (splitText) splitText.textContent = "결합";
      splitBtn.title = "김프 합치기";
    } else {
      splitBtn.className =
        "px-1.5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-accent hover:text-white border border-theme-border/30 gap-0.5";
      if (splitIcon) splitIcon.textContent = "⧉";
      if (splitText) splitText.textContent = "분리";
      splitBtn.title = "김프 분리하기";
    }
  }
}

export function setupScaleModeButtons() {
  const mainA = document.getElementById("main-scale-a-btn");
  const mainL = document.getElementById("main-scale-l-btn");

  [mainA, mainL].forEach((btn) => {
    if (btn) {
      ["pointerdown", "mousedown", "touchstart", "dblclick"].forEach((evt) => {
        btn.addEventListener(evt, (e) => e.stopPropagation());
      });
    }
  });

  if (mainA) {
    mainA.onclick = (e) => {
      e.stopPropagation();
      // 상하 간격만 오토핏하고 time/가로 줌 간격은 초기화 안하도록 fitContent 제외
      store.isPriceScaleUserZoomed = false;
      store.isVolPriceScaleUserZoomed = false;
      store.isKimchiPriceScaleUserZoomed = false;
      if (store.chart) {
        store.chart.priceScale("right").applyOptions({ autoScale: true });
        store.chart.priceScale("left").applyOptions({ autoScale: true });
      }
      updateScaleModeButtonsUI();
    };
  }

  if (mainL) {
    mainL.onclick = (e) => {
      e.stopPropagation();
      store.isLogMode = !store.isLogMode;
      if (store.chart) {
        store.chart.priceScale("right").applyOptions({
          mode: store.isLogMode ? 1 : 0,
        });
      }
      updateScaleModeButtonsUI();
    };
  }
}

export function initChartSync() {
  setupScaleModeButtons();
  updateScaleModeButtonsUI();
}

// ==========================================
// 3. 레거시 호환용 No-Op 스텁
// ==========================================
export const performSyncPriceScaleWidths = () => {};
export const syncPriceScaleWidths = () => {};
export const syncTimeScales = () => {};
export const resetPriceScaleWidthSync = () => {
  store.isPriceScaleUserZoomed = false;
  store.isVolPriceScaleUserZoomed = false;
  store.isKimchiPriceScaleUserZoomed = false;
  updateScaleModeButtonsUI();
};
export function resetActivePointerChart() {}

if (typeof window !== "undefined") {
  window.performSyncPriceScaleWidths = performSyncPriceScaleWidths;
  window.syncPriceScaleWidths = syncPriceScaleWidths;
  window.resetPriceScaleWidthSync = resetPriceScaleWidthSync;
  window.syncTimeScales = syncTimeScales;
}
