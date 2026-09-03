import { store, tfSec } from "./_store.js";
import { getMultiplier, sanitizeChartData, rebuildKimchiDataMap } from "./chart_utils.js";
import { fetchCandlesSmart, fetchPaginated, mapTime } from "./chart_data.js";
import { calculateKimchiData } from "./chart_data_kimchi.js";
import { applyChartLayout } from "./chart_layout.js";
// import { fetchBithumbUnifiedCandles } from "./chart_bithumb_sync.js"; // 빗썸 정신차릴 때까지 임시 대기

// 🚀 [거래소별 특유 색상 테마 매핑 - 현선(SPOT/FUT) 완벽 분리]
export function getExchangeLoadingTheme(exchId) {
  const id = (exchId || "").toLowerCase();
  // 1. 국내 거래소
  if (id.includes("upbit")) {
    return {
      bg: "linear-gradient(90deg, #093687 0%, #1E60D5 50%, #60a5fa 100%)",
      glow: "0 0 10px rgba(30, 96, 213, 0.95)",
    };
  }
  if (id.includes("bithumb")) {
    return {
      bg: "linear-gradient(90deg, #FF5C00 0%, #FF8B00 50%, #FBBF24 100%)",
      glow: "0 0 10px rgba(255, 139, 0, 0.95)",
    };
  }
  // 2. 바이낸스 (현물/선물 일치)
  if (id.includes("binance") || id.includes("b-spot") || id.includes("b-fut")) {
    return {
      bg: "linear-gradient(90deg, #D4A007 0%, #F0B90B 50%, #FFF080 100%)", // 🟡 바이낸스 골드
      glow: "0 0 10px rgba(240, 185, 11, 0.95)",
    };
  }
  // 3. 바이비트 (현물/선물 일치)
  if (id.includes("bybit") || id.includes("byb")) {
    return {
      bg: "linear-gradient(90deg, #E58A00 0%, #F7A600 50%, #FFD270 100%)", // 🟠 바이비트 앰버
      glow: "0 0 10px rgba(247, 166, 0, 0.95)",
    };
  }
  return {
    bg: "linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%)",
    glow: "0 0 8px rgba(59, 130, 246, 0.8)",
  };
}

export function showKimchiLoading(subExchange) {
  const switcher = document.getElementById("kimchi-switcher");
  let loadingBar = document.getElementById("kimchi-loading-bar");

  if (!loadingBar && switcher) {
    loadingBar = document.createElement("div");
    loadingBar.id = "kimchi-loading-bar";
    loadingBar.className =
      "kimchi-progress-bar w-full h-[3px] rounded-full overflow-hidden transition-all duration-200 pointer-events-none opacity-0";
    switcher.appendChild(loadingBar);
  }

  if (!loadingBar) return;

  const theme = getExchangeLoadingTheme(subExchange);
  loadingBar.innerHTML = `<div class="kimchi-progress-inner" style="background: ${theme.bg}; box-shadow: ${theme.glow};"></div>`;
  loadingBar.classList.remove("opacity-0");
  loadingBar.classList.add("opacity-100");
}

export function hideKimchiLoading() {
  const loadingBar = document.getElementById("kimchi-loading-bar");
  if (!loadingBar) return;

  const inner = loadingBar.querySelector(".kimchi-progress-inner");
  if (inner) {
    inner.style.animation = "none";
    inner.style.width = "100%";
    inner.style.marginLeft = "0%";
  }
  setTimeout(() => {
    loadingBar.classList.remove("opacity-100");
    loadingBar.classList.add("opacity-0");
  }, 180);
}

