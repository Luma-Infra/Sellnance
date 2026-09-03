/**
 * 🏛️ MARKET RULES (Single Source of Truth)
 * 셀낸스 전역(테이블, 소켓 스트림, 렌더러, 필터, 차트, 경주마 정렬)에서
 * 현물/선물 판별, 김프 해외가 산출, 대표 수치, 거래소 매핑을 단 1곳에서 관리합니다.
 */

import { store } from "./_store.js";
import { getMultiplier } from "./chart_utils.js";

/**
 * 1. 선물 코인 여부 판별 (선물 상장되어 있는가?)
 */
export function isFuturesCoin(row) {
  if (!row) return false;
  return (
    row.Binance_Futures === "O" ||
    row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
    row.Listed_Exchanges?.includes("BYBIT_FUTURES") ||
    row.Bybit_Futures === "O" ||
    !!row.Exact_Futures
  );
}

/**
 * 2. 거래소별 상장 메타데이터 100% 통합 판별
 */
export function getRowExchangeMeta(row) {
  if (!row) {
    return {
      hasBinanceFutures: false,
      hasBinanceSpot: false,
      hasBybitFutures: false,
      hasBybitSpot: false,
      hasUpbit: false,
      hasBithumb: false,
      isFutures: false,
      isSpot: false,
    };
  }

  const ex = row.Listed_Exchanges || [];
  const hasBinanceFutures =
    ex.includes("BINANCE_FUTURES") || row.Binance_Futures === "O" || !!row.Exact_Futures;
  const hasBinanceSpot =
    ex.includes("BINANCE_SPOT") || ex.includes("BINANCE") || row.Binance === "O";
  const hasBybitFutures =
    ex.includes("BYBIT_FUTURES") || row.Bybit_Futures === "O";
  const hasBybitSpot =
    ex.includes("BYBIT_SPOT") || ex.includes("BYBIT") || row.Bybit === "O";
  const hasUpbit =
    ex.includes("UPBIT") || row.Upbit === "O";
  const hasBithumb =
    ex.includes("BITHUMB");

  const isFutures = hasBinanceFutures || hasBybitFutures;
  const isSpot = hasBinanceSpot || hasBybitSpot || hasUpbit || hasBithumb;

  return {
    hasBinanceFutures,
    hasBinanceSpot,
    hasBybitFutures,
    hasBybitSpot,
    hasUpbit,
    hasBithumb,
    isFutures,
    isSpot,
  };
}

/**
 * 3. 김프 해외 기준 단가 산출 규칙
 * [우선순위] 1.바낸 현물 ➔ 2.바이빗 현물 ➔ 3.바낸 선물 ➔ 4.바이빗 선물 ➔ fallback
 */
export function getRowKimchiGlobalPrice(row) {
  if (!row) return { rawGlb: 0, ovsMult: 1 };

  let rawGlb = 0;
  let ovsMult = 1;

  if (row.Binance_Price_Spot && row.Binance_Price_Spot > 0) {
    rawGlb = row.Binance_Price_Spot;
    ovsMult = getMultiplier(row.Exact_Spot || row.Ticker || row.Symbol);
  } else if (row.Bybit_Price_Spot && row.Bybit_Price_Spot > 0) {
    rawGlb = row.Bybit_Price_Spot;
    ovsMult = getMultiplier(row.Exact_Spot || row.Ticker || row.Symbol);
  } else if (row.Binance_Price_Futures && row.Binance_Price_Futures > 0) {
    rawGlb = row.Binance_Price_Futures;
    ovsMult = getMultiplier(row.Exact_Futures || row.Ticker || row.Symbol);
  } else if (row.Bybit_Price_Futures && row.Bybit_Price_Futures > 0) {
    rawGlb = row.Bybit_Price_Futures;
    ovsMult = getMultiplier(row.Exact_Futures || row.Ticker || row.Symbol);
  } else if (row.Binance_Price && row.Binance_Price > 0) {
    rawGlb = row.Binance_Price;
    ovsMult = getMultiplier(row.Exact_Futures || row.Exact_Spot || row.Ticker || row.Symbol);
  } else if (row.Bybit_Price && row.Bybit_Price > 0) {
    rawGlb = row.Bybit_Price;
    ovsMult = getMultiplier(row.Exact_Futures || row.Exact_Spot || row.Ticker || row.Symbol);
  } else if (row.Price_Raw && row.Price_Raw > 0 && !row.Ticker?.endsWith("KRW")) {
    rawGlb = row.Price_Raw;
    ovsMult = getMultiplier(row.Ticker || row.Symbol);
  }

  return { rawGlb, ovsMult };
}

/**
 * 4. 행(Row)의 대표 수치 및 가격 추출 (1코인 1행 단일 규칙)
 * - 선물이 있으면: 선물 단가, 선물 24h, 선물 당일 등락률, .P 표기
 * - 현물만 있으면: 현물 단가, 현물 24h, 현물 당일 등락률
 */
