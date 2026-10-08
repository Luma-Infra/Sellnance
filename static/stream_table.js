// stream_table.js
import { store, CONFIG } from "./_store.js";
import { updateVisibleSymbols } from "./table_render.js";
import { getMultiplier, getPureBase } from "./chart_utils.js";
import {
  getRowKimchiGlobalPrice,
  getRowExchangeMeta,
  getRowDisplayMetrics,
} from "./_market_rules.js";

import { initBinanceSniperSocket } from "./feed_binance_spot.js";
import { initBinanceFuturesSniperSocket } from "./feed_binance_futures.js";
import { initUpbitSniperSocket } from "./feed_upbit.js";

// 모듈 내부 검증 토큰
export const RECONNECT_SECRET = Symbol("SELLNANCE_INTERNAL_SOCKET_SECRET");

let lastSocketInitTime = 0;
const RECONNECT_COOLDOWN_MS = 2500; // 최소 2.5초 간격 쿨다운

// 개별 스트림 스나이퍼 소켓 초기화 (피드 드라이버 내부 전용 파이프라인)
export function initSniperSocket(force = false, callerKey = null) {
  const now = Date.now();
  if (now - lastSocketInitTime < RECONNECT_COOLDOWN_MS) {
    return;
  }
  lastSocketInitTime = now;

  const isAuthorized = callerKey === RECONNECT_SECRET;
  const safeForce = Boolean(force && isAuthorized);

  if (typeof initBinanceSniperSocket === "function") {
    initBinanceSniperSocket(safeForce);
  }
  if (typeof initBinanceFuturesSniperSocket === "function") {
    initBinanceFuturesSniperSocket(safeForce);
  }
  if (typeof initUpbitSniperSocket === "function") {
    initUpbitSniperSocket();
  }
}

// visibleSymbols와 연동하여 바이낸스/업비트 구독 리스트 동시 동기화
export function syncSniperSubscriptions() {
  if (
    typeof window !== "undefined" &&
    window.isSandboxActive &&
    window.isSandboxActive()
  )
    return;
  if (!store.visibleSymbols) return;
  const getNextId = () => Math.floor(Date.now() + Math.random() * 1000);

  const currentVisibleBinanceSpot = [];
  const currentVisibleBinanceFutures = [];
  const currentVisibleUpbit = [];
  const allSource = store.originalTableData || store.currentTableData || [];

  store.visibleSymbols.forEach((sym) => {
    const row = allSource.find(
      (r) => r.Ticker === sym || r.DisplayTicker === sym || r.Symbol === sym,
    );
    if (!row) return;

    // 1. Spot 상장 코인인 경우
    const hasSpot =
      row.Binance === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_SPOT") ||
      row.Listed_Exchanges?.includes("BINANCE") ||
      row.Exact_Spot;
    if (hasSpot) {
      let bSpotTicker =
        row.Exact_Spot ||
        (row.Ticker && !row.Ticker.endsWith("KRW")
          ? row.Ticker.replace("USDT", "")
          : null);
      if (bSpotTicker) {
        currentVisibleBinanceSpot.push(
          `${bSpotTicker.toLowerCase()}usdt@aggTrade`,
        );
        currentVisibleBinanceSpot.push(
          `${bSpotTicker.toLowerCase()}usdt@miniTicker`,
        );
      }
    }

    // 2. Futures 상장 코인인 경우
    const hasFutures =
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
      row.Exact_Futures;
    if (hasFutures) {
      let bFuturesTicker =
        row.Exact_Futures ||
        (row.Ticker && !row.Ticker.endsWith("KRW")
          ? row.Ticker.replace("USDT", "")
          : null);
      if (bFuturesTicker) {
        currentVisibleBinanceFutures.push(
          `${bFuturesTicker.toLowerCase()}usdt@aggTrade`,
        );
        currentVisibleBinanceFutures.push(
          `${bFuturesTicker.toLowerCase()}usdt@miniTicker`,
        );
      }
    }

    // 3. Upbit 코인인 경우
    let uTicker =
      row.Upbit_Symbol ||
      (row.Ticker && row.Ticker.endsWith("KRW")
        ? row.Ticker.replace("KRW", "")
        : null);
    if (!uTicker && row.Symbol) uTicker = row.Symbol;
    if (uTicker) {
      currentVisibleUpbit.push(`KRW-${uTicker.toUpperCase()}`);
    }
  });

  // Spot 소켓 구독 동기화
  if (store.sniperWs && store.sniperWs.readyState === WebSocket.OPEN) {
    const toSub = currentVisibleBinanceSpot.filter(
      (s) => !store.activeSubs.has(s),
    );
    if (toSub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() }),
      );
      toSub.forEach((s) => store.activeSubs.add(s));
    }
    const toUnsub = Array.from(store.activeSubs).filter(
      (s) => !currentVisibleBinanceSpot.includes(s),
    );
    if (toUnsub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: toUnsub,
          id: getNextId(),
        }),
      );
      toUnsub.forEach((s) => store.activeSubs.delete(s));
    }
  }

  // Futures 소켓 구독 동기화
  if (
    store.sniperWsFutures &&
    store.sniperWsFutures.readyState === WebSocket.OPEN
  ) {
    if (!store.activeSubsFutures) store.activeSubsFutures = new Set();
    const toSub = currentVisibleBinanceFutures.filter(
      (s) => !store.activeSubsFutures.has(s),
    );
    if (toSub.length > 0) {
      store.sniperWsFutures.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() }),
      );
      toSub.forEach((s) => store.activeSubsFutures.add(s));
    }
    const toUnsub = Array.from(store.activeSubsFutures).filter(
      (s) => !currentVisibleBinanceFutures.includes(s),
    );
    if (toUnsub.length > 0) {
      store.sniperWsFutures.send(
        JSON.stringify({
          method: "UNSUBSCRIBE",
          params: toUnsub,
          id: getNextId(),
        }),
      );
      toUnsub.forEach((s) => store.activeSubsFutures.delete(s));
    }
  }

  if (
    store.upbitSniperWs &&
    store.upbitSniperWs.readyState === WebSocket.OPEN
  ) {
    const uniqueUpbitCodes = Array.from(new Set(currentVisibleUpbit));
    if (uniqueUpbitCodes.length > 0) {
      try {
        store.upbitSniperWs.send(
          JSON.stringify([
            { ticket: "upbit_table_sniper_" + getNextId() },
            { type: "ticker", codes: uniqueUpbitCodes },
          ]),
        );
      } catch (e) {}
    }
  }
}

