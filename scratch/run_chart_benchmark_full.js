// scratch/run_chart_benchmark_full.js
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
  }
  timeScale() { return this._timeScale; }
  priceScale(side) { return this.scales[side] || this.scales.right; }
}

async function runDeepBenchmark() {
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

  // 1. syncTimeScales
  let isSyncing = false;
  const syncTime = track("1. syncTimeScales (상하 듀얼 차트 동시 리페인트)", (range) => {
    if (isSyncing || !range) return;
    isSyncing = true;
    try {
      store.chartVol.timeScale().setVisibleLogicalRange(range);
    } finally {
      isSyncing = false;
    }
  });

  // 2. loadMoreHistory + setData (과거 데이터 로드 시 캔버스 재구축)
  let isCheckingLoadMore = false;
  const loadMore = track("2. loadMoreHistory + setData (과거봉 병합 및 캔버스 재구축)", async () => {
    // 500개 과거 캔들 병합 후 setData 실행 시뮬레이션
    const bigData = Array.from({ length: 1500 }, (_, i) => ({
      time: i * 60,
      open: 100, high: 105, low: 95, close: 100, volume: 1000
    }));
    store.candleSeries.setData(bigData);
    store.volumeSeries.setData(bigData);
  });

  // 3. syncPriceScaleWidths
  let lastWidthTime = 0;
  const syncWidth = track("3. syncPriceScaleWidths (너비 조회 및 applyOptions)", () => {
    const now = performance.now();
    if (now - lastWidthTime < 100) return;
    lastWidthTime = now;
    const r1 = store.chart.priceScale("right").width();
    const r2 = store.chartVol.priceScale("right").width();
    store.chart.priceScale("right").applyOptions({ minimumWidth: Math.max(r1, r2) });
    store.chartVol.priceScale("right").applyOptions({ minimumWidth: Math.max(r1, r2) });
  });

  // 4. 실시간 틱 수신 렌더링
  const realtimeTick = track("4. renderRealtimeUpdate (초고빈도 틱 캔들 갱신)", (price) => {
    store.candleSeries.update({ time: Date.now(), open: price, high: price, low: price, close: price });
    store.volumeSeries.update({ time: Date.now(), value: 100 });
  });

  // 드래그 리스너 바인딩
  store.chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    syncTime(range);
    syncWidth();
    if (range.from < 10 && !isCheckingLoadMore) {
      isCheckingLoadMore = true;
      await loadMore();
      setTimeout(() => { isCheckingLoadMore = false; }, 800);
    }
  });

  console.log("\n================================================================================");
  console.log("🧪 [고속 와리가리 드래그 + 틱 수신 복합 스트레스 실측 벤치마크]");
  console.log("================================================================================");

  // 시뮬레이션: 마우스 좌우 와리가리 드래그 200회 (중간중간 좌측 끝 도달) + 실시간 틱 300회
  for (let i = 0; i < 200; i++) {
    // 틱 주입
    realtimeTick(100 + Math.random());

    // 와리가리 드래그 (좌우로 심하게 흔들어서 from이 0~80 사이를 왔다갔다 함)
    const from = Math.floor(40 + Math.sin(i * 0.2) * 35); // 5 ~ 75 사이 왕복
    await store.chart.timeScale().triggerRangeChange({ from, to: from + 100 });
  }

  console.log("\n================================ 📊 [정밀 실측 계측표] ================================");
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
  report.forEach((r, idx) => {
    const pct = ((r["총 CPU 점유 (ms)"] / total) * 100).toFixed(1);
    console.log(`🚨 병목 ${idx + 1}위: [${r["모듈/동작 항목"]}] → ${r["총 CPU 점유 (ms)"]}ms (전체 CPU의 ${pct}%)`);
  });
  console.log("========================================================================================");
}

runDeepBenchmark();
