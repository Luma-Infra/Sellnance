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
 * 3. 김프 해외 기준 단가 산출 규칙 (순수 현물 100% 매칭)
 * [철학] 국내(업비트 ➔ 빗썸) ↔ 해외(바낸 현물 ➔ 바이빗 현물) 오직 현물만 비교 (선물 폴백 일체 제거)
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
  }

  return { rawGlb, ovsMult };
}

/**
 * 4. 행(Row)의 대표 수치 및 가격 추출 (1코인 1행 단일 규칙)
 * [철학] 테이블 대표 시세 및 등락률은 오직 바이낸스(선물/현물)와 업비트만 영향
 * - 달러 모드: 바이낸스(선물/현물) ➔ 업비트 환산가
 * - 원화 모드: 업비트 ➔ 바이낸스(선물/현물) 환산가
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

  // 🚀 [테이블 4단 분리: 1.바낸 선물 ➔ 2.업비트 현물 ➔ 3.바낸 현물 ➔ 4.바이빗 현물]
  const binanceFuturesP =
    row.Binance_Price_Futures ||
    (isFutures ? row.Price_Raw : null);
  const upbitP = row.Upbit_Price ?? (row.Upbit === "O" ? row.Price_KRW : null);
  const binanceSpotP =
    row.Binance_Price_Spot ||
    (!isFutures && (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE_SPOT") || row.Listed_Exchanges?.includes("BINANCE")) ? row.Price_Raw : null);
  const bybitSpotP =
    row.Bybit_Price_Spot ||
    (!isFutures && (row.Bybit === "O" || row.Listed_Exchanges?.includes("BYBIT_SPOT") || row.Listed_Exchanges?.includes("BYBIT")) ? row.Price_Raw : null);

  let activeExchange = "binance";
  let displayPrice = 0;

  if (isKrwMode) {
    if (upbitP !== null && upbitP > 0) {
      activeExchange = "upbit";
      displayPrice = upbitP;
    } else if (binanceFuturesP !== null && binanceFuturesP > 0) {
      activeExchange = "binance";
      displayPrice = binanceFuturesP * rate;
    } else if (binanceSpotP !== null && binanceSpotP > 0) {
      activeExchange = "binance";
      displayPrice = binanceSpotP * rate;
    } else if (bybitSpotP !== null && bybitSpotP > 0) {
      activeExchange = "bybit";
      displayPrice = bybitSpotP * rate;
    } else {
      activeExchange = row.Price_KRW ? "upbit" : "binance";
      displayPrice = row.Price_KRW || (row.Price_Raw || 0) * rate;
    }
  } else {
    // 🚀 [USD 모드: 1.바낸 선물 ➔ 2.업비트 현물 ➔ 3.바낸 현물 ➔ 4.바이빗 현물]
    if (binanceFuturesP !== null && binanceFuturesP > 0) {
      activeExchange = "binance";
      displayPrice = binanceFuturesP;
    } else if (upbitP !== null && upbitP > 0) {
      activeExchange = "upbit";
      displayPrice = rate > 0 ? upbitP / rate : upbitP;
    } else if (binanceSpotP !== null && binanceSpotP > 0) {
      activeExchange = "binance";
      displayPrice = binanceSpotP;
    } else if (bybitSpotP !== null && bybitSpotP > 0) {
      activeExchange = "bybit";
      displayPrice = bybitSpotP;
    } else {
      activeExchange = "binance";
      displayPrice = row.Price_Raw || 0;
    }
  }

  // 🚀 [등락률 1:1 매핑] activeExchange 및 선택된 단가 기준 1:1 동기화
  let n24h = 0;
  let nDay = 0;

  if (activeExchange === "upbit") {
    n24h = row.Change_24h_Upbit || row.Change_24h_Raw || 0;
    nDay = row.Change_Today_Upbit || row.Change_Today_Raw || 0;
  } else if (activeExchange === "binance") {
    if (binanceFuturesP !== null && binanceFuturesP > 0) {
      n24h = row.Change_24h_Futures || row.Change_24h_Raw || 0;
      nDay = row.Change_Today_Futures || row.Change_Today_Raw || 0;
    } else {
      n24h = (row.Change_24h_Spot ?? row.Change_24h_Binance) || row.Change_24h_Raw || 0;
      nDay = (row.Change_Today_Spot ?? row.Change_Today_Binance) || row.Change_Today_Raw || 0;
    }
  } else if (activeExchange === "bybit") {
    n24h = row.Change_24h_Bybit || row.Change_24h_Raw || 0;
    nDay = row.Change_Today_Bybit || row.Change_Today_Raw || 0;
  } else {
    n24h = row.Change_24h_Raw || 0;
    nDay = row.Change_Today_Raw || 0;
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
 * 5. 행(Row) 및 차트 탑존의 거래량(Volume) 단일 산출 규칙
 * 
 * [A. 테이블 Row (고정형)]
 *  - ALL / 일반 탭: 선물 코인은 선물 24h 대금, 현물 전용은 현물 24h 대금
 * 
 * [B. 차트 탑존 (유동적)]
 *  - 메인 마켓(activeMarket) + 하단 서브 김프 파트너(subMarket) 1:1 페어링
 *  - 1) 국내 메인 선택 시 (UPBIT, BITHUMB):
 *       우측(국내): 메인 국내 거래소 볼륨 (업비트 🔵 / 빗썸 🟠)
 *       좌측(해외): 서브 김프에서 선택된 해외 거래소 볼륨 (바낸 🟡 / 바이빗 🟠)
 *  - 2) 해외 메인 선택 시 (BINANCE FUTURES, BINANCE SPOT, BYBIT 등):
 *       좌측(해외): 메인 해외 거래소 볼륨 (바낸 🟡 / 바이빗 🟠)
 *       우측(국내): 서브 김프에서 선택된 국내 거래소 볼륨 (업비트 🔵 / 빗썸 🟠)
 */
