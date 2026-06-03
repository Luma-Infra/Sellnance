// static/chart_draw.js
import { store } from "./_store.js";

// 🚀 [Lightweight Charts v5 네이티브 캔버스 그리기 프리미티브 클래스]
export class DrawingPrimitive {
  constructor() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._paneViews = [new DrawingPaneView(this)];
    this._priceAxisViews = [new DrawingPriceAxisView(this)];
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
  priceAxisViews() {
    return this._priceAxisViews;
  }
  updateAll() {
    if (this._requestUpdate) this._requestUpdate();
  }
}

class DrawingPriceAxisView {
  constructor(source) {
    this._source = source;
  }
  coordinate() {
    if (!store.candleSeries || !store.mainData || store.mainData.length === 0)
      return -100;
    if (!store.isCrosshairActive || store.crosshairPrice === null) return -100;

    const lastCandle = store.mainData[store.mainData.length - 1];
    const currentPrice = lastCandle.close;
    const y = store.candleSeries.priceToCoordinate(store.crosshairPrice);
    if (y === null) return -100;

    const diff = store.crosshairPrice - currentPrice;
    const pct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;

    // 상승(pct >= 0)이면 선 위(y - 20), 하락(pct < 0)이면 선 아래(y + 20)
    return pct >= 0 ? y - 20 : y + 20;
  }
  text() {
    if (!store.mainData || store.mainData.length === 0) return "";
    if (!store.isCrosshairActive || store.crosshairPrice === null) return "";

    const lastCandle = store.mainData[store.mainData.length - 1];
    const currentPrice = lastCandle.close;
    const diff = store.crosshairPrice - currentPrice;
    const pct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  }
  textColor() {
    return "#e1e4eb";
  }
  backColor() {
    return "#2a2e39";
  }
  visible() {
    const pctEnabled = (typeof store.showCrosshairPct === "boolean") ? store.showCrosshairPct : true;
    return pctEnabled && store.isCrosshairActive && store.crosshairPrice !== null;
  }
  renderer() {
    return new DrawingPriceAxisRenderer(this);
  }
}

class DrawingPriceAxisRenderer {
  constructor(view) {
    this._view = view;
  }
  draw(ctx, rendererOptions) {
    const text = this._view.text();
    const coordinate = this._view.coordinate();
    if (!text || coordinate === -100) return;

    // 🚀 CanvasRenderingContext2D 안전 추출 (래퍼 객체인 경우 대응)
    const canvasCtx = ctx.context || ctx.ctx || ctx;
    if (typeof canvasCtx.save !== "function") return;

    canvasCtx.save();

    const changeColor = this._view.backColor();
    const borderColor = "#4a4e5a";

    canvasCtx.font = "bold 10px sans-serif";
    const textWidth = canvasCtx.measureText(text).width;
    const rectWidth = textWidth + 8;
    const rectHeight = 15;

    // 가격축 캔버스 내부 적절한 X좌표 배치 (시작점 2px 띄움)
    const rectX = 2;
    const rectY = coordinate - rectHeight / 2;

    canvasCtx.fillStyle = changeColor;
    canvasCtx.strokeStyle = borderColor;
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();
    if (typeof canvasCtx.roundRect === "function") {
      canvasCtx.roundRect(rectX, rectY, rectWidth, rectHeight, 3);
    } else {
      canvasCtx.rect(rectX, rectY, rectWidth, rectHeight);
    }
    canvasCtx.fill();
    canvasCtx.stroke();

    canvasCtx.fillStyle = this._view.textColor();
    canvasCtx.textAlign = "center";
    canvasCtx.textBaseline = "middle";
    canvasCtx.fillText(
      text,
      rectX + rectWidth / 2,
      rectY + rectHeight / 2 + 0.5,
    );

    canvasCtx.restore();
  }
}

class DrawingPaneView {
  constructor(source) {
    this._source = source;
  }
  renderer() {
    return new DrawingPaneRenderer(this._source);
  }
}

