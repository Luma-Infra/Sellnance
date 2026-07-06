// stream_table.js
import { store, CONFIG } from "./_store.js";
import { updateVisibleSymbols } from "./table_render.js";
import { getMultiplier, getPureBase } from "./chart_utils.js";

// 🚀 [신규] 렌더링 과부하 방지용 쓰로틀 메모리 및 일괄 Batch 렌더러
if (!window._realtimeRenderQueue) {
  window._realtimeRenderQueue = new Map();
  const processQueue = () => {
    if (window._realtimeRenderQueue.size > 0) {
      window._realtimeRenderQueue.forEach((updateFn) => {
        try {
          updateFn();
        } catch (e) { }
      });
      window._realtimeRenderQueue.clear();
    }
    requestAnimationFrame(processQueue);
  };
  requestAnimationFrame(processQueue);
}

// 🎯 개별 스트림 스나이퍼 소켓 초기화 (피드 드라이버 내부 전용 함수들을 호출)
export function initSniperSocket() {
  if (typeof window.initBinanceSniperSocket === "function") {
    window.initBinanceSniperSocket();
  }
  if (typeof window.initBinanceFuturesSniperSocket === "function") {
    window.initBinanceFuturesSniperSocket();
  }
  if (typeof window.initUpbitSniperSocket === "function") {
    window.initUpbitSniperSocket();
  }
}

// 🔄 [핵심] visibleSymbols와 연동하여 바이낸스/업비트 구독 리스트 동시 동기화
export function syncSniperSubscriptions() {
  if (!store.visibleSymbols) return;
  const getNextId = () => Math.floor(Date.now() + Math.random() * 1000);

  const currentVisibleBinanceSpot = [];
  const currentVisibleBinanceFutures = [];
  const currentVisibleUpbit = [];
  const allSource = store.originalTableData || store.currentTableData || [];

  store.visibleSymbols.forEach((sym) => {
    const row = allSource.find(
      (r) => r.Ticker === sym || r.DisplayTicker === sym || r.Symbol === sym
    );
    if (!row) return;

    // 1. Spot 상장 코인인 경우
    const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot;
    if (hasSpot) {
      let bSpotTicker = row.Exact_Spot || (row.Ticker && !row.Ticker.endsWith("KRW") ? row.Ticker.replace("USDT", "") : null);
      if (bSpotTicker) {
        currentVisibleBinanceSpot.push(`${bSpotTicker.toLowerCase()}usdt@aggTrade`);
        currentVisibleBinanceSpot.push(`${bSpotTicker.toLowerCase()}usdt@miniTicker`);
      }
    }

    // 2. Futures 상장 코인인 경우
    const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES") || row.Exact_Futures;
    if (hasFutures) {
      let bFuturesTicker = row.Exact_Futures || (row.Ticker && !row.Ticker.endsWith("KRW") ? row.Ticker.replace("USDT", "") : null);
      if (bFuturesTicker) {
        currentVisibleBinanceFutures.push(`${bFuturesTicker.toLowerCase()}usdt@aggTrade`);
        currentVisibleBinanceFutures.push(`${bFuturesTicker.toLowerCase()}usdt@miniTicker`);
      }
    }

    // 3. Upbit 코인인 경우
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

  // Spot 소켓 구독 동기화
  if (store.sniperWs && store.sniperWs.readyState === WebSocket.OPEN) {
    const toSub = currentVisibleBinanceSpot.filter((s) => !store.activeSubs.has(s));
    if (toSub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() })
      );
      toSub.forEach((s) => store.activeSubs.add(s));
    }
    const toUnsub = Array.from(store.activeSubs).filter(
      (s) => !currentVisibleBinanceSpot.includes(s)
    );
    if (toUnsub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: toUnsub,
          id: getNextId(),
        })
      );
      toUnsub.forEach((s) => store.activeSubs.delete(s));
    }
  }

  // Futures 소켓 구독 동기화
  if (store.sniperWsFutures && store.sniperWsFutures.readyState === WebSocket.OPEN) {
    if (!store.activeSubsFutures) store.activeSubsFutures = new Set();
    const toSub = currentVisibleBinanceFutures.filter((s) => !store.activeSubsFutures.has(s));
    if (toSub.length > 0) {
      store.sniperWsFutures.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() })
      );
      toSub.forEach((s) => store.activeSubsFutures.add(s));
    }
    const toUnsub = Array.from(store.activeSubsFutures).filter(
      (s) => !currentVisibleBinanceFutures.includes(s)
    );
    if (toUnsub.length > 0) {
      store.sniperWsFutures.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: toUnsub,
          id: getNextId(),
        })
      );
      toUnsub.forEach((s) => store.activeSubsFutures.delete(s));
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
          ])
        );
      } catch (e) { }
    }
  }
}

