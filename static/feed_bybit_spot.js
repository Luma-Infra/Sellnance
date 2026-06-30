// feed_bybit_spot.js
import { store } from "./_store.js";

let bybitSpotRadarWs = null;

export function startBybitSpotFeed() {
  if (bybitSpotRadarWs && bybitSpotRadarWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  bybitSpotRadarWs = new WebSocket("wss://stream.bybit.com/v5/public/spot");

  bybitSpotRadarWs.onopen = () => {
    // 가시적인 Bybit 현물 구독 대상 선별
    const spotSymbols = store.currentTableData
      .filter((row) => (row.Listed_Exchanges?.includes("BYBIT") || row.Bybit) && row.Spot_Only === "O")
      .map((row) => `publicTrade.${(row.Bybit_Symbol || row.Symbol || "").toUpperCase()}USDT`);

    if (spotSymbols.length === 0) return;

    try {
      bybitSpotRadarWs.send(
        JSON.stringify({
          op: "subscribe",
          args: spotSymbols,
        })
      );
    } catch (e) {
      console.error("Bybit Spot Radar subscribe error:", e);
    }
  };

  bybitSpotRadarWs.onmessage = (event) => {
    const res = JSON.parse(event.data);
    if (!res.data || !res.topic.startsWith("publicTrade.")) return;

    res.data.forEach((trade) => {
      const ticker = res.topic.replace("publicTrade.", ""); // SymbolUSDT
      const pureSym = ticker.replace("USDT", "");
      const newPrice = parseFloat(trade.p);
      if (isNaN(newPrice)) return;

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[ticker] = { c: newPrice };

      // 🚀 [HTS Bybit Spot 전용 격리 적재] 오직 Bybit 현물 가격 변수만 정밀 대입 (O(1) 해시 색인 탐색)
      const row = store.tickerRowMap.get(ticker) || store.tickerRowMap.get(pureSym);
      if (row) {
        row.Bybit_Price_Spot = newPrice;
      }

      // 실시간 테이블 렌더 큐 위임
      if (
        store.visibleSymbols &&
        (store.visibleSymbols.has(pureSym) || store.visibleSymbols.has(ticker))
      ) {
        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(ticker, { c: newPrice }, false);
        }
      }
    });
  };

  bybitSpotRadarWs.onclose = () => {
    setTimeout(startBybitSpotFeed, 3000);
  };
}
