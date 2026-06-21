// static/orderbook.js
import { store } from "./_store.js";
import { formatSmartPrice } from "./chart_utils.js";

let obState = {
  asks: [],
  bids: [],
  precisionModifier: 0,
  isRendering: false,
};

export function initOrderbookDOM() {
  const asksContainer = document.getElementById("orderbook-asks");
  const bidsContainer = document.getElementById("orderbook-bids");
  if (!asksContainer || !bidsContainer) return;

  asksContainer.innerHTML = "";
  bidsContainer.innerHTML = "";

  const askFragment = document.createDocumentFragment();
  const bidFragment = document.createDocumentFragment();

  Array.from({ length: 50 }).forEach((_, i) => {
    // Asks
    const askRow = document.createElement("div");
    askRow.id = `ob-ask-${i}`;
    askRow.className =
      "relative flex items-center justify-between text-[10px] h-5 font-tempTestDss px-1.5 z-10 hidden hover:bg-theme-text/5 cursor-pointer transition-colors";
    askRow.innerHTML = `
    <div id="ob-ask-bg-${i}" class="absolute right-0 top-0 bottom-0 bg-theme-down/15 will-change-[width] z-[-1] transition-all duration-[50ms]" style="width: 0%;"></div>
    <span id="ob-ask-price-${i}" class="text-theme-down font-medium w-[35%] text-left tracking-tighter"></span>
    <span id="ob-ask-size-${i}" class="text-theme-text w-[30%] text-right opacity-90 tracking-tighter"></span>
    <span id="ob-ask-total-${i}" class="text-theme-text w-[35%] text-right opacity-50 tracking-tighter"></span>
  `;
    askFragment.appendChild(askRow);

    // Bids
    const bidRow = document.createElement("div");
    bidRow.id = `ob-bid-${i}`;
    bidRow.className =
      "relative flex items-center justify-between text-[10px] h-5 font-tempTestDss px-1.5 z-10 hidden hover:bg-theme-text/5 cursor-pointer transition-colors";
    bidRow.innerHTML = `
    <div id="ob-bid-bg-${i}" class="absolute right-0 top-0 bottom-0 bg-theme-up/15 will-change-[width] z-[-1] transition-all duration-[50ms]" style="width: 0%;"></div>
    <span id="ob-bid-price-${i}" class="text-theme-up font-medium w-[35%] text-left tracking-tighter"></span>
    <span id="ob-bid-size-${i}" class="text-theme-text w-[30%] text-right opacity-90 tracking-tighter"></span>
    <span id="ob-bid-total-${i}" class="text-theme-text w-[35%] text-right opacity-50 tracking-tighter"></span>
  `;
    bidFragment.appendChild(bidRow);
  });

  // 마지막에 각각 한 번씩만 DOM에 추가하여 Reflow 최소화
  asksContainer.appendChild(askFragment);
  bidsContainer.appendChild(bidFragment);
}

export function toggleOrderbook() {
  const panel = document.getElementById("orderbook-panel");
  const btn = document.getElementById("toggle-orderbook-btn");
  if (!panel) return;
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    panel.classList.add("flex");
    if (btn) btn.innerText = "호가창 닫기";
    startOrderbookStream(store.currentAsset, store.currentMarket);
  } else {
    panel.classList.add("hidden");
    panel.classList.remove("flex");
    if (btn) btn.innerText = "호가창 열기";
    stopOrderbookStream();
  }

  // Trigger chart resize
  setTimeout(() => {
    if (typeof window.syncPriceScaleWidths === "function")
      window.syncPriceScaleWidths();
    // if (store.chart) store.chart.timeScale().fitContent();
  }, 100);
}

export function changeOrderbookPrecision(delta) {
  obState.precisionModifier += delta;

  const baseP = store.getPrecision(store.currentAsset);
  const targetP = baseP + obState.precisionModifier;

  // Limit precision bounds (-4 for KRW 10000 grouping, 8 for max decimals)
  if (targetP < -4) {
    obState.precisionModifier = -4 - baseP;
  }
  if (targetP > 8) {
    obState.precisionModifier = 8 - baseP;
  }

  renderOrderbook();
}

export function resetOrderbookPrecision() {
  obState.precisionModifier = 0;
  renderOrderbook();
}

export function stopOrderbookStream() {
  if (store.orderbookWs) {
    store.orderbookWs.close();
    store.orderbookWs = null;
  }
  obState.asks = [];
  obState.bids = [];
  renderOrderbook();
}

