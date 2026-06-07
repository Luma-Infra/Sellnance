// stream_global.js
import { store, tfSec } from "./_store.js";
import { getUnixSeconds, updateTabTitleManager } from "./chart_utils.js";
import {
  getUpbitMessageHandler,
  getBithumbMessageHandler,
  updateRealtimeKimchi,
} from "./stream_korea.js";

export function startRealtimeCandle(
  symbol,
  interval,
  isFutures,
  isSpot,
  isUpbit,
  isBithumb,
) {
  const btnSim = document.getElementById("tab-btn-sim");
  if (btnSim && btnSim.classList.contains("active")) {
    return;
  }

  const isBybit =
    store.currentMarket === "BYBIT" || store.currentMarket === "BYBIT_FUTURES";
  const isBybitFutures = store.currentMarket === "BYBIT_FUTURES";

  if (!(isFutures || isSpot) && store.binanceChartWs) {
    try {
      store.binanceChartWs.close();
    } catch (e) { }
    store.binanceChartWs = null;
    store.currentKlineStream = null;
  }
  if (!isUpbit && store.upbitChartWs) {
    try {
      store.upbitChartWs.close();
    } catch (e) { }
    store.upbitChartWs = null;
    store.currentUpbitStream = null;
  }
  if (!isBithumb && store.bithumbChartWs) {
    try {
      store.bithumbChartWs.close();
    } catch (e) { }
    store.bithumbChartWs = null;
    store.currentBithumbStream = null;
  }
  if (!isBybit && store.bybitChartWs) {
    try {
      store.bybitChartWs.close();
    } catch (e) { }
    store.bybitChartWs = null;
    store.currentBybitStream = null;
  }

  const aggStream = `${symbol.toLowerCase()}usdt@aggTrade`;
  const klineStream = `${symbol.toLowerCase()}usdt@kline_${interval}`;
  const wsBase = isFutures
    ? "wss://fstream.binance.com/market/ws"
    : "wss://stream.binance.com:9443/ws";

  if (
    (isFutures || isSpot) &&
    store.currentKlineStream === `${aggStream}/${klineStream}` &&
    store.binanceChartWs &&
    store.binanceChartWs.readyState === WebSocket.OPEN &&
    store.binanceChartWs.url.includes(
      isFutures ? "fstream" : "stream.binance.com",
    )
  )
    return;

  const getWsId = () => Math.floor(Date.now() + Math.random() * 1000);

  let realtimeUpdatePending = false;
  let latestActiveCandle = null;
  let latestSymbol = null;
  let latestServerMs = null;

  const broadcastCandleUpdate = (activeCandle, symbol, serverMs) => {
    latestActiveCandle = activeCandle;
    latestSymbol = symbol;
    latestServerMs = serverMs;

    // 🚀 백그라운드(탭 비활성화) 상태에서도 타이틀이 끊임없이 갱신되도록 requestAnimationFrame 외부에서 즉시 실행
    if (activeCandle) {
      updateTabTitleManager(
        activeCandle.close,
        symbol,
        store.currentMarket === "UPBIT",
      );
    }

    if (realtimeUpdatePending) return;
    realtimeUpdatePending = true;

    requestAnimationFrame(() => {
      realtimeUpdatePending = false;

      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;

      const currentCandle = latestActiveCandle;
      const currentSymbol = latestSymbol;
      const currentServerMs = latestServerMs;
      if (!currentCandle) return;

      const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
      const chartTime = isDayUnit
        ? (() => {
          if (
            typeof currentCandle.time === "string" &&
            currentCandle.time.includes("-")
          )
            return currentCandle.time;
          const numTime = Number(currentCandle.time);
          if (isNaN(numTime)) return currentCandle.time;
          const dt = new Date(numTime * 1000);
          return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
        })()
        : (() => {
          if (
            typeof currentCandle.time === "string" &&
            currentCandle.time.includes("-")
          ) {
            const parsedUnix = Math.floor(
              new Date(currentCandle.time).getTime() / 1000,
            );
            return isNaN(parsedUnix) ? currentCandle.time : parsedUnix;
          }
          return currentCandle.time;
        })();

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

      const normalizedTime = (() => {
        if (!isTimeValid) return null;
        let t = chartTime;
        if (typeof t === "string") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            return t;
          } else {
            const num = Number(t);
            if (!isNaN(num) && num > 0) return num;
            const parsed = Date.parse(t.includes("T") ? t : t + "T00:00:00Z");
            if (!isNaN(parsed)) return Math.floor(parsed / 1000);
          }
        }
        if (typeof t === "number" && !isNaN(t) && t > 0) {
          return t;
        }
        return null;
      })();

      const isValidCandle =
        currentCandle &&
        normalizedTime !== null &&
        normalizedTime !== undefined &&
        !isNaN(Number(currentCandle.open)) &&
        currentCandle.open !== null &&
        !isNaN(Number(currentCandle.high)) &&
        currentCandle.high !== null &&
        !isNaN(Number(currentCandle.low)) &&
        currentCandle.low !== null &&
        !isNaN(Number(currentCandle.close)) &&
        currentCandle.close !== null;

      if (store.candleSeries && isValidCandle) {
        try {
          store.candleSeries.update({
            time: normalizedTime,
            open: Number(currentCandle.open),
            high: Number(currentCandle.high),
            low: Number(currentCandle.low),
            close: Number(currentCandle.close),
            volume: Number(currentCandle.volume) || 0,
          });
          if (store.leftScaleSeries) {
            store.leftScaleSeries.update({
              time: normalizedTime,
              value: Number(currentCandle.close),
            });
          }
        } catch (candleUpdateErr) {
          console.warn(
            "🚨 candleSeries.update 예외 우회 완료:",
            candleUpdateErr,
          );
        }
        if (typeof window.updateRealtimeCountdown === "function") {
          window.updateRealtimeCountdown(currentServerMs);
        }
      }

      if (
        store.volumeSeries &&
        currentCandle.volume !== undefined &&
        currentCandle.volume !== null &&
        normalizedTime !== null &&
        normalizedTime !== undefined
      ) {
        if (!store.upColorCache || !store.downColorCache) {
          const curStyle = getComputedStyle(document.body);
          store.upColorCache =
            curStyle.getPropertyValue("--up").trim() || "#26a69a";
          store.downColorCache =
            curStyle.getPropertyValue("--down").trim() || "#ef5350";
        }
        const curUpVol = store.upColorCache + "80";
        const curDownVol = store.downColorCache + "80";
        const curVolColor =
          currentCandle.close >= currentCandle.open ? curUpVol : curDownVol;

        const safeVolume = Number(currentCandle.volume);
        if (!isNaN(safeVolume) && safeVolume !== null && safeVolume !== undefined) {
          const volObj = {
            time: normalizedTime,
            value: safeVolume,
            color: curVolColor,
          };
          try {
            const lastVolItem = store.volumeData && store.volumeData.length > 0
              ? store.volumeData[store.volumeData.length - 1]
              : null;

            if (!lastVolItem || normalizedTime >= lastVolItem.time) {
              store.volumeSeries.update(volObj);
              if (store.volumeData && store.volumeData.length > 0) {
                if (normalizedTime > lastVolItem.time) {
                  store.volumeData.push(volObj);
                } else if (normalizedTime === lastVolItem.time) {
                  store.volumeData[store.volumeData.length - 1] = volObj;
                }
              }
            }
          } catch (e) {
            console.warn("🚨 volumeSeries.update 예외 발생, vol-pane 자동 복구 시도:", e);
            if (store.volumeSeries && store.volumeData && store.volumeData.length > 0) {
              try {
                store.volumeSeries.setData([]);
                if (typeof window.sanitizeChartData === "function") {
                  store.volumeSeries.setData(window.sanitizeChartData(store.volumeData, true));
                } else {
                  store.volumeSeries.setData(store.volumeData);
                }
              } catch (rebindErr) { }
            }
          }
        }
      }

      updateRealtimeKimchi(currentCandle, currentSymbol, normalizedTime);

      const p = store.getPrecision(
        store.currentSelectedSymbol || currentSymbol,
      );
      if (typeof window.updateStatus === "function") {
        window.updateStatus(currentCandle, p);
      }
    });
  };

  const handleBinanceMessage = (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;

    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
    if (store.currentMarket !== "SPOT" && store.currentMarket !== "FUTURES")
      return;
    const res = JSON.parse(e.data);

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    const CHART_DISPATCHER = {
      aggTrade: () => {
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const tickSymbol = res.s.replace("USDT", "").toUpperCase();
        const expectedGlobalSymbol = (store.currentSelectedSymbol || "")
          .replace("USDT", "")
          .replace("KRW-", "")
          .replace("KRW", "")
          .toUpperCase();
        if (
          tickSymbol !== symbol.toUpperCase() ||
          tickSymbol !== expectedGlobalSymbol
        )
          return;

        const newPrice = parseFloat(res.p);
        const tradeQty = parseFloat(res.q) || 0;
        if (isNaN(newPrice)) return;

        const secondsPerBar = tfSec[store.currentTF] || 60;
        const lastCandleUnix = getUnixSeconds(lastCandle.time);
        const nextBarTime = lastCandleUnix + secondsPerBar;
        const currentUnix = Math.floor(res.E / 1000);

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
      },
      kline: () => {
        if (res.k.i !== store.currentTF) return;
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const tickSymbol = res.k.s.replace("USDT", "").toUpperCase();
        const expectedGlobalSymbol = (store.currentSelectedSymbol || "")
          .replace("USDT", "")
          .replace("KRW-", "")
          .replace("KRW", "")
          .toUpperCase();
        if (
          tickSymbol !== symbol.toUpperCase() ||
          tickSymbol !== expectedGlobalSymbol
        )
          return;

        const k = res.k;
        const kUnix = Math.floor(k.t / 1000);
        const kVol = parseFloat(k.v) || 0;

        const lastCandleUnix = getUnixSeconds(lastCandle.time);
        if (lastCandleUnix === kUnix) {
          lastCandle.open = Number(k.o);
          lastCandle.high = Math.max(lastCandle.high, Number(k.h));
          lastCandle.low = Math.min(lastCandle.low, Number(k.l));
          lastCandle.close = Number(k.c);
          lastCandle.volume = kVol;
          activeCandle = lastCandle;
        } else if (kUnix > lastCandleUnix) {
          activeCandle = {
            time: kUnix,
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: kVol,
          };
          store.mainData.push(activeCandle);
        }
        chartUpdateNeeded = true;
      },
    };

    CHART_DISPATCHER[res.e]?.();

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;

      const currentExpected = (store.currentSelectedSymbol || "")
        .replace("USDT", "")
        .replace("KRW-", "")
        .replace("KRW", "")
        .toUpperCase();
      if (symbol.toUpperCase() === currentExpected) {
        broadcastCandleUpdate(activeCandle, symbol, store.lastServerMs);
      }
    }
  };

  const handleBybitMessage = (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;

    const isBybitActive =
      store.currentMarket === "BYBIT" ||
      store.currentMarket === "BYBIT_FUTURES";
    if (!isBybitActive) return;

    const res = JSON.parse(e.data);
    if (!res.data || !res.topic.startsWith("publicTrade.")) return;

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleUnix = getUnixSeconds(lastCandle.time);
    const nextBarTime = lastCandleUnix + secondsPerBar;

    res.data.forEach((trade) => {
      const newPrice = parseFloat(trade.p);
      const tradeQty = parseFloat(trade.v) || 0;
      if (isNaN(newPrice)) return;

      const currentUnix = Math.floor(Number(trade.T) / 1000);

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
      broadcastCandleUpdate(activeCandle, symbol, res.ts || Date.now());
    }
  };

  if (isFutures || isSpot) {
    if (
      !store.binanceChartWs ||
      store.binanceChartWs.readyState !== WebSocket.OPEN ||
      !store.binanceChartWs.url.includes(
        isFutures ? "fstream" : "stream.binance.com",
      )
    ) {
      if (store.binanceChartWs) {
        try {
          store.binanceChartWs.close();
        } catch (e) { }
      }
      store.binanceChartWs = new WebSocket(wsBase);
      store.binanceChartWs.onopen = () => {
        store.binanceChartWs.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [aggStream, klineStream],
            id: getWsId(),
          }),
        );
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      };
    } else if (store.currentKlineStream !== `${aggStream}/${klineStream}`) {
      try {
        const oldParams = store.currentKlineStream.split("/");
        store.binanceChartWs.send(
          JSON.stringify({
            method: "UNSUBSCRIBE",
            params: oldParams,
            id: getWsId(),
          }),
        );
        store.binanceChartWs.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [aggStream, klineStream],
            id: getWsId(),
          }),
        );
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      } catch (e) { }
    }
    store.binanceChartWs.onmessage = handleBinanceMessage;
  } else if (isUpbit) {
    const upbitCode = `KRW-${symbol}`.toUpperCase();
    if (
      !store.upbitChartWs ||
      store.upbitChartWs.readyState !== WebSocket.OPEN
    ) {
      if (store.upbitChartWs) store.upbitChartWs.close();
      store.upbitChartWs = new WebSocket("wss://api.upbit.com/websocket/v1");
      store.upbitChartWs.onopen = () => {
        store.upbitChartWs.send(
          JSON.stringify([
            { ticket: "sellnance_chart_" + getWsId() },
            { type: "ticker", codes: [upbitCode] },
          ]),
        );
        store.currentUpbitStream = upbitCode;
      };
    } else if (store.currentUpbitStream !== upbitCode) {
      try {
        store.upbitChartWs.send(
          JSON.stringify([
            { ticket: "sellnance_chart_" + getWsId() },
            { type: "ticker", codes: [upbitCode] },
          ]),
        );
        store.currentUpbitStream = upbitCode;
      } catch (e) { }
    }
    store.upbitChartWs.onmessage = getUpbitMessageHandler(
      symbol,
      broadcastCandleUpdate,
    );
  } else if (isBithumb) {
    const bithumbCode = `${symbol}_KRW`.toUpperCase();
    if (
      !store.bithumbChartWs ||
      store.bithumbChartWs.readyState !== WebSocket.OPEN
    ) {
      if (store.bithumbChartWs) {
        try {
          store.bithumbChartWs.close();
        } catch (e) { }
      }
      store.bithumbChartWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
      store.bithumbChartWs.onopen = () => {
        store.bithumbChartWs.send(
          JSON.stringify({
            type: "transaction",
            symbols: [bithumbCode],
          }),
        );
        store.currentBithumbStream = bithumbCode;
      };
    } else if (store.currentBithumbStream !== bithumbCode) {
      try {
        store.bithumbChartWs.close();
      } catch (e) { }
      store.bithumbChartWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
      store.bithumbChartWs.onopen = () => {
        store.bithumbChartWs.send(
          JSON.stringify({
            type: "transaction",
            symbols: [bithumbCode],
          }),
        );
        store.currentBithumbStream = bithumbCode;
      };
    }
    store.bithumbChartWs.onmessage = getBithumbMessageHandler(
      symbol,
      broadcastCandleUpdate,
    );
  } else if (isBybit) {
    const bybitCode = `${symbol}USDT`.toUpperCase();
    const wsUrl = isBybitFutures
      ? "wss://stream.bybit.com/v5/public/linear"
      : "wss://stream.bybit.com/v5/public/spot";

    if (
      !store.bybitChartWs ||
      store.bybitChartWs.readyState !== WebSocket.OPEN ||
      !store.bybitChartWs.url.includes(isBybitFutures ? "linear" : "spot")
    ) {
      if (store.bybitChartWs) {
        try {
          store.bybitChartWs.close();
        } catch (e) { }
      }
      store.bybitChartWs = new WebSocket(wsUrl);
      store.bybitChartWs.onopen = () => {
        store.bybitChartWs.send(
          JSON.stringify({
            op: "subscribe",
            args: [`publicTrade.${bybitCode}`],
          }),
        );
        store.currentBybitStream = bybitCode;
      };
    } else if (store.currentBybitStream !== bybitCode) {
      try {
        store.bybitChartWs.send(
          JSON.stringify({
            op: "unsubscribe",
            args: [`publicTrade.${store.currentBybitStream}`],
          }),
        );
        store.bybitChartWs.send(
          JSON.stringify({
            op: "subscribe",
            args: [`publicTrade.${bybitCode}`],
          }),
        );
        store.currentBybitStream = bybitCode;
      } catch (e) { }
    }
    store.bybitChartWs.onmessage = handleBybitMessage;
  }
}

window.startRealtimeCandle = startRealtimeCandle;
window.updateTabTitleManager = updateTabTitleManager;
