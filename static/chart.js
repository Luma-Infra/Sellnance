// chart.js - 순수 차트 엔진 코어
import { store, CONFIG, tfSec, measureDOM } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import { getUnixSeconds, formatCrosshairPrice } from "./chart_utils.js";
import { getCandleThemeColors, applyCandleTheme } from "./theme_manager.js";
import {
  formatChartTickMark,
  formatChartTime,
  mountTimezoneButton,
} from "./chart_timezone.js";
import {
  initChartSync,
  syncCrosshair,
  syncTimeScales,
  syncPriceScaleWidths,
  resetPriceScaleWidthSync,
  setupScaleModeButtons,
  updateScaleModeButtonsUI,
} from "./chart_sync.js";
export { getCandleThemeColors, applyCandleTheme };

// === DEBUG_PERF_TOGGLE ===
const ENABLE_PERF_LOG = false; // Set to false to disable all performance logging instantly

// 🚀 [메인 & 거래량 차트 양방향 100% 대칭 60fps 네이티브 캔버스 십자선 플러그인]
class CanvasCrosshairPrimitive {
  constructor() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._x = null;
    this._timeStr = null;
    this._paneViews = [new CanvasCrosshairPaneView(this)];
    this._timeAxisViews = [new CanvasCrosshairTimeAxisView(this)];
  }
  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }
  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  paneViews() {
    return this._x !== null ? this._paneViews : [];
  }
  timeAxisViews() {
    return this._x !== null && this._timeStr ? this._timeAxisViews : [];
  }
  setX(x, timeStr = null) {
    if (x === undefined || x === null || isNaN(x)) {
      this._x = null;
      this._timeStr = null;
    } else {
      this._x = x;
      this._timeStr = timeStr;
    }
    if (this._requestUpdate) {
      try {
        this._requestUpdate();
      } catch (e) { }
    }
  }
}

// 🚀 [신규 플러그인: 시간축 라벨]
// 네이티브 크로스헤어가 고장나는 딜레마를 피해, 이 커스텀 플러그인이 시간축(X축) 바닥에 시간 라벨을 직접 그립니다!
class CanvasCrosshairTimeAxisView {
  constructor(source) {
    this._source = source;
  }
  coordinate() {
    return this._source._x || 0;
  }
  text() {
    return this._source._timeStr || "";
  }
  background() {
    return this.backColor();
  }
  backColor() {
    const isUpbit =
      typeof document !== "undefined" &&
      document.body &&
      document.body.classList.contains("theme-upbit");
    return isUpbit ? "#363c4e" : "#2b2b43"; // 🚀 트레이딩뷰 네이티브 크로스헤어 라벨 배경색
  }
  color() {
    return "#ffffff";
  }
  textColor() {
    return "#ffffff";
  }
}

class CanvasCrosshairPaneView {
  constructor(source) {
    this._source = source;
  }
  renderer() {
    return new CanvasCrosshairPaneRenderer(this._source);
  }
}

class CanvasCrosshairPaneRenderer {
  constructor(source) {
    this._source = source;
  }
  draw(target) {
    if (this._source._x === null || isNaN(this._source._x)) return;
    const x = this._source._x;

    const renderFn = (scope) => {
      const ctx = scope.context || scope.ctx || scope;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#758696";
      ctx.lineCap = "butt"; // 🚀 round의 삐져나옴/뭉침 현상을 제거하고 칼각 도트로 복원!
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([1, 2]); // 🚀 1픽셀 찍고 2픽셀 쉬는 가장 또렷하고 촘촘한 도트 비율!
      }
      ctx.beginPath();
      // 🚀 x 좌표를 픽셀 경계 중앙(+0.5)으로 강제 정렬
      const exactX = Math.round(x) + 0.5;
      // 🚀 위아래 패널 경계선(Border/Gap)의 미세한 틈새 단절을 없애기 위해 무자비하게 팽창 렌더링!!!
      ctx.moveTo(exactX, -100);
      ctx.lineTo(
        exactX,
        (scope.mediaSize ? scope.mediaSize.height : 500) + 100,
      );
      ctx.stroke();
      ctx.restore();
    };

