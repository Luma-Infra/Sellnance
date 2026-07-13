/**
 * ⚡ Sellnance F12 Console Performance Profiler (임의 코인 일대일 대조용) ⚡
 * 
 * [사용 방법]
 * 1. F12 개발자 도구 Console 탭에 복사+붙여넣기하여 실행하십시오.
 * 2. 팝업창(prompt)에 비교를 원하는 코인 A(김프 있음)와 코인 B(김프 없음)를 입력합니다.
 * 3. 각 코인을 번갈아 조회하고 마우스 크로스헤어를 몇 번 움직여 데이터를 누적시킵니다.
 * 4. 콘솔창에 `showReport()`를 치거나 코인을 바꿀 때마다 실시간 연산량 비교 테이블이 즉시 출력됩니다.
 */

(function () {
  console.clear();

  let coinA = "SXT";
  let coinB = "APR";

  if (typeof window !== "undefined" && typeof prompt === "function") {
    coinA = prompt("비교할 첫 번째 코인 (예: 김프 있는 SXT, BTC 등) 티커를 입력하세요:", "SXT") || "SXT";
    coinB = prompt("비교할 두 번째 코인 (예: 김프 없는 APR, ETH 등) 티커를 입력하세요:", "APR") || "APR";
  }

  coinA = coinA.toUpperCase();
  coinB = coinB.toUpperCase();

  console.log(`%c⚡ ${coinA} vs ${coinB} 성능 대조 프로파일러 가동 ⚡`, "color: #0ecb81; font-size: 14px; font-weight: bold;");
  console.log("차트 이동 및 연산 후 콘솔에 `showReport()`를 입력하면 누적 비교표가 출력됩니다.");

  const store = window.store;
  if (!store) {
    console.error("❌ window.store 객체를 찾을 수 없습니다.");
    return;
  }

  // 코인별 성능 저장소
  const dataStore = {
    A: { ticker: coinA, name: `${coinA} (대상 A)`, crosshair: { count: 0, totalMs: 0, maxMs: 0 }, calc: { count: 0, totalMs: 0, maxMs: 0 }, layout: { count: 0, totalMs: 0, maxMs: 0 } },
    B: { ticker: coinB, name: `${coinB} (대상 B)`, crosshair: { count: 0, totalMs: 0, maxMs: 0 }, calc: { count: 0, totalMs: 0, maxMs: 0 }, layout: { count: 0, totalMs: 0, maxMs: 0 } }
  };

  function getActiveGroup() {
    const symbol = (store.currentAsset || store.currentSelectedSymbol || "").toUpperCase();
    if (symbol.includes(coinA)) return dataStore.A;
    if (symbol.includes(coinB)) return dataStore.B;
    return null;
  }

  // 1. 십자선 동기화 랩핑
  const charts = [store.chart, store.chartVol].filter(Boolean);
  charts.forEach((c) => {
    if (!c._subscribeCrosshairMoveOriginal) {
      c._subscribeCrosshairMoveOriginal = c.subscribeCrosshairMove;
      c.subscribeCrosshairMove = function (callback) {
        const wrappedCallback = function (param) {
          const t0 = performance.now();
          callback(param);
          const t1 = performance.now() - t0;

          const group = getActiveGroup();
          if (group) {
            group.crosshair.count++;
            group.crosshair.totalMs += t1;
            if (t1 > group.crosshair.maxMs) group.crosshair.maxMs = t1;
          }
        };
        return c._subscribeCrosshairMoveOriginal(wrappedCallback);
      };
    }
  });

  // 2. 김프 연산 랩핑
  if (window.calculateKimchiData && !window.calculateKimchiData._isWrapped) {
    const originalCalc = window.calculateKimchiData;
    window.calculateKimchiData = function (...args) {
      const t0 = performance.now();
      const res = originalCalc(...args);
      const t1 = performance.now() - t0;

      const group = getActiveGroup();
      if (group) {
        group.calc.count++;
        group.calc.totalMs += t1;
        if (t1 > group.calc.maxMs) group.calc.maxMs = t1;
      }
      return res;
    };
    window.calculateKimchiData._isWrapped = true;
  }

  // 3. 레이아웃 리플로우 랩핑
  if (window.syncPriceScaleWidths && !window.syncPriceScaleWidths._isWrapped) {
    const originalSync = window.syncPriceScaleWidths;
    window.syncPriceScaleWidths = function (...args) {
      const t0 = performance.now();
      const res = originalSync(...args);
      const t1 = performance.now() - t0;

      const group = getActiveGroup();
      if (group) {
        group.layout.count++;
        group.layout.totalMs += t1;
        if (t1 > group.layout.maxMs) group.layout.maxMs = t1;
      }
      return res;
    };
    window.syncPriceScaleWidths._isWrapped = true;
  }

  // 결과 출력 함수
  window.showReport = function () {
    console.log(`%c📊 [${coinA} vs ${coinB} 연산량 비교 테이블] 📊`, "color: #ffd700; font-size: 13px; font-weight: bold;");

    const aCh = dataStore.A.crosshair.count ? (dataStore.A.crosshair.totalMs / dataStore.A.crosshair.count).toFixed(3) : "0.000";
    const bCh = dataStore.B.crosshair.count ? (dataStore.B.crosshair.totalMs / dataStore.B.crosshair.count).toFixed(3) : "0.000";

    const aCalc = dataStore.A.calc.count ? (dataStore.A.calc.totalMs / dataStore.A.calc.count).toFixed(3) : "0.000";
    const bCalc = dataStore.B.calc.count ? (dataStore.B.calc.totalMs / dataStore.B.calc.count).toFixed(3) : "0.000";

    const aLay = dataStore.A.layout.count ? (dataStore.A.layout.totalMs / dataStore.A.layout.count).toFixed(3) : "0.000";
    const bLay = dataStore.B.layout.count ? (dataStore.B.layout.totalMs / dataStore.B.layout.count).toFixed(3) : "0.000";

    console.table([
      {
        "측정 연산 카테고리": "1. 십자선 마우스 동기화 (평균 ms)",
        [coinA]: aCh + " ms",
        [coinB]: bCh + " ms",
        "연산량 증가 배율": bCh > 0 ? (aCh / bCh).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "1. 십자선 마우스 동기화 (최대 지연)",
        [coinA]: dataStore.A.crosshair.maxMs.toFixed(3) + " ms",
        [coinB]: dataStore.B.crosshair.maxMs.toFixed(3) + " ms",
        "연산량 증가 배율": dataStore.B.crosshair.maxMs > 0 ? (dataStore.A.crosshair.maxMs / dataStore.B.crosshair.maxMs).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "2. 김프 순수 연산 (평균 ms)",
        [coinA]: aCalc + " ms",
        [coinB]: bCalc + " ms",
        "연산량 증가 배율": bCalc > 0 ? (aCalc / bCalc).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "3. 차트 레이아웃 조정 (평균 ms)",
        [coinA]: aLay + " ms",
        [coinB]: bLay + " ms",
        "연산량 증가 배율": bLay > 0 ? (aLay / bLay).toFixed(1) + " 배" : "N/A"
      }
    ]);
  };

  // 코인 변경 이벤트 가로채기 (선택 시 자동 보고서 갱신 출력)
  const originalSelectSymbol = window.selectSymbol;
  if (originalSelectSymbol && !originalSelectSymbol._isWrapped) {
    window.selectSymbol = function (...args) {
      window.showReport();
      return originalSelectSymbol(...args);
    };
    window.selectSymbol._isWrapped = true;
  }

  // 정기 로그 타이머 제거
  if (window._kimchiPerfInterval) {
    clearInterval(window._kimchiPerfInterval);
    window._kimchiPerfInterval = null;
  }
})();
