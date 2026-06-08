// stream_global.js
import { store, tfSec } from "./_store.js";
import { getUnixSeconds, updateTabTitleManager } from "./chart_utils.js";
import {
  getUpbitMessageHandler,
  getBithumbMessageHandler,
  updateRealtimeKimchi,
} from "./stream_korea.js";
import { renderRealtimeUpdate } from "./stream_render.js";
import { getNormalizedTime, isTimeValid } from "./stream_utils.js";

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

  // 1️⃣ 기존 활성화된 이종 거래소 소켓 안전하게 연결 해제 제어
  if (!(isFutures || isSpot) && store.binanceChartWs) {
    try { store.binanceChartWs.close(); } catch (e) { }
    store.binanceChartWs = null; store.currentKlineStream = null;
  }
  if (!isUpbit && store.upbitChartWs) {
    try { store.upbitChartWs.close(); } catch (e) { }
    store.upbitChartWs = null; store.currentUpbitStream = null;
  }
  if (!isBithumb && store.bithumbChartWs) {
    try { store.bithumbChartWs.close(); } catch (e) { }
    store.bithumbChartWs = null; store.currentBithumbStream = null;
  }
  if (!isBybit && store.bybitChartWs) {
    try { store.bybitChartWs.close(); } catch (e) { }
    store.bybitChartWs = null; store.currentBybitStream = null;
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
    store.binanceChartWs.url.includes(isFutures ? "fstream" : "stream.binance.com")
  )
    return;

  const getWsId = () => Math.floor(Date.now() + Math.random() * 1000);

  let realtimeUpdatePending = false;
  let latestActiveCandle = null;
  let latestSymbol = null;
  let latestServerMs = null;

  // 2️⃣ 소켓 수신 데이터를 메인 루프에 분배하는 게이트웨이
  const broadcastCandleUpdate = (activeCandle, symbol, serverMs) => {
    latestActiveCandle = activeCandle;
    latestSymbol = symbol;
    latestServerMs = serverMs;

    // 백그라운드 탭 타이틀 실시간 반영
    if (activeCandle) {
      updateTabTitleManager(activeCandle.close, symbol, store.currentMarket === "UPBIT");
    }

    if (realtimeUpdatePending) return;
    realtimeUpdatePending = true;

    requestAnimationFrame(() => {
      realtimeUpdatePending = false;
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;

      const currentCandle = latestActiveCandle;
      if (!currentCandle) return;

      // 🎯 분리된 시간 가공 및 유효성 검증 엔진 가동
      const chartTime = getNormalizedTime(currentCandle);
      if (!isTimeValid(chartTime)) return;

      // 🎯 분리된 차트 렌더링 코어에 데이터 주입 위임
      renderRealtimeUpdate(chartTime, currentCandle);

      // 카운트다운, 김프 조립 및 상단 대시보드 스케일 동기화 연동
      if (typeof window.updateRealtimeCountdown === "function") {
        window.updateRealtimeCountdown(latestServerMs);
      }
      updateRealtimeKimchi(currentCandle, latestSymbol, chartTime);

      const p = store.getPrecision(store.currentSelectedSymbol || latestSymbol);
      if (typeof window.updateStatus === "function") {
        window.updateStatus(currentCandle, p);
      }
    });
  };

  // 3️⃣ 바이낸스 소켓 메시지 파서
  const handleBinanceMessage = (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
    if (store.currentMarket !== "SPOT" && store.currentMarket !== "FUTURES") return;

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
        const expectedGlobalSymbol = (store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "").toUpperCase();
        if (tickSymbol !== symbol.toUpperCase() || tickSymbol !== expectedGlobalSymbol) return;

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
        } else {
          activeCandle = { time: currentUnix, open: newPrice, high: newPrice, low: newPrice, close: newPrice, volume: tradeQty };
          store.mainData.push(activeCandle);
        }
        chartUpdateNeeded = true;
      },
      kline: () => {
        if (res.k.i !== store.currentTF) return;
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const tickSymbol = res.k.s.replace("USDT", "").toUpperCase();
        const expectedGlobalSymbol = (store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "").toUpperCase();
        if (tickSymbol !== symbol.toUpperCase() || tickSymbol !== expectedGlobalSymbol) return;

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
          activeCandle = { time: kUnix, open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: kVol };
          store.mainData.push(activeCandle);
        }
        chartUpdateNeeded = true;
      },
    };

    CHART_DISPATCHER[res.e]?.();

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
      const currentExpected = (store.currentSelectedSymbol || "").replace("USDT", "").replace("KRW-", "").replace("KRW", "").toUpperCase();
      if (symbol.toUpperCase() === currentExpected) {
        broadcastCandleUpdate(activeCandle, symbol, store.lastServerMs);
      }
    }
  };

  // 4️⃣ 바이비트 소켓 메시지 파서
  const handleBybitMessage = (e) => {
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;

    const isBybitActive = store.currentMarket === "BYBIT" || store.currentMarket === "BYBIT_FUTURES";
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
        activeCandle = { time: currentUnix, open: newPrice, high: newPrice, low: newPrice, close: newPrice, volume: tradeQty };
        store.mainData.push(activeCandle);
        chartUpdateNeeded = true;
      }
    });

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
      broadcastCandleUpdate(activeCandle, symbol, res.ts || Date.now());
    }
  };

  // 5️⃣ 거래소별 웹소켓 분기 커넥션 핸들러
  if (isFutures || isSpot) {
    if (!store.binanceChartWs || store.binanceChartWs.readyState !== WebSocket.OPEN || !store.binanceChartWs.url.includes(isFutures ? "fstream" : "stream.binance.com")) {
      if (store.binanceChartWs) { try { store.binanceChartWs.close(); } catch (e) { } }
      store.binanceChartWs = new WebSocket(wsBase);
      store.binanceChartWs.onopen = () => {
        store.binanceChartWs.send(JSON.stringify({ method: "SUBSCRIBE", params: [aggStream, klineStream], id: getWsId() }));
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      };
    } else if (store.currentKlineStream !== `${aggStream}/${klineStream}`) {
      try {
        store.binanceChartWs.send(JSON.stringify({ method: "UNSUBSCRIBE", params: store.currentKlineStream.split("/"), id: getWsId() }));
        store.binanceChartWs.send(JSON.stringify({ method: "SUBSCRIBE", params: [aggStream, klineStream], id: getWsId() }));
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      } catch (e) { }
    }
    store.binanceChartWs.onmessage = handleBinanceMessage;
  } else if (isUpbit) {
    const upbitCode = `KRW-${symbol}`.toUpperCase();
    if (!store.upbitChartWs || store.upbitChartWs.readyState !== WebSocket.OPEN) {
      if (store.upbitChartWs) store.upbitChartWs.close();
      store.upbitChartWs = new WebSocket("wss://api.upbit.com/websocket/v1");
      store.upbitChartWs.onopen = () => {
        store.upbitChartWs.send(JSON.stringify([{ ticket: "sellnance_chart_" + getWsId() }, { type: "ticker", codes: [upbitCode] }]));
        store.currentUpbitStream = upbitCode;
      };
    } else if (store.currentUpbitStream !== upbitCode) {
      try { store.upbitChartWs.send(JSON.stringify([{ ticket: "sellnance_chart_" + getWsId() }, { type: "ticker", codes: [upbitCode] }])); store.currentUpbitStream = upbitCode; } catch (e) { }
    }
    store.upbitChartWs.onmessage = getUpbitMessageHandler(symbol, broadcastCandleUpdate);
  } else if (isBithumb) {
    const bithumbCode = `${symbol}_KRW`.toUpperCase();
    if (!store.bithumbChartWs || store.bithumbChartWs.readyState !== WebSocket.OPEN) {
      if (store.bithumbChartWs) { try { store.bithumbChartWs.close(); } catch (e) { } }
      store.bithumbChartWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
      store.bithumbChartWs.onopen = () => {
        store.bithumbChartWs.send(JSON.stringify({ type: "transaction", symbols: [bithumbCode] }));
        store.currentBithumbStream = bithumbCode;
      };
    } else if (store.currentBithumbStream !== bithumbCode) {
      try { store.bithumbChartWs.close(); } catch (e) { }
      store.bithumbChartWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
      store.bithumbChartWs.onopen = () => {
        store.bithumbChartWs.send(JSON.stringify({ type: "transaction", symbols: [bithumbCode] }));
        store.currentBithumbStream = bithumbCode;
      };
    }
    store.bithumbChartWs.onmessage = getBithumbMessageHandler(symbol, broadcastCandleUpdate);
  } else if (isBybit) {
    const bybitCode = `${symbol}USDT`.toUpperCase();
    const wsUrl = isBybitFutures ? "wss://stream.bybit.com/v5/public/linear" : "wss://stream.bybit.com/v5/public/spot";

    if (!store.bybitChartWs || store.bybitChartWs.readyState !== WebSocket.OPEN || !store.bybitChartWs.url.includes(isBybitFutures ? "linear" : "spot")) {
      if (store.bybitChartWs) { try { store.bybitChartWs.close(); } catch (e) { } }
      store.bybitChartWs = new WebSocket(wsUrl);
      store.bybitChartWs.onopen = () => {
        store.bybitChartWs.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${bybitCode}`] }));
        store.currentBybitStream = bybitCode;
      };
    } else if (store.currentBybitStream !== bybitCode) {
      try {
        store.bybitChartWs.send(JSON.stringify({ op: "unsubscribe", args: [`publicTrade.${store.currentBybitStream}`] }));
        store.bybitChartWs.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${bybitCode}`] }));
        store.currentBybitStream = bybitCode;
      } catch (e) { }
    }
    store.bybitChartWs.onmessage = handleBybitMessage;
  }
}

window.startRealtimeCandle = startRealtimeCandle;
window.updateTabTitleManager = updateTabTitleManager;