window.showKimchiLoading = showKimchiLoading;
window.hideKimchiLoading = hideKimchiLoading;
export function updateKimchiComparisonUI() {
  const btn = document.getElementById("toggle-kimchi-btn");
  const notice = document.getElementById("kimchi-disabled-notice");
  const ohlcKimchi = document.getElementById("ohlc-kimchi-container");
  const switcher = document.getElementById("kimchi-switcher");
  const isDisabled = !!store.isKimchiDisabled;

  if (btn) {
    if (isDisabled) {
      btn.innerText = "김프 비교 OFF";
      btn.classList.remove(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
        "shadow-sm",
      );
      btn.classList.add(
        "text-theme-text",
        "opacity-50",
        "border-theme-border/50",
        "bg-theme-panel/50",
      );
    } else {
      btn.innerText = "김프 비교 ON";
      btn.classList.add(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
        "shadow-sm",
      );
      btn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border/50",
        "bg-theme-panel/50",
      );
    }
  }

  if (notice) {
    if (isDisabled) {
      notice.classList.remove("hidden");
    } else {
      notice.classList.add("hidden");
    }
  }

  // 🚀 OHLC 레전드 내부 kimp 컨테이너 숨김/표시
  if (ohlcKimchi) {
    if (isDisabled) {
      ohlcKimchi.classList.add("hidden");
    } else {
      ohlcKimchi.classList.remove("hidden");
    }
  }

  // 🚀 김프 비교군 스위처 버튼 숨김/표시
  if (switcher) {
    if (isDisabled) {
      switcher.style.display = "none";
    } else {
      switcher.style.display = "flex";
    }
  }

  // 김프 시리즈 가시성 제어
  if (store.kimchiSeries) {
    store.kimchiSeries.applyOptions({ visible: !isDisabled });
    if (isDisabled) {
      try {
        store.kimchiSeries.setData([]);
      } catch (e) { }
    }
  }
  if (typeof applyChartLayout === "function") {
    applyChartLayout();
  }
}

export function toggleKimchiComparison(forceVal) {
  if (forceVal !== undefined) {
    store.isKimchiDisabled = !forceVal;
  } else {
    store.isKimchiDisabled = !store.isKimchiDisabled;
  }
  try {
    localStorage.setItem(
      "sellnance_kimchi_disabled",
      store.isKimchiDisabled ? "true" : "false",
    );
  } catch (e) { }

  updateKimchiComparisonUI();

  if (store.isKimchiDisabled) {
    // 🎯 [김프 끄기] 전체 재조회(fetchHistory) 없이 캔들과 볼륨은 100% 실시간 스트리밍 유지하고 김프만 즉시 정화
    if (store.kimchiSeries) {
      try {
        store.kimchiSeries.setData([]);
      } catch (e) { }
    }
    store.kimchiData = [];
    if (store.kimchiDataMap) store.kimchiDataMap.clear();
    store.realtimeKimchi = null;

    if (typeof applyChartLayout === "function") applyChartLayout();
    if (typeof window.syncPriceScaleWidths === "function") {
      window.syncPriceScaleWidths(true);
    }

    if (
      store.mainData &&
      store.mainData.length > 0 &&
      typeof window.updateLegend === "function"
    ) {
      const lastIdx = store.mainData.length - 1;
      const v = store.volumeData ? store.volumeData[lastIdx] : null;
      window.updateLegend(store.mainData[lastIdx], v, null);
    }
  } else {
    // 🎯 [김프 켜기] 백그라운드에서 김프 데이터만 수집하여 차트에 바인딩
    if (typeof window.fetchHistory === "function" && store.currentAsset) {
      window.fetchHistory(store.currentAsset, false, false, true);
    }
  }
}

window.toggleKimchiComparison = toggleKimchiComparison;
window.updateKimchiComparisonUI = updateKimchiComparisonUI;

