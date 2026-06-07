// stream_table.js
import { store, CONFIG } from "./_store.js";
import { updateVisibleSymbols } from "./table_render.js";

// 🎯 개별 스트림 스나이퍼 소켓 초기화 (바이낸스 + 업비트 상시 멀티 파이프라인 가동)
export function initSniperSocket() {
  if (!store.sniperWs || store.sniperWs.readyState !== WebSocket.OPEN) {
    const wsUrl =
      store.currentMarket === "FUTURES"
        ? "wss://fstream.binance.com/market/ws"
        : "wss://stream.binance.com:9443/ws";

    store.sniperWs = new WebSocket(wsUrl);
    store.sniperWs.onopen = () => {
      console.log("🎯 바이낸스 스나이퍼 엔진 가동: 보이는 놈들 정밀 타격 시작");
      syncSniperSubscriptions();
    };
    const SNIPER_ROUTER = {
      "24hrTicker": renderSniperPrice,
      aggTrade: renderSniperPrice,
    };
    store.sniperWs.onmessage = (e) => {
      const data = JSON.parse(e.data);
      SNIPER_ROUTER[data.e]?.(data);
    };
    store.sniperWs.onclose = () => {
      setTimeout(initSniperSocket, CONFIG.UI_UPDATE_INTERVAL);
    };
  }

  if (
    !store.upbitSniperWs ||
    store.upbitSniperWs.readyState !== WebSocket.OPEN
  ) {
    store.upbitSniperWs = new WebSocket("wss://api.upbit.com/websocket/v1");
    store.upbitSniperWs.onopen = () => {
      console.log("🎯 업비트 스나이퍼 엔진 가동: 김치 코인들 정밀 타격 시작");
      syncSniperSubscriptions();
    };
    store.upbitSniperWs.onmessage = async (e) => {
      try {
        const text = typeof e.data === "string" ? e.data : await e.data.text();
        const res = JSON.parse(text);
        const pureSym = res.code.replace("KRW-", "");
        const krwTicker = pureSym + "KRW"; // 테이블의 업비트 코인 Ticker 표기법 (예: BTCKRW)
        const newPriceKrw = parseFloat(res.trade_price);

        const allSource =
          store.originalTableData || store.currentTableData || [];
        const row = allSource.find(
          (r) =>
            r.Ticker === krwTicker ||
            r.DisplayTicker === pureSym ||
            r.Symbol === pureSym,
        );
        if (row) {
          const rate = store.marketDataMap?.krw_usd_rate || 0;
          row.Price_Raw = newPriceKrw / rate; // 달러 환산 가격
          if (row.utc0_open_Raw) {
            const openPrice = parseFloat(row.utc0_open_Raw);
            row.Change_Today_Raw =
              ((row.Price_Raw - openPrice) / openPrice) * 100;
          }
        }

        const normalizedData = {
          s: krwTicker,
          c: newPriceKrw,
          P: res.signed_change_rate * 100,
          isUpbitRealtime: true,
        };
        renderSniperPrice(normalizedData);
      } catch (err) {
        console.error("Upbit sniper parse error:", err);
      }
    };
    store.upbitSniperWs.onclose = () => {
      setTimeout(initSniperSocket, CONFIG.UI_UPDATE_INTERVAL);
    };
  }
}

// 🔄 [핵심] visibleSymbols와 연동하여 바이낸스/업비트 구독 리스트 동시 동기화
export function syncSniperSubscriptions() {
  if (!store.visibleSymbols) return;
  const getNextId = () => Math.floor(Date.now() + Math.random() * 1000);

  const currentVisibleBinance = [];
  const currentVisibleUpbit = [];
  const allSource = store.originalTableData || store.currentTableData || [];

  store.visibleSymbols.forEach((sym) => {
    const row = allSource.find(
      (r) => r.Ticker === sym || r.DisplayTicker === sym || r.Symbol === sym,
    );
    if (!row) return;

    let bTicker =
      row.Exact_Futures ||
      (row.Ticker && !row.Ticker.endsWith("KRW")
        ? row.Ticker.replace("USDT", "")
        : null);
    if (!bTicker && row.Exact_Spot) bTicker = row.Exact_Spot;
    if (bTicker) {
      currentVisibleBinance.push(`${bTicker.toLowerCase()}usdt@aggTrade`);
    }

    let uTicker =
      row.Upbit_Symbol ||
      (row.Ticker && row.Ticker.endsWith("KRW")
        ? row.Ticker.replace("KRW", "")
        : null);
    if (!uTicker && row.Symbol) uTicker = row.Symbol;
    if (uTicker) {
      currentVisibleUpbit.push(`KRW-${uTicker.toUpperCase()}`);
    }
  });

  if (store.sniperWs && store.sniperWs.readyState === WebSocket.OPEN) {
    const toSub = currentVisibleBinance.filter((s) => !store.activeSubs.has(s));
    if (toSub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() }),
      );
      toSub.forEach((s) => store.activeSubs.add(s));
    }
    const toUnsub = Array.from(store.activeSubs).filter(
      (s) => !currentVisibleBinance.includes(s),
    );
    if (toUnsub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: toUnsub,
          id: getNextId(),
        }),
      );
      toUnsub.forEach((s) => store.activeSubs.delete(s));
    }
  }

  if (
    store.upbitSniperWs &&
    store.upbitSniperWs.readyState === WebSocket.OPEN
  ) {
    const uniqueUpbitCodes = Array.from(new Set(currentVisibleUpbit));
    if (uniqueUpbitCodes.length > 0) {
      try {
        store.upbitSniperWs.send(
          JSON.stringify([
            { ticket: "upbit_table_sniper_" + getNextId() },
            { type: "ticker", codes: uniqueUpbitCodes },
          ]),
        );
      } catch (e) { }
    }
  }
}

