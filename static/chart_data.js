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

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  // 업비트는 toVal 있어도 브라우저 직접 fetch 지원 (초고속 다이렉트 호출)
  if (!isGapRecovery && exchange === "upbit" && toVal && !startVal) {
    try {
      let fetchInterval = interval;
      if (!interval.startsWith("minutes/")) {
        const u = interval.replace(/[0-9]/g, "");
        if (u === "d" || u === "w" || u === "M" || interval === "days" || interval === "weeks" || interval === "months") {
          fetchInterval = u === "w" || interval === "weeks" ? "weeks" : u === "M" || interval === "months" ? "months" : "days";
        } else {
          const minMap = {
            "1m": "minutes/1", "3m": "minutes/3", "5m": "minutes/5",
            "15m": "minutes/15", "30m": "minutes/30", "1h": "minutes/60",
            //  "2h": "minutes/120", 
            "4h": "minutes/240"
          };
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
      // console.warn(`⚠️ [UPBIT TO DIRECT FAIL] ${symbol} - ${toVal}, falling back:`, err);
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
              // "2h": "minutes/120",
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
      } /* else if (exchange === "bithumb") {
        const cleanSymbol = symbol.replace("KRW-", "").replace("_KRW", "").replace("KRW", "");
        const bSym = cleanSymbol + "_KRW";
        directUrl = `https://api.bithumb.com/public/candlestick/${bSym}/${interval}`;
      } */

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
            /* } else if (exchange === "bithumb" && data && data.status === "0000") {
              // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol}`);
              return data; */
          } else if (
            exchange.startsWith("bybit") &&
            data &&
            data.retCode === 0
          ) {
            // Xconsole.log(`⚡ [DIRECT FETCH SUCCESS] ${exchange} - ${symbol}`);
            return data;
          }
        } else if (res.status === 404 || res.status === 400) {
          // 🚀 거래소 API에서 404/400 (심볼/마켓 없음) 반환 시 백엔드 프록시로 재요청하는 낭비/지연 원천 차단
          return [];
        }
      }
    } catch (err) {
      // 직접 호출 실패 시 조용히 아래 서버 프록시(/api/candles)로 위임
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
      await new Promise((resolve) => setTimeout(resolve, 150));
      // 🛡️ 업비트 초당 8회 이하 안전 간격 보장
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
        btn.classList.add("ring-2", "ring-white/80", "scale-105", "opacity-100");
        btn.classList.remove("opacity-40");
      } else {
        btn.classList.remove("ring-2", "ring-white/80", "scale-105", "opacity-100");
        btn.classList.add("opacity-40");
      }
    });
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
        // if (tf === "2h") return Math.floor(t / 7200) * 7200;
        if (tf === "3d") {
          const dayTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
          return Math.floor((dayTs - 86400) / 259200) * 259200 + 86400;
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

      // 🚀 [서브 거래소 연속 페이징] 메인의 최과거 시각으로 점프하지 않고,
      // 서브 데이터 자체의 가장 오래된 캔들(oldestSubTimeSec)을 찾아 그 직전부터 연속적으로 수집하여 중간 구멍(Hole) 박멸!
      let oldestSubTimeSec = null;
      if (Array.isArray(store.subRawData) && store.subRawData.length > 0) {
        for (const d of store.subRawData) {
          let t = 0;
          if (typeof d.time === "number") t = d.time > 1e11 ? Math.floor(d.time / 1000) : d.time;
          else if (d.candle_date_time_utc) t = Math.floor(new Date(d.candle_date_time_utc + "Z").getTime() / 1000);
          else if (Array.isArray(d)) t = Number(d[0]) > 1e11 ? Math.floor(Number(d[0]) / 1000) : Number(d[0]);
          if (t > 0 && (oldestSubTimeSec === null || t < oldestSubTimeSec)) {
            oldestSubTimeSec = t;
          }
        }
      }

      const currentSubOldest = oldestSubTimeSec || oldestTimeSec;
      // 🚀 3d/12h 등 1:N 합성 타임프레임은 메인 캔들 수 대비 N배의 서브 캔들을 수집해야 공백(Hole)이 생기지 않음
      const subStepMult = (params.tf === "3d" || params.tf === "12h") ? 3 : 1;
      const targetSubLimit = Math.max(500, N * subStepMult);

      let subToVal;
      if (params.subExchange === "upbit") {
        const dt = new Date(currentSubOldest * 1000);
        subToVal = dt.toISOString();
        fetchedSub = await fetchPaginated(
          params.subExchange,
          params.subSymbol,
          params.upbitInterval,
          targetSubLimit,
          subToVal,
        );
      } else if (params.subExchange === "bithumb") {
        let bInterval = params.tf;
        if (params.tf === "12h") bInterval = "4h";
        else if (params.tf === "3d") bInterval = "1d";
        subToVal = Math.floor(currentSubOldest * 1000) - 1;
        fetchedSub = await fetchCandlesSmart(
          params.subExchange,
          params.subSymbol,
          bInterval,
          targetSubLimit,
          subToVal,
        );
      } else {
        subToVal = Math.floor(currentSubOldest * 1000) - 1;
        fetchedSub = await fetchCandlesSmart(
          params.subExchange,
          params.subSymbol,
          params.tf,
          targetSubLimit,
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
