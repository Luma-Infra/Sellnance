// chart_fetch.js - 🚀 메인 차트 초기화 및 히스토리컬 캔들 페칭/조립 전담 엔진
import { store, tfSec } from "./_store.js";
import {
  getPureBase,
  formatCrosshairPrice,
  sanitizeChartData,
  rebuildMainDataMap,
  rebuildVolumeDataMap,
} from "./chart_utils.js";
import { findRowInfo, determineListingDate } from "./chart_history_helper.js";
import { updateExchangeBadges } from "./ui_control.js";
import { applyChartLayout } from "./chart_layout.js";
import { fetchCandlesSmart, clearChartData, mapTime } from "./chart_data.js";
import { isExchangeNativeTF } from "./_market_rules.js";

export async function fetchHistory(
  symbol,
  isTfChange = false,
  isTabRestore = false,
  isSubSwitch = false,
  targetUid = null,
  isSilentSync = false,
) {
  const now = Date.now();
  if (now - store.lastFetchTime < 100) return;
  store.lastFetchTime = now;

  if (!isSubSwitch && !isSilentSync) {
    if (!isTfChange) {
      store.preferredKimchiSub = null;
    }
    store.isPriceScaleUserZoomed = false;
    store.isVolPriceScaleUserZoomed = false;
    store.isKimchiPriceScaleUserZoomed = false;
    store.savedPriceScaleWidth = null;
    store.savedLeftPriceScaleWidth = null;
    if (typeof window.updateScaleModeButtonsUI === "function") {
      window.updateScaleModeButtonsUI();
    }
  }

  // [신규 차트 로딩 시 진행 중이던 과거 데이터 레이지 로딩 즉시 취소 및 인디케이터 은닉]
  store.chartSessionId = ((store.chartSessionId || 0) + 1) % 10000;
  store.isLoadingMoreHistory = false;
  const lazyIndicator = document.getElementById("chart-lazy-loading-indicator");
  if (lazyIndicator) {
    lazyIndicator.classList.remove("opacity-100", "scale-100");
    lazyIndicator.classList.add("opacity-0", "scale-95", "pointer-events-none");
  }

  if (typeof window.resetActivePointerChart === "function") {
    window.resetActivePointerChart();
  }

  if (!isSilentSync) {
    store.isFetchingChart = true;
    window.isFetchingChart = true;
  } else {
    store.isSilentSyncing = true;
  }
  if (!isSubSwitch && !isSilentSync) {
    clearChartData(isTfChange);
  }

  let displayName = symbol || store.currentAsset;
  if (!displayName) {
    store.isFetchingChart = false;
    window.isFetchingChart = false;
    store.isSilentSyncing = false;
    return;
  }

  // 🚀 트레이딩뷰 라우팅 스타일 (EXCHANGE:SYMBOL_MARKET 또는 EXCHANGE:SYMBOL) 즉시 분해 및 정규화
  if (displayName.includes(":")) {
    const parts = displayName.split(":");
    const exPart = parts[0].trim().toUpperCase();
    let symPart = parts[1].trim();

    if (symPart.endsWith("_FUTURES")) {
      symPart = symPart.replace(/_FUTURES$/i, "");
      store.currentChartMarket = exPart === "BYBIT" ? "BYBIT_FUTURES" : "FUTURES";
    } else if (symPart.endsWith("_SPOT")) {
      symPart = symPart.replace(/_SPOT$/i, "");
      store.currentChartMarket = exPart === "BYBIT" ? "BYBIT" : "SPOT";
    } else if (exPart === "UPBIT") {
      store.currentChartMarket = "UPBIT";
    } else if (exPart === "BITHUMB") {
      store.currentChartMarket = "BITHUMB";
    } else if (exPart === "BINANCE") {
      store.currentChartMarket = "FUTURES";
    } else if (exPart === "BYBIT") {
      store.currentChartMarket = "BYBIT_FUTURES";
    } else if (exPart === "GATEIO") {
      store.currentChartMarket = symPart.endsWith("_SPOT") ? "GATE_SPOT" : "GATE_FUTURES";
    }
    displayName = symPart;
  }

  if (displayName.endsWith("_FUTURES")) {
    displayName = displayName.replace(/_FUTURES$/i, "");
    if (!store.currentChartMarket || store.currentChartMarket === "ALL") store.currentChartMarket = "FUTURES";
  } else if (displayName.endsWith("_SPOT")) {
    displayName = displayName.replace(/_SPOT$/i, "");
    if (!store.currentChartMarket || store.currentChartMarket === "ALL") store.currentChartMarket = "SPOT";
  } else if (displayName.endsWith("_UPBIT")) {
    displayName = displayName.replace(/_UPBIT$/i, "");
    store.currentChartMarket = "UPBIT";
  } else if (displayName.endsWith("_BITHUMB")) {
    displayName = displayName.replace(/_BITHUMB$/i, "");
    store.currentChartMarket = "BITHUMB";
  }

  const rawSymbol = displayName.split("(")[0].trim().toUpperCase();
  store.currentAsset = displayName;

  if (store.currentChartMarket === "ALL" || !store.currentChartMarket) store.currentChartMarket = "FUTURES";
  if (store.currentChartMarket === "BINANCE") store.currentChartMarket = "FUTURES";
  if (store.currentChartMarket === "BINANCE_FUTURES") store.currentChartMarket = "FUTURES";

  const isFutures = store.currentChartMarket === "FUTURES" || store.currentChartMarket === "BINANCE_FUTURES";
  const isSpot = store.currentChartMarket === "SPOT" || store.currentChartMarket === "BINANCE";
  const isUpbit = store.currentChartMarket === "UPBIT";
  const isBithumb = store.currentChartMarket === "BITHUMB";
  const isBybit =
    store.currentChartMarket === "BYBIT" || store.currentChartMarket === "BYBIT_FUTURES";
  const isBybitFutures = store.currentChartMarket === "BYBIT_FUTURES";
  const isGate = store.currentChartMarket === "GATE_SPOT" || store.currentChartMarket === "GATE_FUTURES";
  const isGateFutures = store.currentChartMarket === "GATE_FUTURES";

  const pureBase = getPureBase(rawSymbol)
    .replace(/KRW$/, "")
    .replace(/USDT$/, "");

  const exchangeFlags = { isFutures, isSpot, isUpbit, isBithumb, isBybit, isBybitFutures };

  // 🚀 [역할 분리] UID 및 거래소 태그 매칭 rowInfo 찾기 도우미 호출
  const rowInfo = findRowInfo(displayName, pureBase, exchangeFlags, targetUid || store.currentSelectedUid);
  if (rowInfo?.UID) {
    store.currentSelectedUid = rowInfo.UID;
  }

  const uniqueTicker = rowInfo ? rowInfo.Ticker : displayName;

  let exactSpot = rowInfo?.Exact_Spot || pureBase;
  let exactFutures = rowInfo?.Exact_Futures || (displayName.match(/^10+/i) ? displayName : pureBase);
  let exactUpbit = rowInfo?.Upbit_Symbol || rowInfo?.Symbol || pureBase;
  let exactBithumb = rowInfo?.Bithumb_Symbol || pureBase;
  let exactBybit = rowInfo?.Bybit_Symbol || (isBybitFutures ? (rowInfo?.Exact_Futures || (displayName.match(/^10+/i) ? displayName : pureBase)) : (rowInfo?.Exact_Spot || pureBase));

  const dupList = store.marketDataMap?.duplicated_list;
  const uid = rowInfo?.UID;
  if (uid && dupList) {
    for (const [key, v] of Object.entries(dupList)) {
      if (Array.isArray(v) && v.length >= 4 && v[0] === uid) {
        const exName = v[3].toUpperCase();
        if (exName === "UPBIT") {
          exactUpbit = v[2];
        } else if (exName === "BITHUMB") {
          exactBithumb = v[2];
        } else if (exName === "BYBIT" || exName === "BYBIT_SPOT") {
          exactBybit = v[2];
        } else if (exName === "BINANCE_SPOT") {
          exactSpot = v[2].replace("USDT", "");
        } else if (exName === "BINANCE_FUTURES") {
          exactFutures = v[2].replace("USDT", "");
        } else if (exName === "BINANCE") {
          const clean = v[2].replace("USDT", "");
          exactSpot = clean;
          exactFutures = clean;
        }
      }
    }
  }

  const binanceTicker = isFutures ? `${exactFutures}USDT` : `${exactSpot}USDT`;
  const krwTicker = isBithumb ? `${exactBithumb}_KRW` : `KRW-${exactUpbit}`;

  const mainTickerStr = isFutures
    ? exactFutures
    : isSpot
      ? exactSpot
      : isUpbit
        ? exactUpbit
        : isBithumb
          ? exactBithumb
          : exactBybit;

  const loadingModal = document.getElementById("chart-loading-modal");
  const wrapper = document.getElementById("chart-wrapper");
  if (wrapper && !isTfChange && !isSilentSync) wrapper.classList.add("chart-loading");

  const pastGapMap = store.marketDataMap?.past_gap_map || {};
  let gapOverlay = document.getElementById("gap-recovery-overlay");

  if (pastGapMap[pureBase] && !isTfChange && !isSilentSync) {
    if (!gapOverlay) {
      gapOverlay = document.createElement("div");
      gapOverlay.id = "gap-recovery-overlay";
      gapOverlay.className =
        "absolute inset-0 z-50 flex flex-col items-center justify-center bg-theme-bg/60 backdrop-blur-sm transition-all duration-300";
      gapOverlay.innerHTML = `
        <div class="flex flex-col items-center gap-3 p-6 rounded-2xl bg-theme-panel/60 border border-theme-border shadow-2xl text-center">
          <div class="w-10 h-10 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
          <div class="flex flex-col gap-1">
            <span class="text-[15px] font-medium text-theme-accent tracking-wider uppercase">라이브러리 호출 중...</span>
            <span class="text-[11px] font-medium text-theme-text opacity-60 tracking-tighter">과거 차트 단절 구간을 채우는 중이에요</span>
          </div>
        </div>
      `;
      if (wrapper) wrapper.appendChild(gapOverlay);
    }
    gapOverlay.style.display = "flex";
  } else {
    if (gapOverlay) gapOverlay.style.display = "none";
  }

  try {
    store.hasPlacedDeer = false;

    const snapshotAsset = store.currentAsset;
    const snapshotTF = store.currentTF;
    let rawMain = [];
    let mainStep = 1;
    let fetchInterval;
    let newMainData = [];
    let newVolumeData = [];

    const style = getComputedStyle(document.body);
    const upColorVol =
      (style.getPropertyValue("--up").trim() || "#26a69a") + "80";
    const downColorVol =
      (style.getPropertyValue("--down").trim() || "#ef5350") + "80";

    // 1️⃣ 데이터 수집 (스위처 클릭 시에는 이미 화면에 있는 메인 캔들 100% 재활용하여 메인 거래소 fetch 0% 생략)
    const canReuseMain = isSubSwitch && store.mainData && store.mainData.length > 0;
    if (canReuseMain) {
      rawMain = [...store.mainData];
      newMainData = [...store.mainData];
      newVolumeData = store.volumeData ? [...store.volumeData] : [];
    } else if (isFutures || isSpot || isBybit) {
      const exchange = isFutures
        ? "binance_futures"
        : isBybitFutures
          ? "bybit_futures"
          : isBybit
            ? "bybit_spot"
            : "binance_spot";
      const ticker = isBybit ? `${exactBybit}USDT` : binanceTicker;
      const raw = await fetchCandlesSmart(
        exchange,
        ticker,
        store.currentTF,
        500,
      );

      let combinedRaw = raw;

      if (isBybit && raw.result?.list) {
        rawMain = raw.result.list
          .map((d) => ({
            time: Number(d[0]) / 1000,
            open: Number(d[1]),
            high: Number(d[2]),
            low: Number(d[3]),
            close: Number(d[4]),
            vol: Number(d[5]),
          }))
          .sort((a, b) => a.time - b.time);

        if (rawMain.length === 0 && isBybitFutures) {
          const rawFallback = await fetchCandlesSmart(
            "bybit_spot",
            `${exactSpot || pureBase}USDT`,
            store.currentTF,
            500,
          );
          if (rawFallback?.result?.list?.length > 0) {
            rawMain = rawFallback.result.list
              .map((d) => ({
                time: Number(d[0]) / 1000,
                open: Number(d[1]),
                high: Number(d[2]),
                low: Number(d[3]),
                close: Number(d[4]),
                vol: Number(d[5]),
              }))
              .sort((a, b) => a.time - b.time);
          }
        }
      } else if (Array.isArray(combinedRaw)) {
        rawMain = combinedRaw.map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
          vol: Number(d[5]),
        }));
      }
    } else if (isBithumb) {
      let bFetchTf = store.currentTF;
      if (store.currentTF === "3d") {
        bFetchTf = "1d";
        mainStep = 3;
      } else if (store.currentTF === "12h") {
        bFetchTf = "4h";
        mainStep = 3;
      } else {
        mainStep = 1;
      }
      const bData = await fetchCandlesSmart("bithumb", krwTicker, bFetchTf, 1000);
      const rawList = Array.isArray(bData?.data) ? bData.data : (Array.isArray(bData) ? bData : []);
      rawMain = rawList
        .map((d) => ({
          time: Math.floor(Number(d[0]) / 1000),
          open: Number(d[1]),
          close: Number(d[2]),
          high: Number(d[3]),
          low: Number(d[4]),
          vol: Number(d[5]),
        }))
        .sort((a, b) => a.time - b.time);
    } else if (isGate) {
      const exName = isGateFutures ? "gateio_futures" : "gateio_spot";
      const gateSym = isGateFutures ? `${pureBase}USDT.P` : `${pureBase}USDT`;

      let fetchTf = store.currentTF;
      if (store.currentTF === "3d") {
        fetchTf = "1d";
        mainStep = 3;
      } else if (store.currentTF === "12h") {
        fetchTf = "4h";
        mainStep = 3;
      } else {
        mainStep = 1;
      }

      const raw = await fetchCandlesSmart(
        exName,
        gateSym,
        fetchTf,
        1000,
      );
      if (Array.isArray(raw)) {
        rawMain = raw.map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
          vol: Number(d[5]),
        })).sort((a, b) => a.time - b.time);
      }
    } else if (isUpbit) {
      const supportedMin = [1, 3, 5, 10, 15, 30, 60, 240];
      const totalSec = tfSec[store.currentTF] || 60;
      const u = store.currentTF.replace(/[0-9]/g, "");
      if (u === "d" || u === "w" || u === "M") {
        fetchInterval = u === "w" ? "weeks" : u === "M" ? "months" : "days";
        mainStep = store.currentTF === "3d" ? 3 : 1;
      } else {
        const targetMin = totalSec / 60;
        const baseMin =
          supportedMin.reverse().find((m) => targetMin % m === 0) || 1;
        fetchInterval = `minutes/${baseMin}`;
        mainStep = targetMin / baseMin;
      }
      const raw = await fetchCandlesSmart(
        "upbit",
        krwTicker,
        fetchInterval,
        500,
      );
      if (Array.isArray(raw)) {
        rawMain = raw
          .map((d) => ({
            time: new Date(d.candle_date_time_utc + "Z").getTime() / 1000,
            open: d.opening_price,
            high: d.high_price,
            low: d.low_price,
            close: d.trade_price,
            vol: d.candle_acc_trade_volume,
          }))
          .sort((a, b) => a.time - b.time);
      }
    }

    if (!canReuseMain && (!rawMain || rawMain.length === 0)) {
      // 🚀 [1순위 해외 거래소 폴백] 바이빗 데이터 부재 시: 바이낸스 선물 -> 바이낸스 현물 -> 국내 거래소 순으로 지능적 폴백
      if (isBybit) {
        if (rowInfo?.Listed_Exchanges?.includes("BINANCE_FUTURES") || rowInfo?.Binance_Futures === "O") {
          //Xconsole.warn(`⚠️ 바이빗 데이터 없음 (${exactBybit}), 바이낸스 선물 폴백 시도`);
          store.currentChartMarket = "FUTURES";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
        if (rowInfo?.Listed_Exchanges?.includes("BINANCE") || rowInfo?.Binance === "O") {
          //Xconsole.warn(`⚠️ 바이빗 데이터 없음 (${exactBybit}), 바이낸스 현물 폴백 시도`);
          store.currentChartMarket = "SPOT";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
        if (rowInfo?.Listed_Exchanges?.includes("UPBIT") || rowInfo?.Upbit === "O") {
          //Xconsole.warn(`⚠️ 바이빗 데이터 없음 (${exactBybit}), 업비트 폴백 시도`);
          store.currentChartMarket = "UPBIT";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
        if (rowInfo?.Listed_Exchanges?.includes("BITHUMB")) {
          //Xconsole.warn(`⚠️ 바이빗 데이터 없음 (${exactBybit}), 빗썸 폴백 시도`);
          store.currentChartMarket = "BITHUMB";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
      }

      // 🚀 [선물 전용 코인 폴백] 바이낸스 현물 데이터 부재 시 (1000SATS, SKR 등 선물 전용 코인): 바이낸스 선물로 자동 전환
      if (isSpot) {
        const canFallbackFutures = !rowInfo || rowInfo?.Listed_Exchanges?.includes("BINANCE_FUTURES") || rowInfo?.Binance_Futures === "O";
        if (canFallbackFutures) {
          //Xconsole.warn(`⚠️ 바이낸스 현물 데이터 없음 (${exactSpot}), 바이낸스 선물 폴백 시도`);
          store.currentChartMarket = "FUTURES";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
      }

      // 🚀 [국내/현물 전용 코인 폴백] 바이낸스 선물 데이터 부재 시: 업비트 -> 빗썸 -> 현물 순으로 자동 전환
      if (isFutures) {
        if (rowInfo?.Listed_Exchanges?.includes("UPBIT") || rowInfo?.Upbit === "O") {
          //Xconsole.warn(`⚠️ 바이낸스 선물 데이터 없음 (${displayName}), 업비트 폴백 시도`);
          store.currentChartMarket = "UPBIT";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
        if (rowInfo?.Listed_Exchanges?.includes("BITHUMB")) {
          //Xconsole.warn(`⚠️ 바이낸스 선물 데이터 없음 (${displayName}), 빗썸 폴백 시도`);
          store.currentChartMarket = "BITHUMB";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
        if (rowInfo?.Listed_Exchanges?.includes("BINANCE") || rowInfo?.Binance === "O") {
          //Xconsole.warn(`⚠️ 바이낸스 선물 데이터 없음 (${displayName}), 바이낸스 현물 폴백 시도`);
          store.currentChartMarket = "SPOT";
          updateExchangeBadges(displayName, rowInfo?.UID);
          store.lastFetchTime = 0;
          fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
          return;
        }
      }

      //Xconsole.warn(`⚠️ [No Data] ${displayName} / ${store.currentChartMarket} - 차트 데이터 없음`,);
      store.isFetchingChart = false;
      window.isFetchingChart = false;
      if (loadingModal) loadingModal.classList.add("hidden");
      if (wrapper) wrapper.classList.remove("chart-loading");
      return;
    }

    // 🚀 [역할 분리] 상장일(Listing Date) 판단 및 갱신 도우미 함수 호출
    determineListingDate(rawMain, rowInfo, pureBase, exchangeFlags);

    // 2️⃣ 조립
    if (!canReuseMain) {
      newMainData = [];
      newVolumeData = [];
    }

    const currentExchange = isFutures
      ? "binance_futures"
      : isBybitFutures
        ? "bybit_futures"
        : isBybit
          ? "bybit_spot"
          : isSpot
            ? "binance_spot"
            : isUpbit
              ? "upbit"
              : isBithumb
                ? "bithumb"
                : isGate
                  ? "gateio"
                  : "binance_futures";

    const isNativeDirectCandle = isExchangeNativeTF(currentExchange, store.currentTF);
    if (isNativeDirectCandle && mainStep === 1) {
      rawMain.forEach((d) => {
        const safeVol = Number(d.vol) || 0;
        newMainData.push({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: safeVol,
        });
        newVolumeData.push({
          time: d.time,
          value: safeVol,
          color: d.close >= d.open ? upColorVol : downColorVol,
        });
      });
    } else {
      const bucketMap = new Map();
      for (const d of rawMain) {
        const t = Number(d.time);
        if (!t) continue;
        let bucket;
        if (store.currentTF === "12h") {
          bucket = Math.floor(t / 43200) * 43200;
        } else if (store.currentTF === "3d") {
          bucket = Math.floor((t - 86400) / 259200) * 259200 + 86400;
        } else {
          const stepSec = tfSec[store.currentTF] || (mainStep * 60);
          bucket = Math.floor(t / stepSec) * stepSec;
        }

        if (!bucketMap.has(bucket)) {
          bucketMap.set(bucket, {
            time: bucket,
            open: Number(d.open) || 0,
            high: Number(d.high) || 0,
            low: Number(d.low) || 0,
            close: Number(d.close) || 0,
            volume: Number(d.vol) || 0,
          });
        } else {
          const existing = bucketMap.get(bucket);
          existing.high = Math.max(existing.high, Number(d.high) || 0);
          existing.low = Math.min(existing.low, Number(d.low) || 0);
          existing.close = Number(d.close) || 0;
          existing.volume += Number(d.vol) || 0;
        }
      }

      const aggregated = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
      for (const c of aggregated) {
        newMainData.push({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        });
        newVolumeData.push({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? upColorVol : downColorVol,
        });
      }
    }

    if (store.currentAsset !== snapshotAsset || store.currentTF !== snapshotTF) {
      store.isFetchingChart = false;
      window.isFetchingChart = false;
      store.isSilentSyncing = false;
      return;
    }

    if (!canReuseMain) {
      if (isSilentSync && store.mainData && store.mainData.length > 0 && newMainData.length > 0) {
        const liveLast = store.mainData[store.mainData.length - 1];
        const restLast = newMainData[newMainData.length - 1];
        const liveSec = getUnixSeconds(liveLast.time);
        const restSec = getUnixSeconds(restLast.time);
        if (liveSec === restSec) {
          // 🚀 실시간 소켓 틱(고가/저가/종가/거래량)을 보존하여 원자적 병합
          restLast.high = Math.max(Number(restLast.high), Number(liveLast.high));
          restLast.low = Math.min(Number(restLast.low), Number(liveLast.low));
          restLast.close = Number(liveLast.close);
          if (liveLast.volume) restLast.volume = Math.max(Number(restLast.volume || 0), Number(liveLast.volume));
        } else if (liveSec > restSec) {
          newMainData.push(liveLast);
        }
      }
      store.mainData = sanitizeChartData(newMainData.map((d) => mapTime(d)));
      store.volumeData = sanitizeChartData(
        newVolumeData.map((d) => mapTime(d)),
        true,
      );
      rebuildMainDataMap();
      rebuildVolumeDataMap();
    }

    store.lastFetchParams = {
      symbol: symbol,
      displayName: displayName,
      isFutures: isFutures,
      isSpot: isSpot,
      isUpbit: isUpbit,
      isBithumb: isBithumb,
      isBybit: isBybit,
      exchange: isFutures
        ? "binance_futures"
        : isBybitFutures
          ? "bybit_futures"
          : isBybit
            ? "bybit_spot"
            : isSpot
              ? "binance_spot"
              : isUpbit
                ? "upbit"
                : "bithumb",
      ticker: isBybit
        ? exactBybit
        : isUpbit || isBithumb
          ? krwTicker
          : binanceTicker,
      krwTicker: krwTicker,
      binanceTicker: binanceTicker,
      mainTickerStr: mainTickerStr,
      fetchInterval:
        typeof fetchInterval !== "undefined" ? fetchInterval : null,
      mainStep: typeof mainStep !== "undefined" ? mainStep : 1,
      upColorVol: upColorVol,
      downColorVol: downColorVol,
      isKor: ["UPBIT", "BITHUMB"].includes(store.currentChartMarket),
      tf: store.currentTF,
      hasMoreHistory: true,
    };
    store.subRawData = [];

    if (store.mainData.length > 0 && store.candleSeries) {
      const p =
        rowInfo && rowInfo.precision !== undefined && rowInfo.precision !== null
          ? Number(rowInfo.precision)
          : store.getPrecision(rowInfo?.Ticker || rowInfo?.Symbol || displayName);

      const lastCandle = store.mainData[store.mainData.length - 1];
      if (lastCandle && rowInfo) {
        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(
            rowInfo,
            undefined, // 실시간 업데이트가 우선이므로 과거 봉 가격을 헤더로 넘기지 않음
            p,
          );
        }
      }

      try {
        // 🚀 [네이티브 단일 동기 배치 교체] 포맷 + 스케일 리셋 + 캔들/볼륨 주입 + 뷰포트 피팅을 단 1회의 동기 틱에서 일괄 처리 (1프레임 분열 및 잔상 원천 차단)
        store.candleSeries.applyOptions({
          priceFormat: {
            type: "custom",
            precision: p,
            minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
            formatter: (price) => formatCrosshairPrice(price, p, false),
          },
        });

        // 🚀 [신규 코인 로드 시 오토스케일 완벽 보장] 이전 코인의 커스텀 스케일 락을 해제하여 캔들 증발 방지
        if (!isSubSwitch && !isTfChange) {
          store.isPriceScaleUserZoomed = false;
          store.isVolPriceScaleUserZoomed = false;
          store.isKimchiPriceScaleUserZoomed = false;
          store.mainCustomPriceRange = null;
          store.volCustomPriceRange = null;
          store.kimchiCustomPriceRange = null;
          if (store.candleSeries) {
            store.candleSeries.applyOptions({ autoscaleInfoProvider: (original) => (original ? original() : null) });
          }
          if (store.previewSeries) {
            store.previewSeries.applyOptions({ autoscaleInfoProvider: (original) => (original ? original() : null) });
          }
        }

        if (store.candleSeries && !isSubSwitch) {
          store.candleSeries.setData(sanitizeChartData(store.mainData));
        }

        if (store.leftScaleSeries && !isSubSwitch) {
          const leftData = store.mainData.map((d) => {
            const m = mapTime(d);
            return { time: m.time, value: m.close };
          });
          store.leftScaleSeries.setData(sanitizeChartData(leftData, true));
        }

        if (!isSubSwitch) {
          if (
            store.volumeSeries &&
            store.volumeData &&
            store.volumeData.length > 0
          ) {
            store.volumeSeries.setData(sanitizeChartData(store.volumeData, true));
            if (typeof window.toggleVolFallback === "function") {
              window.toggleVolFallback(false);
            }
          } else if (store.volumeSeries) {
            store.volumeSeries.setData([]);
          }
        }

        if (store.kimchiSeries) {
          const visibleRange = store.chart ? store.chart.timeScale().getVisibleLogicalRange() : null;
          store.kimchiSeries.setData([]);
          if (visibleRange && store.chartVol) store.chartVol.timeScale().setVisibleLogicalRange(visibleRange);
        }
        store.kimchiData = [];
        if (store.kimchiDataMap) {
          store.kimchiDataMap.clear();
        }
        store.realtimeKimchi = null;

        // 🚀 [원자적 상하 너비 완벽 동기화] 캔들/볼륨 주입 직후 단 1회의 동기 틱에서 상하 우측 너비를 일치시켜 코인/TF 변경 덜그럭 원천 차단
        if (typeof syncPriceScaleWidths === "function") {
          syncPriceScaleWidths(!isSubSwitch);
        }

        if (typeof applyChartLayout === "function") applyChartLayout();
        if (typeof autoFit === "function" && !isSubSwitch) autoFit(isTabRestore); // [1차 선제 피팅] 캔들/볼륨 로드 직후 뷰포트 즉시 고정
        // [핵심] 캔들과 거래량이 차트에 안착한 즉시 Fetching 락 해제 (실시간 소켓 틱 드랍 방지)
        window.isFetchingChart = false;
        store.isFetchingChart = false;

        if (typeof startRealtimeCandle === "function") {
          startRealtimeCandle(
            mainTickerStr,
            store.currentTF,
            isFutures,
            isSpot,
            isUpbit,
            isBithumb,
          );
        }

        if (typeof window.syncPriceScaleWidths === "function")
          window.syncPriceScaleWidths(true);
      } catch (err) {
        //Xconsole.warn("🚨 시리즈 데이터 원자적 세팅 예외 우회:", err);
        window.isFetchingChart = false;
        store.isFetchingChart = false;
      }

      if (
        store.candleSeries &&
        typeof store.candleSeries.setMarkers === "function"
      ) {
        try {
          store.candleSeries.setMarkers([]);
        } catch (markerErr) { }
      }

      store.kimchiData = [];
      store.realtimeKimchi = null;
    }

    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";

    if (!store.candleSeries || !store.mainData || store.mainData.length === 0) {
      window.isFetchingChart = false;
      store.isFetchingChart = false;
      if (typeof window.syncPriceScaleWidths === "function")
        window.syncPriceScaleWidths();
    }

    // 🚀 [역할 분리] 백그라운드 김프 수집 및 Lazy 렌더링 호출 → 완료 후 autoFit 보장
    import("./chart_history_kimchi.js").then((mod) => {
      mod.lazyRenderKimchiData({
        rowInfo,
        uniqueTicker,
        mainTickerStr,
        exactSpot,
        exactFutures,
        exactUpbit,
        exactBithumb,
        exactBybit,
        isBybit,
        isTfChange,
        snapshotAsset,
        snapshotTF,
        applyChartLayout
      }).then(() => {
        // 🚀 [len 유동 보장] store.kimchiData가 실제로 채워진 경우, 내부 rAF(kimchiSeries.setData)가
        // 먼저 완료되도록 한 프레임 더 대기. 없으면 즉시 fit.
        const doFit = () => {
          if (typeof window.updateStatus === "function") window.updateStatus();
          if (typeof updateExchangeBadges === "function") updateExchangeBadges(displayName, rowInfo?.UID);
          if (typeof window.syncPriceScaleWidths === "function") window.syncPriceScaleWidths(true);

          if (store.chart && store.chartVol) {
            const curRange = store.chart.timeScale().getVisibleLogicalRange();
            if (curRange) {
              try { store.chartVol.timeScale().setVisibleLogicalRange(curRange); } catch (e) {}
            }
            if (!store.isVolPriceScaleUserZoomed) {
              try { store.chartVol.priceScale("right").applyOptions({ autoScale: true }); } catch (e) {}
            }
          }

          window.isFetchingChart = false;
          store.isFetchingChart = false;
          store.isSilentSyncing = false;
        };
        if (store.kimchiData && store.kimchiData.length > 0) {
          requestAnimationFrame(doFit);
        } else {
          doFit();
        }
      });
    });

  } catch (e) {
    //Xconsole.error("차트 로드 실패:", e);
    window.isFetchingChart = false;
    store.isFetchingChart = false;
    store.isSilentSyncing = false;
  } finally {
    window.isFetchingChart = false;
    store.isFetchingChart = false;
    store.isSilentSyncing = false;
    if (typeof window.hideKimchiLoading === "function") {
      window.hideKimchiLoading();
    }
    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";
    store.isNewCoinSelected = false;
  }
}

window.fetchHistory = fetchHistory;
