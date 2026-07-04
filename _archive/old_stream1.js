// stream.js
// --- 🌊 실시간 웹소켓 엔진 관제탑 (Orchestrator) ---
import { store, tfSec } from "../static/_store.js";
import { getMultiplier, getPureBase } from "../static/chart_utils.js";

// 하위 스트림 엔진들 통합 로드
import "../static/stream_table.js";
import "../static/stream_korea.js";
import "../static/stream_global.js";

// 🚀 [신규] 렌더링 과부하 방지용 쓰로틀 메모리
const lastRenderMap = new Map();

// 🚀 [신규] 코인별 대표 지표(Raw)를 거래소 우선순위(선물 > 현물 > 업비트)에 맞게 강제 동기화하는 함수
export function syncRowPrioritizedMetrics(row) {
  const currentMarket = store.currentMarket || "ALL";
  const rate = store.marketDataMap?.krw_usd_rate || 1;

  let hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
  let hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

  let pPrice = null;
  let p24h = null;
  let pToday = null;
  let pOpen = null;
  let pInflow = "";

  if (currentMarket === "FUTURES") {
    pPrice = row.Binance_Price_Futures ?? row.Bybit_Price_Futures ?? row.Price_Raw;
    p24h = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
    pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance_Futures === "O" ? "BINANCE_FUTURES" : "BYBIT_FUTURES";
  } else if (currentMarket === "SPOT") {
    pPrice = row.Binance_Price_Spot ?? row.Bybit_Price_Spot ?? row.Price_Raw;
    p24h = row.Change_24h_Binance ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Binance ?? row.Change_Today_Bybit ?? row.Change_Today_Raw;
    pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
    pInflow = row.Binance === "O" ? "BINANCE_SPOT" : "BYBIT_SPOT";
  } else if (currentMarket === "UPBIT") {
    pPrice = row.Upbit_Price ? (rate > 0 ? row.Upbit_Price / rate : row.Upbit_Price) : row.Price_Raw;
    p24h = row.Change_24h_Upbit ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Upbit ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
    pInflow = "UPBIT";
  } else if (currentMarket === "BITHUMB") {
    pPrice = row.Bithumb_Price ? (rate > 0 ? row.Bithumb_Price / rate : row.Bithumb_Price) : row.Price_Raw;
    p24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw;
    pToday = row.Change_Today_Bithumb ?? row.Change_Today_Raw;
    pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
    pInflow = "BITHUMB";
  } else {
    // ALL 모드 등 기본: 해외선물 > 해외현물 > 업비트 > 빗썸 순으로 락킹
    if (hasFutures) {
      pPrice = row.Binance_Price_Futures ?? row.Bybit_Price_Futures ?? row.Price_Raw;
      p24h = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Futures ?? row.Change_Today_Raw;
      pOpen = row.futures_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = row.Binance_Futures === "O" ? "BINANCE_FUTURES" : "BYBIT_FUTURES";
    } else if (hasSpot) {
      pPrice = row.Binance_Price_Spot ?? row.Bybit_Price_Spot ?? row.Price_Raw;
      p24h = row.Change_24h_Binance ?? row.Change_24h_Bybit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Binance ?? row.Change_Today_Bybit ?? row.Change_Today_Raw;
      pOpen = row.spot_utc0_open_Raw ?? row.utc0_open_Raw;
      pInflow = row.Binance === "O" ? "BINANCE_SPOT" : "BYBIT_SPOT";
    } else if (row.Upbit_Price) {
      pPrice = rate > 0 ? row.Upbit_Price / rate : row.Upbit_Price;
      p24h = row.Change_24h_Upbit ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Upbit ?? row.Change_Today_Raw;
      pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
      pInflow = "UPBIT";
    } else if (row.Bithumb_Price) {
      pPrice = rate > 0 ? row.Bithumb_Price / rate : row.Bithumb_Price;
      p24h = row.Change_24h_Bithumb ?? row.Change_24h_Raw;
      pToday = row.Change_Today_Bithumb ?? row.Change_Today_Raw;
      pOpen = row.utc0_open_KRW ? (rate > 0 ? parseFloat(row.utc0_open_KRW) / rate : parseFloat(row.utc0_open_KRW)) : row.utc0_open_Raw;
      pInflow = "BITHUMB";
    } else {
      pPrice = row.Price_Raw;
      p24h = row.Change_24h_Raw;
      pToday = row.Change_Today_Raw;
      pOpen = row.utc0_open_Raw;
      pInflow = "BINANCE";
    }
  }

  if (pPrice !== null && pPrice !== undefined) row.Price_Raw = pPrice;
  if (p24h !== null && p24h !== undefined) row.Change_24h_Raw = p24h;
  if (pToday !== null && pToday !== undefined) row.Change_Today_Raw = pToday;
  if (pOpen !== null && pOpen !== undefined) {
    row.spot_utc0_open_Raw = pOpen;
    row.futures_utc0_open_Raw = pOpen;
    row.utc0_open_Raw = pOpen;
  }
  row.Inflow_Path = pInflow;
  row.activeExchange = pInflow.toLowerCase().replace("_spot", "").replace("_futures", "");
}
window.syncRowPrioritizedMetrics = syncRowPrioritizedMetrics;


