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
import { renderRealtimeRow } from "./stream_table.js";

// 차트 관련 실시간 처리 로드
import "./stream_global.js";

// 🚀 [신규] 코인별 대표 지표(Raw)를 거래소 우선순위(선물 > 현물 > 업비트)에 맞게 강제 동기화하는 함수
export function syncRowPrioritizedMetrics(row) {
  const currentMarket = store.currentMarket || "ALL";
  const rate = store.marketDataMap?.krw_usd_rate || 1;

  let hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
  let hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

  let pPrice = null;
  let p24h = null;
  let pToday = null;
  let pOpen = null;
  let pInflow = "";

  if (currentMarket === "FUTURES") {
    pPrice = row.Binance_Price_Futures ?? row.Bybit_Price_Futures ?? row.Price_Raw;
    p24h = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
    pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance_Futures === "O" ? "BINANCE_FUTURES" : "BYBIT_FUTURES";
  } else if (currentMarket === "SPOT") {
    pPrice = row.Binance_Price_Spot ?? row.Bybit_Price_Spot ?? row.Price_Raw;
    p24h = row.Change_24h_Binance ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Binance ?? row.Change_Today_Bybit ?? row.Change_Today_Raw;
    pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance === "O" ? "BINANCE_SPOT" : "BYBIT_SPOT";
  } else if (currentMarket === "UPBIT") {
    pPrice = row.Upbit_Price ? (rate > 0 ? row.Upbit_Price / rate : row.Upbit_Price) : row.Price_Raw;
    p24h = row.Change_24h_Upbit ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Upbit ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
    pInflow = "UPBIT";
  } else if (currentMarket === "BITHUMB") {
    pPrice = row.Bithumb_Price ? (rate > 0 ? row.Bithumb_Price / rate : row.Bithumb_Price) : row.Price_Raw;
    p24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Bithumb ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
    pInflow = "BITHUMB";
  } else {
    // ALL 모드 등 기본: 해외선물 > 해외현물 > 업비트 > 빗썸 순으로 락킹
    if (hasFutures) {
      pPrice = row.Binance_Price_Futures ?? row.Bybit_Price_Futures ?? row.Price_Raw;
      p24h = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
      pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = row.Binance_Futures === "O" ? "BINANCE_FUTURES" : "BYBIT_FUTURES";
    } else if (hasSpot) {
      pPrice = row.Binance_Price_Spot ?? row.Bybit_Price_Spot ?? row.Price_Raw;
      p24h = row.Change_24h_Binance ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Binance ?? row.Change_Today_Bybit ?? row.Change_Today_Raw;
      pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = row.Binance === "O" ? "BINANCE_SPOT" : "BYBIT_SPOT";
    } else if (row.Upbit_Price) {
      pPrice = rate > 0 ? row.Upbit_Price / rate : row.Upbit_Price;
      p24h = row.Change_24h_Upbit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Upbit ?? row.Change_Today_Raw;
      pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
      pInflow = "UPBIT";
    } else if (row.Bithumb_Price) {
      pPrice = rate > 0 ? row.Bithumb_Price / rate : row.Bithumb_Price;
      p24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Bithumb ?? row.Change_Today_Raw;
      pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
      pInflow = "BITHUMB";
    } else {
      // pPrice = row.Price_Raw;
      // p24h = row.Change_24h_Raw;
      // pToday = row.Change_Today_Raw;
      // pOpen = row.utc0_open_Raw;
      // pInflow = "BINANCE";
    }
  }

  if (pPrice !== null && pPrice !== undefined) row.Price_Raw = pPrice;
  if (p24h !== null && p24h !== undefined) row.Change_24h_Raw = p24h;
  if (pToday !== null && pToday !== undefined) row.Change_Today_Raw = pToday;
  if (pOpen !== null && pOpen !== undefined) {
    row.spot_utc0_open_Raw = pOpen;
    row.futures_utc0_open_Raw = pOpen;
    row.utc0_open_Raw = pOpen;
  }
  row.Inflow_Path = pInflow;
  row.activeExchange = pInflow.toLowerCase().replace("_spot", "").replace("_futures", "");

  // 🚀 [HTS 가드 엔진] 외부 혹은 미확인 코드에 의한 김프 0.0% 강제 오염 완벽 격리 차단
  if (row.Kimchi_Raw === null || row.Kimchi_Raw === undefined || isNaN(row.Kimchi_Raw)) {
    row.Kimchi_Raw = null;
    row.Kimchi_Label = "-";
    row.Kimchi_Formatted = "-";
  }
}
window.syncRowPrioritizedMetrics = syncRowPrioritizedMetrics;

