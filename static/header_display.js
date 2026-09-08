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

// Zero-GC DOM Element Cache Registry
const domCache = {
  headChg24h: null,
  headChgDay: null,
  headMcap: null,
  headVolB: null,
  headVolU: null,
  headCallerEl: null,
  headCaller24hEl: null,
  headCallerPriceEl: null,
  topEls: null,
  bottomEls: null,
  headChg24hEls: null,
  headChgDayEls: null,
};

export function invalidateHeaderDomCache() {
  domCache.headChg24h = null;
  domCache.topEls = null;
  domCache.bottomEls = null;
  domCache.headChg24hEls = null;
  domCache.headChgDayEls = null;
}
if (typeof window !== "undefined") {
  window.invalidateHeaderDomCache = invalidateHeaderDomCache;
}

function getHeaderDom() {
  if (!domCache.headChg24h || !domCache.headChg24h.isConnected) {
    domCache.headChg24h = document.getElementById("head-chg-24h");
    domCache.headChgDay = document.getElementById("head-chg-day");
    domCache.headMcap = document.getElementById("head-mcap");
    domCache.headVolB = document.getElementById("head-vol-binance");
    domCache.headVolU = document.getElementById("head-vol-upbit");
    domCache.headCallerEl = document.getElementById("head-caller-id");
    domCache.headCaller24hEl = document.getElementById("head-caller-id-24h");
    domCache.headCallerPriceEl = document.getElementById("head-caller-id-price");
    domCache.topEls = Array.from(document.querySelectorAll("#head-price-main, .head-price-main-sync"));
    domCache.bottomEls = Array.from(document.querySelectorAll("#head-price-sub, .head-price-sub-sync"));
    domCache.headChg24hEls = Array.from(document.querySelectorAll("#head-chg-24h, .head-chg-24h-sync"));
    domCache.headChgDayEls = Array.from(document.querySelectorAll("#head-chg-day, .head-chg-day-sync"));
  }
  return domCache;
}

