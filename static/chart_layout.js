// chart_layout.js
import { store } from "./_store.js";

// [추가] 차트 패널 (볼륨, 김프) 토글 관리자
export function togglePane(paneName) {
  store.paneConfig[paneName] = !store.paneConfig[paneName];
  applyChartLayout();
}

let isDraggingResizer = null;

export function toggleVolFallback(visible) {
  const fallback = document.querySelector(".kimchi-vol-fallback");
  if (fallback) {
    if (visible) {
      fallback.classList.remove("hidden");
    } else {
      fallback.classList.add("hidden");
    }
  }
}

export function applyChartLayout() {
  if (store.blockChartResize) return;
  if (!store.chart || !store.candleSeries) return;

  const v = !!store.paneConfig?.volume;
  const k = !!store.paneConfig?.kimchi;

  const paneMain = document.getElementById("pane-main");
  const paneVol = document.getElementById("pane-vol");
  const rVol = document.getElementById("resizer-vol");

  // 1. 메인 차트 컨테이너 전체 채우기 & 레거시 컨테이너 숨김
  if (paneMain) {
    paneMain.style.flex = "1";
    paneMain.style.height = "100%";
    paneMain.style.width = "100%";
  }
  if (paneVol) paneVol.style.display = "none";
  if (rVol) rVol.style.display = "none";

  // 2. 모바일(768px 미만)에서는 좌측 스케일을 접고, PC에서는 김프 활성화 시 노출
  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth < 768;
  const isKimchiActuallyVisible =
    k && !store.isKimchiDisabled && !isSmallMobile;

  store.chart.applyOptions({
    leftPriceScale: {
      visible: isKimchiActuallyVisible,
      borderColor: "transparent",
    },
  });

  // 3. 네이티브 페인 비율 제어 (볼륨/김프 활성화 여부에 따라 동적 전환)
  if (v || k) {
    const s1 = store.chartSplits?.s1 || 0.75;
    if (store.candlePane) store.candlePane.setStretchFactor(s1);
    if (store.volPane) store.volPane.setStretchFactor(1 - s1);
  } else {
    // 볼륨/김프 모두 비활성화 시 하단 페인 접기
    if (store.candlePane) store.candlePane.setStretchFactor(1);
    if (store.volPane) store.volPane.setStretchFactor(0.0001);
  }

  // 4. 시리즈 가시성 반영
  if (store.volumeSeries) {
    store.volumeSeries.applyOptions({ visible: v });
  }
  if (store.kimchiSeries) {
    store.kimchiSeries.applyOptions({ visible: isKimchiActuallyVisible });
  }

  // 5. 김프 비교군 스위처 위치 연동
  const kimchiSwitcher = document.getElementById("kimchi-switcher");
  if (kimchiSwitcher) {
    if (isKimchiActuallyVisible) {
      kimchiSwitcher.style.display = "flex";
      kimchiSwitcher.style.top = "auto";
      const subRatio = v || k ? 1 - (store.chartSplits?.s1 || 0.75) : 0;
      kimchiSwitcher.style.bottom = `calc(${subRatio * 100}% - 30px)`;
    } else {
      kimchiSwitcher.style.display = "none";
    }
  }

  // 6. 타임존 버튼 동기화
  if (typeof window.mountTimezoneButton === "function") {
    window.mountTimezoneButton();
  }
}

