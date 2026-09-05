// scratch/chart_perf_sandbox.js
/**
 * 🚀 차트 실시간 렌더링 및 인터랙션 성능 정밀 계측 샌드박스 프로파일러
 * 
 * 계측 대상:
 * 1. syncPriceScaleWidths (너비 동기화)
 * 2. renderRealtimeUpdate (실시간 틱 캔들 렌더링)
 * 3. syncCrosshair / renderTargetCharts (크로스헤어 마우스 이동 동기화)
 * 4. syncTimeScales (차트 간 시간축 동기화)
 * 5. updateLegend / updateRealtimeCountdown
 * 6. LightweightCharts API 호출 (applyOptions, update, setVisibleLogicalRange 등)
 * 7. Long Task / Frame Drops (Jank, 16.6ms 초과 프레임 계측)
 */

(function initChartSandboxProfiler() {
  console.log("%c🔥 [Chart Profiler Sandbox] 계측 시작...", "color: #00ffaa; font-weight: bold; font-size: 14px;");

  const metrics = {
    calls: {},
    totalTime: {},
    maxTime: {},
    minTime: {},
    longFrames: 0,
    totalFrames: 0,
    fpsHistory: [],
  };

  function profileFunc(obj, fnName, label) {
    if (!obj || typeof obj[fnName] !== "function") return;
    const original = obj[fnName];
    metrics.calls[label] = 0;
    metrics.totalTime[label] = 0;
    metrics.maxTime[label] = 0;
    metrics.minTime[label] = Infinity;

    obj[fnName] = function (...args) {
      const t0 = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        const dur = performance.now() - t0;
        metrics.calls[label]++;
        metrics.totalTime[label] += dur;
        if (dur > metrics.maxTime[label]) metrics.maxTime[label] = dur;
        if (dur < metrics.minTime[label]) metrics.minTime[label] = dur;
      }
    };
  }

  // 1. 주요 전역 및 윈도우 함수 인터셉트
  profileFunc(window, "syncPriceScaleWidths", "syncPriceScaleWidths");
  profileFunc(window, "resetPriceScaleWidthSync", "resetPriceScaleWidthSync");
  profileFunc(window, "updateRealtimeCountdown", "updateRealtimeCountdown");
  profileFunc(window, "updateLegend", "updateLegend");
  profileFunc(window, "applyChartLayout", "applyChartLayout");

  // 2. store 내부 차트 인스턴스 인터셉트
  if (window.store) {
    if (window.store.candleSeries) {
      profileFunc(window.store.candleSeries, "update", "candleSeries.update");
      profileFunc(window.store.candleSeries, "applyOptions", "candleSeries.applyOptions");
    }
    if (window.store.volumeSeries) {
      profileFunc(window.store.volumeSeries, "update", "volumeSeries.update");
    }
    if (window.store.kimchiSeries) {
      profileFunc(window.store.kimchiSeries, "update", "kimchiSeries.update");
      profileFunc(window.store.kimchiSeries, "setData", "kimchiSeries.setData");
    }
    if (window.store.chart) {
      profileFunc(window.store.chart, "applyOptions", "mainChart.applyOptions");
      if (window.store.chart.timeScale) {
        const ts = window.store.chart.timeScale();
        profileFunc(ts, "setVisibleLogicalRange", "mainChart.setVisibleLogicalRange");
      }
    }
    if (window.store.chartVol) {
      profileFunc(window.store.chartVol, "applyOptions", "volChart.applyOptions");
      if (window.store.chartVol.timeScale) {
        const ts = window.store.chartVol.timeScale();
        profileFunc(ts, "setVisibleLogicalRange", "volChart.setVisibleLogicalRange");
      }
    }
    if (window.store._drawingPrimitive) {
      profileFunc(window.store._drawingPrimitive, "updateAll", "drawingPrimitive.updateAll");
    }
  }

  // 3. FPS 및 Jank(Long Frame) 모니터링 루프
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsTimer = performance.now();

  function measureFrame() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    metrics.totalFrames++;

    // 16.6ms 기준 초과 프레임(렉) 카운트
    if (delta > 20) {
      metrics.longFrames++;
    }

    frameCount++;
    if (now - fpsTimer >= 1000) {
      metrics.fpsHistory.push(frameCount);
      frameCount = 0;
      fpsTimer = now;
    }

    requestAnimationFrame(measureFrame);
  }
  requestAnimationFrame(measureFrame);

  // 4. 리포트 출력 함수
  window.__dumpPerfReport = function () {
    console.log("\n================ 📊 [차트 샌드박스 성능 프로파일링 결과 리포트] ================");
    const avgFps = metrics.fpsHistory.length
      ? (metrics.fpsHistory.reduce((a, b) => a + b, 0) / metrics.fpsHistory.length).toFixed(1)
      : "N/A";
    const jankRate = metrics.totalFrames
      ? ((metrics.longFrames / metrics.totalFrames) * 100).toFixed(1)
      : 0;

    console.log(`🎯 평균 FPS: ${avgFps} fps | 총 프레임: ${metrics.totalFrames} | 렉 발생 프레임(>20ms): ${metrics.longFrames} (${jankRate}%)`);
    console.log("--------------------------------------------------------------------------------");

    const reportTable = Object.keys(metrics.calls).map((label) => {
      const calls = metrics.calls[label];
      const total = metrics.totalTime[label];
      const avg = calls > 0 ? (total / calls).toFixed(3) : 0;
      const max = calls > 0 ? metrics.maxTime[label].toFixed(3) : 0;
      return {
        "함수/지점": label,
        "호출 횟수": calls,
        "총 점유시간 (ms)": Number(total.toFixed(2)),
        "1회 평균 (ms)": Number(avg),
        "최대 소요 (ms)": Number(max),
      };
    });

    // 점유시간 기준 내림차순 정렬
    reportTable.sort((a, b) => b["총 점유시간 (ms)"] - a["총 점유시간 (ms)"]);
    console.table(reportTable);
    console.log("================================================================================\n");
    return {
      avgFps,
      jankRate,
      reportTable,
    };
  };

  // 5. 스트레스 테스트 시뮬레이터 (웹소켓 틱 폭격 + 마우스 인터랙션)
  window.__runStressTest = async function (durationSec = 5, ticksPerSec = 50) {
    console.log(`\n🚀 [스트레스 테스트 시작] 지속시간: ${durationSec}초, 초당 틱: ${ticksPerSec}개`);
    const intervalMs = 1000 / ticksPerSec;
    const startTime = Date.now();
    let tickCount = 0;

    const stressInterval = setInterval(() => {
      if (Date.now() - startTime > durationSec * 1000) {
        clearInterval(stressInterval);
        console.log(`✅ [스트레스 테스트 완료] 총 ${tickCount}개 틱 주입 완료. 결과 집계 중...`);
        setTimeout(() => {
          window.__dumpPerfReport();
        }, 500);
        return;
      }

      if (window.store && window.store.mainData && window.store.mainData.length) {
        const last = window.store.mainData[window.store.mainData.length - 1];
        const fakePrice = Number(last.close) * (1 + (Math.random() - 0.5) * 0.001);
        const fakeQty = Math.random() * 2;

        // stream_render의 renderRealtimeUpdate 또는 candleSeries.update 호출
        if (window.store.candleSeries) {
          try {
            window.store.candleSeries.update({
              time: last.time,
              open: last.open,
              high: Math.max(last.high, fakePrice),
              low: Math.min(last.low, fakePrice),
              close: fakePrice,
            });
            if (window.store.volumeSeries) {
              window.store.volumeSeries.update({
                time: last.time,
                value: (last.volume || 0) + fakeQty,
                color: fakePrice >= last.open ? "#0ecb81" : "#f6465d",
              });
            }
          } catch (e) {}
        }
        tickCount++;
      }
    }, intervalMs);
  };

  console.log("💡 [준비 완료] window.__runStressTest(5, 50) 또는 window.__dumpPerfReport() 로 테스트 가능합니다.");
})();
