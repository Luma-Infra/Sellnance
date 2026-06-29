// feed_binance_spot.js
import { store } from "./_store.js";
import { getMultiplier } from "./chart_utils.js";

let binanceSpotRadarWs = null;

export function startBinanceSpotFeed() {
  if (binanceSpotRadarWs && binanceSpotRadarWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  binanceSpotRadarWs = new WebSocket("wss://stream.binance.com:9443/ws");
  store.binanceRadarWs = binanceSpotRadarWs; // Backward compatibility with store

  binanceSpotRadarWs.onopen = () => {
    try {
      binanceSpotRadarWs.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: ["!ticker@arr"],
          id: 888,
        })
      );
    } catch (e) {
      console.error("Binance Spot Radar subscribe error:", e);
    }
  };

  binanceSpotRadarWs.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!Array.isArray(data)) return;

    data.forEach((ticker) => {
      const pureSymbol = ticker.s.replace("USDT", "");
      const bufferKey = ticker.s; // Spot key: SymbolUSDT
      
      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[bufferKey] = ticker;

      // 🚀 [HTS Spot 전용 격리 적재] 오직 현물 가격 및 거래량 변수만 정밀 주입 (O(1) 해시 색인 탐색)
      const row = store.tickerRowMap.get(ticker.s) || store.tickerRowMap.get(pureSymbol);
      if (row) {
        if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
          row.Binance_Price_Spot = parseFloat(ticker.c);
          row.Binance_Vol_Spot = parseFloat(ticker.q);
        }
      }

      // 화면에 노출 중일 경우 렌더링 큐 위임 (setTimeout 오버헤드 제거)
      if (
        store.visibleSymbols &&
        (store.visibleSymbols.has(pureSymbol) || store.visibleSymbols.has(ticker.s))
      ) {
        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(ticker.s, ticker, false);
        }
      }
    });
  };

  binanceSpotRadarWs.onclose = () => {
    setTimeout(startBinanceSpotFeed, 3000);
  };
}

// 🎯 테이블용 바이낸스 스나이퍼 소켓 초기화
export function initBinanceSniperSocket() {
  if (store.sniperWs && store.sniperWs.readyState === WebSocket.OPEN) {
    return;
  }

  const wsUrl =
    store.currentMarket === "FUTURES"
      ? "wss://fstream.binance.com/market/ws"
      : "wss://stream.binance.com:9443/ws";

  store.sniperWs = new WebSocket(wsUrl);
  store.sniperWs.onopen = () => {
    if (typeof window.syncSniperSubscriptions === "function") {
      window.syncSniperSubscriptions();
    }
  };

  store.sniperWs.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.e === "aggTrade" || data.e === "24hrTicker") {
      if (typeof window.renderRealtimeRow === "function") {
        const isFutures = store.currentMarket === "FUTURES";
        window.renderRealtimeRow(data.s, data, isFutures);
      }
    }
  };

  store.sniperWs.onclose = () => {
    setTimeout(initBinanceSniperSocket, 1000);
  };
}

window.initBinanceSniperSocket = initBinanceSniperSocket;
