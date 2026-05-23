// streamEach.js
import { store, CONFIG, tfSec } from "./_store.js";
import {
  getMultiplier,
  getPureBase,
  formatSmartPrice,
  updateTabTitleManager,
  getUnixSeconds,
} from "./chart_utils.js";

// 🎯 개별 스트림 스나이퍼 소켓 초기화 (바이낸스 + 업비트 상시 멀티 파이프라인 가동)
function initSniperSocket() {
  // 1. 바이낸스 복합 스트림 가동 (선물/현물 동적 분기)
  if (!store.sniperWs || store.sniperWs.readyState !== WebSocket.OPEN) {
    // 🚀 [버그 픽스] 현물 코인 스나이핑 시 선물 웹소켓을 쏴서 가격이 어긋나거나 수신되지 않던 문제 완벽 해결!
    const wsUrl = store.currentMarket === "FUTURES"
      ? "wss://fstream.binance.com/market/ws"
      : "wss://stream.binance.com:9443/ws";
      
    store.sniperWs = new WebSocket(wsUrl);
    store.sniperWs.onopen = () => {
      console.log("🎯 바이낸스 스나이퍼 엔진 가동: 보이는 놈들 정밀 타격 시작");
      syncSniperSubscriptions();
    };
    // 🚀 [돌파구 4 적용: O(1) 디스패치 맵 전환]
    const SNIPER_ROUTER = {
      "24hrTicker": renderSniperPrice,
      aggTrade: renderSniperPrice,
    };
    store.sniperWs.onmessage = (e) => {
      const data = JSON.parse(e.data);
      SNIPER_ROUTER[data.e]?.(data); // 🚀 if문 0줄, 다이렉트 직렬 실행!
    };
    store.sniperWs.onclose = () => {
      setTimeout(initSniperSocket, CONFIG.UI_UPDATE_INTERVAL);
    };
  }

  // 2. 업비트 전용 테이블 스나이퍼 스트림 가동
  if (
    !store.upbitSniperWs ||
    store.upbitSniperWs.readyState !== WebSocket.OPEN
  ) {
    store.upbitSniperWs = new WebSocket("wss://api.upbit.com/websocket/v1");
    store.upbitSniperWs.onopen = () => {
      console.log("🎯 업비트 스나이퍼 엔진 가동: 김치 코인들 정밀 타격 시작");
      syncSniperSubscriptions();
    };
    /*
    store.upbitSniperWs.onmessage = async (e) => {
      const text = typeof e.data === "string" ? e.data : await e.data.text();
      const res = JSON.parse(text);
      if (!res.code || !res.trade_price) return;

      const pureSym = res.code.replace("KRW-", "");
      const krwTicker = pureSym + "KRW"; // 테이블의 업비트 코인 Ticker 표기법 (예: BTCKRW)
      const newPriceKrw = parseFloat(res.trade_price);

      // 🚀 1. 장부(row) 즉시 동기화 및 환율 계산 반영 (1억 원이 1억 달러로 인식되어 순위 널뛰는 대참사 원천 차단!)
      const allSource = store.originalTableData || store.currentTableData || [];
      const row = allSource.find(
        (r) => r.Ticker === krwTicker || r.Symbol === pureSym,
      );

      if (row) {
        const rate = store.marketDataMap?.krw_usd_rate || 0;
        row.Price_KRW = newPriceKrw;
        row.Price_Raw = newPriceKrw / rate; // 달러 환산 가격으로 정확히 기입

        if (res.signed_change_rate !== undefined) {
          row.Change_24h_Raw = parseFloat(res.signed_change_rate) * 100;
        }

        if (row.utc0_open_Raw) {
          const openPrice = parseFloat(row.utc0_open_Raw);
          if (openPrice > 0) {
            row.Change_Today_Raw =
              ((row.Price_Raw - openPrice) / openPrice) * 100;
          }
        }
      }

      // 🚀 2. renderRealtimeRow가 정확히 인식할 수 있도록 krwTicker(BTCKRW) 및 등락률(P)까지 정규화하여 전달
      const normalizedData = {
        e: "aggTrade",
        s: krwTicker, // 기존 BTCUSDT 대신 BTCKRW로 전달하여 stream.js가 정확한 원화 행을 타격하도록 보정
        p: newPriceKrw.toString(),
        q: (res.trade_volume || 0).toString(),
        P:
          res.signed_change_rate !== undefined
            ? (res.signed_change_rate * 100).toString()
            : undefined,
        E: res.timestamp,
        isUpbitRealtime: true, // 업비트 고유 플래그
      };
      renderSniperPrice(normalizedData);
    };
    */
    store.upbitSniperWs.onclose = () => {
      setTimeout(initSniperSocket, CONFIG.UI_UPDATE_INTERVAL);
    };
  }
}