class DrawingPaneRenderer {
  constructor(source) {
    this._source = source;
  }
  draw(target) {
    if (!store.candleSeries || !store.chart) return;
    const series = store.candleSeries;
    const chart = store.chart;

    const renderFn = (scope) => {
      const ctx = scope.context || scope.ctx || scope;
      ctx.save();

      // 테마별 라인 색상 추출
      const style = getComputedStyle(document.body);
      const accentColor =
        style.getPropertyValue("--accent").trim() || "#f0b90b";
      const textColor = style.getPropertyValue("--text").trim() || "#ffffff";
      const lineUpColor = style.getPropertyValue("--up").trim() || "#26a69a";

      // ─── 1. 가로선 (Horizontal Lines) 그리기 ───
      if (store.drawings.horizontals && store.drawings.horizontals.length > 0) {
        store.drawings.horizontals.forEach((h) => {
          const price = typeof h === "object" ? h.price : h;
          const isSelected = store.selectedDrawing && (store.selectedDrawing === h || (typeof h === "object" && store.selectedDrawing.id === h.id));

          if (isSelected) {
            ctx.strokeStyle = lineUpColor;
            ctx.lineWidth = 3;
          } else {
            ctx.strokeStyle = lineUpColor;
            ctx.lineWidth = 1.5;
          }
          ctx.setLineDash([]); // 실선

          const y = series.priceToCoordinate(price);
          if (y !== null && y >= 0) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ctx.canvas.width, y);
            ctx.stroke();

            // 선택된 상태이면 양끝에 조절점 그리기
            if (isSelected) {
              ctx.fillStyle = "#ffffff";
              ctx.strokeStyle = lineUpColor;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(10, y, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(ctx.canvas.width - 70, y, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }

            // 우측에 가격 텍스트 노출
            ctx.fillStyle = textColor;
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(price.toLocaleString(), ctx.canvas.width - 65, y - 4);
          }
        });
      }

      // ─── 2. 추세선 (Trend Lines) 그리기 ───
      if (store.drawings.trendlines && store.drawings.trendlines.length > 0) {
        store.drawings.trendlines.forEach((line) => {
          const isSelected = store.selectedDrawing && (store.selectedDrawing === line || (line.id && store.selectedDrawing.id === line.id));

          if (isSelected) {
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 3.5;
          } else {
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 2;
          }
          ctx.setLineDash([]); // 실선

          let startX = null;
          let startY = series.priceToCoordinate(line.start.price);
          let endX = null;
          let endY = series.priceToCoordinate(line.end.price);

          if (
            line.start.logical !== null &&
            typeof chart.timeScale().logicalToCoordinate === "function"
          ) {
            startX = chart.timeScale().logicalToCoordinate(line.start.logical);
          }
          if (
            line.end.logical !== null &&
            typeof chart.timeScale().logicalToCoordinate === "function"
          ) {
            endX = chart.timeScale().logicalToCoordinate(line.end.logical);
          }

          if (
            startX !== null &&
            startY !== null &&
            endX !== null &&
            endY !== null
          ) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // 선택된 상태이면 양끝에 조절점 그리기
            if (isSelected) {
              ctx.fillStyle = "#ffffff";
              ctx.strokeStyle = accentColor;
              ctx.lineWidth = 2;

              ctx.beginPath();
              ctx.arc(startX, startY, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(endX, endY, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        });
      }

      // ─── 3. 마우스 드래그 중인 임시 선 프리뷰 그리기 ───
      if (
        store.activeTool === "trendline" &&
        store.drawingStart &&
        store.drawingTempEnd
      ) {
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); // 점선

        let startX = null;
        let startY = series.priceToCoordinate(store.drawingStart.price);
        let endX = null;
        let endY = series.priceToCoordinate(store.drawingTempEnd.price);

        if (
          store.drawingStart.logical !== null &&
          typeof chart.timeScale().logicalToCoordinate === "function"
        ) {
          startX = chart
            .timeScale()
            .logicalToCoordinate(store.drawingStart.logical);
        }
        if (
          store.drawingTempEnd.logical !== null &&
          typeof chart.timeScale().logicalToCoordinate === "function"
        ) {
          endX = chart
            .timeScale()
            .logicalToCoordinate(store.drawingTempEnd.logical);
        }

        if (
          startX !== null &&
          startY !== null &&
          endX !== null &&
          endY !== null
        ) {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }

      ctx.restore();

      // 드로잉 선택 시 플로팅 휴지통 아이콘 위치 업데이트 연동
      if (typeof window.updateFloatingDeleteButton === "function") {
        requestAnimationFrame(() => window.updateFloatingDeleteButton());
      }
    };

    if (target.useMediaCoordinateSpace) {
      target.useMediaCoordinateSpace(renderFn);
    } else {
      renderFn(target);
    }
  }
}

// ─── 헬퍼: 드로잉 삭제 처리 함수 ───
export function deleteDrawing(drawing) {
  if (!drawing) return;

  if (drawing.start && drawing.end) {
    // 추세선 삭제
    const idx = store.drawings.trendlines.findIndex(
      (line) => line === drawing || (line.id && line.id === drawing.id)
    );
    if (idx !== -1) {
      store.drawings.trendlines.splice(idx, 1);
    }
  } else {
    // 수평선 삭제
    const idx = store.drawings.horizontals.findIndex(
      (h) => h === drawing || (typeof h === "object" && h.id === drawing.id)
    );
    if (idx !== -1) {
      store.drawings.horizontals.splice(idx, 1);
    } else {
      const rawIdx = store.drawings.horizontals.indexOf(drawing);
      if (rawIdx !== -1) {
        store.drawings.horizontals.splice(rawIdx, 1);
      }
    }
  }

  if (store.selectedDrawing === drawing) {
    store.selectedDrawing = null;
  }

  if (typeof window.updateFloatingDeleteButton === "function") {
    window.updateFloatingDeleteButton();
  }

  if (store._drawingPrimitive) {
    store._drawingPrimitive.updateAll();
  }
}

// ─── 헬퍼: 플로팅 휴지통(개별 삭제) 버튼 노출 및 제어 ───
export function updateFloatingDeleteButton() {
  let btn = document.getElementById("drawing-delete-btn");
  if (!store.selectedDrawing || store.activeTool === "measure") {
    if (btn) btn.style.display = "none";
    return;
  }

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "drawing-delete-btn";
    btn.innerHTML = "🗑️";
    btn.style.cssText = "position: absolute; z-index: 1000; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #ef5350; color: white; border: none; border-radius: 4px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 14px; transition: transform 0.1s; transform: translate(-50%, -100%);";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (store.selectedDrawing) {
        deleteDrawing(store.selectedDrawing);
      }
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translate(-50%, -100%) scale(1.1)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translate(-50%, -100%) scale(1)";
    });
    const wrapper = document.getElementById("chart-wrapper");
    if (wrapper) {
      wrapper.appendChild(btn);
    }
  }

