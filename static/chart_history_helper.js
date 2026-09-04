import { store } from "./_store.js";
import { getPureBase } from "./chart_utils.js";
import { formatListingDateWithExchange } from "./table_render.js";

// 🚀 [역할 분리] UID 및 거래소 우선순위에 따라 정확한 rowInfo 로드
export function findRowInfo(displayName, pureBase, exchangeFlags, targetUid = null) {
  // 1. targetUid 또는 store.currentSelectedUid가 있으면 최우선으로 UID 기준 즉각 반환! (동명이인 오염 완벽 방어)
  const effectiveUid = targetUid || store.currentSelectedUid;
  if (effectiveUid) {
    const byUid = store.currentTableData.find((c) => String(c.UID) === String(effectiveUid));
    if (byUid) return byUid;
  }

  // 2. DisplayTicker 또는 Ticker 완전 일치 우선 검색 (예: AI(Sleepless), AIUSDT 등)
  if (displayName) {
    const exactMatch = store.currentTableData.find(
      (c) => c.DisplayTicker === displayName || c.Ticker === displayName,
    );
    if (exactMatch) return exactMatch;
  }

  const { isUpbit, isBithumb, isBybit, isBybitFutures, isFutures, isSpot } = exchangeFlags;

  let expectedUid = null;
  const dupList = store.marketDataMap?.duplicated_list;
  if (dupList) {
    const exchangeTag = isUpbit
      ? "UPBIT"
      : isBithumb
        ? "BITHUMB"
        : isBybit
          ? "BYBIT"
          : "BINANCE";

    // 1차 패스: v[2](해당 거래소 실제 심볼)와 pureBase가 일치하고 거래소가 맞는 항목
    for (const [key, v] of Object.entries(dupList)) {
      if (Array.isArray(v) && v.length >= 4) {
        const dupSym = (v[2] || "").toUpperCase();
        const dupEx = v[3].toUpperCase();
        if (dupSym === pureBase && dupEx === exchangeTag) {
          expectedUid = v[0];
          break;
        }
      }
    }

    // 2차 패스: 괄호 앞 베이스명이 일치하는 경우
    if (!expectedUid) {
      for (const [key, v] of Object.entries(dupList)) {
        if (Array.isArray(v) && v.length >= 4) {
          const dupBase = key.split("(")[0].toUpperCase();
          const dupEx = v[3].toUpperCase();
          if (dupBase === pureBase && dupEx === exchangeTag) {
            expectedUid = v[0];
            break;
          }
        }
      }
    }
  }

  let cleanDisplayName = (displayName || "").toUpperCase();
  if (cleanDisplayName.includes(":")) {
    cleanDisplayName = cleanDisplayName.split(":")[1].trim();
  }
  cleanDisplayName = cleanDisplayName.replace(/_FUTURES$/i, "").replace(/_SPOT$/i, "").replace(/_UPBIT$/i, "").replace(/_BITHUMB$/i, "");
  if (cleanDisplayName.endsWith("KRW")) cleanDisplayName = cleanDisplayName.slice(0, -3);
  else if (cleanDisplayName.endsWith("USDT")) cleanDisplayName = cleanDisplayName.slice(0, -4);

  let rowInfo = store.currentTableData.find((c) => {
    if (expectedUid && String(c.UID) === String(expectedUid)) return true;

    const t = (c.Ticker || "").toUpperCase();
    const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);

    const dt = (c.DisplayTicker || "").toUpperCase();
    const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);

    const sym = (c.Symbol || "").toUpperCase();
    const cleanSym = sym.endsWith("KRW") ? sym.slice(0, -3) : (sym.endsWith("USDT") ? sym.slice(0, -4) : sym);

    if (cleanT !== cleanDisplayName && cleanDt !== cleanDisplayName && cleanSym !== cleanDisplayName)
      return false;

    if (isUpbit && (c.Listed_Exchanges?.includes("UPBIT") || c.Upbit === "O"))
      return true;
    if (isFutures && c.Listed_Exchanges?.includes("BINANCE_FUTURES"))
      return true;
    if (isSpot && c.Listed_Exchanges?.includes("BINANCE_SPOT")) return true;
    if (isBithumb && c.Listed_Exchanges?.includes("BITHUMB")) return true;
    if (isBybitFutures && c.Listed_Exchanges?.includes("BYBIT_FUTURES"))
      return true;
    if (isBybit && c.Listed_Exchanges?.includes("BYBIT_SPOT")) return true;
    return false;
  });

  if (!rowInfo) {
    rowInfo = store.currentTableData.find((c) => {
      const t = (c.Ticker || "").toUpperCase();
      const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);

      const dt = (c.DisplayTicker || "").toUpperCase();
      const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);

      const sym = (c.Symbol || "").toUpperCase();
      const cleanSym = sym.endsWith("KRW") ? sym.slice(0, -3) : (sym.endsWith("USDT") ? sym.slice(0, -4) : sym);

      return cleanT === cleanDisplayName || cleanDt === cleanDisplayName || cleanSym === cleanDisplayName;
    });
  }

  return rowInfo;
}

