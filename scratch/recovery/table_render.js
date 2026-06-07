The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
// table_render.js
import { store, CONFIG } from "./_store.js";
import { formatSmartPrice } from "./chart_utils.js";
import { getFilteredData } from "./table_filter.js";

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


