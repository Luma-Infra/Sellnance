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
  if (typeof window.initUpbitSniperSocket === "function") {
    window.initUpbitSniperSocket();
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
      (r) => r.Ticker === sym || r.DisplayTicker === sym || r.Symbol === sym
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
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() })
      );
      toSub.forEach((s) => store.activeSubs.add(s));
    }
    const toUnsub = Array.from(store.activeSubs).filter(
      (s) => !currentVisibleBinance.includes(s)
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
    if (now - lastTick < 100) { // 100ms 쓰로틀링 기동
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
    row = store.currentTableData.find((r) => r.UID == data.UID);
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
      const correctLocalRow = store.currentTableData.find((r) => r.UID == data.UID);
      if (correctLocalRow) {
        row = correctLocalRow;
      } else {
        return;
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

  if (isKoreaSocket && (row.utc0_open_KRW || (row.utc0_open_Raw && rate > 0))) {
    let openPriceKRW = row.utc0_open_KRW ? parseFloat(row.utc0_open_KRW) : 0;
    if (openPriceKRW <= 0 && row.utc0_open_Raw && rate > 0) {
      openPriceKRW = parseFloat(row.utc0_open_Raw) * rate;
    }
    if (openPriceKRW > 0) {
      const todayKrw = ((newPrice - openPriceKRW) / openPriceKRW) * 100;
      if (data.isUpbitRealtime) row.Change_Today_Upbit = todayKrw;
      else if (data.isBithumbRealtime) row.Change_Today_Bithumb = todayKrw;

      if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
        row.Change_Today_Raw = todayKrw;
      }
    }
  } else if (!isKoreaSocket) {
    let openPrice = 0;
    if (isFutures) {
      openPrice = parseFloat(row.futures_utc0_open_Raw || row.utc0_open_Raw || 0);
    } else {
      openPrice = parseFloat(row.spot_utc0_open_Raw || row.utc0_open_Raw || 0);
    }
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

  if (!store.blockKimchi) {
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
      };

      calcKimchi(row);

      if (isKrwCoin) {
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        store.currentTableData.forEach((r) => {
          if (r !== row && r.Ticker.endsWith("KRW") && (r.Upbit_Symbol === pureBase || getPureBase(r.Symbol) === pureBase)) {
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
    if (!priceCell) return;

    const oldPrice = parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

    if (typeof window.updateRowPriceDisplay === "function") {
      window.updateRowPriceDisplay(null, row);
    }

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
      const currentMarket = store.currentMarket || "ALL";
      let change24h = row.Change_24h_Raw || 0;
      if (currentMarket === "UPBIT") {
        change24h = row.Change_24h_Upbit ?? change24h;
      } else if (currentMarket === "BITHUMB") {
        change24h = row.Change_24h_Bithumb ?? change24h;
      } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
        change24h = row.Change_24h_Futures_Ex ?? change24h;
      } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
        change24h = (currentMarket === "SPOT" ? row.Change_24h_Binance : row.Change_24h_Bybit) ?? change24h;
      } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
        if (row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          change24h = row.Change_24h_Futures_Ex ?? change24h;
        } else if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
          change24h = row.Change_24h_Binance ?? change24h;
        } else {
          change24h = row.Change_24h_Upbit;
        }
      }

      const isFocus = store.currentSortCol !== "Change_Today";
      const themeClass = change24h > 0 ? "text-theme-up" : change24h < 0 ? "text-theme-down" : "text-theme-text";
      const chgText = `${change24h > 0 ? "+" : ""}${change24h.toFixed(2)}%`;
      const chgFontSize = chgText.length > 7 ? "text-[8px]" : "text-[10px]";
      changeCell.className = `${themeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${chgFontSize}`;
      changeCell.textContent = chgText;
    }

    const todayCell = document.getElementById(`today-${row.Ticker}`);
    if (todayCell) {
      const currentMarket = store.currentMarket || "ALL";
      let todayChange = row.Change_Today_Raw || 0;
      if (currentMarket === "UPBIT") {
        todayChange = row.Change_Today_Upbit ?? todayChange;
      } else if (currentMarket === "BITHUMB") {
        todayChange = row.Change_Today_Bithumb ?? todayChange;
      } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
        todayChange = row.Change_Today_Futures ?? todayChange;
      } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
        todayChange = (currentMarket === "SPOT" ? row.Change_Today_Binance : row.Change_Today_Bybit) ?? todayChange;
      } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
        if (row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          todayChange = row.Change_Today_Futures ?? todayChange;
        } else if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
          todayChange = row.Change_Today_Binance ?? todayChange;
        } else {
          todayChange = row.Change_Today_Upbit ?? todayChange;
        }
      }

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
