// chart.js - 순수 차트 엔진 코어 (트뷰 v5 네이티브 멀티페인 엔진)
import { store, CONFIG, tfSec, measureDOM } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import {
  getUnixSeconds,
  formatCrosshairPrice,
  getKimchiColor,
  rebuildKimchiDataMap,
  mainCandleAutoscaleProvider,
} from "./chart_utils.js";
import { getCandleThemeColors, applyCandleTheme } from "./theme_manager.js";
import {
  formatChartTickMark,
  formatChartTime,
  mountTimezoneButton,
} from "./chart_timezone.js";
import {
  initChartSync,
  swapChartPanes,
  toggleKimchiSplit,
  toggleVolPane,
  toggleKimchiScale,
  syncCrosshair,
  syncTimeScales,
  syncPriceScaleWidths,
  resetPriceScaleWidthSync,
  setupScaleModeButtons,
  updateScaleModeButtonsUI,
} from "./chart_sync.js";
import { initNativeCrosshair } from "./chart_crosshair.js";
import { attachHighLowPrimitive } from "./chart_high_low.js";
export { getCandleThemeColors, applyCandleTheme };

// === DEBUG_PERF_TOGGLE ===
const ENABLE_PERF_LOG = false; // Set to false to disable all performance logging instantly

// 3. 차트 생성
export async function initChart() {
  if (typeof window.LightweightCharts === "undefined") {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (typeof window.LightweightCharts !== "undefined") {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    });
  }
  if (typeof window.LightweightCharts === "undefined") return;

  if (store.chart) {
    store.chart.remove();
    store.chart = null;
    store.chartVol = null;
    store.chartKimchi = null;
    store.candlePane = null;
    store.volPane = null;
    store.kimchiPane = null;
    store.isKimchiSplit = false;
    store.candleSeries = null;
    store.volumeSeries = null;
    store.kimchiSeries = null;
    store.previewSeries = null;
    store.leftScaleSeries = null;
    store.countdownPriceLine = null;
    store._mainCrosshair = null;
    store._volCrosshair = null;
    store._measurePrimitive = null;
    store.measureStartPriceLine = null;
    store.measureEndPriceLine = null;
  }
  const elMain = document.getElementById("pane-main");

  // CSS에 정의된 다크/라이트 모드 테마 변수 가져오기
  const style = getComputedStyle(document.body);
  const textColor = style.getPropertyValue("--text").trim() || "#d1d4dc";
  const gridColor =
    style.getPropertyValue("--grid").trim() ||
    style.getPropertyValue("--border").trim() ||
    "#2a2a22";
  const { up: upColor, down: downColor } = getCandleThemeColors();
  store.upColorCache = upColor;
  store.downColorCache = downColor;

  const commonOptions = {
    autoSize: true, // v5 핵심 기능: 창 크기에 맞춰 자동 리사이징!
    layout: {
      background: { color: "transparent" },
      textColor: textColor,
      fontFamily:
        '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Segoe UI", sans-serif',
      attributionLogo: false, // 트레이딩뷰 워터마크 끄기
      panes: {
        enableResize: true,
        separatorColor: gridColor,
        separatorHoverColor: "transparent",
      },
    },
    grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    crosshair: {
      mode: window.LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: "#758696",
        width: 1,
        style: window.LightweightCharts.LineStyle.Dotted,
        visible: true,
        labelVisible: true,
      },
      horzLine: {
        color: "#758696",
        width: 1,
        style: window.LightweightCharts.LineStyle.Dotted,
        visible: true,
        labelVisible: true,
      },
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      mouseWheel: false,
    },
    handleScroll: { vertTouchDrag: true },
    timeScale: {
      borderColor: gridColor,
      timeVisible: true,
      secondsVisible: false,
      fixRightEdge: false,
      tickMarkFormatter: (time, tickMarkType) =>
        formatChartTickMark(time, tickMarkType, store.currentTF),
    },
    localization: {
      locale: navigator.language,
      timeFormatter: (tick) => formatChartTime(tick, store.currentTF),
    },
  };

  // 트뷰 v5 네이티브 단일 차트 (캔들 + 볼륨 + 김프 통합)
  store.chart = window.LightweightCharts.createChart(elMain, {
    ...commonOptions,
    rightPriceScale: {
      autoScale: true,
      visible: true,
      borderColor: gridColor,
      mode: store.isLogMode ? 1 : 0,
      scaleMargins: {
        top: store.mainChartScaleMargins?.top ?? 0.1,
        bottom: store.mainChartScaleMargins?.bottom ?? 0,
      },
    },
    leftPriceScale: {
      autoScale: true,
      visible:
        typeof window !== "undefined" &&
        window.innerWidth >= 768 &&
        !!store.paneConfig?.kimchi &&
        !store.isKimchiDisabled,
      borderColor: "transparent",
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    },
  });

  // 하위 호환성 보장: chartVol을 chart로 바인딩
  store.chartVol = store.chart;

  // 1. Pane 0: 메인 캔들스틱 페인
  const firstPane = store.chart.panes()[0];
  store.candlePane = firstPane;

  // 2. Pane 1: 하단 거래량 & 김프 페인
  const volPane = store.chart.addPane();
  store.volPane = volPane;

  // 페인 기본 비율 설정 (로컬 스토리지에 저장된 비율 반영)
  const s1 = store.chartSplits?.s1 || 0.75;
  firstPane.setStretchFactor(s1);
  volPane.setStretchFactor(1 - s1);

  // [로컬 스토리지] 저장된 패널 스왑 상태 복원
  if (store.isPanesSwapped) {
    try {
      store.chart.swapPanes(0, 1);
    } catch (e) {
      console.warn("restore isPanesSwapped error:", e);
    }
  }

  // 사용자가 차트 줌/패닝을 직접 조작했음을 감지하는 이벤트 리스너 부착
  store.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
    // 사용자가 직접 마우스/터치로 조작할 때만 이벤트를 기록하므로 여기선 비워두기
  });

  // [Lazy Load & Zoom Width Save] 가로폭(줌 상태) 저장 및 과거 데이터 로딩 통합 관리
  let isCheckingLoadMore = false;
  let isUserInteractingWithChart = false;
  let userInteractionTimeout = null;

  store.chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    if (!range) return;
    if (store.isFetchingChart) return; // 데이터 로딩/초기 기동 중 발생한 내부 레이아웃 리액션에 의한 가로폭 오염 방지
    if (!store.isUserZoomed) return; // 사용자가 직접 마우스/터치로 줌/스크롤 조작 시에만 가로폭 저장 진행

    // [UX 개선] 사용자가 스크롤/줌을 통해 설정한 캔들 개수(가로폭)를 실시간으로 저장
    const width = range.to - range.from;
    const maxLimit = (CONFIG.CHART_CONFIG?.MAX_SPAN_LIMIT ?? 1200) + 50;
    if (width > 0 && width <= maxLimit) {
      store.savedZoomWidth = width;
    }

    // [UX 개선] 최신 캔들 부근(우측 끝)을 바라보고 있을 때만 우측 여백 크기를 저장
    if (store.mainData && store.mainData.length > 0) {
      const len = store.mainData.length;
      if (range.to >= len - 15) {
        store.savedRightMargin = Math.round(range.to - (len - 1));
      }
    }

    if (isCheckingLoadMore) return;

    // 사용자가 실제로 마우스 드래그/휠/터치 조작 중일 때만 과거 추가 로드 허용
    // 단순 실시간 새 캔들 생성/틱 수신으로 인해서 timeScale 밀려나는 경우에도 트리거 방지
    if (!isUserInteractingWithChart) return;

    // [UX] 왼쪽 끝 도달 판정 기준을 10 -> 2로 좁혀 불필요한 API 호출 차단
    if (range.from < 2) {
      isCheckingLoadMore = true;
      if (typeof window.loadMoreHistory === "function") {
        await window.loadMoreHistory();
      }
      setTimeout(() => {
        isCheckingLoadMore = false;
      }, 1000);
    }
  });

  // [네이티브 휠 줌 가속 엔진]
  const chartWrapper = document.getElementById("chart-wrapper");
  if (chartWrapper) {
    const onUserInteract = () => {
      store.isUserZoomed = true;
      isUserInteractingWithChart = true;
      if (userInteractionTimeout) clearTimeout(userInteractionTimeout);
      userInteractionTimeout = setTimeout(() => {
        isUserInteractingWithChart = false;
      }, 1000); // 사용자 조작 멈춤 후에 비활성화
    };

    const handleFastChartWheel = (e) => {
      if (!store.chart || !store.mainData || store.mainData.length === 0)
        return;
      if (Math.abs(e.deltaY) < 1) return;

      // [정밀 영역 분기 : Y축 가격/김프 스케일 영역 검출]
      // 1) DOM 기반 체크: Lightweight Charts 내부 테이블 구조
      const targetEl = e.target;
      const td = targetEl ? targetEl.closest("td") : null;
      const tr = td ? td.parentElement : null;
      const tdIndex = tr ? Array.from(tr.children).indexOf(td) : -1;
      // tdIndex 0: 좌측 스케일(김프), 1: 차트 본체(캔들/바), 2: 우측 가격 스케일

      // 2) 좌표 기반 듀얼 체크
      const activeEl = elMain;
      const activeChart = store.chart;
      const rect = activeEl ? activeEl.getBoundingClientRect() : null;

      let isOverRightScale = tdIndex === 2;
      let isOverLeftScale = tdIndex === 0;

      if (rect) {
        const cursorX = e.clientX - rect.left;
        const rightWidth = activeChart
          ? activeChart.priceScale("right").width()
          : 50;
        const leftWidth = activeChart
          ? activeChart.priceScale("left").width()
          : 0;
        if (cursorX >= rect.width - rightWidth - 10) {
          isOverRightScale = true;
        } else if (leftWidth > 0 && cursorX <= leftWidth + 10) {
          isOverLeftScale = true;
        }
      }

      // 마우스 커서가 가격 스케일(우측) 또는 김프 스케일(좌측) 위에 있을 때
      // 메인 차트 캔들(가로 TimeScale) 줌을 차단하고 Y축 스케일 인터랙션으로 분기
      if (isOverRightScale || isOverLeftScale) {
        e.preventDefault();
        e.stopPropagation();

        if (typeof window.zoomPriceScale === "function") {
          const cursorY = rect ? e.clientY - rect.top : null;
          window.zoomPriceScale(
            !isOverVol,
            isOverRightScale,
            e.deltaY,
            cursorY,
            activeEl,
          );
        }
        return;
      }

      e.preventDefault();

      const timeScale = store.chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (!range) return;

      const currentSpan = range.to - range.from;
      if (currentSpan <= 0) return;

      const len = store.mainData.length;
      const margin = store.savedRightMargin ?? 10;
      const MIN_SPAN = CONFIG.CHART_CONFIG?.MIN_SPAN ?? 10; // 최대 확대 한계 (최소 N개 봉)
      const MAX_SPAN = CONFIG.CHART_CONFIG?.MAX_SPAN_LIMIT ?? 1200; // 최대 축소 한계 (200개 제한 해제)
      const maxTo = len - 1 + margin;

      // [한계점 감지 및 return]
      if (e.deltaY > 0 && currentSpan >= MAX_SPAN - 0.5) return;
      if (e.deltaY < 0 && currentSpan <= MIN_SPAN + 0.1) return;

      // [크로스헤어 정밀 앵커]
      const cursorX = e.clientX - rect.left;
      let cursorLogical = timeScale.coordinateToLogical(cursorX);

      if (cursorLogical === null || isNaN(cursorLogical)) {
        const width = rect.width || 1;
        const ratio = Math.max(0, Math.min(1, cursorX / width));
        cursorLogical = range.from + currentSpan * ratio;
      }

      // 마우스 커서 위치 기준 ~ 정밀 앵커 비율 (0.0 ~ 1.0)
      const anchorRatio = Math.max(
        0,
        Math.min(1, (cursorLogical - range.from) / currentSpan),
      );

      // 스토어 배속 변수 (부드럽고 쾌적한 줌 가속)
      const zoomMultiplier = store.chartZoomSpeed ?? 1.6;
      const normalizedDelta =
        Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) / 100, 1.2);
      const zoomFactor = normalizedDelta * 0.1 * zoomMultiplier;

      let newSpan;
      if (e.deltaY < 0) {
        newSpan = currentSpan * (1 - Math.abs(zoomFactor)); // 확대 (Zoom In)
      } else {
        newSpan = currentSpan * (1 + Math.abs(zoomFactor)); // 축소 (Zoom Out)
      }

      newSpan = Math.max(MIN_SPAN, Math.min(MAX_SPAN, newSpan));

      let newFrom = cursorLogical - newSpan * anchorRatio;
      let newTo = cursorLogical + newSpan * (1 - anchorRatio);

      // [우측 마진 바운더리 보호 - 좌측 강제 밀림 버그 차단]
      if (newTo > maxTo) {
        newTo = maxTo;
        newFrom = newTo - newSpan;
      }

      // [좌측 바운더리 보호] 과거 이탈 방지
      const minFrom = -MAX_SPAN;
      if (newFrom < minFrom) {
        newFrom = minFrom;
        newTo = newFrom + newSpan;
      }

      // 미세 변화 무시 (불필요한 렌더링 스킵)
      if (
        Math.abs(newFrom - range.from) < 0.05 &&
        Math.abs(newTo - range.to) < 0.05
      ) {
        return;
      }

      const targetRange = { from: newFrom, to: newTo };
      timeScale.setVisibleLogicalRange(targetRange);

      store.isUserZoomed = true;
      store.savedZoomWidth = Math.round(newSpan);

      store.isUserZoomed = true;
      store.savedZoomWidth = Math.round(newSpan);

      isUserInteractingWithChart = true;
      if (userInteractionTimeout) clearTimeout(userInteractionTimeout);
      userInteractionTimeout = setTimeout(() => {
        isUserInteractingWithChart = false;
      }, 300);
    };

    chartWrapper.addEventListener("mousedown", onUserInteract, {
      passive: true,
    });
    chartWrapper.addEventListener("touchstart", onUserInteract, {
      passive: true,
    });
    chartWrapper.addEventListener("wheel", handleFastChartWheel, {
      passive: false,
    });
    window.addEventListener(
      "mouseup",
      () => {
        if (userInteractionTimeout) clearTimeout(userInteractionTimeout);
        userInteractionTimeout = setTimeout(() => {
          isUserInteractingWithChart = false;
        }, 300);
      },
      { passive: true },
    );
    window.addEventListener(
      "touchend",
      () => {
        if (userInteractionTimeout) clearTimeout(userInteractionTimeout);
        userInteractionTimeout = setTimeout(() => {
          isUserInteractingWithChart = false;
        }, 300);
      },
      { passive: true },
    );
  }

  // DOM 이벤트 기반 activeChart 제어 제거 (라이브러리 내부 이벤트로 통합 제어)

  const p = store.getPrecision(store.currentAsset);
  const customPriceFormat = {
    type: "custom",
    precision: p,
    minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
    formatter: (price) => formatCrosshairPrice(price, p, false),
  };
  const leftPriceFormat = {
    type: "custom",
    precision: p,
    minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
    formatter: (price) => formatCrosshairPrice(price, p, true),
  };

  store.candleSeries = firstPane.addSeries(
    window.LightweightCharts.CandlestickSeries,
    {
      upColor: upColor,
      downColor: downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
      lastValueVisible: !store.showCountdown, // 카운트다운 활성화 시 카운트다운 일체형 바 단독 노출 (중복 뱃지 방지)
      priceLineVisible: store.showPriceLine !== false && !store.showCountdown, // 현재가 점선 토글 연동
      priceFormat: customPriceFormat,
      autoscaleInfoProvider: mainCandleAutoscaleProvider,
    },
  );

  // 바이낸스 스타일의 화면 가시 영역 캔들 최고가/최저가 가격 태그 플러그인 부착
  attachHighLowPrimitive(store.chart, store.candleSeries);

  // 좌측 스케일 전용 등락률 및 가격차이 표시 보조 시리즈
  store.leftScaleSeries = firstPane.addSeries(
    window.LightweightCharts.LineSeries,
    {
      priceScaleId: "left",
      color: "transparent",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: leftPriceFormat,
      autoscaleInfoProvider: mainCandleAutoscaleProvider,
    },
  );

  // [추가] 시뮬레이터용 캔들 시리즈 할당
  store.previewSeries = firstPane.addSeries(
    window.LightweightCharts.CandlestickSeries,
    {
      upColor: upColor + "4D",
      downColor: downColor + "4D",
      borderVisible: false,
      wickVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: customPriceFormat,
      autoscaleInfoProvider: mainCandleAutoscaleProvider,
    },
  );

  store.volumeSeries = volPane.addSeries(
    window.LightweightCharts.HistogramSeries,
    {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "right",
      priceLineVisible: false, // vol 현재가 점선 숨기기
    },
  );

  // ========================================================
  // [프록시 중계] 볼륨 시리즈 안전하게 처리하기
  // ========================================================
  if (store.volumeSeries) {
    const rawVolumeSetData = store.volumeSeries.setData.bind(
      store.volumeSeries,
    );
    const rawVolumeUpdate = store.volumeSeries.update.bind(store.volumeSeries);

    // .setData() 통로 처리하기
    store.volumeSeries.setData = (dataArr) => {
      if (!Array.isArray(dataArr)) {
        rawVolumeSetData([]);
        return;
      }

      const sterilized = dataArr
        .map((d) => {
          if (!d) return null;
          const safeVal =
            d.value === null || d.value === undefined || isNaN(Number(d.value))
              ? 0
              : Number(d.value);
          return { ...d, value: safeVal };
        })
        .filter(Boolean);

      // 시간 정제 및 중복 정렬은 기존 엔진(sanitizeChartData)을 거치되, value 필드 안전 장치가 끝난 배열 전달
      rawVolumeSetData(
        window.sanitizeChartData
          ? window.sanitizeChartData(sterilized, true)
          : sterilized,
      );
    };

    // .update() 통로 처리하기
    store.volumeSeries.update = (dataObj) => {
      if (!dataObj || dataObj.time === undefined || dataObj.time === null)
        return;

      // value 강제 변환 및 오염 제거 (기존 d.color 등 메타데이터 계승)
      const safeVal =
        dataObj.value === null ||
        dataObj.value === undefined ||
        isNaN(Number(dataObj.value))
          ? 0
          : Number(dataObj.value);

      const sterileObj = {
        ...dataObj,
        value: safeVal,
      };

      rawVolumeUpdate(sterileObj);
    };
  }

  // 김프를 오버레이 라인 시리즈로 추가 (Pane 1 좌측 스케일)
  store.kimchiSeries = volPane.addSeries(window.LightweightCharts.LineSeries, {
    priceScaleId: "left",
    color: "#ff007a",
    lineWidth: 2,
    crosshairMarkerVisible: true,
    lastValueVisible: false,
    priceLineVisible: false,
    priceFormat: {
      type: "custom",
      minMove: 0.01,
      formatter: (p) => (p > 0 ? "+" : "") + p.toFixed(2) + "%",
    },
  });

  // ========================================================
  // [프록시 중계] 김프 시리즈 보호하기
  // ========================================================
  if (store.kimchiSeries) {
    const rawKimchiSetData = store.kimchiSeries.setData.bind(
      store.kimchiSeries,
    );
    const rawKimchiUpdate = store.kimchiSeries.update.bind(store.kimchiSeries);

    store.kimchiSeries.setData = (dataArr) => {
      if (!Array.isArray(dataArr) || dataArr.length === 0) {
        rawKimchiSetData([]);
        return;
      }
      const sterilized = dataArr
        .map((d) => {
          if (!d) return null;
          const safeVal =
            d.value === null || d.value === undefined || isNaN(Number(d.value))
              ? 0
              : Number(d.value);
          return { ...d, value: safeVal };
        })
        .filter(Boolean);
      rawKimchiSetData(
        window.sanitizeChartData
          ? window.sanitizeChartData(sterilized, true)
          : sterilized,
      );
    };

    store.kimchiSeries.update = (dataObj) => {
      if (store.isKimchiDisabled) return;
      if (!dataObj || dataObj.time === undefined || dataObj.time === null)
        return;
      const safeVal =
        dataObj.value === null ||
        dataObj.value === undefined ||
        isNaN(Number(dataObj.value))
          ? 0
          : Number(dataObj.value);
      try {
        rawKimchiUpdate({ ...dataObj, value: safeVal });
      } catch (e) {}
    };
  }

  // [트뷰 v5 네이티브 단일 차트 크로스헤어 바인딩]
  initNativeCrosshair(store.chart);

  // [로컬 스토리지에 저장된 김프 3단 분리 상태 복원]
  if (store.isKimchiSplit) {
    try {
      toggleKimchiSplit();
    } catch (e) {
      console.warn("restore isKimchiSplit error:", e);
    }
  }

  // [멀티 차트 동기화 전담 엔진 초기화]
  initChartSync();

  initResizers();
  applyChartLayout();

  // 자 대고 그리는 측정 도구(Measure Tool) 및 그리기 도구(Drawing Tool) 프리미티브 부착
  setTimeout(() => {
    if (typeof window.setupMeasureTool === "function")
      window.setupMeasureTool();
    if (
      store.candleSeries &&
      !store._drawingPrimitive &&
      typeof window.DrawingPrimitive === "function"
    ) {
      store._drawingPrimitive = new window.DrawingPrimitive();
      store.candleSeries.attachPrimitive(store._drawingPrimitive);
    }
  }, 50);
}

