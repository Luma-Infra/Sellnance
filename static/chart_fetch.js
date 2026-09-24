// chart_fetch.js - 🚀 메인 차트 초기화 및 히스토리컬 캔들 페칭/조립 전담 엔진
import { store, tfSec } from "./_store.js";
import {
  getPureBase,
  formatCrosshairPrice,
  sanitizeChartData,
  rebuildMainDataMap,
  rebuildVolumeDataMap,
  autoFit,
  mainCandleAutoscaleProvider,
  getUnixSeconds,
  getKrwPrecision,
} from "./chart_utils.js";
import { findRowInfo, determineListingDate } from "./chart_history_helper.js";
import { updateExchangeBadges } from "./ui_control.js";
import { applyChartLayout } from "./chart_layout.js";
import { fetchCandlesSmart, clearChartData, mapTime } from "./chart_data.js";
import { isExchangeNativeTF, normalizeExchangeInterval } from "./_market_rules.js";

// ============================================================================
// [1단계] 페칭 전 초기 상태 준비 및 가드
// ============================================================================
function prepareFetchState(isSubSwitch, isSilentSync, isTfChange) {
  const now = Date.now();
  if (now - store.lastFetchTime < 100) return false;
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

  return true;
}

// ============================================================================
// [2단계] 심볼 파싱, 마켓 분류 및 행(Row) 정보 정규화
// ============================================================================
function resolveSymbolAndMarket(symbol, targetUid) {
  let displayName = symbol || store.currentAsset;
  if (!displayName) {
    store.isFetchingChart = false;
    window.isFetchingChart = false;
    store.isSilentSyncing = false;
    return null;
  }

  // 트레이딩뷰 라우팅 스타일 (EXCHANGE:SYMBOL_MARKET 또는 EXCHANGE:SYMBOL) 즉시 분해 및 정규화
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

  const listedEx = rowInfo ? rowInfo.Listed_Exchanges || [] : [];
  const isGlobalBase = !isUpbit && !isBithumb;
  let hasSubTarget = false;
  if (isGlobalBase) {
    hasSubTarget =
      listedEx.includes("UPBIT") ||
      listedEx.includes("BITHUMB") ||
      rowInfo?.Upbit === "O" ||
      rowInfo?.UPBIT ||
      rowInfo?.BITHUMB;
  } else {
    hasSubTarget =
      listedEx.includes("BINANCE") ||
      listedEx.includes("BINANCE_FUTURES") ||
      listedEx.includes("BINANCE_SPOT") ||
      listedEx.includes("BYBIT") ||
      listedEx.includes("BYBIT_FUTURES") ||
      listedEx.includes("BYBIT_SPOT") ||
      rowInfo?.Binance === "O" ||
      rowInfo?.Binance_Futures === "O";
  }

  // [레이아웃 선제 결정] 첫 렌더링 전 김프 가능 여부 확정
  store.paneConfig.kimchi = !store.isKimchiDisabled && hasSubTarget;

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

  return {
    displayName,
    rawSymbol,
    pureBase,
    exchangeFlags,
    isFutures,
    isSpot,
    isUpbit,
    isBithumb,
    isBybit,
    isBybitFutures,
    isGate,
    isGateFutures,
    rowInfo,
    uniqueTicker,
    exactSpot,
    exactFutures,
    exactUpbit,
    exactBithumb,
    exactBybit,
    binanceTicker,
    krwTicker,
    mainTickerStr,
  };
}