export function getRowDisplayVolume(
  row,
  activeMarket = "ALL",
  subMarket = null,
  isKrwMode = null,
  rate = null,
) {
  if (!row) {
    return {
      volBFormatted: "-",
      volUFormatted: "-",
      volBRaw: 0,
      volURaw: 0,
      volBColorClass: "text-[#f0b90b]",
      volUColorClass: "text-upbit-color",
    };
  }

  if (isKrwMode === null) isKrwMode = store.currencyMode === "KRW";
  if (!rate) rate = store.marketDataMap?.krw_usd_rate || 1;

  const isFutures = isFuturesCoin(row);
  const normActive = String(activeMarket || "").toUpperCase().replace(/-/g, "_");
  const isKoreaMain = normActive === "UPBIT" || normActive === "BITHUMB";

  // 좌측 해외 거래소 볼륨 & 색상 산출 (하단 서브 김프 노출 순서 & ID 완벽 동기화)
  let volBRaw = 0;
  let volBColorClass = "text-[#f0b90b]"; // 바낸 기본

  const rawGlobalMkt = isKoreaMain
    ? (subMarket || (isFutures ? "BINANCE_FUTURES" : "BINANCE"))
    : activeMarket;
  const normGlobal = String(rawGlobalMkt || "").toUpperCase().replace(/-/g, "_");

  const isBybit = normGlobal.includes("BYBIT") || normGlobal.includes("BYB");
  const isBybitFutures =
    normGlobal.includes("BYBIT_FUTURES") ||
    normGlobal.includes("BYB_F") ||
    normGlobal === "BYBIT_FUT" ||
    (normGlobal === "BYBIT" && isFutures);

  const isBinanceFutures =
    normGlobal.includes("BINANCE_FUTURES") ||
    normGlobal === "FUTURES" ||
    normGlobal === "B_FUT" ||
    (normGlobal === "BINANCE" && isFutures);
  const isBinanceSpot =
    normGlobal.includes("BINANCE_SPOT") ||
    normGlobal === "SPOT" ||
    normGlobal === "B_SPOT" ||
    (normGlobal === "BINANCE" && !isFutures);

  if (isBybit) {
    volBColorClass = "text-[#f7a600]";
    if (isBybitFutures) {
      volBRaw = row.Bybit_Vol_Futures || row.Bybit_Vol || 0;
    } else {
      volBRaw = row.Bybit_Vol_Spot || 0;
    }
  } else if (isBinanceFutures) {
    volBColorClass = "text-[#f0b90b]";
    volBRaw =
      row.Binance_Vol_Futures > 0
        ? row.Binance_Vol_Futures
        : row.Binance_Vol_Spot || 0;
  } else if (isBinanceSpot) {
    volBColorClass = "text-[#f0b90b]";
    volBRaw =
      row.Binance_Vol_Spot > 0
        ? row.Binance_Vol_Spot
        : row.Binance_Vol_Futures || 0;
  } else {
    // ALL 등 기본 탭
    if (isFutures) {
      volBColorClass = "text-[#f0b90b]";
      volBRaw =
        row.Binance_Vol_Futures > 0
          ? row.Binance_Vol_Futures
          : row.Binance_Vol_Spot || 0;
    } else if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
      volBColorClass = "text-[#f0b90b]";
      volBRaw =
        row.Binance_Vol_Spot > 0
          ? row.Binance_Vol_Spot
          : row.Binance_Vol_Futures || 0;
    } else if (row.Bybit_Futures === "O") {
      volBColorClass = "text-[#f7a600]";
      volBRaw = row.Bybit_Vol_Futures || row.Bybit_Vol || 0;
    } else if (row.Bybit === "O") {
      volBColorClass = "text-[#f7a600]";
      volBRaw = row.Bybit_Vol_Spot || row.Bybit_Vol || 0;
    } else {
      volBColorClass = "text-theme-text opacity-40";
      volBRaw = 0;
    }
  }

  // 우측 국내 거래소 볼륨 & 색상 산출 (하단 서브 김프 노출 순서 & ID 완벽 동기화)
  let volURaw = 0;
  let volUColorClass = "text-upbit-color";

  const rawKoreaMkt = isKoreaMain
    ? activeMarket
    : (subMarket || "UPBIT");
  const normKorea = String(rawKoreaMkt || "").toUpperCase();

  if (normKorea.includes("BITHUMB")) {
    volUColorClass = "text-[#f37321]";
    volURaw = row.Bithumb_Vol || 0;
  } else {
    // UPBIT 및 기본
    volUColorClass = "text-upbit-color";
    volURaw = row.Upbit_Vol || 0;
  }

  // 🚀 [3] 통화 모드 (KRW / USD) 포맷팅
  let volBFormatted = "-";
  if (volBRaw > 0) {
    if (isKrwMode && typeof window.formatVolumeKRW === "function") {
      volBFormatted = window.formatVolumeKRW(volBRaw * rate);
    } else if (typeof window.formatVolumeDollar === "function") {
      volBFormatted = window.formatVolumeDollar(volBRaw);
    }
  }

  let volUFormatted = "-";
  if (volURaw > 0) {
    if (isKrwMode && typeof window.formatVolumeKRW === "function") {
      volUFormatted = window.formatVolumeKRW(volURaw);
    } else if (typeof window.formatVolumeDollar === "function" && rate > 0) {
      volUFormatted = window.formatVolumeDollar(volURaw / rate);
    }
  }

  return {
    volBFormatted,
    volUFormatted,
    volBRaw,
    volURaw,
    volBColorClass,
    volUColorClass,
  };
}

