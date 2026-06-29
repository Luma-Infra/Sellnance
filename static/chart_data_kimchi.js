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
    // Map sub raw data by timestamp for O(1) exact matching and safety
    const subMap = new Map();
    const intervalSec = tfSec[tf] || 60;
    subRaw.forEach(item => {
      let subTime;
      let subClose;

      if (subExchange === "upbit") {
        subTime = Math.floor(Date.parse(item.candle_date_time_utc + "Z") / 1000);
        subClose = item.trade_price;
      } else if (subExchange === "bithumb") {
        // 🚀 [해결] 빗썸 시간 보정은 chart_data.js 한 곳에서만 전담하도록 통일 (이중 차감 방지)
        if (Array.isArray(item)) {
          subTime = Math.floor(Number(item[0]) / 1000); // 이미 UTC 보정이 끝난 timestamp초
          subClose = Number(item[2]); // [time, open, close, high, low, vol] 구조의 close
        } else {
          // 혹시 모를 생 API 데이터 대응용 폴백 (보정이 안된 상태로 넘어왔을 경우에만 차감)
          subTime = Math.floor(Number(item[0]) / 1000) - 32400; 
          subClose = Number(item[2]);
        }
      } else {
        subTime = Math.floor(Number(item[0]) / 1000);
        subClose = Number(item[4]);
      }
      
      // 🚀 [해결] 타임프레임 블록 크기(intervalSec) 단위로 타임스탬프를 수학적 내림(floor)하여 
      // 해외/국내 거래소 간의 미세한 초 단위 시차 및 슬라이스 경계 오프셋을 완벽하게 일치시킵니다.
      // 특히 2시간봉(2h)은 글로벌 기준 홀수 시간 마감이므로 1시간 오프셋 시프트를 반영합니다.
      const is2h = tf === "2h";
      const alignedSubTime = is2h
        ? Math.floor((subTime - 3600) / intervalSec) * intervalSec + 3600
        : Math.floor(subTime / intervalSec) * intervalSec;
      subMap.set(alignedSubTime, subClose);
    });

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

      // 🚀 메인 캔들 타임스탬프 역시 동일한 내림(floor) 공식을 적용하여 subMap에서 O(1) 매칭시킵니다.
      const alignedCandleTime = Math.floor(candleTimeSec / intervalSec) * intervalSec;
      const matchedSubClose = subMap.get(alignedCandleTime);
      if (matchedSubClose !== undefined && matchedSubClose !== null) {
        lastKnownSubClose = matchedSubClose;
        lastKnownSubTime = candleTimeSec;
      } else {
        const tolerance = intervalSec * 3;
        if (lastKnownSubTime && (candleTimeSec - lastKnownSubTime > tolerance)) {
          lastKnownSubClose = null; // Clear stale fallback
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