// 🚀 [역할 분리] 신규 상장일(Listing Date) 갱신 및 백엔드 비동기 저장
export function determineListingDate(rawMain, rowInfo, pureBase, exchangeFlags) {
  if (!rawMain || rawMain.length === 0) return;
  const { isUpbit, isBithumb, isBybit, isFutures, isSpot } = exchangeFlags;
  try {
    const rawTime = rawMain[0].time;
    let dt = null;

    if (typeof rawTime === "string") {
      dt = new Date(rawTime);
    } else if (typeof rawTime === "number") {
      dt = rawTime > 1e11 ? new Date(rawTime) : new Date(rawTime * 1000);
    }

    if (!dt || isNaN(dt.getTime())) return;
    const newDateStr = dt.toISOString().split("T")[0]; // YYYY-MM-DD

    let exchangeKey = null;
    if (isFutures || isSpot) exchangeKey = "binance_listing";
    else if (isUpbit) exchangeKey = "upbit_listing";
    else if (isBithumb) exchangeKey = "bithumb_listing";
    else if (isBybit) exchangeKey = "bybit_listing";

    if (exchangeKey) {
      if (!store.listingDates) store.listingDates = {};
      const entry = store.listingDates[pureBase] || {};
      const existing = entry[exchangeKey] || "";
      const isNewer = !existing || newDateStr < existing;

      if (isNewer) {
        store.listingDates[pureBase] = {
          ...entry,
          [exchangeKey]: newDateStr,
        };

        const listingEl = document.getElementById(`listing-${store.currentSelectedSymbol}`);
        const tRow = store.originalTableData.find(
          (r) =>
            r.Ticker === store.currentSelectedSymbol ||
            r.DisplayTicker === store.currentSelectedSymbol,
        );
        if (tRow) {
          tRow.Listing_Date = newDateStr;
          if (listingEl)
            listingEl.innerText = formatListingDateWithExchange(tRow);
        } else if (listingEl) {
          listingEl.innerText = newDateStr;
        }

        fetch("/api/listing-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: pureBase,
            exchange_key: exchangeKey,
            date: newDateStr,
          }),
        }).catch(() => { });
      } else {
        const listingEl = document.getElementById(`listing-${store.currentSelectedSymbol}`);
        const tRow = store.originalTableData.find(
          (r) =>
            r.Ticker === store.currentSelectedSymbol ||
            r.DisplayTicker === store.currentSelectedSymbol,
        );
        if (tRow) {
          tRow.Listing_Date = existing;
          if (listingEl)
            listingEl.innerText = formatListingDateWithExchange(tRow);
        } else if (listingEl) {
          listingEl.innerText = existing;
        }
      }
    }
  } catch (e) {
    console.warn("Listing Date Update Error:", e);
  }
}
