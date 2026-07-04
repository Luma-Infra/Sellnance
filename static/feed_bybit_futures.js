// feed_bybit_futures.js
import { store } from "./_store.js";

let bybitFuturesRadarWs = null;
const _bybitFuturesThrottleMap = new Map(); // 500ms 쓰로틀: 체결 건별 DOM 폭주 방지

export function startBybitFuturesFeed() {
  if (bybitFuturesRadarWs && bybitFuturesRadarWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  bybitFuturesRadarWs = new WebSocket("wss://stream.bybit.com/v5/public/linear");

  bybitFuturesRadarWs.onopen = () => {
    const futuresSymbols = store.currentTableData
      .filter((row) => (row.Listed_Exchanges?.includes("BYBIT_FUTURES") || row.Bybit_Futures) && row.Spot_Only !== "O")
      .map((row) => `publicTrade.${(row.Bybit_Symbol || row.Symbol || "").toUpperCase()}USDT`);

    if (futuresSymbols.length === 0) return;

    try {
      bybitFuturesRadarWs.send(
        JSON.stringify({
          op: "subscribe",
          args: futuresSymbols,
        })
      );
    } catch (e) {
      console.error("Bybit Futures Radar subscribe error:", e);
    }
  };

  bybitFuturesRadarWs.onmessage = (event) => {
    const res = JSON.parse(event.data);
    if (!res.data || !res.topic.startsWith("publicTrade.")) return;

    res.data.forEach((trade) => {
      const ticker = res.topic.replace("publicTrade.", ""); // SymbolUSDT
      const pureSym = ticker.replace("USDT", "");
      const bufferKey = ticker + "_FUTURES"; // Bybit futures key
      const newPrice = parseFloat(trade.p);
      if (isNaN(newPrice)) return;

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[bufferKey] = { c: newPrice };

      // 🚀 [HTS Bybit Futures 전용 격리 적재] 오직 Bybit 선물 가격 변수만 정밀 대입 (O(1) 해시 색인 탐색)
      const row = store.tickerRowMap.get(bufferKey) || store.tickerRowMap.get(ticker) || store.tickerRowMap.get(pureSym);
      if (row) {
        row.Bybit_Price_Futures = newPrice;
      }

      // 실시간 렌더 큐 등록 (500ms 쓰로틀 적용)
      if (
        store.visibleSymbols &&
        (store.visibleSymbols.has(pureSym) || store.visibleSymbols.has(ticker))
      ) {
        const now = Date.now();
        const lastT = _bybitFuturesThrottleMap.get(ticker) || 0;
        if (now - lastT < 500) return;
        _bybitFuturesThrottleMap.set(ticker, now);

        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(ticker, { s: ticker, c: newPrice, e: "trade" }, true);
        }
      }
    });
  };

  bybitFuturesRadarWs.onclose = () => {
    setTimeout(startBybitFuturesFeed, 3000);
  };
}