export function startOrderbookStream(symbol, market) {
  stopOrderbookStream();
  const panel = document.getElementById("orderbook-panel");
  if (!panel || panel.classList.contains("hidden")) return;

  obState.precisionModifier = 0;

  // 🚀 [안전 가드] symbol 또는 market이 전달되지 않았을 시 스토어 기본값으로 폴백 처리
  if (!symbol) {
    symbol = store.currentSelectedSymbol || store.currentAsset || "";
  }
  if (!symbol) return;

  if (!market) {
    market = store.currentMarket || "UPBIT";
  }

  // 🚀 [버그 픽스] 테이블에서 "BTCUSDT" 또는 "BTCKRW"가 넘어오더라도 순수 심볼("BTC")만 추출하여 소켓 경로 중복 오류 방지
  const baseSym = symbol
    .toUpperCase()
    .replace("USDT", "")
    .replace("KRW-", "")
    .replace("KRW", "");

  if (market === "UPBIT") {
    const rawSym = `KRW-${baseSym}`;
    store.orderbookWs = new WebSocket("wss://api.upbit.com/websocket/v1");
    store.orderbookWs.binaryType = "blob";
    store.orderbookWs.onopen = () => {
      store.orderbookWs.send(
        JSON.stringify([
          { ticket: "ob_" + Date.now() },
          { type: "orderbook", codes: [rawSym] },
          { format: "SIMPLE" },
        ]),
      );
    };
    store.orderbookWs.onmessage = async (e) => {
      let data = e.data;
      if (e.data instanceof Blob) {
        data = await e.data.text();
      }
      const res = JSON.parse(data);
      if (res.ty === "orderbook" && res.obu) {
        obState.asks = res.obu
          .map((u) => ({ price: u.ap, size: u.as }))
          .reverse();
        obState.bids = res.obu.map((u) => ({ price: u.bp, size: u.bs }));
        scheduleRender();
      }
    };
  } else if (market === "BITHUMB") {
    // 빗썸 호가창 생략 시 B-SPOT으로 폴백하거나 지원 안함 처리 가능
  } else if (market === "BYBIT") {
    // Bybit linear
    store.orderbookWs = new WebSocket(
      "wss://stream.bybit.com/v5/public/linear",
    );
    const streamSym = baseSym + "USDT";
    store.orderbookWs.onopen = () => {
      store.orderbookWs.send(
        JSON.stringify({
          op: "subscribe",
          args: [`orderbook.50.${streamSym}`],
        }),
      );
    };
    store.orderbookWs.onmessage = (e) => {
      const res = JSON.parse(e.data);
      if (res.topic && res.data) {
        if (res.data.a && res.data.a.length) {
          // Bybit delta processing is complex (requires maintaining state), for simplicity we do snapshot if available
          // (Assuming push snapshot. If delta, need full depth engine. For now, fallback to basic parsing)
        }
      }
    };
  } else {
    // Binance Spot / Futures
    const isFutures = market === "FUTURES";
    const wsBase = isFutures
      ? "wss://fstream.binance.com/ws"
      : "wss://stream.binance.com:9443/ws";
    const streamSym = baseSym.toLowerCase() + "usdt"; // Cleanly formulated endpoint

    // Depth stream returns asks and bids natively
    store.orderbookWs = new WebSocket(`${wsBase}/${streamSym}@depth20@100ms`);
    store.orderbookWs.onmessage = (e) => {
      const res = JSON.parse(e.data);
      const asksArr = res.asks || res.a;
      const bidsArr = res.bids || res.b;
      if (asksArr && bidsArr) {
        obState.asks = asksArr
          .map((a) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }))
          .reverse();
        obState.bids = bidsArr.map((b) => ({
          price: parseFloat(b[0]),
          size: parseFloat(b[1]),
        }));
        scheduleRender();
      }
    };
  }
}

function scheduleRender() {
  if (store.blockOrderbook) {
    const nowTime = Date.now();
    if (!window._lastObRenderTime) window._lastObRenderTime = 0;
    if (nowTime - window._lastObRenderTime < 250) {
      return;
    }
    window._lastObRenderTime = nowTime;
  }
  if (!obState.isRendering) {
    obState.isRendering = true;
    requestAnimationFrame(() => {
      renderOrderbook();
      obState.isRendering = false;
    });
  }
}