// 2. 드래그 엔진 초기화
export function initResizers() {
  if (window._resizersInitialized) return; // 중복 등록 차단
  window._resizersInitialized = true;

  const wrapper = document.getElementById("chart-wrapper");
  const rVol = document.getElementById("resizer-vol");

  let touchStartY = null;
  let touchStartX = null;
  let touchHoldTimer = null;
  let isTouchCommitted = false;

  const beginCommitDrag = () => {
    isDraggingResizer = true;
    window._isDraggingResizer = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    if (rVol) rVol.classList.add("resizer-active");
    if (typeof window.clearAllCrosshairs === "function") {
      window.clearAllCrosshairs();
    }
  };

  const startDragMouse = (e) => {
    beginCommitDrag();
  };

  const startDragTouch = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartY = t.clientY;
    touchStartX = t.clientX;
    isTouchCommitted = false;

    // 터치 시 크로스헤어가 켜져있다면 해제하여 간섭 차단
    if (typeof window.clearAllCrosshairs === "function") {
      window.clearAllCrosshairs();
    }

    // [UX 개선] 꾹 누르거나(160ms 이상 터치 유지) 수직으로 확실하게 드래그할 때만 리사이저 반응
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    touchHoldTimer = setTimeout(() => {
      touchHoldTimer = null;
      isTouchCommitted = true;
      beginCommitDrag();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch (_) {}
      }
    }, 160);
  };

  if (rVol) {
    rVol.addEventListener("mousedown", startDragMouse);
    rVol.addEventListener("touchstart", startDragTouch, { passive: true });
  }

  const handleDragMove = (clientY) => {
    if (!isDraggingResizer) return;
    const rect = wrapper.getBoundingClientRect();
    let pct = (clientY - rect.top) / rect.height;

    if (pct < 0.2) pct = 0.2;
    if (pct > 0.9) pct = 0.9;
    store.chartSplits.s1 = pct;
    if (typeof window.applyChartLayout === "function")
      window.applyChartLayout();
  };

  window.addEventListener("mousemove", (e) => {
    handleDragMove(e.clientY);
  });

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];

      if (!isTouchCommitted && touchStartY !== null) {
        const dy = Math.abs(t.clientY - touchStartY);
        const dx = Math.abs(t.clientX - touchStartX);

        // 수직 이동이 10px 이상이고 수평보다 확실히 클 때 드래그 개시
        if (dy > 10 && dy > dx * 1.2) {
          if (touchHoldTimer) {
            clearTimeout(touchHoldTimer);
            touchHoldTimer = null;
          }
          isTouchCommitted = true;
          beginCommitDrag();
        } else if (dx > 12 && dx > dy) {
          // 수평 차트 스크롤인 경우 리사이저 대기 즉시 취소
          if (touchHoldTimer) {
            clearTimeout(touchHoldTimer);
            touchHoldTimer = null;
          }
          touchStartY = null;
          touchStartX = null;
          return;
        }
      }

      if (isDraggingResizer) {
        if (e.cancelable) {
          e.preventDefault();
        }
        handleDragMove(t.clientY);
      }
    },
    { passive: false },
  );

  const endDrag = () => {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
    touchStartY = null;
    touchStartX = null;
    isTouchCommitted = false;

    if (isDraggingResizer) {
      isDraggingResizer = false;
      window._isDraggingResizer = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
      if (rVol) rVol.classList.remove("resizer-active");
    }

    // 네이티브 멀티페인 조절선 또는 드래그바 조작 후 비율 저장
    saveCurrentPaneSplitRatio();
  };

  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchend", endDrag, { passive: true });
  window.addEventListener("touchcancel", endDrag, { passive: true });
}

// [네이티브 페인 조절선 비율 로컬 스토리지 저장]
export function saveCurrentPaneSplitRatio() {
  if (!store.chart) return;
  const panes = store.chart.panes();
  if (!panes || panes.length < 2) return;

  try {
    let candleStretch = 0;
    let totalStretch = 0;
    for (const p of panes) {
      const sf = p.getStretchFactor();
      totalStretch += sf;
      if (
        p === store.candlePane ||
        (store.candleSeries && p.getSeries().includes(store.candleSeries))
      ) {
        candleStretch = sf;
      }
    }
    if (totalStretch > 0 && candleStretch > 0) {
      const ratio = Math.round((candleStretch / totalStretch) * 1000) / 1000;
      if (ratio >= 0.1 && ratio <= 0.9) {
        if (!store.chartSplits) store.chartSplits = {};
        store.chartSplits.s1 = ratio;
        localStorage.setItem("sellnance_chart_split_s1", String(ratio));
      }
    }
  } catch (e) {}
}

window.togglePane = togglePane;
window.applyChartLayout = applyChartLayout;
window.initResizers = initResizers;
window.saveCurrentPaneSplitRatio = saveCurrentPaneSplitRatio;
window.toggleVolFallback = toggleVolFallback;

// 뷰 모드 전환 시 차트만 resize (table/quickview 사이드 이펙트 방지)
window.addEventListener("viewModeChanged", () => {
  applyChartLayout();
});

// 창 크기 변경 시 768px 모바일 경계에서 좌측 여백(0px <-> 60px) 자동 스위칭
let chartResizeDebounce = null;
window.addEventListener("resize", () => {
  if (chartResizeDebounce) clearTimeout(chartResizeDebounce);
  chartResizeDebounce = setTimeout(() => {
    applyChartLayout();
  }, 100);
});
