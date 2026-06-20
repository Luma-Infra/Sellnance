// chart_api.js - 차트 및 캔들 전용 API 통신 모듈
import { store } from "./_store.js";

export async function loadSymbols() {
  try {
    const res = await fetch("/api/market-map");
    const data = await res.json();

    // 🚀 [핵심] 모든 엔진이 공통으로 쓰는 '장부'에 데이터를 꽂아넣으세요!
    store.marketDataMap = data;
    store.allSymbols = data.all_assets;

    // Xconsole.log("✅ [데이터센터] 장부 로드 완료!");
  } catch (e) {
    // Xconsole.error("🚨 마켓 데이터 로드 실패", e);
  }

  // 🚀 [상장일] 서버에서 저장된 listing dates 한 번만 로드 → store.listingDates에 올려두기
  try {
    const res = await fetch("/api/listing-dates");
    const dates = await res.json();
    store.listingDates = dates || {};
    // Xconsole.log(`✅ [LISTING] ${Object.keys(store.listingDates).length}개 상장일 로드 완료`);
  } catch (e) {
    store.listingDates = {};
    // Xconsole.warn("⚠️ [LISTING] 상장일 데이터 로드 실패:", e);
  }
}