export function refreshSniperTarget() {
  if (typeof updateVisibleSymbols === "function") updateVisibleSymbols();
  if (typeof syncSniperSubscriptions === "function") syncSniperSubscriptions();
}

export function calculateRowKimchi(r, rate) {
  if (!r || !rate || rate <= 0) return;

  const exList = (r.Listed_Exchanges || []).map((e) => e.toUpperCase());
  const hasUpbit =
    r.Upbit === "O" || exList.includes("UPBIT") || !!r.Upbit_Symbol;
  const hasBithumb = exList.includes("BITHUMB") || !!r.Bithumb_Symbol;
  const hasGlobal =
    r.Binance === "O" ||
    r.Binance_Futures === "O" ||
    exList.includes("BINANCE_SPOT") ||
    exList.includes("BINANCE") ||
    exList.includes("BINANCE_FUTURES") ||
    exList.includes("BYBIT_SPOT") ||
    exList.includes("BYBIT") ||
    exList.includes("BYBIT_FUTURES") ||
    r.Binance_Price_Spot > 0 ||
    r.Bybit_Price_Spot > 0 ||
    r.Binance_Price_Futures > 0 ||
    r.Bybit_Price_Futures > 0;

  if (!hasGlobal || (!hasUpbit && !hasBithumb)) {
    r.Kimchi_Raw = null;
    r.Kimchi_Label = "-";
    r.Kimchi_Formatted = "-";
    r.Kimchi_Source = null;
    return;
  }

  let priceKor = 0;
  if (hasUpbit || hasBithumb) {
    const krwRow = store.uidToKrwRowMap
      ? store.uidToKrwRowMap.get(String(r.UID))
      : null;
    if (hasUpbit) {
      priceKor =
        (krwRow ? krwRow.Upbit_Price || krwRow.Price_KRW : 0) ||
        r.Upbit_Price ||
        r.Price_KRW ||
        0;
    } else if (hasBithumb) {
      priceKor =
        (krwRow ? krwRow.Bithumb_Price || krwRow.Price_KRW : 0) ||
        r.Bithumb_Price ||
        r.Price_KRW ||
        0;
    }
  }

  const domMult = getMultiplier(
    r.Upbit_Symbol || r.Bithumb_Symbol || r.Ticker || r.Symbol,
  );
  const unitKorPrice = priceKor / domMult;

  // [김프 해외 단가 연산] market_rules.js의 단일 룰북 호출
  const { rawGlb, ovsMult, source } = getRowKimchiGlobalPrice(r);

  let unitGlbPrice = rawGlb;
  if (ovsMult > 1 && unitGlbPrice > 0 && unitKorPrice > 0) {
    const approxUsd = rate > 0 ? unitKorPrice / rate : 0;
    if (
      Math.abs(unitGlbPrice / ovsMult - approxUsd) <
      Math.abs(unitGlbPrice - approxUsd)
    ) {
      unitGlbPrice = unitGlbPrice / ovsMult;
    }
  }

  if (unitKorPrice > 0 && unitGlbPrice > 0) {
    const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;
    if (isFinite(kimchiPct)) {
      r.Kimchi_Raw = kimchiPct;
      r.Kimchi_Source = source;
      if (kimchiPct > 500 || kimchiPct <= -90) {
        r.Kimchi_Label = "VOID";
        r.Kimchi_Formatted = "VOID";
      } else {
        r.Kimchi_Label =
          (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
        r.Kimchi_Formatted =
          (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
      }
      return;
    }
  }

  r.Kimchi_Raw = null;
  r.Kimchi_Label = "-";
  r.Kimchi_Formatted = "-";
  r.Kimchi_Source = null;

  /*
  const isFakeZero =
    r.Kimchi_Raw === 0 ||
    r.Kimchi_Raw === 0.0 ||
    r.Kimchi_Raw === null ||
    r.Kimchi_Raw === undefined ||
    !r.Kimchi_Formatted ||
    /^(0\.0+%)?$/.test(r.Kimchi_Formatted) ||
    r.Kimchi_Formatted === "-" ||
    r.Kimchi_Formatted === "0.00%";

  if (isFakeZero) {
    r.Kimchi_Raw = null;
    r.Kimchi_Label = "-";
    r.Kimchi_Formatted = "-";
  }
  */
}
if (typeof window !== "undefined") {
  window.calculateRowKimchi = calculateRowKimchi;
}

const lastRenderRowMap = new Map();

// [행 식별자 매핑] 소켓 틱 데이터로부터 해당 종목 행(Row)을 O(1) 색인으로 탐색
function findTargetRow(tId, data) {
  const dataSym = (data.s || tId).toUpperCase();
  const cleanDataSym = dataSym.replace("-", "").toUpperCase();
  const cleanTId = tId.replace("-", "").toUpperCase();

  let row = null;
  if (data.isUpbitRealtime && data.UID) {
    row = store.uidRowMap?.get(String(data.UID)) || null;
  }

  if (!row) {
    row =
      store.tickerRowMap.get(cleanDataSym) || store.tickerRowMap.get(cleanTId);
    if (!row && (dataSym.startsWith("KRW-") || tId.startsWith("KRW-"))) {
      const upbitTicker = tId.replace("KRW-", "") + "KRW";
      row = store.tickerRowMap.get(upbitTicker);
    }
    if (!row && cleanDataSym.endsWith("KRW")) {
      row = store.tickerRowMap.get(cleanDataSym);
    }
    if (!row) {
      const baseSym = cleanDataSym.replace("USDT", "").replace("_FUTURES", "");
      row = store.tickerRowMap.get(baseSym);
    }
  }

  if (row && data.isUpbitRealtime && data.UID) {
    if (row.UID != data.UID) {
      const byUid =
        store.uidRowMap?.get(String(data.UID)) ||
        store.currentTableData?.find((r) => r.UID == data.UID);
      if (byUid) {
        row = byUid;
      } else {
        return null; // 오염된 다른 코인 데이터 drop
      }
    }
  }

  if (!row) return null;

  if (!row.Ticker.endsWith("KRW")) {
    const dataMult = getMultiplier(dataSym);
    const rowMult = getMultiplier(row.Ticker);
    const futMult = getMultiplier(row.Exact_Futures || "");
    const spotMult = getMultiplier(row.Exact_Spot || "");
    const bybitMult = getMultiplier(row.Bybit_Symbol || "");

    const isMultMatch =
      dataMult === rowMult ||
      dataMult === futMult ||
      dataMult === spotMult ||
      dataMult === bybitMult;

    if (!isMultMatch) {
      return null;
    }
  }

  return row;
}

// 개별 행 정밀 렌더링 엔진 (웹소켓 전용)
export function renderRealtimeRow(tId, data, options = false) {
  // [인자 표준화 및 하위 호환성 지원]
  // options => {
  //    exchange: "upbit"|"bithumb"|"binance"|"bybit"|"bitget",
  //    market: "spot"|"futures", quote: "KRW"|"USDT"|"BTC"
  // }  형태 지원
  let exchange = "binance";
  let market = "spot";
  let quote = "USDT";

  if (typeof options === "boolean") {
    market = options ? "futures" : "spot";
    if (data?.isUpbitRealtime) {
      exchange = "upbit";
      quote = "KRW";
    } else if (
      data?.isBithumbRealtime ||
      (typeof tId === "string" && tId.endsWith("_KRW"))
    ) {
      exchange = "bithumb";
      quote = "KRW";
    } else if (data?.isBybitRealtime) {
      exchange = "bybit";
    }
  } else if (typeof options === "object" && options !== null) {
    exchange = (options.exchange || "binance").toLowerCase();
    market = (options.market || "spot").toLowerCase();
    quote =
      options.quote ||
      (exchange === "upbit" || exchange === "bithumb" ? "KRW" : "USDT");
  }

  const isFutures = market === "futures";
  const isKoreaSocket = exchange === "upbit" || exchange === "bithumb";

  if (data && data.e === "24hrMiniTicker") {
    const close = parseFloat(data.c);
    const open = parseFloat(data.o);
    if (open > 0) {
      data.P = ((close - open) / open) * 100;
    }
  }

  if (store.blockTableUpdate) {
    if (store.bypassCounters) store.bypassCounters.tableUpdate++;
    return;
  }
  if (store.isTabHidden || store.isRestoringTab) return;

  // 메모리 갱신(Price_Raw 등)은 무손실 진행하기
  const serverTs =
    data.trade_timestamp ||
    data.timestamp ||
    data.tms ||
    data.ttms ||
    data.E ||
    data.T;
  if (serverTs && typeof window.calibrateTrueTime === "function") {
    window.calibrateTrueTime(serverTs);
  }
  const now =
    typeof window.getTrueEpochNow === "function"
      ? window.getTrueEpochNow()
      : Date.now();
  const source = `${exchange}_${market}`;
  const tickKey = `${source}:${data.s || tId}:${data.e || "ticker"}`;

  // 초당 최대 횟수 지정해서 소켓 과부하 관리하기
  if (data && (data.s || tId)) {
    if (!store._lastRowTickMap) store._lastRowTickMap = new Map();
    const lastTick = store._lastRowTickMap.get(tickKey) || 0;
    const microLimit = CONFIG.TABLE_PERF?.SOCKET_MICRO_THROTTLE_MS ?? 30;
    if (microLimit > 0 && now - lastTick < microLimit) {
      if (store.bypassCounters) store.bypassCounters.throttleBypass++;
      return;
    }
    if (store.bypassCounters) store.bypassCounters.throttlePass++;
    store._lastRowTickMap.set(tickKey, now);
  }

  const row = findTargetRow(tId, data);
  if (!row) return;

  const newPrice = parseFloat(
    data.c || data.p || data.trade_price || data.price,
  );
  if (isNaN(newPrice)) return;

  const isKrwCoin = row.Ticker.endsWith("KRW");
  const rate = store.marketDataMap?.krw_usd_rate || 1000;

  const hasGlobal =
    row.Binance === "O" ||
    row.Binance_Futures === "O" ||
    row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
    row.Listed_Exchanges?.includes("BINANCE_SPOT") ||
    row.Listed_Exchanges?.includes("BINANCE");

  if (isKoreaSocket) {
    if (exchange === "upbit" || data.isUpbitRealtime || row.Upbit !== "O")
      row.Price_KRW = newPrice;
    if (!hasGlobal) {
      row.Price_Raw = rate > 0 ? newPrice / rate : 0;
    }
    if (exchange === "upbit" || data.isUpbitRealtime) {
      row.Upbit_Price = newPrice;
    } else if (
      exchange === "bithumb" ||
      data.isBithumbRealtime ||
      (typeof tId === "string" && tId.endsWith("_KRW"))
    ) {
      row.Bithumb_Price = newPrice;
    }
  } else {
    const hasFutures =
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot =
      row.Binance === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_SPOT") ||
      row.Listed_Exchanges?.includes("BINANCE");
    const isFuturesOnly = hasFutures && !hasSpot;
    const isSpotOnly = hasSpot && !hasFutures;

    const isBinance =
      exchange === "binance" ||
      (!data.isBybitRealtime &&
        (hasSpot || hasFutures || row.Exact_Spot || row.Exact_Futures));

    if (exchange === "bybit" || data.isBybitRealtime) {
      if (isFutures) {
        row.Bybit_Price_Futures = newPrice;
        if (data.P !== undefined) {
          row.Change_24h_Bybit_Futures = parseFloat(data.P);
        }
      } else {
        row.Bybit_Price_Spot = newPrice;
        if (data.P !== undefined) {
          row.Change_24h_Bybit = parseFloat(data.P);
        }
      }
    } else if (isBinance) {
      if (isFutures) {
        row.Binance_Price_Futures = newPrice;
        if (data.P !== undefined) {
          row.Change_24h_Futures = parseFloat(data.P);
        }
      } else {
        row.Binance_Price_Spot = newPrice;
        if (data.P !== undefined) {
          row.Change_24h_Spot = parseFloat(data.P);
          row.Change_24h_Binance = parseFloat(data.P);
        }
      }
    } else {
      if (isFutures) {
        row.Bybit_Price_Futures = newPrice;
      } else {
        row.Bybit_Price_Spot = newPrice;
      }
    }

    /*
    // [기존 코드 보존] ALL 모드에서 선물/현물 존재 여부에 따라 상호 배타적으로 틱을 버리던 기존 로직
    // (선물 전용 코인이 현물/바이낸스 탭 모드에서 갱신이 막히던 이슈로 인해 조건 완화)
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    if (isAllMode) {
      const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

      if (hasFutures) {
        if (!isFutures) return;
      } else if (hasSpot) {
        if (isFutures) return;
      }
    }
    let shouldUpdate = false;
    if (isAllMode) {
      shouldUpdate = true;
    } else {
      shouldUpdate = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }
    */

    // [선물 우선 (Futures First) 원칙] 둘 다 있거나 선물이 있으면 선물 틱 우선 매핑, 현물만 있으면 현물 틱
    const shouldUpdate = hasFutures ? isFutures : !isFutures;

    if (shouldUpdate) {
      if (exchange === "bybit" || data.isBybitRealtime) {
        row.Bybit_Price = newPrice;
        if (!isBinance && !row.Ticker.endsWith("KRW")) {
          row.Price_Raw = newPrice;
        }
      } else {
        if (!row.Ticker.endsWith("KRW")) {
          row.Price_Raw = newPrice;
        }
        if (isBinance) {
          row.Binance_Price = newPrice;
        } else {
          row.Bybit_Price = newPrice;
        }
      }
    }
  }

  let shouldUpdateChg = false;
  if (isKrwCoin) {
    if (store.currentMarket === "UPBIT") {
      shouldUpdateChg =
        exchange === "upbit" ||
        data.isUpbitRealtime ||
        (row.Upbit === "O" &&
          !data.isBithumbRealtime &&
          exchange !== "bithumb");
    } else {
      // 기본 모드(ALL / BINANCE): 업비트 상장 코인은 업비트 틱 우선, 빗썸 전용 코인은 빗썸 틱 우선
      shouldUpdateChg =
        row.Upbit === "O"
          ? exchange === "upbit" ||
            data.isUpbitRealtime ||
            (exchange !== "bithumb" && !data.isBithumbRealtime)
          : exchange === "bithumb" ||
            data.isBithumbRealtime ||
            (exchange !== "upbit" && !data.isUpbitRealtime);
    }
  } else {
    const hasFutures =
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
      row.Bybit_Futures === "O" ||
      row.Listed_Exchanges?.includes("BYBIT_FUTURES") ||
      !!row.Exact_Futures;
    const hasSpot =
      row.Binance === "O" ||
      row.Listed_Exchanges?.includes("BINANCE_SPOT") ||
      row.Listed_Exchanges?.includes("BINANCE") ||
      row.Bybit === "O" ||
      row.Listed_Exchanges?.includes("BYBIT_SPOT") ||
      !!row.Exact_Spot;

    // ALL / BINANCE 기본 탭: 선물 상장 코인은 선물 등락률로 대표 24h/Day 갱신 (경주마 정렬 연동)
    shouldUpdateChg = hasFutures ? isFutures : !isFutures;
  }

  if (data.P !== undefined) {
    const chg = parseFloat(data.P);
    if (isKoreaSocket) {
      if (exchange === "bithumb" || data.isBithumbRealtime)
        row.Change_24h_Bithumb = chg;
    } else {
      if (exchange === "bybit" || data.isBybitRealtime) {
        if (isFutures) {
          row.Change_24h_Bybit_Futures = chg;
        } else {
          row.Change_24h_Bybit = chg;
        }
      } else if (isFutures) {
        row.Change_24h_Futures = chg;
      } else if (
        row.Listed_Exchanges?.includes("BINANCE") ||
        row.Exact_Spot ||
        row.Exact_Futures
      ) {
        row.Change_24h_Spot = chg;
        row.Change_24h_Binance = chg;
      } else {
        row.Change_24h_Bybit = chg;
      }
    }
    if (shouldUpdateChg) {
      if (!(isKoreaSocket && hasGlobal)) {
        // [수정] 업비트 당일 등락률과 24h 등락률(Change_24h_Raw) 침범 방지
        if (!isKoreaSocket) {
          row.Change_24h_Raw = chg;
        }
      }
    }
  }

  // [업비트 당일 등락률 전용 처리]
  if (data.P_today !== undefined && data.isUpbitRealtime) {
    const todayChg = parseFloat(data.P_today);
    row.Change_Today_Upbit = todayChg;
    if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
      row.Change_Today_Raw = todayChg;
    }
  }

  // [KST 일봉 리셋 & 과거 데이터 무효화]
  const currentUtcDay = new Date(
    typeof window.getTrueEpochNow === "function"
      ? window.getTrueEpochNow()
      : Date.now(),
  )
    .toISOString()
    .slice(0, 10);
  if (row._lastUtcDay && row._lastUtcDay !== currentUtcDay) {
    row.Change_Today_Raw = 0;
    row.Change_Today_Futures = 0;
    row.Change_Today_Spot = 0;
    row.Change_Today_Upbit = 0;
    row.Change_Today_Bithumb = 0;
    row.futures_utc0_open_Raw = null;
    row.spot_utc0_open_Raw = null;
    row.utc0_open_Raw = null;
    row.utc0_open_KRW = null;
    row._lastUtcDay = currentUtcDay;

    // 날짜 변경 감지 시 즉시 서버의 공식 09시 시가 장부 동기화 트리거
    if (typeof window.loadTableData === "function") {
      window.loadTableData(true, true);
    }
  }
  row._lastUtcDay = currentUtcDay;

  const isAlpha = row.is_alpha || row.Binance_Alpha === "O";

  if (isAlpha) {
    // 알파 코인은 어떤 소켓 틱이 들어와도 Day 시가 및 Day 등락률 null (-) 고정
    row.Change_Today_Raw = null;
    row.Change_Today_Spot = null;
    row.Change_Today_Binance = null;
    row.spot_utc0_open_Raw = null;
    row.futures_utc0_open_Raw = null;
  } else if (isKoreaSocket) {
    let openPriceKRW = row.utc0_open_KRW ? parseFloat(row.utc0_open_KRW) : 0;
    if (openPriceKRW <= 0 && row.utc0_open_Raw && rate > 0) {
      openPriceKRW = parseFloat(row.utc0_open_Raw) * rate;
    }
    // 9시 이후 첫 틱 수신 시 해당 틱을 당일 시가로 초기화하여 실시간 연산 지원
    if (openPriceKRW <= 0 && newPrice > 0) {
      openPriceKRW = newPrice;
      row.utc0_open_KRW = newPrice;
    }
    if (openPriceKRW > 0) {
      const todayKrw = ((newPrice - openPriceKRW) / openPriceKRW) * 100;
      if (data.isUpbitRealtime) row.Change_Today_Upbit = todayKrw;
      else if (data.isBithumbRealtime) row.Change_Today_Bithumb = todayKrw;

      if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
        row.Change_Today_Raw = todayKrw;
      }
    } else if (data.isUpbitRealtime && data.P_today !== undefined) {
      const todayKrw = parseFloat(data.P_today);
      row.Change_Today_Upbit = todayKrw;
      if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
        row.Change_Today_Raw = todayKrw;
      }
    }
  } else {
    // [현선 시가 격리] 선물과 현물은 서로의 시가/폴백에 관여하지 않기
    let openPrice = 0;
    if (isFutures) {
      // 선물 틱: 오직 선물 전용 09시 시가만 참조 (현물 시가 침범 방지)
      openPrice = parseFloat(row.futures_utc0_open_Raw || 0);
    } else {
      // 현물 틱: 오직 현물 전용 09시 공식 시가만 참조 (선물 시가 침범 방지)
      openPrice = parseFloat(row.spot_utc0_open_Raw || 0);
    }

    // [안전 보정] 거래량이 매우 저조한 현/선 코인 보호
    // 09시 이후 첫 틱 수신 시 임의 틱 체결가를 공식 시가(futures_utc0_open_Raw / spot_utc0_open_Raw)로 영구 고정하지 않기
    // 서버의 공식 일봉 kline / tradingDay 시가가 들어올 때까지 대기하며 왜곡 방지
    if (openPrice <= 0 && newPrice > 0) {
      // 서버에서 이미 받아둔 공식 시가가 존재하는지 재확인
      if (isFutures && row.futures_utc0_open_Raw) {
        openPrice = parseFloat(row.futures_utc0_open_Raw);
      } else if (!isFutures && row.spot_utc0_open_Raw) {
        openPrice = parseFloat(row.spot_utc0_open_Raw);
      }
    }

    if (openPrice > 0 && newPrice > 0) {
      let normNewPrice = newPrice;
      let normOpenPrice = openPrice;
      const ovsMult = getMultiplier(
        row.Exact_Futures || row.Ticker || row.Symbol,
      );
      if (ovsMult > 1) {
        if (normNewPrice > normOpenPrice * 10) normNewPrice /= ovsMult;
        else if (normOpenPrice > normNewPrice * 10) normOpenPrice /= ovsMult;
      }
      const todayUsd = ((normNewPrice - normOpenPrice) / normOpenPrice) * 100;
      if (isFutures) {
        row.Change_Today_Futures = todayUsd;
        if (
          row.Bybit_Futures === "O" ||
          row.Listed_Exchanges?.includes("BYBIT_FUTURES")
        ) {
          row.Change_Today_Bybit_Futures = todayUsd;
        }
      } else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot) {
        row.Change_Today_Spot = todayUsd;
        row.Change_Today_Binance = todayUsd;
      } else {
        row.Change_Today_Bybit = todayUsd;
      }

      if (shouldUpdateChg) {
        row.Change_Today_Raw = todayUsd;
      }
    }
  }

  // 실시간 소켓 갱신 시각 기록 (3초 주기 레이더의 낡은 캐시 덮어쓰기 방지)
  row._LastRealtimeUpdate =
    typeof window.getTrueEpochNow === "function"
      ? window.getTrueEpochNow()
      : Date.now();
  row.Last_Updated_Source = "실시간 소켓";

  if (!store.blockKimchi) {
    if (rate > 0) {
      calculateRowKimchi(row, rate);

      if (isKrwCoin) {
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        const partners = store.pureBaseToRowsMap
          ? store.pureBaseToRowsMap.get(pureBase)
          : null;
        if (partners) {
          partners.forEach((r) => {
            if (
              r !== row &&
              String(r.UID) === String(row.UID) &&
              r.Ticker.endsWith("KRW")
            ) {
              r.Price_KRW = newPrice;
              if (
                data.isUpbitRealtime ||
                tId.startsWith("KRW-") ||
                tId.endsWith("KRW")
              ) {
                r.Upbit_Price = newPrice;
              } else if (data.isBithumbRealtime || tId.endsWith("_KRW")) {
                r.Bithumb_Price = newPrice;
              }
              calculateRowKimchi(r, rate);
            }
          });
        }
      }
    }
  }

  // 실시간 거래대금(Volume) 누적 동기화
  if (isKoreaSocket) {
    if (data.q_upbit !== undefined) {
      row.Upbit_Vol = parseFloat(data.q_upbit);
      if (data.q_upbit_today !== undefined) {
        row.Upbit_Vol_Today = parseFloat(data.q_upbit_today);
      }
      const rate = store.marketDataMap?.krw_usd_rate || 1000;
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
      } else if (typeof window.formatVolumeDollar === "function") {
        row.Upbit_Vol_Formatted = window.formatVolumeDollar(
          rate > 0 ? row.Upbit_Vol / rate : row.Upbit_Vol,
        );
      }
      const hasGlobal =
        row.Binance === "O" ||
        row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE") ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      if (!hasGlobal && row.Upbit_Vol > 0) {
        const upVolUsd = rate > 0 ? row.Upbit_Vol / rate : row.Upbit_Vol;
        row.Volume_Raw = upVolUsd;
        if (
          store.currencyMode === "KRW" &&
          typeof window.formatVolumeKRW === "function"
        ) {
          row.Volume_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
        } else if (typeof window.formatVolumeDollar === "function") {
          row.Volume_Formatted = window.formatVolumeDollar(upVolUsd);
        }
      }
    }
  } else {
    if (
      data.e === "24hrMiniTicker" ||
      data.e === "24hrTicker" ||
      (!data.e && data.q !== undefined)
    ) {
      if (data.e !== "aggTrade" && data.e !== "trade") {
        if (isFutures) {
          row.Binance_Vol_Futures = parseFloat(data.q);
        } else {
          row.Binance_Vol_Spot = parseFloat(data.q);
        }
      }
    }

    // const activeM = store.currentChartMarket || store.currentMarket || "ALL";
    // const currentVolModeIsFutures = (activeM === "FUTURES" || activeM === "BYBIT_FUTURES") && row.Spot_Only !== "O";
    // const activeVol = currentVolModeIsFutures ? row.Binance_Vol_Futures : row.Binance_Vol_Spot;

    const activeM = store.currentMarket || "ALL";
    const isFuturesCoin =
      (row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
        row.Listed_Exchanges?.includes("BYBIT_FUTURES") ||
        row.Bybit_Futures === "O" ||
        !!row.Exact_Futures) &&
      row.Spot_Only !== "O";

    const activeVol = isFuturesCoin
      ? row.Binance_Vol_Futures > 0
        ? row.Binance_Vol_Futures
        : row.Binance_Vol_Spot || 0
      : row.Binance_Vol_Spot > 0
        ? row.Binance_Vol_Spot
        : row.Binance_Vol_Futures || 0;

    if (activeVol > 0) {
      row.Volume_Raw = activeVol;
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        const rate = store.marketDataMap?.krw_usd_rate || 1000;
        row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
      } else if (typeof window.formatVolumeDollar === "function") {
        row.Volume_Formatted = window.formatVolumeDollar(activeVol);
      }
    }
  }

  // DOM 렌더링 호출
  renderRowDom(row);
}