function renderSniperPrice(data) {
  if (typeof window.renderRealtimeRow === "function") {
    window.renderRealtimeRow(data.s, data);
  }
}

export function refreshSniperTarget() {
  if (typeof updateVisibleSymbols === "function") updateVisibleSymbols();
  if (typeof syncSniperSubscriptions === "function") syncSniperSubscriptions();
}

export function startBinanceMarketRadar() {
  if (
    !store.binanceRadarWs ||
    store.binanceRadarWs.readyState === WebSocket.CLOSED
  ) {
    store.binanceRadarWs = new WebSocket("wss://stream.binance.com:9443/ws");
    store.binanceRadarWs.onopen = () => {
      try {
        store.binanceRadarWs.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: ["!ticker@arr"],
            id: 888,
          }),
        );
      } catch (e) {
        console.error("Binance Spot Radar subscribe error:", e);
      }
    };
    store.binanceRadarWs.onmessage = handleBinanceRadarMessage;
    store.binanceRadarWs.onclose = () => {
      setTimeout(startBinanceMarketRadar, 3000);
    };
  }

  if (
    !store.binanceFuturesRadarWs ||
    store.binanceFuturesRadarWs.readyState === WebSocket.CLOSED
  ) {
    store.binanceFuturesRadarWs = new WebSocket(
      "wss://fstream.binance.com/market/ws",
    );
    store.binanceFuturesRadarWs.onopen = () => {
      try {
        store.binanceFuturesRadarWs.send(
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
    store.binanceFuturesRadarWs.onmessage = handleBinanceRadarMessage;
    store.binanceFuturesRadarWs.onclose = () => {
      setTimeout(startBinanceMarketRadar, 3000);
    };
  }
}

function handleBinanceRadarMessage(event) {
  const data = JSON.parse(event.data);
  if (!Array.isArray(data)) return;

  const isFutures = event.target === store.binanceFuturesRadarWs;

  data.forEach((ticker) => {
    const pureSymbol = ticker.s.replace("USDT", "");
    const bufferKey = ticker.s + (isFutures ? "_FUTURES" : "");
    store.tickerBuffer[bufferKey] = ticker;

    if (
      store.visibleSymbols &&
      (store.visibleSymbols.has(pureSymbol) ||
        store.visibleSymbols.has(ticker.s))
    ) {
      const delay = Math.floor(Math.random() * 600);
      setTimeout(
        () =>
          requestAnimationFrame(() => {
            if (typeof window.renderRealtimeRow === "function") {
              window.renderRealtimeRow(ticker.s, ticker, isFutures);
            }
          }),
        delay,
      );
    }
  });
}

export function startUpbitMarketRadar() {
  if (store.upbitRadarWs) store.upbitRadarWs.close();
  store.upbitRadarWs = new WebSocket("wss://api.upbit.com/websocket/v1");
  store.upbitRadarWs.binaryType = "arraybuffer";
  store.upbitRadarWs.onopen = () => {
    const allUpbitCodes = store.currentTableData
      .filter((row) => row.Upbit === "O" && row.Symbol)
      .map((row) => `KRW-${row.Symbol}`);
    if (allUpbitCodes.length === 0) return;
    store.upbitRadarWs.send(
      JSON.stringify([
        { ticket: "UNIQUE_TICKET" },
        { type: "ticker", codes: allUpbitCodes },
      ]),
    );
  };
  const decoder = new TextDecoder("utf-8");
  store.upbitRadarWs.onmessage = (event) => {
    const ticker = JSON.parse(decoder.decode(event.data));
    const pureSym = ticker.code.replace("KRW-", "");
    const normalizedTicker = {
      s: pureSym,
      c: ticker.trade_price,
      P: ticker.signed_change_rate * 100,
      q_upbit: ticker.acc_trade_price_24h,
    };
    store.tickerBuffer[ticker.code] = normalizedTicker;
    const hasSymbol =
      store.visibleSymbols.has(pureSym) ||
      store.visibleSymbols.has(pureSym + "KRW") ||
      store.visibleSymbols.has(ticker.code);
    if (store.visibleSymbols && hasSymbol) {
      requestAnimationFrame(() => {
        if (typeof window.renderRealtimeRow === "function") {
          window.renderRealtimeRow(ticker.code, normalizedTicker);
        }
      });
    }
  };
  store.upbitRadarWs.onclose = () => setTimeout(startUpbitMarketRadar, 3000);
}

// 윈도우 전역에 내보내기
window.initSniperSocket = initSniperSocket;
window.syncSniperSubscriptions = syncSniperSubscriptions;
window.refreshSniperTarget = refreshSniperTarget;
window.startBinanceMarketRadar = startBinanceMarketRadar;
window.startUpbitMarketRadar = startUpbitMarketRadar;
