// stream_korea.js
import { store, tfSec } from "./_store.js";
import { getMultiplier, getPureBase, getUnixSeconds } from "./chart_utils.js";

// 🚀 거래소별 실시간 버퍼 가격 및 기상 상황 추출기 (침범 방지 락킹)
function getPriceForExchange(exchange, row, pureSymbol) {
  if (!exchange) return null;
  const exUpper = exchange.toUpperCase();
  if (exUpper === "UPBIT") {
    const sym = row?.Upbit_Symbol || pureSymbol;
    const price = store.tickerBuffer[`KRW-${sym}`]?.c || row?.Upbit_Price || row?.Price_KRW;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  if (exUpper === "BITHUMB") {
    const sym = row?.Bithumb_Symbol || pureSymbol;
    const price = store.tickerBuffer[`${sym}_KRW`]?.c || row?.Bithumb_Price || row?.Price_KRW;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  if (exUpper === "BINANCE_SPOT" || exUpper === "SPOT") {
    const sym = row?.Exact_Spot || pureSymbol;
    const price = store.tickerBuffer[`${sym}USDT`]?.c || row?.Binance_Price_Spot || row?.Binance_Price;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  if (exUpper === "BINANCE_FUTURES" || exUpper === "FUTURES") {
    const sym = row?.Exact_Futures || pureSymbol;
    const price = store.tickerBuffer[`${sym}USDT_FUTURES`]?.c || row?.Binance_Price_Futures || row?.Binance_Price;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  if (exUpper === "BYBIT_SPOT" || exUpper === "BYBIT") {
    const sym = row?.Bybit_Symbol || pureSymbol;
    const price = store.tickerBuffer[`${sym}USDT`]?.c || row?.Bybit_Price_Spot || row?.Bybit_Price;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  if (exUpper === "BYBIT_FUTURES") {
    const sym = row?.Bybit_Symbol || pureSymbol;
    const price = store.tickerBuffer[`${sym}USDT_FUTURES`]?.c || row?.Bybit_Price_Futures || row?.Bybit_Price;
    return price ? parseFloat(price) / getMultiplier(sym) : null;
  }
  return null;
}

// 🚀 실시간 김프 1초컷 업데이트 엔진 (모든 마켓 공통 적용)
export function updateRealtimeKimchi(liveData, symbol, chartTime) {
  if (store.blockKimchi) return;
  if (!store.kimchiSeries || !store.paneConfig.kimchi) return;

  // 🚀 [김프 침범 방지 - 리버스 락킹]
  // 김프는 현재 활성 탭과 반대되는(국내 ↔ 해외) 실시간 스트림 물줄기를 추적하여 연산해야 합니다.
  const isCurrentTabKorea = ["UPBIT", "BITHUMB"].includes(store.currentChartMarket);
  const isStreamKorea = liveData.marketType
    ? ["UPBIT", "BITHUMB"].includes(liveData.marketType)
    : (symbol.startsWith("KRW-") || symbol.endsWith("KRW") || symbol.includes("_KRW"));
  if (isCurrentTabKorea === isStreamKorea) {
    return;
  }

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  if (rate === 0) return;

  const pureSymbol = getPureBase(symbol);
  const row = store.currentTableData.find((c) => c.Symbol === pureSymbol);

  let unitKorPrice = null;
  let unitGlbPrice = null;

  // 🚀 [분리 락킹] 활성 탭에 매칭되는 국내/해외 파트너 거래소를 store.preferredKimchiSub로 강제 바인딩하여 타 거래소 침범 차단!
  let korExchange = isCurrentTabKorea ? store.currentChartMarket : store.preferredKimchiSub;
  let glbExchange = !isCurrentTabKorea ? store.currentChartMarket : store.preferredKimchiSub;

  if (!korExchange) {
    korExchange = row?.Upbit === "O" ? "upbit" : "bithumb";
  }
  if (!glbExchange) {
    glbExchange = row?.Listed_Exchanges?.some(ex => ex.includes("BINANCE")) ? "binance_spot" : "bybit_spot";
  }

  if (isStreamKorea) {
    const mainMulti = getMultiplier(symbol);
    unitKorPrice = liveData.close / mainMulti;
    unitGlbPrice = getPriceForExchange(glbExchange, row, pureSymbol);
  } else {
    const mainMulti = getMultiplier(symbol);
    unitGlbPrice = liveData.close / mainMulti;
    unitKorPrice = getPriceForExchange(korExchange, row, pureSymbol);
  }

  if (!unitKorPrice || !unitGlbPrice || liveData.close <= 0) {
    return;
  }

  const isTimeValid = (() => {
    if (chartTime === undefined || chartTime === null) return false;
    if (typeof chartTime === "number") {
      return !isNaN(chartTime) && chartTime > 0;
    }
    if (typeof chartTime === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(chartTime)) return true;
      const num = Number(chartTime);
      if (!isNaN(num) && num > 0) return true;
      const parsed = Date.parse(
        chartTime.includes("T") ? chartTime : chartTime + "T00:00:00Z",
      );
      return !isNaN(parsed);
    }
    return false;
  })();

  if (isTimeValid) {
    const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;

    if (isFinite(kimchiPct) && kimchiPct >= -50 && kimchiPct <= 100) {
      const kimchiObj = {
        time: chartTime,
        value: kimchiPct,
        color:
          typeof window.getKimchiColor === "function"
            ? window.getKimchiColor(kimchiPct)
            : "#57a4fc",
      };
      try {
        const lastKimchiItem = store.kimchiData && store.kimchiData.length > 0
          ? store.kimchiData[store.kimchiData.length - 1]
          : null;

        if (!lastKimchiItem || chartTime >= lastKimchiItem.time) {
          store.kimchiSeries.update(kimchiObj);

          // 🚀 김프 범례 텍스트 직접 실시간 갱신 (리버스 갱신 대응)
          const kimchiEl = document.getElementById("ohlc-kimchi");
          if (kimchiEl && !store.isCrosshairActive) {
            kimchiEl.innerText = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
            kimchiEl.style.color = typeof window.getKimchiColor === "function" ? window.getKimchiColor(kimchiPct) : "#57a4fc";
          }

          // 🚀 김프 전용 미니 뱃지 실시간 갱신 (상단 메인 뱃지와 완전히 별개로 독립 트래킹)
          const kimchiCallerEl = document.getElementById("ohlc-kimchi-caller");
          let callerId = "UNKNOWN";
          if (store.traceRowCaller) {
            const stack = new Error().stack || "";
            if (stack.includes("stream") || stack.includes("updateStatus")) {
              callerId = "1 (Stream)";
            } else if (stack.includes("chart_utils.js") || stack.includes("chart.js") || stack.includes("chart_data.js")) {
              callerId = "2 (Chart)";
            } else {
              callerId = "3 (UI/Filter)";
            }
          }
          if (kimchiCallerEl && !store.isCrosshairActive) {
            const korLabel = korExchange.toUpperCase();
            const glbLabel = glbExchange.toUpperCase();
            const debugText = ` [${callerId}] ${korLabel}(${(unitKorPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}) / [${glbLabel}(${(unitGlbPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}) * 환율(${rate})]`;
            kimchiCallerEl.innerText = debugText;
          }

          // 🚀 [디버그 동적 전파] 무조건 첫번째 행(index 0)에 있는 디버그 영역에도 함께 기록해줍니다.
          const firstRowDebug = document.querySelector('#coin-list-body > div[data-index="0"] .first-row-debug-area');
          if (firstRowDebug) {
            const kimchiDebug = firstRowDebug.querySelector(".debug-kimchi-caller");
            if (kimchiDebug) kimchiDebug.innerText = `KIMP: ${callerId}`;
          }

          if (store.kimchiData && store.kimchiData.length > 0) {
            if (chartTime > lastKimchiItem.time) {
              store.kimchiData.push(kimchiObj);
            } else if (chartTime === lastKimchiItem.time) {
              store.kimchiData[store.kimchiData.length - 1] = kimchiObj;
            }
          }
        }
      } catch (e) {
        console.warn("🚨 kimchiSeries.update 예외 발생, vol-pane 자동 복구 시도:", e);
        if (store.kimchiSeries && store.kimchiData && store.kimchiData.length > 0) {
          // 김프 데이터 내부의 value가 null이 되지 않도록 0층 방어벽 가동
          const sterileKimchiData = store.kimchiData.map(item => ({
            ...item,
            value: (item.value === null || item.value === undefined || isNaN(item.value)) ? 0 : Number(item.value)
          }));

          store.kimchiSeries.setData(
            sanitizeChartData(sterileKimchiData, true),
          );
        }
      }
    }
  }

  if (typeof window.syncPriceScaleWidths === "function") {
    window.syncPriceScaleWidths();
  }
}

// 🚀 업비트 실시간 웹소켓 핸들러 팩토리
export function getUpbitMessageHandler(symbol, broadcastCandleUpdate) {
  return async (e) => {
    if (e.target !== store.upbitChartWs) return;
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;

    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;
    if (store.currentChartMarket !== "UPBIT") {
      // 🚀 현재 탭이 업비트가 아닌 경우(예: 바이낸스/바이비트),
      // 메인 차트 데이터(store.mainData)를 오염시키지 않고 오직 김프 계산을 위한 실시간 시세 버퍼 업데이트 및 김프 갱신만 수행합니다.
      const text = typeof e.data === "string" ? e.data : await e.data.text();
      const res = JSON.parse(text);
      if (!res.code) return;

      const tickSymbol = res.code.toUpperCase();
      const expectedCode = `KRW-${symbol}`.toUpperCase();
      const expectedGlobalCode = `KRW-${(store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "").replace("KRW", "")}`.toUpperCase();
      if (tickSymbol !== expectedCode || tickSymbol !== expectedGlobalCode) return;

      const newPrice = parseFloat(res.trade_price);
      if (isNaN(newPrice)) return;

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[tickSymbol] = { c: newPrice };

      if (store.mainData && store.mainData.length > 0) {
        const lastCandle = store.mainData[store.mainData.length - 1];
        updateRealtimeKimchi({ close: newPrice, marketType: "UPBIT" }, symbol, lastCandle.time);
      }
      return;
    }

    const text = typeof e.data === "string" ? e.data : await e.data.text();
    const res = JSON.parse(text);
    if (!res.code) return;

    const tickSymbol = res.code.toUpperCase();
    const expectedCode = `KRW-${symbol}`.toUpperCase();

    const expectedGlobalCode =
      `KRW-${(store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "")}`.toUpperCase();
    if (tickSymbol !== expectedCode || tickSymbol !== expectedGlobalCode)
      return;

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    const newPrice = parseFloat(res.trade_price);
    const tradeQty = parseFloat(res.trade_volume) || 0;
    if (isNaN(newPrice)) return;

    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleUnix = getUnixSeconds(lastCandle.time);
    const nextBarTime = lastCandleUnix + secondsPerBar;
    const currentUnix = Math.floor(res.timestamp / 1000);

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    if (currentUnix < nextBarTime) {
      lastCandle.close = newPrice;
      lastCandle.high = Math.max(lastCandle.high, newPrice);
      lastCandle.low = Math.min(lastCandle.low, newPrice);
      lastCandle.volume = (lastCandle.volume || 0) + tradeQty;
      activeCandle = lastCandle;
      chartUpdateNeeded = true;
    } else {
      activeCandle = {
        time: currentUnix,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
        volume: tradeQty,
      };
      store.mainData.push(activeCandle);
      chartUpdateNeeded = true;
    }

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;

      const currentExpected =
        `KRW-${(store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "")}`.toUpperCase();
      if (expectedCode === currentExpected) {
        broadcastCandleUpdate(activeCandle, symbol, res.timestamp, "UPBIT");
      }
    }
  };
}

// 🚀 빗썸 실시간 웹소켓 핸들러 팩토리
export function getBithumbMessageHandler(symbol, broadcastCandleUpdate) {
  return (e) => {
    if (e.target !== store.bithumbChartWs) return;
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;
    if (store.currentChartMarket !== "BITHUMB") {
      // 🚀 현재 탭이 빗썸이 아닌 경우(예: 바이낸스/바이비트),
      // 메인 차트 데이터(store.mainData)를 오염시키지 않고 오직 김프 계산을 위한 실시간 시세 버퍼 업데이트 및 김프 갱신만 수행합니다.
      const res = JSON.parse(e.data);
      if (res.type !== "transaction" || !res.content?.list) return;
      if (res.content.list.length === 0) return;

      const lastTrade = res.content.list[res.content.list.length - 1];
      const newPrice = parseFloat(lastTrade.contPrice);
      if (isNaN(newPrice)) return;

      const tickSymbol = `${symbol}_KRW`.toUpperCase();
      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[tickSymbol] = { c: newPrice };

      if (store.mainData && store.mainData.length > 0) {
        const lastCandle = store.mainData[store.mainData.length - 1];
        updateRealtimeKimchi({ close: newPrice, marketType: "BITHUMB" }, symbol, lastCandle.time);
      }
      return;
    }

    const res = JSON.parse(e.data);
    if (res.type !== "transaction" || !res.content?.list) return;

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleUnix = getUnixSeconds(lastCandle.time);
    const nextBarTime = lastCandleUnix + secondsPerBar;

    res.content.list.forEach((trade) => {
      const newPrice = parseFloat(trade.contPrice);
      const tradeQty = parseFloat(trade.contQty) || 0;
      if (isNaN(newPrice)) return;

      const dtStr = trade.contDtm.replace(" ", "T") + "+09:00";
      let currentUnix = Math.floor(new Date(dtStr).getTime() / 1000);
      if (isNaN(currentUnix)) currentUnix = Math.floor(Date.now() / 1000);

      if (currentUnix < nextBarTime) {
        lastCandle.close = newPrice;
        lastCandle.high = Math.max(lastCandle.high, newPrice);
        lastCandle.low = Math.min(lastCandle.low, newPrice);
        lastCandle.volume = (lastCandle.volume || 0) + tradeQty;
        activeCandle = lastCandle;
        chartUpdateNeeded = true;
      } else {
        activeCandle = {
          time: currentUnix,
          open: newPrice,
          high: newPrice,
          low: newPrice,
          close: newPrice,
          volume: tradeQty,
        };
        store.mainData.push(activeCandle);
        chartUpdateNeeded = true;
      }
    });

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;
      broadcastCandleUpdate(activeCandle, symbol, Date.now(), "BITHUMB");
    }
  };
}
