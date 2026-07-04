// feed_upbit.js
import { store } from "./_store.js";

let upbitRadarWs = null;
let upbitRadarRetryDelay = 3000;

export function startUpbitFeed() {
  if (upbitRadarWs && upbitRadarWs.readyState !== WebSocket.CLOSED) {
    return;
  }

  upbitRadarWs = new WebSocket("wss://api.upbit.com/websocket/v1");
  upbitRadarWs.binaryType = "arraybuffer";
  store.upbitRadarWs = upbitRadarWs;

  upbitRadarWs.onclose = () => {
    const currentDelay = upbitRadarRetryDelay;
    upbitRadarRetryDelay = Math.min(60000, Math.floor(upbitRadarRetryDelay * 1.5));
    setTimeout(startUpbitFeed, currentDelay);
  };

  upbitRadarWs.onerror = () => { };

  upbitRadarWs.onopen = () => {
    upbitRadarRetryDelay = 3000;
    const allUpbitCodes = store.currentTableData
      .filter((row) => row.Upbit === "O" && row.Symbol)
      .map((row) => `KRW-${row.Symbol}`);
    if (allUpbitCodes.length === 0) return;

    upbitRadarWs.send(
      JSON.stringify([
        { ticket: "UNIQUE_TICKET" },
        { type: "ticker", codes: allUpbitCodes },
      ])
    );
  };

  const decoder = new TextDecoder("utf-8");
  upbitRadarWs.onmessage = (event) => {
    const ticker = JSON.parse(decoder.decode(event.data));
    const pureSym = ticker.code.replace("KRW-", "");
    const krwTicker = pureSym + "KRW";

    // O(1) 해시 탐색 (이전: allSource.find() O(N) 선형 탐색 → 컵닙음)
    const localRow = store.tickerRowMap?.get(krwTicker) || store.tickerRowMap?.get(pureSym);
    const matchedUid = (localRow && localRow.Upbit === "O") ? localRow.UID : "";

    const normalizedTicker = {
      s: krwTicker,
      c: ticker.trade_price,
      P: ticker.signed_change_rate * 100,
      q_upbit: ticker.acc_trade_price_24h,
      isUpbitRealtime: true,
      UID: matchedUid,
    };

    if (!store.tickerBuffer) store.tickerBuffer = {};
    store.tickerBuffer[ticker.code] = normalizedTicker;

    if (localRow && localRow.Upbit === "O") {
      localRow.Upbit_Price = parseFloat(ticker.trade_price);
      localRow.Price_KRW = parseFloat(ticker.trade_price);
    }

    const hasSymbol =
      store.visibleSymbols.has(pureSym) ||
      store.visibleSymbols.has(krwTicker) ||
      store.visibleSymbols.has(ticker.code);

    if (hasSymbol) {
      if (typeof window.renderRealtimeRow === "function") {
        window.renderRealtimeRow(ticker.code, normalizedTicker, false);
      }
    }
  };
}

// 🎯 업비트 테이블 노출용 Sniper 소켓
export function initUpbitSniperSocket() {
  if (store.upbitSniperWs && store.upbitSniperWs.readyState === WebSocket.OPEN) {
    return;
  }

  store.upbitSniperWs = new WebSocket("wss://api.upbit.com/websocket/v1");
  store.upbitSniperWs.onopen = () => {
    if (typeof window.syncSniperSubscriptions === "function") {
      window.syncSniperSubscriptions();
    }
  };

  store.upbitSniperWs.onmessage = async (e) => {
    try {
      const text = typeof e.data === "string" ? e.data : await e.data.text();
      const res = JSON.parse(text);
      if (!res || !res.code) return;
      const pureSym = res.code.replace("KRW-", "");
      const krwTicker = pureSym + "KRW";
      const newPriceKrw = parseFloat(res.trade_price);

      // O(1) 해시 탐색 (이전: allSource.find() O(N) 선형 탐색 → 컵닙음)
      const allSource = store.originalTableData || store.currentTableData || [];
      const row = store.tickerRowMap?.get(krwTicker) || store.tickerRowMap?.get(pureSym);
      if (row && row.Upbit === "O") {
        const rate = store.marketDataMap?.krw_usd_rate || 0;
        row.Price_Raw = newPriceKrw / rate;
        if (row.utc0_open_Raw) {
          const openPrice = parseFloat(row.utc0_open_Raw);
          row.Change_Today_Raw = ((row.Price_Raw - openPrice) / openPrice) * 100;
        }
      }

      const normalizedData = {
        s: krwTicker,
        c: newPriceKrw,
        P: res.signed_change_rate * 100,
        isUpbitRealtime: true,
      };

      if (typeof window.renderRealtimeRow === "function") {
        const isFutures = store.currentMarket === "FUTURES";
        window.renderRealtimeRow(normalizedData.s, normalizedData, isFutures);
      }
    } catch (err) {
      console.error("Upbit sniper parse error:", err);
    }
  };

  store.upbitSniperWs.onclose = () => {
    setTimeout(initUpbitSniperSocket, 1000);
  };
}

window.initUpbitSniperSocket = initUpbitSniperSocket;