export function updateChartTheme() {
  // 테마 변경 시 차트 색상을 동기적으로 갈아끼우는 함수
  if (!store.chart) return;

  const style = getComputedStyle(document.body);
  const textColor = style.getPropertyValue("--text").trim() || "#d1d4dc";
  const gridColor =
    style.getPropertyValue("--grid").trim() ||
    style.getPropertyValue("--border").trim() ||
    "#2a2a22";
  const { up: upColor, down: downColor } = getCandleThemeColors();

  // Update caches
  store.upColorCache = upColor;
  store.downColorCache = downColor;

  // 1. 차트 배경 및 그리드 색상 업데이트
  const commonTheme = {
    layout: {
      textColor: textColor,
      panes: {
        separatorColor: gridColor,
        separatorHoverColor: "transparent",
      },
    },
    grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    rightPriceScale: { borderColor: gridColor },
    leftPriceScale: { borderColor: "transparent" },
    timeScale: { borderColor: gridColor },
  };

  store.chart.applyOptions(commonTheme);
  if (store.chartVol) store.chartVol.applyOptions(commonTheme);
  if (store.chartKimchi) store.chartKimchi.applyOptions(commonTheme);

  // 2. 캔들 시리즈 색상 업데이트
  if (store.candleSeries) {
    store.candleSeries.applyOptions({
      upColor,
      downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
  }
  if (store.previewSeries) {
    store.previewSeries.applyOptions({
      upColor: upColor + "4D",
      downColor: downColor + "4D",
    });
  }

  // 3. 볼륨 시리즈 색상 원자적 동기화 (requestIdleCallback 지연 제거 → 동일 틱 렌더링)
  if (
    store.volumeSeries &&
    store.volumeData &&
    store.volumeData.length > 0 &&
    store.mainData
  ) {
    const upColorVol = upColor + "80"; // 50% 투명도
    const downColorVol = downColor + "80";

    store.volumeSeries.applyOptions({ color: upColorVol });

    const len = Math.min(store.volumeData.length, store.mainData.length);
    for (let i = 0; i < len; i++) {
      const candle = store.mainData[i];
      if (candle) {
        store.volumeData[i].color =
          candle.close >= candle.open ? upColorVol : downColorVol;
      }
    }

    try {
      store.volumeSeries.setData(
        window.sanitizeChartData
          ? window.sanitizeChartData(store.volumeData, true)
          : store.volumeData,
      );
    } catch (volThemeErr) {
      // Xconsole.warn("🚨 volumeSeries.setData in updateChartTheme 예외 우회 완료:", volThemeErr,);
    }
  }

  // 4. 김프(Kimchi) 데이터 및 무지개 라인 시리즈, 범례 색상 즉시 테마 동기화
  if (store.kimchiData && store.kimchiData.length > 0) {
    const getKCol =
      typeof getKimchiColor === "function"
        ? getKimchiColor
        : window.getKimchiColor;
    if (typeof getKCol === "function") {
      for (let i = 0; i < store.kimchiData.length; i++) {
        const item = store.kimchiData[i];
        if (item && item.value !== undefined) {
          item.color = getKCol(item.value);
        }
      }
    }

    if (typeof rebuildKimchiDataMap === "function") {
      try {
        rebuildKimchiDataMap();
      } catch (e) {}
    }

    // 차트 캔버스 상의 무지개 김프 라인 다시 그리기 (Volume과 동일한 방식)
    if (store.kimchiSeries && !store.isKimchiDisabled) {
      try {
        store.kimchiSeries.setData(
          window.sanitizeChartData
            ? window.sanitizeChartData(store.kimchiData, true)
            : store.kimchiData,
        );
      } catch (kimchiErr) {
        // Xconsole.warn("🚨 kimchiSeries.setData in updateChartTheme 예외 우회 완료:", kimchiErr);
      }
    }
  }
  if (store.realtimeKimchi && store.realtimeKimchi.value !== undefined) {
    const getKCol =
      typeof getKimchiColor === "function"
        ? getKimchiColor
        : window.getKimchiColor;
    if (typeof getKCol === "function") {
      store.realtimeKimchi.color = getKCol(store.realtimeKimchi.value);
    }
  }

  const kimchiEl = document.getElementById("ohlc-kimchi");
  if (kimchiEl) {
    const getKCol =
      typeof getKimchiColor === "function"
        ? getKimchiColor
        : window.getKimchiColor;
    if (typeof getKCol === "function") {
      const targetKim =
        store.realtimeKimchi ||
        (store.kimchiData && store.kimchiData.length > 0
          ? store.kimchiData[store.kimchiData.length - 1]
          : null);
      if (targetKim && targetKim.value !== undefined) {
        kimchiEl.style.color = getKCol(targetKim.value);
      }
    }
  }

  if (typeof window.updateStatus === "function") {
    try {
      window.updateStatus();
    } catch (e) {}
  }

  if (
    store._highLowPrimitive &&
    typeof store._highLowPrimitive.updateAll === "function"
  ) {
    try {
      store._highLowPrimitive.updateAll();
    } catch (_) {}
  }

  applyChartLayout();
}

export {
  initChartSync,
  swapChartPanes,
  toggleVolPane,
  toggleKimchiScale,
  syncCrosshair,
  syncTimeScales,
  syncPriceScaleWidths,
  resetPriceScaleWidthSync,
  setupScaleModeButtons,
  updateScaleModeButtonsUI,
};

window.updateChartTheme = updateChartTheme;