/**
 * 6. 티커명 뒤에 .P 표기 HTML 생성
 */
export function getDisplayTickerHtml(row) {
  if (!row) return "";
  const ticker = row.DisplayTicker || row.Symbol || row.Ticker || "";
  const isFutures = isFuturesCoin(row);
  return `${ticker}${isFutures ? `<span class="text-theme-accent font-bold">.P</span>` : ""}`;
}

/**
 * 7. 차트 클릭 시 기본 마켓 결정 규칙
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

/**
 * 8. 거래소별 네이티브 타임프레임(캔들 봉) 지원 여부 판별 (3D/12H 등 리샘플링 여부 결정)
 */
export const NATIVE_TF_MAP = {
  binance: new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]),
  bybit: new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w", "1M"]), // 3d는 1d 3개 리샘플링
  upbit: new Set(["1m", "3m", "5m", "10m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"]), // 12h, 3d 리샘플링
  bithumb: new Set(["1m", "3m", "5m", "10m", "30m", "1h", "6h", "12h", "1d"]), // 3d 리샘플링
  gate: new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w", "1M"]),
  gateio: new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w", "1M"]),
};

export function isExchangeNativeTF(exchange, tf) {
  if (!exchange || !tf) return false;
  const exKey = exchange.toLowerCase().replace(/_spot|_futures/g, "");
  return NATIVE_TF_MAP[exKey]?.has(tf) ?? false;
}

// 전역 window 등록 (HTML 인라인 및 레거시 스크립트 호환)
window.MarketRules = {
  isFuturesCoin,
  getRowExchangeMeta,
  getRowKimchiGlobalPrice,
  getRowDisplayMetrics,
  getRowDisplayVolume,
  getDisplayTickerHtml,
  getChartDefaultMarket,
  isExchangeNativeTF,
  NATIVE_TF_MAP,
};
