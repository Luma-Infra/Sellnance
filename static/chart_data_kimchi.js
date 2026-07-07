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
    const intervalSec = tfSec[tf] || 60;

    // 🚀 서브 거래소 파싱 도우미 함수 정의
    const getSubTime = (item) => {
      if (subExchange === "upbit") {
        return Math.floor(Date.parse(item.candle_date_time_utc + "Z") / 1000);
      } else if (subExchange === "bithumb") {
        if (Array.isArray(item)) {
          return Math.floor(Number(item[0]) / 1000);
        } else {
          return Math.floor(Number(item[0]) / 1000) - 32400;
        }
      } else {
        return Math.floor(Number(item[0]) / 1000);
      }
    };

    const getSubClose = (item) => {
      if (subExchange === "upbit") {
        return item.trade_price;
      } else if (subExchange === "bithumb") {
        return Number(item[2]);
      } else {
        return Number(item[4]);
      }
    };

    // 🚀 서브 데이터를 타임스탬프 기준 시간 오름차순으로 완벽 정렬
    const sortedSub = [...subRaw].sort((a, b) => getSubTime(a) - getSubTime(b));

    let subIndex = 0;
    let rateIndex = 0;
    let lastKnownSubClose = null;
    let lastKnownSubTime = 0;
    let lastKnownRate =
      fiatRateMap.length > 0 ? fiatRateMap[0].price : currentFiatRate;

    mainData.forEach((candle, index) => {
      const candleTimeSec = ensureSafeUnixSeconds(candle.time);
      const nextCandleTime =
        index + 1 < mainData.length
          ? ensureSafeUnixSeconds(mainData[index + 1].time)
          : candleTimeSec + intervalSec * 30;

      while (
        rateIndex < fiatRateMap.length &&
        fiatRateMap[rateIndex].time < nextCandleTime
      ) {
        lastKnownRate = fiatRateMap[rateIndex].price;
        rateIndex++;
      }

      // 🚀 [최인접 시간 매칭 알고리즘]
      // 메인 차트와 서브 차트가 모두 오름차순 정렬된 상태이므로,
      // 순방향 포인터를 돌며 현재 메인 캔들 시각에 가장 오차가 적은 서브 캔들을 탐색합니다.
      while (
        subIndex < sortedSub.length - 1 &&
        Math.abs(getSubTime(sortedSub[subIndex + 1]) - candleTimeSec) <
        Math.abs(getSubTime(sortedSub[subIndex]) - candleTimeSec)
      ) {
        subIndex++;
      }

      const bestSub = sortedSub[subIndex];
      const bestSubTime = getSubTime(bestSub);

      // 두 캔들의 실제 시차가 타임프레임의 1.5배 이내인 경우만 유효 매칭으로 간주
      if (Math.abs(bestSubTime - candleTimeSec) <= intervalSec * 1.5) {
        lastKnownSubClose = getSubClose(bestSub);
        lastKnownSubTime = candleTimeSec;
      } else {
        const tolerance = intervalSec * 3;
        // 시차가 너무 벌어졌다면(3배 이상) 이전 매칭된 가격 캐시를 완전히 초기화하여 무분별한 역방향 누적 차단
        if (lastKnownSubTime && (candleTimeSec - lastKnownSubTime > tolerance)) {
          lastKnownSubClose = null;
        }
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
