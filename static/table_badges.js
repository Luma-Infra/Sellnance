// table_badges.js
// 🏷️ [테이블 뱃지 및 상장일 계산 모듈]
// 1. 거래소별 유의/상폐 경고 뱃지 HTML 생성
// 2. 필터 모드별 상장일 계산 및 포맷팅 (getListingDate, formatListingDateWithExchange)

import { store } from "./_store.js";

export function getWarningBadgeHtml(warnings) {
  if (
    !warnings ||
    typeof warnings !== "object" ||
    Object.keys(warnings).length === 0
  )
    return "";
  const encoded = encodeURIComponent(JSON.stringify(warnings));
  return `
    <span class="caution-badge px-1 py-[0.5px] text-[8.5px] font-black text-rose-400 bg-rose-500/15 border border-rose-500/40 rounded shadow-sm hover:scale-110 hover:bg-rose-500/25 transition-all inline-flex items-center justify-center leading-none cursor-pointer select-none z-30 flex-shrink-0 ml-auto mr-1"
          onmouseenter="window.showCautionTooltip(event, '${encoded}')"
          onmouseleave="window.hideCautionTooltip()"
          onclick="event.stopPropagation(); window.showCautionTooltip(event, '${encoded}')">!</span>
  `;
}

export function getListingDate(row) {
  const pureBase = (row.Symbol || "").toUpperCase();
  const dateObj = store.listingDates && store.listingDates[pureBase];
  if (!dateObj) return "-";

  let mode = store.filterMode || "ALL";

  if (mode === "BINANCE" || mode === "FUTURES" || mode === "SPOT") {
    return dateObj.binance_listing || "-";
  }
  if (mode === "UPBIT") {
    return dateObj.upbit_listing || "-";
  }
  if (mode === "BITHUMB") {
    return dateObj.bithumb_listing || "-";
  }
  if (mode === "BYBIT") {
    return dateObj.bybit_listing || "-";
  }

  // ALL 모드일 때: 가능한 거래소 상장일 중 가장 과거(최소값)의 날짜를 계산
  const dates = [
    dateObj.binance_listing,
    dateObj.upbit_listing,
    dateObj.bithumb_listing,
    dateObj.bybit_listing,
  ].filter((d) => d && d !== "-");

  if (dates.length === 0) return "-";

  dates.sort(); // 오름차순 정렬하여 가장 오래된 날짜가 0번 인덱스에 위치하도록 함
  return dates[0];
}

export function formatListingDateWithExchange(row) {
  const pureBase = (row.Symbol || "").toUpperCase();
  const dateObj = store.listingDates && store.listingDates[pureBase];
  if (!dateObj) return "-";

  let mode = store.filterMode || "ALL";

  if (mode === "BINANCE" || mode === "FUTURES" || mode === "SPOT") {
    const d = dateObj.binance_listing || "-";
    return d === "-" ? "-" : `binance : ${d}`;
  }
  if (mode === "UPBIT") {
    const d = dateObj.upbit_listing || "-";
    return d === "-" ? "-" : `upbit : ${d}`;
  }
  if (mode === "BITHUMB") {
    const d = dateObj.bithumb_listing || "-";
    return d === "-" ? "-" : `bithumb : ${d}`;
  }
  if (mode === "BYBIT") {
    const d = dateObj.bybit_listing || "-";
    return d === "-" ? "-" : `bybit : ${d}`;
  }

  // ALL 모드일 때
  const candidates = [
    { ex: "binance", date: dateObj.binance_listing },
    { ex: "upbit", date: dateObj.upbit_listing },
    { ex: "bithumb", date: dateObj.bithumb_listing },
    { ex: "bybit", date: dateObj.bybit_listing },
  ].filter((c) => c.date && c.date !== "-");

  if (candidates.length === 0) return "-";

  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return `${candidates[0].ex} : ${candidates[0].date}`;
}