// ============================================================================
// [3단계] 거래소별 원시 캔들 페칭 (초경량 Delta 백필 지원)
// ============================================================================
async function fetchRawCandles(ctx, isSubSwitch, isSilentSync) {
  let rawMain = [];
  let mainStep = 1;
  let fetchInterval;

  const canReuseMain = isSubSwitch && store.mainData && store.mainData.length > 0;
  if (canReuseMain) {
    rawMain = [...store.mainData];
    return { rawMain, mainStep, fetchInterval, canReuseMain };
  }

  // [초경량 Delta 증분 백필] 탭 복귀(isSilentSync) 시 누락된 시간(갭)만 계산하여 최소 봉만 요청 (기본 500개 -> 10~150개)
  let fetchLimit = 500;
  let silentStartTime = null;
  if (isSilentSync && store.mainData && store.mainData.length > 0) {
    const stepSec = tfSec[store.currentTF] || (mainStep * 60) || 60;
    const lastCandle = store.mainData[store.mainData.length - 1];
    let lastSec = getUnixSeconds(lastCandle.time);

    // [캔들 & 볼륨 동시 보정] 볼륨 데이터가 캔들보다 과거에 멈춰있다면(백그라운드 누락 등) 더 과거 시점을 기준으로 갭 백필
    if (store.volumeData && store.volumeData.length > 0) {
      const lastVol = store.volumeData[store.volumeData.length - 1];
      const lastVolSec = getUnixSeconds(lastVol.time);
      if (lastVolSec > 0 && lastVolSec < lastSec) {
        lastSec = lastVolSec;
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const gapSec = Math.max(0, nowSec - lastSec);
    const neededBars = Math.ceil(gapSec / stepSec) + 10; // 여유분 확보
    fetchLimit = Math.min(500, Math.max(15, neededBars));
    silentStartTime = (lastSec - stepSec * 2) * 1000;
  }

  const {
    isFutures,
    isSpot,
    isBybit,
    isBybitFutures,
    isBithumb,
    isGate,
    isGateFutures,
    isUpbit,
    exactBybit,
    binanceTicker,
    exactSpot,
    pureBase,
    krwTicker,
  } = ctx;

  if (isFutures || isSpot || isBybit) {
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
      fetchLimit,
      null,
      silentStartTime,
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
    const bLimit = Math.min(fetchLimit, 300);
    const bData = await fetchCandlesSmart("bithumb", krwTicker, bFetchTf, bLimit);
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
    fetchInterval = normalizeExchangeInterval("upbit", store.currentTF);
    if (store.currentTF === "3d") {
      mainStep = 3;
    } else if (fetchInterval.startsWith("minutes/")) {
      const baseMin = parseInt(fetchInterval.replace("minutes/", ""), 10) || 1;
      const totalSec = tfSec[store.currentTF] || 60;
      const targetMin = totalSec / 60;
      mainStep = Math.max(1, Math.round(targetMin / baseMin));
    } else {
      mainStep = 1;
    }
    // 1회차 ~ 최신 200개 봉을 즉시 가져와 차트를 먼저 초고속 렌더링
    const upbitFirstBatchLimit = Math.min(fetchLimit, 200);
    const raw = await fetchCandlesSmart(
      "upbit",
      krwTicker,
      fetchInterval,
      upbitFirstBatchLimit,
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

  return { rawMain, mainStep, fetchInterval, canReuseMain };
}

// ============================================================================
// [4단계] 데이터 부재 시 지능형 거래소 폴백 처리
// ============================================================================
function handleExchangeFallback(rawMain, ctx, canReuseMain, isTfChange, isTabRestore, loadingModal, wrapper) {
  if (canReuseMain || (rawMain && rawMain.length > 0)) {
    return false; // 정상 수집됨 -> 폴백 불필요
  }

  const { isBybit, isSpot, isFutures, rowInfo, displayName } = ctx;

  // 🚀 [1순위 해외 거래소 폴백] 바이빗 데이터 부재 시: 바이낸스 선물 -> 바이낸스 현물 -> 국내 거래소 순으로 지능적 폴백
  if (isBybit) {
    if (rowInfo?.Listed_Exchanges?.includes("BINANCE_FUTURES") || rowInfo?.Binance_Futures === "O") {
      store.currentChartMarket = "FUTURES";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
    if (rowInfo?.Listed_Exchanges?.includes("BINANCE") || rowInfo?.Binance === "O") {
      store.currentChartMarket = "SPOT";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
    if (rowInfo?.Listed_Exchanges?.includes("UPBIT") || rowInfo?.Upbit === "O") {
      store.currentChartMarket = "UPBIT";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
    if (rowInfo?.Listed_Exchanges?.includes("BITHUMB")) {
      store.currentChartMarket = "BITHUMB";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
  }

  // 🚀 [선물 전용 코인 폴백] 바이낸스 현물 데이터 부재 시 (1000SATS, SKR 등 선물 전용 코인): 바이낸스 선물로 자동 전환
  if (isSpot) {
    const canFallbackFutures = !rowInfo || rowInfo?.Listed_Exchanges?.includes("BINANCE_FUTURES") || rowInfo?.Binance_Futures === "O";
    if (canFallbackFutures) {
      store.currentChartMarket = "FUTURES";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
  }

  // 🚀 [국내/현물 전용 코인 폴백] 바이낸스 선물 데이터 부재 시: 업비트 -> 빗썸 -> 현물 순으로 자동 전환
  if (isFutures) {
    if (rowInfo?.Listed_Exchanges?.includes("UPBIT") || rowInfo?.Upbit === "O") {
      store.currentChartMarket = "UPBIT";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
    if (rowInfo?.Listed_Exchanges?.includes("BITHUMB")) {
      store.currentChartMarket = "BITHUMB";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
    if (rowInfo?.Listed_Exchanges?.includes("BINANCE") || rowInfo?.Binance === "O") {
      store.currentChartMarket = "SPOT";
      updateExchangeBadges(displayName, rowInfo?.UID);
      store.lastFetchTime = 0;
      fetchHistory(displayName, isTfChange, isTabRestore, false, rowInfo?.UID);
      return true;
    }
  }

  store.isFetchingChart = false;
  window.isFetchingChart = false;
  if (loadingModal) loadingModal.classList.add("hidden");
  if (wrapper) wrapper.classList.remove("chart-loading");
  return true;
}

// ============================================================================
// [5단계] 타임프레임 버킷 집계 & 델타 증분 병합
// ============================================================================
function assembleAndCommitCandles(rawMain, ctx, fetchMeta, isSubSwitch, isSilentSync, snapshotAsset, snapshotTF) {
  const { isFutures, isSpot, isBybit, isBybitFutures, isBithumb, isGate, isUpbit, rowInfo, pureBase, exchangeFlags, displayName } = ctx;
  const { mainStep, fetchInterval, canReuseMain } = fetchMeta;

  // 상장일(Listing Date) 판단 및 갱신
  determineListingDate(rawMain, rowInfo, pureBase, exchangeFlags);

  let newMainData = [];
  let newVolumeData = [];

  if (canReuseMain) {
    newMainData = [...store.mainData];
    newVolumeData = store.volumeData ? [...store.volumeData] : [];
  } else {
    const style = getComputedStyle(document.body);
    const upColorVol =
      (style.getPropertyValue("--up").trim() || "#26a69a") + "80";
    const downColorVol =
      (style.getPropertyValue("--down").trim() || "#ef5350") + "80";

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
  }

  if (store.currentAsset !== snapshotAsset || store.currentTF !== snapshotTF) {
    store.isFetchingChart = false;
    window.isFetchingChart = false;
    store.isSilentSyncing = false;
    return false;
  }

  if (!canReuseMain) {
    if (isSilentSync && store.mainData && store.mainData.length > 0 && newMainData.length > 0) {
      // [원자적 Delta 병합] 기존 차트 데이터를 보존하고, 누락되었던 새 캔들들만 시간순으로 안전하게 합칩니다.
      const candleMap = new Map();
      for (const c of store.mainData) {
        candleMap.set(getUnixSeconds(c.time), { ...c });
      }
      for (const c of newMainData) {
        const sec = getUnixSeconds(c.time);
        if (!candleMap.has(sec)) {
          candleMap.set(sec, c);
        } else {
          // 경계선 캔들: 고가/저가/종가/거래량 최신화
          const ex = candleMap.get(sec);
          ex.high = Math.max(Number(ex.high || 0), Number(c.high || 0));
          ex.low = Math.min(Number(ex.low || Infinity), Number(c.low || 0));
          ex.close = Number(c.close);
          if (c.volume) ex.volume = Math.max(Number(ex.volume || 0), Number(c.volume || 0));
        }
      }
      const mergedMain = Array.from(candleMap.values()).sort((a, b) => getUnixSeconds(a.time) - getUnixSeconds(b.time));
      store.mainData = sanitizeChartData(mergedMain.map((d) => mapTime(d)));

      const volMap = new Map();
      if (store.volumeData) {
        for (const v of store.volumeData) {
          volMap.set(getUnixSeconds(v.time), { ...v });
        }
      }
      for (const v of newVolumeData) {
        const sec = getUnixSeconds(v.time);
        volMap.set(sec, v);
      }
      const mergedVol = Array.from(volMap.values()).sort((a, b) => getUnixSeconds(a.time) - getUnixSeconds(b.time));
      store.volumeData = sanitizeChartData(mergedVol.map((d) => mapTime(d)), true);
    } else {
      store.mainData = sanitizeChartData(newMainData.map((d) => mapTime(d)));
      store.volumeData = sanitizeChartData(
        newVolumeData.map((d) => mapTime(d)),
        true,
      );
    }
    rebuildMainDataMap();
    rebuildVolumeDataMap();
  }

  const style = getComputedStyle(document.body);
  const upColorVol =
    (style.getPropertyValue("--up").trim() || "#26a69a") + "80";
  const downColorVol =
    (style.getPropertyValue("--down").trim() || "#ef5350") + "80";

  store.lastFetchParams = {
    symbol: ctx.rawSymbol,
    displayName: ctx.displayName,
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
      ? ctx.exactBybit
      : isUpbit || isBithumb
        ? ctx.krwTicker
        : ctx.binanceTicker,
    krwTicker: ctx.krwTicker,
    binanceTicker: ctx.binanceTicker,
    mainTickerStr: ctx.mainTickerStr,
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

  return true;
}

// ============================================================================
// [6단계] 시리즈 주입 & 뷰포트 피팅
// ============================================================================
function applySeriesAndLayout(ctx, isSubSwitch, isTfChange, isSilentSync, isTabRestore) {
  const { rowInfo, displayName, mainTickerStr, isFutures, isSpot, isUpbit, isBithumb } = ctx;

  if (store.mainData.length > 0 && store.candleSeries) {
    const isKor =
      isUpbit ||
      isBithumb ||
      ["UPBIT", "BITHUMB"].includes(store.currentChartMarket);
    const lastCandle = store.mainData[store.mainData.length - 1];

    let p;
    if (isKor) {
      const latestPrice = lastCandle
        ? Number(lastCandle.close ?? lastCandle.trade_price ?? 0)
        : 0;
      const exch = isBithumb ? "bithumb" : "upbit";
      p = getKrwPrecision(latestPrice, exch);
    } else {
      p =
        rowInfo && rowInfo.precision !== undefined && rowInfo.precision !== null
          ? Number(rowInfo.precision)
          : store.getPrecision(rowInfo?.Ticker || rowInfo?.Symbol || displayName);
    }

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
      // [네이티브 단일 동기 배치 교체] 포맷 + 스케일 리셋 + 캔들/볼륨 주입 + 뷰포트 피팅을 단 1회의 동기 틱에서 일괄 처리
      store.candleSeries.applyOptions({
        priceFormat: {
          type: "custom",
          precision: p,
          minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
          formatter: (price) => formatCrosshairPrice(price, p, false, isKor),
        },
      });

      // [신규 코인 로드 시 오토스케일 완벽 보장] 이전 코인의 커스텀 스케일 락을 해제하여 캔들 증발 방지
      if (!isSubSwitch && !isTfChange) {
        store.isPriceScaleUserZoomed = false;
        store.isVolPriceScaleUserZoomed = false;
        store.isKimchiPriceScaleUserZoomed = false;
        store.mainCustomPriceRange = null;
        store.volCustomPriceRange = null;
        store.kimchiCustomPriceRange = null;
        if (store.candleSeries) {
          store.candleSeries.applyOptions({ autoscaleInfoProvider: mainCandleAutoscaleProvider });
        }
        if (store.previewSeries) {
          store.previewSeries.applyOptions({ autoscaleInfoProvider: mainCandleAutoscaleProvider });
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

      // 🚀 [원자적 상하 너비 완벽 동기화] 캔들/볼륨 주입 직후 단 1회의 동기 틱에서 상하 우측 너비를 일치시켜 덜그럭 원천 차단
      if (typeof window.syncPriceScaleWidths === "function") {
        window.syncPriceScaleWidths(true);
      } else if (typeof syncPriceScaleWidths === "function") {
        syncPriceScaleWidths(true);
      }

      if (typeof applyChartLayout === "function") applyChartLayout();
      if (typeof autoFit === "function" && !isSubSwitch && !isSilentSync) autoFit(isTabRestore); // 사일런트 백필 시 뷰포트 유지

      // [핵심] 캔들과 거래량이 차트에 안착한 즉시 Fetching 락 해제
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
      } else if (typeof window.startRealtimeCandle === "function") {
        window.startRealtimeCandle(
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

  if (!store.candleSeries || !store.mainData || store.mainData.length === 0) {
    window.isFetchingChart = false;
    store.isFetchingChart = false;
    if (typeof window.syncPriceScaleWidths === "function")
      window.syncPriceScaleWidths();
  }
}

// ============================================================================
// [7단계] 김프 백그라운드 수집 및 최종 렌더링 동기화
// ============================================================================
function finalizeKimchiAndRendering(ctx, isSubSwitch, isSilentSync, isTfChange, isTabRestore, snapshotAsset, snapshotTF) {
  const { rowInfo, uniqueTicker, mainTickerStr, exactSpot, exactFutures, exactUpbit, exactBithumb, exactBybit, isBybit, displayName } = ctx;

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
      // store.kimchiData가 실제로 채워진 경우, 내부 rAF(kimchiSeries.setData)가 먼저 완료되도록 한 프레임 더 대기, 없으면 즉시 fit
      const doFit = () => {
        if (typeof window.updateStatus === "function") window.updateStatus();
        if (typeof updateExchangeBadges === "function") updateExchangeBadges(displayName, rowInfo?.UID);
        if (typeof window.syncPriceScaleWidths === "function") window.syncPriceScaleWidths(true);

        if (!isSubSwitch && !isSilentSync) {
          if (typeof autoFit === "function") {
            autoFit(isTabRestore);
          } else if (typeof window.autoFit === "function") {
            window.autoFit(isTabRestore);
          }
        }

        if (store.chart && store.chartVol) {
          // 사일런트 복귀 시 유저가 줌/스크롤하지 않은 상태(실시간 앵커링)라면 최신 봉으로 이동 보장
          if (isSilentSync && !store.isUserZoomed) {
            try {
              store.chart.timeScale().scrollToRealtime();
              store.chartVol.timeScale().scrollToRealtime();
            } catch (e) { }
          }
          const curRange = store.chart.timeScale().getVisibleLogicalRange();
          if (curRange) {
            try { store.chartVol.timeScale().setVisibleLogicalRange(curRange); } catch (e) { }
          }
          if (!store.isVolPriceScaleUserZoomed) {
            try { store.chartVol.priceScale("right").applyOptions({ autoScale: true }); } catch (e) { }
          }
        }

        window.isFetchingChart = false;
        store.isFetchingChart = false;
        store.isSilentSyncing = false;
      };

      // [원자적 동기화] DOM 리사이즈 및 레이아웃 변경이 완전히 안착된 후 1프레임 지연하여 최종 뷰포트 고정
      requestAnimationFrame(doFit);
    });
  });
}

// ============================================================================
// [Main Orchestrator] fetchHistory
// ============================================================================
export async function fetchHistory(
  symbol,
  isTfChange = false,
  isTabRestore = false,
  isSubSwitch = false,
  targetUid = null,
  isSilentSync = false,
) {
  // 1단계: 스로틀링 및 초기 상태 가드
  if (!prepareFetchState(isSubSwitch, isSilentSync, isTfChange)) return;

  // 2단계: 심볼 및 마켓 정규화
  const ctx = resolveSymbolAndMarket(symbol, targetUid);
  if (!ctx) return;

  const loadingModal = document.getElementById("chart-loading-modal");
  const wrapper = document.getElementById("chart-wrapper");
  if (wrapper && !isTfChange && !isSilentSync) wrapper.classList.add("chart-loading");

  const pastGapMap = store.marketDataMap?.past_gap_map || {};
  let gapOverlay = document.getElementById("gap-recovery-overlay");

  if (pastGapMap[ctx.pureBase] && !isTfChange && !isSilentSync) {
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

  const snapshotAsset = store.currentAsset;
  const snapshotTF = store.currentTF;

  try {
    store.hasPlacedDeer = false;

    // 3단계: 거래소별 원시 캔들 수집 (초경량 Delta 백필 지원)
    const fetchMeta = await fetchRawCandles(ctx, isSubSwitch, isSilentSync);

    // 4단계: 데이터 부재 시 지능형 거래소 폴백 처리
    const handled = handleExchangeFallback(
      fetchMeta.rawMain,
      ctx,
      fetchMeta.canReuseMain,
      isTfChange,
      isTabRestore,
      loadingModal,
      wrapper,
    );
    if (handled) return;

    // 5단계: 타임프레임 버킷 집계 및 델타 증분 병합
    const assembled = assembleAndCommitCandles(
      fetchMeta.rawMain,
      ctx,
      fetchMeta,
      isSubSwitch,
      isSilentSync,
      snapshotAsset,
      snapshotTF,
    );
    if (!assembled) return;

    // 6단계: 시리즈 주입 및 뷰포트 피팅
    applySeriesAndLayout(ctx, isSubSwitch, isTfChange, isSilentSync, isTabRestore);

    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";

    // 7단계: 김프 백그라운드 수집 및 최종 동기화
    finalizeKimchiAndRendering(
      ctx,
      isSubSwitch,
      isSilentSync,
      isTfChange,
      isTabRestore,
      snapshotAsset,
      snapshotTF,
    );
    // 초기 캔들 로딩 완료 (과거 캔들은 유저가 차트를 과거로 스크롤/줌아웃할 때만 온디맨드로 로딩)
  } catch (e) {
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
