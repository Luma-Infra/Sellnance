// chart_crosshair.js - 트뷰 v5 네이티브 크로스헤어 통합 엔진
import { store, tfSec } from "./_store.js";
import { getUnixSeconds, updateLegend } from "./chart_utils.js";
import { formatChartTime } from "./chart_timezone.js";

// 십자선 초기화
export function clearAllCrosshairs() {
  const wasActive = store.isCrosshairActive || store.crosshairPrice !== null;
  store.activeChart = null;
  store.crosshairPrice = null;
  store.crosshairLeftPrice = null;
  store.isCrosshairActive = false;

  if (store._drawingPrimitive && wasActive) {
    store._drawingPrimitive.setFutureTime(null, null);
    store._drawingPrimitive.updateAll();
  }

  try {
    if (store.chart) store.chart.clearCrosshairPosition();
  } catch (e) {}

  if (store.mainData && store.mainData.length > 0) {
    const lastIdx = store.mainData.length - 1;
    const v = store.volumeData ? store.volumeData[lastIdx] : null;
    const k = store.kimchiData ? store.kimchiData[lastIdx] : null;
    if (typeof updateLegend === "function") {
      updateLegend(store.mainData[lastIdx], v, k);
    }
  }
}
if (typeof window !== "undefined") {
  window.clearAllCrosshairs = clearAllCrosshairs;
}

// 트뷰 v5 네이티브 단일 차트 크로스헤어 리스너
export function initNativeCrosshair(chart) {
  if (!chart) return;

  chart.subscribeCrosshairMove((param) => {
    // 1. 차트 밖으로 마우스가 나갔을 때
    if (!param || !param.point) {
      clearAllCrosshairs();
      return;
    }

    store.isCrosshairActive = true;

    // Y축 크로스헤어 가격 갱신 (미래 영역에서도 마우스 Y에 따라 실시간 반영)
    if (
      store.candleSeries &&
      typeof store.candleSeries.coordinateToPrice === "function"
    ) {
      store.crosshairPrice = store.candleSeries.coordinateToPrice(
        param.point.y,
      );
    }

    if (store._drawingPrimitive) {
      store._drawingPrimitive.updateAll();
    }

    // 2. 과거 ~ 현재 캔들 데이터 영역: 네이티브가 시간을 직접 표시
    if (param.time !== undefined && param.time !== null) {
      if (store._drawingPrimitive) {
        store._drawingPrimitive.setFutureTime(null, null);
      }

      const candle = store.candleSeries
        ? param.seriesData.get(store.candleSeries)
        : null;
      const vol = store.volumeSeries
        ? param.seriesData.get(store.volumeSeries)
        : null;
      const kimp = store.kimchiSeries
        ? param.seriesData.get(store.kimchiSeries)
        : null;

      if (typeof updateLegend === "function") {
        updateLegend(candle, vol, kimp);
      }
      return;
    }

    // 3. 미래 빈 공간 영역 (param.time === undefined): 트뷰 네이티브 timeAxisViews로 캔버스 시간축에 직접 렌더링
    const timeScale = chart.timeScale();
    if (
      timeScale &&
      typeof timeScale.coordinateToLogical === "function" &&
      store.mainData &&
      store.mainData.length > 0
    ) {
      const logical = timeScale.coordinateToLogical(param.point.x);
      if (logical !== null) {
        const rounded = Math.round(logical);
        const total = store.mainData.length;

        if (rounded >= total - 1) {
          const lastCandle = store.mainData[total - 1];
          const lastSec = getUnixSeconds(lastCandle.time);
          const barSec = tfSec[store.currentTF] || 60;
          const futureSec = lastSec + (rounded - (total - 1)) * barSec;

          // 미래 시간축 자석(Magnet) 스냅 위치 계산
          const snappedX =
            typeof timeScale.logicalToCoordinate === "function"
              ? (timeScale.logicalToCoordinate(rounded) ?? param.point.x)
              : param.point.x;

          const timeStr = formatChartTime(futureSec, store.currentTF);

          // 네이티브 timeAxisViews 프리미티브에 전달하여 시간축 캔버스에 직접 렌더링
          if (store._drawingPrimitive) {
            store._drawingPrimitive.setFutureTime(snappedX, timeStr);
          }

          // 레전드는 마지막 최신 캔들 기준 유지
          if (typeof updateLegend === "function") {
            const v = store.volumeData ? store.volumeData[total - 1] : null;
            const k = store.kimchiData ? store.kimchiData[total - 1] : null;
            updateLegend(lastCandle, v, k);
          }
          return;
        }
      }
    }

    if (store._drawingPrimitive) {
      store._drawingPrimitive.setFutureTime(null, null);
    }
  });
}

// 레거시 호환용 no-op 스텁 (단일 차트에서는 네이티브로 상하 자동 관통)
export function syncCrosshair() {}
