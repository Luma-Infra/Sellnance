// chart_high_low.js
import { store } from "./_store.js";
import { formatSmartPrice } from "./chart_utils.js";

class HighLowPrimitive {
  constructor() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._paneViews = [new HighLowPaneView(this)];
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
    return this._paneViews;
  }

  updateAll() {
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }
}

class HighLowPaneView {
  constructor(source) {
    this._source = source;
  }

  renderer() {
    return new HighLowPaneRenderer(this._source);
  }
}

class HighLowPaneRenderer {
  constructor(source) {
    this._source = source;
  }

  draw(target) {
    const series = this._source._series;
    const chart = this._source._chart;
    if (
      !series ||
      !chart ||
      !store.mainData ||
      store.mainData.length === 0 ||
      store.isFetchingChart ||
      window.isFetchingChart
    ) {
      return;
    }

    const renderFn = (scope) => {
      const ctx = scope.context || scope.ctx || scope;
      if (!ctx) return;

      const timeScale = chart.timeScale();
      if (!timeScale || typeof timeScale.getVisibleLogicalRange !== "function")
        return;

      const logicalRange = timeScale.getVisibleLogicalRange();
      if (!logicalRange) return;

      const dataLen = store.mainData.length;
      const fromIdx = Math.max(0, Math.floor(logicalRange.from));
      const toIdx = Math.min(dataLen - 1, Math.ceil(logicalRange.to));
      if (fromIdx > toIdx) return;

      let maxHigh = -Infinity;
      let minLow = Infinity;
      let maxCandle = null;
      let minCandle = null;
      let maxIdx = -1;
      let minIdx = -1;

      for (let i = fromIdx; i <= toIdx; i++) {
        const c = store.mainData[i];
        if (!c) continue;
        const h = Number(c.high);
        const l = Number(c.low);
        if (h > maxHigh) {
          maxHigh = h;
          maxCandle = c;
          maxIdx = i;
        }
        if (l < minLow) {
          minLow = l;
          minCandle = c;
          minIdx = i;
        }
      }

      if (!maxCandle && !minCandle) return;

      ctx.save();

      const p =
        store.currentPrecision !== undefined && store.currentPrecision !== null
          ? store.currentPrecision
          : typeof store.getPrecision === "function"
            ? store.getPrecision(store.currentAsset)
            : 2;
      const isKrw =
        store.currentChartMarket === "UPBIT" ||
        store.currentChartMarket === "BITHUMB" ||
        (store.currentAsset && String(store.currentAsset).endsWith("KRW"));

      const formatVal = (val) => {
        // 1순위: 차트 캔들 시리즈의 네이티브 포맷터를 직접 사용하여 가격축/크로스헤어와 동일한 자릿수 사용
        if (series && typeof series.priceFormatter === "function") {
          try {
            const formatted = series.priceFormatter().format(val);
            if (formatted) return formatted;
          } catch (_) {}
        }
        if (typeof formatSmartPrice === "function") {
          return formatSmartPrice(val, p, isKrw);
        }
        if (typeof window.formatSmartPrice === "function") {
          return window.formatSmartPrice(val, p, isKrw);
        }
        return Number(val).toFixed(p);
      };

      const isLight =
        document.body.classList.contains("theme-upbit") ||
        document.body.classList.contains("light");

      // 테마별 CSS 변수 및 폰트 동적 추출 (Sellnance Theme & Typography)
      const style = getComputedStyle(document.body);
      const rawBg = style.getPropertyValue("--bg").trim();
      const rawText = style.getPropertyValue("--text").trim();
      const rawPanel = style.getPropertyValue("--panel").trim();
      const rawBorder = style.getPropertyValue("--border").trim();
      const rawFontSans = style
        .getPropertyValue("--font-sans")
        .replace(/\s+/g, " ")
        .trim();

      const textColor = rawText || (isLight ? "#0f172a" : "#f1f5f9");
      const haloColor = rawBg || rawPanel || (isLight ? "#ffffff" : "#131722");
      // 지시선 및 기준점 색상: 배경과 확실히 대비되는 선명한 컬러 적용 (다크: slate-300, 라이트: slate-700)
      const lineColor = isLight
        ? "rgba(51, 65, 85, 0.88)"
        : "rgba(203, 213, 225, 0.88)";

      const mediaWidth =
        (scope.mediaSize && scope.mediaSize.width) || ctx.canvas.width;

      // Sellnance 메인 폰트(--font-sans / Pretendard Variable) 테마 적용
      const fontSans =
        rawFontSans ||
        '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.font = `500 10px ${fontSans}`;
      ctx.textBaseline = "middle";
      try {
        ctx.letterSpacing = "-0.2px";
      } catch (_) {}

      const lineLen = 16;

      const drawTag = (candle, price, idx, isHigh) => {
        let x = timeScale.timeToCoordinate(candle.time);
        if (
          (x === null || isNaN(x)) &&
          typeof timeScale.logicalToCoordinate === "function"
        ) {
          x = timeScale.logicalToCoordinate(idx);
        }
        const y = series.priceToCoordinate(price);

        if (x === null || y === null || isNaN(x) || isNaN(y)) return;

        const text = formatVal(price);
        // 화면 오른쪽 35% 영역 내에 있으면 왼쪽으로 텍스트 표시, 그 외는 오른쪽으로 표시
        const pointRight = x < mediaWidth * 0.65;
        const candleGap = 4; // 캔들바와의 간격을 두어 직접 접촉 방지

        // 가로 지시선 (원형 포인트 제거 & 캔들바와 직접 닿지 않도록 오프셋 적용)
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        if (pointRight) {
          const startX = x + candleGap;
          const endX = startX + lineLen;
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // 텍스트 (우측 배치)
          const textX = endX + 4;
          ctx.textAlign = "left";

          // 가독성을 위한 헤일로 테두리
          ctx.strokeStyle = haloColor;
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(text, textX, y);

          ctx.fillStyle = textColor;
          ctx.fillText(text, textX, y);
        } else {
          const startX = x - candleGap;
          const endX = startX - lineLen;
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // 텍스트 (좌측 배치)
          const textX = endX - 4;
          ctx.textAlign = "right";

          ctx.strokeStyle = haloColor;
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(text, textX, y);

          ctx.fillStyle = textColor;
          ctx.fillText(text, textX, y);
        }
      };

      // 최고점 태그
      if (maxCandle) {
        drawTag(maxCandle, maxHigh, maxIdx, true);
      }

      // 최저점 태그 (최고점과 다른 캔들이거나 가격이 다를 때)
      if (minCandle && (minCandle !== maxCandle || minLow !== maxHigh)) {
        drawTag(minCandle, minLow, minIdx, false);
      }

      ctx.restore();
    };

    if (typeof target.useMediaCoordinateSpace === "function") {
      target.useMediaCoordinateSpace(renderFn);
    } else {
      renderFn(target);
    }
  }
}

