// header_display.js
// 📊 차트 상단 헤더 전광판 가격, 등락률, 시가총액, 거래량 실시간 렌더링 및 쓰로틀링 모듈

import { store } from "./_store.js";
import { getMultiplier, formatSmartPrice } from "./chart_utils.js";

// 🚀 업비트 원화 소수점 규칙: 가격대별 자동 precision 반환
export function getKrwPrecision(price) {
  if (!price || isNaN(price)) return 0;
  if (price >= 100000) return 0;
  if (price >= 10000) return 1;
  if (price >= 100) return 2;
  if (price >= 1) return 3;
  return 4;
}
window.getKrwPrecision = getKrwPrecision;

let headerThrottleTimeout = null;

export const realUpdateHeaderDisplay = (
  row,
  newPrice,
  p,
  isRealtimeStream = false,
  callerId = "UNKNOWN",
) => {
  const headChg24h = document.getElementById("head-chg-24h");
  const headChgDay = document.getElementById("head-chg-day");
  const headMcap = document.getElementById("head-mcap");
  const headVolB = document.getElementById("head-vol-binance");
  const headVolU = document.getElementById("head-vol-upbit");

  const headCallerEl = document.getElementById("head-caller-id");
  if (headCallerEl) {
    headCallerEl.innerText = ` [${callerId}]`;
  }
  const headCaller24hEl = document.getElementById("head-caller-id-24h");
  if (headCaller24hEl) {
    headCaller24hEl.innerText = ` [${callerId}]`;
  }
  const headCallerPriceEl = document.getElementById("head-caller-id-price");
  if (headCallerPriceEl) {
    headCallerPriceEl.innerText = ` [${callerId}]`;
  }

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";

  const activeMarket =
    store.currentTab === "quickview" ||
      store.currentTab === "quickview-container"
      ? store.qvMarket || "ALL"
      : store.currentChartMarket || "ALL";

  const isFuturesMode =
    activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES";
  const isSpotMode = activeMarket === "SPOT" || activeMarket === "BYBIT";

  // 🚀 모든 코인 통용 공통: Ticker/Symbol 기준의 대표 배수 추출 (하드코딩 0%)
  const storeMult = getMultiplier(row.Symbol || row.Ticker);

  // 국내/해외의 현재 모드별 배수 획득
  const activeOvsTicker = isFuturesMode ? row.Exact_Futures : row.Exact_Spot;
  const ovsMult = getMultiplier(activeOvsTicker || row.Symbol);

  let binanceP = null;
  let bybitP = null;
  let upbitP = row.Upbit_Price || row.Price_KRW || null;
  let bithumbP = row.Bithumb_Price || row.Price_KRW || null;

  const ovsFutMult = getMultiplier(row.Exact_Futures || row.Ticker || row.Symbol);
  const ovsSpotMult = getMultiplier(row.Exact_Spot || row.Ticker || row.Symbol);
  const domMult = getMultiplier(
    row.Upbit_Symbol || row.Bithumb_Symbol || row.Symbol || row.Ticker,
  );

  // 🚀 활성 차트/심볼의 배수
  const chartSymbolMult = getMultiplier(
    store.currentAsset ||
    store.currentSelectedSymbol ||
    row.Exact_Futures ||
    row.Ticker,
  );

  if (isFuturesMode) {
    const rawP = row.Binance_Price_Futures ?? row.Price_Raw ?? null;
    binanceP = rawP !== null ? (rawP / (ovsFutMult || 1)) * (storeMult || 1) : null;
    bybitP = row.Bybit_Price_Futures
      ? (row.Bybit_Price_Futures / (ovsFutMult || 1)) * (storeMult || 1)
      : row.Price_Raw
        ? (row.Price_Raw / (ovsFutMult || 1)) * (storeMult || 1)
        : null;
  } else if (isSpotMode) {
    const rawP = row.Binance_Price_Spot ?? row.Price_Raw ?? null;
    binanceP = rawP !== null ? (rawP / (ovsSpotMult || 1)) * (storeMult || 1) : null;
    bybitP = row.Bybit_Price_Spot
      ? (row.Bybit_Price_Spot / (ovsSpotMult || 1)) * (storeMult || 1)
      : row.Price_Raw
        ? (row.Price_Raw / (ovsSpotMult || 1)) * (storeMult || 1)
        : null;
  } else {
    // ALL, KIMCHI, NEW 등 기본 탭 모드일 때: 테이블과 동일하게 대표 가격 매핑
    const hasSpot =
      row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");
    const hasFutures =
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES");

    if (hasFutures && row.Binance_Price_Futures) {
      binanceP = (row.Binance_Price_Futures / (ovsFutMult || 1)) * (storeMult || 1);
    } else if (hasSpot && row.Binance_Price_Spot) {
      binanceP = (row.Binance_Price_Spot / (ovsSpotMult || 1)) * (storeMult || 1);
    } else if (row.Price_Raw) {
      const activeMult = hasFutures && !hasSpot ? ovsFutMult : ovsSpotMult;
      binanceP = (row.Price_Raw / (activeMult || 1)) * (storeMult || 1);
    } else {
      binanceP = null;
    }

    if (row.Bybit_Price_Futures) {
      bybitP = (row.Bybit_Price_Futures / (ovsFutMult || 1)) * (storeMult || 1);
    } else if (row.Bybit_Price_Spot) {
      bybitP = (row.Bybit_Price_Spot / (ovsSpotMult || 1)) * (storeMult || 1);
    } else {
      bybitP = row.Price_Raw ? (row.Price_Raw / (ovsSpotMult || 1)) * (storeMult || 1) : null;
    }
  }

  if (newPrice !== undefined && newPrice !== null) {
    if (activeMarket === "UPBIT") {
      upbitP = newPrice;
      row.Upbit_Price = newPrice;
      row.Price_KRW = newPrice;
    } else if (activeMarket === "BITHUMB") {
      bithumbP = newPrice;
      row.Bithumb_Price = newPrice;
    } else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES") {
      bybitP = (newPrice / (chartSymbolMult || ovsFutMult || 1)) * (storeMult || 1);
    } else {
      const activeExchangeMult = isFuturesMode
        ? ovsFutMult
        : ovsFutMult > 1 && !row.Binance_Price_Spot
          ? ovsFutMult
          : ovsSpotMult;
      const srcMult = chartSymbolMult > 1 ? chartSymbolMult : activeExchangeMult;
      binanceP = (newPrice / (srcMult || 1)) * (storeMult || 1);
      if (isFuturesMode) {
        row.Binance_Price_Futures = newPrice;
      } else if (isSpotMode) {
        row.Binance_Price_Spot = newPrice;
      }
    }
  }

  let activeExchange = "binance";
  if (activeMarket === "UPBIT") activeExchange = "upbit";
  else if (activeMarket === "BITHUMB") activeExchange = "bithumb";
  else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES")
    activeExchange = "bybit";

  let rawPriceForTab = 0;
  if (activeExchange === "binance") rawPriceForTab = binanceP;
  else if (activeExchange === "bybit") rawPriceForTab = bybitP;
  else if (activeExchange === "upbit") rawPriceForTab = upbitP;
  else if (activeExchange === "bithumb") rawPriceForTab = bithumbP;

  if (rawPriceForTab && typeof window.updateTabTitleManager === "function") {
    window.updateTabTitleManager(
      rawPriceForTab,
      row.Symbol || row.Ticker,
      ["upbit", "bithumb"].includes(activeExchange),
    );
  }

  const pNormalized = p;

  let displayPrice = 0;
  let subPrice = null;
  const isMainKrw =
    isKrwMode || activeExchange === "upbit" || activeExchange === "bithumb";

  if (activeExchange === "binance") {
    const rawP = binanceP || 0;
    const actualKrw = upbitP || bithumbP || null;
    if (isMainKrw) {
      displayPrice = actualKrw || rawP * rate;
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = actualKrw || rawP * rate;
    }
  } else if (activeExchange === "bybit") {
    const rawP = bybitP || 0;
    const actualKrw = upbitP || bithumbP || null;
    if (isMainKrw) {
      displayPrice = actualKrw || rawP * rate;
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = actualKrw || rawP * rate;
    }
  } else if (activeExchange === "upbit") {
    const rawP = upbitP || 0;
    const actualUsd = binanceP || bybitP || null;
    if (isMainKrw) {
      displayPrice = rawP;
      subPrice = actualUsd || (rate > 0 ? rawP / rate : null);
    } else {
      displayPrice = actualUsd || (rate > 0 ? rawP / rate : 0);
      subPrice = rawP;
    }
  } else if (activeExchange === "bithumb") {
    const rawP = bithumbP || 0;
    const actualUsd = binanceP || bybitP || null;
    if (isMainKrw) {
      displayPrice = rawP;
      subPrice = actualUsd || (rate > 0 ? rawP / rate : null);
    } else {
      displayPrice = actualUsd || (rate > 0 ? rawP / rate : 0);
      subPrice = rawP;
    }
  }

  const topEl = document.getElementById("head-price-main");
  const bottomEl = document.getElementById("head-price-sub");

  if (topEl) {
    if (isMainKrw) {
      const krwP = getKrwPrecision(displayPrice);
      topEl.innerText = `${Number(displayPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} 원`;
    } else {
      topEl.innerText = window.formatSmartPrice ? window.formatSmartPrice(displayPrice, pNormalized) : formatSmartPrice(displayPrice, pNormalized);
    }
  }
  if (bottomEl) {
    if (subPrice !== null && subPrice > 0) {
      if (isMainKrw) {
        bottomEl.innerText = `$ ${window.formatSmartPrice ? window.formatSmartPrice(subPrice, pNormalized) : formatSmartPrice(subPrice, pNormalized)}`;
      } else {
        const krwP = getKrwPrecision(subPrice);
        bottomEl.innerText = `${Number(subPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} ₩`;
      }
      bottomEl.classList.remove("hidden");
    } else {
      bottomEl.classList.add("hidden");
    }
  }

  // 🚀 최종 대표 등락률(Raw) 값을 다이렉트로 매핑하여 좌측 테이블과 우측 전광판의 싱크를 완전히 일치시킵니다.
  let n24 = 0;
  let nDay = 0;

  if (activeMarket === "UPBIT") {
    n24 = row.Change_24h_Upbit ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Upbit ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "BITHUMB") {
    n24 = row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES") {
    n24 = row.Change_24h_Futures ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Futures ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "SPOT" || activeMarket === "BYBIT") {
    n24 =
      (activeMarket === "SPOT"
        ? (row.Change_24h_Spot ?? row.Change_24h_Binance)
        : row.Change_24h_Bybit) ??
      row.Change_24h_Raw ??
      0;
    nDay =
      (activeMarket === "SPOT"
        ? (row.Change_Today_Spot ?? row.Change_Today_Binance)
        : row.Change_Today_Bybit) ??
      row.Change_Today_Raw ??
      0;
  } else {
    // ALL, KIMCHI, NEW 등 기본 탭 모드에서의 우선순위 분기
    const hasFutures =
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot =
      row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");
    if (hasFutures) {
      n24 = row.Change_24h_Futures ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Futures ?? row.Change_Today_Raw ?? 0;
    } else if (hasSpot) {
      n24 = (row.Change_24h_Spot ?? row.Change_24h_Binance) ?? row.Change_24h_Raw ?? 0;
      nDay = (row.Change_Today_Spot ?? row.Change_Today_Binance) ?? row.Change_Today_Raw ?? 0;
    } else {
      n24 =
        row.Change_24h_Upbit ??
        row.Change_24h_Bithumb ??
        row.Change_24h_Raw ??
        0;
      nDay =
        row.Change_Today_Upbit ??
        row.Change_Today_Bithumb ??
        row.Change_Today_Raw ??
        0;
    }
  }

  if (headChg24h) {
    const c24 =
      n24 > 0
        ? "text-theme-up"
        : n24 < 0
          ? "text-theme-down"
          : "text-theme-text";
    headChg24h.className = `text-[12px] md:text-[13px] font-tempTestDss mt-0.5 ${c24}`;
    headChg24h.innerText = `${n24 > 0 ? "+" : ""}${Number(n24).toFixed(2)}%`;
  }
  if (headChgDay) {
    const cDay =
      nDay > 0
        ? "text-theme-up"
        : nDay < 0
          ? "text-theme-down"
          : "text-theme-text";
    headChgDay.className = `text-[12px] md:text-[13px] font-tempTestDss mt-0.5 ${cDay}`;
    headChgDay.innerText = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;
  }

  // 🚀 가격과 등락폭은 항상 갱신하고, 볼륨/시총 등 정적 지표만 조기 리턴하여 보존
  if (newPrice !== undefined || isRealtimeStream) {
    return;
  }

  // 🚀 실시간 마켓캡 계산 및 출력
  let displayMcap = row.MarketCap_Formatted || "-";
  if (row.Price_Raw > 0 && row.MarketCap_Raw > 0) {
    if (!row._CirculatingSupply) {
      row._CirculatingSupply = row.MarketCap_Raw / row.Price_Raw;
    }
    const liveMcap = row.Price_Raw * row._CirculatingSupply;
    if (liveMcap >= 1e9) displayMcap = (liveMcap / 1e9).toFixed(2) + " B";
    else if (liveMcap >= 1e6) displayMcap = (liveMcap / 1e6).toFixed(2) + " M";
    else if (liveMcap >= 1e3) displayMcap = (liveMcap / 1e3).toFixed(2) + " K";
    else displayMcap = liveMcap.toFixed(2);
  }

  if (headMcap) headMcap.innerText = displayMcap;
  const hasBinance =
    row.Binance === "O" ||
    row.Binance_Futures === "O" ||
    (row.Listed_Exchanges &&
      (row.Listed_Exchanges.includes("BINANCE") ||
        row.Listed_Exchanges.includes("BINANCE_FUTURES")));
  if (headVolB)
    headVolB.innerText =
      hasBinance &&
        row.Volume_Formatted &&
        row.Volume_Formatted !== "-" &&
        row.Volume_Formatted !== "0"
        ? row.Volume_Formatted
        : "-";
  if (headVolU) headVolU.innerText = row.Upbit_Vol_Formatted || "-";
};