// ⚡ [HTS 핵심] 개별 행 정밀 렌더링 엔진 (웹소켓 전용)
function renderRealtimeRow(tId, data, isFutures = false) {
  // 🔍 실시간 디버깅 필터
  if (window.debugSellnance && window.debugSellnance.enabled) {
    const target = window.debugSellnance.targetTicker;
    if (!target || tId.toUpperCase().includes(target) || (data.s && data.s.toUpperCase().includes(target))) {
      console.log(`[Socket Data In] tId: ${tId}, price: ${data.c || data.p}, chg: ${data.P}, isUpbit: ${!!data.isUpbitRealtime}`);
    }
  }

  if (store.blockTableUpdate) {
    return;
  }

  if (store.isTabHidden || store.isRestoringTab) {
    return;
  }

  const now = Date.now();
  const dataSym = (data.s || tId).toUpperCase();
  const cleanDataSym = dataSym.replace("-", "").toUpperCase();
  const cleanTId = tId.replace("-", "").toUpperCase();

  let row = null;
  // 1순위: UID 정보가 있다면 최우선적으로 전수 테이블 데이터에서 직접 UID 기준 일치색인 (타입 미스매칭 차단)
  if (data.isUpbitRealtime && data.UID) {
    row = store.currentTableData.find((r) => r.UID == data.UID);
  }

  // 2순위: UID 매칭이 불가능한 채널일 경우 광속 해시 맵핑 탐색 수행
  if (!row) {
    row = store.tickerRowMap.get(cleanDataSym) || store.tickerRowMap.get(cleanTId);
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

  // 🚀 [HTS 동명이인 원천 차단] 업비트 소켓 유입 시 주입받은 고유 UID 최종 교차 매칭 검증
  if (row && data.isUpbitRealtime && data.UID) {
    if (row.UID != data.UID) {
      const correctLocalRow = store.currentTableData.find((r) => r.UID == data.UID);
      if (correctLocalRow) {
        row = correctLocalRow;
      } else {
        return; // 오염된 이종 코인 데이터 드롭
      }
    }
  }

  if (!row) return;

  const lastRender = lastRenderMap.get(row.Ticker) || 0;

  // 🚀 [입구 레벨 강제 500ms 쓰로틀링] aggTrade 및 실시간 업비트 시세 스루풋 제어 (row.Ticker 일치화)
  if (data && (data.e === "aggTrade" || data.isUpbitRealtime)) {
    if (now - lastRender < 500) {
      return;
    }
    lastRenderMap.set(row.Ticker, now);
  }

  // 🚨 [최종 수문장] PEPE vs 1000PEPE 등 배수 기호가 다르면 다른 코인임 (오염 차단)
  // 단, 국내 원화 코인(KRW)의 경우는 배수 코인이 존재하지 않으므로 체크를 스킵하여 수급 유연성 극대화
  if (!row.Ticker.endsWith("KRW") && getMultiplier(dataSym) !== getMultiplier(row.Ticker)) return;

  const newPrice = parseFloat(data.c || data.p || data.trade_price || data.price);
  if (isNaN(newPrice)) return;

  const isKrwCoin = row.Ticker.endsWith("KRW");
  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKoreaSocket = !!(data.isUpbitRealtime || data.isBithumbRealtime);
  const isAllMode =
    store.currentMarket === "ALL" ||
    store.currentMarket === "KIMCHI" ||
    store.currentMarket === "NEW";

  const hasGlobal = row.Binance === "O" || row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE") || row.Listed_Exchanges?.includes("BINANCE_FUTURES");

  if (isKoreaSocket) {
    row.Price_KRW = newPrice;
    if (!hasGlobal) {
      row.Price_Raw = newPrice / rate;
    }
    if (data.isUpbitRealtime || tId.startsWith("KRW-") || tId.endsWith("KRW")) {
      row.Upbit_Price = newPrice;
    } else if (data.isBithumbRealtime || tId.endsWith("_KRW")) {
      row.Bithumb_Price = newPrice;
    }
  } else {
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    const isFuturesOnly = row.Binance === "X" && row.Binance_Futures === "O";

    // 🚀 [추가] ALL 모드 독점적 전담 바인딩 (바낸 선물 상장이면 선물만 수신, 선물 없고 현물 있으면 현물만 수신, 둘 다 없으면 업비트/빗썸만 수신)
    if (isAllMode) {
      const hasFutures =
        row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

      if (hasFutures) {
        // 선물 상장 코인은 오직 선물 데이터만 통과
        if (!isFutures) return;
      } else if (hasSpot) {
        // 현물만 상장된 코인은 오직 현물 데이터만 통과
        if (isFutures) return;
      } else {
        // 해외 마켓이 없는 코인은 국내 소켓 데이터만 통과 (아래 isKoreaSocket 분기에서 걸러짐)
      }
    }

    let shouldUpdate = false;
    if (isAllMode) {
      shouldUpdate = true; // 위에서 우선순위 필터링을 통과했으므로 무조건 갱신 허용
    } else {
      shouldUpdate = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }

    const isBinance =
      row.Binance === "O" ||
      row.Binance_Futures === "O" ||
      row.Listed_Exchanges?.includes("BINANCE") ||
      row.Listed_Exchanges?.includes("BINANCE_FUTURES") ||
      row.Exact_Spot ||
      row.Exact_Futures;

    if (isBinance) {
      if (isFutures) {
        row.Binance_Price_Futures = newPrice;
        if (data.P !== undefined) row.Change_24h_Futures = parseFloat(data.P);
      } else {
        row.Binance_Price_Spot = newPrice;
        if (data.P !== undefined) row.Change_24h_Spot = parseFloat(data.P);
      }
    } else {
      if (isFutures) {
        row.Bybit_Price_Futures = newPrice;
      } else {
        row.Bybit_Price_Spot = newPrice;
      }
    }

    if (shouldUpdate) {
      // 🚨 [안전장치] 원화 코인인 경우, 대표 가격(Price_Raw)은 업비트/빗썸 소켓에 의해서만 결정되도록 바이낸스 가격 덮어쓰기 방지!
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

  // 🚀 [추가] 실시간 등락률 오염 방어용 분기 결정
  let shouldUpdateChg = false;
  if (isKrwCoin) {
    if (store.currentMarket === "UPBIT") {
      shouldUpdateChg =
        data.isUpbitRealtime || (row.Upbit === "O" && !data.isBithumbRealtime);
    } else if (store.currentMarket === "BITHUMB") {
      shouldUpdateChg =
        data.isBithumbRealtime || (row.Upbit !== "O" && !data.isUpbitRealtime);
    } else {
      // ALL, KIMCHI 등
      if (row.Upbit === "O") {
        shouldUpdateChg = data.isUpbitRealtime || !data.isBithumbRealtime;
      } else {
        shouldUpdateChg = data.isBithumbRealtime || !data.isUpbitRealtime;
      }
    }
  } else {
    const activeIsFutures = store.currentMarket === "FUTURES";
    const isSpotOnly = row.Spot_Only === "O";
    const isAllMode =
      store.currentMarket === "ALL" ||
      store.currentMarket === "KIMCHI" ||
      store.currentMarket === "NEW";
    const isFuturesOnly = row.Binance === "X" && row.Binance_Futures === "O";
    if (isAllMode) {
      shouldUpdateChg = true; // 우선순위 필터링을 입구에서 통과했으므로 변동률 갱신 허용
    } else {
      shouldUpdateChg = isSpotOnly ? !isFutures : activeIsFutures === isFutures;
    }
  }
  if (data.P !== undefined) {
    const chg = parseFloat(data.P);
    if (isKoreaSocket) {
      if (data.isUpbitRealtime) row.Change_24h_Upbit = chg;
      else if (data.isBithumbRealtime) row.Change_24h_Bithumb = chg;
    } else {
      if (isFutures) row.Change_24h_Futures_Ex = chg;
      else if (
        row.Listed_Exchanges?.includes("BINANCE") ||
        row.Exact_Spot ||
        row.Exact_Futures
      ) {
        row.Change_24h_Binance = chg;
      } else {
        row.Change_24h_Bybit = chg;
      }
    }
    if (shouldUpdateChg) {
      if (!(isKoreaSocket && hasGlobal)) {
        row.Change_24h_Raw = chg;
      }
    }
  }

  if (isKoreaSocket && (row.utc0_open_KRW || (row.utc0_open_Raw && rate > 0))) {
    let openPriceKRW = row.utc0_open_KRW ? parseFloat(row.utc0_open_KRW) : 0;
    if (openPriceKRW <= 0 && row.utc0_open_Raw && rate > 0) {
      openPriceKRW = parseFloat(row.utc0_open_Raw) * rate;
    }
    if (openPriceKRW > 0) {
      const todayKrw = ((newPrice - openPriceKRW) / openPriceKRW) * 100;
      if (data.isUpbitRealtime) row.Change_Today_Upbit = todayKrw;
      else if (data.isBithumbRealtime) row.Change_Today_Bithumb = todayKrw;

      if (shouldUpdateChg && !(isKoreaSocket && hasGlobal)) {
        row.Change_Today_Raw = todayKrw;
      }
    }
  } else if (!isKoreaSocket) {
    let openPrice = 0;
    if (isFutures) {
      openPrice = parseFloat(row.futures_utc0_open_Raw || row.utc0_open_Raw || 0);
    } else {
      openPrice = parseFloat(row.spot_utc0_open_Raw || row.utc0_open_Raw || 0);
    }
    if (openPrice > 0) {
      const todayUsd = ((newPrice - openPrice) / openPrice) * 100;
      if (isFutures) row.Change_Today_Futures = todayUsd;
      else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot)
        row.Change_Today_Binance = todayUsd;
      else row.Change_Today_Bybit = todayUsd;

      if (shouldUpdateChg) {
        row.Change_Today_Raw = todayUsd;
      }
    }
  }

  const p = store.getPrecision(row.Ticker);

  // 🚀 [제거 및 이동] head-price 웹소캣 쓰로틀링 적용을 위해 렌더링 큐 내부(_realtimeRenderQueue)로 해당 호출을 이동시켰습니다.

  // 🚀 [실시간 김프 연산 차단]
  if (!store.blockKimchi) {
    const rate = store.marketDataMap?.krw_usd_rate || 0;
    if (rate > 0) {
      const calcKimchi = (r) => {
        const rIsKrw = r.Ticker?.endsWith("KRW");
        const domMult = getMultiplier(r.Upbit_Symbol || r.Symbol || r.Ticker);
        const ovsMult = getMultiplier(r.Exact_Futures || r.Exact_Spot || r.Symbol || r.Ticker);
        const unitKorPrice = (r.Price_KRW || 0) / domMult;
        const unitGlbPrice = (r.Price_Raw || 0) / ovsMult;

        if (unitKorPrice > 0 && unitGlbPrice > 0) {
          const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;
          if (isFinite(kimchiPct) && kimchiPct >= -50 && kimchiPct <= 100) {
            r.Kimchi_Raw = kimchiPct;
            r.Kimchi_Label = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
            r.Kimchi_Formatted = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(1) + "%";
          }
        }
      };

      calcKimchi(row);

      // If it's a KRW coin, also update and recalculate kimchi for matched multiplier/scaled rows
      if (isKrwCoin) {
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        store.currentTableData.forEach((r) => {
          if (r !== row && r.Ticker.endsWith("KRW") && (r.Upbit_Symbol === pureBase || getPureBase(r.Symbol) === pureBase)) {
            r.Price_KRW = newPrice;
            if (data.isUpbitRealtime || tId.startsWith("KRW-") || tId.endsWith("KRW")) {
              r.Upbit_Price = newPrice;
            } else if (data.isBithumbRealtime || tId.endsWith("_KRW")) {
              r.Bithumb_Price = newPrice;
            }
            calcKimchi(r);
          }
        });
      }
    }
  }

  // 🚀 [신규] 지표 우선순위 동기화 실행
  syncRowPrioritizedMetrics(row);

  const isVisible =
    store.visibleSymbols.has(row.Ticker) ||
    store.visibleSymbols.has(row.Ticker.toUpperCase()) ||
    store.visibleSymbols.has(row.Ticker.toLowerCase()) ||
    store.visibleSymbols.has(row.Symbol) ||
    store.visibleSymbols.has(row.DisplayTicker);

  if (!isVisible) return;
  if (store.blockLeftDom === true) {
    const nowTime = Date.now();
    if (!row._lastStreamUpdate) row._lastStreamUpdate = 0;
    if (nowTime - row._lastStreamUpdate < 1000) {
      return;
    }
    row._lastStreamUpdate = nowTime;
  }

  // 🚀 [추가] aggTrade 주기 조절 (쓰로틀링) - 입구 레벨로 통합되어 주석 처리함 (SolidJS 마이그레이션 보존용)
  // if (store.aggTradeInterval > 0 && (data.e === "aggTrade" || data.isUpbitRealtime)) {
  //   if (now - lastRender < store.aggTradeInterval) {
  //     return;
  //   }
  // }
  // lastRenderMap.set(row.Ticker, now);

  // 🚀 [렉 차단: Batch Update 버퍼링 기법]
  // 소켓 데이터가 오자마자 즉시 DOM을 갱신하면 Layout Thrashing으로 렉이 발생합니다.
  // 데이터를 프레임 단위 버퍼에 누적하고 requestAnimationFrame 주기에 맞추어 한번에 일괄 갱신합니다.
  if (!window._realtimeRenderQueue) {
    window._realtimeRenderQueue = new Map();
    const processQueue = () => {
      if (window._realtimeRenderQueue.size > 0) {
        window._realtimeRenderQueue.forEach((updateFn) => {
          try {
            updateFn();
          } catch (e) { }
        });
        window._realtimeRenderQueue.clear();
      }
      requestAnimationFrame(processQueue);
    };
    requestAnimationFrame(processQueue);
  }

  window._realtimeRenderQueue.set(row.Ticker, () => {
    const priceCell = document.getElementById(`price-${row.Ticker}`);
    if (!priceCell) return;

    const oldPrice = parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

    if (typeof window.updateRowPriceDisplay === "function") {
      window.updateRowPriceDisplay(null, row);
    }

    const displayedPrice =
      parseFloat(priceCell.getAttribute("data-raw-price")) || 0;

    if (displayedPrice !== oldPrice) {
      const activeExchange = priceCell.getAttribute("data-active-exchange");
      const activeSpan = document.getElementById(
        `price-val-${activeExchange}-${row.Ticker}`,
      );
      if (activeSpan && typeof window.applyPriceFlash === "function") {
        window.applyPriceFlash(activeSpan, displayedPrice, oldPrice);
      }
    }

    // 🚀 [추가] head-price 웹소캣 쓰로틀링 적용 (현재 선택된 심볼 시세 전광판 갱신)
    if (
      row.Ticker === store.currentSelectedSymbol ||
      row.UID === store.currentSelectedSymbol
    ) {
      if (typeof window.updateHeaderDisplay === "function") {
        const pPrecision = store.getPrecision(row.Ticker);
        let activePrice = row.Price_Raw;
        const activeMkt = store.currentChartMarket || "ALL";
        if (activeMkt === "UPBIT") {
          activePrice = row.Upbit_Price;
        } else if (activeMkt === "BITHUMB") {
          activePrice = row.Bithumb_Price;
        } else if (activeMkt === "BYBIT" || activeMkt === "BYBIT_FUTURES") {
          activePrice = (activeMkt === "BYBIT_FUTURES") ? row.Bybit_Price_Futures : row.Bybit_Price_Spot;
        } else if (activeMkt === "FUTURES") {
          activePrice = row.Binance_Price_Futures;
        } else if (activeMkt === "SPOT") {
          activePrice = row.Binance_Price_Spot;
        }
        window.updateHeaderDisplay(row, activePrice, pPrecision, true);
      }
    }

    const isBinanceListed = row.Binance === "O" || row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE") || row.Listed_Exchanges?.includes("BINANCE_FUTURES");

    const changeCell = document.getElementById(`change-${row.Ticker}`);
    if (changeCell) {
      const currentMarket = store.currentMarket || "ALL";
      let change24h = row.Change_24h_Raw || 0;
      if (currentMarket === "UPBIT") {
        change24h = row.Change_24h_Upbit ?? change24h;
      } else if (currentMarket === "BITHUMB") {
        change24h = row.Change_24h_Bithumb ?? change24h;
      } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
        change24h = row.Change_24h_Futures_Ex ?? change24h;
      } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
        change24h = (currentMarket === "SPOT" ? row.Change_24h_Binance : row.Change_24h_Bybit) ?? change24h;
      } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
        // 🚀 [추가] ALL 모드 24h 변동률 우선순위 단일 독점 바인딩 적용 (선물 -> 현물 -> 업비트 -> 빗썸)
        if (row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          change24h = row.Change_24h_Futures_Ex ?? change24h;
        } else if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
          change24h = row.Change_24h_Binance ?? change24h;
        } else {
          change24h = row.Change_24h_Upbit
          // ?? row.Change_24h_Bithumb ?? change24h;
        }
      }

      const isFocus = store.currentSortCol !== "Change_Today";
      const themeClass =
        change24h > 0
          ? "text-theme-up"
          : change24h < 0
            ? "text-theme-down"
            : "text-theme-text";
      const chgText = `${change24h > 0 ? "+" : ""}${change24h.toFixed(2)}%`;
      const chgFontSize = chgText.length > 7 ? "text-[8px]" : "text-[10px]";
      changeCell.className = `${themeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${chgFontSize}`;
      changeCell.textContent = chgText;
    }

    const todayCell = document.getElementById(`today-${row.Ticker}`);
    if (todayCell) {
      const currentMarket = store.currentMarket || "ALL";
      let todayChange = row.Change_Today_Raw || 0;
      if (currentMarket === "UPBIT") {
        todayChange = row.Change_Today_Upbit ?? todayChange;
      } else if (currentMarket === "BITHUMB") {
        todayChange = row.Change_Today_Bithumb ?? todayChange;
      } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
        todayChange = row.Change_Today_Futures ?? todayChange;
      } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
        todayChange = (currentMarket === "SPOT" ? row.Change_Today_Binance : row.Change_Today_Bybit) ?? todayChange;
      } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
        // 🚀 [추가] ALL 모드 오늘(Today) 변동률 우선순위 단일 독점 바인딩 적용 (선물 -> 현물 -> 업비트 -> 빗썸)
        if (row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          todayChange = row.Change_Today_Futures ?? todayChange;
        } else if (row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE")) {
          todayChange = row.Change_Today_Binance ?? todayChange;
        } else {
          todayChange = row.Change_Today_Upbit ?? todayChange;
        }
      }

      const isFocus = store.currentSortCol === "Change_Today";
      const tThemeClass =
        todayChange > 0
          ? "text-theme-up"
          : todayChange < 0
            ? "text-theme-down"
            : "text-theme-text";
      const safeChange = todayChange < -99.9 ? -99.9 : todayChange;
      const todayText = `${safeChange > 0 ? "+" : ""}${safeChange.toFixed(2)}%`;
      const todayFontSize = todayText.length > 7 ? "text-[8px]" : "text-[10px]";
      todayCell.className = `${tThemeClass} font-medium whitespace-nowrap flex-shrink-0 ${isFocus ? "opacity-100" : "opacity-40"} ${todayFontSize}`;
      todayCell.textContent = todayText;
    }

    const binanceVolCell = document.getElementById(`vol-binance-${row.Ticker}`);
    if (binanceVolCell && data.q && data.e === "24hrTicker") {
      if (isFutures) {
        row.Binance_Vol_Futures = parseFloat(data.q);
      } else {
        row.Binance_Vol_Spot = parseFloat(data.q);
      }

      // 차트 마켓(store.currentChartMarket) 또는 메인 테이블 마켓(store.currentMarket) 기준으로 활성 마켓 판단
      const activeM = store.currentChartMarket || store.currentMarket || "ALL";
      const currentVolModeIsFutures =
        (activeM === "FUTURES" || activeM === "BYBIT_FUTURES") && row.Spot_Only !== "O";
      const isMatchingMode = currentVolModeIsFutures === isFutures;

      if (isMatchingMode) {
        const activeVol = isFutures
          ? row.Binance_Vol_Futures
          : row.Binance_Vol_Spot;
        if (
          store.currencyMode === "KRW" &&
          typeof window.formatVolumeKRW === "function"
        ) {
          const rate = store.marketDataMap?.krw_usd_rate || 1;
          row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
        } else if (typeof window.formatVolumeDollar === "function") {
          row.Volume_Formatted = window.formatVolumeDollar(activeVol);
        }
        binanceVolCell.innerText = row.Volume_Formatted || "-";
      }
    }

    const upbitVolCell =
      document.getElementById(`vol-upbit-${row.Ticker}`) ||
      document.getElementById(`vol-upbit-${row.Ticker.toUpperCase()}`) ||
      document.getElementById(`vol-upbit-${row.Ticker.toLowerCase()}`) ||
      (row.Symbol ? document.getElementById(`vol-upbit-KRW-${row.Symbol.toUpperCase()}`) : null);

    if (upbitVolCell && data.q_upbit) {
      row.Upbit_Vol = parseFloat(data.q_upbit);
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        row.Upbit_Vol_Formatted = window.formatVolumeKRW(row.Upbit_Vol);
      } else if (typeof window.formatVolumeDollar === "function") {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Upbit_Vol_Formatted = window.formatVolumeDollar(
          row.Upbit_Vol / (rate > 0 ? rate : 1),
        );
      }
      upbitVolCell.innerText = row.Upbit_Vol_Formatted || "-";
    }

    // 🚀 실시간 갱신 시 Trace 기록 트리거 (1번 행일 경우)
    if (typeof window.traceMetricCall === "function") {
      const firstRow = document.querySelector('#coin-list-body > div[data-index="0"]');
      if (firstRow && firstRow.dataset.sym === row.Ticker) {
        window.traceMetricCall("Price");
        window.traceMetricCall("24H");
        window.traceMetricCall("Day");
        if (data.q) window.traceMetricCall("Vol");
        if (data.q_upbit) window.traceMetricCall("UVol");
      }
    }
  });
}