  const series = store.candleSeries;
  const chart = store.chart;
  if (!series || !chart) {
    btn.style.display = "none";
    return;
  }

  let posX = 0;
  let posY = 0;

  if (store.selectedDrawing.start && store.selectedDrawing.end) {
    // 추세선 (선 중앙에 띄움)
    const line = store.selectedDrawing;
    const startY = series.priceToCoordinate(line.start.price);
    const endY = series.priceToCoordinate(line.end.price);
    let startX = null;
    let endX = null;

    if (line.start.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
      startX = chart.timeScale().logicalToCoordinate(line.start.logical);
    }
    if (line.end.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
      endX = chart.timeScale().logicalToCoordinate(line.end.logical);
    }

    if (startX !== null && startY !== null && endX !== null && endY !== null) {
      posX = (startX + endX) / 2;
      posY = (startY + endY) / 2 - 12;
    } else {
      btn.style.display = "none";
      return;
    }
  } else {
    // 수평선 (화면 중앙에 띄움)
    const price = typeof store.selectedDrawing === "object" ? store.selectedDrawing.price : store.selectedDrawing;
    const y = series.priceToCoordinate(price);
    if (y !== null) {
      const container = document.getElementById("pane-main");
      const width = container ? container.clientWidth : 400;
      posX = width / 2;
      posY = y - 12;
    } else {
      btn.style.display = "none";
      return;
    }
  }

  // #chart-wrapper 기준 좌표 환산
  const container = document.getElementById("pane-main");
  if (container) {
    const rect = container.getBoundingClientRect();
    const wrapper = document.getElementById("chart-wrapper");
    if (wrapper) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const relativeX = posX + (rect.left - wrapperRect.left);
      const relativeY = posY + (rect.top - wrapperRect.top);

      btn.style.left = `${relativeX}px`;
      btn.style.top = `${relativeY}px`;
      btn.style.display = "flex";
    }
  }
}
window.updateFloatingDeleteButton = updateFloatingDeleteButton;

