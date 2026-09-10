// feed_upbit.js
import { store } from "./_store.js";

let upbitRadarWs = null;
let upbitRadarRetryDelay = 5000;
let upbitRetryTimer = null;

export function startUpbitFeed() {
  if (upbitRadarWs && (upbitRadarWs.readyState === WebSocket.OPEN || upbitRadarWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (upbitRetryTimer) {
    clearTimeout(upbitRetryTimer);
    upbitRetryTimer = null;
  }

  try {
    upbitRadarWs = new WebSocket("wss://api.upbit.com/websocket/v1");
  } catch (e) {
    scheduleUpbitReconnect();
    return;
  }

  upbitRadarWs.binaryType = "arraybuffer";
  store.upbitRadarWs = upbitRadarWs;

  upbitRadarWs.onclose = () => {
    scheduleUpbitReconnect();
  };

  upbitRadarWs.onerror = () => {
    // onclose will trigger next
  };

  upbitRadarWs.onopen = () => {
    upbitRadarRetryDelay = 5000;
    const allUpbitCodes = getActiveUpbitCodes();
    try {
      upbitRadarWs.send(
        JSON.stringify([
          { ticket: `sellnance_upbit_radar_${Date.now()}` },
          { type: "ticker", codes: allUpbitCodes },
        ])
      );
    } catch (e) { }
  };

  const decoder = new TextDecoder("utf-8");
  upbitRadarWs.onmessage = (event) => {
    try {
      const ticker = JSON.parse(decoder.decode(event.data));
      if (!ticker || !ticker.code) return;
      const pureSym = ticker.code.replace("KRW-", "");
      const krwTicker = pureSym + "KRW";
      const newPriceKrw = parseFloat(ticker.trade_price);

      // O(1) 해시 탐색 (이전: allSource.find() O(N) 선형 탐색 → 개선)
      const localRow = store.tickerRowMap?.get(krwTicker) || store.tickerRowMap?.get(pureSym);
      const matchedUid = (localRow && localRow.Upbit === "O") ? localRow.UID : "";

      if (localRow && localRow.Upbit === "O") {
        localRow.Upbit_Price = newPriceKrw;
        localRow.Price_KRW = newPriceKrw;

        const hasGlobal = localRow.Binance === "O" || localRow.Binance_Futures === "O" ||
          localRow.Listed_Exchanges?.includes("BINANCE") || localRow.Listed_Exchanges?.includes("BINANCE_FUTURES");
        if (!hasGlobal) {
          const rate = store.marketDataMap?.krw_usd_rate || 0;
          if (rate > 0) {
            localRow.Price_Raw = newPriceKrw / rate;
            if (localRow.utc0_open_Raw) {
              const openPrice = parseFloat(localRow.utc0_open_Raw);
              localRow.Change_Today_Raw = ((localRow.Price_Raw - openPrice) / openPrice) * 100;
            }
          }
        }
      }

      const normalizedTicker = {
        s: krwTicker,
        c: newPriceKrw,
        P: ticker.signed_change_rate * 100,
        q_upbit: ticker.acc_trade_price_24h,
        isUpbitRealtime: true,
        UID: matchedUid,
      };

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[ticker.code] = normalizedTicker;

      const hasSymbol =
        store.visibleSymbols?.has(pureSym) ||
        store.visibleSymbols?.has(krwTicker) ||
        store.visibleSymbols?.has(ticker.code);

      if (hasSymbol && typeof window.renderRealtimeRow === "function") {
        const isFutures = store.currentMarket === "FUTURES";
        window.renderRealtimeRow(ticker.code, normalizedTicker, isFutures);
      }

      // 실시간 차트 캔들 및 김프 갱신으로 직결 (단일 소켓 공유)
      if (typeof window._upbitChartHandler === "function") {
        window._upbitChartHandler(ticker);
      }
      // 퀵뷰 전용 실시간 캔들 갱신 라우팅 (소켓 중복 연결 없이 단일 소켓 공유)
      if (typeof window._qvUpbitHandler === "function") {
        window._qvUpbitHandler(ticker);
      }
    } catch (err) { }
  };
}

function scheduleUpbitReconnect() {
  if (upbitRetryTimer) return;
  const delay = upbitRadarRetryDelay;
  upbitRadarRetryDelay = Math.min(60000, Math.floor(upbitRadarRetryDelay * 1.5));
  upbitRetryTimer = setTimeout(() => {
    upbitRetryTimer = null;
    startUpbitFeed();
  }, delay);
}

// 🎯 업비트 테이블 소켓 (단일 소켓으로 통합 관리)
export function initUpbitSniperSocket() {
  startUpbitFeed();
}

// 📋 단일 소켓에서 구독할 모든 업비트 심볼 추출 (메인 테이블 + 퀵뷰 활성 코인 통합)
export function getActiveUpbitCodes() {
  const codeSet = new Set();
  const source = store.currentTableData || store.originalTableData || [];
  source.forEach((row) => {
    if (row.Upbit === "O" && row.Symbol) {
      codeSet.add(`KRW-${row.Symbol}`);
    }
  });

  // 🚀 퀵뷰 전용 활성 코인(8개 중 업비트 코인) 강제 포함 보장
  if (typeof window._getQvUpbitCodes === "function") {
    const qvCodes = window._getQvUpbitCodes();
    if (Array.isArray(qvCodes)) {
      qvCodes.forEach((c) => codeSet.add(c));
    }
  }

  const list = Array.from(codeSet);
  return list.length > 0 ? list : ["KRW-BTC"];
}

export function syncUpbitRadarSubscription() {
  if (!upbitRadarWs || upbitRadarWs.readyState !== WebSocket.OPEN) {
    startUpbitFeed();
    return;
  }
  const allUpbitCodes = getActiveUpbitCodes();
  try {
    upbitRadarWs.send(
      JSON.stringify([
        { ticket: `sellnance_upbit_radar_${Date.now()}` },
        { type: "ticker", codes: allUpbitCodes },
      ])
    );
  } catch (e) { }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (upbitRadarWs) {
      upbitRadarWs.onclose = null;
      upbitRadarWs.onerror = null;
      try {
        upbitRadarWs.close(1000);
      } catch (_) { }
    }
  });
}

window.syncUpbitRadarSubscription = syncUpbitRadarSubscription;
window.initUpbitSniperSocket = initUpbitSniperSocket;

