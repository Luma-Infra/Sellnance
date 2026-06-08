// chart.js - 순수 차트 엔진 코어
import { store, tfSec, measureDOM } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import { getUnixSeconds, formatCrosshairPrice } from "./chart_utils.js";

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
    return "#000000ff";
  }
  backColor() {
    return "#000000ff"; // 🚀 트뷰 엔진이 요구하는 정확한 배경색 인터페이스명
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
export function initChart() {
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
  const gridColor = style.getPropertyValue("--border").trim() || "#2a2a22";
  const upColor = style.getPropertyValue("--up").trim() || "#26a69a";
  const downColor = style.getPropertyValue("--down").trim() || "#ef5350";

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
    handleScale: { axisPressedMouseMove: { time: true, price: true } },
    handleScroll: { vertTouchDrag: true },
    timeScale: {
      borderColor: gridColor,
      timeVisible: true,
      secondsVisible: false,
      fixRightEdge: false,
      tickMarkFormatter: (time, tickMarkType) => {
        const d = new Date(getUnixSeconds(time) * 1000);
        if (isNaN(d.getTime())) return "";

        // 🚀 연도, 날짜, 시간 단위별 스마트 표시
        if (tickMarkType === 0) return `${d.getFullYear()}년`;

        const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
        if (isDayUnit) {
          return `${d.getMonth() + 1}/${d.getDate()}`;
        } else {
          return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        }
      },
    },
    localization: {
      locale: navigator.language,
      timeFormatter: (tick) => {
        const d = new Date(getUnixSeconds(tick) * 1000);
        if (isNaN(d.getTime())) return "";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const date = String(d.getDate()).padStart(2, "0");
        const h = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");

        if ((store.currentTF || "1h").match(/[hm]/)) {
          return `${y}-${m}-${date} ${h}:${min}`;
        } else {
          return `${y}-${m}-${date}`;
        }
      },
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
    },
    leftPriceScale: {
      autoScale: true,
      visible: true, // 🚀 시간축 동기화를 위해 보이지 않는 축 유지
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
    },
    leftPriceScale: {
      autoScale: true,
      visible: true,
      borderColor: "transparent", // 🚀 [좌측 테두리 박멸] 메인 차트와 동일하게 좌측 테두리 선 투명화
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
  });

  // 🚀 사용자가 차트 줌/패닝을 직접 조작했음을 감지하는 이벤트 리스너 부착
  store.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
    store.isUserZoomed = true;
  });

  // 🚀 [Lazy Load] 왼쪽으로 스크롤하여 맨 처음 영역에 도달하면 과거 데이터를 lazy하게 로드 (폭주 방지 락 도입)
  let isCheckingLoadMore = false;
  store.chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    if (!range || isCheckingLoadMore) return;
    if (range.from < 15) {
      isCheckingLoadMore = true;
      if (typeof window.loadMoreHistory === "function") {
        await window.loadMoreHistory();
      }
      setTimeout(() => {
        isCheckingLoadMore = false;
      }, 500); // 0.5초 디바운스로 스크롤 프레임 폭주 원천 차단
    }
  });

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
      lastValueVisible: false, // 🚀 기본 가격 라벨 숨기기
      priceLineVisible: false, // 🚀 기본 가격선 숨기기
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
    const rawVolumeSetData = store.volumeSeries.setData.bind(store.volumeSeries);
    const rawVolumeUpdate = store.volumeSeries.update.bind(store.volumeSeries);

    // .setData() 통로 가로채기 및 완전 소독
    store.volumeSeries.setData = (dataArr) => {
      if (!Array.isArray(dataArr)) return rawVolumeSetData([]);

      const sterilized = dataArr.map(d => {
        if (!d) return null;
        const safeVal = (d.value === null || d.value === undefined || isNaN(Number(d.value))) ? 0 : Number(d.value);
        return { ...d, value: safeVal };
      }).filter(Boolean);

      // 시간 정제 및 중복 정렬은 기존 엔진(sanitizeChartData)을 거치되, value 필드 안전 장치가 완전히 끝난 배열 전달
      rawVolumeSetData(window.sanitizeChartData ? window.sanitizeChartData(sterilized, true) : sterilized);
    };

    // .update() 통로 가로채기 및 완전 소독
    store.volumeSeries.update = (dataObj) => {
      if (!dataObj || dataObj.time === undefined || dataObj.time === null) return;

      // value 강제 변환 및 오염 박멸 (기존 d.color 등 메타데이터 100% 계승)
      const safeVal = (dataObj.value === null || dataObj.value === undefined || isNaN(Number(dataObj.value))) ? 0 : Number(dataObj.value);

      const sterileObj = {
        ...dataObj,
        value: safeVal
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
    const rawKimchiSetData = store.kimchiSeries.setData.bind(store.kimchiSeries);
    const rawKimchiUpdate = store.kimchiSeries.update.bind(store.kimchiSeries);

    store.kimchiSeries.setData = (dataArr) => {
      if (!Array.isArray(dataArr)) return rawKimchiSetData([]);
      const sterilized = dataArr.map(d => {
        if (!d) return null;
        const safeVal = (d.value === null || d.value === undefined || isNaN(Number(d.value))) ? 0 : Number(d.value);
        return { ...d, value: safeVal };
      }).filter(Boolean);
      rawKimchiSetData(window.sanitizeChartData ? window.sanitizeChartData(sterilized, true) : sterilized);
    };

    store.kimchiSeries.update = (dataObj) => {
      if (!dataObj || dataObj.time === undefined || dataObj.time === null) return;
      const safeVal = (dataObj.value === null || dataObj.value === undefined || isNaN(Number(dataObj.value))) ? 0 : Number(dataObj.value);
      rawKimchiUpdate({ ...dataObj, value: safeVal });
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

  // 🌊 시간축 스크롤 완벽 동기화 엔진 (순환 참조에 의한 중복 렌더링 루프 완벽 방쇄)
  let isSyncingTimeScales = false;
  const syncTimeScales = (sourceChart, targetCharts) => {
    sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncingTimeScales) return;
      // 🚀 [해결] 차트 데이터 갱신 중일 때는 시간축 동기화를 전면 차단하여 Value is null 오류 원천 차단!
      if (store.isFetchingChart || window.isFetchingChart) return;

      if (range) {
        isSyncingTimeScales = true;
        targetCharts.forEach((target) => {
          if (target) {
            try {
              target.timeScale().setVisibleLogicalRange(range);
            } catch (syncErr) {
              // 동기화 실패 시 예외가 전파되어 멈추는 현상 완벽 방어
            }
          }
        });
        isSyncingTimeScales = false;
      }
    });
  };

  syncTimeScales(store.chart, [store.chartVol]);
  syncTimeScales(store.chartVol, [store.chart]);

  // 🎯 십자선 크로스헤어 완벽 동기화 엔진 (레이스 컨디션 원천 차단 무적 알고리즘)
  const syncCrosshair = (sourceChart, targetCharts) => {
    sourceChart.subscribeCrosshairMove((param) => {
      try {
        // 🚀 [데이터 로딩 방어막] 차트 데이터 갱신 중(타임프레임 변경 등)일 때는 옵션 변경 및 십자선 렌더링 원천 차단!
        // (이 방어막이 없으면 렌더링 도중 applyOptions가 호출되어 Histogram Value is null 에러가 터짐)
        if (store.isFetchingChart) return;

        const isHover =
          param.point !== undefined && param.point.x >= 0 && param.point.y >= 0;

        if (isHover) {
          // 🚀 1. 현재 마우스가 올라간 차트(sourceChart)에 맞춰 가로선 활성화/비활성화 처리 ( activeChart 단일 진실 소스 기준 O(1) 업데이트 )
          if (store.activeChart !== sourceChart) {
            store.activeChart = sourceChart;

            // 🔥 [핵심 패치] applyOptions를 이벤트 수신 즉시 동기 실행하면 아직 초기화 안 된
            //    서브 차트 히스토그램 버퍼를 강제 리페인트하여 Value is null을 유발합니다.
            //    cancelAnimationFrame + requestAnimationFrame 디바운스로 단일 프레임에서만 실행합니다.
            if (sourceChart._crosshairApplyRaf) {
              cancelAnimationFrame(sourceChart._crosshairApplyRaf);
            }
            sourceChart._crosshairApplyRaf = requestAnimationFrame(() => {
              try {
                if (!sourceChart || !window.LightweightCharts) return;

                // 🚀 1. 활성 차트 (마우스가 있는 곳): 가로선과 가격 라벨을 원래 색상으로 우아하게 복원!
                sourceChart.applyOptions({
                  crosshair: {
                    mode: window.LightweightCharts.CrosshairMode.Normal,
                    vertLine: {
                      visible: true,
                      color: "transparent",
                      labelVisible: true,
                      style: window.LightweightCharts.LineStyle.Dotted,
                    },
                    horzLine: {
                      visible: true,
                      labelVisible: true,
                      color: "#758696", // 원래 트뷰 기본 십자선 색상 복구
                      labelBackgroundColor: "#2b2b43", // 원래 트뷰 기본 라벨 배경색 복구
                      style: window.LightweightCharts.LineStyle.Dotted,
                    },
                  },
                });

                // 🚀 2. 비활성 차트 (타겟): 트뷰 API 강제 오버라이드를 피하기 위해, 네이티브 색상 제어로 완벽 투명화!
                targetCharts.forEach((targetObj) => {
                  if (targetObj.chart) {
                    targetObj.chart.applyOptions({
                      crosshair: {
                        mode: window.LightweightCharts.CrosshairMode.Normal,
                        horzLine: {
                          visible: false,
                          labelVisible: false,
                          color: "transparent", // 가로선 완전 투명화
                          labelBackgroundColor: "transparent", // 라벨 배경 완전 투명화
                        },
                        vertLine: {
                          visible: true,
                          color: "transparent",
                          labelVisible: true,
                          style: window.LightweightCharts.LineStyle.Dotted,
                        },
                      },
                    });
                  }
                });
              } catch (applyErr) {
                console.warn("🚨 차트 간 applyOptions 레이아웃 동기화 예외 방어 완료:", applyErr);
              }
            });
          }

          // 🚀 2. 가로축(시간축) 방향 마그네틱(자석) 효과 적용
          let magnetX = param.point.x;
          if (
            sourceChart.timeScale &&
            typeof sourceChart.timeScale().coordinateToLogical === "function" &&
            typeof sourceChart.timeScale().logicalToCoordinate === "function"
          ) {
            const logical = sourceChart
              .timeScale()
              .coordinateToLogical(param.point.x);
            if (logical !== null) {
              const snappedX = sourceChart
                .timeScale()
                .logicalToCoordinate(Math.round(logical));
              if (snappedX !== null) {
                magnetX = snappedX;
              }
            }
          }

          // 🚀 3. [핵심] 원본 차트(sourceChart) 캔버스 플러그인 세로선 다이렉트 렌더링! (메인 차트 세로선 누락 원천 차단!!!)
          if (sourceChart === store.chart && store._mainCrosshair) {
            store._mainCrosshair.setX(magnetX);
          } else if (sourceChart === store.chartVol && store._volCrosshair) {
            store._volCrosshair.setX(magnetX);
          }

          // 🚀 4. 타겟 차트들 처리 (하단 시간축 라벨 유지, 캔버스 플러그인 단독 렌더링!)
          let targetTime = param.time;

          // 🚀 [원인 완벽 규명 및 해결: 미래 캔들 영역 타임스탬프 증발 방어]
          // 미래 허공(우측 여백)에 마우스를 올렸을 때 param.time은 undefined가 떨어집니다.
          // 기존에는 coordinateToTime(x)만 시도했으나, 미래 영역에서는 이것도 null을 반환합니다.
          // 이제 마우스 좌표를 논리적 인덱스(logical)로 변환한 뒤 미래 시간을 직접 역산(Extrapolation)하여 하단 라벨을 완벽히 살려냅니다!
          if (targetTime === undefined) {
            let logicalIndex = null;
            if (
              typeof sourceChart.timeScale().coordinateToLogical === "function"
            ) {
              logicalIndex = sourceChart
                .timeScale()
                .coordinateToLogical(param.point.x);
            }
            if (logicalIndex !== null) {
              const roundedLogical = Math.round(logicalIndex);
              const totalCandles = store.mainData ? store.mainData.length : 0;

              if (totalCandles > 0 && roundedLogical >= totalCandles - 1) {
                // 미래 영역: 마지막 캔들 시간 + (남은 캔들 개수 * 초 단위)
                const lastCandle = store.mainData[totalCandles - 1];
                const lastCandleSec = getUnixSeconds(lastCandle.time); // 🚨 문자열 방어! 숫자로 변환
                const secondsPerBar = tfSec[store.currentTF] || 60;
                const futureBars = roundedLogical - (totalCandles - 1);
                targetTime = lastCandleSec + futureBars * secondsPerBar;
              } else if (
                typeof sourceChart.timeScale().coordinateToTime === "function"
              ) {
                // 과거/현재 영역 폴백
                targetTime = sourceChart
                  .timeScale()
                  .coordinateToTime(param.point.x);
              }
            }
          }

          // 🚀 targetTime을 차트 타임프레임 형식(isDayUnit 여부)에 맞추어 규격화 (일봉인 경우 "YYYY-MM-DD", 분봉인 경우 Unix Seconds)
          let normalizedTime = targetTime;
          if (targetTime !== undefined && targetTime !== null) {
            const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
            const totalSec = getUnixSeconds(targetTime);
            if (isDayUnit) {
              const dt = new Date(totalSec * 1000);
              normalizedTime = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
            } else {
              normalizedTime = totalSec;
            }
          }

          targetCharts.forEach((targetObj) => {
            const { chart: tChart, series: tSeries } = targetObj;
            if (tChart && tSeries) {
              // 🚀 1. 먼저 원격 십자선 이동 API를 호출하여 라이브러리 내부 상태 및 하단 타임스탬프 라벨 위치를 확정 짓는다!
              if (
                normalizedTime !== undefined &&
                normalizedTime !== null &&
                !String(normalizedTime).includes("NaN")
              ) {
                try {
                  // 🚀 [초강력 단일화: 타겟 차트의 네이티브 크로스헤어 완전 초기화]
                  // 타겟 차트에서 트뷰 API(setCrosshairPosition)를 억지로 호출하면 가로선이나 라벨이 강제로 부활하는 오버라이드 현상이 발생합니다.
                  // 이를 원천 차단하기 위해, 비활성 타겟 차트의 네이티브 크로스헤어를 완벽하게 꺼버립니다.
                  // (세로선 동기화는 바로 아래의 캔버스 플러그인이 완벽하게 그려주므로 시간축 스냅 등 마그네틱 기능은 100% 유지됩니다!)
                  tChart.clearCrosshairPosition();
                } catch (e) { }
              }

              // 🚀 targetTime을 문자열(YYYY-MM-DD HH:mm)로 변환하여 플러그인에 전달할 준비!
              let timeStr = null;
              if (targetTime !== undefined && targetTime !== null) {
                const isDay = !(store.currentTF || "1h").match(/[hm]/);
                if (isDay && typeof targetTime === "string") {
                  timeStr = targetTime;
                } else {
                  const dt = new Date(
                    (typeof targetTime === "string"
                      ? getUnixSeconds(targetTime)
                      : targetTime) * 1000,
                  );
                  if (!isNaN(dt.getTime())) {
                    const yyyy = dt.getUTCFullYear();
                    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
                    const dd = String(dt.getUTCDate()).padStart(2, "0");
                    if (isDay) {
                      timeStr = `${yyyy}-${mm}-${dd}`;
                    } else {
                      const HH = String(dt.getHours()).padStart(2, "0");
                      const MM = String(dt.getMinutes()).padStart(2, "0");
                      timeStr = `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
                    }
                  }
                }
              }

              // 🚀 2. [핵심] 타겟 차트(tChart) 캔버스 플러그인 점선 및 하단 시간 라벨 최종 렌더링!
              // timeStr을 던져주면, 방금 만든 CanvasCrosshairTimeAxisView가 X축에 라벨을 예쁘게 그려냅니다.
              if (tChart === store.chartVol && store._volCrosshair) {
                store._volCrosshair.setX(magnetX, timeStr);
              } else if (tChart === store.chart && store._mainCrosshair) {
                store._mainCrosshair.setX(magnetX, timeStr);
              }
            }
          });

          // 🚀 5. 레전드 업데이트 등 기존 로직 유지
          if (
            sourceChart === store.chart &&
            store.candleSeries &&
            typeof store.candleSeries.coordinateToPrice === "function"
          ) {
            store.crosshairPrice = store.candleSeries.coordinateToPrice(
              param.point.y,
            );
            if (
              store.leftScaleSeries &&
              typeof store.leftScaleSeries.coordinateToPrice === "function"
            ) {
              store.crosshairLeftPrice =
                store.leftScaleSeries.coordinateToPrice(param.point.y);
            }
          }
          store.isCrosshairActive = true;
          if (store._drawingPrimitive) {
            store._drawingPrimitive.updateAll();
          }
          // 🚀 [미래 타임스탬프 완벽 연동] param.time이 undefined일 때, 위에서 역산한 targetTime(미래 시간)을 십자선 시간으로 사용!
          const activeTime = param.time !== undefined ? param.time : targetTime;
          const pTime = getUnixSeconds(activeTime);

          let d = null;
          if (sourceChart === store.chart) {
            d = param.seriesData.get(store.candleSeries);
            // 🚀 [완벽 폴백 보강] 라이브러리 내부 캔들 구조체(d)에는 volume 필드가 없으므로, 원본 메인 장부(store.mainData)에서 찾아 volume을 주입합니다!
            const mainCandle = store.mainData?.find(
              (item) => getUnixSeconds(item.time) === pTime,
            );
            if (d && mainCandle && mainCandle.volume !== undefined) {
              d.volume = mainCandle.volume;
            } else if (!d && mainCandle) {
              // 🚀 [미래 캔들 폴백] param.seriesData에 없어도(허공) mainData에 있으면 강제 표시!
              d = { ...mainCandle };
            }
          } else {
            d =
              store.mainData?.find(
                (item) => getUnixSeconds(item.time) === pTime,
              ) || null;
          }
          const v =
            store.volumeData?.find(
              (item) => getUnixSeconds(item.time) === pTime,
            ) || null;
          const k =
            store.kimchiData?.find(
              (item) => getUnixSeconds(item.time) === pTime,
            ) || null;
          if (d && typeof window.updateLegend === "function") {
            window.updateLegend(d, v, k);
          } else {
            if (
              store.mainData &&
              store.mainData.length > 0 &&
              typeof window.updateLegend === "function"
            ) {
              const lastIdx = store.mainData.length - 1;
              const vLast = store.volumeData ? store.volumeData[lastIdx] : null;
              const kLast = store.kimchiData ? store.kimchiData[lastIdx] : null;
              window.updateLegend(store.mainData[lastIdx], vLast, kLast);
            }
            if (typeof window.updateStatus === "function") {
              // 허공일 때는 현재 활성 가격(updateStatus)으로 복구!
              window.updateStatus();
            }
          }
        } else {
          // 🚀 [핵심 방어책] isHover === false 일 때, 현재 activeChart가 내 차트(sourceChart)인 경우에만 초기화 실행!!!
          // (즉, 마우스가 다른 차트로 넘어갔을 때는 이전 차트의 else 블록이 방해하지 못하도록 원천 차단!!!)
          if (store.activeChart === sourceChart) {
            store.activeChart = null;
            if (sourceChart === store.chart) {
              store.crosshairPrice = null;
              store.crosshairLeftPrice = null;
            }
            targetCharts.forEach((targetObj) => {
              if (targetObj.chart) targetObj.chart.clearCrosshairPosition();
              if (store._volCrosshair) store._volCrosshair.setX(null);
              if (store._mainCrosshair) store._mainCrosshair.setX(null);
            });
            store.isCrosshairActive = false;
            if (store._drawingPrimitive) {
              store._drawingPrimitive.updateAll();
            }
            if (
              store.mainData &&
              store.mainData.length > 0 &&
              typeof window.updateLegend === "function"
            ) {
              const lastIdx = store.mainData.length - 1;
              const v = store.volumeData ? store.volumeData[lastIdx] : null;
              const k = store.kimchiData ? store.kimchiData[lastIdx] : null;
              window.updateLegend(store.mainData[lastIdx], v, k);
            }
          }
        }
      } catch (err) { }
    });
  };

  syncCrosshair(store.chart, [
    { chart: store.chartVol, series: store.volumeSeries },
  ]);
  syncCrosshair(store.chartVol, [
    { chart: store.chart, series: store.candleSeries },
  ]);

  // 🚀 Y축(Price Scale) 가로폭 완벽 동기화 엔진 (좌/우측 스케일 동시 관리)
  let currentMaxRight = 0;
  let currentMaxLeft = 0;
  window.isResettingWidth = false; // 🚀 [레이스 컨디션 방어 락] 리셋 중 이벤트 폭주 원천 차단!

  let lastWidthSyncTime = 0;
  let widthSyncPending = false;
  window.syncPriceScaleWidths = (force = false) => {
    if (window.isResettingWidth) return; // 🚨 리셋 피팅(fitContent) 중에는 라이브러리 과거 너비 조회를 원천 차단!
    if (widthSyncPending) return;
    const now = performance.now();
    if (!force && now - lastWidthSyncTime < 100) return;
    widthSyncPending = true;

    requestAnimationFrame(() => {
      widthSyncPending = false;
      lastWidthSyncTime = performance.now();
      const charts = [store.chart, store.chartVol].filter(Boolean);
      let maxRight = 0;
      let maxLeft = 0;

      charts.forEach((c) => {
        let rWidth = c.priceScale("right").width();
        if (store.isLogMode) {
          rWidth = Math.min(rWidth, 80);
        }
        maxRight = Math.max(maxRight, rWidth);
        maxLeft = Math.max(maxLeft, c.priceScale("left").width());
      });

      // 🚀 [초고속 캐시 방어벽] 너비가 이전과 동일하면 applyOptions 호출을 원천 스킵하여 60fps 렌더링 성능 100% 보장!
      if (maxRight > 0 && maxRight !== currentMaxRight) {
        currentMaxRight = maxRight;
        charts.forEach((c) =>
          c.priceScale("right").applyOptions({ minimumWidth: maxRight }),
        );
      }
      if (maxLeft > 0 && maxLeft !== currentMaxLeft) {
        currentMaxLeft = maxLeft;
        charts.forEach((c) =>
          c.priceScale("left").applyOptions({ minimumWidth: maxLeft }),
        );
      }
    });
  };

  const allCharts = [store.chart, store.chartVol].filter(Boolean);
  // 🚀 창 크기 변경뿐만 아니라, 줌인/줌아웃, 좌우 스크롤(VisibleLogicalRangeChange) 및 마우스 이동 시에도 실시간 자동 싱크!
  allCharts.forEach((c) => {
    c.timeScale().subscribeSizeChange(() =>
      setTimeout(window.syncPriceScaleWidths, 50),
    );
    c.timeScale().subscribeVisibleLogicalRangeChange(
      window.syncPriceScaleWidths,
    );
  });

  // 🚀 [메모리 누수 방지] 이전 더블클릭 이벤트 리스너 제거
  [elMain, elVol].forEach((el) => {
    if (el && typeof window.resetPriceScaleWidthSync === "function") {
      el.removeEventListener("dblclick", window.resetPriceScaleWidthSync);
    }
  });

  // 🚀 전역 리셋 함수 (데이터 로드 전 초기화 및 로드 후 자동 싱크 보장)
  window.resetPriceScaleWidthSync = () => {
    window.isResettingWidth = true; // 🚨 락 활성화!
    currentMaxRight = 0;
    currentMaxLeft = 0;
    allCharts.forEach((c) => {
      c.priceScale("right").applyOptions({ minimumWidth: 0, autoScale: true });
      c.priceScale("left").applyOptions({ minimumWidth: 0, autoScale: true });
    });

    // 🚀 브라우저 렌더링 사이클(Repaint)이 완벽히 끝나 라이브러리 내부 width()가 순수하게 줄어든 150ms 뒤에 락 해제 및 최종 싱크!
    setTimeout(() => {
      window.isResettingWidth = false;
      window.syncPriceScaleWidths();
    }, 150);
  };

  window.resetPriceScaleWidthSync();

  // 🚀 [추가] 차트 가격 스케일별 트레이딩뷰 스타일 A / L 모드 버튼 오버레이 생성
  setupScaleModeButtons();

  // 🚀 차트 스케일 리셋(더블클릭) 시 이전 넓이의 저주를 풀고 즉시 0으로 리셋 후 재계산 연동!
  [elMain, elVol].forEach((el) => {
    if (el) el.addEventListener("dblclick", window.resetPriceScaleWidthSync);
  });

  initResizers();
  applyChartLayout();

  // 🚀 자 대고 그리는 측정 도구(Measure Tool) 및 그리기 도구(Drawing Tool) 프리미티브 부착
  setTimeout(() => {
    if (typeof window.setupMeasureTool === "function")
      window.setupMeasureTool();
    if (store.candleSeries && !store._drawingPrimitive && typeof window.DrawingPrimitive === "function") {
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
  const gridColor = style.getPropertyValue("--border").trim() || "#2a2a22";
  const upColor = style.getPropertyValue("--up").trim() || "#26a69a";
  const downColor = style.getPropertyValue("--down").trim() || "#ef5350";

  // Update caches
  store.upColorCache = upColor;
  store.downColorCache = downColor;

  // 1. 차트 배경 및 그리드 색상 업데이트
  const commonTheme = {
    layout: { textColor: textColor },
    grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    rightPriceScale: { borderColor: gridColor },
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

  // 🚀 3. 볼륨 시리즈 및 막대그래프 색상 업데이트
  if (store.volumeSeries && store.volumeData && store.mainData) {
    const upColorVol = upColor + "80"; // 50% 투명도
    const downColorVol = downColor + "80";

    store.volumeSeries.applyOptions({ color: upColorVol });

    store.volumeData.forEach((volItem, index) => {
      const candle = store.mainData[index];
      if (candle) {
        volItem.color = candle.close >= candle.open ? upColorVol : downColorVol;
      }
    });

    const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
    const mapTime = (d) => {
      if (isDayUnit) {
        if (typeof d.time === "string" && d.time.includes("-")) return d;
        const numTime = Number(d.time);
        if (isNaN(numTime)) return d;
        const dt = new Date(numTime * 1000);
        return {
          ...d,
          time: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
        };
      } else {
        if (typeof d.time === "string" && d.time.includes("-")) {
          const parsedUnix = Math.floor(new Date(d.time).getTime() / 1000);
          return { ...d, time: isNaN(parsedUnix) ? d.time : parsedUnix };
        }
        return d;
      }
    };

    if (store.volumeSeries && store.volumeData) {
      try {
        const mappedVol = store.volumeData.map(mapTime);
        store.volumeSeries.setData(
          window.sanitizeChartData
            ? window.sanitizeChartData(mappedVol, true)
            : mappedVol,
        );
      } catch (volThemeErr) {
        console.warn(
          "🚨 volumeSeries.setData in updateChartTheme 예외 우회 완료:",
          volThemeErr,
        );
      }
    }
  }

  applyChartLayout();
}

export function setupScaleModeButtons() {
  const mainA = document.getElementById("main-scale-a-btn");
  const mainL = document.getElementById("main-scale-l-btn");
  const volA = document.getElementById("vol-scale-a-btn");
  const volL = document.getElementById("vol-scale-l-btn");

  if (mainA) {
    mainA.onclick = (e) => {
      e.stopPropagation();
      // 🚀 resetPriceScaleWidthSync() 호출 제거: 가격축 너비가 순간적으로 0으로 쪼그라들며 화면이 꿀렁거리는 현상 원천 방지
      if (typeof resetChartScale === "function") resetChartScale();
    };
  }

  if (mainL) {
    mainL.onclick = (e) => {
      e.stopPropagation();
      if (window.toggleLogScale) window.toggleLogScale();
    };

    // 초기 L 버튼 활성화 스타일 세팅
    if (store.isLogMode) {
      mainL.className = "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      mainL.className = "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
    }
  }

  if (volA) {
    volA.onclick = (e) => {
      e.stopPropagation();
      if (store.chartVol) {
        // 거래량(우측)과 김프(좌측) 스케일을 모두 자동 스케일링으로 맞춤 리셋
        store.chartVol.priceScale("right").applyOptions({ autoScale: true });
        store.chartVol.priceScale("left").applyOptions({ autoScale: true });
      }
    };
  }

  if (volL) {
    volL.onclick = (e) => {
      e.stopPropagation();
      if (window.toggleLogScale) window.toggleLogScale();
    };

    // 초기 L 버튼 활성화 스타일 세팅
    if (store.isLogMode) {
      volL.className = "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      volL.className = "w-5 h-5 flex items-center justify-center text-[9px] font-medium rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
    }
  }
}

window.setupScaleModeButtons = setupScaleModeButtons;