// ─── 헬퍼: 점과 선분 사이의 최단 거리 계산 ───
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ─── 헬퍼: 마우스 좌표 기준 히트 테스트 ───
function findHitDrawing(clickX, clickY) {
  if (!store.candleSeries || !store.chart) return null;
  const series = store.candleSeries;
  const chart = store.chart;

  // 1. 선택된 추세선 조절점(Handle) 우선 체크
  if (store.selectedDrawing && store.selectedDrawing.start && store.selectedDrawing.end) {
    const line = store.selectedDrawing;
    const startY = series.priceToCoordinate(line.start.price);
    const endY = series.priceToCoordinate(line.end.price);
    let startX = null;
    let endX = null;

    if (line.start.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
      startX = chart.timeScale().logicalToCoordinate(line.start.logical);
    }
    if (line.end.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
      endX = chart.timeScale().logicalToCoordinate(line.end.logical);
    }

    // 선택된 추세선 handle 독립 체크 (14px 반경)
    if (startX !== null && startY !== null && Math.hypot(clickX - startX, clickY - startY) < 14) {
      return { drawing: line, handle: "start" };
    }
    if (endX !== null && endY !== null && Math.hypot(clickX - endX, clickY - endY) < 14) {
      return { drawing: line, handle: "end" };
    }
  }

  // 2. 전체 추세선 라인/조절점 체크 (각 포인트 독립적으로 검사)
  if (store.drawings.trendlines) {
    for (const line of store.drawings.trendlines) {
      const startY = series.priceToCoordinate(line.start.price);
      const endY = series.priceToCoordinate(line.end.price);
      let startX = null;
      let endX = null;

      if (line.start.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
        startX = chart.timeScale().logicalToCoordinate(line.start.logical);
      }
      if (line.end.logical !== null && typeof chart.timeScale().logicalToCoordinate === "function") {
        endX = chart.timeScale().logicalToCoordinate(line.end.logical);
      }

      // 시작점 handle 독립 체크 (끝점이 화면 밖이어도 동작)
      if (startX !== null && startY !== null && Math.hypot(clickX - startX, clickY - startY) < 14) {
        return { drawing: line, handle: "start" };
      }
      // 끝점 handle 독립 체크 (시작점이 화면 밖이어도 동작)
      if (endX !== null && endY !== null && Math.hypot(clickX - endX, clickY - endY) < 14) {
        return { drawing: line, handle: "end" };
      }
      // 선 바디 체크 — 양쪽 모두 보여야 함
      if (startX !== null && startY !== null && endX !== null && endY !== null) {
        const dist = getDistanceToSegment(clickX, clickY, startX, startY, endX, endY);
        if (dist < 8) {
          return { drawing: line, handle: "line" };
        }
      }
    }
  }

  // 3. 전체 수평선 체크
  if (store.drawings.horizontals) {
    for (const h of store.drawings.horizontals) {
      const price = typeof h === "object" ? h.price : h;
      const y = series.priceToCoordinate(price);
      if (y !== null && Math.abs(clickY - y) < 8) {
        return { drawing: h, handle: "line" };
      }
    }
  }

  return null;
}

// 드래그 진행 상태 변수
let draggingDrawing = null;
let draggingHandle = null; // "start", "end", "line"
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartPrice = 0;
let dragStartLogical = 0;
let dragStartDrawingState = null;

