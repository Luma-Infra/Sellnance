// stream_korea.js
import { store, tfSec } from "./_store.js";
import { getMultiplier, getPureBase, getUnixSeconds } from "./chart_utils.js";

// 🚀 실시간 김프 1초컷 업데이트 엔진 (모든 마켓 공통 적용)
export function updateRealtimeKimchi(liveData, symbol, chartTime) {
  if (!store.kimchiSeries || !store.paneConfig.kimchi) return;

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  if (rate === 0) return;

  const pureSymbol = getPureBase(symbol);
  const isKor = ["UPBIT", "BITHUMB"].includes(store.currentMarket);
  const row = store.currentTableData.find((c) => c.Symbol === pureSymbol);

  let unitKorPrice = null;
  let unitGlbPrice = null;

  if (isKor) {
    const mainMulti = getMultiplier(symbol);
    unitKorPrice = liveData.close / mainMulti;

    let futSym = row && row.Exact_Futures ? row.Exact_Futures : pureSymbol;
    let spotSym = row && row.Exact_Spot ? row.Exact_Spot : pureSymbol;
    let glbPrice = null;

    const hasBinance = row?.Listed_Exchanges?.some((ex) =>
      ex.includes("BINANCE"),
    );
    if (hasBinance) {
      glbPrice =
        store.tickerBuffer[`${futSym}USDT_FUTURES`]?.c ||
        store.tickerBuffer[`${spotSym}USDT`]?.c;
    }

    if (!glbPrice && row && row.Price_Raw) {
      glbPrice = row.Price_Raw;
    } else if (glbPrice) {
      glbPrice = parseFloat(glbPrice) / getMultiplier(pureSymbol);
    }
    unitGlbPrice = glbPrice;
  } else {
    const mainMulti = getMultiplier(symbol);
    unitGlbPrice = liveData.close / mainMulti;

    let korSym = row && row.Upbit_Symbol ? row.Upbit_Symbol : pureSymbol;
    let korPrice = store.tickerBuffer[`KRW-${korSym}`]?.c;
    if (!korPrice) korPrice = store.tickerBuffer[`${pureSymbol}_KRW`]?.c;
    if (!korPrice && row && row.Price_KRW) {
      korPrice = row.Price_KRW;
    } else if (korPrice) {
      korPrice = parseFloat(korPrice) / getMultiplier(korSym);
    }
    unitKorPrice = korPrice;
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
          try {
            store.kimchiSeries.setData([]);
            store.kimchiSeries.setData(store.kimchiData);
          } catch (rebindErr) {}
        }
      }
    }
  }
}

// 🚀 업비트 실시간 웹소켓 핸들러 팩토리
export function getUpbitMessageHandler(symbol, broadcastCandleUpdate) {
  return async (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;

    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
    if (store.currentMarket !== "UPBIT") return;

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
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;

      const currentExpected =
        `KRW-${(store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "")}`.toUpperCase();
      if (expectedCode === currentExpected) {
        broadcastCandleUpdate(activeCandle, symbol, res.timestamp);
      }
    }
  };
}

// 🚀 빗썸 실시간 웹소켓 핸들러 팩토리
export function getBithumbMessageHandler(symbol, broadcastCandleUpdate) {
  return (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
    if (store.currentMarket !== "BITHUMB") return;

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
      const newPrice = parseFloat(trade.contractPrice);
      const tradeQty = parseFloat(trade.contractVolume) || 0;
      if (isNaN(newPrice)) return;

      const dtStr = trade.contractTime.replace(" ", "T");
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
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
      broadcastCandleUpdate(activeCandle, symbol, Date.now());
    }
  };
}