// 🚀 [역할 분리] 김프 데이터 백그라운드 Lazy 수집 및 차트 렌더링 전담
export async function lazyRenderKimchiData(params) {
  const {
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
    applyChartLayout: paramApplyLayout,
  } = params || {};

  const effectiveApplyLayout = paramApplyLayout || applyChartLayout;

  // 🎯 [김프 비교 끄기 상태 가드] 즉시 리턴 때려서 네트워크 통신 및 렌더링 전면 차단
  if (store.isKimchiDisabled) {
    if (store.kimchiSeries) {
      try {
        store.kimchiSeries.setData([]);
      } catch (e) { }
    }
    store.kimchiData = [];
    if (store.kimchiDataMap) store.kimchiDataMap.clear();
    store.realtimeKimchi = null;

    const wrapper = document.getElementById("chart-wrapper");
    if (wrapper) wrapper.style.setProperty("--kimchi-color", "transparent");

    const disabledNotice = document.getElementById("kimchi-disabled-notice");
    if (disabledNotice) disabledNotice.classList.remove("hidden");
    const noDataMsg = document.getElementById("kimchi-no-data");
    if (noDataMsg) noDataMsg.classList.add("hidden");
    const switcher = document.getElementById("kimchi-switcher");
    if (switcher) switcher.style.display = "none";
    const ohlcKimchi = document.getElementById("ohlc-kimchi-container");
    if (ohlcKimchi) ohlcKimchi.classList.add("hidden");

    if (typeof effectiveApplyLayout === "function") {
      effectiveApplyLayout();
    }

    hideKimchiLoading();
    return; // 🎯 네트워크 통신 즉시 차단 (Early Return)
  }

  try {
    let subExchange = null;
    let subSymbol = null;
    let subMulti = 1;
    let mainMulti = getMultiplier(mainTickerStr);
    let missingTarget = "";
    let availableSubs = [];

    const querySym = rowInfo ? rowInfo.DisplayTicker : uniqueTicker;
    if (!store._coinInfoCache) store._coinInfoCache = new Map();
    const _cachedInfo = store._coinInfoCache.get(querySym);
    const _fetchCoinInfo = _cachedInfo
      ? Promise.resolve(_cachedInfo)
      : fetch(`/api/coin-info/${querySym}`).then((res) => res.json()).then((d) => {
        store._coinInfoCache.set(querySym, d);
        return d;
      });

    const listedEx = rowInfo ? rowInfo.Listed_Exchanges || [] : [];
    const wrapper = document.getElementById("chart-wrapper");

    if (
      store.currentChartMarket === "UPBIT" ||
      store.currentChartMarket === "BITHUMB"
    ) {
      // 🚀 [현물 우선 -> 선물 fallback] 바이낸스 현물 (B-SPOT)
      if (listedEx.includes("BINANCE_SPOT") || listedEx.includes("BINANCE"))
        availableSubs.push({
          id: "binance_spot",
          name: "B-SPOT",
          bg: "#444",
          text: "#fff",
          sym: `${exactSpot}USDT`,
          pureSym: exactSpot,
        });
      // 🚀 바이낸스 선물 (B-FUT)
      if (listedEx.includes("BINANCE_FUTURES"))
        availableSubs.push({
          id: "binance_futures",
          name: "B-FUT",
          bg: "#f0b90b",
          text: "#000",
          sym: `${exactFutures}USDT`,
          pureSym: exactFutures,
        });
      // 🚀 바이비트 현물 (BYBIT)
      if (listedEx.includes("BYBIT_SPOT") || listedEx.includes("BYBIT"))
        availableSubs.push({
          id: "bybit_spot",
          name: "BYBIT",
          bg: "#f7a600",
          text: "#fff",
          sym: `${exactBybit}USDT`,
          pureSym: exactBybit,
        });
      // 🚀 바이비트 선물 (BYB-F)
      if (listedEx.includes("BYBIT_FUTURES"))
        availableSubs.push({
          id: "bybit_futures",
          name: "BYB-F",
          bg: "#f7a600",
          text: "#000",
          sym: `${exactBybit}USDT`,
          pureSym: exactBybit,
        });
      if (availableSubs.length === 0)
        missingTarget = "글로벌 거래소(바이낸스/바이비트)";
    } else if (isBybit) {
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

      let loadingMessageContainer = document.getElementById("kimchi-loading-message");
      if (!loadingMessageContainer) {
        loadingMessageContainer = document.createElement("div");
        loadingMessageContainer.id = "kimchi-loading-message";
        loadingMessageContainer.className =
          "absolute right-3 z-[110] flex gap-1.5 transition-all duration-300 pointer-events-none";
        if (wrapper) wrapper.appendChild(loadingMessageContainer);
      } else if (wrapper && loadingMessageContainer.parentElement !== wrapper) {
        wrapper.appendChild(loadingMessageContainer);
      }

      let switcherContainer = document.getElementById("kimchi-switcher");
      if (!switcherContainer) {
        switcherContainer = document.createElement("div");
        switcherContainer.id = "kimchi-switcher";
        switcherContainer.className =
          "absolute right-3 z-[110] flex flex-col items-end gap-1 transition-all duration-300 pointer-events-auto select-none";
        if (wrapper) wrapper.appendChild(switcherContainer);
      } else {
        switcherContainer.className =
          "absolute right-3 z-[110] flex flex-col items-end gap-1 transition-all duration-300 pointer-events-auto select-none";
        if (wrapper && switcherContainer.parentElement !== wrapper) {
          wrapper.appendChild(switcherContainer);
        }
      }

      let buttonsHtml = "";
      if (availableSubs.length > 1) {
        buttonsHtml = availableSubs
          .map((s) => {
            const isActive = s.id === subExchange;
            const opacity = isActive
              ? "opacity-100 ring-2 ring-white/80 scale-105"
              : "opacity-40 hover:opacity-80";
            return `<button class="text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm transition-all ${opacity}" style="background-color: ${s.bg}; color: ${s.text};" onclick="switchKimchiSub('${s.id}')">${s.name}</button>`;
          })
          .join("");
      } else {
        const s = availableSubs[0];
        buttonsHtml = `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded opacity-60 pointer-events-none" style="background-color: ${s.bg}; color: ${s.text};">vs ${s.name}</span>`;
      }

      switcherContainer.innerHTML = `
        <div class="kimchi-btn-group flex gap-1.5">${buttonsHtml}</div>
        <div id="kimchi-loading-bar" class="kimchi-progress-bar w-full h-[3px] rounded-full overflow-hidden transition-all duration-200 pointer-events-none opacity-0"></div>
      `;
      switcherContainer.style.display = "flex";

      const disabledNotice = document.getElementById("kimchi-disabled-notice");
      if (disabledNotice) disabledNotice.classList.add("hidden");

      store.paneConfig.kimchi = true;
      const noDataMsg = document.getElementById("kimchi-no-data");
      if (noDataMsg) noDataMsg.classList.add("hidden");
      requestAnimationFrame(() => {
        try {
          if (typeof applyChartLayout === "function") applyChartLayout();
        } catch (layoutErr) {
          console.warn("🚨 fetchHistory 내 applyChartLayout 예외 우회:", layoutErr);
        }
      });

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

      showKimchiLoading(subExchange);

      // 🚀 [1:N 기간 일치 보장] 메인이 3d/12h일 때 메인은 500개(=1,500일치/6,000시간치)를 가져오므로,
      // 서브 캔들도 3배(1,500개)를 가져와야 메인 전체 기간(4년치)의 김프가 공백 없이 100% 가득 참!
      const subMult = (store.currentTF === "3d" || store.currentTF === "12h") ? 3 : 1;
      const initialSubLimit = 500 * subMult;

      let subRaw = [];
      if (subExchange === "upbit") {
        subRaw = await fetchPaginated(
          subExchange,
          subSymbol,
          upbitInterval,
          initialSubLimit,
        );
      } else if (subExchange === "bithumb") {
        let bInterval = store.currentTF;
        if (store.currentTF === "12h") bInterval = "4h";
        else if (store.currentTF === "3d") bInterval = "1d";

        const bData = await fetchCandlesSmart("bithumb", subSymbol, bInterval, Math.min(2000, initialSubLimit));
        const rawList = Array.isArray(bData?.data) ? bData.data : (Array.isArray(bData) ? bData : []);
        subRaw = rawList
          .map((d) => ({
            time: Math.floor(Number(d[0]) / 1000),
            open: Number(d[1]),
            close: Number(d[2]),
            high: Number(d[3]),
            low: Number(d[4]),
            vol: Number(d[5]),
          }))
          .sort((a, b) => a.time - b.time);
      } else {
        const subJson = await fetchCandlesSmart(
          subExchange,
          subSymbol,
          store.currentTF,
          500,
        );
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

      if (!store.fiatRateCache) store.fiatRateCache = {};
      if (!store.fiatRateCache[rateCacheKey]) {
        let loadedFromLocal = false;
        try {
          const localStr = localStorage.getItem("sellnance_usdkrw_cache");
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (parsed && typeof parsed === "object") {
              let fiatTimeline = [];
              for (let [ts, price] of Object.entries(parsed)) {
                fiatTimeline.push({
                  time: Number(ts),
                  price: price,
                  source: "tv_fiat",
                });
              }
              const liveRate = store.marketDataMap?.krw_usd_rate;
              if (liveRate && Number(liveRate) > 0) {
                const nowSec = Math.floor(Date.now() / 1000);
                fiatTimeline.push({ time: nowSec, price: Number(liveRate), source: "live_fiat" });
              }
              fiatTimeline.sort((a, b) => a.time - b.time);
              store.fiatRateCache[rateCacheKey] = fiatTimeline;
              loadedFromLocal = true;
            }
          }
        } catch (e) { }

        if (!loadedFromLocal) {
          const res = await fetch("/api/usdkrw");
          const usdkrwRaw = await res.json();
          if (usdkrwRaw && !usdkrwRaw.error) {
            try {
              localStorage.setItem("sellnance_usdkrw_cache", JSON.stringify(usdkrwRaw));
            } catch (e) { }
            let fiatTimeline = [];
            for (let [ts, price] of Object.entries(usdkrwRaw)) {
              fiatTimeline.push({
                time: Number(ts),
                price: price,
                source: "tv_fiat",
              });
            }
            const liveRate = store.marketDataMap?.krw_usd_rate;
            if (liveRate && Number(liveRate) > 0) {
              const nowSec = Math.floor(Date.now() / 1000);
              fiatTimeline.push({ time: nowSec, price: Number(liveRate), source: "live_fiat" });
            }
            fiatTimeline.sort((a, b) => a.time - b.time);
            store.fiatRateCache[rateCacheKey] = fiatTimeline;
          }
        }
      }

      let newKimchiData = calculateKimchiData(
        store.mainData,
        subRaw,
        store.lastFetchParams,
      );

      if (
        store.currentAsset !== snapshotAsset ||
        store.currentTF !== snapshotTF
      ) {
        hideKimchiLoading();
        return;
      }

      store.kimchiData = newKimchiData.map((d) => mapTime(d));
      rebuildKimchiDataMap();
      if (store.kimchiSeries && store.kimchiData.length > 0) {
        const lastK = store.kimchiData[store.kimchiData.length - 1];
        if (wrapper && lastK)
          wrapper.style.setProperty("--kimchi-color", lastK.color);

        requestAnimationFrame(() => {
          try {
            const currentRange = store.chart.timeScale().getVisibleLogicalRange();
            store.kimchiSeries.setData(sanitizeChartData(store.kimchiData, true));
            if (currentRange)
              store.chart.timeScale().setVisibleLogicalRange(currentRange);

            // 🎯 김프 선이 차트에 완전히 렌더링된 순간 로딩 종료!
            hideKimchiLoading();

            // 🚀 [해결] 데이터가 성공적으로 바인딩되었으므로 오버레이 경고 문구를 숨깁니다.
            if (typeof window.toggleVolFallback === "function") {
              window.toggleVolFallback(false);
            }

            if (typeof applyChartLayout === "function") applyChartLayout();
            if (typeof window.syncPriceScaleWidths === "function")
              setTimeout(window.syncPriceScaleWidths, 50);
          } catch (setErr) {
            console.warn("🚨 kimchiSeries.setData 렌더링 예외 우회 완료:", setErr);
            hideKimchiLoading();
          }
        });
      } else {
        hideKimchiLoading();
        // 데이터가 없거나 로드되지 않은 상태이므로 경고 문구 표시
        if (typeof window.toggleVolFallback === "function") {
          window.toggleVolFallback(true);
        }
      }
    } else {
      hideKimchiLoading();
      store.paneConfig.kimchi = false;
      if (store.kimchiSeries) {
        try {
          store.kimchiSeries.setData([]);
        } catch (e) { }
      }
      store.kimchiData = [];
      if (store.kimchiDataMap) {
        store.kimchiDataMap.clear();
      }
      store.realtimeKimchi = null;

      if (wrapper)
        wrapper.style.setProperty("--kimchi-color", "transparent");

      // 🚀 데이터가 없으므로 경고 문구 표시
      if (typeof window.toggleVolFallback === "function") {
        window.toggleVolFallback(true);
      }

      const noDataMsg = document.getElementById("kimchi-no-data");
      if (noDataMsg && !isTfChange) {
        noDataMsg.classList.remove("hidden");
      }
      let loadingMessageContainer = document.getElementById("kimchi-loading-message");
      if (loadingMessageContainer)
        loadingMessageContainer.style.display = "none";
      requestAnimationFrame(() => {
        try {
          if (typeof applyChartLayout === "function") applyChartLayout();
        } catch (layoutErr) {
          console.warn("🚨 fetchHistory (no-data) applyChartLayout 예외 우회:", layoutErr);
        }
      });
    }
  } catch (err) {
    console.error("김프 백그라운드 렌더링 실패:", err);
    let loadingMessageContainer = document.getElementById("kimchi-loading-message");
    if (loadingMessageContainer)
      loadingMessageContainer.style.display = "none";

    // 에러 발생 시 경고 문구 표시
    if (typeof window.toggleVolFallback === "function") {
      window.toggleVolFallback(true);
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateKimchiComparisonUI);
  } else {
    setTimeout(updateKimchiComparisonUI, 50);
  }
}
