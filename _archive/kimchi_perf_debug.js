/**
 * ⚡ Sellnance F12 Console Performance Profiler (SXT vs APR 일대일 대조용) ⚡
 * 
 * [사용 방법]
 * 1. F12 개발자 도구 Console 탭에 복사+붙여넣기하여 실행하십시오.
 * 2. SXT 코인(김프 있음)과 APR 코인(김프 없음)을 각각 조회하고 마우스 크로스헤어를 몇 번 움직여 데이터를 누적시킵니다.
 * 3. 콘솔창에 `showReport()`를 치거나 코인을 바꿀 때마다 SXT와 APR의 실시간 연산량 비교 테이블이 즉시 출력됩니다.
 */

(function () {
  console.clear();
  console.log("%c⚡ SXT (김프 O) vs APR (김프 X) 성능 대조 프로파일러 가동 ⚡", "color: #0ecb81; font-size: 14px; font-weight: bold;");
  console.log("차트 이동 및 연산 후 콘솔에 `showReport()`를 입력하면 누적 비교표가 출력됩니다.");

  const store = window.store;
  if (!store) {
    console.error("❌ window.store 객체를 찾을 수 없습니다.");
    return;
  }

  // 코인별 성능 저장소
  const dataStore = {
    SXT: { name: "SXT (김프 있음)", crosshair: { count: 0, totalMs: 0, maxMs: 0 }, calc: { count: 0, totalMs: 0, maxMs: 0 }, layout: { count: 0, totalMs: 0, maxMs: 0 } },
    APR: { name: "APR (김프 없음)", crosshair: { count: 0, totalMs: 0, maxMs: 0 }, calc: { count: 0, totalMs: 0, maxMs: 0 }, layout: { count: 0, totalMs: 0, maxMs: 0 } }
  };

  function getActiveGroup() {
    const symbol = (store.currentAsset || store.currentSelectedSymbol || "").toUpperCase();
    if (symbol.includes("SXT")) return dataStore.SXT;
    if (symbol.includes("APR")) return dataStore.APR;
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
    console.log("%c📊 [SXT vs APR 연산량 비교 테이블] 📊", "color: #ffd700; font-size: 13px; font-weight: bold;");
    
    const sxtCh = dataStore.SXT.crosshair.count ? (dataStore.SXT.crosshair.totalMs / dataStore.SXT.crosshair.count).toFixed(3) : "0.000";
    const aprCh = dataStore.APR.crosshair.count ? (dataStore.APR.crosshair.totalMs / dataStore.APR.crosshair.count).toFixed(3) : "0.000";

    const sxtCalc = dataStore.SXT.calc.count ? (dataStore.SXT.calc.totalMs / dataStore.SXT.calc.count).toFixed(3) : "0.000";
    const aprCalc = dataStore.APR.calc.count ? (dataStore.APR.calc.totalMs / dataStore.APR.calc.count).toFixed(3) : "0.000";

    const sxtLay = dataStore.SXT.layout.count ? (dataStore.SXT.layout.totalMs / dataStore.SXT.layout.count).toFixed(3) : "0.000";
    const aprLay = dataStore.APR.layout.count ? (dataStore.APR.layout.totalMs / dataStore.APR.layout.count).toFixed(3) : "0.000";

    console.table([
      {
        "측정 연산 카테고리": "1. 십자선 마우스 동기화 (평균 ms)",
        "SXT (김프 O)": sxtCh + " ms",
        "APR (김프 X)": aprCh + " ms",
        "연산량 증가 배율": aprCh > 0 ? (sxtCh / aprCh).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "1. 십자선 마우스 동기화 (최대 지연)",
        "SXT (김프 O)": dataStore.SXT.crosshair.maxMs.toFixed(3) + " ms",
        "APR (김프 X)": dataStore.APR.crosshair.maxMs.toFixed(3) + " ms",
        "연산량 증가 배율": dataStore.APR.crosshair.maxMs > 0 ? (dataStore.SXT.crosshair.maxMs / dataStore.APR.crosshair.maxMs).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "2. 김프 순수 연산 (평균 ms)",
        "SXT (김프 O)": sxtCalc + " ms",
        "APR (김프 X)": aprCalc + " ms",
        "연산량 증가 배율": aprCalc > 0 ? (sxtCalc / aprCalc).toFixed(1) + " 배" : "N/A"
      },
      {
        "측정 연산 카테고리": "3. 차트 레이아웃 조정 (평균 ms)",
        "SXT (김프 O)": sxtLay + " ms",
        "APR (김프 X)": aprLay + " ms",
        "연산량 증가 배율": aprLay > 0 ? (sxtLay / aprLay).toFixed(1) + " 배" : "N/A"
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
