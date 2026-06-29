import { store, tfSec } from "./_store.js";
import { getMultiplier, sanitizeChartData } from "./chart_utils.js";
import { fetchCandlesSmart, fetchPaginated, mapTime } from "./chart_data.js";
import { calculateKimchiData } from "./chart_data_kimchi.js";

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
    applyChartLayout
  } = params;

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
      }

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
          "15m": "5m",
          "30m": "30m",
          "1h": "1h",
          "2h": "1h", // 🚀 1시간봉을 가져와서 UTC 2시간 단위로 조립
          "4h": "4h", // 🚀 4시간봉은 마감 경계가 일치하므로 원본 4h API 직접 사용!
          "12h": "12h", // 🚀 12시간봉은 마감 경계가 일치하므로 원본 12h API 직접 사용!
          "1d": "24h", // 🚀 일봉은 24h를 그대로 가져오고 타임스탬프만 UTC 0시로 정렬!
          "3d": "24h", // 🚀 3일봉은 24h를 가져와서 3일 단위로 조립!
          "1w": "24h", // 🚀 주봉은 24h를 가져와서 주 단위로 조립!
          "1M": "24h", // 🚀 월봉은 24h를 가져와서 월 단위로 조립!
        };
        const bFetchInt = bMap[store.currentTF] || "1h";
        const r = await fetchCandlesSmart(
          "bithumb",
          subSymbol,
          bFetchInt,
          1000,
        );
        const rawData = r.data || [];
        if (Array.isArray(rawData) && rawData.length > 0) {
          const is9hOffset = ["4h", "12h", "1d", "3d", "1w", "1M"].includes(store.currentTF);
          const rawMapped = rawData.map((d) => ({
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
            if (tf === "1d") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
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
            subRaw = Object.keys(groups)
              .sort((a, b) => Number(a) - Number(b))
              .map((gtStr) => {
                const gt = Number(gtStr);
                const chunk = groups[gt].sort((a, b) => a.time - b.time);
                return [
                  gt * 1000,
                  chunk[0].open,
                  chunk[chunk.length - 1].close,
                  Math.max(...chunk.map((c) => c.high)),
                  Math.min(...chunk.map((c) => c.low)),
                  chunk.reduce((sum, c) => sum + (c.vol || 0), 0)
                ];
              });
          } else {
            subRaw = rawMapped.map(d => [
              d.time * 1000,
              d.open,
              d.close,
              d.high,
              d.low,
              d.vol
            ]);
          }
        } else {
          subRaw = [];
        }
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
        const res = await fetch("/api/usdkrw");
        const usdkrwRaw = await res.json();
        if (usdkrwRaw && !usdkrwRaw.error) {
          let fiatTimeline = [];
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

      store.kimchiData = newKimchiData.map((d) => mapTime(d));
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

            if (typeof applyChartLayout === "function") applyChartLayout();
            if (typeof window.syncPriceScaleWidths === "function")
              setTimeout(window.syncPriceScaleWidths, 50);
          } catch (setErr) {
            console.warn("🚨 kimchiSeries.setData 렌더링 예외 우회 완료:", setErr);
          }
        });
      }
    } else {
      store.paneConfig.kimchi = false;
      if (wrapper)
        wrapper.style.setProperty("--kimchi-color", "transparent");
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
  }
}
