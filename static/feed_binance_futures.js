import { store } from "./_store.js";
import { getMultiplier, getPureBase } from "./chart_utils.js";

let binanceFuturesRadarWs = null;

export function startBinanceFuturesFeed() {
  if (binanceFuturesRadarWs && binanceFuturesRadarWs.readyState !== WebSocket.CLOSED) {
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
        })
      );
    } catch (e) {
      console.error("Binance Futures Radar subscribe error:", e);
    }
  };

  binanceFuturesRadarWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!Array.isArray(data)) return;

    data.forEach((ticker) => {
      const pureSymbol = ticker.s.replace("USDT", "");
      const baseSym = getPureBase(pureSymbol);
      const bufferKey = ticker.s + "_FUTURES"; // Futures key: SymbolUSDT_FUTURES

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[bufferKey] = ticker;

      // 🚀 [HTS Futures 전용 격리 적재] 오직 선물 가격 및 거래량 변수만 정밀 주입 (O(1) 해시 색인 탐색 + Base 추출 연동)
      const row = store.tickerRowMap.get(ticker.s + "_FUTURES") ||
        store.tickerRowMap.get(ticker.s) ||
        store.tickerRowMap.get(pureSymbol) ||
        (baseSym ? store.tickerRowMap.get(baseSym) : null);

      if (row) {
        if (row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          row.Binance_Price_Futures = parseFloat(ticker.c);
          row.Binance_Vol_Futures = parseFloat(ticker.q);
          if (ticker.P !== undefined) row.Change_24h_Futures = parseFloat(ticker.P);
          if (!row.Exact_Futures) {
            row.Exact_Futures = pureSymbol;
          }
        }
      }

      // 화면 노출 대상 행 렌더링 위임
      if (
        store.visibleSymbols &&
        (store.visibleSymbols.has(pureSymbol) || store.visibleSymbols.has(ticker.s) || (baseSym && store.visibleSymbols.has(baseSym)))
      ) {
        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(ticker.s, ticker, true);
        }
      }
    });
  };

  binanceFuturesRadarWs.onclose = () => {
    setTimeout(startBinanceFuturesFeed, 3000);
  };
}

// 🎯 테이블용 바이낸스 선물 스나이퍼 소켓 초기화
export function initBinanceFuturesSniperSocket() {
  /*
  // [기존 코드 보존] 마켓 모드에 따라 선물 소켓을 개폐하던 기존 로직
  // (BINANCE 또는 SPOT 탭 진입 시 선물 전용 코인의 실시간 시세가 차단되던 이슈로 인해 상시 연결로 완화)
  const currentMarket = store.currentMarket || "ALL";
  const needFutures = currentMarket === "ALL" || currentMarket === "FUTURES";
  if (needFutures) {
    if (!store.sniperWsFutures || store.sniperWsFutures.readyState === WebSocket.CLOSED || store.sniperWsFutures.readyState === WebSocket.CLOSING) {
      store.sniperWsFutures = new WebSocket("wss://fstream.binance.com/market/ws");
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
            window.renderRealtimeRow(tickerKey, data, true);
          }
        }
      };
      store.sniperWsFutures.onclose = () => {
        setTimeout(initBinanceFuturesSniperSocket, 1000);
      };
    }
  } else {
    if (store.sniperWsFutures) {
      try { store.sniperWsFutures.close(); } catch (e) { }
      store.sniperWsFutures = null;
    }
  }
  */

  // 🚀 [조건 완화] 화면에 노출된 코인(visibleSymbols)만 타겟 구독하므로 소켓을 항상 열어두어 선물 전용 코인도 실시간 갱신
  if (!store.sniperWsFutures || store.sniperWsFutures.readyState === WebSocket.CLOSED || store.sniperWsFutures.readyState === WebSocket.CLOSING) {
    store.sniperWsFutures = new WebSocket("wss://fstream.binance.com/market/ws");
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
          window.renderRealtimeRow(tickerKey, data, true);
        }
      }
    };
    store.sniperWsFutures.onclose = () => {
      setTimeout(initBinanceFuturesSniperSocket, 1000);
    };
  }
}

window.initBinanceFuturesSniperSocket = initBinanceFuturesSniperSocket;
