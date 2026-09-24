// chart_data.js
import { store, tfSec } from "./_store.js";
import { fetchHistory } from "./chart_fetch.js";
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
// import { fetchBithumbUnifiedCandles } from "./chart_bithumb_sync.js"; // 빗썸 정신차릴 때까지 임시 대기

// [업비트 토큰 버킷 & 서킷 브레이커 모듈 분리 연동]
import {
  UpbitBrowserLimiter,
  upbitBrowserLimiter,
  UPBIT_PACING_MS,
} from "./chart_limiter.js";
import { normalizeExchangeInterval } from "./_market_rules.js";
export { UpbitBrowserLimiter, upbitBrowserLimiter, UPBIT_PACING_MS };

// 브라우저 레벨 In-Flight 중복 호출 합승 맵
const inFlightCandleRequests = new Map();

export async function fetchCandlesSmart(
  exchange,
  symbol,
  interval,
  limit,
  toVal = null,
  startVal = null,
) {
  const flightKey = `${exchange}_${symbol}_${interval}_${limit}_${toVal || ""}_${startVal || ""}`;
  if (inFlightCandleRequests.has(flightKey)) {
    return inFlightCandleRequests.get(flightKey);
  }

  const promise = (async () => {
    try {
      return await _fetchCandlesSmartInternal(
        exchange,
        symbol,
        interval,
        limit,
        toVal,
        startVal,
      );
    } finally {
      inFlightCandleRequests.delete(flightKey);
    }
  })();

  inFlightCandleRequests.set(flightKey, promise);
  return promise;
}