    if (typeof target.useMediaCoordinateSpace === "function") {
      target.useMediaCoordinateSpace(renderFn);
    } else {
      renderFn(target);
    }
  }
}

// 🚀 3. 차트 생성
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
    store.chartVol?.remove();
    store.chart = null;
    store.chartVol = null;
    store.chartKimchi = null;
    store.candleSeries = null;
    store.volumeSeries = null;
    store.kimchiSeries = null;
    store.previewSeries = null;
    store.countdownPriceLine = null; // 🚀 카운트다운 유령선 방지
    store._mainCrosshair = null; // 🚀 십자선 프리미티브 GC 수거 활성화
    store._volCrosshair = null; // 🚀 십자선 프리미티브 GC 수거 활성화
    store._measurePrimitive = null; // 🚀 자 도구 프리미티브 GC 수거 활성화
    store.measureStartPriceLine = null; // 🚀 자 도구 시작 가격선 GC 수거 활성화
    store.measureEndPriceLine = null; // 🚀 자 도구 끝 가격선 GC 수거 활성화
  }
  const elMain = document.getElementById("pane-main");
  const elVol = document.getElementById("pane-vol");

  // 🚀 CSS에 정의된 다크/라이트 모드 테마 변수 가져오기
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
    autoSize: true, // 🚀 v5 핵심 기능: 창 크기에 맞춰 자동 리사이징!
    layout: {
      background: { color: "transparent" },
      textColor: textColor,
      attributionLogo: false, // 🚀 트레이딩뷰 워터마크 끄기
    },
    grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    crosshair: {
      mode: window.LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: "#758696",
        width: 1,
        style: window.LightweightCharts.LineStyle.Dotted, // 도트 점선 촘촘 모드
        visible: true,
        labelVisible: true,
      },
      horzLine: {
        color: "#758696",
        width: 1,
        style: window.LightweightCharts.LineStyle.Dotted, // 도트 점선 촘촘 모드
        visible: true,
        labelVisible: true,
      },
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      mouseWheel: false, // 🚀 기본 느린 트뷰 휠 줌 비활성화 (초고속 네이티브 가속 줌으로 대체)
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

  // 1. 메인 차트
  store.chart = window.LightweightCharts.createChart(elMain, {
    ...commonOptions,
    rightPriceScale: {
      autoScale: true,
      visible: true,
      borderColor: gridColor,
      mode: store.isLogMode ? 1 : 0,
      minimumWidth: store.savedPriceScaleWidth || 0, // 🚀 [UX 개선] 저장된 가격 축의 너비를 레이아웃 생성 시점에 복구하여 레이아웃 꿀렁임 제거
    },
    leftPriceScale: {
      autoScale: true,
      visible: typeof window !== "undefined" && window.innerWidth >= 768,
      minimumWidth:
        typeof window !== "undefined" && window.innerWidth < 768
          ? 0
          : (store.savedLeftPriceScaleWidth || 60),
      borderColor: "transparent",
      // entireTextOnly: true,
    },
  });

  // 2. 볼륨 차트 (좌측 김프, 우측 거래량 스케일 동시 적용)
  store.chartVol = window.LightweightCharts.createChart(elVol, {
    ...commonOptions,
    crosshair: {
      ...commonOptions.crosshair,
      vertLine: {
        ...commonOptions.crosshair.vertLine,
        labelVisible: false, // 🚀 [정답] 네이티브 시간 라벨만 딱 끄기! (플러그인 라벨과 겹침 방지)
      },
    },
    timeScale: {
      ...commonOptions.timeScale,
      borderColor: "transparent", // 🚀 [하단 테두리 박멸] 볼륨 캔버스 하단의 진한 테두리 선 투명화
    },
    rightPriceScale: {
      autoScale: true,
      visible: true,
      borderColor: gridColor,
      scaleMargins: { top: 0.5, bottom: 0 },
      minimumWidth: store.savedPriceScaleWidth || 0, // 🚀 [UX 개선] 저장된 가격 축의 너비를 레이아웃 생성 시점에 복구하여 레이아웃 꿀렁임 제거
    },
    leftPriceScale: {
      autoScale: true,
      visible: typeof window !== "undefined" && window.innerWidth >= 768,
      minimumWidth:
        typeof window !== "undefined" && window.innerWidth < 768
          ? 0
          : (store.savedLeftPriceScaleWidth || 60),
      borderColor: "transparent", // 🚀 [좌측 테두리 박멸] 메인 차트와 동일하게 좌측 테두리 선 투명화
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
  });

  // 🚀 사용자가 차트 줌/패닝을 직접 조작했음을 감지하는 이벤트 리스너 부착
  store.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
    // 🚀 사용자가 직접 마우스/터치로 조작할 때만 이벤트를 기록하므로 여기선 비워둡니다.
  });

  // 🚀 [Lazy Load & Zoom Width Save] 가로폭(줌 상태) 저장 및 과거 데이터 로딩 통합 관리
  let isCheckingLoadMore = false;
  let isUserInteractingWithChart = false;
  let userInteractionTimeout = null;

  store.chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    if (!range) return;
    if (store.isFetchingChart) return; // 🚀 데이터 로딩/초기 기동 중 발생한 내부 레이아웃 리액션에 의한 가로폭 오염 방지
    if (!store.isUserZoomed) return; // 🚀 사용자가 직접 마우스/터치로 줌/스크롤 조작 시에만 가로폭 저장 진행

    // 🚀 [UX 개선] 사용자가 스크롤/줌을 통해 설정한 캔들 개수(가로폭)를 실시간으로 저장합니다.
    const width = range.to - range.from;
    const maxLimit = (CONFIG.CHART_CONFIG?.MAX_SPAN_LIMIT ?? 1200) + 50;
    if (width > 0 && width <= maxLimit) {
      store.savedZoomWidth = width;
    }

    // 🚀 [UX 개선] 최신 캔들 부근(우측 끝)을 바라보고 있을 때만 우측 여백 크기를 저장합니다.
    if (store.mainData && store.mainData.length > 0) {
      const len = store.mainData.length;
      if (range.to >= len - 15) {
        store.savedRightMargin = Math.round(range.to - (len - 1));
      }
    }

    if (isCheckingLoadMore) return;

    // 🚀 [철통 방어 가드] 사용자가 실제로 마우스 드래그/휠/터치 조작 중일 때만 과거 추가 로드 허용!
    // 단순 실시간 새 캔들 생성/틱 수신으로 인한 timeScale 밀림 시에는 절대 트리거 방지!
    if (!isUserInteractingWithChart) return;

    // 🚀 [와리가리 프리징 방어] 왼쪽 끝 도달 판정 기준을 10 -> 2로 좁혀 불필요한 API 폭주 원천 차단
    if (range.from < 2) {
      isCheckingLoadMore = true;
      if (typeof window.loadMoreHistory === "function") {
        await window.loadMoreHistory();
      }
      setTimeout(() => {
        isCheckingLoadMore = false;
      }, 1000); // 1초 디바운스로 스크롤 프레임 폭주 원천 차단
    }
  });

  // 🚀 [초고속 0ms 네이티브 휠 줌 가속 엔진]
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

      // [정밀 영역 분기 가드: Y축 가격/김프 스케일 영역 검출]
      // 1) DOM 기반 체크: Lightweight Charts 내부 테이블 구조
      const targetEl = e.target;
      const td = targetEl ? targetEl.closest("td") : null;
      const tr = td ? td.parentElement : null;
      const tdIndex = tr ? Array.from(tr.children).indexOf(td) : -1;
      // tdIndex 0: 좌측 스케일(김프), 1: 차트 본체(캔들/바), 2: 우측 가격 스케일

      // 2) 좌표 기반 듀얼 체크
      const isOverVol = elVol && elVol.contains(targetEl);
      const activeEl = isOverVol ? elVol : elMain;
      const activeChart = isOverVol ? store.chartVol : store.chart;
      const rect = activeEl ? activeEl.getBoundingClientRect() : null;

      let isOverRightScale = tdIndex === 2;
      let isOverLeftScale = tdIndex === 0;

      if (rect) {
        const cursorX = e.clientX - rect.left;
        const rightWidth = activeChart ? activeChart.priceScale("right").width() : 50;
        const leftWidth = activeChart ? activeChart.priceScale("left").width() : 0;
        if (cursorX >= rect.width - rightWidth - 10) {
          isOverRightScale = true;
        } else if (leftWidth > 0 && cursorX <= leftWidth + 10) {
          isOverLeftScale = true;
        }
      }

      // 🛑 마우스 커서가 가격 스케일(우측) 또는 김프 스케일(좌측) 위에 있을 때:
      // 메인 차트 캔들(가로 TimeScale) 줌을 100% 차단하고 Y축 스케일 인터랙션으로 분기!
      if (isOverRightScale || isOverLeftScale) {
        e.preventDefault();
        e.stopPropagation();

        if (typeof window.zoomPriceScale === "function") {
          const cursorY = rect ? e.clientY - rect.top : null;
          window.zoomPriceScale(!isOverVol, isOverRightScale, e.deltaY, cursorY, activeEl);
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

      // 🛑 [한계점 즉시 감지 & 0ms 조기 탈출]
      if (e.deltaY > 0 && currentSpan >= MAX_SPAN - 0.5) return;
      if (e.deltaY < 0 && currentSpan <= MIN_SPAN + 0.1) return;

      // 🚀 [크로스헤어 정밀 앵커]
      const cursorX = e.clientX - rect.left;
      let cursorLogical = timeScale.coordinateToLogical(cursorX);

      if (cursorLogical === null || isNaN(cursorLogical)) {
        const width = rect.width || 1;
        const ratio = Math.max(0, Math.min(1, cursorX / width));
        cursorLogical = range.from + currentSpan * ratio;
      }

      // 🎯 마우스 커서 위치 기준 100% 정밀 앵커 비율 (0.0 ~ 1.0)
      const anchorRatio = Math.max(
        0,
        Math.min(1, (cursorLogical - range.from) / currentSpan),
      );

      // 🚀 스토어 배속 변수 (부드럽고 쾌적한 줌 가속)
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

      // 🚀 [우측 마진 바운더리 보호 - 좌측 강제 밀림 버그 원천 차단]
      if (newTo > maxTo) {
        newTo = maxTo;
        newFrom = newTo - newSpan;
      }

      // 🚀 [좌측 바운더리 보호] 무한 과거 이탈 방지
      const minFrom = -MAX_SPAN;
      if (newFrom < minFrom) {
        newFrom = minFrom;
        newTo = newFrom + newSpan;
      }

      // 🚀 미세 변화 무시 (불필요한 렌더링 스킵)
      if (
        Math.abs(newFrom - range.from) < 0.05 &&
        Math.abs(newTo - range.to) < 0.05
      ) {
        return;
      }

      const targetRange = { from: newFrom, to: newTo };
      timeScale.setVisibleLogicalRange(targetRange);

      if (store.chartVol) {
        try {
          store.chartVol.timeScale().setVisibleLogicalRange(targetRange);
        } catch (_) { }
      }

      // [원자적 1프레임 동기화] 휠 줌 즉시 메인/볼륨 십자선 마그네틱 자석 좌표 실시간 일치
      try {
        const curX = e.clientX - rect.left;
        let postLogical = timeScale.coordinateToLogical(curX);
        if (postLogical === null || isNaN(postLogical)) {
          postLogical = cursorLogical;
        }
        const snappedX = timeScale.logicalToCoordinate(Math.round(postLogical));
        if (snappedX !== null) {
          if (store._mainCrosshair) store._mainCrosshair.setX(snappedX);
          if (store._volCrosshair) store._volCrosshair.setX(snappedX);
        }
      } catch (_) { }

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

  // 🚀 DOM 이벤트 기반 activeChart 제어 제거 (라이브러리 내부 이벤트로 100% 통합 제어)

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

  store.candleSeries = store.chart.addSeries(
    window.LightweightCharts.CandlestickSeries,
    {
      upColor: upColor,
      downColor: downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
      lastValueVisible: !store.showCountdown, // 🚀 카운트다운 활성화 시 카운트다운 일체형 바 단독 노출 (중복 뱃지 방지)
      priceLineVisible: !store.showCountdown, // 🚀 카운트다운 활성화 시 카운트다운 선 단독 노출 (중복 점선 방지)
      priceFormat: customPriceFormat,
    },
  );

  // 🚀 좌측 스케일 전용 등락률 및 가격차이 표시 보조 시리즈
  store.leftScaleSeries = store.chart.addSeries(
    window.LightweightCharts.LineSeries,
    {
      priceScaleId: "left",
      color: "transparent",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: leftPriceFormat,
    },
  );

  // 💡 [추가] _main.js에 있던 시뮬레이터용 캔들 시리즈 할당 복구
  store.previewSeries = store.chart.addSeries(
    window.LightweightCharts.CandlestickSeries,
    {
      upColor: upColor + "4D",
      downColor: downColor + "4D",
      borderVisible: false,
      wickVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      priceFormat: customPriceFormat,
    },
  );

  store.volumeSeries = store.chartVol.addSeries(
    window.LightweightCharts.HistogramSeries,
    {
      color: "#26a69a",
      priceFormat: { type: "volume" },
    },
  );

  // ========================================================
  // 🚀 [고차원 프록시 가로채기] 볼륨 시리즈 원천 방어막 주입
  // ========================================================
  if (store.volumeSeries) {
    const rawVolumeSetData = store.volumeSeries.setData.bind(
      store.volumeSeries,
    );
    const rawVolumeUpdate = store.volumeSeries.update.bind(store.volumeSeries);

    // .setData() 통로 가로채기 및 완전 소독
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

      // 시간 정제 및 중복 정렬은 기존 엔진(sanitizeChartData)을 거치되, value 필드 안전 장치가 완전히 끝난 배열 전달
      rawVolumeSetData(
        window.sanitizeChartData
          ? window.sanitizeChartData(sterilized, true)
          : sterilized,
      );
    };

    // .update() 통로 가로채기 및 완전 소독
    store.volumeSeries.update = (dataObj) => {
      if (!dataObj || dataObj.time === undefined || dataObj.time === null)
        return;

      // value 강제 변환 및 오염 박멸 (기존 d.color 등 메타데이터 100% 계승)
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

  // 🚀 김프를 오버레이 라인 시리즈로 업그레이드 (다채로운 색상 포기, 가독성 우선)
  store.kimchiSeries = store.chartVol.addSeries(
    window.LightweightCharts.LineSeries,
    {
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
    },
  );

  // ========================================================
  // 🚀 [고차원 프록시] 김프 시리즈 원천 방어막 주입
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
      } catch (e) { }
    };
  }

  // 🚀 [메인 & 거래량 차트 양방향 대칭 십자선 플러그인 초기화 및 부착]
  if (store.candleSeries && !store._mainCrosshair) {
    store._mainCrosshair = new CanvasCrosshairPrimitive();
    store.candleSeries.attachPrimitive(store._mainCrosshair);
  }
  if (store.volumeSeries && !store._volCrosshair) {
    store._volCrosshair = new CanvasCrosshairPrimitive();
    store.volumeSeries.attachPrimitive(store._volCrosshair);
  }

  // 🚀 [멀티 차트 동기화 전담 엔진 초기화] 크로스헤어, 시간축, 가격축 너비 락킹 및 스케일 모드 버튼 바인딩
  initChartSync(elMain, elVol);

  initResizers();
  applyChartLayout();

  // 🚀 자 대고 그리는 측정 도구(Measure Tool) 및 그리기 도구(Drawing Tool) 프리미티브 부착
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
  // 🚀 테마 변경 시 차트를 부수지 않고 색상만 즉각적으로 갈아끼우는 함수
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
    layout: { textColor: textColor },
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

  // 🚀 3. 볼륨 시리즈 색상 원자적 동기화 (requestIdleCallback 지연 제거 → 동일 틱 즉각 렌더링)
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

  applyChartLayout();
}

export {
  initChartSync,
  syncCrosshair,
  syncTimeScales,
  syncPriceScaleWidths,
  resetPriceScaleWidthSync,
  setupScaleModeButtons,
  updateScaleModeButtonsUI,
};

window.updateChartTheme = updateChartTheme;
