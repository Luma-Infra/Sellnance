// chart.js
import { store } from './store.js';

// 🚀 [추가] 차트 패널 (볼륨, 김프) 토글 관리자
function togglePane(paneName) {
  store.paneConfig[paneName] = !store.paneConfig[paneName];
  applyChartLayout();
}

let isDraggingResizer = null;

// 🚀 1. 마진 레이아웃 & 선 위치 업데이트
function applyChartLayout() {
  if (!chart || !candleSeries) return;

  const v = window.paneConfig.volume;
  const k = window.paneConfig.kimchi;

  const rVol = document.getElementById("resizer-vol");
  const rKim = document.getElementById("resizer-kimchi");

  // 🚨 [핵심 수정] 여기서 빈칸(undefined)이 안 되도록 기본 숫자(0과 1)를 무조건 깔아줍니다!
  let mainBottom = 0;
  let volTop = 1, volBottom = 0;
  let kimchiTop = 1, kimchiBottom = 0;
  const marginGap = 0.03;

  if (v && k) {
    rVol.style.display = "block"; rKim.style.display = "block";
    rVol.style.top = (store.chartSplits.s1 * 100) + "%";
    rKim.style.top = (store.chartSplits.s2 * 100) + "%";

    mainBottom = 1 - store.chartSplits.s1 + marginGap;
    volTop = store.chartSplits.s1 + marginGap;
    volBottom = 1 - store.chartSplits.s2 + marginGap;
    kimchiTop = store.chartSplits.s2 + marginGap;
    kimchiBottom = 0;
  } else if (v && !k) {
    rVol.style.display = "block"; rKim.style.display = "none";
    rVol.style.top = (store.chartSplits.s1 * 100) + "%";

    mainBottom = 1 - store.chartSplits.s1 + marginGap;
    volTop = store.chartSplits.s1 + marginGap;
    volBottom = 0;
  } else if (!v && k) {
    rVol.style.display = "none"; rKim.style.display = "block";
    rKim.style.top = (store.chartSplits.s2 * 100) + "%";

    mainBottom = 1 - store.chartSplits.s2 + marginGap;
    kimchiTop = store.chartSplits.s2 + marginGap;
    kimchiBottom = 0;
  } else {
    rVol.style.display = "none"; rKim.style.display = "none";
    mainBottom = 0;
  }

  // 🚀 마진 즉시 적용 (하나의 십자선 유지)
  // 🚀 마진 적용 및 우측 Y축(숫자) 색상 분리!
  chart.priceScale("right").applyOptions({
    scaleMargins: { top: 0.1, bottom: mainBottom },
    textColor: getComputedStyle(document.body).getPropertyValue("--text").trim() // 메인은 기본 텍스트 색상
  });

  if (volumeSeries) {
    volumeSeries.applyOptions({ visible: v });
    chart.priceScale("volScale").applyOptions({
      scaleMargins: { top: volTop, bottom: volBottom },
      textColor: "rgba(38, 166, 154, 0.8)", // 🚀 볼륨 축은 청록색
    });
  }
  if (kimchiSeries) {
    kimchiSeries.applyOptions({ visible: k });
    chart.priceScale("kimchiScale").applyOptions({
      scaleMargins: { top: kimchiTop, bottom: kimchiBottom },
      textColor: "#57a4fc", // 🚀 김프 축은 파란색
    });
  }
}

// 🚀 2. 드래그 엔진 초기화
function initResizers() {
  const wrapper = document.getElementById("chart-wrapper");
  const rVol = document.getElementById("resizer-vol");
  const rKim = document.getElementById("resizer-kimchi");

  const startDrag = (e, target) => {
    isDraggingResizer = target;
    document.body.style.cursor = 'row-resize';
  };

  if (rVol) rVol.addEventListener('mousedown', (e) => startDrag(e, 'vol'));
  if (rKim) rKim.addEventListener('mousedown', (e) => startDrag(e, 'kimchi'));

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingResizer) return;
    const rect = wrapper.getBoundingClientRect();
    let pct = (e.clientY - rect.top) / rect.height;

    // 선끼리 교차하거나 영역 밖으로 나가지 못하게 제한!
    if (isDraggingResizer === 'vol') {
      if (pct < 0.2) pct = 0.2;
      if (pct > store.chartSplits.s2 - 0.1) pct = store.chartSplits.s2 - 0.1;
      store.chartSplits.s1 = pct;
    } else {
      if (pct < store.chartSplits.s1 + 0.1) pct = store.chartSplits.s1 + 0.1;
      if (pct > 0.9) pct = 0.9;
      store.chartSplits.s2 = pct;
    }
    applyChartLayout();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingResizer) {
      isDraggingResizer = null;
      document.body.style.cursor = 'default';
    }
  });
}

// 🚀 3. 차트 생성
export function initChart() {
  if (store.chart) { store.chart.remove(); store.chart = null; }
  const elMain = document.getElementById("pane-main");

  store.chart = LightweightCharts.createChart(elMain, {
    layout: { background: { color: "transparent" }, textColor: "#d1d4dc" },
    grid: { vertLines: { color: "#2a2a22" }, horzLines: { color: "#2a2a22" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale: { timeVisible: true, secondsVisible: false },
    rightPriceScale: { autoScale: true, borderColor: "#2a2a22" },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: "#26a69a", downColor: "#ef5350", borderVisible: false, wickUpColor: "#26a69a", wickDownColor: "#ef5350",
  });

  volumeSeries = chart.addHistogramSeries({
    color: "#26a69a", priceFormat: { type: "volume" }, priceScaleId: "volScale"
  });
  chart.priceScale("volScale").applyOptions({ autoScale: true, borderColor: "transparent" });

  // 🚀 김프 라인 차트 부활 (색상 로직 삭제로 오류 방어)
  kimchiSeries = chart.addLineSeries({
    color: "#57a4fc", // 단일 테마색으로 지정
    lineWidth: 2,
    crosshairMarkerVisible: false,
    priceFormat: { type: "custom", formatter: (p) => (p > 0 ? "+" : "") + p.toFixed(2) + "%" },
    priceScaleId: "kimchiScale"
  });
  chart.priceScale("kimchiScale").applyOptions({ autoScale: true, borderColor: "transparent" });

  initResizers();
  applyChartLayout();

  if (window.chartResizeObserver) window.chartResizeObserver.disconnect();
  window.chartResizeObserver = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width && entry.contentRect.height) {
      store.chart.resize(entry.contentRect.width, entry.contentRect.height);
    }
  });
  window.chartResizeObserver.observe(document.getElementById("chart-wrapper"));
}

window.togglePane = togglePane;