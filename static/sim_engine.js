// sim_engine.js 🎮 시뮬레이터 수학 & 로직
import { store, tfSec } from "./_store.js";
import { mapTime } from "./chart_data.js";
import { performSyncPriceScaleWidths } from "./chart_sync.js";

function changeDir(d) {
  const bodyInput = document.getElementById("input-body");
  if (store.curDir === "bull") store.bullBody = bodyInput.value;
  else store.bearBody = bodyInput.value;

  store.curDir = d;

  const slider = document.getElementById("dir-slider");
  const btnBull = document.getElementById("dir-bull");
  const btnBear = document.getElementById("dir-bear");
  const btnGen = document.getElementById("btn-generate");

  if (d === "bull") {
    bodyInput.max = 200;
    bodyInput.value = store.bullBody;
    if (slider) {
      slider.style.transform = "translateX(0)";
      slider.style.backgroundColor = "var(--up)";
    }
    if (btnBull) btnBull.style.color = "white";
    if (btnBear) btnBear.style.color = "var(--text)";
    if (btnGen) btnGen.style.backgroundColor = "var(--up)";
  } else {
    bodyInput.max = 99;
    bodyInput.value = Math.min(store.bearBody, 99);
    if (slider) {
      slider.style.transform = "translateX(100%)";
      slider.style.backgroundColor = "var(--down)";
    }
    if (btnBull) btnBull.style.color = "var(--text)";
    if (btnBear) btnBear.style.color = "white";
    if (btnGen) btnGen.style.backgroundColor = "var(--down)";
  }

  // 슬라이더 콩나물 대가리 및 % 수치 색상 - 차트 캔들 상승/하락 컬러에 100% 귀속
  const simControls = document.getElementById("sim-controls");
  const simColor = d === "bull" ? "var(--up)" : "var(--down)";
  if (simControls) {
    simControls.style.setProperty("--sim-color", simColor);
  }
  ["input-body", "input-top", "input-bottom"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.accentColor = simColor;
  });
  ["val-body", "val-top", "val-bottom"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.color = simColor;
  });

  document.getElementById("val-body").innerText = bodyInput.value + "%";
  if (typeof updateStatus === "function") updateStatus();
  if (store.isHover && typeof updatePreview === "function") updatePreview();
}

function addCandle() {
  if (!store.mainData || !store.mainData.length) return;
  const n = getNext();
  if (!n || !n.close || n.close <= 0) return;
  store.mainData.push(n);
  store.candleSeries.setData(store.mainData);

  // 🚀 [원자적 너비 동기화] 캔들 생성 즉시 동일 동기 틱에서 볼륨 차트 우측 너비 일치 (덜그럭 0%)
  if (typeof performSyncPriceScaleWidths === "function") {
    performSyncPriceScaleWidths(false);
  }

  if (typeof updateStatus === "function") updateStatus();
  if (typeof updateLegend === "function") updateLegend(n);
  if (typeof updatePreview === "function") updatePreview();
}

function undoLast() {
  if (store.mainData && store.mainData.length > 1) {
    store.mainData.pop();
    store.candleSeries.setData(store.mainData);

    // 🚀 [원자적 너비 동기화] 캔들 삭제 즉시 동일 동기 틱에서 볼륨 차트 우측 너비 일치
    if (typeof performSyncPriceScaleWidths === "function") {
      performSyncPriceScaleWidths(false);
    }

    const lastCandle = store.mainData[store.mainData.length - 1];
    if (typeof updateStatus === "function") updateStatus();
    if (typeof updateLegend === "function") updateLegend(lastCandle);
    if (store.isHover && typeof updatePreview === "function") updatePreview();
    // Xconsole.log("✅ Undo 완료. 현재 데이터 개수:", store.mainData.length);
  }
}

function getNext() {
  if (!store.mainData || !store.mainData.length) return { close: 0 };

  const last = store.mainData[store.mainData.length - 1];
  const o = last.close;
  // 유효한 양수 시가가 아니면 안전 리턴
  if (!o || o <= 0 || !Number.isFinite(o)) return { close: 0 };

  const bodyEl = document.getElementById("input-body");
  const topEl = document.getElementById("input-top");
  const bottomEl = document.getElementById("input-bottom");

  let b = Math.max(0, parseFloat(bodyEl ? bodyEl.value : 0) || 0) / 100;
  const t = Math.max(0, parseFloat(topEl ? topEl.value : 0) || 0) / 100;
  const bt = Math.max(0, parseFloat(bottomEl ? bottomEl.value : 0) || 0) / 100;

  if (store.curDir === "bear") b = Math.min(b, 0.99);

  const c = store.curDir === "bull" ? o * (1 + b) : o * (1 - b);
  const highLimit = Math.max(o, c);
  const lowLimit = Math.min(o, c);
  const lastTime =
    window.getUnixSeconds && typeof window.getUnixSeconds === "function"
      ? window.getUnixSeconds(last.time)
      : typeof last.time === "string"
        ? Math.floor(new Date(last.time).getTime() / 1000)
        : last.time;
  const nextTime = lastTime + (tfSec[store.currentTF] || 86400);

  // [수학적 비율 기반 꼬리 산출 - 절대 0 이하/음수 불가 & 무한 극소수점 완벽 대응]
  // 1. 상단 꼬리: 몸통 최고점(highLimit) 기준 t% 비율 확장
  const safeHigh = Math.max(highLimit, highLimit * (1 + t));

  // 2. 하단 꼬리: 몸통 최저점(lowLimit) 기준 bt% 비율 감쇄 (선형 뺄셈이 아닌 기하학적 비율 감소)
  // bt가 최대(100%)여도 최저점의 99%까지만 하락하도록 클램핑하여 0.000000... 무한 점근 수렴 보장 (음수 불가)
  const clampedBt = Math.min(bt, 0.99);
  const safeLow = Math.max(Number.MIN_VALUE, lowLimit * (1 - clampedBt));

  const rawCandle = {
    time: nextTime,
    open: o,
    high: safeHigh,
    low: Math.min(safeLow, lowLimit),
    close: Math.max(Number.MIN_VALUE, c),
  };

  return mapTime(rawCandle, store.currentTF);
}

window.changeDir = changeDir;
window.addCandle = addCandle;
window.undoLast = undoLast;
window.getNext = getNext;
// ================== chart.js에서 이동됨 ==================
export function updatePreview() {
  if (
    store.mainData.length &&
    store.isHover &&
    typeof window.getNext === "function"
  ) {
    const nextCandle = window.getNext();
    if (!nextCandle || !nextCandle.close || nextCandle.close <= 0) return;
    store.previewSeries.setData([nextCandle]);
  }
}
window.updatePreview = updatePreview;
