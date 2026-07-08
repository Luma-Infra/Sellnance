// chart_data.js
import { store, tfSec } from "./_store.js";
import { calculateKimchiData } from "./chart_data_kimchi.js";
import {
  getMultiplier,
  getPureBase,
  getUnixSeconds,
  ensureSafeUnixSeconds,
  sanitizeChartData,
  rebuildMainDataMap,
  rebuildVolumeDataMap,
  rebuildKimchiDataMap,
} from "./chart_utils.js";

import { formatSmartPrice, formatCrosshairPrice } from "./chart_utils.js";
import { findRowInfo, determineListingDate } from "./chart_history_helper.js";
import { updateExchangeBadges } from "./ui_control.js";
import {
  formatListingDateWithExchange,
  updateRowDynamicHTML,
} from "./table_render.js";

export async function fetchCandlesSmart(
  exchange,
  symbol,
  interval,
  limit,
  toVal = null,
  startVal = null,
) {
  const pastGapMap = store.marketDataMap?.past_gap_map || {};
  const baseSymbol = symbol
    .replace("USDT", "")
    .replace("KRW-", "")
    .replace("_KRW", "")
    .split("(")[0];
  const isGapRecovery =
    pastGapMap[baseSymbol] &&
    (interval.endsWith("d") ||
      interval.endsWith("w") ||
      interval.endsWith("M") ||
      interval === "days" ||
      interval === "weeks" ||
      interval === "months");

  // 업비트는 toVal 있어도 브라우저 직접 fetch 지원 (to 파라미터 네이티브 지원)
  if (!isGapRecovery && exchange === "upbit" && toVal && !startVal) {
    try {
      let fetchInterval = interval;
      if (!interval.startsWith("minutes/")) {
        const u = interval.replace(/[0-9]/g, "");
        if (u === "d" || u === "w" || u === "M" || interval === "days" || interval === "weeks" || interval === "months") {
          fetchInterval = u === "w" || interval === "weeks" ? "weeks" : u === "M" || interval === "months" ? "months" : "days";
        } else {
          const minMap = { "1m": "minutes/1", "3m": "minutes/3", "5m": "minutes/5", "15m": "minutes/15", "30m": "minutes/30", "1h": "minutes/60", "2h": "minutes/120", "4h": "minutes/240" };
          fetchInterval = minMap[interval] || "minutes/1";
        }
      }
      // 업비트 to 파라미터: ISO8601 형식 (예: 2025-12-07T00:00:00)
      const toParam = `&to=${encodeURIComponent(toVal)}`;
      const upbitUrl = `https://api.upbit.com/v1/candles/${fetchInterval}?market=${symbol}&count=200${toParam}`;
      const res = await fetch(upbitUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn(`⚠️ [UPBIT TO DIRECT FAIL] ${symbol} - ${toVal}, falling back:`, err);
    }
  }

  if (!isGapRecovery && !toVal && !startVal) {
    try {
      let directUrl = null;
      if (exchange === "binance_spot") {
        directUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      } else if (exchange === "binance_futures") {
        directUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      } else if (exchange === "upbit") {
        let fetchInterval = interval;
        if (!interval.startsWith("minutes/")) {
          const u = interval.replace(/[0-9]/g, "");
          if (
            u === "d" ||
            u === "w" ||
            u === "M" ||
            interval === "days" ||
            interval === "weeks" ||
            interval === "months"
          ) {
            fetchInterval =
              u === "w" || interval === "weeks"
                ? "weeks"
                : u === "M" || interval === "months"
                  ? "months"
                  : "days";
          } else {
            const minMap = {
              "1m": "minutes/1",
              "3m": "minutes/3",
              "5m": "minutes/5",
              "15m": "minutes/15",
              "30m": "minutes/30",
              "1h": "minutes/60",
              "2h": "minutes/120",
              "4h": "minutes/240",
            };
            fetchInterval = minMap[interval] || "minutes/1";
          }
        }
        directUrl = `https://api.upbit.com/v1/candles/${fetchInterval}?market=${symbol}&count=200`; // 업비트 최대 한도: 200개
      } else if (exchange === "bybit_spot" || exchange === "bybit_futures") {
        const category = exchange === "bybit_spot" ? "spot" : "linear";
        const bMap = {
          "1m": "1",
          "3m": "3",
          "5m": "5",
          "15m": "15",
          "30m": "30",
          "1h": "60",
          "2h": "120",
          "4h": "240",
          "6h": "360",
          "12h": "720",
          "1d": "D",
          days: "D",
          "3d": "D",
          "1w": "W",
          "1M": "M",
        };
        const bInt = bMap[interval] || interval;
        directUrl = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${bInt}&limit=1000`; // 바이빗 최대 한도: 1000개
      } else if (exchange === "bithumb") {
        const cleanSymbol = symbol.replace("KRW-", "").replace("_KRW", "").replace("KRW", "");
        const bSym = cleanSymbol + "_KRW";
        directUrl = `https://api.bithumb.com/public/candlestick/${bSym}/${interval}`;
      }

      if (directUrl) {
        const res = await fetch(directUrl);
        if (res.ok) {
          const data = await res.json();
          if (
            exchange.startsWith("binance") &&
            Array.isArray(data) &&
            data.length > 0
          ) {
            // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol} (${data.length} candles)`,);
            return data;
          } else if (exchange === "upbit" && Array.isArray(data)) {
            // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol} (${data.length} candles)`,);
            return data;
          } else if (exchange === "bithumb" && data && data.status === "0000") {
            // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol}`);
            return data;
          } else if (
            exchange.startsWith("bybit") &&
            data &&
            data.retCode === 0
          ) {
            // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol}`);
            return data;
          }
        }
      }
    } catch (err) {
      console.warn(
        `⚠️ [DIRECT FETCH FAILED] ${exchange} - ${symbol} - ${interval}, falling back:`,
        err,
      );
    }

    // SPCXB fallback logic in frontend if standard spot symbol fails
    if (exchange === "binance_spot" && symbol.endsWith("USDT")) {
      const baseAsset = symbol.replace("USDT", "");
      if (!baseAsset.endsWith("B")) {
        const fallbackSymbol = `${baseAsset}BUSDT`;
        try {
          const directUrl = `https://api.binance.com/api/v3/klines?symbol=${fallbackSymbol}&interval=${interval}&limit=${limit}`;
          const res = await fetch(directUrl);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              // Xconsole.log(`⚡ [DIRECT FALLBACK SUCCESS] ${exchange} - ${fallbackSymbol} (${data.length} candles)`,);
              return data;
            }
          }
        } catch (err) {
          console.warn(
            `⚠️ [DIRECT FALLBACK FAILED] ${exchange} - ${fallbackSymbol}:`,
            err,
          );
        }
      }
    }
  }

  // 🚫 바이낸스/빗썸: 직접 fetch 우선 수행 후 실패 시 서버 프록시(/api/candles) 호출 정상 처리
  // (CORS 미지원 환경 우회용 fallback)

  // Fallback to server proxy (업비트/바이빗 잔여 예외 상황 대응용)
  const queryTo = toVal ? `&to=${toVal}` : "";
  const queryStart = startVal ? `&start=${startVal}` : "";
  // Xconsole.log(`🔌 [SERVER FALLBACK] ${exchange} - ${symbol} - ${interval}`);
  const res = await fetch(
    `/api/candles?exchange=${exchange}&symbol=${symbol}&interval=${interval}&limit=${limit}${queryTo}${queryStart}`,
  );
  return await res.json();
}