// -------------------------------------------------------------
// [DOM 렌더러] 행 노출 확인, 쓰로틀링, 가격 플래시 및 전광판 갱신
// -------------------------------------------------------------
function renderRowDom(row) {
  const isSelected =
    row.Ticker === store.currentSelectedSymbol ||
    row.UID === store.currentSelectedUid ||
    (store.currentSelectedSymbol &&
      (row.DisplayTicker === store.currentSelectedSymbol ||
        row.Symbol === store.currentSelectedSymbol));

  const isVisible =
    isSelected ||
    store.visibleSymbols.has(row.Ticker) ||
    store.visibleSymbols.has(row.Ticker.toUpperCase()) ||
    store.visibleSymbols.has(row.Ticker.toLowerCase()) ||
    store.visibleSymbols.has(row.Symbol) ||
    store.visibleSymbols.has(row.DisplayTicker);

  if (!isVisible) return;

  // [스마트 DOM 렌더 쓰로틀: 글자 갱신 주기]
  const isTurbo =
    typeof window.isTurboWindow === "function" && window.isTurboWindow();
  const perf = CONFIG.TABLE_PERF || {};
  const throttleLimit = isTurbo
    ? perf.CELL_RENDER_THROTTLE_TURBO_MS || 500
    : perf.CELL_RENDER_THROTTLE_NORMAL_MS || 500;

  const renderNow = Date.now();
  if (!row._lastCellRenderTime) row._lastCellRenderTime = 0;
  if (
    throttleLimit > 0 &&
    renderNow - row._lastCellRenderTime < throttleLimit
  ) {
    if (store.bypassCounters) store.bypassCounters.tableUpdate++;
    return;
  }
  row._lastCellRenderTime = renderNow;

  if (store.blockLeftDom === true) {
    const nowTime = Date.now();
    if (!row._lastStreamUpdate) row._lastStreamUpdate = 0;
    if (nowTime - row._lastStreamUpdate < 1000) {
      if (store.bypassCounters) store.bypassCounters.leftDom++;
      return;
    }
    row._lastStreamUpdate = nowTime;
  }

  const priceCell = document.getElementById(`price-${row.Ticker}`);
  const oldPrice = priceCell
    ? parseFloat(priceCell.getAttribute("data-raw-price")) || 0
    : 0;

  const rowEl =
    (row.UID ? store.rowDomMap?.get(String(row.UID)) : null) ||
    store.rowDomMap?.get(row.Ticker) ||
    document.getElementById(`row-${row.Ticker}`);
  if (!rowEl) {
    if (store.bypassCounters) store.bypassCounters.tableUpdate++;
    return;
  }

  if (typeof window.updateRowDynamicHTML === "function") {
    window.updateRowDynamicHTML(rowEl, row, !isSelected);
  }

  if (priceCell) {
    const displayedPrice =
      parseFloat(priceCell.getAttribute("data-raw-price")) || 0;
    if (displayedPrice !== oldPrice) {
      const activeExchange = priceCell.getAttribute("data-active-exchange");
      const activeSpan =
        document.getElementById(`price-val-${activeExchange}-${row.Ticker}`) ||
        priceCell.querySelector(".price-num");
      if (activeSpan && typeof window.applyPriceFlash === "function") {
        window.applyPriceFlash(activeSpan, displayedPrice, oldPrice);
      }
    }
  }

  if (
    row.Ticker === store.currentSelectedSymbol ||
    row.UID === store.currentSelectedSymbol ||
    row.Symbol === store.currentSelectedSymbol ||
    row.DisplayTicker === store.currentSelectedSymbol ||
    row.Exact_Spot === store.currentSelectedSymbol ||
    row.Exact_Futures === store.currentSelectedSymbol ||
    (store.currentSelectedUid &&
      String(row.UID) === String(store.currentSelectedUid))
  ) {
    if (typeof window.updateHeaderDisplay === "function") {
      const pPrecision =
        row.precision !== undefined && row.precision !== null
          ? Number(row.precision)
          : store.getPrecision(row.Ticker || row.DisplayTicker || row.Symbol);
      let activePrice = row.Price_Raw;
      const activeMkt = store.currentChartMarket || "ALL";
      if (activeMkt === "UPBIT") {
        activePrice = row.Upbit_Price;
      } else if (activeMkt === "BITHUMB") {
        activePrice = row.Bithumb_Price;
      } else if (activeMkt === "BYBIT" || activeMkt === "BYBIT_FUTURES") {
        activePrice =
          activeMkt === "BYBIT_FUTURES"
            ? row.Bybit_Price_Futures
            : row.Bybit_Price_Spot;
      } else if (activeMkt === "FUTURES") {
        activePrice = row.Binance_Price_Futures;
      } else if (activeMkt === "SPOT") {
        activePrice = row.Binance_Price_Spot;
      }
      window.updateHeaderDisplay(row, activePrice, pPrecision, true);
    }
  }

  const { n24h: change24h, nDay: todayChange } = getRowDisplayMetrics(row);

  const changeCell = document.getElementById(`change-${row.Ticker}`);
  if (changeCell) {
    const isFocus = store.currentSortCol !== "Change_Today";
    const themeClass =
      change24h > 0
        ? "text-theme-up"
        : change24h < 0
          ? "text-theme-down"
          : "text-theme-text";
    const chgText = `${change24h > 0 ? "+" : ""}${Number(change24h).toFixed(2)}%`;
    const chgFontSize = chgText.length > 8 ? "text-[9.5px]" : "text-[10.5px]";
    changeCell.className = `${themeClass} font-medium flex-1 min-w-0 text-left tracking-tighter whitespace-nowrap ${isFocus ? "opacity-100" : "opacity-40"} ${chgFontSize}`;
    changeCell.textContent = chgText;
  }

  const todayCell = document.getElementById(`today-${row.Ticker}`);
  if (todayCell) {
    const isFocus = store.currentSortCol === "Change_Today";
    const tThemeClass =
      todayChange > 0
        ? "text-theme-up"
        : todayChange < 0
          ? "text-theme-down"
          : "text-theme-text";
    const safeChange = todayChange < -99.9 ? -99.9 : todayChange;
    const todayText = `${safeChange > 0 ? "+" : ""}${Number(safeChange).toFixed(2)}%`;
    const todayFontSize =
      todayText.length > 8 ? "text-[9.5px]" : "text-[10.5px]";
    todayCell.className = `${tThemeClass} font-medium flex-1 min-w-0 text-left tracking-tighter whitespace-nowrap ${isFocus ? "opacity-100" : "opacity-40"} ${todayFontSize}`;
    todayCell.textContent = todayText;
  }
}

window.renderRealtimeRow = renderRealtimeRow;
window.syncSniperSubscriptions = syncSniperSubscriptions;
window.refreshSniperTarget = refreshSniperTarget;