export function getRowDisplayMetrics(row, isKrwMode = null, rate = null) {
  if (!row) {
    return {
      displayPrice: 0,
      n24h: 0,
      nDay: 0,
      activeExchange: "binance",
      isFutures: false,
    };
  }

  if (isKrwMode === null) {
    isKrwMode = store.currencyMode === "KRW";
  }
  if (!rate) {
    rate = store.marketDataMap?.krw_usd_rate || 0;
  }

  const isFutures = isFuturesCoin(row);

  // 🚀 [엄격한 현/선 분리] 선물 코인은 오직 선물가만, 현물 코인은 오직 현물가만 참조 (상호 침범 폴백 100% 차단)
  const binanceP = isFutures
    ? (row.Binance_Price_Futures || (row.Exact_Futures ? row.Price_Raw : null))
    : (row.Binance_Price_Spot || (row.Exact_Spot ? row.Price_Raw : null));
  const bybitP = isFutures
    ? (row.Bybit_Price_Futures || null)
    : (row.Bybit_Price_Spot || null);
  const upbitP = row.Upbit_Price ?? (row.Upbit === "O" ? row.Price_KRW : null);
  const bithumbP = row.Bithumb_Price ?? null;

  let activeExchange = "binance";
  let displayPrice = 0;

  if (isKrwMode) {
    if (upbitP !== null && upbitP > 0) {
      activeExchange = "upbit";
      displayPrice = upbitP;
    } else if (bithumbP !== null && bithumbP > 0) {
      activeExchange = "bithumb";
      displayPrice = bithumbP;
    } else if (binanceP !== null && binanceP > 0) {
      activeExchange = "binance";
      displayPrice = binanceP * rate;
    } else if (bybitP !== null && bybitP > 0) {
      activeExchange = "bybit";
      displayPrice = bybitP * rate;
    } else {
      activeExchange = row.Price_KRW ? "upbit" : "binance";
      displayPrice = row.Price_KRW || (row.Price_Raw || 0) * rate;
    }
  } else {
    if (binanceP !== null && binanceP > 0) {
      activeExchange = "binance";
      displayPrice = binanceP;
    } else if (bybitP !== null && bybitP > 0) {
      activeExchange = "bybit";
      displayPrice = bybitP;
    } else if (upbitP !== null && upbitP > 0) {
      activeExchange = "upbit";
      displayPrice = rate > 0 ? upbitP / rate : upbitP;
    } else if (bithumbP !== null && bithumbP > 0) {
      activeExchange = "bithumb";
      displayPrice = rate > 0 ? bithumbP / rate : bithumbP;
    } else {
      activeExchange = "binance";
      displayPrice = row.Price_Raw || 0;
    }
  }

  // 🚀 [등락률 엄격 분리] 선물 코인은 오직 선물 등락률만, 현물은 오직 현물 등락률만 반영
  let n24h = 0;
  let nDay = 0;

  if (isFutures) {
    n24h = row.Change_24h_Futures ?? (row.Exact_Futures ? row.Change_24h_Raw : 0);
    nDay = row.Change_Today_Futures ?? (row.Exact_Futures ? row.Change_Today_Raw : 0);
  } else {
    if (activeExchange === "upbit") {
      n24h = row.Change_24h_Upbit ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Upbit ?? row.Change_Today_Raw ?? 0;
    } else if (activeExchange === "bithumb") {
      n24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
    } else if (activeExchange === "bybit") {
      n24h = row.Change_24h_Bybit ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Bybit ?? row.Change_Today_Raw ?? 0;
    } else {
      n24h = row.Change_24h_Spot ?? row.Change_24h_Binance ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Spot ?? row.Change_Today_Binance ?? row.Change_Today_Raw ?? 0;
    }
  }

  return {
    displayPrice,
    n24h,
    nDay,
    activeExchange,
    isFutures,
  };
}

/**
 * 5. 티커명 뒤에 .P 표기 HTML 생성
 */
export function getDisplayTickerHtml(row) {
  if (!row) return "";
  const ticker = row.DisplayTicker || row.Symbol || row.Ticker || "";
  const isFutures = isFuturesCoin(row);
  return `${ticker}${isFutures ? `<span class="text-theme-accent font-bold">.P</span>` : ""}`;
}

/**
 * 6. 차트 클릭 시 기본 마켓 결정 규칙
 */
export function getChartDefaultMarket(row) {
  if (!row) return "FUTURES";
  const { isFutures, hasUpbit, hasBithumb, hasBinanceSpot, hasBybitSpot } = getRowExchangeMeta(row);

  if (store.filterMode === "UPBIT" && hasUpbit) return "UPBIT";
  if (isFutures) return "FUTURES";
  if (hasBinanceSpot) return "SPOT";
  if (hasUpbit) return "UPBIT";
  if (hasBithumb) return "BITHUMB";
  if (hasBybitSpot) return "BYBIT";

  return "FUTURES";
}

// 전역 window 등록 (HTML 인라인 및 레거시 스크립트 호환)
window.MarketRules = {
  isFuturesCoin,
  getRowExchangeMeta,
  getRowKimchiGlobalPrice,
  getRowDisplayMetrics,
  getDisplayTickerHtml,
  getChartDefaultMarket,
};
