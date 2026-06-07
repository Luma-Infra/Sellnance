// Lightweight Charts의 Series prototype 및 차트 동작을 가로채서 데이터 유입과 비동기 렌더링/크로스헤어 이벤트를 전방위 감시합니다.
(function () {
  function initTracker() {
    if (!window.LightweightCharts || window.LightweightCharts.__tracked) return;
    window.LightweightCharts.__tracked = true;

    console.log(
      "🕵️‍♂️ [LWC 트래커 점화] LightweightCharts 인터셉터가 정상 등록되었습니다.",
    );

    // 🚀 비동기 렌더링(Drawing) 단계의 Uncaught Error 및 requestAnimationFrame 단계의 차트 내부 붕괴 감지
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = function (callback) {
      return originalRequestAnimationFrame(function () {
        try {
          callback.apply(this, arguments);
        } catch (err) {
          if (
            err &&
            (err.message?.includes("null") ||
              err.stack?.includes("lightweight-charts"))
          ) {
            console.error(
              "🚨 [비동기 프레임 크래시 감지] requestAnimationFrame 렌더링 도중 차트 깨짐 에러 발생!",
              err,
            );
            console.trace();
          }
          throw err;
        }
      });
    };

    // 전역 미처리 예외 필터링 추가 (차트 내부 비동기 비정상 붕괴 타격감지)
    window.addEventListener("error", function (event) {
      const err = event.error;
      if (
        err &&
        (err.message?.includes("Value is null") ||
          err.stack?.includes("lightweight-charts"))
      ) {
        console.error(
          "🚨 [전역 차트 에러 감지] lightweight-charts 내부 비동기 붕괴 감지:",
          err,
        );
        console.error("사고 발생 메시지:", err.message);
        console.error("에러 스택:", err.stack);
        console.trace();
      }
    });

    const originalCreateChart = window.LightweightCharts.createChart;
    window.LightweightCharts.createChart = function (container, options) {
      const chart = originalCreateChart(container, options);

      // 1. 차트 스크롤 / 리사이즈 및 레이스 컨디션 감시자
      const originalSubscribeCrosshairMove = chart.subscribeCrosshairMove;
      chart.subscribeCrosshairMove = function (callback) {
        return originalSubscribeCrosshairMove.call(this, function (param) {
          try {
            // 크로스헤어 좌표 매핑 값 검사
            if (param && param.point) {
              if (isNaN(param.point.x) || isNaN(param.point.y)) {
                console.warn(
                  "🚨 [크로스헤어 감시] 마우스 좌표에 NaN 감지됨!",
                  param.point,
                );
                console.trace();
              }
            }
            callback(param);
          } catch (err) {
            console.error(
              "🚨 [크로스헤어 콜백 내부 에러] 크로스헤어 이벤트 실행 중 예외 발생!",
              err,
            );
            console.trace();
          }
        });
      };

      const originalApplyOptions = chart.applyOptions;
      chart.applyOptions = function (options) {
        try {
          return originalApplyOptions.apply(this, arguments);
        } catch (err) {
          console.error(
            "🚨 [옵션 적용 에러] applyOptions 실행 도중 예외 발생 (렌더링 충돌 가능성)!",
            err,
            options,
          );
          console.trace();
          throw err;
        }
      };

      // 차트에서 생성되는 모든 시리즈 감시
      const originalAddAreaSeries = chart.addAreaSeries;
      const originalAddBarSeries = chart.addBarSeries;
      const originalAddCandlestickSeries = chart.addCandlestickSeries;
      const originalAddHistogramSeries = chart.addHistogramSeries;
      const originalAddLineSeries = chart.addLineSeries;

      const wrapSeries = (series) => {
        const originalSetData = series.setData;
        const originalUpdate = series.update;

        series.setData = function (data) {
          if (!data) {
            console.error(
              "🚨 [감사 경고] setData에 null/undefined 데이터 주입됨!",
            );
            console.trace();
          } else {
            // 1. NaN/null 검사 및 2. 시간 순서 오름차순 검사
            let lastTime = 0;
            for (let i = 0; i < data.length; i++) {
              const item = data[i];
              if (item.time === undefined || item.time === null) {
                console.error(
                  `🚨 [감사 에러] index ${i}의 time 값이 누락됨!`,
                  item,
                );
                console.trace();
              }
              if (typeof item.time === "number" && isNaN(item.time)) {
                console.error(
                  `🚨 [감사 에러] index ${i}의 time이 NaN 임!`,
                  item,
                );
                console.trace();
              }
              // 시간 순서 검증
              const tSec =
                typeof item.time === "string"
                  ? Date.parse(item.time) / 1000
                  : item.time;
              if (tSec < lastTime) {
                console.error(
                  `🚨 [시간 역행 감지] index ${i}의 시간(${tSec})이 이전 시간(${lastTime})보다 과거입니다!`,
                  item,
                );
                console.trace();
              }
              lastTime = tSec;
            }
          }
          try {
            return originalSetData.apply(this, arguments);
          } catch (err) {
            console.error(
              "🚨 [setData 실행 크래시] 차트에 데이터 설정 중 예외 발생!",
              err,
            );
            console.trace();
            throw err;
          }
        };

        series.update = function (bar) {
          if (!bar || bar.time === undefined || bar.time === null) {
            console.error(
              "🚨 [감사 경고] update에 올바르지 않은 바 데이터 들어옴!",
              bar,
            );
            console.trace();
          }
          try {
            return originalUpdate.apply(this, arguments);
          } catch (err) {
            console.error(
              "🚨 [update 실행 크래시] 차트 실시간 업데이트 중 예외 발생!",
              err,
              bar,
            );
            console.trace();
            throw err;
          }
        };

        return series;
      };

      chart.addAreaSeries = function () {
        return wrapSeries(originalAddAreaSeries.apply(this, arguments));
      };
      chart.addBarSeries = function () {
        return wrapSeries(originalAddBarSeries.apply(this, arguments));
      };
      chart.addCandlestickSeries = function () {
        return wrapSeries(originalAddCandlestickSeries.apply(this, arguments));
      };
      chart.addHistogramSeries = function () {
        return wrapSeries(originalAddHistogramSeries.apply(this, arguments));
      };
      chart.addLineSeries = function () {
        return wrapSeries(originalAddLineSeries.apply(this, arguments));
      };

      return chart;
    };
  }

  // 🚀 비동기 로딩 방어: LightweightCharts 전역 개체가 등록될 때까지 집요하게 Polling & Hooking을 수행합니다.
  if (window.LightweightCharts) {
    initTracker();
  } else {
    // 1. getter / setter 가로채기 방식 시도
    let lwcTemp = undefined;
    Object.defineProperty(window, "LightweightCharts", {
      get: function () {
        return lwcTemp;
      },
      set: function (val) {
        lwcTemp = val;
        try {
          initTracker();
        } catch (e) { }
      },
      configurable: true,
      enumerable: true,
    });

    // 2. 혹시 모를 폴백을 위한 25ms 인터벌 폴링 작동
    const pollInterval = setInterval(() => {
      if (window.LightweightCharts && window.LightweightCharts.createChart) {
        initTracker();
        clearInterval(pollInterval);
      }
    }, 25);

    // 최대 10초 동안 감시 후 자동 종료 (메모리 누수 방지)
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 10000);
  }
})();
