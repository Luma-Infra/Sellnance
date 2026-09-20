// static/stream_alpha.js
/**
 * 💎 [Alpha Realtime Stream Pipeline] (2안: 독립 파이프라인)
 * 기존 바이낸스/업비트/바이비트 소켓과 완전히 독립된 알파 전용 실시간 시세 및 김프 갱신 파이프라인
 */

import { store } from "./_store.js";

let alphaStreamTimer = null;
let isPolling = false;
const POLLING_INTERVAL_MS = 2500; // 2.5초 실시간 틱 주기

/**
 * 🚀 알파 실시간 틱 단일 사이클
 */
async function tickAlphaStream() {
  if (isPolling) return;
  if (document.hidden) return; // 탭 비활성화 시 절전

  // 현재 테이블에 순수 알파 코인이 있는지 빠른 검사 (선물 코인은 원천 차단)
  const currentRows = store.currentTableData || [];
  const alphaRows = currentRows.filter(
    (r) =>
      r &&
      (r.Binance_Alpha === "O" || r.is_alpha) &&
      r.Binance_Futures !== "O" &&
      !r.is_futures,
  );

  if (alphaRows.length === 0) return; // 화면에 순수 알파 코인이 없으면 통신 생략

  isPolling = true;
  try {
    const res = await fetch(`/api/alpha/realtime?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const alphaMap = await res.json();

    const rate = store.krwUsdRate || 1350;

    // 순수 알파 코인들의 틱 데이터 갱신
    for (let i = 0; i < alphaRows.length; i++) {
      const row = alphaRows[i];
      const sym = (row.Symbol || row.DisplayTicker || "").toUpperCase();
      const liveData = alphaMap[sym];
      if (!liveData || !liveData.price || liveData.price <= 0) continue;

      const oldPrice = row.Price_Raw || 0;
      const newPrice = liveData.price;
      const newChange = liveData.change_24h;

      // 1. 메모리 행 데이터 실시간 반영
      row.Price_Raw = newPrice;
      row.Binance_Price = newPrice;
      row.Binance_Price_Spot = newPrice;
      row.Change_24h_Raw = newChange;
      if (typeof window.formatChangePercent === "function") {
        row.Change_24h = window.formatChangePercent(newChange);
      } else {
        row.Change_24h = `${newChange >= 0 ? "+" : ""}${newChange.toFixed(2)}%`;
      }

      // 알파 코인은 당일 시가가 없으므로 등락폭 왜곡 차단을 위해 Change_Today는 "-" 유지
      row.Change_Today_Raw = null;
      row.Change_Today_Spot = null;
      row.Change_Today_Binance = null;
      row.Change_Today = "-";

      // 2. 국내 거래소(빗썸 등) 가격이 있으면 실시간 김프 재계산
      const krwPrice = row.Price_KRW || row.Bithumb_Price || 0;
      if (krwPrice > 0 && newPrice > 0 && rate > 0) {
        const domUnit = krwPrice;
        const ovsUnit = newPrice;
        const kimchiPct = (domUnit / (ovsUnit * rate) - 1) * 100;
        row.Kimchi_Raw = kimchiPct;
        row.Kimchi_Formatted = `${kimchiPct >= 0 ? "+" : ""}${kimchiPct.toFixed(2)}%`;
        row.Kimchi_Label = "BITHUMB";
      }

      // 3. 공식 updateRowDynamicHTML을 통한 DOM 초고속 다이렉트 갱신 (리렌더링 렉 0%)
      const rowEl =
        store.rowDomMap?.get(String(row.UID)) ||
        store.rowDomMap?.get(row.Ticker);

      if (rowEl) {
        if (typeof window.updateRowDynamicHTML === "function") {
          window.updateRowDynamicHTML(rowEl, row, true);
        }

        // 가격 변동 틱 플래시 효과
        if (oldPrice > 0 && oldPrice !== newPrice) {
          const priceSpan = rowEl.querySelector(".price-num");
          if (priceSpan && typeof window.applyPriceFlash === "function") {
            window.applyPriceFlash(priceSpan, newPrice, oldPrice);
          }
        }
      }

      // 4. 상단 헤더 디스플레이 선택 중인 코인이면 헤더 시세도 즉시 갱신
      if (
        store.currentSelectedSymbol &&
        (row.Ticker === store.currentSelectedSymbol ||
          row.Symbol === store.currentSelectedSymbol ||
          String(row.UID) === String(store.currentSelectedUid))
      ) {
        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(row);
        }
      }
    }
  } catch (err) {
    // 네트워크 일시 오류 시 조용히 넘김
  } finally {
    isPolling = false;
  }
}

/**
 * 🎬 알파 독립 스트림 시작
 */
export function initAlphaStreamPipeline() {
  if (alphaStreamTimer) clearInterval(alphaStreamTimer);

  // 동시 접속자 증가 시  HTTP 요청 방지
  // 1. 초기 1회 즉시 호출
  // setTimeout(tickAlphaStream, 1000);

  // 2. 2.5초 주기 독립 폴링 가동
  // alphaStreamTimer = setInterval(tickAlphaStream, POLLING_INTERVAL_MS);
  // Xconsole.log("[Alpha Pipeline] 💎 독립 알파 실시간 스트림 파이프라인 가동 완료",);
}

/**
 * 🛑 알파 스트림 정지
 */
export function stopAlphaStreamPipeline() {
  if (alphaStreamTimer) {
    clearInterval(alphaStreamTimer);
    alphaStreamTimer = null;
  }
}

if (typeof window !== "undefined") {
  window.initAlphaStreamPipeline = initAlphaStreamPipeline;
  window.stopAlphaStreamPipeline = stopAlphaStreamPipeline;
}