export function refreshSniperTarget() {
  if (typeof updateVisibleSymbols === "function") updateVisibleSymbols();
  if (typeof syncSniperSubscriptions === "function") syncSniperSubscriptions();
}

const lastRenderRowMap = new Map();

// ⚡ [HTS 핵심] 개별 행 정밀 렌더링 엔진 (웹소켓 전용)
export function renderRealtimeRow(tId, data, isFutures = false) {
  if (data && data.e === "24hrMiniTicker") {
    const close = parseFloat(data.c);
    const open = parseFloat(data.o);
    if (open > 0) {
      data.P = ((close - open) / open) * 100;
    }
  }

  if (store.blockTableUpdate) {
    if (store.bypassCounters) store.bypassCounters.tableUpdate++;
    return;
  }
  if (store.isTabHidden || store.isRestoringTab) return;

  // 🚀 [초고속 진입로 쓰로틀 차단] 소켓 데이터가 너무 빈번하게 들이닥치는 경우
  // 객체 갱신 및 김프 연산 자체를 스킵하여 렉(메모리 힙 할당 및 GC)을 원천 차단
  const now = Date.now();
  if (data && data.s) {
    if (!store._lastRowTickMap) store._lastRowTickMap = new Map();
    const lastTick = store._lastRowTickMap.get(data.s) || 0;
    if (now - lastTick < 500) { // 500ms 쓰로틀 (이전 100ms에서 복원: aggTrade 등 고빈도 소켓 폭주 방지)
      if (store.bypassCounters) store.bypassCounters.throttleBypass++;
      return;
    }
    if (store.bypassCounters) store.bypassCounters.throttlePass++;
    store._lastRowTickMap.set(data.s, now);
  }
  const dataSym = (data.s || tId).toUpperCase();
  const cleanDataSym = dataSym.replace("-", "").toUpperCase();
  const cleanTId = tId.replace("-", "").toUpperCase();

  let row = null;
  if (data.isUpbitRealtime && data.UID) {
    // O(1) uidRowMap \uc6b0\uc120, \uc5c6\uc73c\uba74 tickerRowMap\uc73c\ub85c \ud3f4\ubc31 (\uc774\uc804: Array.find() O(N))
    row = store.uidRowMap?.get(String(data.UID)) || null;
  }

  if (!row) {
    row = store.tickerRowMap.get(cleanDataSym) || store.tickerRowMap.get(cleanTId);
    if (!row && (dataSym.startsWith("KRW-") || tId.startsWith("KRW-"))) {
      const upbitTicker = tId.replace("KRW-", "") + "KRW";
      row = store.tickerRowMap.get(upbitTicker);
    }
    if (!row && cleanDataSym.endsWith("KRW")) {
      row = store.tickerRowMap.get(cleanDataSym);
    }
    if (!row) {
      const baseSym = cleanDataSym.replace("USDT", "").replace("_FUTURES", "");
      row = store.tickerRowMap.get(baseSym);
    }
  }

  if (row && data.isUpbitRealtime && data.UID) {
    if (row.UID != data.UID) {
      // uidRowMap O(1) \uc6b0\uc120, \uc5c6\uc73c\uba74 \ud55c \ubc88\ub9cc Array.find() \ud3f4\ubc31
      const byUid = store.uidRowMap?.get(String(data.UID))
        || store.currentTableData?.find((r) => r.UID == data.UID);
      if (byUid) {
        row = byUid;
      } else {
        return; // \uc624\uc5fc\ub41c \uc774\uc885 \ucf54\uc778 \ub370\uc774\ud130 \ub4dc\ub86d
      }
    }
  }

  if (!row) return;

  const lastRender = lastRenderRowMap.get(row.Ticker) || 0;

  if (data && (data.e === "aggTrade" || data.isUpbitRealtime)) {
    if (now - lastRender < 500) return;
    lastRenderRowMap.set(row.Ticker, now);
  }

  if (!row.Ticker.endsWith("KRW") && getMultiplier(dataSym) !== getMultiplier(row.Ticker)) return;

  const newPrice = parseFloat(data.c || data.p || data.trade_price || data.price);
  if (isNaN(newPrice)) return;

  const isKrwCoin = row.Ticker.endsWith("KRW");
  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKoreaSocket = !!(data.isUpbitRealtime || data.isBithumbRealtime);
  const isAllMode =
    store.currentMarket === "ALL" ||
    store.currentMarket === "KIMCHI" ||
    store.currentMarket === "NEW";

  const hasGlobal = row.Binance === "O" || row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE") || row.Listed_Exchanges?.includes("BINANCE_FUTURES");

  if (isKoreaSocket) {
    row.Price_KRW = newPrice;
    if (!hasGlobal) {
      row.Price_Raw = newPrice / rate;
    }
    if (data.isUpbitRealtime || tId.startsWith("KRW-") || tId.endsWith("KRW")) {
      row.Upbit_Price = newPrice;
    } else if (data.isBithumbRealtime || tId.endsWith("_KRW")) {
      row.Bithumb_Price = newPrice;
    }
  } else {
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";

    if (isAllMode) {
      const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

      if (hasFutures) {
        if (!isFutures) return;
      } else if (hasSpot) {
        if (isFutures) return;
      }
    }

    let shouldUpdate = false;
    if (isAllMode) {
      shouldUpdate = true;
    } else {
      shouldUpdate = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }

    const isBinance =
      row.Binance === "O" ||
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE") ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
      row.Exact_Spot ||
      row.Exact_Futures;

    if (isBinance) {
      if (isFutures) {
        row.Binance_Price_Futures = newPrice;
        if (data.P !== undefined) row.Change_24h_Futures = parseFloat(data.P);
      } else {
        row.Binance_Price_Spot = newPrice;
        if (data.P !== undefined) row.Change_24h_Spot = parseFloat(data.P);
      }
    } else {
      if (isFutures) {
        row.Bybit_Price_Futures = newPrice;
      } else {
        row.Bybit_Price_Spot = newPrice;
      }
    }

    if (shouldUpdate) {
      if (!row.Ticker.endsWith("KRW")) {
        row.Price_Raw = newPrice;
      }
      if (isBinance) {
        row.Binance_Price = newPrice;
      } else {
        row.Bybit_Price = newPrice;
      }
    }
  }

  let shouldUpdateChg = false;
  if (isKrwCoin) {
    if (store.currentMarket === "UPBIT") {
      shouldUpdateChg = data.isUpbitRealtime || (row.Upbit === "O" && !data.isBithumbRealtime);
    } else if (store.currentMarket === "BITHUMB") {
      shouldUpdateChg = data.isBithumbRealtime || (row.Upbit !== "O" && !data.isUpbitRealtime);
    } else {
      if (row.Upbit === "O") {
        shouldUpdateChg = data.isUpbitRealtime || !data.isBithumbRealtime;
      } else {
        shouldUpdateChg = data.isBithumbRealtime || !data.isUpbitRealtime;
      }
    }
  } else {
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    if (isAllMode) {
      shouldUpdateChg = true;
    } else {
      shouldUpdateChg = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }
  }

  if (data.P !== undefined) {
    const chg = parseFloat(data.P);
    if (isKoreaSocket) {
      if (data.isUpbitRealtime) row.Change_24h_Upbit = chg;
      else if (data.isBithumbRealtime) row.Change_24h_Bithumb = chg;
    } else {
      if (isFutures) row.Change_24h_Futures_Ex = chg;
      else if (
        row.Listed_Exchanges?.includes("BINANCE") ||
        row.Exact_Spot ||
        row.Exact_Futures
      ) {
        row.Change_24h_Binance = chg;
      } else {
        row.Change_24h_Bybit = chg;
      }
    }
    if (shouldUpdateChg) {
      if (!(isKoreaSocket && hasGlobal)) {
        row.Change_24h_Raw = chg;
      }
    }
  }

  if (isKoreaSocket) {
    let openPriceKRW = row.utc0_open_KRW ? parseFloat(row.utc0_open_KRW) : 0;
    if (openPriceKRW <= 0 && row.utc0_open_Raw && rate > 0) {
      openPriceKRW = parseFloat(row.utc0_open_Raw) * rate;
    }
    // 시가 데이터가 0 이하로 오염되거나 빈 경우, 현재 꽂힌 실시간 시세로 강제 보정 복구 (0% 고착 버그로 인해 주석 처리)
    /*
    if (openPriceKRW <= 0) {
      openPriceKRW = newPrice;
      row.utc0_open_KRW = newPrice;
    }
    */
    if (openPriceKRW > 0) {
      const todayKrw = ((newPrice - openPriceKRW) / openPriceKRW) * 100;
      if (data.isUpbitRealtime) row.Change_Today_Upbit = todayKrw;
      else if (data.isBithumbRealtime) row.Change_Today_Bithumb = todayKrw;

      if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
        row.Change_Today_Raw = todayKrw;
      }
    }
  } else {
    let openPrice = 0;
    if (isFutures) {
      openPrice = parseFloat(row.futures_utc0_open_Raw || row.utc0_open_Raw || 0);
    } else {
      openPrice = parseFloat(row.spot_utc0_open_Raw || row.utc0_open_Raw || 0);
    }
    // 시가 데이터가 0 이하로 오염되거나 빈 경우, 현재 꽂힌 실시간 시세로 강제 보정 복구 (0% 고착 버그로 인해 주석 처리)
    /*
    if (openPrice <= 0) {
      openPrice = newPrice;
      if (isFutures) row.futures_utc0_open_Raw = newPrice;
      else row.spot_utc0_open_Raw = newPrice;
      row.utc0_open_Raw = newPrice;
    }
    */
    if (openPrice > 0) {
      const todayUsd = ((newPrice - openPrice) / openPrice) * 100;
      if (isFutures) row.Change_Today_Futures = todayUsd;
      else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot)
        row.Change_Today_Binance = todayUsd;
      else row.Change_Today_Bybit = todayUsd;

      if (shouldUpdateChg) {
        row.Change_Today_Raw = todayUsd;
      }
    }
  }

  // 🚀 [신규 방어막] 실시간 소켓 갱신 시각 기록 (3초 레이더의 낡은 캐시 덮어쓰기 원천 차단용)
  row._LastRealtimeUpdate = Date.now();
  row.Last_Updated_Source = '🔌 실시간소켓';

  if (!store.blockKimchi) {
    if (rate > 0) {
      const calcKimchi = (r) => {
        const exList = (r.Listed_Exchanges || []).map(e => e.toUpperCase());
        const hasUpbit = r.Upbit === "O" || exList.includes("UPBIT") || !!r.Upbit_Symbol;
        const hasBithumb = exList.includes("BITHUMB") || !!r.Bithumb_Symbol;
        const hasGlobal = r.Binance === "O" || r.Binance_Futures === "O" || exList.includes("BINANCE") || exList.includes("BINANCE_FUTURES") || exList.includes("BYBIT") || exList.includes("BYBIT_FUTURES") || !!r.Price_Raw;

        /*
        if (!hasGlobal || (!hasUpbit && !hasBithumb)) {
          r.Kimchi_Raw = null;
          r.Kimchi_Label = "-";
          r.Kimchi_Formatted = "-";
          const rowEl = store.rowDomMap ? store.rowDomMap.get(r.Ticker) : null;
          if (rowEl && typeof window.updateRowDynamicHTML === "function") {
            if (store.blockRowDynamicHTML) {
              if (store.bypassCounters) store.bypassCounters.dynamicHtml++;
              window.updateRowDynamicHTML(rowEl, r, true);
            } else {
              window.updateRowDynamicHTML(rowEl, r, false);
            }
          }
          return;
        }
        */

        let priceKor = 0;
        if (hasUpbit || hasBithumb) {
          // 🚀 [초정밀 UID 룩업] 다른 파일에서 시세를 덮어쓰고 복사하는 부작용 없이, 계산 시점에 동일 UID의 원화 코인 가격을 직접 읽어옵니다.
          // 🚀 수정 후 (타입 에러 방어용 초정밀 문자열 룩업)
          const krwRow = store.uidToKrwRowMap ? store.uidToKrwRowMap.get(String(r.UID)) : null;
          if (hasUpbit) {
            priceKor = (krwRow ? krwRow.Upbit_Price || krwRow.Price_KRW : 0) || r.Upbit_Price || r.Price_KRW || 0;
          } else if (hasBithumb) {
            priceKor = (krwRow ? krwRow.Bithumb_Price || krwRow.Price_KRW : 0) || r.Bithumb_Price || r.Price_KRW || 0;
          }
        }

        const domMult = getMultiplier(r.Upbit_Symbol || r.Bithumb_Symbol || r.Symbol || r.Ticker);
        const ovsMult = getMultiplier(r.Exact_Futures || r.Exact_Spot || r.Symbol || r.Ticker);
        const unitKorPrice = priceKor / domMult;
        const unitGlbPrice = (r.Price_Raw || 0) / ovsMult;

        if (unitKorPrice > 0 && unitGlbPrice > 0) {
          const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;
          if (isFinite(kimchiPct)) {
            r.Kimchi_Raw = kimchiPct;
            r.Kimchi_Label = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
            r.Kimchi_Formatted = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
            return;
          }
        }

        /*
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
          const rowEl = store.rowDomMap ? store.rowDomMap.get(r.Ticker) : null;
          if (rowEl && typeof window.updateRowDynamicHTML === "function") {
            if (store.blockRowDynamicHTML) {
              if (store.bypassCounters) store.bypassCounters.dynamicHtml++;
              window.updateRowDynamicHTML(rowEl, r, true);
            } else {
              window.updateRowDynamicHTML(rowEl, r, false);
            }
          }
        }
        */
      };

      calcKimchi(row);

      if (isKrwCoin) {
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        const partners = store.pureBaseToRowsMap ? store.pureBaseToRowsMap.get(pureBase) : null;
        if (partners) {
          partners.forEach((r) => {
            if (r !== row && r.Ticker.endsWith("KRW")) {
              r.Price_KRW = newPrice;
              if (data.isUpbitRealtime || tId.startsWith("KRW-") || tId.endsWith("KRW")) {
                r.Upbit_Price = newPrice;
              } else if (data.isBithumbRealtime || tId.endsWith("_KRW")) {
                r.Bithumb_Price = newPrice;
              }
              calcKimchi(r);
            }
          });
        }
      }
    }
  }

  // 🚀 실시간 거래대금(Volume) 누적 동기화
  if (isKoreaSocket) {
    if (data.q_upbit !== undefined) {
      row.Upbit_Vol = parseFloat(data.q_upbit);
      if (store.currencyMode === "KRW" && typeof window.formatVolumeKRW === "function") {
        row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
      } else if (typeof window.formatVolumeDollar === "function") {
        const rate = store.marketDataMap?.krw_usd_rate || 1350;
        row.Upbit_Vol_Formatted = window.formatVolumeDollar(rate > 0 ? row.Upbit_Vol / rate : row.Upbit_Vol);
      }
    }
  } else {
    if (data.e === "24hrMiniTicker") {
      if (isFutures) {
        row.Binance_Vol_Futures = parseFloat(data.q);
      } else {
        row.Binance_Vol_Spot = parseFloat(data.q);
      }
    }

    const activeM = store.currentChartMarket || store.currentMarket || "ALL";
    const currentVolModeIsFutures = (activeM === "FUTURES" || activeM === "BYBIT_FUTURES") && row.Spot_Only !== "O";
    const activeVol = currentVolModeIsFutures ? row.Binance_Vol_Futures : row.Binance_Vol_Spot;

    if (activeVol) {
      if (store.currencyMode === "KRW" && typeof window.formatVolumeKRW === "function") {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
      } else if (typeof window.formatVolumeDollar === "function") {
        row.Volume_Formatted = window.formatVolumeDollar(activeVol);
      }
    }
  }

  if (typeof window.syncRowPrioritizedMetrics === "function") {
    window.syncRowPrioritizedMetrics(row);
  }

  const isVisible =
    store.visibleSymbols.has(row.Ticker) ||
    store.visibleSymbols.has(row.Ticker.toUpperCase()) ||
    store.visibleSymbols.has(row.Ticker.toLowerCase()) ||
    store.visibleSymbols.has(row.Symbol) ||
    store.visibleSymbols.has(row.DisplayTicker);

  if (!isVisible) return;

  // 🚀 [상시 100ms 쓰로틀링 가드] 렉 유발 디버깅 방지 및 메모리 압축을 위해,
  // 100ms 이내에 과도하게 밀려오는 화면 그리기 요청을 원천 차단하고 바이패스시킴
  const renderNow = Date.now();
  if (!row._lastCellRenderTime) row._lastCellRenderTime = 0;
  if (renderNow - row._lastCellRenderTime < 250) {
    if (store.bypassCounters) store.bypassCounters.tableUpdate++;
    return;
  }
  row._lastCellRenderTime = renderNow;

  if (store.blockLeftDom === true) {
    const nowTime = Date.now();
    if (!row._lastStreamUpdate) row._lastStreamUpdate = 0;
    if (nowTime - row._lastStreamUpdate < 1000) {
      if (store.bypassCounters) store.bypassCounters.leftDom++;
      return;
    }
    row._lastStreamUpdate = nowTime;
  }

  window._realtimeRenderQueue.set(row.Ticker, () => {
    const priceCell = document.getElementById(`price-${row.Ticker}`);
    const oldPrice = priceCell ? parseFloat(priceCell.getAttribute("data-raw-price")) || 0 : 0;

    const rowEl = store.rowDomMap?.get(row.Ticker);
    if (rowEl && typeof window.updateRowDynamicHTML === "function") {
      window.updateRowDynamicHTML(rowEl, row, true);
    }

    if (!priceCell) return;

    const displayedPrice = parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

    if (displayedPrice !== oldPrice) {
      const activeExchange = priceCell.getAttribute("data-active-exchange");
      const activeSpan = document.getElementById(`price-val-${activeExchange}-${row.Ticker}`);
      if (activeSpan && typeof window.applyPriceFlash === "function") {
        window.applyPriceFlash(activeSpan, displayedPrice, oldPrice);
      }
    }

    if (
      row.Ticker === store.currentSelectedSymbol ||
      row.UID === store.currentSelectedSymbol
    ) {
      if (typeof window.updateHeaderDisplay === "function") {
        const pPrecision = store.getPrecision(row.Ticker);
        let activePrice = row.Price_Raw;
        const activeMkt = store.currentChartMarket || "ALL";
        if (activeMkt === "UPBIT") {
          activePrice = row.Upbit_Price;
        } else if (activeMkt === "BITHUMB") {
          activePrice = row.Bithumb_Price;
        } else if (activeMkt === "BYBIT" || activeMkt === "BYBIT_FUTURES") {
          activePrice = (activeMkt === "BYBIT_FUTURES") ? row.Bybit_Price_Futures : row.Bybit_Price_Spot;
        } else if (activeMkt === "FUTURES") {
          activePrice = row.Binance_Price_Futures;
        } else if (activeMkt === "SPOT") {
          activePrice = row.Binance_Price_Spot;
        }
        window.updateHeaderDisplay(row, activePrice, pPrecision, true);
      }
    }

    const changeCell = document.getElementById(`change-${row.Ticker}`);
    if (changeCell) {
      let change24h = row.Change_24h_Raw || 0;
      const isFocus = store.currentSortCol !== "Change_Today";
      const themeClass = change24h > 0 ? "text-theme-up" : change24h < 0 ? "text-theme-down" : "text-theme-text";
      const chgText = `${change24h > 0 ? "+" : ""}${change24h.toFixed(2)}%`;
      const chgFontSize = chgText.length > 7 ? "text-[8px]" : "text-[10px]";
      changeCell.className = `${themeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${chgFontSize}`;
      changeCell.textContent = chgText;
    }

    const todayCell = document.getElementById(`today-${row.Ticker}`);
    if (todayCell) {
      let todayChange = row.Change_Today_Raw || 0;
      const isFocus = store.currentSortCol === "Change_Today";
      const tThemeClass = todayChange > 0 ? "text-theme-up" : todayChange < 0 ? "text-theme-down" : "text-theme-text";
      const safeChange = todayChange < -99.9 ? -99.9 : todayChange;
      const todayText = `${safeChange > 0 ? "+" : ""}${safeChange.toFixed(2)}%`;
      const todayFontSize = todayText.length > 7 ? "text-[8px]" : "text-[10px]";
      todayCell.className = `${tThemeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${todayFontSize}`;
      todayCell.textContent = todayText;
    }
  });
}

window.renderRealtimeRow = renderRealtimeRow;
window.initSniperSocket = initSniperSocket;
window.syncSniperSubscriptions = syncSniperSubscriptions;
window.refreshSniperTarget = refreshSniperTarget;