// 🚀 그리기 모드 마우스 클릭/드래그 핸들러 설정
export function initDrawingEvents() {
  const container = document.getElementById("pane-main");
  if (!container) return;

  if (window._drawingEventsInitialized) return;
  window._drawingEventsInitialized = true;

  container.addEventListener("mousedown", (e) => {
    if (!store.candleSeries || !store.chart) return;

    const chartRect = container.getBoundingClientRect();
    const clickX = e.clientX - chartRect.left;
    const clickY = e.clientY - chartRect.top;

    const price = store.candleSeries.coordinateToPrice(clickY);
    const logical =
      typeof store.chart.timeScale().coordinateToLogical === "function"
        ? store.chart.timeScale().coordinateToLogical(clickX)
        : null;

    // cursor 모드 드래그 히트 테스트 전용 조기 반환 없음 — handle 클릭 시 price=null 가능
    if (price === null && store.activeTool !== "cursor") return;

    // 우클릭 개별 삭제 대응 (cursor 툴 상태)
    if (e.button === 2 && store.activeTool === "cursor") {
      const hit = findHitDrawing(clickX, clickY);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        deleteDrawing(hit.drawing);
        return;
      }
    }

    if (e.button !== 0) return; // 좌클릭만 적용

    // cursor 모드인 경우 선택 & 드래그 개시 처리
    if (store.activeTool === "cursor") {
      const hit = findHitDrawing(clickX, clickY);
      if (hit) {
        store.selectedDrawing = hit.drawing;
        draggingDrawing = hit.drawing;
        draggingHandle = hit.handle;
        dragStartMouseX = clickX;
        dragStartMouseY = clickY;
        dragStartPrice = price;
        dragStartLogical = logical !== null ? logical : 0;

        if (hit.drawing.start && hit.drawing.end) {
          dragStartDrawingState = {
            start: { ...hit.drawing.start },
            end: { ...hit.drawing.end }
          };
        } else {
          dragStartDrawingState = {
            price: typeof hit.drawing === "object" ? hit.drawing.price : hit.drawing
          };
        }

        // 드래그 중 차트 스크롤/줌 잠금
        store.chart.applyOptions({
          handleScroll: false,
          handleScale: false
        });

        if (store._drawingPrimitive) {
          store._drawingPrimitive.updateAll();
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      } else {
        if (store.selectedDrawing) {
          store.selectedDrawing = null;
          if (window.updateFloatingDeleteButton) {
            window.updateFloatingDeleteButton();
          }
          if (store._drawingPrimitive) {
            store._drawingPrimitive.updateAll();
          }
        }
      }
    }

    // 1. 수평선(Horizontal) 그리기 도구 동작
    if (store.activeTool === "horizontal") {
      store.drawings.horizontals.push({
        id: Date.now() + Math.random(),
        price: price
      });
      selectDrawingTool("cursor");
      if (store._drawingPrimitive) {
        store._drawingPrimitive.updateAll();
      }
      return;
    }

    // 2. 추세선(Trendline) 그리기 도구 동작
    if (store.activeTool === "trendline") {
      if (!store.drawingStart) {
        // 첫 번째 점 지정
        store.drawingStart = { logical, price, x: clickX, y: clickY };
      } else {
        // 두 번째 점 지정 (종료)
        store.drawings.trendlines.push({
          id: Date.now() + Math.random(),
          start: store.drawingStart,
          end: { logical, price, x: clickX, y: clickY },
        });
        store.drawingStart = null;
        store.drawingTempEnd = null;

        // 그리기 완료 후 커서 모드로 돌아가기
        selectDrawingTool("cursor");
      }
      if (store._drawingPrimitive) {
        store._drawingPrimitive.updateAll();
      }
    }
  });

  container.addEventListener("mousemove", (e) => {
    if (!store.candleSeries || !store.chart) return;

    const chartRect = container.getBoundingClientRect();
    const moveX = e.clientX - chartRect.left;
    const moveY = e.clientY - chartRect.top;

    // 드래그 업데이트 처리
    if (store.activeTool === "cursor" && draggingDrawing) {
      const currentPrice = store.candleSeries.coordinateToPrice(moveY);
      const currentLogical =
        typeof store.chart.timeScale().coordinateToLogical === "function"
          ? store.chart.timeScale().coordinateToLogical(moveX)
          : null;

      if (currentPrice !== null || currentLogical !== null) {
        // price가 null이면 마지막 dragStartPrice 유지 (delta=0), logical도 마찬가지
        const priceDelta = currentPrice !== null ? currentPrice - dragStartPrice : 0;
        const logicalDelta = currentLogical !== null ? currentLogical - dragStartLogical : 0;

        if (draggingDrawing.start && draggingDrawing.end) {
          if (draggingHandle === "start") {
            draggingDrawing.start.price = dragStartDrawingState.start.price + priceDelta;
            draggingDrawing.start.logical = dragStartDrawingState.start.logical + logicalDelta;
          } else if (draggingHandle === "end") {
            draggingDrawing.end.price = dragStartDrawingState.end.price + priceDelta;
            draggingDrawing.end.logical = dragStartDrawingState.end.logical + logicalDelta;
          } else if (draggingHandle === "line") {
            draggingDrawing.start.price = dragStartDrawingState.start.price + priceDelta;
            draggingDrawing.start.logical = dragStartDrawingState.start.logical + logicalDelta;
            draggingDrawing.end.price = dragStartDrawingState.end.price + priceDelta;
            draggingDrawing.end.logical = dragStartDrawingState.end.logical + logicalDelta;
          }
        } else {
          const newPrice = dragStartDrawingState.price + priceDelta;
          if (typeof draggingDrawing === "object") {
            draggingDrawing.price = newPrice;
          } else {
            const idx = store.drawings.horizontals.indexOf(draggingDrawing);
            if (idx !== -1) {
              store.drawings.horizontals[idx] = newPrice;
              draggingDrawing = newPrice;
            }
          }
        }

        if (store._drawingPrimitive) {
          store._drawingPrimitive.updateAll();
        }
      }
      return;
    }

    // 마우스 커서 호버 스타일 제어
    if (store.activeTool === "cursor") {
      const hit = findHitDrawing(moveX, moveY);
      if (hit) {
        container.style.cursor = (hit.handle === "start" || hit.handle === "end") ? "move" : "pointer";
      } else {
        container.style.cursor = "crosshair";
      }
    }

    if (store.activeTool !== "trendline" || !store.drawingStart) return;

    const price = store.candleSeries.coordinateToPrice(moveY);
    const logical =
      typeof store.chart.timeScale().coordinateToLogical === "function"
        ? store.chart.timeScale().coordinateToLogical(moveX)
        : null;

    if (price !== null) {
      store.drawingTempEnd = { logical, price, x: moveX, y: moveY };
      if (store._drawingPrimitive) {
        store._drawingPrimitive.updateAll();
      }
    }
  });

  const endDrag = () => {
    if (draggingDrawing) {
      draggingDrawing = null;
      draggingHandle = null;
      dragStartDrawingState = null;

      if (store.chart) {
        store.chart.applyOptions({
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: {
              time: true,
              price: true,
            },
            mouseWheel: true,
            pinch: true,
          },
        });
      }
      if (store._drawingPrimitive) {
        store._drawingPrimitive.updateAll();
      }
    }
  };

  window.addEventListener("mouseup", endDrag);

  // 컨텍스트 메뉴 기본 브라우저 메뉴 차단
  container.addEventListener("contextmenu", (e) => {
    if (store.activeTool === "cursor") {
      const chartRect = container.getBoundingClientRect();
      const clickX = e.clientX - chartRect.left;
      const clickY = e.clientY - chartRect.top;
      const hit = findHitDrawing(clickX, clickY);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        deleteDrawing(hit.drawing);
      }
    }
  });

  // 키보드 Delete / Backspace 키 개별 삭제 대응
  window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      // Input/Textarea 입력 중인 경우 무시
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        return;
      }
      if (store.selectedDrawing && store.activeTool === "cursor") {
        deleteDrawing(store.selectedDrawing);
      }
    }
  });
}

