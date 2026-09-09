// chart_crosshair.js - 🚀 메인 & 볼륨 차트 간 십자선(Crosshair) 마그네틱 스냅 및 다중 동기화 전담 엔진
import { store, tfSec } from "./_store.js";
import { getUnixSeconds } from "./chart_utils.js";
import { formatChartTime } from "./chart_timezone.js";

const ENABLE_PERF_LOG = false;

// ==========================================
// 1. 크로스헤어 마그네틱 상호 동기화 엔진
// ==========================================
export function syncCrosshair(sourceChart, targetCharts) {
  if (!sourceChart || !targetCharts || !targetCharts.length) return;

  sourceChart.subscribeCrosshairMove((param) => {
    const perfStart = ENABLE_PERF_LOG ? performance.now() : 0;
    try {
      if (!param || !param.point) {
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
        return;
      }

      const isHover =
        param.point.x >= 0 &&
        param.point.y >= 0 &&
        param.point.x <=
        (sourceChart._element
          ? sourceChart._element.clientWidth
          : window.innerWidth) &&
        param.point.y <=
        (sourceChart._element
          ? sourceChart._element.clientHeight
          : window.innerHeight);

      if (isHover) {
        if (store.activeChart !== sourceChart) {
          store.activeChart = sourceChart;

          if (sourceChart._crosshairApplyRaf) {
            cancelAnimationFrame(sourceChart._crosshairApplyRaf);
          }
          sourceChart._crosshairApplyRaf = requestAnimationFrame(() => {
            try {
              if (!sourceChart || !window.LightweightCharts) return;

              // 🚀 1. 활성 차트: 가로선과 가격 라벨 색상 복원
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
                    color: "#758696",
                    labelBackgroundColor: "#2b2b43",
                    style: window.LightweightCharts.LineStyle.Dotted,
                  },
                },
              });

              // 🚀 2. 비활성 차트: 가로선 완전 투명화
              targetCharts.forEach((targetObj) => {
                if (targetObj.chart) {
                  targetObj.chart.applyOptions({
                    crosshair: {
                      mode: window.LightweightCharts.CrosshairMode.Normal,
                      horzLine: {
                        visible: false,
                        labelVisible: false,
                        color: "transparent",
                        labelBackgroundColor: "transparent",
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

              setTimeout(() => {
                if (typeof window.syncPriceScaleWidths === "function") {
                  window.syncPriceScaleWidths(true);
                }
              }, 50);
            } catch (applyErr) { }
          });
        }

        // 🚀 가로축 마그네틱 스냅
        store.lastMouseX = param.point.x;
        let magnetX = param.point.x;
        let currentLogical = null;
        if (
          sourceChart.timeScale &&
          typeof sourceChart.timeScale().coordinateToLogical === "function" &&
          typeof sourceChart.timeScale().logicalToCoordinate === "function"
        ) {
          const logical = sourceChart
            .timeScale()
            .coordinateToLogical(param.point.x);
          if (logical !== null) {
            currentLogical = logical;
            const snappedX = sourceChart
              .timeScale()
              .logicalToCoordinate(Math.round(logical));
            if (snappedX !== null) {
              magnetX = snappedX;
            }
          }
        }

        if (sourceChart === store.chart && store._mainCrosshair) {
          store._mainCrosshair.setX(magnetX);
        } else if (sourceChart === store.chartVol && store._volCrosshair) {
          store._volCrosshair.setX(magnetX);
        }

        let targetTime = param.time;
        if (targetTime === undefined) {
          let logicalIndex = null;
          if (typeof sourceChart.timeScale().coordinateToLogical === "function") {
            logicalIndex = sourceChart
              .timeScale()
              .coordinateToLogical(param.point.x);
          }
          if (logicalIndex !== null) {
            const roundedLogical = Math.round(logicalIndex);
            const totalCandles = store.mainData ? store.mainData.length : 0;

            if (totalCandles > 0 && roundedLogical >= totalCandles - 1) {
              const lastCandle = store.mainData[totalCandles - 1];
              const lastCandleSec = getUnixSeconds(lastCandle.time);
              const secondsPerBar = tfSec[store.currentTF] || 60;
              const futureBars = roundedLogical - (totalCandles - 1);
              targetTime = lastCandleSec + futureBars * secondsPerBar;
            } else if (
              typeof sourceChart.timeScale().coordinateToTime === "function"
            ) {
              targetTime = sourceChart
                .timeScale()
                .coordinateToTime(param.point.x);
            }
          }
        }

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

        renderTargetCharts(
          targetCharts,
          normalizedTime,
          targetTime,
          magnetX,
          currentLogical,
        );

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
        const activeTime = param.time !== undefined ? param.time : targetTime;
        const pTime = getUnixSeconds(activeTime);

        let d = null;
        if (sourceChart === store.chart) {
          d = param.seriesData.get(store.candleSeries);
          const mainCandle = store.mainDataMap.get(pTime);
          if (d && mainCandle && mainCandle.volume !== undefined) {
            d.volume = mainCandle.volume;
          } else if (!d && mainCandle) {
            d = { ...mainCandle };
          }
        } else {
          d = store.mainDataMap.get(pTime) || null;
        }
        const v = store.volumeDataMap.get(pTime) || null;
        const k = store.kimchiDataMap.get(pTime) || null;
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
            window.updateStatus();
          }
        }
      } else {
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

          setTimeout(() => {
            if (typeof window.syncPriceScaleWidths === "function") {
              window.syncPriceScaleWidths(true);
            }
          }, 50);
        }
      }
    } catch (err) { }
    const totalPerf = performance.now() - perfStart;
    if (ENABLE_PERF_LOG && totalPerf > 1.5) {
      // Xconsole.warn(`[Perf] syncCrosshair took ${totalPerf.toFixed(2)}ms`);
    }
  });
}

export function renderTargetCharts(
  targetCharts,
  normalizedTime,
  targetTime,
  magnetX,
  logical = null,
) {
  targetCharts.forEach((targetObj) => {
    try {
      const { chart: tChart, series: tSeries } = targetObj;
      if (!tChart || !tSeries) return;

      if (
        normalizedTime !== undefined &&
        normalizedTime !== null &&
        !String(normalizedTime).includes("NaN")
      ) {
        try {
          tChart.clearCrosshairPosition();
        } catch (e) { }
      }

      let timeStr = null;
      if (targetTime !== undefined && targetTime !== null) {
        timeStr = formatChartTime(targetTime, store.currentTF);
      }

      let targetX = magnetX;
      if (
        logical !== null &&
        tChart.timeScale &&
        typeof tChart.timeScale().logicalToCoordinate === "function"
      ) {
        const snappedTarget = tChart
          .timeScale()
          .logicalToCoordinate(Math.round(logical));
        if (snappedTarget !== null) {
          targetX = snappedTarget;
        }
      }

      if (tChart === store.chartVol && store._volCrosshair) {
        store._volCrosshair.setX(targetX, timeStr);
      } else if (tChart === store.chart && store._mainCrosshair) {
        store._mainCrosshair.setX(targetX, timeStr);
      }
    } catch (e) { }
  });
}