export async function fetchPaginated(
  exchange,
  symbol,
  interval,
  totalLimit,
  startTo = "",
) {
  let result = [];
  let lastTo = startTo;
  let remaining = totalLimit;
  let retryCount = 0;

  while (remaining > 0) {
    const count = Math.min(remaining, 200);
    const data = await fetchCandlesSmart(
      exchange,
      symbol,
      interval,
      count,
      lastTo,
    );
    if (!Array.isArray(data) || data.length === 0) break;

    result = result.concat(data);
    remaining -= data.length;
    lastTo = data[data.length - 1].candle_date_time_utc;

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return result;
}

export function mapTime(d, tf) {
  let activeTF = "1h";
  if (typeof tf === "string" && tf) {
    activeTF = tf;
  } else if (store && typeof store.currentTF === "string" && store.currentTF) {
    activeTF = store.currentTF;
  }

  const isDayUnit = !activeTF.match(/[hm]/);
  if (isDayUnit) {
    if (typeof d.time === "string" && d.time.includes("-")) return d;
    const numTime = Number(d.time);
    if (isNaN(numTime)) return d;
    const dt = new Date(numTime * 1000);
    return {
      ...d,
      time: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
    };
  } else {
    if (typeof d.time === "string" && d.time.includes("-")) {
      const parsedUnix = Math.floor(new Date(d.time).getTime() / 1000);
      return { ...d, time: isNaN(parsedUnix) ? d.time : parsedUnix };
    }
    return d;
  }
}

export function clearChartData(isTfChange = false) {
  // 🚀 코인 변경 및 타임프레임 변경 시: 기존 캔들과 김프 데이터를 모두 유지하여 눈의 피로(깜빡임)를 완벽히 제거합니다.
  // (새로운 데이터를 받아오는 순간 한 방에 덮어씌움으로써 자연스럽고 부드럽게 전환)
  if (!isTfChange && store.countdownPriceLine && store.candleSeries) {
    store.candleSeries.removePriceLine(store.countdownPriceLine);
    store.countdownPriceLine = null;
  }

  // 🚀 사슴 마커는 코인/타임프레임 전환 시 즉시 증발해야 하므로 지워줍니다.
  if (
    store.candleSeries &&
    typeof store.candleSeries.setMarkers === "function"
  ) {
    store.candleSeries.setMarkers([]);
  }
  if (
    store.kimchiSeries &&
    typeof store.kimchiSeries.setMarkers === "function"
  ) {
    store.kimchiSeries.setMarkers([]);
  }
  store.hasPlacedDeer = false;

  console
    .log
    // "🧹 차트/타임프레임 변경: 기존 차트 잔상 유지 (사슴 마커는 즉시 제거)",
    ();
}

export async function fetchHistory(
  symbol,
  isTfChange = false,
  isTabRestore = false,
  isSubSwitch = false,
) {
  const now = Date.now();
  if (now - store.lastFetchTime < 10) return;
  store.lastFetchTime = now;

  if (!isTfChange && !isSubSwitch) {
    store.preferredKimchiSub = null;
  }

  store.isFetchingChart = true;
  window.isFetchingChart = true;
  clearChartData(isTfChange);

  const displayName = symbol || store.currentAsset;
  if (!displayName) {
    store.isFetchingChart = false;
    window.isFetchingChart = false;
    return;
  }
  const rawSymbol = displayName.split("(")[0].trim().toUpperCase();
  store.currentAsset = displayName;

  const isFutures = store.currentChartMarket === "FUTURES";
  const isSpot = store.currentChartMarket === "SPOT";
  const isUpbit = store.currentChartMarket === "UPBIT";
  const isBithumb = store.currentChartMarket === "BITHUMB";
  const isBybit =
    store.currentChartMarket === "BYBIT" || store.currentChartMarket === "BYBIT_FUTURES";
  const isBybitFutures = store.currentChartMarket === "BYBIT_FUTURES";

  const pureBase = getPureBase(rawSymbol)
    .replace(/KRW$/, "")
    .replace(/USDT$/, "");

  const exchangeFlags = { isFutures, isSpot, isUpbit, isBithumb, isBybit, isBybitFutures };

  // 🚀 [역할 분리] UID 및 거래소 태그 매칭 rowInfo 찾기 도우미 호출
  const rowInfo = findRowInfo(displayName, pureBase, exchangeFlags);

  const uniqueTicker = rowInfo ? rowInfo.Ticker : displayName;

  let exactSpot = rowInfo?.Exact_Spot || pureBase;
  let exactFutures = rowInfo?.Exact_Futures || pureBase;
  let exactUpbit = rowInfo?.Upbit_Symbol || rowInfo?.Symbol || pureBase;
  let exactBithumb = rowInfo?.Bithumb_Symbol || pureBase;
  let exactBybit = rowInfo?.Bybit_Symbol || pureBase;

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
        } else if (exName === "BYBIT") {
          exactBybit = v[2];
        } else if (exName === "BINANCE") {
          if (v[2].endsWith("USDT")) {
            exactSpot = v[2].replace("USDT", "");
            exactFutures = v[2].replace("USDT", "");
          } else {
            exactSpot = v[2];
            exactFutures = v[2];
          }
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
  if (wrapper && !isTfChange) wrapper.classList.add("chart-loading");

  const pastGapMap = store.marketDataMap?.past_gap_map || {};
  let gapOverlay = document.getElementById("gap-recovery-overlay");

  if (pastGapMap[pureBase] && !isTfChange) {
    if (!gapOverlay) {
      gapOverlay = document.createElement("div");
      gapOverlay.id = "gap-recovery-overlay";
      gapOverlay.className =
        "absolute inset-0 z-50 flex flex-col items-center justify-center bg-theme-bg/80 backdrop-blur-sm transition-all duration-300";
      gapOverlay.innerHTML = `
        <div class="flex flex-col items-center gap-3 p-6 rounded-2xl bg-theme-panel/90 border border-theme-border shadow-2xl text-center">
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

    const style = getComputedStyle(document.body);
    const upColorVol =
      (style.getPropertyValue("--up").trim() || "#26a69a") + "80";
    const downColorVol =
      (style.getPropertyValue("--down").trim() || "#ef5350") + "80";

    // 1️⃣ 데이터 수집
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
            ticker,
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
    } else if (isUpbit || isBithumb) {
      if (isBithumb) {
        const bMap = {
          "1m": "1m",
          "3m": "3m",
          "5m": "5m",
          "15m": "5m",
          "30m": "30m",
          "1h": "1h",
          "2h": "1h", // 🚀 2시간봉은 1시간씩 어긋나므로 1h 2개 조립 유지
          "4h": "4h", // 🚀 4시간봉은 마감 경계가 일치하므로 원본 4h API 사용!
          "12h": "12h", // 🚀 12시간봉은 마감 경계가 일치하므로 원본 12h API 사용!
          "1d": "24h",
          "3d": "24h",
          "1w": "24h",
          "1M": "24h",
        };
        const bFetchInt = bMap[store.currentTF] || "1h";
        const bData = await fetchCandlesSmart(
          "bithumb",
          krwTicker,
          bFetchInt,
          500,
        );
        if (bData.status === "0000" && Array.isArray(bData.data)) {
          const is9hOffset = ["4h", "12h", "1d", "3d", "1w", "1M"].includes(store.currentTF);
          const rawMapped = bData.data.map((d) => ({
            time: (Number(d[0]) / 1000) + (is9hOffset ? 32400 : 0), // 🚀 4h/12h/일봉/3일봉/주봉/월봉일 때 KST 오프셋 (+9시간) 보정 적용!
            open: Number(d[1]),
            close: Number(d[2]),
            high: Number(d[3]),
            low: Number(d[4]),
            vol: Number(d[5]),
          })).sort((a, b) => a.time - b.time);

          const getGroupTime = (t, tf) => {
            const d = new Date(t * 1000);
            if (tf === "15m") return Math.floor(t / 900) * 900;
            if (tf === "2h") return Math.floor(t / 7200) * 7200;
            if (tf === "3d") {
              const dayTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
              return Math.floor(dayTs / 259200) * 259200;
            }
            if (tf === "1d") {
              return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
            }
            if (tf === "1w") {
              const day = d.getUTCDay();
              const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
              return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0) / 1000;
            }
            if (tf === "1M") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0) / 1000;
            return t;
          };

          const tfNeedsResample = ["15m", "2h", "1d", "3d", "1w", "1M"].includes(store.currentTF);
          if (tfNeedsResample) {
            const groups = {};
            rawMapped.forEach((d) => {
              const gt = getGroupTime(d.time, store.currentTF);
              if (!groups[gt]) groups[gt] = [];
              groups[gt].push(d);
            });
            rawMain = Object.keys(groups)
              .sort((a, b) => Number(a) - Number(b))
              .map((gtStr) => {
                const gt = Number(gtStr);
                const chunk = groups[gt].sort((a, b) => a.time - b.time);
                return {
                  time: gt,
                  open: chunk[0].open,
                  close: chunk[chunk.length - 1].close,
                  high: Math.max(...chunk.map((c) => c.high)),
                  low: Math.min(...chunk.map((c) => c.low)),
                  vol: chunk.reduce((sum, c) => sum + (c.vol || 0), 0),
                };
              });
            mainStep = 1;
          } else {
            rawMain = rawMapped;
            mainStep = 1;
          }
        }
      } else {
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
    }

    if (!rawMain || rawMain.length === 0) {
      if (
        isBybit &&
        (rowInfo?.Listed_Exchanges?.includes("UPBIT") || rowInfo?.Upbit === "O")
      ) {
        console.warn(`⚠️ 바이빗 데이터 없음 (${exactBybit}), 업비트 폴백 시도`);
        store.currentChartMarket = "UPBIT";
        fetchHistory(displayName, isTfChange, isTabRestore);
        return;
      }
      console.warn(
        `⚠️ [No Data] ${displayName} / ${store.currentChartMarket} - 차트 데이터 없음`,
      );
      store.isFetchingChart = false;
      window.isFetchingChart = false;
      if (loadingModal) loadingModal.classList.add("hidden");
      if (wrapper) wrapper.classList.remove("chart-loading");
      return;
    }

    // 🚀 [역할 분리] 상장일(Listing Date) 판단 및 갱신 도우미 함수 호출
    determineListingDate(rawMain, rowInfo, pureBase, exchangeFlags);

    // 2️⃣ 조립
    let newMainData = [];
    let newVolumeData = [];

    if (isFutures || isSpot || isBybit) {
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
      let startIdx = 0;
      for (let i = startIdx; i < rawMain.length; i += mainStep) {
        const chunk = rawMain.slice(i, i + mainStep);
        if (chunk.length > 0) {
          const time = chunk[0].time;
          const open = chunk[0].open;
          const close = chunk[chunk.length - 1].close;
          const high = Math.max(...chunk.map((c) => c.high));
          const low = Math.min(...chunk.map((c) => c.low));
          const totalVol = chunk.reduce(
            (sum, c) => sum + (Number(c.vol) || 0),
            0,
          );
          newMainData.push({ time, open, high, low, close, volume: totalVol });
          newVolumeData.push({
            time,
            value: totalVol,
            color: close >= open ? upColorVol : downColorVol,
          });
        }
      }
    }

    if (store.currentAsset !== snapshotAsset || store.currentTF !== snapshotTF)
      return;

    store.mainData = sanitizeChartData(newMainData.map((d) => mapTime(d)));
    store.volumeData = sanitizeChartData(
      newVolumeData.map((d) => mapTime(d)),
      true,
    );
    rebuildMainDataMap();
    rebuildVolumeDataMap();

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
      const p = store.getPrecision(displayName);

      const lastCandle = store.mainData[store.mainData.length - 1];
      if (lastCandle && rowInfo) {
        /* [주석 처리] 웹소켓이 돌고 있는 상태에서 과거 캔들 데이터 종가로 테이블 값을 덮어쓰는 것 차단
        const isRealtimeRecent = Date.now() - (rowInfo._LastRealtimeUpdate || 0) < 10000;

        if (!isTfChange) {
          const rate = store.marketDataMap?.krw_usd_rate || 0;
          if (!isRealtimeRecent) {
            if (isUpbit) {
              rowInfo.Upbit_Price = lastCandle.close;
              rowInfo.Price_KRW = lastCandle.close;
              // rowInfo.Price_Raw = rate > 0 ? lastCandle.close / rate : lastCandle.close;
            } else if (isBithumb) {
              rowInfo.Bithumb_Price = lastCandle.close;
              const exList = (rowInfo.Listed_Exchanges || []).map((e) => e.toUpperCase());
              const hasUpbit = rowInfo.Upbit === "O" || exList.includes("UPBIT") || !!rowInfo.Upbit_Symbol;
              if (!hasUpbit) {
                rowInfo.Price_KRW = lastCandle.close;
              }
              // rowInfo.Price_Raw = rate > 0 ? lastCandle.close / rate : lastCandle.close;
            } else if (isFutures) {
              rowInfo.Binance_Price_Futures = lastCandle.close;
              rowInfo.Binance_Price = lastCandle.close;
              // rowInfo.Price_Raw = lastCandle.close;
            } else if (isSpot) {
              rowInfo.Binance_Price_Spot = lastCandle.close;
              rowInfo.Binance_Price = lastCandle.close;
              // rowInfo.Price_Raw = lastCandle.close;
            } else if (isBybitFutures) {
              rowInfo.Bybit_Price_Futures = lastCandle.close;
              rowInfo.Bybit_Price = lastCandle.close;
              // rowInfo.Price_Raw = lastCandle.close;
            } else if (isBybit) {
              rowInfo.Bybit_Price_Spot = lastCandle.close;
              rowInfo.Bybit_Price = lastCandle.close;
              // rowInfo.Price_Raw = lastCandle.close;
            }

            // 🚀 [추가] 차트 가격 갱신 완료 후, ALL 모드 지향성 공식에 맞추어 대표 가격(Price_Raw) 락킹 자동 동기화
            if (typeof window.syncRowPrioritizedMetrics === "function") {
              window.syncRowPrioritizedMetrics(rowInfo);
            }
          }
        }
        */

        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(
            rowInfo,
            undefined, // 실시간 업데이트가 우선이므로 과거 봉 가격을 헤더로 넘기지 않음
            p,
          );
        }

        /* [주석 처리] 과거 데이터 로딩이 완료되었다고 해서 좌측 행 DOM을 새로 갱신할 필요 없음 (소켓이 전담)
        const rowEl = store.rowDomMap && store.rowDomMap.get(rowInfo.Ticker);
        if (rowEl && typeof updateRowDynamicHTML === "function") {
          updateRowDynamicHTML(rowEl, rowInfo);
        }
        */
      }

      store.candleSeries.applyOptions({
        priceFormat: {
          type: "custom",
          precision: p,
          minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
          formatter: (price) => formatCrosshairPrice(price, p, false),
        },
      });

      try {
        // 🚀 [렌더 동기화] 캔들과 볼륨의 주입을 동일한 프레임으로 묶어 페인팅 시간 차 박멸
        requestAnimationFrame(() => {
          try {
            if (store.candleSeries) {
              store.candleSeries.setData(sanitizeChartData(store.mainData));
            }

            if (store.leftScaleSeries) {
              const leftData = store.mainData.map((d) => {
                const m = mapTime(d);
                return { time: m.time, value: m.close };
              });
              store.leftScaleSeries.setData(sanitizeChartData(leftData, true));
            }

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

            if (store.kimchiSeries) {
              store.kimchiSeries.setData([]);
            }
          } catch (err) {
            console.warn("🚨 시리즈 데이터 동기 세팅 예외 우회:", err);
          }
        });
      } catch (e) {
        console.warn("🚨 rAF 데이터 세팅 오류 방어:", e);
      }

      requestAnimationFrame(() => {
        if (typeof applyChartLayout === "function") applyChartLayout();
        if (typeof autoFit === "function") autoFit(isTabRestore); // 🚀 [1차 선제 피팅] 캔들/볼륨 로드 직후 뷰포트를 선제 고정하여 과거 점프 완벽 방지
        if (typeof updateStatus === "function") updateStatus();

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
          window.syncPriceScaleWidths();
      });

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
          if (typeof autoFit === "function") autoFit(isTabRestore); // 🚀 [2차 보정 피팅] 김프 데이터까지 온전히 안착한 후 최종 피팅 실행
          if (typeof window.updateStatus === "function") window.updateStatus();
          
          // 🚀 [락 해제] 최종 피팅(autoFit)까지 완벽히 마친 시점에만 Fetching 락을 풀어 가로폭 오염을 원천 차단
          window.isFetchingChart = false;
          store.isFetchingChart = false;
        };
        if (store.kimchiData && store.kimchiData.length > 0) {
          requestAnimationFrame(doFit);
        } else {
          doFit();
        }
      });
    });

  } catch (e) {
    console.error("차트 로드 실패:", e);
    window.isFetchingChart = false;
    store.isFetchingChart = false;
  } finally {
    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";
    store.isNewCoinSelected = false;
  }
}

window.switchKimchiSub = function (newSubId) {
  store.preferredKimchiSub = newSubId;
  if (typeof fetchHistory === "function") {
    fetchHistory(store.currentAsset, false, false, true);
  }
};

// 🦌 과거 좌측 제일 끝에 도달했을 때 사슴 마커(노란 원 없이)를 배치하는 함수 (김프 차트도 동시 삽입)
// export function placeDeerAtEnd(params) {
//   if (store.hasPlacedDeer) return;
//   store.hasPlacedDeer = true;

//   if (!store.candleSeries || !store.mainData || store.mainData.length === 0)
//     return;

//   const oldest = store.mainData[0];
//   let markerTime = oldest.time;

//   if (params && params.tf) {
//     const isDayUnit = !params.tf.match(/[hm]/);
//     if (isDayUnit) {
//       if (typeof markerTime === "number" && !isNaN(markerTime)) {
//         const dt = new Date(markerTime * 1000);
//         markerTime = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
//       }
//     } else {
//       if (typeof markerTime === "string" && markerTime.includes("-")) {
//         const parsedUnix = Math.floor(new Date(markerTime).getTime() / 1000);
//         if (!isNaN(parsedUnix)) markerTime = parsedUnix;
//       }
//     }
//   }

//   if (
//     store.candleSeries &&
//     typeof store.candleSeries.setMarkers === "function"
//   ) {
//     const deerMarker = {
//       time: markerTime,
//       position: "aboveBar",
//       color: "transparent", // 노란색 원형 점을 완전히 없애고 투명하게 처리
//       text: "🦌",
//       size: 1.5,
//     };

//     store.candleSeries.setMarkers([deerMarker]);

//     if (
//       store.kimchiSeries &&
//       typeof store.kimchiSeries.setMarkers === "function"
//     ) {
//       store.kimchiSeries.setMarkers([deerMarker]);
//     }
//     console.log(
//       // "🦌 [사슴 배치 완료] X축 타임스탬프 유실 없이 메인 및 김프 차트에 마커 적용 완료!",
//     );
//   }
// }

// 🚀 [신규] 차트를 과거로 스크롤할 때 과거 캔들을 비동기/Lazy하게 로딩하는 페이징 엔진
export async function loadMoreHistory() {
  if (
    store.isLoadingMoreHistory ||
    !store.lastFetchParams ||
    store.lastFetchParams.hasMoreHistory === false
  ) {
    return;
  }

  // 🚀 [철벽 디바운스] API Ban 방지를 위해 최소 1.5초 간격으로 요청 제한
  const now = Date.now();
  if (store.lastLazyLoadTime && now - store.lastLazyLoadTime < 1500) {
    return;
  }
  store.lastLazyLoadTime = now;

  if (!store.mainData || store.mainData.length === 0) {
    return;
  }

  store.isLoadingMoreHistory = true;

  // 🚀 동적 로딩 인디케이터 렌더링
  let lazyIndicator = document.getElementById("chart-lazy-loading-indicator");
  if (!lazyIndicator) {
    lazyIndicator = document.createElement("div");
    lazyIndicator.id = "chart-lazy-loading-indicator";
    lazyIndicator.className =
      "absolute left-1/2 top-4 z-[120] flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-panel/90 border border-theme-border shadow-lg text-[11px] font-medium text-theme-text opacity-0 pointer-events-none transition-all duration-300 transform -translate-x-1/2 scale-95";
    lazyIndicator.innerHTML = `
      <div class="w-3.5 h-3.5 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
      <span id="chart-lazy-loading-text">과거 데이터 불러오는 중...</span>
    `;
    const wrapper = document.getElementById("chart-wrapper");
    if (wrapper) wrapper.appendChild(lazyIndicator);
  }
  lazyIndicator.classList.remove(
    "opacity-0",
    "scale-95",
    "pointer-events-none",
  );
  lazyIndicator.classList.add("opacity-100", "scale-100");

  const params = store.lastFetchParams;
  const oldestCandle = store.mainData[0];
  let toVal;

  const oldestTimeSec = ensureSafeUnixSeconds(oldestCandle.time);
  if (params.isUpbit) {
    const dt = new Date(oldestTimeSec * 1000);
    toVal = dt.toISOString();
  } else {
    // 바이낸스 및 바이비트는 밀리초 타임스탬프 사용 (겹치지 않게 -1ms)
    toVal = Math.floor(oldestTimeSec * 1000) - 1;
  }

  try {
    let fetchedMain = [];
    if (params.isFutures || params.isSpot || params.isBybit) {
      const raw = await fetchCandlesSmart(
        params.exchange,
        params.ticker,
        params.tf,
        500,
        toVal,
      );

      if (params.isBybit && raw.result?.list) {
        fetchedMain = raw.result.list.map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
          volume: Number(d[5]),
        }));
      } else if (Array.isArray(raw)) {
        fetchedMain = raw.map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
          volume: Number(d[5]),
        }));
      }
    } else if (params.isUpbit) {
      const raw = await fetchPaginated(
        params.exchange,
        params.ticker,
        params.fetchInterval,
        500,
        toVal,
      );
      if (Array.isArray(raw)) {
        fetchedMain = raw.map((d) => ({
          time: new Date(d.candle_date_time_utc + "Z").getTime() / 1000,
          open: d.opening_price,
          high: d.high_price,
          low: d.low_price,
          close: d.trade_price,
          volume: d.candle_acc_trade_volume,
        }));
      }
    }

    if (!fetchedMain || fetchedMain.length === 0) {
      params.hasMoreHistory = false;
      store.isLoadingMoreHistory = false;
      lazyIndicator.classList.remove("opacity-100", "scale-100");
      lazyIndicator.classList.add(
        "opacity-0",
        "scale-95",
        "pointer-events-none",
      );

      // placeDeerAtEnd(params);
      return;
    }

    // 업비트의 경우 조립(mainStep)이 필요하면 진행
    if (params.isUpbit && params.mainStep > 1) {
      fetchedMain.sort((a, b) => a.time - b.time);
      
      const getGroupTime = (t, tf) => {
        const d = new Date(t * 1000);
        if (tf === "15m") return Math.floor(t / 900) * 900;
        if (tf === "2h") return Math.floor(t / 7200) * 7200;
        if (tf === "3d") {
          const dayTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
          return Math.floor(dayTs / 259200) * 259200;
        }
        if (tf === "1d") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
        if (tf === "1w") {
          const day = d.getUTCDay();
          const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
          return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0) / 1000;
        }
        if (tf === "1M") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0) / 1000;
        return t;
      };

      const groups = {};
      fetchedMain.forEach((d) => {
        const gt = getGroupTime(d.time, params.tf);
        if (!groups[gt]) groups[gt] = [];
        groups[gt].push(d);
      });

      fetchedMain = Object.keys(groups)
        .sort((a, b) => Number(a) - Number(b))
        .map((gtStr) => {
          const gt = Number(gtStr);
          const chunk = groups[gt].sort((a, b) => a.time - b.time);
          return {
            time: gt,
            open: chunk[0].open,
            close: chunk[chunk.length - 1].close,
            high: Math.max(...chunk.map((c) => c.high)),
            low: Math.min(...chunk.map((c) => c.low)),
            volume: chunk.reduce((sum, c) => sum + (Number(c.volume) || 0), 0),
          };
        });
    }

    // 중복 제거 병합
    const mergedMap = new Map();
    fetchedMain.forEach((d) => {
      const normalizedTime = mapTime(d, params.tf).time;
      mergedMap.set(normalizedTime, { ...d, time: normalizedTime });
    });
    store.mainData.forEach((d) => {
      mergedMap.set(d.time, d);
    });
    const newMainData = Array.from(mergedMap.values()).sort(
      (a, b) => getUnixSeconds(a.time) - getUnixSeconds(b.time),
    );

    const N = newMainData.length - store.mainData.length;

    if (N <= 0) {
      params.hasMoreHistory = false;
      store.isLoadingMoreHistory = false;
      lazyIndicator.classList.remove("opacity-100", "scale-100");
      lazyIndicator.classList.add(
        "opacity-0",
        "scale-95",
        "pointer-events-none",
      );

      // placeDeerAtEnd(params);
      return;
    }

    const newVolumeData = newMainData.map((d) => {
      // 거래량이 없거나 null인 경우를 대비해 0으로 안전하게 치환
      const safeValue =
        d.volume === null || d.volume === undefined || isNaN(d.volume)
          ? 0
          : Number(d.volume);

      // 컬러 값이 유실되었을 경우를 대비해 기본 하드코딩 컬러(투명도 포함) 폴백 지정
      const fallbackUpColor = params.upColorVol || "#26a69a80";
      const fallbackDownColor = params.downColorVol || "#ef535080";
      const safeColor = d.close >= d.open ? fallbackUpColor : fallbackDownColor;

      return {
        time: d.time,
        value: safeValue,
        color: safeColor,
      };
    });

    // 김프 데이터 결합 및 전체 재연산
    if (params.subExchange) {
      let fetchedSub = [];
      let subToVal = toVal;
      if (params.subExchange === "upbit") {
        const dt = new Date(oldestTimeSec * 1000);
        subToVal = dt.toISOString();
      } else {
        subToVal = Math.floor(oldestTimeSec * 1000) - 1;
      }

      if (params.subExchange === "upbit") {
        fetchedSub = await fetchPaginated(
          params.subExchange,
          params.subSymbol,
          params.upbitInterval,
          500,
          subToVal,
        );
      } else if (params.subExchange === "bithumb") {
        // 빗썸은 과거 조회가 제한적이므로 건너뜀
      } else {
        fetchedSub = await fetchCandlesSmart(
          params.subExchange,
          params.subSymbol,
          params.tf,
          500,
          subToVal,
        );
      }

      if (Array.isArray(fetchedSub) && fetchedSub.length > 0) {
        const subMergedMap = new Map();
        const getSubKey = (d) => {
          return params.subExchange === "upbit" ? d.candle_date_time_utc : d[0];
        };
        fetchedSub.forEach((d) => subMergedMap.set(getSubKey(d), d));
        if (store.subRawData) {
          store.subRawData.forEach((d) => subMergedMap.set(getSubKey(d), d));
        }
        store.subRawData = Array.from(subMergedMap.values());
      }

      const newKimchiData = calculateKimchiData(
        newMainData,
        store.subRawData,
        params,
      );
      store.kimchiData = sanitizeChartData(
        newKimchiData.map((d) => mapTime(d, params.tf)),
        true,
      );
      rebuildKimchiDataMap();
    }

    store.mainData = sanitizeChartData(
      newMainData.map((d) => mapTime(d, params.tf)),
    );
    store.volumeData = sanitizeChartData(
      newVolumeData.map((d) => mapTime(d, params.tf)),
      true,
    );
    rebuildMainDataMap();
    rebuildVolumeDataMap();

    // 🚀 [핵심] 차트 캔들 추가 시 화면이 밀리는 현상을 원천 방어하기 위해 Visible Logical Range를 N만큼 밀어줌
    const timeScale = store.chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();

    try {
      // 🚀 모든 시리즈 데이터를 동일한 틱 내에서 동기식으로 세팅하여
      // 캔들 시리즈만 업데이트되고 볼륨 시리즈는 다음 프레임으로 지연되어 생기는 인덱스/시간 불일치 크래시를 원천 차단합니다.
      store.candleSeries.setData(sanitizeChartData(store.mainData));

      if (store.leftScaleSeries) {
        store.leftScaleSeries.setData(
          sanitizeChartData(
            store.mainData.map((d) => ({ time: d.time, value: d.close })),
            true,
          ),
        );
      }
      if (store.volumeSeries && store.volumeData.length > 0) {
        store.volumeSeries.setData(sanitizeChartData(store.volumeData, true));
      }
      if (
        store.kimchiSeries &&
        store.kimchiData &&
        store.kimchiData.length > 0
      ) {
        store.kimchiSeries.setData(sanitizeChartData(store.kimchiData, true));
      }

      // 🔥 [핵심] 모든 시리즈 데이터가 동기적으로 세팅된 뒤, 화면 범위 이동을 처리합니다.
      requestAnimationFrame(() => {
        try {
          if (visibleRange && N > 0) {
            timeScale.setVisibleLogicalRange({
              from: visibleRange.from + N,
              to: visibleRange.to + N,
            });
          }
        } catch (setErr) {
          console.warn(
            "🚨 Lazy Load 내부 렌더링/범위조정 예외 우회 완료:",
            setErr,
          );
        }
      });
    } catch (candleErr) {
      console.warn("🚨 Lazy Load 데이터 세팅 예외 우회 완료:", candleErr);
    }

    // Xconsole.log(`✅ [Lazy Load] 과거 캔들 ${N}개 추가 결합 완료!`);
  } catch (err) {
    console.error("🚨 과거 데이터 Lazy Loading 실패:", err);
  } finally {
    store.isLoadingMoreHistory = false;
    lazyIndicator.classList.remove("opacity-100", "scale-100");
    lazyIndicator.classList.add("opacity-0", "scale-95", "pointer-events-none");
  }
}

window.loadMoreHistory = loadMoreHistory;
