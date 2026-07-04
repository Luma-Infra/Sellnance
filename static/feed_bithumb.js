// feed_bithumb.js
import { store } from "./_store.js";

let bithumbRadarWs = null;

export function startBithumbFeed() {
  if (bithumbRadarWs && bithumbRadarWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  // 빗썸은 테이블 스나이퍼에 업비트/바이낸스 채널 위주로 유입되어, 필요시 연결을 활성화합니다.
  bithumbRadarWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
  store.bithumbRadarWs = bithumbRadarWs; // Backward compatibility

  bithumbRadarWs.onopen = () => {
    const symbols = store.currentTableData
      .filter((row) => row.Listed_Exchanges?.includes("BITHUMB") || row.Bithumb_Symbol)
      .map((row) => `${(row.Bithumb_Symbol || row.Symbol || "").toUpperCase()}_KRW`);

    if (symbols.length === 0) return;

    try {
      bithumbRadarWs.send(
        JSON.stringify({
          type: "transaction",
          symbols: symbols,
        })
      );
    } catch (e) {
      console.error("Bithumb Radar subscribe error:", e);
    }
  };

  bithumbRadarWs.onmessage = (event) => {
    const res = JSON.parse(event.data);
    if (res.type !== "transaction" || !res.content?.list) return;

    res.content.list.forEach((trade) => {
      const pureSym = trade.symbol.replace("_KRW", "").toUpperCase();
      const tickSymbol = `${pureSym}_KRW`;
      const newPrice = parseFloat(trade.contPrice);
      if (isNaN(newPrice)) return;

      if (!store.tickerBuffer) store.tickerBuffer = {};
      store.tickerBuffer[tickSymbol] = {
        s: tickSymbol,
        c: newPrice,
        isBithumbRealtime: true,
      };

      // 🚀 [HTS Bithumb 전용 격리 적재] 오직 빗썸 가격 변수만 정밀 대입 (O(1) 해시 색인 탐색)
      const row = store.tickerRowMap.get(tickSymbol) || store.tickerRowMap.get(pureSym);
      if (row && (row.Bithumb === "O" || row.Listed_Exchanges?.includes("BITHUMB") || row.Bithumb_Symbol)) {
        row.Bithumb_Price = newPrice;
        // 업비트에 상장되지 않은 빗썸 단독 상장 코인인 경우에만 Price_KRW로 전파 허용
        const exList = (row.Listed_Exchanges || []).map((e) => e.toUpperCase());
        const hasUpbit = row.Upbit === "O" || exList.includes("UPBIT") || !!row.Upbit_Symbol;
        if (!hasUpbit) {
          row.Price_KRW = newPrice;
        }
      }

      const hasSymbol =
        store.visibleSymbols.has(pureSym) ||
        store.visibleSymbols.has(tickSymbol);

      if (hasSymbol) {
        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(tickSymbol, { c: newPrice, isBithumbRealtime: true }, false);
        }
      }
    });
  };

  bithumbRadarWs.onclose = () => {
    setTimeout(startBithumbFeed, 3000);
  };
}