// 🚀 3초 주기 레이더 스냅샷 인터벌 (소켓 정체 상황 시 메모리 기반 김프/지표 갱신 전파 루프)
if (store.radarIntervalId) clearInterval(store.radarIntervalId);
store.radarIntervalId = setInterval(() => {
  if (store.blockRadarBatch) {
    if (store.bypassCounters) store.bypassCounters.radarBatch++;
    return;
  }
  if (Object.keys(store.tickerBuffer).length === 0) return;
  const snapshot = { ...store.tickerBuffer };
  store.tickerBuffer = {};

  let dataUpdated = false;
  store.currentTableData.forEach((row) => {
    const isKrwCoin = row.Ticker.endsWith("KRW") || row.Upbit === "O" || row.Bithumb === "O";
    let ticker = null;
    let isFuturesTicker = false;

    if (isKrwCoin) {
      ticker =
        snapshot[`KRW-${row.Ticker.replace("KRW", "")}`] ||
        snapshot[row.Ticker];
    } else {
      const hasFutures =
        row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      const isAllMode =
        store.currentMarket === "ALL" ||
        store.currentMarket === "KIMCHI" ||
        store.currentMarket === "NEW";
      const useFutures =
        ((store.currentMarket === "FUTURES") || (isAllMode && hasFutures)) &&
        row.Spot_Only !== "O";

      const baseSymbol = row.Exact_Futures || row.Exact_Spot || row.Symbol || row.Ticker;
      const lookupKey = baseSymbol.toUpperCase() + (useFutures ? "USDT_FUTURES" : "USDT");
      ticker = snapshot[lookupKey];
      isFuturesTicker = lookupKey.endsWith("_FUTURES");
    }

    if (ticker) {
      // 🚀 [테이블 실시간 가격(Price) 동기화 및 전파 담당]
      if (isKrwCoin) {
        const rate = store.marketDataMap?.krw_usd_rate || 0;
        row.Price_KRW = parseFloat(ticker.c);
        row.Price_Raw = row.Price_KRW / rate;
        if (row.Upbit === "O" || store.currentMarket !== "BITHUMB") {
          row.Upbit_Price = row.Price_KRW;
        } else {
          row.Bithumb_Price = row.Price_KRW;
        }

        // 🚀 [렉 차단: 최적화] O(N^2) 내부 스캔 완전 박멸. Ticker명 매핑으로 직접 O(1) 탐색 교체
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        const partnerTicker = pureBase + "KRW";
        if (partnerTicker !== row.Ticker) {
          const r = store.tickerRowMap.get(partnerTicker);
          if (r) {
            if (!r.UID || !row.UID || r.UID == row.UID) {
              r.Price_KRW = row.Price_KRW;
              r.Upbit_Price = row.Upbit_Price;
              r.Bithumb_Price = row.Bithumb_Price;
            }
          }
        }
      } else {
        const newPrice = parseFloat(ticker.c);
        if (isFuturesTicker) {
          row.Binance_Price_Futures = newPrice;
          if (!row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
            row.Bybit_Price_Futures = newPrice;
          }
        } else {
          row.Binance_Price_Spot = newPrice;
          if (!row.Listed_Exchanges?.includes("BINANCE") && !row.Exact_Spot) {
            row.Bybit_Price_Spot = newPrice;
          }
        }

        row.Price_Raw = newPrice;
        if (
          row.Listed_Exchanges?.includes("BINANCE") ||
          row.Exact_Spot ||
          row.Exact_Futures
        ) {
          row.Binance_Price = newPrice;
        } else {
          row.Bybit_Price = newPrice;
        }
      }

      const chg = parseFloat(ticker.P);
      const isKoreaTicker = !!ticker.isUpbitRealtime;

      // 🚀 [테이블 24h 변동률 동기화 담당]
      let shouldUpdateChg = false;
      if (isKrwCoin) {
        shouldUpdateChg = isKoreaTicker;
      } else {
        shouldUpdateChg = !isKoreaTicker;
      }

      if (shouldUpdateChg) {
        row.Change_24h_Raw = chg;
      }

      if (isKoreaTicker) {
        row.Change_24h_Upbit = chg;
      } else {
        if (isFuturesTicker) {
          row.Change_24h_Futures_Ex = chg;
        } else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot) {
          row.Change_24h_Binance = chg;
        } else {
          row.Change_24h_Bybit = chg;
        }
      }

      // 🚀 [해외 거래소 실시간 거래대금(Volume) 누적 동기화 담당]
      const spotKey = row.Ticker;
      const futuresKey = row.Ticker + "_FUTURES";

      if (snapshot[spotKey] && snapshot[spotKey].q) {
        row.Binance_Vol_Spot = parseFloat(snapshot[spotKey].q);
      }
      if (snapshot[futuresKey] && snapshot[futuresKey].q) {
        row.Binance_Vol_Futures = parseFloat(snapshot[futuresKey].q);
      }

      const activeM = store.currentChartMarket || store.currentMarket || "ALL";
      const currentVolModeIsFutures = (activeM === "FUTURES" || activeM === "BYBIT_FUTURES") && row.Spot_Only !== "O";
      const activeVol = currentVolModeIsFutures ? row.Binance_Vol_Futures : row.Binance_Vol_Spot;

      const binanceVolCell = document.getElementById(`vol-binance-${row.Ticker}`);
      if (binanceVolCell && activeVol) {
        if (
          store.currencyMode === "KRW" &&
          typeof window.formatVolumeKRW === "function"
        ) {
          const rate = store.marketDataMap?.krw_usd_rate || 1;
          row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
        } else if (typeof window.formatVolumeDollar === "function") {
          row.Volume_Formatted = window.formatVolumeDollar(activeVol);
        }
        binanceVolCell.innerText = row.Volume_Formatted || "-";
      }
    }

    // 🚀 [국내 거래소 실시간 거래대금(Volume) 누적 동기화 담당]
    const upbitVolCell =
      document.getElementById(`vol-upbit-${row.Ticker}`) ||
      document.getElementById(`vol-upbit-${row.Ticker.toUpperCase()}`) ||
      document.getElementById(`vol-upbit-${row.Ticker.toLowerCase()}`) ||
      (row.Symbol ? document.getElementById(`vol-upbit-KRW-${row.Symbol.toUpperCase()}`) : null);

    if (upbitVolCell && snapshot[row.Ticker] && snapshot[row.Ticker].q_upbit) {
      row.Upbit_Vol = parseFloat(snapshot[row.Ticker].q_upbit);
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
      } else if (typeof window.formatVolumeDollar === "function") {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Upbit_Vol_Formatted = window.formatVolumeDollar(
          row.Upbit_Vol / (rate > 0 ? rate : 1)
        );
      }
      upbitVolCell.innerText = row.Upbit_Vol_Formatted || "-";
    }

    // 🚀 [테이블 김치 프리미엄 연산 및 화면 렌더 전파 담당] 3초 주기 레이더 스냅샷 (소켓 신호 유무 관계없이 가격이 존재하면 상시 연산)
    if (store.blockKimchi) {
      if (store.bypassCounters) store.bypassCounters.kimchi++;
    } else {
      const rate = store.marketDataMap?.krw_usd_rate || 0;
      if (rate > 0) {
        const calcKimchi = (r) => {
          const exList = (r.Listed_Exchanges || []).map(e => e.toUpperCase());
          const hasUpbit = r.Upbit === "O" || exList.includes("UPBIT") || !!r.Upbit_Symbol;
          const hasBithumb = exList.includes("BITHUMB") || !!r.Bithumb_Symbol;
          const hasGlobal = r.Binance === "O" || r.Binance_Futures === "O" || exList.includes("BINANCE") || exList.includes("BINANCE_FUTURES") || exList.includes("BYBIT") || exList.includes("BYBIT_FUTURES") || !!r.Price_Raw;

          if (!hasGlobal || (!hasUpbit && !hasBithumb)) {
            r.Kimchi_Raw = null;
            r.Kimchi_Label = "-";
            r.Kimchi_Formatted = "-";

            // 🚀 [렉 차단] 동기 렌더링 대신 rAF 배치 큐에 예약 위임
            if (window._realtimeRenderQueue) {
              window._realtimeRenderQueue.set(r.Ticker, () => {
                const rowEl = store.rowDomMap ? store.rowDomMap.get(r.Ticker) : null;
                if (rowEl && typeof window.updateRowDynamicHTML === "function") {
                  if (store.blockRowDynamicHTML) {
                    if (store.bypassCounters) store.bypassCounters.dynamicHtml++;
                    window.updateRowDynamicHTML(rowEl, r, true);
                  } else {
                    window.updateRowDynamicHTML(rowEl, r, false);
                  }
                }
              });
            }
            return;
          }

          let priceKor = 0;
          if (hasUpbit) {
            priceKor = r.Upbit_Price || r.Price_KRW || 0;
          } else if (hasBithumb) {
            if (row && row.UID && r.UID && row.UID != r.UID) {
              priceKor = r.Bithumb_Price || 0;
            } else {
              priceKor = r.Bithumb_Price || r.Price_KRW || 0;
            }
          }

          const domMult = getMultiplier(r.Upbit_Symbol || r.Symbol || r.Ticker);
          const ovsMult = getMultiplier(r.Exact_Futures || r.Exact_Spot || r.Symbol || r.Ticker);
          const unitKorPrice = priceKor / domMult;
          const unitGlbPrice = (r.Price_Raw || 0) / ovsMult;

          if (unitKorPrice > 0 && unitGlbPrice > 0) {
            const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;
            if (isFinite(kimchiPct)) {
              r.Kimchi_Raw = kimchiPct;
              r.Kimchi_Label = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
              r.Kimchi_Formatted = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(1) + "%";
              return;
            }
          }
          const isFakeZero =
            r.Kimchi_Raw === 0 ||
            r.Kimchi_Raw === 0.0 ||
            r.Kimchi_Raw === null ||
            r.Kimchi_Raw === undefined ||
            !r.Kimchi_Formatted ||
            /^(0\.0+%)?$/.test(r.Kimchi_Formatted) ||
            r.Kimchi_Formatted === "-" ||
            r.Kimchi_Formatted === "0.00%";

          if (isFakeZero) {
            r.Kimchi_Raw = null;
            r.Kimchi_Label = "-";
            r.Kimchi_Formatted = "-";

            // 🚀 [렉 차단] 동기 렌더링 대신 rAF 배치 큐에 예약 위임
            if (window._realtimeRenderQueue) {
              window._realtimeRenderQueue.set(r.Ticker, () => {
                const rowEl = store.rowDomMap ? store.rowDomMap.get(r.Ticker) : null;
                if (rowEl && typeof window.updateRowDynamicHTML === "function") {
                  if (store.blockRowDynamicHTML) {
                    if (store.bypassCounters) store.bypassCounters.dynamicHtml++;
                    window.updateRowDynamicHTML(rowEl, r, true);
                  } else {
                    window.updateRowDynamicHTML(rowEl, r, false);
                  }
                }
              });
            }
          }
        };

        calcKimchi(row);

        // 🚀 [렉 차단: 최적화] O(N^2) 방지를 위해, 동일 베이스 코인에 대한 그룹 연산은 Ticker명 직접 매핑 O(1)으로 교체
        if (isKrwCoin) {
          const pureBase = getPureBase(row.Symbol || row.Ticker);
          const partnerTicker = pureBase + "KRW";
          if (partnerTicker !== row.Ticker) {
            const r = store.tickerRowMap.get(partnerTicker);
            if (r) {
              if (!r.UID || !row.UID || r.UID == row.UID) {
                calcKimchi(r);
              }
            }
          }
        }
      }
    }

    // 🚀 [실시간 김프/지표 렌더링 반영] 화면 노출 대상 행은 rAF 쓰로틀링 게이트웨이로 우회 렌더 위임
    const isVisible =
      store.visibleSymbols.has(row.Ticker) ||
      store.visibleSymbols.has(row.Ticker.toUpperCase()) ||
      store.visibleSymbols.has(row.Ticker.toLowerCase()) ||
      store.visibleSymbols.has(row.Symbol) ||
      store.visibleSymbols.has(row.DisplayTicker);

    if (isVisible && window._realtimeRenderQueue) {
      window._realtimeRenderQueue.set(row.Ticker, () => {
        const rowEl = store.rowDomMap.get(row.Ticker);
        if (rowEl && typeof window.updateRowDynamicHTML === "function") {
          if (store.blockRowDynamicHTML) {
            if (store.bypassCounters) store.bypassCounters.dynamicHtml++;
            window.updateRowDynamicHTML(rowEl, row, true);
          } else {
            window.updateRowDynamicHTML(rowEl, row, false);
          }
        }
      });
    }

    dataUpdated = true;
  });
}, 3000);

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
