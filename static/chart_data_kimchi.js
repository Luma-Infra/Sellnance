import { store, tfSec } from "./_store.js";
import { ensureSafeUnixSeconds } from "./chart_utils.js";
import { isValidPriceRatio } from "./stream_utils.js";

// 🚀 [12h / 3d 서브 캔들 에포크 정밀 합성 엔진]
export function resampleSubCandles(subCandles, targetTF, subExchange) {
  if (!Array.isArray(subCandles) || subCandles.length === 0) return [];
  if (targetTF !== "12h" && targetTF !== "3d") return subCandles;

  const getTs = (c) => {
    if (!c) return 0;
    if (typeof c.time === "number") return c.time > 1e11 ? Math.floor(c.time / 1000) : c.time;
    if (c.candle_date_time_utc) return Math.floor(new Date(c.candle_date_time_utc + "Z").getTime() / 1000);
    if (Array.isArray(c)) return Number(c[0]) > 1e11 ? Math.floor(Number(c[0]) / 1000) : Number(c[0]);
    return Number(c.time || c[0]) || 0;
  };

  const getO = (c) => Number(c.open !== undefined ? c.open : (c.opening_price !== undefined ? c.opening_price : (Array.isArray(c) ? c[1] : 0))) || 0;
  const getH = (c) => Number(c.high !== undefined ? c.high : (c.high_price !== undefined ? c.high_price : (Array.isArray(c) ? (subExchange === "bithumb" ? c[3] : c[2]) : 0))) || 0;
  const getL = (c) => Number(c.low !== undefined ? c.low : (c.low_price !== undefined ? c.low_price : (Array.isArray(c) ? (subExchange === "bithumb" ? c[4] : c[3]) : 0))) || 0;
  const getC = (c) => Number(c.close !== undefined ? c.close : (c.trade_price !== undefined ? c.trade_price : (Array.isArray(c) ? (subExchange === "bithumb" ? c[2] : c[4]) : 0))) || 0;
  const getV = (c) => Number(c.vol !== undefined ? c.vol : (c.volume !== undefined ? c.volume : (c.candle_acc_trade_volume !== undefined ? c.candle_acc_trade_volume : (Array.isArray(c) ? c[5] : 0)))) || 0;

  const bucketMap = new Map();
  const sorted = [...subCandles].sort((a, b) => getTs(a) - getTs(b));

  for (const c of sorted) {
    const t = getTs(c);
    if (!t) continue;

    let bucket;
    if (targetTF === "12h") {
      bucket = Math.floor(t / 43200) * 43200;
    } else if (targetTF === "3d") {
      // 🚀 바이낸스 3일봉 공식 에포크 정렬: (ts - 86400) % 259200 == 0
      bucket = Math.floor((t - 86400) / 259200) * 259200 + 86400;
    }

    if (!bucketMap.has(bucket)) {
      bucketMap.set(bucket, {
        time: bucket,
        open: getO(c),
        high: getH(c),
        low: getL(c),
        close: getC(c),
        volume: getV(c),
      });
    } else {
      const existing = bucketMap.get(bucket);
      existing.high = Math.max(existing.high, getH(c));
      existing.low = Math.min(existing.low, getL(c));
      existing.close = getC(c);
      existing.volume += getV(c);
    }
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
}

export function calculateKimchiData(mainData, subRaw, params) {
  if (!params) return [];
  const { subExchange, subMulti, mainMulti, tf, isKor, rateCacheKey } = params;
  if (!store.fiatRateCache) store.fiatRateCache = {};
  const fiatRateMap = store.fiatRateCache[rateCacheKey] || [];
  const currentFiatRate = store.marketDataMap.krw_usd_rate || 1;

  // 🚀 [12h / 3d 정밀 합성] 서브 거래소 캔들이 4h나 1d로 들어온 경우 타겟 타임프레임(12h, 3d)으로 에포크 정밀 합성
  const processedSubRaw = resampleSubCandles(subRaw, tf, subExchange);

  let newKimchiData = [];
  if (Array.isArray(processedSubRaw) && processedSubRaw.length > 0) {
    const intervalSec = tfSec[tf] || 60;

    // 🚀 서브 거래소 파싱 도우미 함수 정의
    const getSubTime = (item) => {
      if (!item) return 0;
      if (typeof item.time === "number") {
        return Math.floor(item.time > 1e11 ? item.time / 1000 : item.time);
      }
      if (subExchange === "upbit" && item.candle_date_time_utc) {
        return Math.floor(Date.parse(item.candle_date_time_utc + "Z") / 1000);
      }
      if (Array.isArray(item)) {
        return Math.floor(Number(item[0]) > 1e11 ? Number(item[0]) / 1000 : Number(item[0]));
      }
      const t = item.time !== undefined ? item.time : item[0];
      return Math.floor(Number(t) > 1e11 ? Number(t) / 1000 : Number(t));
    };

    const getSubClose = (item) => {
      if (!item) return 0;
      if (typeof item.close === "number") return item.close;
      if (subExchange === "upbit" && item.trade_price !== undefined) {
        return Number(item.trade_price);
      }
      if (Array.isArray(item)) {
        return subExchange === "bithumb" ? Number(item[2]) : Number(item[4]);
      }
      return Number(item.close !== undefined ? item.close : item[4] !== undefined ? item[4] : item[2]);
    };

    // 🚀 서브 데이터를 타임스탬프 기준 시간 오름차순으로 완벽 정렬 (12h/3d 에포크 합성본 사용)
    const sortedSub = [...processedSubRaw].sort((a, b) => getSubTime(a) - getSubTime(b));
    const firstSubTime = sortedSub.length > 0 ? getSubTime(sortedSub[0]) : 0;

    let subIndex = 0;
    let rateIndex = 0;
    let lastKnownSubClose = null;
    let lastKnownSubTime = 0;
    let lastKnownRate =
      fiatRateMap.length > 0 ? fiatRateMap[0].price : currentFiatRate;

    mainData.forEach((candle, index) => {
      const candleTimeSec = ensureSafeUnixSeconds(candle.time);

      // [서브 거래소 상장 이전 구간 가드] 서브 캔들이 존재하지 않는 과거 구간은 김프 계산 스킵 (대폭락 갭 원천 차단)
      if (firstSubTime > 0 && candleTimeSec < firstSubTime - intervalSec * 1.5) {
        return;
      }

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

      // 🚀 [시계열 정합성 보장 최인접 시간 매칭 알고리즘]
      // 메인 차트와 서브 차트가 모두 오름차순 정렬된 상태이므로,
      // 순방향 포인터를 돌며 현재 메인 캔들 시각(candleTimeSec) 이하(과거/동일) 또는 미세 오차 이내의 서브 캔들을 탐색합니다.
      while (
        subIndex < sortedSub.length - 1 &&
        getSubTime(sortedSub[subIndex + 1]) <= candleTimeSec + intervalSec * 0.2 &&
        Math.abs(getSubTime(sortedSub[subIndex + 1]) - candleTimeSec) <=
        Math.abs(getSubTime(sortedSub[subIndex]) - candleTimeSec)
      ) {
        subIndex++;
      }

      const bestSub = sortedSub[subIndex];
      const bestSubTime = getSubTime(bestSub);
      const timeDiff = bestSubTime - candleTimeSec;

      // 두 캔들의 실제 시차가 타임프레임의 허용 범위 이내인 경우만 유효 매칭으로 간주
      // (미래 캔들 왜곡 방지: 서브 캔들이 메인 캔들보다 미래인 경우 최대 0.2봉까지만 허용, 과거는 1.5봉까지 허용)
      const isValidAlignment =
        timeDiff <= 0
          ? Math.abs(timeDiff) <= intervalSec * 1.5
          : timeDiff <= intervalSec * 0.2;

      if (isValidAlignment) {
        lastKnownSubClose = getSubClose(bestSub);
        lastKnownSubTime = candleTimeSec;
      } else {
        const tolerance = intervalSec * 3;
        // 시차가 너무 벌어졌다면(3배 이상) 이전 매칭된 가격 캐시를 완전히 초기화하여 무분별한 역방향 누적 차단
        if (lastKnownSubTime && candleTimeSec - lastKnownSubTime > tolerance) {
          lastKnownSubClose = null;
        }
      }

      if (lastKnownSubClose !== null) {
        const rawKorPrice = isKor ? candle.close : lastKnownSubClose;
        const rawGlbPrice = isKor ? lastKnownSubClose : candle.close;
        const unitKorPrice = rawKorPrice / (isKor ? mainMulti : subMulti);
        const unitGlbPrice = rawGlbPrice / (isKor ? subMulti : mainMulti);

        if (unitGlbPrice > 0 && lastKnownRate > 0 && unitKorPrice > 0) {
          const overseasKrw = unitGlbPrice * lastKnownRate;

          // isValidPriceRatio 재사용: 99% 폭락(0.01) 및 10배 폭등(10.0) 이상치 완벽 방어]
          if (isValidPriceRatio(unitKorPrice, overseasKrw)) {
            const kimchiPct = (unitKorPrice / overseasKrw - 1) * 100;
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
      }
    });
  }
  return newKimchiData;
}
