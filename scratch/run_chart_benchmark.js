// scratch/run_chart_benchmark.js
/**
 * 🚀 차트 실시간 렌더링 & 드래그/인터랙션 단위 벤치마크 샌드박스 (외부 API 0회, 100% 로컬)
 */
import { performance } from 'perf_hooks';

// 가상 차트 및 시리즈 모의 객체 (Lightweight Charts 네이티브 동작 모사)
class MockPriceScale {
  constructor(name) {
    this.name = name;
    this._width = 65;
    this.options = { minimumWidth: 0 };
  }
  width() {
    // Canvas DOM 측정 오버헤드 시뮬레이션
    let dummy = 0;
    for (let i = 0; i < 500; i++) dummy += Math.sqrt(i);
    return this._width;
  }
  applyOptions(opts) {
    // 캔버스 전체 리라이아웃 재계산 오버헤드 시뮬레이션
    let dummy = 0;
    for (let i = 0; i < 2000; i++) dummy += Math.sin(i);
    Object.assign(this.options, opts);
  }
}

class MockTimeScale {
  constructor() {
    this.range = { from: 50, to: 150 };
    this.rangeListeners = [];
    this.sizeListeners = [];
  }
  subscribeVisibleLogicalRangeChange(fn) {
    this.rangeListeners.push(fn);
  }
  subscribeSizeChange(fn) {
    this.sizeListeners.push(fn);
  }
  setVisibleLogicalRange(range) {
    this.range = range;
    let dummy = 0;
    for (let i = 0; i < 3000; i++) dummy += Math.cos(i);
  }
  triggerRangeChange(newRange) {
    this.range = newRange;
    for (const fn of this.rangeListeners) fn(newRange);
  }
  coordinateToLogical(x) { return x / 10; }
  logicalToCoordinate(l) { return l * 10; }
  coordinateToTime(x) { return 1700000000 + Math.floor(x * 60); }
}

class MockSeries {
  constructor(name) {
    this.name = name;
    this.data = [];
  }
  update(bar) {
    // 캔들 렌더링 오버헤드
    let dummy = 0;
    for (let i = 0; i < 1500; i++) dummy += Math.sqrt(i);
    this.data.push(bar);
  }
  setData(arr) {
    let dummy = 0;
    for (let i = 0; i < arr.length * 10; i++) dummy += Math.sqrt(i);
    this.data = [...arr];
  }
}

class MockChart {
  constructor(name) {
    this.name = name;
    this._timeScale = new MockTimeScale();
    this.scales = {
      right: new MockPriceScale("right"),
      left: new MockPriceScale("left"),
    };
    this.crosshairListeners = [];
  }
  timeScale() { return this._timeScale; }
  priceScale(side) { return this.scales[side] || this.scales.right; }
  subscribeCrosshairMove(fn) { this.crosshairListeners.push(fn); }
  triggerCrosshairMove(param) {
    for (const fn of this.crosshairListeners) fn(param);
  }
  applyOptions(opts) {
    let dummy = 0;
    for (let i = 0; i < 2500; i++) dummy += Math.tan(i);
  }
  clearCrosshairPosition() {}
}