export const realUpdateHeaderDisplay = (
  row,
  newPrice,
  p,
  isRealtimeStream = false,
  callerId = "UNKNOWN",
) => {
  const dom = getHeaderDom();

  if (dom.headCallerEl && dom.headCallerEl.textContent !== ` [${callerId}]`) {
    dom.headCallerEl.textContent = ` [${callerId}]`;
  }
  if (dom.headCaller24hEl && dom.headCaller24hEl.textContent !== ` [${callerId}]`) {
    dom.headCaller24hEl.textContent = ` [${callerId}]`;
  }
  if (dom.headCallerPriceEl && dom.headCallerPriceEl.textContent !== ` [${callerId}]`) {
    dom.headCallerPriceEl.textContent = ` [${callerId}]`;
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
  const isSpotMode = activeMarket === "SPOT" || activeMarket === "BYBIT" || activeMarket === "BYBIT_SPOT";

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
      bybitP = newPrice;
      if (activeMarket === "BYBIT_FUTURES") {
        row.Bybit_Price_Futures = newPrice;
      } else {
        row.Bybit_Price_Spot = newPrice;
      }
    } else {
      binanceP = newPrice;
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

  const formattedMainPrice = isMainKrw
    ? `${Number(displayPrice).toLocaleString(undefined, { maximumFractionDigits: getKrwPrecision(displayPrice) })}`
    : (window.formatSmartPrice ? window.formatSmartPrice(displayPrice, pNormalized) : formatSmartPrice(displayPrice, pNormalized));

  if (dom.topEls) {
    dom.topEls.forEach((el) => {
      if (el.textContent !== formattedMainPrice) el.textContent = formattedMainPrice;
    });
  }

  const hasSubPrice = subPrice !== null && subPrice > 0;
  const formattedSubPrice = hasSubPrice
    ? (isMainKrw
      ? `≈ $ ${window.formatSmartPrice ? window.formatSmartPrice(subPrice, pNormalized) : formatSmartPrice(subPrice, pNormalized)}`
      : `≈ ${Number(subPrice).toLocaleString(undefined, { maximumFractionDigits: getKrwPrecision(subPrice) })} ₩`)
    : "";

  if (dom.bottomEls) {
    dom.bottomEls.forEach((el) => {
      if (hasSubPrice) {
        if (el.textContent !== formattedSubPrice) el.textContent = formattedSubPrice;
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
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
    n24 =
      (activeMarket === "BYBIT_FUTURES"
        ? (row.Change_24h_Bybit_Futures || row.Change_24h_Bybit || row.Change_24h_Futures)
        : (row.Change_24h_Futures || row.Change_24h_Bybit_Futures || row.Change_24h_Bybit)) ||
      row.Change_24h_Raw ||
      0;
    nDay =
      (activeMarket === "BYBIT_FUTURES"
        ? (row.Change_Today_Bybit_Futures || row.Change_Today_Bybit || row.Change_Today_Futures)
        : (row.Change_Today_Futures || row.Change_Today_Bybit_Futures || row.Change_Today_Bybit)) ||
      row.Change_Today_Raw ||
      0;
  } else if (activeMarket === "SPOT" || activeMarket === "BYBIT" || activeMarket === "BYBIT_SPOT") {
    n24 =
      (activeMarket === "SPOT"
        ? (row.Change_24h_Spot ?? row.Change_24h_Binance)
        : (row.Change_24h_Bybit || row.Change_24h_Spot || row.Change_24h_Binance || row.Change_24h_Raw)) ??
      row.Change_24h_Raw ??
      0;
    nDay =
      (activeMarket === "SPOT"
        ? (row.Change_Today_Spot ?? row.Change_Today_Binance)
        : (row.Change_Today_Bybit || row.Change_Today_Spot || row.Change_Today_Binance || row.Change_Today_Raw)) ??
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
      n24 = row.Change_24h_Futures || row.Change_24h_Raw || 0;
      nDay = row.Change_Today_Futures || row.Change_Today_Raw || 0;
    } else if (hasSpot) {
      n24 = (row.Change_24h_Spot ?? row.Change_24h_Binance) ?? row.Change_24h_Raw ?? 0;
      nDay = (row.Change_Today_Spot ?? row.Change_Today_Binance) ?? row.Change_Today_Raw ?? 0;
    } else if (row.Upbit === "O" || row.Listed_Exchanges?.includes("UPBIT")) {
      n24 = row.Change_24h_Upbit ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Upbit ?? row.Change_Today_Raw ?? 0;
    } else if (row.Bithumb === "O" || row.Listed_Exchanges?.includes("BITHUMB")) {
      n24 = row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
    } else {
      n24 =
        row.Change_24h_Bybit_Futures ??
        row.Change_24h_Bybit ??
        row.Change_24h_Raw ??
        0;
      nDay =
        row.Change_Today_Bybit_Futures ??
        row.Change_Today_Bybit ??
        row.Change_Today_Raw ??
        0;
    }
  }

  const c24 =
    n24 > 0
      ? "text-theme-up"
      : n24 < 0
        ? "text-theme-down"
        : "text-theme-text";
  const text24 = `${n24 > 0 ? "+" : ""}${Number(n24).toFixed(2)}%`;

  if (dom.headChg24hEls) {
    dom.headChg24hEls.forEach((el) => {
      const cls = `text-[12px] md:text-[13px] min-[1200px]:text-[16px] font-sans mt-0.5 text-right font-normal ${c24} ${el.classList.contains("head-chg-24h-sync") ? "head-chg-24h-sync" : ""}`;
      if (el.className !== cls) el.className = cls;
      if (el.textContent !== text24) el.textContent = text24;
    });
  }

  const cDay =
    nDay > 0
      ? "text-theme-up"
      : nDay < 0
        ? "text-theme-down"
        : "text-theme-text";
  const textDay = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;

  if (dom.headChgDayEls) {
    dom.headChgDayEls.forEach((el) => {
      const cls = `text-[12px] md:text-[13px] min-[1200px]:text-[16px] font-sans mt-0.5 text-right font-normal ${cDay} ${el.classList.contains("head-chg-day-sync") ? "head-chg-day-sync" : ""}`;
      if (el.className !== cls) el.className = cls;
      if (el.textContent !== textDay) el.textContent = textDay;
    });
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

  if (dom.headMcap && dom.headMcap.textContent !== displayMcap) {
    dom.headMcap.textContent = displayMcap;
  }
  const hasBinance =
    row.Binance === "O" ||
    row.Binance_Futures === "O" ||
    (row.Listed_Exchanges &&
      (row.Listed_Exchanges.includes("BINANCE") ||
        row.Listed_Exchanges.includes("BINANCE_FUTURES")));
  const hasGlobalVol =
    hasBinance ||
    row.Bybit === "O" ||
    row.Bybit_Futures === "O" ||
    (row.Listed_Exchanges &&
      (row.Listed_Exchanges.includes("BYBIT") ||
        row.Listed_Exchanges.includes("BYBIT_FUTURES") ||
        row.Listed_Exchanges.includes("BYBIT_SPOT")));

  const volBText =
    (hasGlobalVol &&
      row.Volume_Formatted &&
      row.Volume_Formatted !== "-" &&
      row.Volume_Formatted !== "0"
      ? row.Volume_Formatted
      : null) ||
    (row.Bybit_Vol_Formatted &&
      row.Bybit_Vol_Formatted !== "-" &&
      row.Bybit_Vol_Formatted !== "0"
      ? row.Bybit_Vol_Formatted
      : null) ||
    "-";
  if (dom.headVolB && dom.headVolB.textContent !== volBText) {
    dom.headVolB.textContent = volBText;
  }

  let volUText = "-";
  if (
    row.Upbit_Vol_Formatted &&
    row.Upbit_Vol_Formatted !== "-" &&
    row.Upbit_Vol_Formatted !== "0"
  ) {
    volUText = row.Upbit_Vol_Formatted;
  } else if (row.Upbit_Vol && Number(row.Upbit_Vol) > 0) {
    volUText =
      typeof window.formatVolumeKRW === "function"
        ? window.formatVolumeKRW(row.Upbit_Vol)
        : Number(row.Upbit_Vol).toLocaleString();
  }
  if (dom.headVolU && dom.headVolU.textContent !== volUText) {
    dom.headVolU.textContent = volUText;
  }
};

const pooledStateMap = window.headerThrottleMap || new Map();
window.headerThrottleMap = pooledStateMap;

export function clearHeaderThrottle() {
  if (headerThrottleTimeout) {
    clearTimeout(headerThrottleTimeout);
    headerThrottleTimeout = null;
  }
  if (pooledStateMap) pooledStateMap.clear();
}
window.clearHeaderThrottle = clearHeaderThrottle;

export const updateHeaderDisplay = (row, newPrice, p, isRealtimeStream = false) => {
  if (!row || !row.Ticker) return;
  const tKey = row.Ticker;

  // 🚀 [원자성 가드] 현재 활성 선택된 코인이 아니면 불필요한 헤더 연산 및 큐 오염 차단
  const curSymbol = store.currentSelectedSymbol;
  const curAsset = store.currentAsset;
  if (
    curSymbol &&
    row.Ticker !== curSymbol &&
    row.Symbol !== curAsset &&
    row.Ticker !== curAsset &&
    row.Exact_Futures !== curSymbol &&
    row.Exact_Spot !== curSymbol
  ) {
    return;
  }

  let state = pooledStateMap.get(tKey);
  if (!state) {
    state = { row: null, price: undefined, p: undefined, isRealtimeStream: false, caller: "STREAM" };
    pooledStateMap.set(tKey, state);
  }

  state.row = row;
  if (newPrice !== undefined) state.price = newPrice;
  state.p = p;
  state.isRealtimeStream = isRealtimeStream;

  if (!headerThrottleTimeout) {
    headerThrottleTimeout = setTimeout(() => {
      headerThrottleTimeout = null;
      pooledStateMap.forEach((s) => {
        // 🚀 실행 시점에도 현재 선택 코인과 일치하는지 최종 검증 (경쟁 상태/코인 전환 덮어쓰기 완전 방지)
        const checkSym = store.currentSelectedSymbol;
        const checkAst = store.currentAsset;
        if (
          !checkSym ||
          s.row.Ticker === checkSym ||
          s.row.Symbol === checkAst ||
          s.row.Ticker === checkAst ||
          s.row.Exact_Futures === checkSym ||
          s.row.Exact_Spot === checkSym
        ) {
          realUpdateHeaderDisplay(
            s.row,
            s.price,
            s.p,
            s.isRealtimeStream,
            s.caller,
          );
        }
      });
      pooledStateMap.clear();
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
        topZone.style.height = "188px";
        topZone.style.maxHeight = "188px";
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
