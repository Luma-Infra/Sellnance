// stream.js
// --- 🌊 실시간 웹소켓 엔진 관제탑 (Orchestrator) ---
import { store, tfSec } from "./_store.js";
import { getMultiplier, getPureBase } from "./chart_utils.js";

// 하위 스트림 엔진 및 피드 드라이버 로드
import { startBinanceSpotFeed } from "./feed_binance_spot.js";
import { startBinanceFuturesFeed } from "./feed_binance_futures.js";
import { startBybitSpotFeed } from "./feed_bybit_spot.js";
import { startBybitFuturesFeed } from "./feed_bybit_futures.js";
import { startUpbitFeed } from "./feed_upbit.js";
import { startBithumbFeed } from "./feed_bithumb.js";
import { renderRealtimeRow, calculateRowKimchi } from "./stream_table.js";

// 차트 관련 실시간 처리 로드
import "./stream_global.js";

// 🚀 [신규] 코인별 대표 지표(Raw)를 거래소 우선순위(선물 > 현물 > 업비트)에 맞게 강제 동기화하는 함수
export function syncRowPrioritizedMetrics(row) {
  const currentMarket = store.currentMarket || "ALL";
  const rate = store.marketDataMap?.krw_usd_rate || 1;

  let hasFutures =
    row.Binance_Futures === "O" ||
    row.Listed_Exchanges?.includes("BINANCE_FUTURES");
  let hasSpot =
    row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

  let pPrice = null;
  let p24h = null;
  let pToday = null;
  let pOpen = null;
  let pInflow = "";

  if (currentMarket === "FUTURES") {
    pPrice =
      row.Binance_Price_Futures ?? row.Bybit_Price_Futures ?? row.Price_Raw;
    p24h = row.Change_24h_Futures ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
    pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance_Futures === "O" ? "BINANCE_FUTURES" : "BYBIT_FUTURES";
  } else if (currentMarket === "SPOT") {
    pPrice = row.Binance_Price_Spot ?? row.Bybit_Price_Spot ?? row.Price_Raw;
    p24h = (row.Change_24h_Spot ?? row.Change_24h_Binance) ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
    pToday =
      (row.Change_Today_Spot ?? row.Change_Today_Binance) ??
      row.Change_Today_Bybit ??
      row.Change_Today_Raw;
    pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance === "O" ? "BINANCE_SPOT" : "BYBIT_SPOT";
  } else if (currentMarket === "UPBIT") {
    pPrice = row.Upbit_Price
      ? rate > 0
        ? row.Upbit_Price / rate
        : row.Upbit_Price
      : row.Price_Raw;
    p24h = row.Change_24h_Upbit ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Upbit ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW
      ? rate > 0
        ? parseFloat(row.utc0_open_KRW) / rate
        : parseFloat(row.utc0_open_KRW)
      : row.utc0_open_Raw;
    pInflow = "UPBIT";
  } else if (currentMarket === "BITHUMB") {
    pPrice = row.Bithumb_Price
      ? rate > 0
        ? row.Bithumb_Price / rate
        : row.Bithumb_Price
      : row.Price_Raw;
    p24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Bithumb ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW
      ? rate > 0
        ? parseFloat(row.utc0_open_KRW) / rate
        : parseFloat(row.utc0_open_KRW)
      : row.utc0_open_Raw;
    pInflow = "BITHUMB";
  } else {
    // ALL 모드 등 기본: 해외선물 > 해외현물 > 업비트 순으로 락킹 (바이비트와 빗썸은 메인 락킹에서 배제)
    if (
      hasFutures &&
      (row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES"))
    ) {
      pPrice = row.Binance_Price_Futures ?? row.Price_Raw;
      p24h = row.Change_24h_Futures ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
      pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = "BINANCE_FUTURES";
    } else if (
      hasSpot &&
      (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE"))
    ) {
      pPrice = row.Binance_Price_Spot ?? row.Price_Raw;
      p24h = row.Change_24h_Binance ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Binance ?? row.Change_Today_Raw;
      pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = "BINANCE_SPOT";
    } else if (
      row.Upbit_Price &&
      (row.Upbit === "O" || row.Listed_Exchanges?.includes("UPBIT"))
    ) {
      const hasOvs =
        row.Binance === "O" ||
        row.Binance_Futures === "O" ||
        (row.Listed_Exchanges &&
          row.Listed_Exchanges.some(
            (e) => e.includes("BINANCE"),
          ));
      pPrice =
        hasOvs && row.Price_Raw
          ? row.Price_Raw
          : rate > 0
            ? row.Upbit_Price / rate
            : row.Upbit_Price;
      p24h =
        hasOvs && row.Change_24h_Raw
          ? row.Change_24h_Raw
          : (row.Change_24h_Upbit ?? row.Change_24h_Raw);
      pToday =
        hasOvs && row.Change_Today_Raw
          ? row.Change_Today_Raw
          : (row.Change_Today_Upbit ?? row.Change_Today_Raw);
      pOpen =
        hasOvs && row.utc0_open_Raw
          ? row.utc0_open_Raw
          : row.utc0_open_KRW
            ? rate > 0
              ? parseFloat(row.utc0_open_KRW) / rate
              : parseFloat(row.utc0_open_KRW)
            : row.utc0_open_Raw;
      pInflow = "UPBIT";
    } else if (
      row.Bithumb_Price &&
      (row.Bithumb === "O" || row.Listed_Exchanges?.includes("BITHUMB"))
    ) {
      const hasOvs =
        row.Binance === "O" ||
        row.Binance_Futures === "O" ||
        (row.Listed_Exchanges &&
          row.Listed_Exchanges.some(
            (e) => e.includes("BINANCE"),
          ));
      pPrice =
        hasOvs && row.Price_Raw
          ? row.Price_Raw
          : rate > 0
            ? row.Bithumb_Price / rate
            : row.Bithumb_Price;
      p24h =
        hasOvs && row.Change_24h_Raw
          ? row.Change_24h_Raw
          : (row.Change_24h_Bithumb ?? row.Change_24h_Raw);
      pToday =
        hasOvs && row.Change_Today_Raw
          ? row.Change_Today_Raw
          : (row.Change_Today_Bithumb ?? row.Change_Today_Raw);
      pOpen =
        hasOvs && row.utc0_open_Raw
          ? row.utc0_open_Raw
          : row.utc0_open_KRW
            ? rate > 0
              ? parseFloat(row.utc0_open_KRW) / rate
              : parseFloat(row.utc0_open_KRW)
            : row.utc0_open_Raw;
      pInflow = "BITHUMB";
    } else if (
      row.Bybit_Price_Futures &&
      row.Listed_Exchanges?.includes("BYBIT_FUTURES")
    ) {
      pPrice = row.Bybit_Price_Futures;
      p24h = row.Change_24h_Bybit_Futures ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Bybit_Futures ?? row.Change_Today_Bybit ?? row.Change_Today_Raw;
      pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = "BYBIT_FUTURES";
    } else if (
      row.Bybit_Price_Spot &&
      (row.Listed_Exchanges?.includes("BYBIT_SPOT") ||
        row.Listed_Exchanges?.includes("BYBIT"))
    ) {
      pPrice = row.Bybit_Price_Spot;
      p24h = row.Change_24h_Bybit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Bybit ?? row.Change_Today_Raw;
      pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = "BYBIT_SPOT";
    }
  }
  // pOpen = row.utc0_open_Raw;
  // pInflow = "BINANCE";

  if (pPrice !== null && pPrice !== undefined) row.Price_Raw = pPrice;
  if (p24h !== null && p24h !== undefined) row.Change_24h_Raw = p24h;
  if (pToday !== null && pToday !== undefined) row.Change_Today_Raw = pToday;
  if (pOpen !== null && pOpen !== undefined && parseFloat(pOpen) > 0) {
    row.utc0_open_Raw = parseFloat(pOpen);
  }
  row.Inflow_Path = pInflow;
  row.activeExchange = pInflow
    .toLowerCase()
    .replace("_spot", "")
    .replace("_futures", "");

  // 🚀 [HTS 가드 엔진] 외부 혹은 미확인 코드에 의한 김프 0.0% 강제 오염 완벽 격리 차단 (0% 고착 리셋 버그 차단용 주석 처리)
  /*
  if (row.Kimchi_Raw === null || row.Kimchi_Raw === undefined || isNaN(row.Kimchi_Raw)) {
    row.Kimchi_Raw = null;
    row.Kimchi_Label = "-";
    row.Kimchi_Formatted = "-";
  }
  */
}
window.syncRowPrioritizedMetrics = syncRowPrioritizedMetrics;

// 🚀 각 피드 드라이버 초기 기동 바인딩 (초기 기동 렉 방지를 위해 우선순위가 높은 국내 전용 소켓 피드만 점화)
export function initAllExchangeFeeds() {
  // 바이낸스/바이비트 전 마켓 스캔 수급은 3초 레이더나 테이블 스나이퍼 소켓(initSniperSocket)으로 충분히 커버되므로,
  // 메인 화면에서는 국내 거래소 데이터 피드 위주로 안정 기동시킵니다.

  startUpbitFeed();
  startBithumbFeed();

  // (필요 시 레이더 모드가 켜질 때 동적 호출되도록 드라이버 준비 상태만 유지합니다.)
  // startBinanceSpotFeed();
  // startBinanceFuturesFeed();
  // startBybitSpotFeed();
  // startBybitFuturesFeed();
}

window.initAllExchangeFeeds = initAllExchangeFeeds;
window.syncRowPrioritizedMetrics = syncRowPrioritizedMetrics;
