// chart_data.js
import { store, tfSec } from "./_store.js";
import { calculateKimchiData } from "./chart_data_kimchi.js";
import {
  getMultiplier,
  getPureBase,
  getUnixSeconds,
  ensureSafeUnixSeconds,
  sanitizeChartData,
} from "./chart_utils.js";

import { formatSmartPrice, formatCrosshairPrice } from "./chart_utils.js";
import { updateExchangeBadges } from "./ui_control.js";
import {
  formatListingDateWithExchange,
  updateRowInnerHTML,
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
        const bSym = symbol.replace("KRW-", "") + "_KRW";
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
) {
  const now = Date.now();
  if (now - store.lastFetchTime < 10) return;
  store.lastFetchTime = now;

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

  // 🚀 백엔드와 마찬가지로, 중복 매핑 목록(duplicated_list)을 활용하여 정확한 UID를 먼저 판별해 rowInfo를 찾습니다.
  let expectedUid = null;
  const dupList = store.marketDataMap?.duplicated_list;
  if (dupList) {
    const exchangeTag = isUpbit
      ? "UPBIT"
      : isBithumb
        ? "BITHUMB"
        : isBybit
          ? "BYBIT"
          : "BINANCE";

    for (const [key, v] of Object.entries(dupList)) {
      if (Array.isArray(v) && v.length >= 4) {
        const dupBase = key.split("(")[0].toUpperCase();
        const dupEx = v[3].toUpperCase();
        if (dupBase === pureBase && dupEx === exchangeTag) {
          expectedUid = v[0];
          break;
        }
      }
    }
  }

  let cleanDisplayName = displayName.toUpperCase();
  if (cleanDisplayName.endsWith("KRW")) cleanDisplayName = cleanDisplayName.slice(0, -3);
  else if (cleanDisplayName.endsWith("USDT")) cleanDisplayName = cleanDisplayName.slice(0, -4);

  let rowInfo = store.currentTableData.find((c) => {
    // 1. UID가 일치하면 최우선 매칭 (동명이인 코인 정확하게 식별)
    if (expectedUid && c.UID === expectedUid) return true;

    // 2. 일반 매칭 분기
    const t = (c.Ticker || "").toUpperCase();
    const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);

    const dt = (c.DisplayTicker || "").toUpperCase();
    const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);

    const sym = (c.Symbol || "").toUpperCase();
    const cleanSym = sym.endsWith("KRW") ? sym.slice(0, -3) : (sym.endsWith("USDT") ? sym.slice(0, -4) : sym);

    if (cleanT !== cleanDisplayName && cleanDt !== cleanDisplayName && cleanSym !== cleanDisplayName)
      return false;

    if (isUpbit && (c.Listed_Exchanges?.includes("UPBIT") || c.Upbit === "O"))
      return true;
    if (isFutures && c.Listed_Exchanges?.includes("BINANCE_FUTURES"))
      return true;
    if (isSpot && c.Listed_Exchanges?.includes("BINANCE")) return true;
    if (isBithumb && c.Listed_Exchanges?.includes("BITHUMB")) return true;
    if (isBybitFutures && c.Listed_Exchanges?.includes("BYBIT_FUTURES"))
      return true;
    if (isBybit && c.Listed_Exchanges?.includes("BYBIT")) return true;
    return false;
  });

  if (!rowInfo) {
    rowInfo = store.currentTableData.find((c) => {
      const t = (c.Ticker || "").toUpperCase();
      const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);

      const dt = (c.DisplayTicker || "").toUpperCase();
      const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);

      const sym = (c.Symbol || "").toUpperCase();
      const cleanSym = sym.endsWith("KRW") ? sym.slice(0, -3) : (sym.endsWith("USDT") ? sym.slice(0, -4) : sym);

      return cleanT === cleanDisplayName || cleanDt === cleanDisplayName || cleanSym === cleanDisplayName;
    });
  }

  let exactSpot = rowInfo?.Exact_Spot || pureBase;
  let exactFutures = rowInfo?.Exact_Futures || pureBase;
  let exactUpbit = rowInfo?.Upbit_Symbol || rowInfo?.Symbol || pureBase;
  let exactBithumb = rowInfo?.Bithumb_Symbol || pureBase;
  let exactBybit = rowInfo?.Bybit_Symbol || pureBase;

  // 🚀 store.marketDataMap.duplicated_list (mapping.json 계승 데이터)를 활용한 프론트엔드 심볼 매핑 보정
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

  // 현재 마켓의 정확한 심볼 지정 (실시간 소켓용)
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
  // 🚀 [고급 로딩] 기존 캔들 잔상은 유지하면서 화면만 살짝 어둡게 처리

  // 🚀 [신규] PAST_GAP_RECOVERY_MAP에 해당하는 녀석(AIA 등 과거 차트 단절 복구 대상)인지 감지!
  // 해당되는 놈은 백엔드에서 TvDatafeed 라이브러리 호출하느라 차트 로딩이 매우 느리므로 전용 안내 문구 오버레이 추가!
  const pastGapMap = store.marketDataMap?.past_gap_map || {};
  let gapOverlay = document.getElementById("gap-recovery-overlay");

  if (pastGapMap[pureBase] && !isTfChange) {
    if (!gapOverlay) {
      gapOverlay = document.createElement("div");
      gapOverlay.id = "gap-recovery-overlay";
      // 🚀 트뷰 차트 캔버스 영역(wrapper) 위에 정중하고 고급스럽게 안착!
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
    // 일반 코인이면 기존 로직 유지 (오버레이 숨김)
    if (gapOverlay) gapOverlay.style.display = "none";
  }

  try {
    // 🚀 [사용자 요청 반영: 사슴 마커 즉시 제거] 차트/타임프레임 전환 또는 김프 토글 시, 기존 차트의 잔상은 남겨두되 과거 끝단 마커는 즉시 날립니다.
    // if (store.candleSeries) store.candleSeries.setMarkers([]);
    // if (store.volumeSeries) store.volumeSeries.setMarkers([]);
    // if (store.kimchiSeries) store.kimchiSeries.setMarkers([]);
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

      // 🚀 [수정] 불필요한 두 번째 과거 조회(to=...) 로직 전면 삭제 (사용자님 통찰 1000% 적중!)
      // 이미 백엔드(app.py)에 TvDatafeed 스마트 폴백 엔진이 완벽하게 구축되어 있으므로,
      // 프론트엔드가 두 번씩 API를 날려 네트워크 렉을 유발할 필요가 전혀 없습니다.
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

        // 🚀 bybit_futures가 빈 리스트면 bybit_spot으로 폴백
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
          "15m": "10m",
          "30m": "30m",
          "1h": "1h",
          "2h": "1h",
          "4h": "1h",
          "12h": "12h",
          "1d": "24h",
        };
        const bFetchInt = bMap[store.currentTF] || "24h";
        const bData = await fetchCandlesSmart(
          "bithumb",
          krwTicker,
          bFetchInt,
          500,
        );
        if (bData.status === "0000" && Array.isArray(bData.data)) {
          rawMain = bData.data.map((d) => ({
            time: Number(d[0]) / 1000,
            open: Number(d[1]),
            close: Number(d[2]),
            high: Number(d[3]),
            low: Number(d[4]),
            vol: Number(d[5]),
          }));

          // 🚀 [추가] 빗썸 일봉 -> 주봉/월봉 조립 엔진
          if (store.currentTF === "1w" || store.currentTF === "1M") {
            const getStartOfWeek = (t) => {
              const d = new Date(t * 1000);
              const day = d.getUTCDay();
              const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
              const mon = new Date(
                Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0),
              );
              return mon.getTime() / 1000;
            };
            const getStartOfMonth = (t) => {
              const d = new Date(t * 1000);
              const first = new Date(
                Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0),
              );
              return first.getTime() / 1000;
            };

            const groups = {};
            const getGroupTime =
              store.currentTF === "1w" ? getStartOfWeek : getStartOfMonth;

            rawMain.forEach((d) => {
              const gt = getGroupTime(d.time);
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
          }

          mainStep = store.currentTF === "3d" ? 3 : 1;
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

    // 🚀 No Data 처리: 바이빗 실패 시 업비트 폴백, 그래도 없으면 조용히 종료
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

    // 🚀 [타겟] 거래소별 상장일 타겟 로직
    // - 현재 차트 모드를 파악해 exchange_key를 다르게 할당
    // - 메모리(store.listingDates)에 이미 있는 날짜보다 오래된 경우만 POST
    try {
      const earliestTime = rawMain[0].time;
      const newDateStr = new Date(earliestTime * 1000)
        .toISOString()
        .split("T")[0]; // YYYY-MM-DD

      // 거래소 키 맵핑
      let exchangeKey = null;
      if (isFutures || isSpot) exchangeKey = "binance_listing";
      else if (isUpbit) exchangeKey = "upbit_listing";
      else if (isBithumb) exchangeKey = "bithumb_listing";
      else if (isBybit) exchangeKey = "bybit_listing";

      if (exchangeKey) {
        // 메모리 먼저 업데이트 (UI 즉시 반영)
        if (!store.listingDates) store.listingDates = {};
        const entry = store.listingDates[pureBase] || {};
        const existing = entry[exchangeKey] || "";
        const isNewer = !existing || newDateStr < existing;

        if (isNewer) {
          // 메모리 업데이트
          store.listingDates[pureBase] = {
            ...entry,
            [exchangeKey]: newDateStr,
          };

          // 테이블 셀 업데이트
          const listingEl = document.getElementById(
            `listing-${store.currentSelectedSymbol}`,
          );
          const tRow = store.originalTableData.find(
            (r) =>
              r.Ticker === store.currentSelectedSymbol ||
              r.DisplayTicker === store.currentSelectedSymbol,
          );
          if (tRow) {
            tRow.Listing_Date = newDateStr;
            if (listingEl)
              listingEl.innerText = formatListingDateWithExchange(tRow);
          } else if (listingEl) {
            listingEl.innerText = newDateStr;
          }

          // 백엔드에 비동기 저장 (화면 블록 제로)
          fetch("/api/listing-dates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: pureBase,
              exchange_key: exchangeKey,
              date: newDateStr,
            }),
          }).catch(() => { }); // 실패해도 취트 안 남의선답
        } else {
          // 메모리의 날짜를 테이블에만 줘주기 (POST 없이)
          const listingEl = document.getElementById(
            `listing-${store.currentSelectedSymbol}`,
          );
          const tRow = store.originalTableData.find(
            (r) =>
              r.Ticker === store.currentSelectedSymbol ||
              r.DisplayTicker === store.currentSelectedSymbol,
          );
          if (tRow) {
            tRow.Listing_Date = existing;
            if (listingEl)
              listingEl.innerText = formatListingDateWithExchange(tRow);
          } else if (listingEl) {
            listingEl.innerText = existing;
          }
        }
      }
    } catch (e) {
      console.warn("Listing Date Update Error:", e);
    }

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
      for (let i = 0; i < rawMain.length; i += mainStep) {
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

    // ==========================================
    // 2️⃣ 메인 차트 초고속 즉시 렌더링 & 로딩 해제 (Lazy의 시작)
    // ==========================================
    if (store.currentAsset !== snapshotAsset || store.currentTF !== snapshotTF)
      return;

    store.mainData = sanitizeChartData(newMainData.map((d) => mapTime(d)));
    store.volumeData = sanitizeChartData(
      newVolumeData.map((d) => mapTime(d)),
      true,
    );

    // 🚀 과거 데이터 추가 로딩을 위해 현재 요청 인자값 백업
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

      // 🚀 [실시간 시세 업데이트] 테이블 클릭(선택) 시, 5분 주기의 서버 캐시 데이터 대신
      // 방금 REST API로 받아온 가장 따끈따끈한 최신 봉 종가(lastCandle.close)를 반영합니다.
      // 🚨 단, 시간 프레임(TF) 변경 시에는 이미 소켓에서 최신 실시간 가격을 잘 받고 있으므로 과거 REST 데이터로 덮어쓰지 않고 보존합니다.
      const lastCandle = store.mainData[store.mainData.length - 1];
      if (lastCandle && rowInfo) {
        if (!isTfChange) {
          if (isUpbit) {
            rowInfo.Upbit_Price = lastCandle.close;
            rowInfo.Price_KRW = lastCandle.close;
          } else if (isBithumb) {
            rowInfo.Bithumb_Price = lastCandle.close;
          } else if (isFutures) {
            rowInfo.Binance_Price_Futures = lastCandle.close;
            rowInfo.Binance_Price = lastCandle.close;
          } else if (isSpot) {
            rowInfo.Binance_Price_Spot = lastCandle.close;
            rowInfo.Binance_Price = lastCandle.close;
          } else if (isBybitFutures) {
            rowInfo.Bybit_Price_Futures = lastCandle.close;
            rowInfo.Bybit_Price = lastCandle.close;
          } else if (isBybit) {
            rowInfo.Bybit_Price_Spot = lastCandle.close;
            rowInfo.Bybit_Price = lastCandle.close;
          }
          rowInfo.Price_Raw = lastCandle.close;
        }

        if (typeof window.updateHeaderDisplay === "function") {
          // TF 변경 시에는 newPrice 파라미터를 비워서 현재 rowInfo에 있는 최신 라이브 가격을 유지
          window.updateHeaderDisplay(
            rowInfo,
            isTfChange ? undefined : lastCandle.close,
            p,
          );
        }

        const rowEl = store.rowDomMap && store.rowDomMap.get(rowInfo.Ticker);
        if (rowEl && typeof updateRowInnerHTML === "function") {
          updateRowInnerHTML(rowEl, rowInfo);
        }
      }

      store.candleSeries.applyOptions({
        priceFormat: {
          type: "custom",
          precision: p,
          minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
          formatter: (price) => formatCrosshairPrice(price, p, false),
        },
      });

      // 🚀 모든 시리즈 데이터를 동일한 실행 프레임(Tick) 내에서 동기식으로 세팅하여
      // 시리즈 간의 데이터 개수/시간 불일치로 인한 Value is null 에러를 방지합니다.
      try {
        store.candleSeries.setData(sanitizeChartData(store.mainData));

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
        } else if (store.volumeSeries) {
          store.volumeSeries.setData([]);
        }

        if (store.kimchiSeries) {
          store.kimchiSeries.setData([]); // 🚀 과거 김프 잔재 초기화
        }
      } catch (err) {
        console.warn("🚨 시리즈 데이터 동기 세팅 예외 우회:", err);
      }

      // 레이아웃 및 실시간 소켓 연결 등은 다음 프레임에 안전하게 처리
      requestAnimationFrame(() => {
        if (typeof applyChartLayout === "function") applyChartLayout();
        if (typeof autoFit === "function") autoFit(isTabRestore);
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

        // 🚀 [해결] 차트 레이아웃, 오토핏 및 렌더링 프레임이 완벽히 정렬 완료된 직후에 로딩 상태를 해제하여
        // timescale 조작 이벤트 오작동으로 인한 의도치 않은 Lazy Load 발동을 차단합니다!
        window.isFetchingChart = false;
        store.isFetchingChart = false;
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
    }

    // 🚀 [로딩 해제 및 최종 싱크 안착] 차트 데이터가 완전히 캔버스에 렌더링된 직후, 라이브러리가 코인마다 다르게 계산해 둔 순수 너비를 최초 1회 캐치하여 기준값으로 던져놓음!
    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";

    // 데이터가 없거나 캔들 시리즈가 없어 requestAnimationFrame으로 진입하지 않은 경우에 대한 동기식 클리어 폴백
    if (!store.candleSeries || !store.mainData || store.mainData.length === 0) {
      window.isFetchingChart = false;
      store.isFetchingChart = false;
      if (typeof window.syncPriceScaleWidths === "function")
        window.syncPriceScaleWidths();
    }

    // ==========================================
    // 3️⃣ 김프 데이터 Lazy 렌더링 (백그라운드 비동기)
    // ==========================================
    (async () => {
      try {
        let subExchange = null;
        let subSymbol = null;
        let subMulti = 1;
        let mainMulti = getMultiplier(mainTickerStr);
        let missingTarget = "";
        let availableSubs = [];

        const querySym = rowInfo ? rowInfo.DisplayTicker : uniqueTicker;
        // 🚀 coin-info 클라 캐시 - 동일 코인 중복 서버 호출 차단
        if (!store._coinInfoCache) store._coinInfoCache = new Map();
        const _cachedInfo = store._coinInfoCache.get(querySym);
        const _fetchCoinInfo = _cachedInfo
          ? Promise.resolve(_cachedInfo)
          : fetch(`/api/coin-info/${querySym}`).then((res) => res.json()).then((d) => {
              store._coinInfoCache.set(querySym, d);
              return d;
            });
        
        const listedEx = rowInfo ? rowInfo.Listed_Exchanges || [] : [];

        if (
          store.currentChartMarket === "UPBIT" ||
          store.currentChartMarket === "BITHUMB"
        ) {
          if (listedEx.includes("BINANCE"))
            availableSubs.push({
              id: "binance_spot",
              name: "B-SPOT",
              bg: "#444",
              text: "#fff",
              sym: `${exactSpot}USDT`,
              pureSym: exactSpot,
            });
          if (listedEx.includes("BINANCE_FUTURES"))
            availableSubs.push({
              id: "binance_futures",
              name: "B-FUT",
              bg: "#f0b90b",
              text: "#000",
              sym: `${exactFutures}USDT`,
              pureSym: exactFutures,
            });
          if (listedEx.includes("BYBIT_FUTURES"))
            availableSubs.push({
              id: "bybit_futures",
              name: "BYB-F",
              bg: "#f7a600",
              text: "#000",
              sym: `${exactBybit}USDT`,
              pureSym: exactBybit,
            });
          if (listedEx.includes("BYBIT"))
            availableSubs.push({
              id: "bybit_spot",
              name: "BYBIT",
              bg: "#f7a600",
              text: "#fff",
              sym: `${exactBybit}USDT`,
              pureSym: exactBybit,
            });
          if (availableSubs.length === 0)
            missingTarget = "글로벌 거래소(바이낸스/바이비트)";
        } else if (isBybit) {
          // 🚀 바이빗이 메인 차트일 때: 국내 거래소(업비트/빗썸) 김프 서브 추가
          if (listedEx.includes("UPBIT") || rowInfo?.Upbit === "O")
            availableSubs.push({
              id: "upbit",
              name: "UPBIT",
              bg: "#093687",
              text: "#fff",
              sym: `KRW-${exactUpbit}`,
              pureSym: exactUpbit,
            });
          if (listedEx.includes("BITHUMB"))
            availableSubs.push({
              id: "bithumb",
              name: "BITHUMB",
              bg: "#ff8b00",
              text: "#fff",
              sym: `${exactBithumb}_KRW`,
              pureSym: exactBithumb,
            });
          if (availableSubs.length === 0)
            missingTarget = "국내 원화 거래소(업비트/빗썸)";
        } else {
          if (listedEx.includes("UPBIT") || rowInfo?.Upbit === "O")
            availableSubs.push({
              id: "upbit",
              name: "UPBIT",
              bg: "#093687",
              text: "#fff",
              sym: `KRW-${exactUpbit}`,
              pureSym: exactUpbit,
            });
          if (listedEx.includes("BITHUMB"))
            availableSubs.push({
              id: "bithumb",
              name: "BITHUMB",
              bg: "#ff8b00",
              text: "#fff",
              sym: `${exactBithumb}_KRW`,
              pureSym: exactBithumb,
            });
          if (availableSubs.length === 0)
            missingTarget = "국내 원화 거래소(업비트/빗썸)";
        }

        if (availableSubs.length > 0) {
          const preferred = availableSubs.find(
            (s) => s.id === store.preferredKimchiSub,
          );
          const selected = preferred || availableSubs[0];
          subExchange = selected.id;
          subSymbol = selected.sym;
          subMulti = getMultiplier(selected.sym);
          store.preferredKimchiSub = subExchange;

          // 🚀 [추가] 김프 로딩 메시지 UI 동적 렌더링
          let loadingMessageContainer = document.getElementById(
            "kimchi-loading-message",
          );
          if (!loadingMessageContainer) {
            loadingMessageContainer = document.createElement("div");
            loadingMessageContainer.id = "kimchi-loading-message";
            loadingMessageContainer.className =
              "absolute right-3 z-[110] flex gap-1.5 transition-all duration-300 pointer-events-none";
            if (wrapper) wrapper.appendChild(loadingMessageContainer);
          }
          // loadingMessageContainer.innerHTML = `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded opacity-60 bg-theme-panel text-theme-text">?3 불러오는중...</span>`;
          // loadingMessageContainer.style.display = "flex"; // Show loading message

          let switcherContainer = document.getElementById("kimchi-switcher");
          if (!switcherContainer) {
            switcherContainer = document.createElement("div");
            switcherContainer.id = "kimchi-switcher";
            switcherContainer.className =
              "absolute right-3 z-[110] flex gap-1.5 transition-all duration-300 pointer-events-auto";
            if (wrapper) wrapper.appendChild(switcherContainer);
          }

          if (availableSubs.length > 1) {
            switcherContainer.innerHTML = availableSubs
              .map((s) => {
                const isActive = s.id === subExchange;
                const opacity = isActive
                  ? "opacity-100 ring-2 ring-white/50 scale-105"
                  : "opacity-40 hover:opacity-80";
                return `<button class="text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm transition-all ${opacity}" style="background-color: ${s.bg}; color: ${s.text};" onclick="switchKimchiSub('${s.id}')">${s.name}</button>`;
              })
              .join("");
            switcherContainer.style.display = "flex";
          } else {
            const s = availableSubs[0];
            switcherContainer.innerHTML = `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded opacity-60 pointer-events-none" style="background-color: ${s.bg}; color: ${s.text};">vs ${s.name}</span>`;
            switcherContainer.style.display = "flex";
          }

          store.paneConfig.kimchi = true;
          const noDataMsg = document.getElementById("kimchi-no-data");
          if (noDataMsg) noDataMsg.classList.add("hidden");
          requestAnimationFrame(() => {
            try {
              if (typeof applyChartLayout === "function") applyChartLayout();
            } catch (layoutErr) {
              console.warn(
                "🚨 fetchHistory 내 applyChartLayout 예외 우회:",
                layoutErr,
              );
            }
          });

          // 🚀 김프 데이터 Fetch (Lazy Load)
          const u = store.currentTF.replace(/[0-9]/g, "");
          const totalSec = tfSec[store.currentTF] || 60;
          let upbitInterval = "minutes/1";
          if (u === "d" || u === "w" || u === "M") {
            upbitInterval = u === "w" ? "weeks" : u === "M" ? "months" : "days";
          } else {
            const baseMin =
              [1, 3, 5, 10, 15, 30, 60, 240]
                .reverse()
                .find((m) => (totalSec / 60) % m === 0) || 1;
            upbitInterval = `minutes/${baseMin}`;
          }

          let subRaw = [];
          if (subExchange === "upbit") {
            subRaw = await fetchPaginated(
              subExchange,
              subSymbol,
              upbitInterval,
              500,
            );
          } else if (subExchange === "bithumb") {
            const bMap = {
              "1m": "1m",
              "3m": "3m",
              "5m": "5m",
              "15m": "10m",
              "30m": "30m",
              "1h": "1h",
              "2h": "1h",
              "4h": "1h",
              "12h": "12h",
              "1d": "24h",
              "3d": "24h",
              "1w": "24h",
              "1M": "24h",
            };
            const r = await fetchCandlesSmart(
              "bithumb",
              subSymbol,
              bMap[store.currentTF] || "24h",
              1000,
            );
            subRaw = r.data || [];
          } else {
            const subJson = await fetchCandlesSmart(
              subExchange,
              subSymbol,
              store.currentTF,
              500,
            );
            // 🚀 바이빗 응답은 result.list 형태로 오므로 추출 처리
            if (subJson?.result?.list) {
              subRaw = subJson.result.list.sort(
                (a, b) => Number(a[0]) - Number(b[0]),
              );
            } else {
              subRaw = subJson;
            }
          }

          const rateCacheKey = `fiat_rate_only`;
          if (store.lastFetchParams) {
            store.lastFetchParams.subExchange = subExchange;
            store.lastFetchParams.subSymbol = subSymbol;
            store.lastFetchParams.subMulti = subMulti;
            store.lastFetchParams.mainMulti = mainMulti;
            store.lastFetchParams.upbitInterval =
              typeof upbitInterval !== "undefined" ? upbitInterval : null;
            store.lastFetchParams.rateCacheKey = rateCacheKey;
          }
          store.subRawData = subRaw;

          // 🚀 [법정 환율 맵] 타임프레임별 환율 왜곡 방지! (트뷰 과거기록 연동)
          if (!store.fiatRateCache) store.fiatRateCache = {};

          if (!store.fiatRateCache[rateCacheKey]) {
            const res = await fetch("/api/usdkrw");
            const usdkrwRaw = await res.json();

            if (usdkrwRaw && !usdkrwRaw.error) {
              let fiatTimeline = [];
              // 트레이딩뷰 과거 법정환율 추가 (모든 타임프레임에서 매끄러운 과거 김프 생성)
              for (let [ts, price] of Object.entries(usdkrwRaw)) {
                fiatTimeline.push({
                  time: Number(ts),
                  price: price,
                  source: "tv_fiat",
                });
              }
              fiatTimeline.sort((a, b) => a.time - b.time);
              store.fiatRateCache[rateCacheKey] = fiatTimeline;
            }
          }

          // 🚀 JS 고속 김프 연산 (공통 헬퍼 함수로 중복 제거)
          let newKimchiData = calculateKimchiData(
            store.mainData,
            subRaw,
            store.lastFetchParams,
          );

          if (
            store.currentAsset !== snapshotAsset ||
            store.currentTF !== snapshotTF
          )
            return;

          // 🚀 [무반동 방어막] 김프를 그리기 전 현재 X축(시간) 스케일을 캡처하고, 덮어쓰자마자 동기적으로 복구!
          store.kimchiData = newKimchiData.map((d) => mapTime(d));
          if (store.kimchiSeries && store.kimchiData.length > 0) {
            // 🚀 [Premium] 최신 김프 색상을 CSS 변수에 주입하여 Glow 효과 연동
            const lastK = store.kimchiData[store.kimchiData.length - 1];
            const wrapper = document.getElementById("chart-wrapper");
            if (wrapper && lastK)
              wrapper.style.setProperty("--kimchi-color", lastK.color);

            requestAnimationFrame(() => {
              try {
                const currentRange = store.chart
                  .timeScale()
                  .getVisibleLogicalRange(); // 1. 현재 화면 캡처
                store.kimchiSeries.setData(
                  sanitizeChartData(store.kimchiData, true),
                ); // 2. 김프 데이터 꽂기
                if (currentRange)
                  store.chart.timeScale().setVisibleLogicalRange(currentRange); // 3. 미동 없이 복구!

                // 🔥 [핵심] 데이터 안착 후 동일 프레임에서 레이아웃 적용
                if (typeof applyChartLayout === "function") applyChartLayout();
                if (typeof window.syncPriceScaleWidths === "function")
                  setTimeout(window.syncPriceScaleWidths, 50);
              } catch (setErr) {
                console.warn(
                  "🚨 kimchiSeries.setData 렌더링 예외 우회 완료:",
                  setErr,
                );
              }
            });
          }
        } else {
          // No available subs, so hide loading message if it was shown
          store.paneConfig.kimchi = false;
          const wrapper = document.getElementById("chart-wrapper");
          if (wrapper)
            wrapper.style.setProperty("--kimchi-color", "transparent");
          const noDataMsg = document.getElementById("kimchi-no-data");
          if (noDataMsg && !isTfChange) {
            noDataMsg.classList.remove("hidden");
            const pTag = noDataMsg.querySelector("p");
            // if (pTag)
            //   pTag.innerHTML = `⚠️ 해당하는 ${missingTarget} 데이터가 없어 김프 차트를 표시할 수 없습니다.`;
          }
          let loadingMessageContainer = document.getElementById(
            "kimchi-loading-message",
          );
          if (loadingMessageContainer)
            loadingMessageContainer.style.display = "none";
          requestAnimationFrame(() => {
            try {
              if (typeof applyChartLayout === "function") applyChartLayout();
            } catch (layoutErr) {
              console.warn(
                "🚨 fetchHistory (no-data) applyChartLayout 예외 우회:",
                layoutErr,
              );
            }
          });
        }
      } catch (err) {
        console.error("김프 백그라운드 렌더링 실패:", err);
        // Hide loading message on error
        let loadingMessageContainer = document.getElementById(
          "kimchi-loading-message",
        );
        if (loadingMessageContainer)
          loadingMessageContainer.style.display = "none";
      }
    })();
  } catch (e) {
    console.error("차트 로드 실패:", e);
  } finally {
    if (loadingModal) loadingModal.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("chart-loading");
    if (gapOverlay) gapOverlay.style.display = "none";
    window.isFetchingChart = false;
    store.isFetchingChart = false;
    store.isNewCoinSelected = false; // 🚀 신규 코인 선택 플래그 초기화
  }
}

window.switchKimchiSub = function (newSubId) {
  store.preferredKimchiSub = newSubId;
  if (typeof fetchHistory === "function") {
    fetchHistory(store.currentAsset);
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
      let groupedMain = [];
      for (let i = 0; i < fetchedMain.length; i += params.mainStep) {
        const chunk = fetchedMain.slice(i, i + params.mainStep);
        if (chunk.length > 0) {
          const time = chunk[0].time;
          const open = chunk[0].open;
          const close = chunk[chunk.length - 1].close;
          const high = Math.max(...chunk.map((c) => c.high));
          const low = Math.min(...chunk.map((c) => c.low));
          const totalVol = chunk.reduce(
            (sum, c) => sum + (Number(c.volume) || 0),
            0,
          );
          groupedMain.push({ time, open, high, low, close, volume: totalVol });
        }
      }
      fetchedMain = groupedMain;
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
    }

    store.mainData = sanitizeChartData(
      newMainData.map((d) => mapTime(d, params.tf)),
    );
    store.volumeData = sanitizeChartData(
      newVolumeData.map((d) => mapTime(d, params.tf)),
      true,
    );

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