// 🚀 그리기 도구 선택 및 액티브 하이라이트 UI 갱신 함수
export function selectDrawingTool(toolName) {
  if (toolName === "trash") {
    // 그리기 전체 초기화
    store.drawings.trendlines = [];
    store.drawings.horizontals = [];
    store.selectedDrawing = null;
    if (window.updateFloatingDeleteButton) {
      window.updateFloatingDeleteButton();
    }
    if (store._drawingPrimitive) {
      store._drawingPrimitive.updateAll();
    }
    // 자도 지우기
    if (typeof window.stopMeasuring === "function") {
      window.stopMeasuring();
    }
    selectDrawingTool("cursor");
    return;
  }

  store.activeTool = toolName;

  // 측정 자 모드 스위칭 연동
  if (toolName === "measure") {
    if (typeof window.setupMeasureTool === "function") {
      window.setupMeasureTool(true);
    }
  } else {
    if (typeof window.setupMeasureTool === "function") {
      window.setupMeasureTool(false);
    }
  }

  if (window.updateFloatingDeleteButton) {
    window.updateFloatingDeleteButton();
  }

  // 툴바 버튼 하이라이트 클래스 제어
  const tools = ["cursor", "trendline", "horizontal", "measure"];
  tools.forEach((t) => {
    const btn = document.getElementById(`draw-btn-${t}`);
    if (btn) {
      if (t === toolName) {
        btn.classList.add(
          "text-theme-accent",
          "border-theme-accent/40",
          "bg-theme-accent/10",
        );
        btn.classList.remove("text-theme-text/80");
      } else {
        btn.classList.remove(
          "text-theme-accent",
          "border-theme-accent/40",
          "bg-theme-accent/10",
        );
        btn.classList.add("text-theme-text/80");
      }
    }
  });
}

// 전역 노출
window.selectDrawingTool = selectDrawingTool;
window.initDrawingEvents = initDrawingEvents;
window.DrawingPrimitive = DrawingPrimitive;