if (!window.headerThrottleMap) {
  window.headerThrottleMap = new Map();
}

export const updateHeaderDisplay = (row, newPrice, p, isRealtimeStream = false) => {
  if (!row || !row.Ticker) return;
  const tKey = row.Ticker;

  let autoCaller = "UNKNOWN";
  if (store.traceRowCaller) {
    const err = new Error();
    const stack = err.stack || "";
    if (
      stack.includes("stream.js") ||
      stack.includes("stream-") ||
      stack.includes("updateStatus") ||
      isRealtimeStream === true ||
      isRealtimeStream === "STREAM"
    ) {
      autoCaller = "1 (Stream)";
    } else if (
      stack.includes("chart_utils.js") ||
      stack.includes("chart_utils") ||
      stack.includes("table_render")
    ) {
      autoCaller = "2 (Chart)";
    } else if (
      stack.includes("ui_control") ||
      stack.includes("table_filter") ||
      stack.includes("main")
    ) {
      autoCaller = "3 (UI/Filter)";
    } else {
      if (isRealtimeStream === true || isRealtimeStream === "STREAM") {
        autoCaller = "1 (Stream)";
      } else if (newPrice !== undefined && newPrice !== null) {
        autoCaller = "2 (Chart)";
      } else {
        autoCaller = "3 (UI/Filter)";
      }
    }
  } else {
    if (isRealtimeStream === true || isRealtimeStream === "STREAM") {
      autoCaller = "1 (Stream)";
    } else if (newPrice !== undefined && newPrice !== null) {
      autoCaller = "2 (Chart)";
    } else {
      autoCaller = "3 (UI/Filter)";
    }
  }

  const existing = window.headerThrottleMap.get(tKey) || {};
  window.headerThrottleMap.set(tKey, {
    row: row,
    price: newPrice !== undefined ? newPrice : existing.price,
    p: p,
    isRealtimeStream: isRealtimeStream,
    caller: autoCaller,
  });

  if (!headerThrottleTimeout) {
    headerThrottleTimeout = setTimeout(() => {
      headerThrottleTimeout = null;
      window.headerThrottleMap.forEach((state) => {
        realUpdateHeaderDisplay(
          state.row,
          state.price,
          state.p,
          state.isRealtimeStream,
          state.caller,
        );
      });
      window.headerThrottleMap.clear();
    }, 100);
  }
};
window.updateHeaderDisplay = updateHeaderDisplay;

