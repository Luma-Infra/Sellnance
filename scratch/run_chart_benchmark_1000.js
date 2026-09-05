// scratch/run_chart_benchmark_1000.js
import { performance } from 'perf_hooks';

class MockPriceScale {
  constructor(name) { this.name = name; this._width = 65; }
  width() {
    let dummy = 0;
    for (let i = 0; i < 500; i++) dummy += Math.sqrt(i);
    return this._width;
  }
  applyOptions(opts) {
    let dummy = 0;
    for (let i = 0; i < 3000; i++) dummy += Math.sin(i);
  }
}

class MockTimeScale {
  constructor() {
    this.range = { from: 50, to: 150 };
    this.rangeListeners = [];
  }
  subscribeVisibleLogicalRangeChange(fn) { this.rangeListeners.push(fn); }
  setVisibleLogicalRange(range) {
    this.range = range;
    let dummy = 0;
    for (let i = 0; i < 4000; i++) dummy += Math.cos(i);
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
  constructor(name) { this.name = name; this.data = []; }
  update(bar) {
    let dummy = 0;
    for (let i = 0; i < 2000; i++) dummy += Math.sqrt(i);
  }
  setData(arr) {
    let dummy = 0;
    for (let i = 0; i < arr.length * 30; i++) dummy += Math.sqrt(i);
    this.data = [...arr];
  }
}

class MockChart {
  constructor(name) {
    this.name = name;
    this._timeScale = new MockTimeScale();
    this.scales = { right: new MockPriceScale("right"), left: new MockPriceScale("left") };
    this.crosshairListeners = [];
  }
  timeScale() { return this._timeScale; }
  priceScale(side) { return this.scales[side] || this.scales.right; }
  subscribeCrosshairMove(fn) { this.crosshairListeners.push(fn); }
  triggerCrosshairMove(param) {
    for (const fn of this.crosshairListeners) fn(param);
  }
}

async function run1000Benchmark() {
  const store = {
    chart: new MockChart("MainChart"),
    chartVol: new MockChart("VolChart"),
    candleSeries: new MockSeries("Candle"),
    volumeSeries: new MockSeries("Volume"),
    kimchiSeries: new MockSeries("Kimchi"),
  };

  const stats = {};
  function track(name, fn) {
    if (!stats[name]) stats[name] = { count: 0, totalMs: 0, maxMs: 0 };
    return async function (...args) {
      const t0 = performance.now();
      try {
        return await fn(...args);
      } finally {
        const dur = performance.now() - t0;
        stats[name].count++;
        stats[name].totalMs += dur;
        if (dur > stats[name].maxMs) stats[name].maxMs = dur;
      }
    };
  }

  // 1. syncTimeScales (상하 듀얼 차트 동기화)
  let isSyncing = false;
  const syncTime = track("syncTimeScales (상하 듀얼 차트 동시 리페인트)", (range) => {
    if (isSyncing || !range) return;
    isSyncing = true;
    try {
      store.chartVol.timeScale().setVisibleLogicalRange(range);
    } finally {
      isSyncing = false;
    }
  });

  // 2. loadMoreHistory + setData
  let isCheckingLoadMore = false;
  const loadMore = track("loadMoreHistory + setData (과거봉 캔버스 재구축)", async () => {
    const bigData = Array.from({ length: 1500 }, (_, i) => ({
      time: i * 60, open: 100, high: 105, low: 95, close: 100, volume: 1000
    }));
    store.candleSeries.setData(bigData);
    store.volumeSeries.setData(bigData);
  });

  // 3. syncPriceScaleWidths
  let lastWidthTime = 0;
  const syncWidth = track("syncPriceScaleWidths (너비 조회 및 applyOptions)", () => {
    const now = performance.now();
    if (now - lastWidthTime < 100) return;
    lastWidthTime = now;
    const r1 = store.chart.priceScale("right").width();
    const r2 = store.chartVol.priceScale("right").width();
    store.chart.priceScale("right").applyOptions({ minimumWidth: Math.max(r1, r2) });
    store.chartVol.priceScale("right").applyOptions({ minimumWidth: Math.max(r1, r2) });
  });

  // 4. 실시간 틱 수신 렌더링
  const realtimeTick = track("renderRealtimeUpdate (실시간 틱 캔들 갱신)", (price) => {
    store.candleSeries.update({ time: Date.now(), open: price, high: price, low: price, close: price });
    store.volumeSeries.update({ time: Date.now(), value: 100 });
  });

  // 5. 크로스헤어 마우스 이동
  const syncCrosshair = track("syncCrosshair (크로스헤어 마우스 무브)", (param) => {
    if (!param.point) return;
    const logical = store.chart.timeScale().coordinateToLogical(param.point.x);
    const snap = store.chart.timeScale().logicalToCoordinate(Math.round(logical));
    store.chartVol.timeScale().coordinateToTime(param.point.x);
  });
  store.chart.subscribeCrosshairMove(syncCrosshair);

  // 리스너 바인딩
  store.chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    syncTime(range);
    syncWidth();
    if (range.from < 10 && !isCheckingLoadMore) {
      isCheckingLoadMore = true;
      await loadMore();
      setTimeout(() => { isCheckingLoadMore = false; }, 800);
    }
  });

  console.log("================================================================================");
  console.log("🧪 [1,000회 복합 스트레스 벤치마크 실행 중...]");
  console.log("================================================================================\n");

  const startBenchmark = performance.now();

  // 1,000회 틱 + 1,000회 와리가리 드래그 + 1,000회 크로스헤어 이동
  for (let i = 0; i < 1000; i++) {
    realtimeTick(100 + Math.random());
    store.chart.triggerCrosshairMove({ point: { x: (i % 200) * 5, y: 150 } });
    const from = Math.floor(40 + Math.sin(i * 0.1) * 35);
    await store.chart.timeScale().triggerRangeChange({ from, to: from + 100 });
  }

  const endBenchmark = performance.now();

  console.log("================================ 📊 [1,000회 실측 계측표] ================================");
  const report = Object.keys(stats).map((name) => {
    const s = stats[name];
    const avg = (s.totalMs / s.count).toFixed(4);
    return {
      "모듈/동작 항목": name,
      "실행 횟수": `${s.count} 회`,
      "총 CPU 점유 (ms)": Number(s.totalMs.toFixed(2)),
      "1회당 평균 (ms)": Number(avg),
      "1회 최대 피크 (ms)": Number(s.maxMs.toFixed(3)),
    };
  });

  report.sort((a, b) => b["총 CPU 점유 (ms)"] - a["총 CPU 점유 (ms)"]);
  console.table(report);
  console.log("========================================================================================\n");

  const total = report.reduce((acc, cur) => acc + cur["총 CPU 점유 (ms)"], 0);
  console.log(`⏱️ 1,000회 총 소요 시간: ${(endBenchmark - startBenchmark).toFixed(2)}ms (CPU 연산 순수 점유: ${total.toFixed(2)}ms)\n`);
  report.forEach((r, idx) => {
    const pct = ((r["총 CPU 점유 (ms)"] / total) * 100).toFixed(1);
    console.log(`🚨 병목 ${idx + 1}위: [${r["모듈/동작 항목"]}] → ${r["총 CPU 점유 (ms)"]}ms (${pct}%)`);
  });
  console.log("========================================================================================");
}

run1000Benchmark();
