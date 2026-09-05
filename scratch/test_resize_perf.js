// scratch/test_resize_perf.js
/**
 * 🔬 PC 브라우저 창 크기 조절(Resize) 시 렌더링 병목 및 Jank(프레임 튐) 정량 계측 벤치마크
 */

function runResizeBenchmark() {
  console.log("================================================================================");
  console.log("🔬 [PC 브라우저 창 크기 조절(Window Resize) 렌더링 병목 정밀 계측 벤치마크]");
  console.log("================================================================================");

  // 시뮬레이션 환경 구성
  const metrics = {
    resizeEvents: 100,
    applyChartLayoutCalls: 0,
    chartResizeCalls: 0,
    domReflowQueries: 0,
    syncPriceScaleCalls: 0,
    totalCpuTime: 0,
    peakFrameTime: 0,
    jankFrames: 0,
  };

  // 모의 DOM 및 캐시 상태
  let mainWidthCache = 1200;
  let mainHeightCache = 600;
  let volWidthCache = 1200;
  let volHeightCache = 200;

  let resizeDebounce = null;
  let pendingWidthSync = false;

  // 100회 연속 리사이즈 이벤트 시뮬레이션 (창 테두리 잡고 1~2초간 마구 늘렸다 줄였다 하는 상황)
  const tStart = performance.now();

  for (let i = 0; i < metrics.resizeEvents; i++) {
    const frameStart = performance.now();

    // 1. window resize 이벤트 인입 (창 크기가 1200px -> 800px -> 1600px 등으로 요동)
    const newWidth = Math.round(1200 + Math.sin(i / 10) * 400);
    const newHeight = Math.round(800 + Math.cos(i / 10) * 200);

    // 2. chart_layout.js 디바운스 (100ms)
    // 리사이즈 도중에는 디바운스에 의해 applyChartLayout 호출이 지연/병합됨
    metrics.applyChartLayoutCalls++;

    // 3. DOM 너비 측정 쿼리 (clientWidth / clientHeight Reflow 발생)
    metrics.domReflowQueries += 4; // paneMain.clientWidth/Height + paneVol.clientWidth/Height

    const wMain = newWidth - 300; // 우측 패널 제외
    const hMain = Math.round(newHeight * 0.75);
    const wVol = wMain;
    const hVol = Math.round(newHeight * 0.25);

    // 4. 캐시 변경 감지 후 실제 캔버스 resize 호출
    if (mainWidthCache !== wMain || mainHeightCache !== hMain) {
      mainWidthCache = wMain;
      mainHeightCache = hMain;
      metrics.chartResizeCalls++;
    }

    if (volWidthCache !== wVol || volHeightCache !== hVol) {
      volWidthCache = wVol;
      volHeightCache = hVol;
      metrics.chartResizeCalls++;
    }

    // 5. subscribeSizeChange -> syncPriceScaleWidths (150ms 디바운스)
    if (i % 5 === 0) {
      metrics.syncPriceScaleCalls++;
    }

    const frameDuration = performance.now() - frameStart;
    if (frameDuration > metrics.peakFrameTime) {
      metrics.peakFrameTime = frameDuration;
    }
    if (frameDuration > 16.6) {
      metrics.jankFrames++;
    }
  }

  metrics.totalCpuTime = performance.now() - tStart;

  // 리포트 출력
  console.log(`\n📊 [1] 리사이즈 100회 연속 발생 시뮬레이션 결과`);
  console.log(`- 리사이즈 이벤트 수신: ${metrics.resizeEvents} 회`);
  console.log(`- 실제 캔버스 재렌더링(Canvas resize): ${metrics.chartResizeCalls} 회`);
  console.log(`- DOM 레이아웃 강제 쿼리 (Reflow): ${metrics.domReflowQueries} 회`);
  console.log(`- 가격 축 너비 동기화 실행: ${metrics.syncPriceScaleCalls} 회`);

  console.log(`\n📊 [2] 성능 및 프레임 드랍 계측`);
  console.log(`- 총 소요 시간: ${metrics.totalCpuTime.toFixed(2)} ms`);
  console.log(`- 1회 평균 소요: ${(metrics.totalCpuTime / metrics.resizeEvents).toFixed(3)} ms`);
  console.log(`- 1회 최대 피크: ${metrics.peakFrameTime.toFixed(3)} ms`);
  console.log(`- 🚨 16.6ms 초과 렉 발생 프레임 (Jank Rate): ${((metrics.jankFrames / metrics.resizeEvents) * 100).toFixed(1)}% (${metrics.jankFrames}회)`);

  console.log("\n================================================================================");
}

runResizeBenchmark();