function renderOrderbook() {
  const baseP = store.getPrecision(store.currentAsset);
  const p = baseP + obState.precisionModifier;
  const groupSize = Math.pow(10, -p);

  const precisionLabel = document.getElementById("orderbook-precision-label");
  if (precisionLabel)
    precisionLabel.innerText =
      groupSize >= 1 ? groupSize.toString() : groupSize.toFixed(Math.max(0, p));

  const priceEl = document.getElementById("orderbook-current-price");
  if (priceEl && obState.asks.length > 0 && obState.bids.length > 0) {
    const askP = obState.asks[obState.asks.length - 1].price;
    const bidP = obState.bids[0].price;
    const mid = (askP + bidP) / 2;
    priceEl.innerText = formatSmartPrice(mid, p);
  }

  // 병합 헬퍼 (초고속 연산)
  const groupData = (data, isAsk) => {
    let grouped = [];
    data.forEach((item) => {
      let gPrice;
      if (p >= 0) {
        gPrice = isAsk
          ? Math.ceil(item.price / groupSize) * groupSize
          : Math.floor(item.price / groupSize) * groupSize;
        gPrice = parseFloat(gPrice.toFixed(p)); // Avoid float math errors
      } else {
        gPrice = isAsk
          ? Math.ceil(item.price / groupSize) * groupSize
          : Math.floor(item.price / groupSize) * groupSize;
      }

      const last = grouped[grouped.length - 1];
      if (last && Math.abs(last.price - gPrice) < groupSize * 0.1) {
        last.size += item.size;
      } else {
        grouped.push({ price: gPrice, size: item.size });
      }
    });
    return grouped;
  };

  // Asks 역순(descending price) 상태이므로 밑에서부터 병합을 위해 순방향 처리 후 다시 50개 추출
  let rawAsks = [...obState.asks].reverse(); // asc for grouping
  let groupedAsks = groupData(rawAsks, true).reverse().slice(-50);

  let groupedBids = groupData(obState.bids, false).slice(0, 50);

  let askTotal = 0;
  let askTotals = new Array(groupedAsks.length);
  for (let i = groupedAsks.length - 1; i >= 0; i--) {
    askTotal += groupedAsks[i].size;
    askTotals[i] = askTotal;
  }

  let bidTotal = 0;
  let bidTotals = groupedBids.map((b) => {
    bidTotal += b.size;
    return bidTotal;
  });

  let maxTotal = Math.max(askTotal, bidTotal) || 1;

  for (let i = 0; i < 50; i++) {
    const askEl = document.getElementById(`ob-ask-${i}`);
    if (askEl) {
      if (i >= 50 - groupedAsks.length) {
        const idx = i - (50 - groupedAsks.length);
        const item = groupedAsks[idx];
        const t = askTotals[idx];
        askEl.classList.remove("hidden");
        document.getElementById(`ob-ask-price-${i}`).innerText =
          formatSmartPrice(item.price, Math.max(0, p));
        document.getElementById(`ob-ask-size-${i}`).innerText = formatVol(
          item.size,
        );
        document.getElementById(`ob-ask-total-${i}`).innerText = formatVol(t);
        document.getElementById(`ob-ask-bg-${i}`).style.width =
          `${(t / maxTotal) * 100}%`;
      } else {
        askEl.classList.add("hidden");
      }
    }

    const bidEl = document.getElementById(`ob-bid-${i}`);
    if (bidEl) {
      if (i < groupedBids.length) {
        const item = groupedBids[i];
        const t = bidTotals[i];
        bidEl.classList.remove("hidden");
        document.getElementById(`ob-bid-price-${i}`).innerText =
          formatSmartPrice(item.price, Math.max(0, p));
        document.getElementById(`ob-bid-size-${i}`).innerText = formatVol(
          item.size,
        );
        document.getElementById(`ob-bid-total-${i}`).innerText = formatVol(t);
        document.getElementById(`ob-bid-bg-${i}`).style.width =
          `${(t / maxTotal) * 100}%`;
      } else {
        bidEl.classList.add("hidden");
      }
    }
  }
}

function formatVol(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(2) + "M";
  if (v >= 1000) return (v / 1000).toFixed(2) + "K";
  if (v >= 100) return v.toFixed(1);
  return v.toFixed(3);
}

window.toggleOrderbook = toggleOrderbook;
window.changeOrderbookPrecision = changeOrderbookPrecision;
window.resetOrderbookPrecision = resetOrderbookPrecision;
window.startOrderbookStream = startOrderbookStream;
window.stopOrderbookStream = stopOrderbookStream;
