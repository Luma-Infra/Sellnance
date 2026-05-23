// chart_api.js - 차트 및 캔들 전용 API 통신 모듈
import { store } from './_store.js';

export async function loadSymbols() {
  try {
    const res = await fetch("/api/market-map");
    const data = await res.json();

    // 🚀 [핵심] 모든 엔진이 공통으로 쓰는 '장부'에 데이터를 꽂아넣으세요!
    store.marketDataMap = data;
    store.allSymbols = data.all_assets;

    console.log("✅ [데이터센터] 장부 로드 완료!");
  } catch (e) {
    console.error("🚨 마켓 데이터 로드 실패", e);
  }

  // 🚀 [상장일] 서버에서 저장된 listing dates 한 번만 로드 → store.listingDates에 올려두기
  try {
    const res = await fetch("/api/listing-dates");
    const dates = await res.json();
    store.listingDates = dates || {};
    console.log(`✅ [LISTING] ${Object.keys(store.listingDates).length}개 상장일 로드 완료`);
  } catch (e) {
    store.listingDates = {};
    console.warn("⚠️ [LISTING] 상장일 데이터 로드 실패:", e);
  }
}

export async function fetchPaginated(exchange, symbol, interval, totalLimit, startTo = "") {
  let result = [];
  let lastTo = startTo;
  let remaining = totalLimit;
  let retryCount = 0; // 🚀 429 에러 재시도 카운트

  while (remaining > 0) {
    const count = Math.min(remaining, 200);
    let url = `/api/candles?exchange=${exchange}&symbol=${symbol}&interval=${interval}&limit=${count}`;
    if (lastTo) {
      let lastToStr = String(lastTo);
      if (exchange === "upbit") {
        if (!lastToStr.endsWith("Z") && !lastToStr.includes("+")) {
          lastToStr = lastToStr + "Z";
        }
      } else {
        lastToStr = lastToStr.replace("T", " ");
      }
      url += `&to=${encodeURIComponent(lastToStr)}`;
    }

    const res = await fetch(url);

    // 🚨 [429 철벽 방어막] 너무 많이 찔러서 혼났다면, 반성하고 기다렸다가 다시 찌르기!
    if (res.status === 429) {
      if (retryCount < 3) {
        retryCount++;
        console.warn(
          `🚨 [429 API 제한] ${symbol} 과호출 감지! ${retryCount * 0.5}초 대기 후 재시도...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 500 * retryCount));
        continue;
      } else {
        console.error(
          `❌ [429 API 제한] ${symbol} 재시도 횟수 초과. 가져오기 중단.`,
        );
        break;
      }
    }

    retryCount = 0;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    result = result.concat(data);
    remaining -= data.length;
    lastTo = data[data.length - 1].candle_date_time_utc;

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // 🚀 429 예방을 위해 안전거리 확보
    }
  }
  return result;
}
