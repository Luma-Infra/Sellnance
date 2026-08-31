// chart_api.js - 차트 및 캔들 전용 API 통신 모듈
import { store } from "./_store.js";

export async function loadSymbols() {
  try {
    const [mapRes, datesRes] = await Promise.all([
      fetch("/api/market-map").then((r) => r.json()).catch(() => null),
      fetch("/api/listing-dates").then((r) => r.json()).catch(() => null),
    ]);

    if (mapRes) {
      store.marketDataMap = mapRes;
      store.allSymbols = mapRes.all_assets;
    }
    store.listingDates = datesRes || {};
  } catch (e) {
    store.listingDates = {};
    // Xconsole.warn("⚠️ [LISTING] 상장일 데이터 로드 실패:", e);
  }
}
