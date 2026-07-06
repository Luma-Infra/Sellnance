(() => {
  // 🔍 Sellnance 전용 실시간 차트 정밀 감시 모니터
  const HISTORY_LIMIT = 20; // 각 시리즈별 최근 동작 기록 한도
  const seriesLogs = new Map(); // seriesName -> Array of logs
  const payloadHistories = new Map(); // seriesName -> Array of full dataArr (last 5 calls)
  let uncaughtErrors = [];
  let isMonitoring = true;

  // 1. 디버그 전용 플로팅 패널 DOM 생성
  let monitorPanel = document.getElementById("chart-debug-monitor-panel");
  if (!monitorPanel) {
    monitorPanel = document.createElement("div");
    monitorPanel.id = "chart-debug-monitor-panel";
    monitorPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 480px;
      max-height: 85vh;
      background: rgba(10, 14, 23, 0.95);
      border: 2px solid #ffbc00;
      border-radius: 12px;
      color: #e0e3eb;
      font-family: 'Consolas', 'Fira Code', monospace;
      font-size: 11px;
      padding: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.85);
      z-index: 1000000;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      user-select: text;
    `;
    document.body.appendChild(monitorPanel);

    // 드래그 앤 드롭 이동 기능 구현
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    monitorPanel.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target.closest("button") || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      isDragging = true;
      const rect = monitorPanel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      monitorPanel.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      monitorPanel.style.left = (e.clientX - offsetX) + "px";
      monitorPanel.style.top = (e.clientY - offsetY) + "px";
      monitorPanel.style.right = "auto"; // 우측 고정 풀기
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      monitorPanel.style.cursor = "default";
    });
  }

  // 2. 진단 메시지 저장 및 패널 렌더링 함수
  const logDiagnostic = (seriesName, type, message, payload) => {
    if (!seriesLogs.has(seriesName)) {
      seriesLogs.set(seriesName, []);
    }
    const list = seriesLogs.get(seriesName);
    list.push({
      time: new Date().toLocaleTimeString(),
      type,
      message,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null
    });
    if (list.length > HISTORY_LIMIT) {
      list.shift();
    }
    updateUI();
  };

  // 3. UI 보드 업데이트 함수
  const updateUI = () => {
    if (!monitorPanel) return;

    let errorHTML = "";
    if (uncaughtErrors.length > 0) {
      errorHTML = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 6px; padding: 8px; margin-bottom: 10px;">
          <div style="color: #ef4444; font-weight: bold; margin-bottom: 4px; font-size: 12px;">🚨 차트 크래시 감지 (Value is null)</div>
          ${uncaughtErrors.map((err, idx) => `
            <div style="border-bottom: 1px dashed rgba(239, 68, 68, 0.3); padding-bottom: 6px; margin-bottom: 6px;">
              <div style="color: #ff6b6b; font-weight: bold;">[${err.time}] Error: ${err.message}</div>
              <div style="color: #aaa; font-size: 10px; max-height: 80px; overflow-y: auto; white-space: pre-wrap; margin-top: 4px;">${err.stack}</div>
            </div>
          `).join("")}
        </div>
      `;
    }

    let seriesHTML = "";
    seriesLogs.forEach((logs, name) => {
      const lastLog = logs[logs.length - 1];
      const errCount = logs.filter(l => l.type === "ERROR" || l.type === "WARN").length;

      seriesHTML += `
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 6px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; color: #ffbc00; font-size: 11.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; margin-bottom: 6px;">
            <span>📈 ${name}</span>
            <span style="color: ${errCount > 0 ? '#ff6b6b' : '#10b981'};">오류/경고: ${errCount}건</span>
          </div>
          <div style="font-size: 10px; line-height: 1.4; color: #ccc;">
            <div>• 최근 동작: <span style="color: #57a4fc; font-weight: bold;">${lastLog ? lastLog.type : "없음"}</span> (${lastLog ? lastLog.time : "-"})</div>
            <div>• 상세 상태: <span style="color: #fff;">${lastLog ? lastLog.message : "대기 중"}</span></div>
            ${lastLog && lastLog.payload ? `
              <div style="margin-top: 4px; background: rgba(0,0,0,0.4); padding: 4px; border-radius: 4px; font-size: 9px; max-height: 90px; overflow-y: auto;">
                <strong>송신 페이로드 (샘플):</strong>
                <pre style="margin: 2px 0 0 0; color: #0ecb81; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(lastLog.payload, null, 2)}</pre>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    });

    let storeStateHTML = "";
    if (window.store) {
      storeStateHTML = `
        <div style="margin-top: 8px; font-size: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: #aaa;">
          <div>• 심볼: <span style="color: #fff;">${window.store.currentSelectedSymbol || "-"}</span></div>
          <div>• 마켓: <span style="color: #fff;">${window.store.currentChartMarket || "-"}</span></div>
          <div>• 호버 활성: <span style="color: #fff;">${window.store.isCrosshairActive || "false"}</span></div>
          <div>• 김프 활성: <span style="color: #fff;">${window.store.paneConfig?.kimchi || "false"}</span></div>
        </div>
      `;
    }

    monitorPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ffbc00; padding-bottom: 6px; margin-bottom: 8px;">
        <span style="font-weight: bold; color: #ffbc00; font-size: 12px;">🕵️‍♂️ Sellnance 차트 오염 정밀 추적기</span>
        <div style="display: flex; gap: 6px;">
          <button id="chart-debug-copy-btn" style="background: #0ecb81; border: none; color: #fff; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 9.5px; font-weight: bold;">📋 로그 복사</button>
          <button id="chart-debug-close-btn" style="background: #f43f5e; border: none; color: #fff; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 9.5px; font-weight: bold;">🛑 닫기</button>
        </div>
      </div>
      
      ${errorHTML}
      
      <div style="display: flex; flex-direction: column; gap: 4px; max-height: 480px; overflow-y: auto;">
        ${seriesHTML || "<div style='color: #888; text-align: center; padding: 10px;'>차트 시리즈가 아직 등록되지 않았습니다.</div>"}
      </div>

      ${storeStateHTML}
    `;

    // 복사하기 이벤트 바인딩
    document.getElementById("chart-debug-copy-btn").onclick = () => {
      const dumpData = {
        timestamp: new Date().toISOString(),
        storeState: window.store ? {
          currentSelectedSymbol: window.store.currentSelectedSymbol,
          currentChartMarket: window.store.currentChartMarket,
          isCrosshairActive: window.store.isCrosshairActive,
          paneConfig: window.store.paneConfig
        } : null,
        errors: uncaughtErrors,
        logs: {},
        payloadHistories: {}
      };
      seriesLogs.forEach((logs, name) => {
        dumpData.logs[name] = logs;
      });
      payloadHistories.forEach((pHist, name) => {
        dumpData.payloadHistories[name] = pHist;
      });

      navigator.clipboard.writeText(JSON.stringify(dumpData, null, 2)).then(() => {
        const btn = document.getElementById("chart-debug-copy-btn");
        btn.innerText = "✓ 복사 완료";
        setTimeout(() => { btn.innerText = "📋 로그 복사"; }, 1500);
      });
    };

    // 닫기 이벤트 바인딩
    document.getElementById("chart-debug-close-btn").onclick = () => {
      isMonitoring = false;
      if (monitorPanel) {
        monitorPanel.remove();
        monitorPanel = null;
      }
    };
  };

  // 4. 전역 에러 가로채기 (Value is null 감지)
  window.addEventListener("error", (event) => {
    if (!isMonitoring) return;
    const err = event.error;
    if (err && (err.message?.includes("Value is null") || err.stack?.includes("lightweight-charts"))) {
      
      // 콘솔창에 즉각적인 데이터 원본 덤프 수행
      console.group("🚨 [차트 크래시 정밀 덤프]");
      console.error("오류 메시지:", err.message);
      console.error("에러 스택:", err.stack);
      console.log("최근 5회 주입 페이로드 히스토리 (콘솔에서 직접 배열을 확인해 분석할 수 있습니다):");
      payloadHistories.forEach((pHist, name) => {
        console.log(`%c[${name}]`, "color: #ffbc00; font-weight: bold; background: #222; padding: 2px;", pHist);
      });
      console.groupEnd();

      const dumpHistories = {};
      payloadHistories.forEach((pHist, name) => {
        dumpHistories[name] = pHist;
      });

      uncaughtErrors.push({
        time: new Date().toLocaleTimeString(),
        message: err.message,
        stack: err.stack || "",
        payloadHistories: dumpHistories
      });
      updateUI();
    }
  });

  // 5. 차트 시리즈 래핑 헬퍼 함수
  const wrapSeriesInstance = (series, seriesName, type) => {
    if (!series || series.__monitored) return series;
    series.__monitored = true;

    const originalSetData = series.setData.bind(series);
    const originalUpdate = series.update.bind(series);

    series.setData = function (dataArr) {
      if (!isMonitoring) return originalSetData.apply(this, arguments);

      // 전체 데이터 주입 캐시에 저장 (최근 5회분)
      if (!payloadHistories.has(seriesName)) {
        payloadHistories.set(seriesName, []);
      }
      const pHist = payloadHistories.get(seriesName);
      pHist.push({
        time: new Date().toLocaleTimeString(),
        dataLength: dataArr ? dataArr.length : 0,
        data: dataArr ? JSON.parse(JSON.stringify(dataArr)) : null
      });
      if (pHist.length > 5) pHist.shift();

      // 데이터 오염 및 유실 정밀 체크 (시리즈 타입별 분기 처리로 오탐 박멸)
      let nullCount = 0;
      let undefinedCount = 0;
      let nanCount = 0;
      let sample = null;

      if (Array.isArray(dataArr)) {
        if (dataArr.length > 0) {
          sample = dataArr.slice(-3); // 마지막 3개 샘플링
        }
        for (let i = 0; i < dataArr.length; i++) {
          const item = dataArr[i];
          if (!item) {
            nullCount++;
            continue;
          }
          
          if (type === "value") {
            // Histogram / Line 검사
            if (item.value === null) nullCount++;
            if (item.value === undefined) undefinedCount++;
            if (typeof item.value === "number" && isNaN(item.value)) nanCount++;
          } else if (type === "candle") {
            // Candle 검사
            if (item.open === null || item.high === null || item.low === null || item.close === null) nullCount++;
            if (item.open === undefined || item.high === undefined || item.low === undefined || item.close === undefined) undefinedCount++;
            if (isNaN(Number(item.open)) || isNaN(Number(item.high)) || isNaN(Number(item.low)) || isNaN(Number(item.close))) nanCount++;
          }
        }
      }

      if (nullCount > 0 || undefinedCount > 0 || nanCount > 0) {
        logDiagnostic(
          seriesName,
          "WARN",
          `setData 주입 감지! 크기: ${dataArr ? dataArr.length : 0} | 🚨 결측치 감지: null(${nullCount}), undefined(${undefinedCount}), NaN(${nanCount})`,
          sample
        );
      } else {
        logDiagnostic(
          seriesName,
          "setData",
          `정상 데이터 설정 완료. 크기: ${dataArr ? dataArr.length : 0}`,
          sample
        );
      }

      try {
        return originalSetData.apply(this, arguments);
      } catch (err) {
        logDiagnostic(seriesName, "ERROR", `setData 크래시: ${err.message}`, dataArr ? dataArr.slice(-3) : null);
        throw err;
      }
    };

    series.update = function (bar) {
      if (!isMonitoring) return originalUpdate.apply(this, arguments);

      let isInvalid = false;
      if (!bar) {
        isInvalid = true;
      } else {
        if (type === "value") {
          // Histogram / Line 검사
          if (bar.value === null || bar.value === undefined || isNaN(Number(bar.value))) isInvalid = true;
        } else if (type === "candle") {
          // Candle 검사
          if (bar.open === null || bar.open === undefined || isNaN(Number(bar.open))) isInvalid = true;
          if (bar.close === null || bar.close === undefined || isNaN(Number(bar.close))) isInvalid = true;
        }
      }

      if (isInvalid) {
        logDiagnostic(
          seriesName,
          "WARN",
          `update에 부적절한 바 유입! 데이터: ${JSON.stringify(bar)}`,
          bar
        );
      } else {
        logDiagnostic(
          seriesName,
          "update",
          `실시간 바 업데이트 성공: Time(${bar ? bar.time : "-"}), Value/Close(${bar ? (bar.value !== undefined ? bar.value : bar.close) : "-"})`,
          bar
        );
      }

      try {
        return originalUpdate.apply(this, arguments);
      } catch (err) {
        logDiagnostic(seriesName, "ERROR", `update 크래시: ${err.message}`, bar);
        throw err;
      }
    };

    return series;
  };

  // 6. 현재 생성되어 있는 스토어 내 시리즈 자동 래핑 및 LightweightCharts.createChart 후속 래핑 바인딩
  const initializeHook = () => {
    // 6-1. 기존 생성된 시리즈 래핑
    if (window.store) {
      if (window.store.candleSeries) wrapSeriesInstance(window.store.candleSeries, "CandleSeries (가격)", "candle");
      if (window.store.leftScaleSeries) wrapSeriesInstance(window.store.leftScaleSeries, "LeftScaleSeries (등락률)", "value");
      if (window.store.volumeSeries) wrapSeriesInstance(window.store.volumeSeries, "VolumeSeries (거래량)", "value");
      if (window.store.kimchiSeries) wrapSeriesInstance(window.store.kimchiSeries, "KimchiSeries (김프)", "value");
    }

    // 6-2. LightweightCharts.createChart 후킹하여 동적으로 새로 생기는 시리즈 래핑 지원
    if (window.LightweightCharts && !window.LightweightCharts.__debug_hooked) {
      window.LightweightCharts.__debug_hooked = true;
      const originalCreateChart = window.LightweightCharts.createChart;

      window.LightweightCharts.createChart = function (container, options) {
        const chart = originalCreateChart(container, options);

        const originalAddAreaSeries = chart.addAreaSeries;
        const originalAddBarSeries = chart.addBarSeries;
        const originalAddCandlestickSeries = chart.addCandlestickSeries;
        const originalAddHistogramSeries = chart.addHistogramSeries;
        const originalAddLineSeries = chart.addLineSeries;

        chart.addAreaSeries = function () {
          const s = originalAddAreaSeries.apply(this, arguments);
          return wrapSeriesInstance(s, "AreaSeries (동적)", "value");
        };
        chart.addBarSeries = function () {
          const s = originalAddBarSeries.apply(this, arguments);
          return wrapSeriesInstance(s, "BarSeries (동적)", "candle");
        };
        chart.addCandlestickSeries = function () {
          const s = originalAddCandlestickSeries.apply(this, arguments);
          return wrapSeriesInstance(s, "CandlestickSeries (동적)", "candle");
        };
        chart.addHistogramSeries = function () {
          const s = originalAddHistogramSeries.apply(this, arguments);
          return wrapSeriesInstance(s, "HistogramSeries (동적)", "value");
        };
        chart.addLineSeries = function () {
          const s = originalAddLineSeries.apply(this, arguments);
          return wrapSeriesInstance(s, "LineSeries (동적)", "value");
        };

        return chart;
      };
    }

    updateUI();
  };

  // 7. 폴링을 통해 주기적으로 새로운 시리즈가 주입되는지 감시하여 자동 결합
  const syncStoreInterval = setInterval(() => {
    if (!isMonitoring) {
      clearInterval(syncStoreInterval);
      return;
    }
    initializeHook();
  }, 1000);

  // 최초 1회 점화
  initializeHook();
  console.log("🕵️‍♂️ [차트 정밀 추적기 점화] static/chart_debug_monitor.js 로드 완료.");
})();
