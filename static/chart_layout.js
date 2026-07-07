// chart_layout.js
import { store } from './_store.js';

// 🚀 [추가] 차트 패널 (볼륨, 김프) 토글 관리자
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

  // 1. 시리즈 & 스케일 표시/숨김 설정 (김프가 볼륨 캔버스 안에 기생)
  if (store.volumeSeries) {
    store.volumeSeries.applyOptions({ visible: v });
    store.chartVol.priceScale("right").applyOptions({ visible: v });
  }

  // 🚀 [정렬 수정] 김프 데이터가 없더라도 좌측 스케일을 유지하여 상하 차트의 레이아웃 어긋남을 방지합니다.
  if (store.kimchiSeries) {
    store.kimchiSeries.applyOptions({ visible: !!k });
    // 항상 visible: true를 유지하되, k가 없을 때는 라벨만 숨기는 방식 등으로 정렬 유지
    store.chartVol.priceScale("left").applyOptions({
      visible: true,
      minimumWidth: 60,
      borderColor: "transparent" // 🚀 김프 활성화 시에도 좌측 검은 실선이 생기지 않도록 상시 투명 유지
    });

    // 메인 차트도 동일한 너비로 맞춰서 완벽한 수직 정렬 구현
    store.chart.priceScale("left").applyOptions({
      visible: true,
      minimumWidth: 60,
    });
  }

  // 2. 패널 표시/숨김 및 플렉스 비율
  let mainFlex = 1, subFlex = 0;

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

  // 🚀 X축(시간) 스케일 중복 방지
  if (store.chart) store.chart.timeScale().applyOptions({ visible: !v && !k });
  if (store.chartVol) store.chartVol.timeScale().applyOptions({ visible: v || k });

  // 🚀 [리사이즈 비동기 스케줄링] DOM 너비/높이 강제 측정 비용(Reflow) 및 캔버스 중복 resize 방지
  // [성능 최적화] 실제 너비/높이 값이 1px이라도 달라졌을 때만 resize를 호출하여 불필요한 DOM Reflow 렉 차단
  if (store.chart && paneMain) {
    requestAnimationFrame(() => {
      if (store.chart && paneMain) {
        const w = paneMain.clientWidth;
        const h = paneMain.clientHeight;
        if (w > 0 && h > 0 && (store.mainWidthCache !== w || store.mainHeightCache !== h)) {
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
        
        // 🚀 [높이 0px 방어] 컨테이너가 켜지는 과정에서 일시적으로 clientHeight가 0일 경우, 50ms 대기 후 재리사이즈 예약
        if (h === 0 && (v || k)) {
          setTimeout(() => {
            if (store.chartVol && paneVol) {
              const rw = paneVol.clientWidth;
              const rh = paneVol.clientHeight;
              if (rw > 0 && rh > 0) {
                store.volWidthCache = rw;
                store.volHeightCache = rh;
                store.chartVol.resize(rw, rh);
              }
            }
          }, 50);
        } else if (w > 0 && h > 0 && (store.volWidthCache !== w || store.volHeightCache !== h)) {
          store.volWidthCache = w;
          store.volHeightCache = h;
          store.chartVol.resize(w, h);
        }
      }
    });
  }

  // 🚀 김프 비교군 스위처 위치 연동
  const kimchiSwitcher = document.getElementById("kimchi-switcher");
  if (kimchiSwitcher) {
    if (k) {
      kimchiSwitcher.style.display = "flex";
      kimchiSwitcher.style.top = "auto";
      kimchiSwitcher.style.bottom = `calc(${subFlex * 100}% - 30px)`;
    } else {
      kimchiSwitcher.style.display = "none";
    }
  }
}


// 🚀 2. 드래그 엔진 초기화
export function initResizers() {
  if (window._resizersInitialized) return; // 🚀 중복 등록 차단 (렉 유발 1위 방어!)
  window._resizersInitialized = true;

  const wrapper = document.getElementById("chart-wrapper");
  const rVol = document.getElementById("resizer-vol");

  const startDrag = (e) => {
    isDraggingResizer = true;
    document.body.style.cursor = "row-resize";
  };

  if (rVol) rVol.addEventListener("mousedown", startDrag);

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingResizer) return;
    const rect = wrapper.getBoundingClientRect();
    let pct = (e.clientY - rect.top) / rect.height;

    if (pct < 0.2) pct = 0.2;
    if (pct > 0.9) pct = 0.9;
    store.chartSplits.s1 = pct;
    if (typeof window.applyChartLayout === "function") window.applyChartLayout();
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingResizer) {
      isDraggingResizer = false;
      document.body.style.cursor = "default";
    }
  });
}

window.togglePane = togglePane;
window.applyChartLayout = applyChartLayout;
window.initResizers = initResizers;
window.toggleVolFallback = toggleVolFallback;

// 뷰 모드 전환 시 차트만 콕 집어 resize (table/quickview 사이드 이펙트 없음)
window.addEventListener("viewModeChanged", () => {
  applyChartLayout();
});
