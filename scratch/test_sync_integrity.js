// scratch/test_sync_integrity.js
/**
 * 🔬 차트-볼륨 날짜 동기화 및 크로스헤어 정합성 붕괴 정량 계측 벤치마크
 * 
 * 시뮬레이션 항목:
 * 1. [비동기 rAF 랙 테스트] 고속 패닝/드래그 시 메인 vs 볼륨 LogicalRange 불일치율 측정
 * 2. [크로스헤어 좌표 오차 테스트] 마우스 이동 시 메인 봉 타임스탬프 vs 볼륨 봉 타임스탬프 일치율
 * 3. [데이터 길이/타임스탬프 비정렬 테스트] 메인 캔들과 서브(거래량/김프) 데이터 타임스탬프 정렬 정합성
 */

function runSyncIntegrityBenchmark() {
  console.log("================================================================================");
  console.log("🔬 [차트 & 볼륨 시간축/크로스헤어 정합성 붕괴 정량 계측 벤치마크 시작]");
  console.log("================================================================================");

  // 1. 가상 캔들 및 볼륨 데이터셋 생성 (500개 봉)
  const baseTime = 1700000000;
  const candleData = [];
  const volumeData = [];
  const kimchiData = [];

  for (let i = 0; i < 500; i++) {
    const t = baseTime + i * 60;
    candleData.push({ time: t, open: 100, high: 105, low: 95, close: 102 });
    volumeData.push({ time: t, value: 1000 + i });
    // 김프 데이터에 5개 결측치(데이터 지연/누락)가 발생하는 현실적 시나리오
    if (i % 100 !== 0) {
      kimchiData.push({ time: t, value: 2.5 });
    }
  }

  // ----------------------------------------------------
  // 시나리오 A: rAF 기반 비동기 timeScale 동기화 시 정합성 계측
  // ----------------------------------------------------
  let mainLogicalRange = { from: 400, to: 499 };
  let volLogicalRange = { from: 400, to: 499 };
  let syncTimeRaf = null;
  let pendingSyncRange = null;

  // 비동기 rAF 동기화 모의 함수
  let desyncFrameCount = 0;
  let totalDragEvents = 1000;

  // 마우스 고속 드래그 시뮬레이션 (1000회 연속 드래그)
  for (let i = 0; i < totalDragEvents; i++) {
    // 1) 메인 차트가 즉시 드래그되어 이동
    const delta = (Math.random() - 0.5) * 10;
    mainLogicalRange = {
      from: mainLogicalRange.from + delta,
      to: mainLogicalRange.to + delta,
    };

    // 2) rAF 등록 (현재 chart.js 방식)
    pendingSyncRange = mainLogicalRange;
    
    // 이 순간(현재 렌더 프레임) 메인과 서브의 상태 비교
    // 브라우저 렌더러가 현재 프레임을 그릴 때 두 차트의 시간축이 같은가?
    if (Math.abs(mainLogicalRange.from - volLogicalRange.from) > 0.001) {
      desyncFrameCount++;
    }

    // 다음 rAF 틱에서 비동기 반영
    if (i % 3 === 0) { // 3번의 mousemove 당 1회 rAF(16.6ms) 실행 시뮬레이션
      volLogicalRange = pendingSyncRange;
      pendingSyncRange = null;
    }
  }

  const rafDesyncRate = ((desyncFrameCount / totalDragEvents) * 100).toFixed(2);

  // ----------------------------------------------------
  // 시나리오 B: 동기식 락(Sync Lock) 적용 시 정합성 계측
  // ----------------------------------------------------
  let syncLockMainRange = { from: 400, to: 499 };
  let syncLockVolRange = { from: 400, to: 499 };
  let isSyncing = false;
  let syncLockDesyncCount = 0;

  for (let i = 0; i < totalDragEvents; i++) {
    const delta = (Math.random() - 0.5) * 10;
    if (!isSyncing) {
      isSyncing = true;
      syncLockMainRange = {
        from: syncLockMainRange.from + delta,
        to: syncLockMainRange.to + delta,
      };
      // 동기식 직접 전달 (동일 틱 즉시 복사)
      syncLockVolRange = syncLockMainRange;
      isSyncing = false;
    }

    if (Math.abs(syncLockMainRange.from - syncLockVolRange.from) > 0.001) {
      syncLockDesyncCount++;
    }
  }

  const syncLockDesyncRate = ((syncLockDesyncCount / totalDragEvents) * 100).toFixed(2);

  // ----------------------------------------------------
  // 시나리오 C: 봉 인덱스(Logical Index) vs 날짜(Time) 불일치율
  // ----------------------------------------------------
  let indexTimeMismatchCount = 0;
  for (let i = 0; i < 500; i++) {
    const candle = candleData[i];
    const kimchi = kimchiData[i]; // 결측치가 있는 배열
    if (!kimchi || candle.time !== kimchi.time) {
      indexTimeMismatchCount++;
    }
  }
  const dataMismatchRate = ((indexTimeMismatchCount / 500) * 100).toFixed(2);

  // ----------------------------------------------------
  // 결과 리포트 출력
  // ----------------------------------------------------
  console.log(`\n📊 [1] rAF 비동기 지연으로 인한 화면 불일치 (Jank/Desync)`);
  console.log(`- 테스트 드래그 횟수: ${totalDragEvents} 회`);
  console.log(`- 불일치 발생 횟수: ${desyncFrameCount} 회`);
  console.log(`- 💥 정합성 붕괴율 (rAF 방식): ${rafDesyncRate}% (매 드래그 순간마다 1프레임 래깅 발생)`);

  console.log(`\n📊 [2] 동기식 락(Sync Lock) 적용 시`);
  console.log(`- 불일치 발생 횟수: ${syncLockDesyncCount} 회`);
  console.log(`- ✅ 정합성 붕괴율 (Sync Lock): ${syncLockDesyncRate}% (완벽한 0% 일치)`);

  console.log(`\n📊 [3] 차트 간 데이터 결측치/타임스탬프 불일치 시 인덱스 왜곡률`);
  console.log(`- 메인 캔들 vs 서브 차트 타임스탬프 불일치 봉: ${indexTimeMismatchCount} / 500 개`);
  console.log(`- 💥 인덱스 어긋남 발생률: ${dataMismatchRate}% (LogicalRange 동기화 시 날짜가 밀리는 현상)`);
  console.log("================================================================================\n");
}

runSyncIntegrityBenchmark();