export function attachHighLowPrimitive(chart, series) {
  if (!chart || !series) return null;

  if (store._highLowPrimitive) {
    try {
      series.detachPrimitive(store._highLowPrimitive);
    } catch (_) {}
    store._highLowPrimitive = null;
  }

  const primitive = new HighLowPrimitive();
  store._highLowPrimitive = primitive;

  if (typeof series.attachPrimitive === "function") {
    series.attachPrimitive(primitive);
  }

  if (typeof chart.timeScale === "function") {
    const ts = chart.timeScale();
    if (ts && typeof ts.subscribeVisibleLogicalRangeChange === "function") {
      ts.subscribeVisibleLogicalRangeChange(() => {
        if (store._highLowPrimitive) {
          store._highLowPrimitive.updateAll();
        }
      });
    }
    if (ts && typeof ts.subscribeVisibleTimeRangeChange === "function") {
      ts.subscribeVisibleTimeRangeChange(() => {
        if (store._highLowPrimitive) {
          store._highLowPrimitive.updateAll();
        }
      });
    }
  }

  return primitive;
}

export function updateHighLowTags() {
  if (
    store._highLowPrimitive &&
    typeof store._highLowPrimitive.updateAll === "function"
  ) {
    store._highLowPrimitive.updateAll();
  }
}

window.attachHighLowPrimitive = attachHighLowPrimitive;
window.updateHighLowTags = updateHighLowTags;
