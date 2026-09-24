// static/chart_history_more.js
// [신규] 차트를 과거로 스크롤할 때 과거 캔들을 비동기/Lazy하게 로딩하는 페이징 엔진

import { store } from "./_store.js";
import { fetchCandlesSmart, fetchPaginated, mapTime } from "./chart_data.js";
import { calculateKimchiData } from "./chart_data_kimchi.js";
import {
  getUnixSeconds,
  ensureSafeUnixSeconds,
  sanitizeChartData,
  rebuildMainDataMap,
  rebuildVolumeDataMap,
  rebuildKimchiDataMap,
} from "./chart_utils.js";

export async function loadMoreHistory(isSilent = false) {
  if (
    store.isLoadingMoreHistory ||
    !store.lastFetchParams ||
    store.lastFetchParams.hasMoreHistory === false
  ) {
    return;
  }

  // 디바운스 ~ API Ban 방지를 위해 최소 1.5초 간격으로 요청 제한 (Silent 백필 시는 허용)
  const now = Date.now();
  if (!isSilent && store.lastLazyLoadTime && now - store.lastLazyLoadTime < 1500) {
    return;
  }
  store.lastLazyLoadTime = now;

  if (!store.mainData || store.mainData.length === 0) {
    return;
  }

  store.isLoadingMoreHistory = true;

  // 동적 로딩 인디케이터 렌더링 (Silent 백그라운드 이어붙이기 시에는 표시 안 함)
  let lazyIndicator = document.getElementById("chart-lazy-loading-indicator");
  if (!isSilent) {
    if (!lazyIndicator) {
      lazyIndicator = document.createElement("div");
      lazyIndicator.id = "chart-lazy-loading-indicator";
      lazyIndicator.className =
        "absolute left-1/2 top-4 z-[120] flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-panel/90 border border-theme-border shadow-lg text-[11px] font-medium text-theme-text opacity-0 pointer-events-none transition-all duration-300 transform -translate-x-1/2 scale-95";
      lazyIndicator.innerHTML = `
        <div class="w-3.5 h-3.5 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
        <span id="chart-lazy-loading-text">과거 캔들 불러오는 중...</span>
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
  }

  const params = store.lastFetchParams;
  const currentSessionId = (store.chartSessionId = store.chartSessionId ?? 1);
  const currentAsset = store.currentAsset;
  const currentSymbol = store.currentSelectedSymbol;
  const currentTf = store.currentTF;

  const isStale = () => {
    return (
      (store.chartSessionId ?? 0) !== currentSessionId ||
      store.currentAsset !== currentAsset ||
      store.currentSelectedSymbol !== currentSymbol ||
      store.currentTF !== currentTf ||
      store.lastFetchParams !== params ||
      store.isFetchingChart ||
      window.isFetchingChart
    );
  };

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

  const prevFallback = store.activeCandleFallback;

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

      // [핵심: 전체 덮어쓰기] 알파 코인의 추가 로딩 중 타 거래소(비트겟 등)로 폴백된 경우에만 한정:
      // (바낸 정규 스팟/퓨처는 폴백 대상이 아니므로 절대 덮어쓰지 않음)
      const cleanSym = (params.ticker || "")
        .replace("USDT", "")
        .replace("KRW-", "")
        .replace("_KRW", "")
        .split("(")[0]
        .toUpperCase();
      const isAlphaCoin = Boolean(
        params.isAlpha ||
        store.currentTableData?.some(
          (c) =>
            (c.Symbol?.toUpperCase() === cleanSym ||
              c.Ticker?.toUpperCase() === `${cleanSym}USDT` ||
              c.Exact_Spot?.toUpperCase() === cleanSym) &&
            (c.Binance_Alpha === "O" ||
              c.is_alpha ||
              c.Listed_Exchanges?.includes("BINANCE_ALPHA")) &&
            c.Binance_Futures !== "O" &&
            !c.is_futures,
        ),
      );

      const isNewFallback = Boolean(
        params.exchange === "binance_spot" &&
        isAlphaCoin &&
        store.activeCandleFallback &&
        store.activeCandleFallback !== prevFallback &&
        !["BINANCE", "BINANCE_ALPHA", "BINANCE_SPOT"].includes(
          store.activeCandleFallback.toUpperCase(),
        ),
      );

      if (isNewFallback) {
        store.isLoadingMoreHistory = false;
        if (lazyIndicator) {
          lazyIndicator.classList.remove("opacity-100", "scale-100");
          lazyIndicator.classList.add(
            "opacity-0",
            "scale-95",
            "pointer-events-none",
          );
        }
        if (typeof window.fetchHistory === "function") {
          window.fetchHistory(store.currentAsset, false, false, true);
        }
        return;
      }

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
    } else if (params.isBithumb) {
      const bData = await fetchCandlesSmart(
        "bithumb",
        params.ticker,
        params.fetchInterval || store.currentTF,
        500,
        toVal,
      );
      const rawList = Array.isArray(bData?.data)
        ? bData.data
        : Array.isArray(bData)
          ? bData
          : [];
      fetchedMain = rawList.map((d) => ({
        time: Math.floor(Number(d[0]) / 1000),
        open: Number(d[1]),
        close: Number(d[2]),
        high: Number(d[3]),
        low: Number(d[4]),
        volume: Number(d[5]),
      }));
    }

    if (isStale()) return;

    if (!fetchedMain || fetchedMain.length === 0) {
      params.hasMoreHistory = false;
      store.isLoadingMoreHistory = false;
      if (lazyIndicator) {
        lazyIndicator.classList.remove("opacity-100", "scale-100");
        lazyIndicator.classList.add(
          "opacity-0",
          "scale-95",
          "pointer-events-none",
        );
      }

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
          const dayTs =
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) /
            1000;
          return Math.floor((dayTs - 86400) / 259200) * 259200 + 86400;
        }
        if (tf === "1d")
          return (
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000
          );
        if (tf === "1w") {
          const day = d.getUTCDay();
          const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
          return (
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0) / 1000
          );
        }
        if (tf === "1M")
          return (
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0) / 1000
          );
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

    if (isStale()) return;

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

      // [서브 거래소 연속 페이징] 메인의 최과거 시각으로 점프하지 않고,
      // 서브 데이터 자체의 가장 오래된 캔들(oldestSubTimeSec)을 찾아 그 직전부터 연속적으로 수집하여 중간 구멍(Hole) 박멸!
      let oldestSubTimeSec = null;
      if (Array.isArray(store.subRawData) && store.subRawData.length > 0) {
        for (const d of store.subRawData) {
          let t = 0;
          if (typeof d.time === "number")
            t = d.time > 1e11 ? Math.floor(d.time / 1000) : d.time;
          else if (d.candle_date_time_utc)
            t = Math.floor(
              new Date(d.candle_date_time_utc + "Z").getTime() / 1000,
            );
          else if (Array.isArray(d))
            t =
              Number(d[0]) > 1e11
                ? Math.floor(Number(d[0]) / 1000)
                : Number(d[0]);
          if (t > 0 && (oldestSubTimeSec === null || t < oldestSubTimeSec)) {
            oldestSubTimeSec = t;
          }
        }
      }

      const currentSubOldest = oldestSubTimeSec || oldestTimeSec;
      // 3d/12h 등 1:N 합성 타임프레임은 메인 캔들 수 대비 N배의 서브 캔들을 수집해야 공백(Hole)이 생기지 않음
      const subStepMult = params.tf === "3d" || params.tf === "12h" ? 3 : 1;
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
        if (params.tf === "3d") bInterval = "1d";
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

      if (isStale()) return;

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

      if (isStale()) return;

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

    // [핵심] 차트 캔들 추가 시 화면이 밀리는 현상을 원천 방어하기 위해 Visible Logical Range를 N만큼 밀어줌
    const timeScale = store.chart.timeScale();
    const visibleRange = timeScale.getVisibleLogicalRange();

    if (isStale()) return;

    try {
      // 모든 시리즈 데이터를 동일한 틱 내에서 동기식으로 세팅하여
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
          if (isStale()) return;
          if (visibleRange && N > 0) {
            timeScale.setVisibleLogicalRange({
              from: visibleRange.from + N,
              to: visibleRange.to + N,
            });
          }
        } catch (setErr) {
          // Xconsole.warn("🚨 Lazy Load 내부 렌더링/범위조정 예외 우회 완료:",setErr,);
        }
      });
    } catch (candleErr) {
      // Xconsole.warn("🚨 Lazy Load 데이터 세팅 예외 우회 완료:", candleErr);
    }

    // Xconsole.log(`✅ [Lazy Load] 과거 캔들 ${N}개 추가 결합 완료!`);
  } catch (err) {
    // Xconsole.error("🚨 과거 데이터 Lazy Loading 실패:", err);
  } finally {
    if (!isStale()) {
      store.isLoadingMoreHistory = false;
    }
    if (lazyIndicator) {
      lazyIndicator.classList.remove("opacity-100", "scale-100");
      lazyIndicator.classList.add("opacity-0", "scale-95", "pointer-events-none");
    }
  }
}

if (typeof window !== "undefined") {
  window.loadMoreHistory = loadMoreHistory;
}
