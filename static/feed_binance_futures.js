import { store } from "./_store.js";
import { getMultiplier, getPureBase } from "./chart_utils.js";

let binanceFuturesRadarWs = null;

export function startBinanceFuturesFeed() {
  if (
    binanceFuturesRadarWs &&
    binanceFuturesRadarWs.readyState !== WebSocket.CLOSED
  ) {
    return;
  }

  binanceFuturesRadarWs = new WebSocket("wss://fstream.binance.com/market/ws");
  store.binanceFuturesRadarWs = binanceFuturesRadarWs; // Backward compatibility

  binanceFuturesRadarWs.onopen = () => {
    try {
      binanceFuturesRadarWs.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: ["!ticker@arr"],
          id: 889,
        }),
      );
    } catch (e) {
      console.error("Binance Futures Radar subscribe error:", e);
    }
  };

  binanceFuturesRadarWs.onmessage = (event) => {
    if (
      typeof window !== "undefined" &&
      window.isSandboxActive &&
      window.isSandboxActive()
    )
      return;
    const data = JSON.parse(event.data);
    if (!Array.isArray(data)) return;

    data.forEach((ticker) => {
      if (!ticker.s.endsWith("USDT")) return;
      const pureSymbol = ticker.s.replace("USDT", "");
      const baseSym = getPureBase(pureSymbol);
      const bufferKey = ticker.s + "_FUTURES"; // Futures key: SymbolUSDT_FUTURES

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[bufferKey] = ticker;

      // [Futures 전용 격리 적재] 오직 선물 가격 및 거래량 변수만 반영 (O(1) 해시 색인 탐색 + Base 추출 연동)
      const row =
        store.tickerRowMap.get(ticker.s + "_FUTURES") ||
        store.tickerRowMap.get(ticker.s) ||
        store.tickerRowMap.get(pureSymbol) ||
        (baseSym ? store.tickerRowMap.get(baseSym) : null);

      if (row && typeof window.renderRealtimeRow === "function") {
        window.renderRealtimeRow(ticker.s, ticker, {
          exchange: "binance",
          market: "futures",
          quote: "USDT",
        });
      }
    });
  };

  binanceFuturesRadarWs.onclose = () => {
    setTimeout(startBinanceFuturesFeed, 3000);
  };
}

// 테이블용 바이낸스 선물 스나이퍼 소켓 초기화
export function initBinanceFuturesSniperSocket(forceReconnect = false) {
  if (forceReconnect && store.sniperWsFutures) {
    try {
      store.sniperWsFutures.close();
    } catch (_) {}
    store.sniperWsFutures = null;
  }

  // [조건 완화] 화면에 노출된 코인(visibleSymbols)만 타겟 구독하므로 소켓을 항상 열어두어 선물 전용 코인도 실시간 갱신
  if (
    !store.sniperWsFutures ||
    store.sniperWsFutures.readyState === WebSocket.CLOSED ||
    store.sniperWsFutures.readyState === WebSocket.CLOSING
  ) {
    store.sniperWsFutures = new WebSocket(
      "wss://fstream.binance.com/market/ws",
    );
    store.sniperWsFutures.onopen = () => {
      if (typeof window.syncSniperSubscriptions === "function") {
        window.syncSniperSubscriptions();
      }
    };
    store.sniperWsFutures.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.e === "aggTrade" || data.e === "24hrMiniTicker") {
        if (typeof window.renderRealtimeRow === "function") {
          const tickerKey = data.s || "";
          window.renderRealtimeRow(tickerKey, data, {
            exchange: "binance",
            market: "futures",
            quote: "USDT",
          });
        }
      }
    };
    store.sniperWsFutures.onclose = () => {
      setTimeout(initBinanceFuturesSniperSocket, 1000);
    };
  }
}
