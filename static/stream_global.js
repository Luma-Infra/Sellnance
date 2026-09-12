// stream_global.js
import { store, tfSec, CONFIG } from "./_store.js";
import { getUnixSeconds, getNextBarTime, updateTabTitleManager, getPureBase } from "./chart_utils.js";
import {
  getUpbitMessageHandler,
  getBithumbMessageHandler,
  updateRealtimeKimchiThrottled,
} from "./stream_korea.js";
import { renderRealtimeUpdate } from "./stream_render.js";
import {
  isChartBusy,
  isMatchingCurrentSymbol,
  isValidPriceRatio,
  applyTradeToCandle,
  getNormalizedTime,
  isTimeValid,
} from "./stream_utils.js";

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
    store.currentChartMarket === "BYBIT" || store.currentChartMarket === "BYBIT_FUTURES";
  const isBybitFutures = store.currentChartMarket === "BYBIT_FUTURES";

  // 🚀 [해결] 실시간 김프 동적 연산을 위해, 현재 탭의 거래소뿐 아니라 김프 계산의 상대방(국내 ↔ 해외) 거래소 소켓도 활성화 상태로 유지합니다.
  const pureSymbol = getPureBase(symbol);
  const effUid = store.currentSelectedUid;
  let row = null;
  if (effUid && store.currentTableData) {
    row = store.currentTableData.find((c) => String(c.UID) === String(effUid));
  }
  if (!row && store.currentTableData) {
    row = store.currentTableData.find(
      (c) => c.DisplayTicker === symbol || c.Ticker === symbol || getPureBase(c.Symbol) === pureSymbol || getPureBase(c.Ticker) === pureSymbol
    );
  }

  const hasUpbit = row ? (row.Upbit === "O" || row.Listed_Exchanges?.includes("UPBIT")) : true;
  const hasBithumb = row ? (row.Listed_Exchanges?.includes("BITHUMB")) : false;
  const hasBinance = row ? row.Listed_Exchanges?.some(ex => ex.includes("BINANCE")) : true;
  const hasBybit = row ? row.Listed_Exchanges?.some(ex => ex.includes("BYBIT")) : false;

  const needKimchiPartner = !store.isKimchiDisabled;
  const needBinance = (isFutures || isSpot) || (needKimchiPartner && ["UPBIT", "BITHUMB", "BYBIT", "BYBIT_FUTURES"].includes(store.currentChartMarket) && hasBinance);
  const needBybit = isBybit || (needKimchiPartner && ["UPBIT", "BITHUMB", "SPOT", "FUTURES"].includes(store.currentChartMarket) && hasBybit && !hasBinance);
  const needUpbit = isUpbit || (needKimchiPartner && ["SPOT", "FUTURES", "BYBIT", "BYBIT_FUTURES"].includes(store.currentChartMarket) && hasUpbit);
  const needBithumb = isBithumb || (needKimchiPartner && ["SPOT", "FUTURES", "BYBIT", "BYBIT_FUTURES"].includes(store.currentChartMarket) && hasBithumb);

  if (!needBinance && store.binanceChartWs) {
    try { store.binanceChartWs.close(); } catch (e) { }
    store.binanceChartWs = null; store.currentKlineStream = null;
  }
  if (!needUpbit && store.upbitChartWs) {
    try { store.upbitChartWs.close(); } catch (e) { }
    store.upbitChartWs = null; store.currentUpbitStream = null;
  }
  if (!needBithumb && store.bithumbChartWs) {
    try { store.bithumbChartWs.close(); } catch (e) { }
    store.bithumbChartWs = null; store.currentBithumbStream = null;
  }
  if (!needBybit && store.bybitChartWs) {
    try { store.bybitChartWs.close(); } catch (e) { }
    store.bybitChartWs = null; store.currentBybitStream = null;
  }

  const binanceIsFutures = isFutures
    ? true
    : isSpot
      ? false
      : Boolean(store.currentChartMarket !== "SPOT" && store.currentChartMarket !== "BINANCE" && (row?.Exact_Futures || row?.Binance_Futures === "O"));
  const binanceSym = (binanceIsFutures ? (row?.Exact_Futures || pureSymbol) : (row?.Exact_Spot || pureSymbol)).toLowerCase();
  const aggStream = `${binanceSym}usdt@aggTrade`;
  const klineStream = `${binanceSym}usdt@kline_${interval}`;
  const wsBase = binanceIsFutures
    ? "wss://fstream.binance.com/market/ws"
    : "wss://stream.binance.com:9443/ws";

  const getWsId = () => Math.floor(Date.now() + Math.random() * 1000);

  let realtimeUpdatePending = false;
  let realtimeUpdateTimer = null;
  let latestActiveCandle = null;
  let latestSymbol = null;
  let latestServerMs = null;
  let lastChartRenderTime = 0;
  let lastTitleUpdateTime = 0;
  let lastStatusUpdateTime = 0;
  let lastCountdownUpdateTime = 0;

  // 🚀 코인 전환 시 대기 중인 틱 버퍼 및 타이머 즉시 초기화
  window.flushRealtimeBuffers = () => {
    latestActiveCandle = null;
    latestSymbol = null;
    realtimeUpdatePending = false;
    if (realtimeUpdateTimer) {
      clearTimeout(realtimeUpdateTimer);
      realtimeUpdateTimer = null;
    }
  };

  // 2️⃣ 소켓 수신 데이터를 메인 루프에 분배하는 게이트웨이
  const broadcastCandleUpdate = (activeCandle, symbol, serverMs, marketType) => {
    latestActiveCandle = activeCandle;
    latestSymbol = symbol;
    latestServerMs = serverMs;

    const perfConfig = CONFIG.CHART_PERF;

    const now = performance.now();

    // 백그라운드 탭 타이틀 실시간 반영 (쓰로틀 적용으로 0ms DOM Reflow 차단)
    if (activeCandle) {
      activeCandle.symbol = symbol; // 🚀 심볼 보존
      activeCandle.marketType = marketType; // 🚀 거래소 및 현/선물 성격 마크 주입
      if (now - lastTitleUpdateTime >= perfConfig.TITLE_UPDATE_THROTTLE_MS) {
        lastTitleUpdateTime = now;
        updateTabTitleManager(activeCandle.close, symbol, ["UPBIT", "BITHUMB"].includes(store.currentChartMarket));
      }
    }

    if (realtimeUpdatePending) return;
    if (now - lastChartRenderTime < perfConfig.REALTIME_THROTTLE_MS) {
      if (!realtimeUpdateTimer) {
        realtimeUpdateTimer = setTimeout(() => {
          realtimeUpdateTimer = null;
          broadcastCandleUpdate(latestActiveCandle, latestSymbol, latestServerMs, marketType);
        }, perfConfig.REALTIME_THROTTLE_MS);
      }
      return;
    }
    realtimeUpdatePending = true;

    requestAnimationFrame(() => {
      realtimeUpdatePending = false;
      lastChartRenderTime = performance.now();
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory || store.isRestoringTab) return;

      // 🛡️ [Symbol Guard] rAF 실행 시점에 버퍼의 심볼이 현재 활성 코인(store.currentAsset)과 일치하지 않으면 즉시 폐기!
      if (latestSymbol && !isMatchingCurrentSymbol(latestSymbol)) {
        return;
      }

      const currentCandle = latestActiveCandle;
      if (!currentCandle) return;

      // 🎯 분리된 시간 가공 및 유효성 검증 엔진 가동
      const chartTime = getNormalizedTime(currentCandle);
      if (!isTimeValid(chartTime)) return;

      // 🎯 분리된 차트 렌더링 코어에 데이터 주입 위임
      renderRealtimeUpdate(chartTime, currentCandle, latestSymbol);

      const nowRaf = performance.now();

      // 카운트다운 DOM 갱신 (쓰로틀 적용)
      if (nowRaf - lastCountdownUpdateTime >= perfConfig.COUNTDOWN_THROTTLE_MS) {
        lastCountdownUpdateTime = nowRaf;
        if (typeof window.updateRealtimeCountdown === "function") {
          window.updateRealtimeCountdown(latestServerMs);
        }
      }

      // 김프 조립 (자체 쓰로틀 보유)
      if (!store.isKimchiDisabled) {
        updateRealtimeKimchiThrottled(currentCandle, latestSymbol, chartTime);
      }

      // OHLC 레전드 및 헤더 상태창 DOM 1:1 즉각 갱신 (캔들 움직임과 완벽 동기화)
      const p = store.getPrecision(store.currentSelectedSymbol || latestSymbol);
      if (typeof window.updateStatus === "function") {
        window.updateStatus(currentCandle, p, true);
      }

      // 🚨 [병목 원천 제거] syncPriceScaleWidths는 매 틱마다 캔버스 너비를 강제 계산하여 극심한 렉을 유발하므로
      // 실시간 틱 루프에서 완전히 제거함 (코인 선택, 차트 로드, 리사이즈 시에만 실행)
    });
  };

  // 3️⃣ 바이낸스 소켓 메시지 파서
  const handleBinanceMessage = (e) => {
    if (e.target !== store.binanceChartWs) return;
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
    const isMsgFutures = e.target.url.includes("fstream");
    const isActiveFutures = store.currentChartMarket === "FUTURES" || store.currentChartMarket === "BINANCE_FUTURES";
    const isActiveSpot = store.currentChartMarket === "SPOT" || store.currentChartMarket === "BINANCE";

    const res = JSON.parse(e.data);
    const tickSymbol = (res.s || res.k?.s || "").replace(/USDT$/i, "").toUpperCase();
    if (!tickSymbol) return;

    if ((isActiveSpot && isMsgFutures) || (isActiveFutures && !isMsgFutures) || (!isActiveSpot && !isActiveFutures)) {
      // 🚀 현재 탭과 들어온 스트림 데이터의 현/선물 성격이 일치하지 않거나 바이낸스 탭이 아닌 경우,
      // 메인 차트 데이터(store.mainData)를 오염시키지 않고 오직 김프 계산을 위한 실시간 시세 버퍼 업데이트 및 김프 갱신만 수행합니다.
      if (res.e === "aggTrade" || res.e === "kline") {
        const isMatch = isMatchingCurrentSymbol(tickSymbol);
        if (isMatch) {
          const newPrice = res.e === "aggTrade" ? parseFloat(res.p) : parseFloat(res.k?.c);
          if (!isNaN(newPrice)) {
            const bufKey = isMsgFutures ? `${tickSymbol}USDT_FUTURES` : `${tickSymbol}USDT`;
            if (!store.tickerBuffer) store.tickerBuffer = {};
            store.tickerBuffer[bufKey] = { c: newPrice };

            if (store.mainData && store.mainData.length > 0) {
              const lastCandle = store.mainData[store.mainData.length - 1];
              updateRealtimeKimchiThrottled({ close: newPrice, marketType: isMsgFutures ? "FUTURES" : "SPOT" }, symbol, lastCandle.time);
            }
          }
        }
      }
      return;
    }

    if (isChartBusy()) return;
    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    if (!isMatchingCurrentSymbol(tickSymbol)) return;

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    const CHART_DISPATCHER = {
      aggTrade: () => {
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const newPrice = parseFloat(res.p);
        const tradeQty = parseFloat(res.q) || 0;
        if (isNaN(newPrice)) return;

        // 🛡️ [가격 이상치/코인 교차 오염 안전망]
        if (!isValidPriceRatio(newPrice, lastCandle.close)) return;

        const nextBarTime = getNextBarTime(lastCandle.time, store.currentTF);
        const currentUnix = Math.floor(res.E / 1000);

        const tradeResult = applyTradeToCandle(lastCandle, newPrice, tradeQty, currentUnix, nextBarTime);
        activeCandle = tradeResult.activeCandle;
        chartUpdateNeeded = true;
      },
      kline: () => {
        if (res.k.i !== store.currentTF) return;
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

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
          const normTime = getNormalizedTime({ time: kUnix });
          activeCandle = { time: normTime, open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: kVol };
          store.mainData.push(activeCandle);
          store.mainDataMap.set(getUnixSeconds(activeCandle.time), activeCandle);
        }
        chartUpdateNeeded = true;
      },
    };

    CHART_DISPATCHER[res.e]?.();

    if (chartUpdateNeeded) {
      if (isChartBusy()) return;
      broadcastCandleUpdate(activeCandle, symbol, store.lastServerMs, isMsgFutures ? "FUTURES" : "SPOT");
    }
  };

  // 4️⃣ 바이비트 소켓 메시지 파서
  const handleBybitMessage = (e) => {
    if (e.target !== store.bybitChartWs) return;
    const btnSim = document.getElementById("tab-btn-sim");
    if (btnSim && btnSim.classList.contains("active")) return;
    if (isChartBusy()) return;

    const isMsgFutures = e.target.url.includes("linear");
    const isActiveFutures = store.currentChartMarket === "BYBIT_FUTURES";
    const isActiveSpot = store.currentChartMarket === "BYBIT" || store.currentChartMarket === "BYBIT_SPOT";

    const res = JSON.parse(e.data);
    if (!res.data || !res.topic?.startsWith("publicTrade.")) return;

    const topicSymbol = res.topic.replace("publicTrade.", "").replace(/USDT$/i, "").toUpperCase();

    if ((isActiveSpot && isMsgFutures) || (isActiveFutures && !isMsgFutures) || (!isActiveSpot && !isActiveFutures)) {
      // 🚀 현재 탭과 들어온 스트림 데이터의 현/선물 성격이 일치하지 않거나 바이비트 탭이 아닌 경우,
      // 메인 차트 데이터(store.mainData)를 오염시키지 않고 오직 김프 계산을 위한 실시간 시세 버퍼 업데이트 및 김프 갱신만 수행합니다.
      if (res.data.length > 0) {
        const lastTrade = res.data[res.data.length - 1];
        const newPrice = parseFloat(lastTrade.p);
        if (!isNaN(newPrice)) {
          const tickSymbol = symbol.toUpperCase();
          const bufKey = isMsgFutures ? `${tickSymbol}USDT_FUTURES` : `${tickSymbol}USDT`;
          if (!store.tickerBuffer) store.tickerBuffer = {};
          store.tickerBuffer[bufKey] = { c: newPrice };

          if (store.mainData && store.mainData.length > 0) {
            const lastCandle = store.mainData[store.mainData.length - 1];
            updateRealtimeKimchiThrottled({ close: newPrice, marketType: isMsgFutures ? "BYBIT_FUTURES" : "BYBIT" }, symbol, lastCandle.time);
          }
        }
      }
      return;
    }

    if (isChartBusy()) return;
    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    if (!isMatchingCurrentSymbol(topicSymbol)) return;

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;
    const nextBarTime = getNextBarTime(lastCandle.time, store.currentTF);

    res.data.forEach((trade) => {
      const newPrice = parseFloat(trade.p);
      const tradeQty = parseFloat(trade.v) || 0;
      if (isNaN(newPrice)) return;

      // 🛡️ [가격 이상치/코인 교차 오염 안전망]
      if (!isValidPriceRatio(newPrice, lastCandle.close)) return;

      const currentUnix = Math.floor(Number(trade.T) / 1000);

      const tradeResult = applyTradeToCandle(lastCandle, newPrice, tradeQty, currentUnix, nextBarTime);
      activeCandle = tradeResult.activeCandle;
      chartUpdateNeeded = true;
    });

    if (chartUpdateNeeded) {
      if (isChartBusy()) return;
      broadcastCandleUpdate(activeCandle, symbol, Date.now(), isMsgFutures ? "BYBIT_FUTURES" : "BYBIT");
    }

    if (chartUpdateNeeded) {
      if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;
      broadcastCandleUpdate(activeCandle, symbol, res.ts || Date.now(), isMsgFutures ? "BYBIT_FUTURES" : "BYBIT");
    }
  };

  // 5️⃣ 거래소별 웹소켓 분기 커넥션 핸들러
  if (needBinance) {
    const wsBasePartner = binanceIsFutures
      ? "wss://fstream.binance.com/market/ws"
      : "wss://stream.binance.com:9443/ws";

    const isCurrentWsFutures = Boolean(store.binanceChartWs?.url?.includes("fstream"));
    const isBinanceConnectingOrOpen = store.binanceChartWs &&
      (store.binanceChartWs.readyState === WebSocket.CONNECTING || store.binanceChartWs.readyState === WebSocket.OPEN) &&
      (binanceIsFutures === isCurrentWsFutures);

    const now = Date.now();
    const binanceCooldown = store._binanceWsCooldownUntil || 0;
    const canAttemptBinance = now > binanceCooldown;

    const desiredKlineStream = `${aggStream}/${klineStream}`;

    if (!isBinanceConnectingOrOpen && canAttemptBinance) {
      if (store.binanceChartWs) {
        try {
          store.binanceChartWs.onopen = null;
          store.binanceChartWs.onmessage = null;
          store.binanceChartWs.onerror = null;
          store.binanceChartWs.onclose = null;
          store.binanceChartWs.close();
        } catch (e) { }
      }
      store.currentKlineStream = desiredKlineStream;
      try {
        const ws = new WebSocket(wsBasePartner);
        store.binanceChartWs = ws;
        ws.onopen = () => {
          if (store.binanceChartWs !== ws) return;
          store._binanceWsCooldownUntil = 0;
          const streamToSub = store.currentKlineStream || desiredKlineStream;
          try {
            ws.send(JSON.stringify({ method: "SUBSCRIBE", params: streamToSub.split("/"), id: getWsId() }));
          } catch (e) { }
        };
        ws.onmessage = handleBinanceMessage;
        ws.onerror = (err) => {
          store._binanceWsCooldownUntil = Date.now() + 1000;
        };
        ws.onclose = () => {
          if (store.binanceChartWs === ws) {
            store.binanceChartWs = null;
            store.currentKlineStream = null;
            store._binanceWsCooldownUntil = Date.now() + 1000;
          }
        };
      } catch (e) {
        store._binanceWsCooldownUntil = Date.now() + 1000;
      }
    } else if (isBinanceConnectingOrOpen && store.currentKlineStream !== desiredKlineStream) {
      const oldStreams = (store.currentKlineStream || "").split("/").filter(Boolean);
      const newStreams = (desiredKlineStream || "").split("/").filter(Boolean);
      store.currentKlineStream = desiredKlineStream;

      const toUnsub = oldStreams.filter((s) => !newStreams.includes(s));
      const toSub = newStreams.filter((s) => !oldStreams.includes(s));

      if (store.binanceChartWs.readyState === WebSocket.OPEN) {
        try {
          if (toUnsub.length > 0) {
            store.binanceChartWs.send(JSON.stringify({ method: "UNSUBSCRIBE", params: toUnsub, id: getWsId() }));
          }
          if (toSub.length > 0) {
            store.binanceChartWs.send(JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getWsId() }));
          }
        } catch (e) { }
      }
      store.binanceChartWs.onmessage = handleBinanceMessage;
    } else if (store.binanceChartWs) {
      store.binanceChartWs.onmessage = handleBinanceMessage;
    }
  }

  if (needUpbit) {
    const upbitSym = (row?.Upbit_Symbol || row?.Symbol || pureSymbol).toUpperCase();
    const upbitCode = `KRW-${upbitSym}`;
    store.currentUpbitStream = upbitCode;

    // 테이블 단일 소켓(feed_upbit)을 통해 차트 틱 수신 (중복 연결 429 원천 차단)
    const upbitHandler = getUpbitMessageHandler(symbol, broadcastCandleUpdate);
    window._upbitChartHandler = upbitHandler;

    if (store.upbitChartWs) {
      try {
        store.upbitChartWs.onopen = null;
        store.upbitChartWs.onmessage = null;
        store.upbitChartWs.onerror = null;
        store.upbitChartWs.onclose = null;
        store.upbitChartWs.close();
        store.upbitChartWs = null;
      } catch (e) { }
    }
  } else {
    window._upbitChartHandler = null;
    if (store.upbitChartWs) {
      try {
        store.upbitChartWs.onopen = null;
        store.upbitChartWs.onmessage = null;
        store.upbitChartWs.onerror = null;
        store.upbitChartWs.onclose = null;
        store.upbitChartWs.close();
        store.upbitChartWs = null;
      } catch (e) { }
    }
  }

  if (needBithumb) {
    const bithumbSym = (row?.Bithumb_Symbol || pureSymbol).toUpperCase();
    const bithumbCode = `${bithumbSym}_KRW`;
    const isBithumbConnectingOrOpen = store.bithumbChartWs &&
      (store.bithumbChartWs.readyState === WebSocket.CONNECTING || store.bithumbChartWs.readyState === WebSocket.OPEN);

    const now = Date.now();
    const bithumbCooldown = store._bithumbWsCooldownUntil || 0;
    const canAttemptBithumb = now > bithumbCooldown;

    if (!isBithumbConnectingOrOpen && canAttemptBithumb) {
      if (store.bithumbChartWs) {
        try {
          store.bithumbChartWs.onopen = null;
          store.bithumbChartWs.onmessage = null;
          store.bithumbChartWs.onerror = null;
          store.bithumbChartWs.onclose = null;
          store.bithumbChartWs.close();
        } catch (e) { }
      }
      store.currentBithumbStream = bithumbCode;
      try {
        const ws = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
        store.bithumbChartWs = ws;
        ws.onopen = () => {
          if (store.bithumbChartWs !== ws) return;
          store._bithumbWsCooldownUntil = 0;
          const activeBithumb = store.currentBithumbStream || bithumbCode;
          try {
            ws.send(JSON.stringify({ type: "transaction", symbols: [activeBithumb] }));
          } catch (e) { }
        };
        ws.onerror = (err) => {
          store._bithumbWsCooldownUntil = Date.now() + 1000;
        };
        ws.onclose = () => {
          if (store.bithumbChartWs === ws) {
            store.bithumbChartWs = null;
            store.currentBithumbStream = null;
            store._bithumbWsCooldownUntil = Date.now() + 1000;
          }
        };
      } catch (e) {
        store._bithumbWsCooldownUntil = Date.now() + 1000;
      }
    } else if (isBithumbConnectingOrOpen && store.currentBithumbStream !== bithumbCode) {
      store.currentBithumbStream = bithumbCode;
      if (store.bithumbChartWs.readyState === WebSocket.OPEN) {
        try {
          store.bithumbChartWs.send(JSON.stringify({ type: "transaction", symbols: [bithumbCode] }));
        } catch (e) { }
      }
    }
    if (store.bithumbChartWs) {
      store.bithumbChartWs.onmessage = getBithumbMessageHandler(symbol, broadcastCandleUpdate);
    }
  }

  if (needBybit) {
    const bybitIsFutures = isBybitFutures || (store.currentChartMarket !== "BYBIT" && store.currentChartMarket !== "BYBIT_SPOT" && (row?.Exact_Futures || row?.Bybit_Futures === "O"));
    const bybitSym = (row?.Bybit_Symbol || (bybitIsFutures ? (row?.Exact_Futures || pureSymbol) : (row?.Exact_Spot || pureSymbol))).toUpperCase();
    const bybitCode = `${bybitSym}USDT`;
    const wsUrlPartner = bybitIsFutures ? "wss://stream.bybit.com/v5/public/linear" : "wss://stream.bybit.com/v5/public/spot";
    const isCurrentBybitFutures = Boolean(store.bybitChartWs?.url?.includes("linear"));
    const isBybitConnectingOrOpen = store.bybitChartWs &&
      (store.bybitChartWs.readyState === WebSocket.CONNECTING || store.bybitChartWs.readyState === WebSocket.OPEN) &&
      (bybitIsFutures === isCurrentBybitFutures);

    const now = Date.now();
    const bybitCooldown = store._bybitWsCooldownUntil || 0;
    const canAttemptBybit = now > bybitCooldown;

    if (!isBybitConnectingOrOpen && canAttemptBybit) {
      if (store.bybitChartWs) {
        try {
          store.bybitChartWs.onopen = null;
          store.bybitChartWs.onmessage = null;
          store.bybitChartWs.onerror = null;
          store.bybitChartWs.onclose = null;
          store.bybitChartWs.close();
        } catch (e) { }
      }
      store.currentBybitStream = bybitCode;
      try {
        const ws = new WebSocket(wsUrlPartner);
        store.bybitChartWs = ws;
        ws.onopen = () => {
          if (store.bybitChartWs !== ws) return;
          store._bybitWsCooldownUntil = 0;
          const activeBybit = store.currentBybitStream || bybitCode;
          try {
            ws.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${activeBybit}`] }));
          } catch (e) { }
        };
        ws.onerror = (err) => {
          store._bybitWsCooldownUntil = Date.now() + 1000;
        };
        ws.onclose = () => {
          if (store.bybitChartWs === ws) {
            store.bybitChartWs = null;
            store.currentBybitStream = null;
            store._bybitWsCooldownUntil = Date.now() + 1000;
          }
        };
      } catch (e) {
        store._bybitWsCooldownUntil = Date.now() + 1000;
      }
    } else if (isBybitConnectingOrOpen && store.currentBybitStream !== bybitCode) {
      const oldBybit = store.currentBybitStream;
      store.currentBybitStream = bybitCode;
      if (store.bybitChartWs.readyState === WebSocket.OPEN) {
        try {
          if (oldBybit) {
            store.bybitChartWs.send(JSON.stringify({ op: "unsubscribe", args: [`publicTrade.${oldBybit}`] }));
          }
          store.bybitChartWs.send(JSON.stringify({ op: "subscribe", args: [`publicTrade.${bybitCode}`] }));
        } catch (e) { }
      }
    }
    if (store.bybitChartWs) {
      store.bybitChartWs.onmessage = handleBybitMessage;
    }
  }
}

window.startRealtimeCandle = startRealtimeCandle;
window.updateTabTitleManager = updateTabTitleManager;