// 🚀 [추가] 차트 우측 패널 상단부 접고 펼치는 기능
export function toggleHeaderTop() {
  const assetRow = document.getElementById("head-asset-row");
  const infoRow = document.getElementById("head-info-row");
  const badgesRow = document.getElementById("head-badges-row");
  const btn = document.getElementById("toggle-header-top-btn");

  if (btn) {
    const isHidden = btn.innerText.includes("펼치기");
    const elements = [assetRow, infoRow, badgesRow];
    const topZone = document.getElementById("chart-top-zone");

    if (isHidden) {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "";
          el.classList.remove("hidden");
        }
      });
      btn.innerText = "▲ 헤더 접기";
      localStorage.setItem("sellnance_header_collapsed", "false");
      if (topZone) {
        topZone.style.height = "224px";
        topZone.style.maxHeight = "224px";
      }
    } else {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "none";
          el.classList.add("hidden");
        }
      });
      btn.innerText = "▼ 헤더 펼치기";
      localStorage.setItem("sellnance_header_collapsed", "true");
      if (topZone) {
        topZone.style.height = "";
        topZone.style.maxHeight = "";
      }
    }
    if (typeof window.resetChartScale === "function") {
      window.resetChartScale();
    }
  }
}
window.toggleHeaderTop = toggleHeaderTop;
