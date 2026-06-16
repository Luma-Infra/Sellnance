// stream.js
// --- 🌊 실시간 웹소켓 엔진 관제탑 (Orchestrator) ---
import { store, tfSec } from "./_store.js";
import { getMultiplier } from "./chart_utils.js";

// 하위 스트림 엔진들 통합 로드
import "./stream_table.js";
import "./stream_korea.js";
import "./stream_global.js";

// 🚀 [신규] 렌더링 과부하 방지용 쓰로틀 메모리
const lastRenderMap = new Map();

// ⚡ [HTS 핵심] 개별 행 정밀 렌더링 엔진 (웹소켓 전용)
function renderRealtimeRow(tId, data, isFutures = false) {
  const now = Date.now();
  const lastRender = lastRenderMap.get(tId) || 0;

  // 🚀 [해결] PEPE vs 1000PEPE, XRP vs XRPDOWN 등 심볼 헷갈림 방지 (널뛰기 버그 컷)
  const dataSym = (data.s || tId).toUpperCase();

  // 🚀 [단일 진실 공급원 O(1) 광속 탐색]
  let row = store.tickerRowMap.get(dataSym);
  if (!row && (dataSym.startsWith("KRW-") || tId.startsWith("KRW-"))) {
    const upbitTicker = tId.replace("KRW-", "") + "KRW";
    row = store.tickerRowMap.get(upbitTicker);
  }

  if (!row) return;

  // 🚨 [최종 수문장] PEPE vs 1000PEPE 등 배수 기호가 다르면 다른 코인임 (오염 차단)
  if (getMultiplier(dataSym) !== getMultiplier(row.Ticker)) return;

  const newPrice = parseFloat(data.c || data.p);
  if (isNaN(newPrice)) return;

  const isKrwCoin =
    row.Ticker.endsWith("KRW") ||
    data.isUpbitRealtime ||
    tId.startsWith("KRW-");
  const rate = store.marketDataMap?.krw_usd_rate || 0;

  if (isKrwCoin) {
    row.Price_KRW = newPrice;
    row.Price_Raw = newPrice / rate;
    if (data.isUpbitRealtime) {
      row.Upbit_Price = newPrice;
    } else if (data.isBithumbRealtime) {
      row.Bithumb_Price = newPrice;
    } else {
      if (row.Upbit === "O" && store.currentMarket !== "BITHUMB") {
        row.Upbit_Price = newPrice;
      } else {
        row.Bithumb_Price = newPrice;
      }
    }
  } else {
    const isAllMode =
      store.currentMarket === "ALL" ||
      store.currentMarket === "KIMCHI" ||
      store.currentMarket === "NEW";
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    const isFuturesOnly = row.Binance === "X" && row.Binance_Futures === "O";

    let shouldUpdate = false;
    if (isAllMode) {
      if (isFuturesOnly) {
        shouldUpdate = isFutures;
      } else {
        shouldUpdate = !isFutures;
      }
    } else {
      shouldUpdate = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }

    if (
      row.Listed_Exchanges?.includes("BINANCE") ||
      row.Exact_Spot ||
      row.Exact_Futures
    ) {
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
  }

  // 🚀 [추가] 실시간 등락률 오염 방어용 분기 결정
  let shouldUpdateChg = false;
  if (isKrwCoin) {
    if (store.currentMarket === "UPBIT") {
      shouldUpdateChg =
        data.isUpbitRealtime || (row.Upbit === "O" && !data.isBithumbRealtime);
    } else if (store.currentMarket === "BITHUMB") {
      shouldUpdateChg =
        data.isBithumbRealtime || (row.Upbit !== "O" && !data.isUpbitRealtime);
    } else {
      // ALL, KIMCHI 등
      if (row.Upbit === "O") {
        shouldUpdateChg = data.isUpbitRealtime || !data.isBithumbRealtime;
      } else {
        shouldUpdateChg = data.isBithumbRealtime || !data.isUpbitRealtime;
      }
    }
  } else {
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    const isAllMode =
      store.currentMarket === "ALL" ||
      store.currentMarket === "KIMCHI" ||
      store.currentMarket === "NEW";
    const isFuturesOnly = row.Binance === "X" && row.Binance_Futures === "O";
    if (isAllMode) {
      shouldUpdateChg = isFuturesOnly ? isFutures : !isFutures;
    } else {
      shouldUpdateChg = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }
  }

  if (data.P !== undefined) {
    const chg = parseFloat(data.P);
    if (isKrwCoin) {
      if (data.isUpbitRealtime) row.Change_24h_Upbit = chg;
      else if (data.isBithumbRealtime) row.Change_24h_Bithumb = chg;
      else if (row.Upbit === "O" && store.currentMarket !== "BITHUMB")
        row.Change_24h_Upbit = chg;
      else row.Change_24h_Bithumb = chg;
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
      row.Change_24h_Raw = chg;
    }
  }

  if (isKrwCoin && row.utc0_open_KRW) {
    const openPriceKRW = parseFloat(row.utc0_open_KRW);
    if (openPriceKRW > 0) {
      const todayKrw = ((newPrice - openPriceKRW) / openPriceKRW) * 100;
      if (data.isUpbitRealtime) row.Change_Today_Upbit = todayKrw;
      else if (data.isBithumbRealtime) row.Change_Today_Bithumb = todayKrw;
      else if (row.Upbit === "O" && store.currentMarket !== "BITHUMB")
        row.Change_Today_Upbit = todayKrw;
      else row.Change_Today_Bithumb = todayKrw;

      if (shouldUpdateChg) {
        row.Change_Today_Raw = todayKrw;
      }
    }
  } else if (row.utc0_open_Raw) {
    const openPrice = parseFloat(row.utc0_open_Raw);
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

  const p = store.getPrecision(row.Ticker);

  // 🚀 [제거] 테이블 실시간 소켓에서 우측 헤더를 직접 업데이트하면 차트 소켓과 충돌하여 값이 널뛰는 원인이 됩니다.
  // 헤더 갱신은 오직 chart_utils.js::updateStatus(차트 전용 소켓)에서 단일 진실 공급원으로 통제합니다!
  if (
    row.Ticker === store.currentSelectedSymbol ||
    row.UID === store.currentSelectedSymbol
  ) {
    if (typeof window.updateHeaderDisplay === "function") {
      window.updateHeaderDisplay(row, undefined, p, true);
    }
  }

  if (!store.visibleSymbols.has(row.Ticker)) return;

  const isFirstRender = !lastRenderMap.has(tId);
  if (!isFirstRender && now - lastRender < 500) return;
  lastRenderMap.set(tId, now);

  const priceCell = document.getElementById(`price-${row.Ticker}`);
  if (!priceCell) return;

  const oldPrice = parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

  if (typeof window.updateRowPriceDisplay === "function") {
    window.updateRowPriceDisplay(null, row);
  }

  const displayedPrice =
    parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

  if (displayedPrice !== oldPrice) {
    const activeExchange = priceCell.getAttribute("data-active-exchange");
    const activeSpan = document.getElementById(
      `price-val-${activeExchange}-${row.Ticker}`,
    );
    if (activeSpan && typeof window.applyPriceFlash === "function") {
      window.applyPriceFlash(activeSpan, displayedPrice, oldPrice);
    }
  }

  const changeCell = document.getElementById(`change-${row.Ticker}`);
  if (changeCell) {
    const change24h = row.Change_24h_Raw || 0;
    const isFocus = store.currentSortCol !== "Change_Today";
    const themeClass =
      change24h > 0
        ? "text-theme-up"
        : change24h < 0
          ? "text-theme-down"
          : "text-theme-text";
    const chgText = `${change24h > 0 ? "+" : ""}${change24h.toFixed(2)}%`;
    const chgFontSize = chgText.length > 7 ? "text-[8px]" : "text-[10px]";
    changeCell.className = `${themeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${chgFontSize}`;
    changeCell.textContent = chgText;
  }

  const todayCell = document.getElementById(`today-${row.Ticker}`);
  if (todayCell && row.Change_Today_Raw !== undefined) {
    const todayChange = row.Change_Today_Raw;
    const isFocus = store.currentSortCol === "Change_Today";
    const tThemeClass =
      todayChange > 0
        ? "text-theme-up"
        : todayChange < 0
          ? "text-theme-down"
          : "text-theme-text";
    const safeChange = todayChange < -99.9 ? -99.9 : todayChange;
    const todayText = `${safeChange > 0 ? "+" : ""}${safeChange.toFixed(2)}%`;
    const todayFontSize = todayText.length > 7 ? "text-[8px]" : "text-[10px]";
    todayCell.className = `${tThemeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${todayFontSize}`;
    todayCell.textContent = todayText;
  }

  const binanceVolCell = document.getElementById(`vol-binance-${row.Ticker}`);
  if (binanceVolCell && data.q && data.e !== "aggTrade") {
    if (isFutures) {
      row.Binance_Vol_Futures = parseFloat(data.q);
    } else {
      row.Binance_Vol_Spot = parseFloat(data.q);
    }

    const currentVolModeIsFutures =
      store.currentMarket === "FUTURES" && row.Spot_Only !== "O";
    const isMatchingMode = currentVolModeIsFutures === isFutures;

    if (isMatchingMode) {
      const activeVol = isFutures
        ? row.Binance_Vol_Futures
        : row.Binance_Vol_Spot;
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
  const upbitVolCell = document.getElementById(`vol-upbit-${row.Ticker}`);
  if (upbitVolCell && data.q_upbit && data.e !== "aggTrade") {
    row.Upbit_Vol = parseFloat(data.q_upbit);
    if (
      store.currencyMode === "KRW" &&
      typeof window.formatVolumeKRW === "function"
    ) {
      row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
    } else if (typeof window.formatVolumeDollar === "function") {
      const rate = store.marketDataMap?.krw_usd_rate || 1;
      row.Upbit_Vol_Formatted = window.formatVolumeDollar(
        row.Upbit_Vol / (rate > 0 ? rate : 1),
      );
    }
    upbitVolCell.innerText = row.Upbit_Vol_Formatted || "-";
  }
}

window.renderRealtimeRow = renderRealtimeRow;

export function getUpbitCandleStartTime(serverMs, tf) {
  const d = new Date(serverMs);
  const sec = tfSec[tf] || 60;
  if (tf.includes("d") || tf.includes("w") || tf.includes("M")) {
    d.setUTCHours(0, 0, 0, 0);
    if (tf === "1w") {
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
    } else if (tf === "1M") d.setUTCDate(1);
  } else {
    const timestamp = Math.floor(serverMs / 1000);
    return Math.floor(timestamp / sec) * sec;
  }
  return Math.floor(d.getTime() / 1000);
}

if (store.radarIntervalId) clearInterval(store.radarIntervalId);
store.radarIntervalId = setInterval(() => {
  if (Object.keys(store.tickerBuffer).length === 0) return;
  const snapshot = { ...store.tickerBuffer };
  store.tickerBuffer = {};

  let dataUpdated = false;
  store.currentTableData.forEach((row) => {
    const isKrwCoin = row.Ticker.endsWith("KRW");
    let ticker = null;
    let isFuturesTicker = false;

    if (isKrwCoin) {
      ticker =
        snapshot[`KRW-${row.Ticker.replace("KRW", "")}`] ||
        snapshot[row.Ticker];
    } else {
      const hasFutures =
        row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
        row.Listed_Exchanges?.includes("BYBIT_FUTURES");
      const useFutures =
        store.currentMarket === "FUTURES" &&
        hasFutures &&
        row.Spot_Only !== "O";
      const lookupKey = useFutures ? row.Ticker + "_FUTURES" : row.Ticker;
      ticker = snapshot[lookupKey];
      isFuturesTicker = useFutures;
    }

    if (!ticker) return;

    if (isKrwCoin) {
      const rate = store.marketDataMap?.krw_usd_rate || 0;
      row.Price_KRW = parseFloat(ticker.c);
      row.Price_Raw = row.Price_KRW / rate;
      if (row.Upbit === "O" || store.currentMarket !== "BITHUMB") {
        row.Upbit_Price = row.Price_KRW;
      } else {
        row.Bithumb_Price = row.Price_KRW;
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
    row.Change_24h_Raw = chg;

    if (isKrwCoin) {
      if (row.Upbit === "O" || store.currentMarket !== "BITHUMB") {
        row.Change_24h_Upbit = chg;
      } else {
        row.Change_24h_Bithumb = chg;
      }
    } else {
      if (isFuturesTicker) {
        row.Change_24h_Futures_Ex = chg;
      } else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot) {
        row.Change_24h_Binance = chg;
      } else {
        row.Change_24h_Bybit = chg;
      }
    }

    // 🚀 바이낸스 현물 / 선물 거래대금 분리 누적 반영
    const spotKey = row.Ticker;
    const futuresKey = row.Ticker + "_FUTURES";

    if (snapshot[spotKey] && snapshot[spotKey].q) {
      row.Binance_Vol_Spot = parseFloat(snapshot[spotKey].q);
    }
    if (snapshot[futuresKey] && snapshot[futuresKey].q) {
      row.Binance_Vol_Futures = parseFloat(snapshot[futuresKey].q);
    }

    const currentVolModeIsFutures =
      store.currentMarket === "FUTURES" && row.Spot_Only !== "O";
    const activeVol = currentVolModeIsFutures
      ? row.Binance_Vol_Futures || 0
      : row.Binance_Vol_Spot || 0;

    if (activeVol > 0) {
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
      } else if (typeof window.formatVolumeDollar === "function") {
        row.Volume_Formatted = window.formatVolumeDollar(activeVol);
      }
    }

    if (ticker.q_upbit) {
      row.Upbit_Vol = parseFloat(ticker.q_upbit);
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
      } else if (typeof window.formatVolumeDollar === "function") {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Upbit_Vol_Formatted = window.formatVolumeDollar(
          row.Upbit_Vol / (rate > 0 ? rate : 1),
        );
      }
    }

    if (isKrwCoin && row.utc0_open_KRW) {
      const openPriceKRW = parseFloat(row.utc0_open_KRW);
      if (openPriceKRW > 0 && row.Price_KRW) {
        const todayKrw = ((row.Price_KRW - openPriceKRW) / openPriceKRW) * 100;
        row.Change_Today_Raw = todayKrw;
        if (row.Upbit === "O" || store.currentMarket !== "BITHUMB") {
          row.Change_Today_Upbit = todayKrw;
        } else {
          row.Change_Today_Bithumb = todayKrw;
        }
      }
    } else if (row.utc0_open_Raw) {
      const open = parseFloat(row.utc0_open_Raw);
      if (open > 0)
        row.Change_Today_Raw = ((row.Price_Raw - open) / open) * 100;
    }

    /*
    if (
      (row.Ticker === store.currentSelectedSymbol ||
       row.UID === store.currentSelectedSymbol) &&
      typeof window.updateHeaderDisplay === "function"
    ) {
      const p = store.getPrecision(row.Ticker);
      window.updateHeaderDisplay(row, undefined, p);
    }
    */

    dataUpdated = true;
  });
}, 3000);
