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

  const v = store.paneConfig.volume;
  const k = store.paneConfig.kimchi;

  const paneMain = document.getElementById("pane-main");
  const paneVol = document.getElementById("pane-vol");
  const rVol = document.getElementById("resizer-vol");

  // 1. 시리즈 & 스케일 표시/숨김 설정
  if (store.volumeSeries) {
    store.volumeSeries.applyOptions({ visible: v });
    store.chartVol.priceScale("right").applyOptions({ visible: v });
  }

  // [반응형 좌측 여백] 768px 미만(모바일)이면 좌측 스케일을 접어서 캔버스 확장, 768px 이상(PC/태블릿)이면 60px 수직 정렬 항상 고정
  // 김프 비교 끄기/켜기 시에도 상하 차트의 좌측 스케일을 일치시켜 캔버스 시작점과 크로스헤어 수직선을 오차 없이 일치시키기
  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth < 768;

  const isKimchiActuallyVisible = !!k && !store.isKimchiDisabled;

  // ON일 때는 둘 다 64px, OFF일 때는 둘 다 0px로 일치 (OFF 시 캔버스 확장)
  const leftWidth = !isSmallMobile && isKimchiActuallyVisible ? 64 : 0;
  const isLeftVisible = leftWidth > 0;

  const leftScaleOptions = {
    visible: isLeftVisible,
    minimumWidth: leftWidth,
    borderColor: "transparent",
  };

  if (store.chart) {
    store.chart.priceScale("left").applyOptions(leftScaleOptions);
  }
  if (store.chartVol) {
    store.chartVol.priceScale("left").applyOptions(leftScaleOptions);
  }

  if (store.kimchiSeries) {
    store.kimchiSeries.applyOptions({ visible: isKimchiActuallyVisible });
  }

  // 2. 패널 표시/숨김 및 플렉스 비율
  let mainFlex = 1,
    subFlex = 0;

  if (v || k) {
    if (paneVol) paneVol.style.display = "block";
    if (rVol) rVol.style.display = "block";
    mainFlex = store.chartSplits.s1 || 0.75;
    subFlex = 1 - mainFlex;
  } else {
    if (paneVol) paneVol.style.display = "none";
    if (rVol) rVol.style.display = "none";
    mainFlex = 1;
    subFlex = 0;
  }

  if (paneMain) paneMain.style.flex = `${mainFlex}`;
  if (paneVol) paneVol.style.flex = `${subFlex}`;

  // X축(시간) 스케일 중복 방지
  if (store.chart) store.chart.timeScale().applyOptions({ visible: !v && !k });
  if (store.chartVol)
    store.chartVol.timeScale().applyOptions({ visible: v || k });

  // [리사이즈 비동기 스케줄링] DOM 너비/높이 측정에 따른 Reflow 및 캔버스 중복 resize 방지
  // [성능 최적화] 실제 너비/높이 값이 달라졌을 때만 resize를 호출하여 불필요한 DOM Reflow 렉 차단
  if (store.chart && paneMain) {
    requestAnimationFrame(() => {
      if (store.chart && paneMain) {
        const w = paneMain.clientWidth;
        const h = paneMain.clientHeight;
        if (
          w > 0 &&
          h > 0 &&
          (store.mainWidthCache !== w || store.mainHeightCache !== h)
        ) {
          store.mainWidthCache = w;
          store.mainHeightCache = h;
          store.chart.resize(w, h);
        }
      }
    });
  }
  if (store.chartVol && paneVol) {
    requestAnimationFrame(() => {
      if (store.chartVol && paneVol) {
        const w = paneVol.clientWidth;
        const h = paneVol.clientHeight;

        if (
          w > 0 &&
          h > 0 &&
          (store.volWidthCache !== w || store.volHeightCache !== h)
        ) {
          store.volWidthCache = w;
          store.volHeightCache = h;
          store.chartVol.resize(w, h);
        }
      }
    });
  }

  // 김프 비교군 스위처 (pane-vol 영역 상단 위치) 연동
  const kimchiSwitcher = document.getElementById("kimchi-switcher");
  if (kimchiSwitcher) {
    if (isKimchiActuallyVisible) {
      kimchiSwitcher.style.display = "flex";
      kimchiSwitcher.style.top = "auto";
      kimchiSwitcher.style.bottom = `calc(${subFlex * 100}% - 30px)`;
    } else {
      kimchiSwitcher.style.display = "none";
    }
  }

  // [추가] 활성 차트 패널에 맞춘 타임존 버튼 동기화
  if (typeof window.mountTimezoneButton === "function") {
    window.mountTimezoneButton();
  }

  // 상하 차트 좌우 스케일 폭 실시간 동기화 트리거
  if (typeof window.syncPriceScaleWidths === "function") {
    window.syncPriceScaleWidths();
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
      try {
        if (store.chartSplits?.s1) {
          localStorage.setItem(
            "sellnance_chart_split_s1",
            String(store.chartSplits.s1),
          );
        }
      } catch (e) {}
    }
  };

  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchend", endDrag, { passive: true });
  window.addEventListener("touchcancel", endDrag, { passive: true });
}

window.togglePane = togglePane;
window.applyChartLayout = applyChartLayout;
window.initResizers = initResizers;
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