// 🔄 [핵심] visibleSymbols와 연동하여 바이낸스/업비트 구독 리스트 동시 동기화
function syncSniperSubscriptions() {
  if (!store.visibleSymbols) return;
  const getNextId = () => Math.floor(Date.now() + Math.random() * 1000);

  const currentVisibleBinance = [];
  const currentVisibleUpbit = [];
  const allSource = store.originalTableData || store.currentTableData || [];

  store.visibleSymbols.forEach((sym) => {
    const row = allSource.find(
      (r) => r.Ticker === sym || r.DisplayTicker === sym || r.Symbol === sym,
    );
    if (!row) return;

    // 1. 바이낸스 구독 타겟 추출
    let bTicker =
      row.Exact_Futures ||
      (row.Ticker && !row.Ticker.endsWith("KRW")
        ? row.Ticker.replace("USDT", "")
        : null);
    if (!bTicker && row.Exact_Spot) bTicker = row.Exact_Spot;
    if (bTicker) {
      currentVisibleBinance.push(`${bTicker.toLowerCase()}usdt@aggTrade`);
    }

    // 2. 업비트 구독 타겟 추출 (KRW 마켓 또는 Upbit_Symbol 존재 시)
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

  // --- 바이낸스 소켓 구독 갱신 ---
  if (store.sniperWs && store.sniperWs.readyState === WebSocket.OPEN) {
    const toSub = currentVisibleBinance.filter((s) => !store.activeSubs.has(s));
    if (toSub.length > 0) {
      store.sniperWs.send(
        JSON.stringify({ method: "SUBSCRIBE", params: toSub, id: getNextId() }),
      );
      toSub.forEach((s) => store.activeSubs.add(s));
    }
    const toUnsub = Array.from(store.activeSubs).filter(
      (s) => !currentVisibleBinance.includes(s),
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

  // --- 업비트 소켓 구독 갱신 ---
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

// let lastProcessedTime = 0; // 전역 또는 상위에 선언

// function renderSniperPrice(data) {
//   // 🚀 [추가] 이벤트 타임(E) 비교로 최신 데이터만 처리 (병렬/고속 수신 방어)
//   if (data.E <= lastProcessedTime) return;
//   lastProcessedTime = data.E;

//   const symbol = data.s.replace("USDT", "");
//   const priceCell = document.getElementById(`price-${symbol}`);
//   if (!priceCell) return;

//   const row = currentTableData.find(r => r.Symbol === symbol);
//   if (!row) return;
//   const p = row.precision || 2;

//   // 🚀 aggTrade에서는 가격이 'p' 필드에 담겨 옵니다. (ticker는 'c')
//   const newPrice = parseFloat(data.p);
//   const oldPrice = parseFloat((priceCell.innerText || "").replace(/[^0-9.-]+/g, "")) || 0;

//   if (newPrice !== oldPrice) {
//     priceCell.innerText = `${formatSmartPrice(newPrice, p)}`;
//     applyPriceFlash(priceCell, newPrice, oldPrice);

//     // 🚀 [등락률 계산] aggTrade는 등락률을 안 주므로 시가(utc0_open_Raw) 기준으로 직접 계산
//     const todayCell = document.getElementById(`today-${symbol}`);
//     if (todayCell && row.utc0_open_Raw) {
//       const openPrice = parseFloat(row.utc0_open_Raw);
//       const todayChange = ((newPrice - openPrice) / openPrice) * 100;
//       const tThemeClass = todayChange > 0 ? "text-theme-up" : todayChange < 0 ? "text-theme-down" : "text-theme-text opacity-50";
//       todayCell.innerHTML = `<span class="${tThemeClass} font-bold">${todayChange > 0 ? "+" : ""}${todayChange.toFixed(2)}%</span>`;
//     }
//   }
// }

// ⚡ 정밀 렌더링 시작하기
function renderSniperPrice(data) {
  if (typeof window.renderRealtimeRow === "function") {
    window.renderRealtimeRow(data.s, data);
  }
}

// 🚀 모든 뷰 변화의 종착역
function refreshSniperTarget() {
  if (typeof updateVisibleSymbols === "function") updateVisibleSymbols();
  if (typeof syncSniperSubscriptions === "function") syncSniperSubscriptions();
}

// 🚀 실시간 김프 1초컷 업데이트 엔진 (모든 마켓 공통 적용)
function updateRealtimeKimchi(liveData, symbol, chartTime) {
  if (!store.kimchiSeries || !store.paneConfig.kimchi) return;

  // 1. 순수 법정 환율만 참조 (테더 프리미엄 오용 원천 배제)
  const rate = store.marketDataMap?.krw_usd_rate || 0;
  if (rate === 0) return;

  const pureSymbol = getPureBase(symbol);
  const isKor = ["UPBIT", "BITHUMB"].includes(store.currentMarket);
  const row = store.currentTableData.find((c) => c.Symbol === pureSymbol);

  // 2. 글로벌/국내의 1개 단위 순수 가격(Unit Price) 구하기
  let unitKorPrice = null;
  let unitGlbPrice = null;

  if (isKor) {
    // A. 현재 마켓이 한국 거래소 (메인 차트가 한국 시세)
    const mainMulti = getMultiplier(symbol);
    unitKorPrice = liveData.close / mainMulti;

    let glbSym = row && row.Exact_Spot ? row.Exact_Spot : pureSymbol;
    if (store.currentMarket === "FUTURES" && row && row.Exact_Futures) {
      glbSym = row.Exact_Futures;
    }
    let glbPrice = null;
    const hasBinance = row?.Listed_Exchanges?.some((ex) => ex.includes("BINANCE"));
    if (hasBinance) {
      glbPrice = store.tickerBuffer[`${glbSym}USDT`]?.c;
    }
    if (!glbPrice && row && row.Price_Raw) {
      glbPrice = row.Price_Raw; 
    } else if (glbPrice) {
      glbPrice = parseFloat(glbPrice) / getMultiplier(glbSym);
    }
    unitGlbPrice = glbPrice;
  } else {
    // B. 현재 마켓이 글로벌 거래소 (메인 차트가 글로벌 시세)
    const mainMulti = getMultiplier(symbol);
    unitGlbPrice = liveData.close / mainMulti;

    let korSym = row && row.Upbit_Symbol ? row.Upbit_Symbol : pureSymbol;
    let korPrice = store.tickerBuffer[`KRW-${korSym}`]?.c;
    if (!korPrice) korPrice = store.tickerBuffer[`${pureSymbol}_KRW`]?.c;
    if (!korPrice && row && row.Price_KRW) {
      korPrice = row.Price_KRW;
    } else if (korPrice) {
      korPrice = parseFloat(korPrice) / getMultiplier(korSym);
    }
    unitKorPrice = korPrice;
  }

  // 🚀 [원인 완벽 규명 및 해결: 빗썸 김프 증발 방어 코드]
  // 실시간 소켓 갱신 중 일시적으로 비교군 가격이 null이 되거나 체결가가 0이라고 해서,
  // 기존 vol-pane 캔버스에 예쁘게 렌더링되어 있던 수백 개의 김프 데이터를 통째로 소각해버리던 끔찍한 버그 전면 제거!
  // 코인 변경 시 초기화는 이미 chart_data.js가 전담하므로, 여기서는 조용히 return만 하여 기존 김프 라인을 100% 완벽하게 유지합니다!
  if (!unitKorPrice || !unitGlbPrice || liveData.close <= 0) {
    return;
  }

  const isTimeValid = (() => {
    if (chartTime === undefined || chartTime === null) return false;
    if (typeof chartTime === "number") {
      return !isNaN(chartTime) && chartTime > 0;
    }
    if (typeof chartTime === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(chartTime)) return true;
      const num = Number(chartTime);
      if (!isNaN(num) && num > 0) return true;
      const parsed = Date.parse(chartTime.includes("T") ? chartTime : chartTime + "T00:00:00Z");
      return !isNaN(parsed);
    }
    return false;
  })();

  // 🚀 [완벽 방어벽] chartTime 유효성 및 kimchiPct 정상 수치 여부를 철저히 검증하고 try-catch로 감싸서 어떤 예외도 밖으로 새어나가지 못하게 차단!
  if (isTimeValid) {
    const kimchiPct = (unitKorPrice / (unitGlbPrice * rate) - 1) * 100;

    if (isFinite(kimchiPct) && kimchiPct >= -50 && kimchiPct <= 100) {
      const kimchiObj = {
        time: chartTime,
        value: kimchiPct,
        color:
          typeof window.getKimchiColor === "function"
            ? window.getKimchiColor(kimchiPct)
            : "#57a4fc",
      };
      try {
        store.kimchiSeries.update(kimchiObj);
        if (store.kimchiData && store.kimchiData.length > 0) {
          store.kimchiData[store.kimchiData.length - 1] = kimchiObj;
        }
      } catch (e) {}
    }
  }
}

export function startRealtimeCandle(
  symbol,
  interval,
  isFutures,
  isSpot,
  isUpbit,
  isBithumb,
) {

  // 🚀 [궁극의 정밀 하이브리드] 00초 마감/생성은 kline 독점, 봉 내부 파닥거림은 aggTrade 전담!
  const aggStream = `${symbol.toLowerCase()}usdt@aggTrade`;
  const klineStream = `${symbol.toLowerCase()}usdt@kline_${interval}`;
  const wsBase = isFutures
    ? "wss://fstream.binance.com/market/ws"
    : "wss://stream.binance.com:9443/ws";

  if (
    (isFutures || isSpot) &&
    store.currentKlineStream === `${aggStream}/${klineStream}` &&
    store.binanceChartWs &&
    store.binanceChartWs.readyState === WebSocket.OPEN
  )
    return;

  const getWsId = () => Math.floor(Date.now() + Math.random() * 1000);

  // 🚀 [수정] 고정 변수 삭제 (실시간 메시지 수신 시점에 동적으로 참조하여 테마 즉각 연동)

  let realtimeUpdatePending = false;
  let latestActiveCandle = null;
  let latestSymbol = null;
  let latestServerMs = null;

  const broadcastCandleUpdate = (activeCandle, symbol, serverMs) => {
    latestActiveCandle = activeCandle;
    latestSymbol = symbol;
    latestServerMs = serverMs;

    if (realtimeUpdatePending) return;
    realtimeUpdatePending = true;

    requestAnimationFrame(() => {
      realtimeUpdatePending = false;
      
      // 🚀 [완벽 방어] 탭/타임프레임 전환 시 큐에 남아있던 망령(잔상 웹소켓 렌더) 원천 차단!
      // 차트를 새로 로딩 중일 때, 이전 타임프레임의 로직으로 억지로 업데이트를 시도하여 스케일이 박살나는 치명적 크래시(Value is null)를 방어합니다.
      if (store.isFetchingChart || window.isFetchingChart) return;

      const currentCandle = latestActiveCandle;
      const currentSymbol = latestSymbol;
      const currentServerMs = latestServerMs;
      if (!currentCandle) return;

      const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
      const chartTime = isDayUnit
        ? (() => {
            if (
              typeof currentCandle.time === "string" &&
              currentCandle.time.includes("-")
            )
              return currentCandle.time;
            const numTime = Number(currentCandle.time);
            if (isNaN(numTime)) return currentCandle.time;
            const dt = new Date(numTime * 1000);
            return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
          })()
        : (() => {
            if (
              typeof currentCandle.time === "string" &&
              currentCandle.time.includes("-")
            ) {
              const parsedUnix = Math.floor(
                new Date(currentCandle.time).getTime() / 1000,
              );
              return isNaN(parsedUnix) ? currentCandle.time : parsedUnix;
            }
            return currentCandle.time;
          })();

      const isTimeValid = (() => {
        if (chartTime === undefined || chartTime === null) return false;
        if (typeof chartTime === "number") {
          return !isNaN(chartTime) && chartTime > 0;
        }
        if (typeof chartTime === "string") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(chartTime)) return true;
          const num = Number(chartTime);
          if (!isNaN(num) && num > 0) return true;
          const parsed = Date.parse(chartTime.includes("T") ? chartTime : chartTime + "T00:00:00Z");
          return !isNaN(parsed);
        }
        return false;
      })();

      const isValidCandle = 
        currentCandle &&
        isTimeValid &&
        !isNaN(Number(currentCandle.open)) && currentCandle.open !== null &&
        !isNaN(Number(currentCandle.high)) && currentCandle.high !== null &&
        !isNaN(Number(currentCandle.low)) && currentCandle.low !== null &&
        !isNaN(Number(currentCandle.close)) && currentCandle.close !== null;

      if (store.candleSeries && isValidCandle) {
        try {
          store.candleSeries.update({
            time: chartTime,
            open: Number(currentCandle.open),
            high: Number(currentCandle.high),
            low: Number(currentCandle.low),
            close: Number(currentCandle.close),
            volume: Number(currentCandle.volume) || 0
          });
          if (store.leftScaleSeries) {
            store.leftScaleSeries.update({
              time: chartTime,
              value: Number(currentCandle.close),
            });
          }
        } catch (candleUpdateErr) {
          console.warn("🚨 candleSeries.update 예외 우회 완료:", candleUpdateErr);
        }
        if (typeof window.updateRealtimeCountdown === "function") {
          window.updateRealtimeCountdown(currentServerMs);
        }
      }

      if (
        store.volumeSeries &&
        currentCandle.volume !== undefined &&
        isTimeValid
      ) {
        if (!store.upColorCache || !store.downColorCache) {
          const curStyle = getComputedStyle(document.body);
          store.upColorCache =
            curStyle.getPropertyValue("--up").trim() || "#26a69a";
          store.downColorCache =
            curStyle.getPropertyValue("--down").trim() || "#ef5350";
        }
        const curUpVol = store.upColorCache + "80";
        const curDownVol = store.downColorCache + "80";
        const curVolColor =
          currentCandle.close >= currentCandle.open ? curUpVol : curDownVol;

        const safeVolume = Number(currentCandle.volume) || 0;
        const volObj = {
          time: chartTime,
          value: safeVolume,
          color: curVolColor,
        };
        try {
          store.volumeSeries.update(volObj);
          if (store.volumeData && store.volumeData.length > 0) {
            const lastVolItem = store.volumeData[store.volumeData.length - 1];
            if (chartTime > lastVolItem.time) {
              store.volumeData.push(volObj);
            } else if (chartTime === lastVolItem.time) {
              store.volumeData[store.volumeData.length - 1] = volObj;
            }
          }
        } catch (e) {}
      }

      updateRealtimeKimchi(currentCandle, currentSymbol, chartTime);

      const p = store.getPrecision(store.currentSelectedSymbol || currentSymbol);
      if (typeof window.updateStatus === "function") {
        window.updateStatus(currentCandle, p);
      }

      // 🚀 [브라우저 탭 통합 치환] 소켓 중복 생성 없이 메인 소켓 가격으로 탭 제목 실시간 동기화
      updateTabTitleManager(
        currentCandle.close,
        currentSymbol,
        store.currentMarket === "UPBIT",
      );
    });
  };

  const handleBinanceMessage = (e) => {
    if (store.isFetchingChart || window.isFetchingChart) return;
    if (store.currentMarket !== "SPOT" && store.currentMarket !== "FUTURES")
      return; // 🚀 현재 마켓이 바이낸스가 아니면 메시지 패스 (소켓은 살려두되 차트 침범 원천 차단!)
    const res = JSON.parse(e.data);

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    // 🚀 [돌파구 4 적용: 차트 이벤트 O(1) 디스패치 맵 전환]
    // 기존의 복잡한 if (res.e === "aggTrade") ... else if (res.e === "kline") 문자열 비교 체인을 전면 소각하고,
    // 이벤트명을 Key로 삼아 함수를 다이렉트로 즉시 실행하는 HTS급 깔끔한 구조로 격상합니다!
    const CHART_DISPATCHER = {
      aggTrade: () => {
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const tickSymbol = res.s.replace("USDT", "").toUpperCase();
        if (tickSymbol !== symbol.toUpperCase()) return;

        const newPrice = parseFloat(res.p);
        const tradeQty = parseFloat(res.q) || 0;
        if (isNaN(newPrice)) return;

        const secondsPerBar = tfSec[store.currentTF] || 60;
        const lastCandleUnix = getUnixSeconds(lastCandle.time);
        const nextBarTime = lastCandleUnix + secondsPerBar;
        const currentUnix = Math.floor(res.E / 1000);

        if (currentUnix < nextBarTime) {
          lastCandle.close = newPrice;
          lastCandle.high = Math.max(lastCandle.high, newPrice);
          lastCandle.low = Math.min(lastCandle.low, newPrice);
          lastCandle.volume = (lastCandle.volume || 0) + tradeQty;
          activeCandle = lastCandle;
          chartUpdateNeeded = true;
        } else {
          activeCandle = {
            time: currentUnix,
            open: newPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice,
            volume: tradeQty,
          };
          store.mainData.push(activeCandle);
          chartUpdateNeeded = true;
        }
      },
      kline: () => {
        if (res.k.i !== store.currentTF) return;
        store.lastServerMs = res.E;
        store.localTimeAtUpdate = performance.now();

        const tickSymbol = res.k.s.replace("USDT", "").toUpperCase();
        if (tickSymbol !== symbol.toUpperCase()) return;

        const k = res.k;
        const kUnix = Math.floor(k.t / 1000);
        const kVol = parseFloat(k.v) || 0;

        const lastCandleUnix = getUnixSeconds(lastCandle.time);
        if (lastCandleUnix === kUnix) {
          lastCandle.open = Number(k.o);
          lastCandle.high = Math.max(lastCandle.high, Number(k.h));
          lastCandle.low = Math.min(lastCandle.low, Number(k.l));
          lastCandle.close = Number(k.c);
          lastCandle.volume = kVol;
          activeCandle = lastCandle;
        } else if (kUnix > lastCandleUnix) {
          activeCandle = {
            time: kUnix,
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: kVol,
          };
          store.mainData.push(activeCandle);
        }
        chartUpdateNeeded = true;
      },
    };

    CHART_DISPATCHER[res.e]?.();

    if (chartUpdateNeeded) {
      // 🚀 [최종 관문 이중 방어] 로직 처리 도중 탭 이동/타임프레임 변경이 감지되면 즉시 렌더링 큐 전송 취소!
      if (store.isFetchingChart || window.isFetchingChart) return;
      broadcastCandleUpdate(activeCandle, symbol, store.lastServerMs);
    }
  };

  // 🚀 [추가] 바이낸스 로직과 100% 동일한 UX(차트 갱신, 볼륨 연동, 카운트다운 등)를 제공하는 업비트 전용 실시간 웹소켓 핸들러!
  const handleUpbitMessage = async (e) => {
    if (store.isFetchingChart || window.isFetchingChart) return;
    if (store.currentMarket !== "UPBIT") return;

    const text = typeof e.data === "string" ? e.data : await e.data.text();
    const res = JSON.parse(text);
    if (!res.code) return;

    const tickSymbol = res.code.toUpperCase();
    const expectedCode = `KRW-${symbol}`.toUpperCase();
    if (tickSymbol !== expectedCode) return;

    if (!store.mainData || store.mainData.length === 0) return;
    const lastCandle = store.mainData[store.mainData.length - 1];

    const newPrice = parseFloat(res.trade_price);
    const tradeQty = parseFloat(res.trade_volume) || 0;
    if (isNaN(newPrice)) return;

    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleUnix = getUnixSeconds(lastCandle.time);
    const nextBarTime = lastCandleUnix + secondsPerBar;
    const currentUnix = Math.floor(res.timestamp / 1000);

    let activeCandle = lastCandle;
    let chartUpdateNeeded = false;

    if (currentUnix < nextBarTime) {
      lastCandle.close = newPrice;
      lastCandle.high = Math.max(lastCandle.high, newPrice);
      lastCandle.low = Math.min(lastCandle.low, newPrice);
      lastCandle.volume = (lastCandle.volume || 0) + tradeQty;
      activeCandle = lastCandle;
      chartUpdateNeeded = true;
    } else {
      activeCandle = {
        time: currentUnix,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
        volume: tradeQty,
      };
      store.mainData.push(activeCandle);
      chartUpdateNeeded = true;
    }

    if (chartUpdateNeeded) {
      // 🚀 [최종 관문 이중 방어] 로직 처리 도중 탭 이동/타임프레임 변경이 감지되면 즉시 렌더링 큐 전송 취소!
      if (store.isFetchingChart || window.isFetchingChart) return;
      broadcastCandleUpdate(activeCandle, symbol, res.timestamp);
    }
  };

  if (isFutures || isSpot) {

    if (
      !store.binanceChartWs ||
      store.binanceChartWs.readyState !== WebSocket.OPEN
    ) {
      if (store.binanceChartWs) store.binanceChartWs.close();
      store.binanceChartWs = new WebSocket(wsBase);
      store.binanceChartWs.onopen = () => {
        store.binanceChartWs.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [aggStream, klineStream],
            id: getWsId(),
          }),
        );
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      };
    } else if (store.currentKlineStream !== `${aggStream}/${klineStream}`) {
      try {
        const oldParams = store.currentKlineStream.split("/");
        store.binanceChartWs.send(
          JSON.stringify({
            method: "UNSUBSCRIBE",
            params: oldParams,
            id: getWsId(),
          }),
        );
        store.binanceChartWs.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [aggStream, klineStream],
            id: getWsId(),
          }),
        );
        store.currentKlineStream = `${aggStream}/${klineStream}`;
      } catch (e) {}
    }
    store.binanceChartWs.onmessage = handleBinanceMessage;
  } else if (isUpbit) {

    const upbitCode = `KRW-${symbol}`.toUpperCase();
    if (
      !store.upbitChartWs ||
      store.upbitChartWs.readyState !== WebSocket.OPEN
    ) {
      if (store.upbitChartWs) store.upbitChartWs.close();
      store.upbitChartWs = new WebSocket("wss://api.upbit.com/websocket/v1");
      store.upbitChartWs.onopen = () => {
        store.upbitChartWs.send(
          JSON.stringify([
            { ticket: "sellnance_chart_" + getWsId() },
            { type: "ticker", codes: [upbitCode] },
          ]),
        );
        store.currentUpbitStream = upbitCode;
      };
    } else if (store.currentUpbitStream !== upbitCode) {
      try {
        store.upbitChartWs.send(
          JSON.stringify([
            { ticket: "sellnance_chart_" + getWsId() },
            { type: "ticker", codes: [upbitCode] },
          ]),
        );
        store.currentUpbitStream = upbitCode;
      } catch (e) {}
    }
    store.upbitChartWs.onmessage = handleUpbitMessage;
  }
}

window.initSniperSocket = initSniperSocket;
window.syncSniperSubscriptions = syncSniperSubscriptions;
window.refreshSniperTarget = refreshSniperTarget;
window.startRealtimeCandle = startRealtimeCandle;
window.updateTabTitleManager = updateTabTitleManager;