async function _fetchCandlesSmartInternal(
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

  const cleanSymbol = symbol
    .replace("USDT", "")
    .replace("KRW-", "")
    .replace("_KRW", "")
    .split("(")[0]
    .toUpperCase();
  const isAlphaCoin = Boolean(
    store.currentTableData?.some(
      (c) =>
        (c.Symbol?.toUpperCase() === cleanSymbol ||
          c.Ticker?.toUpperCase() === `${cleanSymbol}USDT` ||
          c.Exact_Spot?.toUpperCase() === cleanSymbol) &&
        (c.Binance_Alpha === "O" ||
          c.is_alpha ||
          c.Listed_Exchanges?.includes("BINANCE_ALPHA")) &&
        c.Binance_Futures !== "O" &&
        !c.is_futures,
    ),
  );

  // 1. 브라우저 직접 호출 (업비트 토큰 버킷 연동 및 바이낸스/바이비트 직통)
  const isUpbit = exchange === "upbit";
  const upbitAllowed = isUpbit ? upbitBrowserLimiter.canRequest() : false;
  const canDirectFetch =
    !isGapRecovery &&
    (isUpbit ? upbitAllowed : (!toVal && !startVal));

  if (canDirectFetch) {
    try {
      let directUrl = null;

      const isBinanceFuturesCoin = Boolean(
        store.currentTableData?.some(
          (c) =>
            (c.Symbol?.toUpperCase() === cleanSymbol ||
              c.Ticker?.toUpperCase() === `${cleanSymbol}USDT` ||
              c.Exact_Futures?.toUpperCase() === cleanSymbol) &&
            (c.Binance_Futures === "O" ||
              c.is_futures ||
              c.Listed_Exchanges?.includes("BINANCE_FUTURES")),
        ),
      );

      const endParamBinance = toVal ? `&endTime=${toVal}` : "";
      const startParamBinance = startVal ? `&startTime=${startVal}` : "";
      const endParamBybit = toVal ? `&end=${toVal}` : "";
      const startParamBybit = startVal ? `&start=${startVal}` : "";

      // 마켓 규칙(Single Source of Truth) 규격에 맞춘 인터벌 정규화
      const normInt = normalizeExchangeInterval(exchange, interval);

      if (exchange === "upbit") {
        const uSym = symbol.startsWith("KRW-") ? symbol : `KRW-${cleanSymbol}`;
        const uCount = Math.min(limit || 200, 200);
        const uTo = toVal ? `&to=${encodeURIComponent(toVal)}` : "";
        directUrl = `https://api.upbit.com/v1/candles/${normInt}?market=${uSym}&count=${uCount}${uTo}`;
      } else if (exchange === "binance_spot" && !isAlphaCoin) {
        directUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${normInt}&limit=${limit}${endParamBinance}${startParamBinance}`;
      } else if (
        exchange === "binance_futures" &&
        !isAlphaCoin &&
        isBinanceFuturesCoin
      ) {
        directUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${normInt}&limit=${limit}${endParamBinance}${startParamBinance}`;
      } else if (exchange === "bybit_spot" || exchange === "bybit_futures") {
        const category = exchange === "bybit_spot" ? "spot" : "linear";
        directUrl = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${symbol}&interval=${normInt}&limit=${limit || 1000}${endParamBybit}${startParamBybit}`;
      }

      if (directUrl) {
        const fetchTimeout = exchange === "upbit" ? 1500 : 500;
        const fetchSignal =
          typeof AbortSignal !== "undefined" &&
            typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(fetchTimeout)
            : undefined;
        const res = await fetch(directUrl, { signal: fetchSignal });

        if (res.ok) {
          if (exchange === "upbit") {
            const remReq = res.headers.get("Remaining-Req");
            if (remReq) upbitBrowserLimiter.syncRemainingReq(remReq);
          }
          const data = await res.json();
          if (
            exchange.startsWith("binance") &&
            Array.isArray(data) &&
            data.length > 0
          ) {
            return data;
          } else if (exchange === "upbit" && Array.isArray(data)) {
            return data;
          } else if (
            exchange.startsWith("bybit") &&
            data &&
            data.retCode === 0
          ) {
            return data;
          }
        } else if (res.status === 429) {
          if (exchange === "upbit") {
            upbitBrowserLimiter.triggerCooldown(5.0);
          }
        } else if (res.status === 404 || res.status === 400) {
          if (exchange === "binance_spot") {
            // pass through to server proxy fallback
          } else {
            return [];
          }
        }
      }
    } catch (err) {
      if (exchange === "upbit") {
        upbitBrowserLimiter.triggerCooldown(2.0);
      }
    } finally {
      if (upbitAllowed) {
        upbitBrowserLimiter.release();
      }
    }
  }

  // 2. 비상 백엔드 프록시 폴백 (/api/candles)
  // - 브라우저 토큰 버킷 한도 초과 시
  // - 429/네트워크 에러로 서킷 브레이커 발동 시
  // - CORS 차단 환경이나 알파 코인 폴백 시
  const queryTo = toVal ? `&to=${toVal}` : "";
  const queryStart = startVal ? `&start=${startVal}` : "";
  const res = await fetch(
    `/api/candles?exchange=${exchange}&symbol=${symbol}&interval=${interval}&limit=${limit}${queryTo}${queryStart}`,
  );
  const fallbackExchange = res.headers.get("X-Fallback-Exchange");
  const cleanSym = symbol
    .replace("USDT", "")
    .replace("KRW-", "")
    .replace("_KRW", "")
    .split("(")[0]
    .toUpperCase();
  if (
    exchange === "binance_spot" &&
    isAlphaCoin &&
    fallbackExchange &&
    !["BINANCE", "BINANCE_ALPHA", "BINANCE_SPOT"].includes(
      fallbackExchange.toUpperCase(),
    )
  ) {
    store.activeCandleFallback = fallbackExchange.toUpperCase();
    if (!store.fallbackExchanges) store.fallbackExchanges = {};
    store.fallbackExchanges[cleanSym] = fallbackExchange.toUpperCase();
    if (typeof updateExchangeBadges === "function") {
      updateExchangeBadges(symbol);
    }
  } else if (exchange.startsWith("binance") && !isAlphaCoin) {
    store.activeCandleFallback = null;
  }
  return await res.json();
}

export async function fetchPaginated(
  exchange,
  symbol,
  interval,
  totalLimit,
  startTo = "",
  onFirstBatch = null,
) {
  let result = [];
  let lastTo = startTo;
  let remaining = totalLimit;
  const currentSessionId = store.chartSessionId;

  while (remaining > 0) {
    if (store.chartSessionId !== currentSessionId) break;
    const count = Math.min(remaining, 200);
    const data = await fetchCandlesSmart(
      exchange,
      symbol,
      interval,
      count,
      lastTo,
    );
    if (!Array.isArray(data) || data.length === 0) break;
    if (store.chartSessionId !== currentSessionId) break;

    result = result.concat(data);
    remaining -= data.length;
    lastTo = data[data.length - 1].candle_date_time_utc;

    // [1차 즉시 렌더링]: 첫 1회차(최신 200개)가 들어오자마자 화면에 0.05초 만에 선행 표시!
    if (onFirstBatch && result.length === data.length && remaining > 0) {
      try {
        onFirstBatch([...result]);
      } catch (e) { }
    }

    if (remaining > 0) {
      if (exchange === "upbit") {
        // 업비트 연속 요청 시 토큰 버킷에서 토큰이 충전될 때까지 비동기 대기
        await upbitBrowserLimiter.waitForToken(500);
      } else {
        const delayMs = 100;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return result;
}

export function mapTime(d, tf) {
  let activeTF = "1d";
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
  // 🚀 [과거 데이터 Lazy 로딩 취소 및 인디케이터 은닉]
  store.isLoadingMoreHistory = false;
  const lazyIndicator = document.getElementById("chart-lazy-loading-indicator");
  if (lazyIndicator) {
    lazyIndicator.classList.remove("opacity-100", "scale-100");
    lazyIndicator.classList.add("opacity-0", "scale-95", "pointer-events-none");
  }

  // 🚀 [우측 가격축 여백 유지] 데이터 페칭 중 0px로 찌그러지는 깜빡임을 방지하고, 데이터 도착 시 syncPriceScaleWidths(true)로 즉시 확정
  store.isUserZoomed = false;
  store._symbolToRowCache = null;

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

// 🚀 [역할 분리] 메인 차트 초기화 및 캔들 조립 엔진은 chart_fetch.js로 분리 이관 완료
export { fetchHistory };

window.switchKimchiSub = function (newSubId) {
  if (
    store.isFetchingChart ||
    window.isFetchingChart ||
    store.isKimchiLoading
  ) {
    return; // 🚀 차트/김프 데이터 로딩 중에는 중복 클릭 및 교체 차단
  }
  const currentSub =
    store.preferredKimchiSub || store.lastFetchParams?.subExchange;
  if (currentSub === newSubId) {
    return; // 🚀 이미 활성화된 거래소를 중복 클릭한 경우 불필요한 네트워크 요청 없이 즉시 리턴
  }
  store.preferredKimchiSub = newSubId;
  if (typeof window.showKimchiLoading === "function") {
    window.showKimchiLoading(newSubId);
  }
  const switcherContainer = document.getElementById("kimchi-switcher");
  if (switcherContainer) {
    const btns = switcherContainer.querySelectorAll("button");
    btns.forEach((btn) => {
      const onclickAttr = btn.getAttribute("onclick") || "";
      if (onclickAttr.includes(`'${newSubId}'`)) {
        btn.classList.add(
          "ring-1.5",
          "ring-theme-text/80",
          "scale-105",
          "opacity-100",
          "shadow-md",
          "brightness-110",
          "font-black",
        );
        btn.classList.remove("opacity-50", "font-bold");
      } else {
        btn.classList.remove(
          "ring-1.5",
          "ring-theme-text/80",
          "scale-105",
          "opacity-100",
          "shadow-md",
          "brightness-110",
          "font-black",
        );
        btn.classList.add("opacity-50", "font-bold");
      }
    });
  }

  const cleanSym = String(
    store.currentAsset || store.currentSelectedSymbol || "",
  )
    .replace(/^.*:/, "")
    .replace(/_FUTURES|_SPOT|_UPBIT|_BITHUMB/g, "")
    .toUpperCase();
  const row =
    (store.currentSelectedUid &&
      store.tickerRowMap?.get(store.currentSelectedUid)) ||
    store.tickerRowMap?.get(cleanSym) ||
    store.tickerRowMap?.get(store.currentSelectedSymbol) ||
    store.currentTableData?.find(
      (r) =>
        (store.currentSelectedUid &&
          String(r.UID) === String(store.currentSelectedUid)) ||
        r.Symbol === cleanSym ||
        r.Ticker === cleanSym ||
        r.DisplayTicker === cleanSym ||
        r.Exact_Futures === cleanSym ||
        r.Exact_Spot === cleanSym,
    );
  if (row) {
    if (typeof window.realUpdateHeaderDisplay === "function") {
      window.realUpdateHeaderDisplay(
        row,
        undefined,
        undefined,
        false,
        "KIMCHI_SWITCH",
      );
    } else if (typeof window.updateHeaderDisplay === "function") {
      window.updateHeaderDisplay(row);
    }
  }
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
// [과거 캔들 추가 로딩(History More) 모듈 분리 연동]
export { loadMoreHistory } from "./chart_history_more.js";