// 벤치마크 러너
async function runBenchmark() {
  console.log("================================================================================");
  console.log("📊 [실제 단위 벤치마크 테스트 시작] (외부 API 호출 ZERO, 100% 로컬 샌드박스)");
  console.log("================================================================================\n");

  const store = {
    chart: new MockChart("MainChart"),
    chartVol: new MockChart("VolChart"),
    candleSeries: new MockSeries("Candle"),
    volumeSeries: new MockSeries("Volume"),
    kimchiSeries: new MockSeries("Kimchi"),
    mainData: Array.from({ length: 500 }, (_, i) => ({
      time: 1700000000 + i * 60,
      open: 100 + Math.sin(i),
      high: 105 + Math.sin(i),
      low: 95 + Math.sin(i),
      close: 102 + Math.sin(i),
      volume: 1000 + i,
    })),
    mainDataMap: new Map(),
    activeChart: null,
    isCrosshairActive: false,
    isUserZoomed: false,
  };

  store.mainData.forEach(d => store.mainDataMap.set(d.time, d));

  // 계측기
  const stats = {};
  function track(name, fn) {
    if (!stats[name]) stats[name] = { count: 0, totalMs: 0, maxMs: 0 };
    return function (...args) {
      const t0 = performance.now();
      try {
        return fn(...args);
      } finally {
        const dur = performance.now() - t0;
        stats[name].count++;
        stats[name].totalMs += dur;
        if (dur > stats[name].maxMs) stats[name].maxMs = dur;
      }
    };
  }

  // 1. syncPriceScaleWidths 로직
  let currentMaxRight = 0;
  let currentMaxLeft = 0;
  let lastWidthSyncTime = 0;
  let isResettingWidth = false;

  const rawSyncPriceScaleWidths = (force = false) => {
    if (isResettingWidth) return;
    const now = performance.now();
    if (!force && now - lastWidthSyncTime < 100) return;
    lastWidthSyncTime = performance.now();

    const charts = [store.chart, store.chartVol];
    let maxRight = 0;
    let maxLeft = 0;

    charts.forEach((c) => {
      maxRight = Math.max(maxRight, c.priceScale("right").width());
      maxLeft = Math.max(maxLeft, c.priceScale("left").width());
    });

    if (maxRight > 0 && maxRight !== currentMaxRight) {
      currentMaxRight = maxRight;
      charts.forEach((c) => c.priceScale("right").applyOptions({ minimumWidth: maxRight }));
    }
    if (maxLeft > 0 && maxLeft !== currentMaxLeft) {
      currentMaxLeft = maxLeft;
      charts.forEach((c) => c.priceScale("left").applyOptions({ minimumWidth: maxLeft }));
    }
  };
  const syncPriceScaleWidths = track("syncPriceScaleWidths", rawSyncPriceScaleWidths);

  // 2. syncTimeScales 로직
  let isSyncing = false;
  const rawSyncTime = (range) => {
    if (isSyncing || !range) return;
    isSyncing = true;
    try {
      store.chartVol.timeScale().setVisibleLogicalRange(range);
    } finally {
      isSyncing = false;
    }
  };
  const syncTimeScales = track("syncTimeScales (차트간 시간축 동기화)", rawSyncTime);

  store.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    syncTimeScales(range);
    syncPriceScaleWidths();
  });

  // 3. syncCrosshair 로직
  const rawCrosshairMove = (param) => {
    if (!param.point) return;
    const t0 = performance.now();
    // 마그네틱 계산
    const logical = store.chart.timeScale().coordinateToLogical(param.point.x);
    const snap = store.chart.timeScale().logicalToCoordinate(Math.round(logical));
    // 레전드 및 타겟 차트 갱신
    store.chartVol.timeScale().coordinateToTime(param.point.x);
  };
  const syncCrosshair = track("syncCrosshair (크로스헤어 마우스 무브)", rawCrosshairMove);
  store.chart.subscribeCrosshairMove(syncCrosshair);

  // 4. 실시간 웹소켓 틱 주입 로직
  const rawRealtimeUpdate = (price, qty) => {
    const last = store.mainData[store.mainData.length - 1];
    last.close = price;
    last.volume += qty;
    store.candleSeries.update(last);
    store.volumeSeries.update({ time: last.time, value: last.volume });
  };
  const renderRealtimeUpdate = track("renderRealtimeUpdate (실시간 틱 캔들 렌더링)", rawRealtimeUpdate);

  // ------------------ 🧪 시나리오 실행 ------------------

  console.log("▶ [시나리오 1] 초고빈도 웹소켓 틱 500회 연속 주입 (초당 100틱 스트레스 가정)...");
  for (let i = 0; i < 500; i++) {
    renderRealtimeUpdate(100 + (Math.random() - 0.5) * 2, Math.random() * 5);
  }

  console.log("▶ [시나리오 2] 마우스 좌클릭 와리가리 고속 드래그 300회 시뮬레이션...");
  for (let i = 0; i < 300; i++) {
    const from = 50 + Math.sin(i * 0.1) * 30;
    store.chart.timeScale().triggerRangeChange({ from, to: from + 100 });
  }

  console.log("▶ [시나리오 3] 마우스 크로스헤어 고속 이동 500회 시뮬레이션...");
  for (let i = 0; i < 500; i++) {
    store.chart.triggerCrosshairMove({ point: { x: (i % 100) * 10, y: 150 } });
  }

  // ------------------ 📊 결과 집계 및 출력 ------------------
  console.log("\n================================ 📊 [단위 벤치마크 계측 결과표] ================================");

  const report = Object.keys(stats).map((name) => {
    const s = stats[name];
    const avg = (s.totalMs / s.count).toFixed(4);
    return {
      "모듈/함수명": name,
      "호출 횟수": `${s.count} 회`,
      "총 소요시간 (ms)": Number(s.totalMs.toFixed(2)),
      "1회당 평균 (ms)": Number(avg),
      "최대 소요 (ms)": Number(s.maxMs.toFixed(3)),
    };
  });

  report.sort((a, b) => b["총 소요시간 (ms)"] - a["총 소요시간 (ms)"]);
  console.table(report);
  console.log("================================================================================================\n");

  const totalTime = report.reduce((acc, cur) => acc + cur["총 소요시간 (ms)"], 0);
  console.log(`📌 총 CPU 렌더링 점유 시간: ${totalTime.toFixed(2)}ms`);
  report.forEach((r, idx) => {
    const pct = ((r["총 소요시간 (ms)"] / totalTime) * 100).toFixed(1);
    console.log(`   ${idx + 1}위: [${r["모듈/함수명"]}] → ${r["총 소요시간 (ms)"]}ms (전체의 ${pct}%)`);
  });
  console.log("================================================================================================");
}

runBenchmark();