window.renderRealtimeRow = renderRealtimeRow;

export function getUpbitCandleStartTime(serverMs, tf) {
  const d = new Date(serverMs);
  const sec = tfSec[tf] || 60;
  if (tf.includes("d") || tf.includes("w") || tf.includes("M")) {
    d.setUTCHours(0, 0, 0, 0);
    if (tf === "1w") {
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
    } else if (tf === "1M") d.setUTCDate(1);
  } else {
    const timestamp = Math.floor(serverMs / 1000);
    return Math.floor(timestamp / sec) * sec;
  }
  return Math.floor(d.getTime() / 1000);
}

if (store.radarIntervalId) clearInterval(store.radarIntervalId);
store.radarIntervalId = setInterval(() => {
  if (store.blockRadarBatch) return;
  if (Object.keys(store.tickerBuffer).length === 0) return;
  const snapshot = { ...store.tickerBuffer };
  store.tickerBuffer = {};

  let dataUpdated = false;
  store.currentTableData.forEach((row) => {
    const isKrwCoin = row.Ticker.endsWith("KRW");
    let ticker = null;
    let isFuturesTicker = false;

    if (isKrwCoin) {
      ticker =
        snapshot[`KRW-${row.Ticker.replace("KRW", "")}`] ||
        snapshot[row.Ticker];
    } else {
      const hasFutures =
        row.Binance_Futures === "O" ||
        row.Listed_Exchanges?.includes("BINANCE_FUTURES");
      const isAllMode =
        store.currentMarket === "ALL" ||
        store.currentMarket === "KIMCHI" ||
        store.currentMarket === "NEW";
      const useFutures =
        ((store.currentMarket === "FUTURES") || (isAllMode && hasFutures)) &&
        row.Spot_Only !== "O";

      const baseSymbol = row.Exact_Futures || row.Exact_Spot || row.Symbol || row.Ticker;
      const lookupKey = baseSymbol.toUpperCase() + (useFutures ? "USDT_FUTURES" : "USDT");
      ticker = snapshot[lookupKey];
      isFuturesTicker = lookupKey.endsWith("_FUTURES");
    }

    if (!ticker) return;

    if (isKrwCoin) {
      const rate = store.marketDataMap?.krw_usd_rate || 0;
      row.Price_KRW = parseFloat(ticker.c);
      row.Price_Raw = row.Price_KRW / rate;
      if (row.Upbit === "O" || store.currentMarket !== "BITHUMB") {
        row.Upbit_Price = row.Price_KRW;
      } else {
        row.Bithumb_Price = row.Price_KRW;
      }

      // Propagate KRW price to matched multiplier/scaled rows
      const pureBase = getPureBase(row.Symbol || row.Ticker);
      store.currentTableData.forEach((r) => {
        if (r !== row && r.Ticker.endsWith("KRW") && (r.Upbit_Symbol === pureBase || getPureBase(r.Symbol) === pureBase)) {
          r.Price_KRW = row.Price_KRW;
          r.Upbit_Price = row.Upbit_Price;
          r.Bithumb_Price = row.Bithumb_Price;
        }
      });
    } else {
      const newPrice = parseFloat(ticker.c);
      if (isFuturesTicker) {
        row.Binance_Price_Futures = newPrice;
        if (!row.Listed_Exchanges?.includes("BINANCE_FUTURES")) {
          row.Bybit_Price_Futures = newPrice;
        }
      } else {
        row.Binance_Price_Spot = newPrice;
        if (!row.Listed_Exchanges?.includes("BINANCE") && !row.Exact_Spot) {
          row.Bybit_Price_Spot = newPrice;
        }
      }

      row.Price_Raw = newPrice;
      if (
        row.Listed_Exchanges?.includes("BINANCE") ||
        row.Exact_Spot ||
        row.Exact_Futures
      ) {
        row.Binance_Price = newPrice;
      } else {
        row.Bybit_Price = newPrice;
      }
    }

    const chg = parseFloat(ticker.P);
    const isKoreaTicker = !!ticker.isUpbitRealtime;

    // 🚨 [안전장치] 원화 마켓 코인이 아님에도 한국 소켓의 스냅샷 데이터로 24h 변동률 장부가 오염되는 현상 원천 차단
    let shouldUpdateChg = false;
    if (isKrwCoin) {
      shouldUpdateChg = isKoreaTicker;
    } else {
      shouldUpdateChg = !isKoreaTicker;
    }

    if (shouldUpdateChg) {
      row.Change_24h_Raw = chg;
    }

    if (isKoreaTicker) {
      row.Change_24h_Upbit = chg;
    } else {
      if (isFuturesTicker) {
        row.Change_24h_Futures_Ex = chg;
      } else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot) {
        row.Change_24h_Binance = chg;
      } else {
        row.Change_24h_Bybit = chg;
      }
    }

    // 🚀 바이낸스 현물 / 선물 거래대금 분리 누적 반영
    const spotKey = row.Ticker;
    const futuresKey = row.Ticker + "_FUTURES";

    if (snapshot[spotKey] && snapshot[spotKey].q) {
      row.Binance_Vol_Spot = parseFloat(snapshot[spotKey].q);
    }
    if (snapshot[futuresKey] && snapshot[futuresKey].q) {
      row.Binance_Vol_Futures = parseFloat(snapshot[futuresKey].q);
    }

    const currentVolModeIsFutures =
      store.currentMarket === "FUTURES" && row.Spot_Only !== "O";
    const activeVol = currentVolModeIsFutures
      ? row.Binance_Vol_Futures
      : row.Binance_Vol_Spot;
    if (activeVol !== undefined) {
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        row.Volume_Formatted = window.formatVolumeKRW(activeVol * rate);
      } else if (typeof window.formatVolumeDollar === "function") {
        row.Volume_Formatted = window.formatVolumeDollar(activeVol);
      }
    }

    if (isKoreaTicker && row.utc0_open_KRW) {
      const openPriceKRW = parseFloat(row.utc0_open_KRW);
      if (openPriceKRW > 0 && row.Price_KRW) {
        const todayKrw = ((row.Price_KRW - openPriceKRW) / openPriceKRW) * 100;
        row.Change_Today_Raw = todayKrw;
        row.Change_Today_Upbit = todayKrw;
      }
    } else if (!isKoreaTicker) {
      let open = 0;
      if (isFuturesTicker) {
        open = parseFloat(row.futures_utc0_open_Raw || row.utc0_open_Raw || 0);
      } else {
        open = parseFloat(row.spot_utc0_open_Raw || row.utc0_open_Raw || 0);
      }
      if (open > 0) {
        const todayUsd = ((row.Price_Raw - open) / open) * 100;
        row.Change_Today_Raw = todayUsd;
        if (isFuturesTicker) {
          row.Change_Today_Futures = todayUsd;
        } else if (row.Listed_Exchanges?.includes("BINANCE") || row.Exact_Spot) {
          row.Change_Today_Binance = todayUsd;
        } else {
          row.Change_Today_Bybit = todayUsd;
        }
      }
    }

    // 🚀 [실시간 김프 연산 차단] 3초 주기 레이더 스냅샷
    if (!store.blockKimchi) {
      const rate = store.marketDataMap?.krw_usd_rate || 0;
      if (rate > 0) {
        const calcKimchi = (r) => {
          const rIsKrw = r.Ticker?.endsWith("KRW");
          const domMult = getMultiplier(r.Upbit_Symbol || r.Symbol || r.Ticker);
          const ovsMult = getMultiplier(r.Exact_Futures || r.Exact_Spot || r.Symbol || r.Ticker);
          const unitKorPrice = (r.Price_KRW || 0) / domMult;
          const unitGlbPrice = (r.Price_Raw || 0) / ovsMult;

          if (unitKorPrice > 0 && unitGlbPrice > 0) {
            const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;
            if (isFinite(kimchiPct) && kimchiPct >= -50 && kimchiPct <= 100) {
              r.Kimchi_Raw = kimchiPct;
              r.Kimchi_Label = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(2) + "%";
              r.Kimchi_Formatted = (kimchiPct > 0 ? "+" : "") + kimchiPct.toFixed(1) + "%";
            }
          }
        };

        calcKimchi(row);

        if (isKrwCoin) {
          const pureBase = getPureBase(row.Symbol || row.Ticker);
          store.currentTableData.forEach((r) => {
            if (r !== row && r.Ticker.endsWith("KRW") && (r.Upbit_Symbol === pureBase || getPureBase(r.Symbol) === pureBase)) {
              calcKimchi(r);
            }
          });
        }
      }
    }

    /*
    if (
      (row.Ticker === store.currentSelectedSymbol ||
       row.UID === store.currentSelectedSymbol) &&
      typeof window.updateHeaderDisplay === "function"
    ) {
      const p = store.getPrecision(row.Ticker);
      window.updateHeaderDisplay(row, undefined, p);
    }
    */

    // 🚀 [신규] 지표 우선순위 동기화 실행
    syncRowPrioritizedMetrics(row);

    // 🚀 레이더 스냅샷 갱신 시 Trace 기록 트리거 (1번 행일 경우)
    if (typeof window.traceMetricCall === "function") {
      const firstRow = document.querySelector('#coin-list-body > div[data-index="0"]');
      if (firstRow && firstRow.dataset.sym === row.Ticker) {
        window.traceMetricCall("Kimch");
        window.traceMetricCall("Mcap");
        window.traceMetricCall("VMC");
        window.traceMetricCall("Funding");
      }
    }

    dataUpdated = true;
  });
}, 3000);

// 🔍 [디버그 콘솔 헬퍼 엔진]
// window.debugSellnance = {
//   enabled: false,
//   targetTicker: null,

//   enable(ticker = null) {
//     this.enabled = true;
//     this.targetTicker = ticker ? ticker.toUpperCase() : null;
//     console.log(`%c[Sellnance Debug] 🟢 실시간 디버그 모드 활성화 (타겟: ${ticker || "전체"})`, "color: #10b981; font-weight: bold;");
//   },

//   disable() {
//     this.enabled = false;
//     console.log("%c[Sellnance Debug] 🔴 실시간 디버그 모드 비활성화", "color: #ef4444; font-weight: bold;");
//   },

//   status() {
//     console.group("📊 [Sellnance Engine Current Status]");
//     console.log("선택된 코인:", store.currentSelectedSymbol);
//     console.log("화면 노출(Intersection):", Array.from(store.intersectingSymbols || []));
//     console.log("실시간 구독 대상(Visible):", Array.from(store.visibleSymbols || []));
//     console.log("활성 바이낸스 서브 채널:", Array.from(store.activeSubs || []));
//     console.groupEnd();
//   }
// };
