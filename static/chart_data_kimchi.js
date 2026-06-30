import { store, tfSec } from "./_store.js";
import { ensureSafeUnixSeconds } from "./chart_utils.js";

export function calculateKimchiData(mainData, subRaw, params) {
  if (!params) return [];
  const { subExchange, subMulti, mainMulti, tf, isKor, rateCacheKey } = params;
  if (!store.fiatRateCache) store.fiatRateCache = {};
  const fiatRateMap = store.fiatRateCache[rateCacheKey] || [];
  const currentFiatRate = store.marketDataMap.krw_usd_rate || 1;

  let newKimchiData = [];
  if (Array.isArray(subRaw) && subRaw.length > 0) {
    const sortedSub = [...subRaw].sort((a, b) => {
      const timeA =
        subExchange === "upbit"
          ? Math.floor(Date.parse(a.candle_date_time_utc + "Z") / 1000)
          : Number(a[0]) / 1000;
      const timeB =
        subExchange === "upbit"
          ? Math.floor(Date.parse(b.candle_date_time_utc + "Z") / 1000)
          : Number(b[0]) / 1000;
      return timeA - timeB;
    });

    let subIndex = 0;
    let rateIndex = 0;
    let lastKnownSubClose = null;
    let lastKnownRate =
      fiatRateMap.length > 0 ? fiatRateMap[0].price : currentFiatRate;

    mainData.forEach((candle, index) => {
      const candleTimeSec = ensureSafeUnixSeconds(candle.time);
      const nextCandleTime =
        index + 1 < mainData.length
          ? ensureSafeUnixSeconds(mainData[index + 1].time)
          : candleTimeSec + (tfSec[tf] || 86400 * 30);

      while (
        rateIndex < fiatRateMap.length &&
        fiatRateMap[rateIndex].time < nextCandleTime
      ) {
        lastKnownRate = fiatRateMap[rateIndex].price;
        rateIndex++;
      }

      while (subIndex < sortedSub.length) {
        const subItem = sortedSub[subIndex];
        const subTime =
          subExchange === "upbit"
            ? Math.floor(Date.parse(subItem.candle_date_time_utc + "Z") / 1000)
            : Number(subItem[0]) / 1000;

        if (subTime < nextCandleTime) {
          lastKnownSubClose =
            subExchange === "upbit"
              ? subItem.trade_price
              : subExchange === "bithumb"
                ? Number(subItem[2])
                : Number(subItem[4]);
          subIndex++;
        } else break;
      }

      if (lastKnownSubClose !== null) {
        const rawKorPrice = isKor ? candle.close : lastKnownSubClose;
        const rawGlbPrice = isKor ? lastKnownSubClose : candle.close;
        const unitKorPrice = rawKorPrice / (isKor ? mainMulti : subMulti);
        const unitGlbPrice = rawGlbPrice / (isKor ? subMulti : mainMulti);

        if (unitGlbPrice > 0 && lastKnownRate > 0) {
          const kimchiPct =
            (unitKorPrice / (unitGlbPrice * lastKnownRate) - 1) * 100;

          // 🚨 [김프 이상 탐지 전용 애널리틱스 코드]
          // 역프가 -4% 이하로 떨어지는 비정상 구간 발견 시 상세 데이터를 콘솔에 추적 로그로 남깁니다.
          // if (kimchiPct <= -4) {
          //   const dt = new Date(candleTimeSec * 1000).toLocaleString("ko-KR", {
          //     timeZone: "Asia/Seoul",
          //   });
          //   console.warn(`🚨 [역프 이상 탐지] 시간: ${dt}`, {
          //     kimchiPct: kimchiPct.toFixed(2) + "%",
          //     unitKorPrice: unitKorPrice.toFixed(4),
          //     unitGlbPrice: unitGlbPrice.toFixed(4),
          //     appliedRate: lastKnownRate,
          //     rawKorPrice,
          //     rawGlbPrice,
          //     mainMulti,
          //     subMulti,
          //   });
          // }

          if (isFinite(kimchiPct)) {
            newKimchiData.push({
              time: candle.time,
              value: kimchiPct,
              color:
                typeof window.getKimchiColor === "function"
                  ? window.getKimchiColor(kimchiPct)
                  : "#57a4fc",
            });
          }
        }
      }
    });
  }
  return newKimchiData;
}
