// _main.js
import { store, CONFIG, tfSec, measureDOM } from "./_store.js";
import { loadSymbols } from "./chart_api.js";
import {
  searchSymbols,
  clearSearch,
  selectSymbol,
  updateExchangeBadges,
  switchViewMode,
} from "./ui_control.js";
import { fetchHistory, clearChartData } from "./chart_data.js";
import { initChart } from "./chart.js";
import { initSniperSocket } from "./stream_table.js";
import { initMeasureEvents } from "./chart_measure.js";
import { initDrawingEvents, initDrawingToolbar } from "./chart_draw.js";
import { getMultiplier } from "./chart_utils.js";
import "./chart_layout.js";
import "./sim_engine.js";
import "./stream.js";
import "./table.js";
import "./start.js";
import { initOrderbookDOM } from "./orderbook.js";
import "./quickview.js";

window.store = store;

// 🚀 Vite 모듈 환경에서 인라인 이벤트 처리용 함수 노출
window.searchSymbols = searchSymbols;
window.clearSearch = clearSearch;
window.selectSymbol = selectSymbol;

// 🚀 업비트 원화 소수점 규칙: 가격대별 자동 precision 반환
function getKrwPrecision(price) {
  if (!price || isNaN(price)) return 0;
  if (price >= 100000) return 0;
  if (price >= 10000) return 1;
  if (price >= 100) return 2;
  if (price >= 1) return 3;
  return 4;
}
window.getKrwPrecision = getKrwPrecision;

// 🚀 [역할 분리] 스트림 엔진(stream.js)의 렌더링 과부하를 막기 위해, 차트 상단 헤더 전광판 조작 전담 함수를 메인 UI 컨트롤러 영역에 선언합니다!
let headerThrottledRow = null;
let headerThrottledPrice = undefined;
let headerThrottledP = 0;
let headerThrottledRealtime = false;
let headerThrottledCaller = "UNKNOWN";
let headerThrottleTimeout = null;

const realUpdateHeaderDisplay = (row, newPrice, p, isRealtimeStream = false, callerId = "UNKNOWN") => {
  const headChg24h = document.getElementById("head-chg-24h");
  const headChgDay = document.getElementById("head-chg-day");
  const headMcap = document.getElementById("head-mcap");
  const headVolB = document.getElementById("head-vol-binance");
  const headVolU = document.getElementById("head-vol-upbit");

  const headCallerEl = document.getElementById("head-caller-id");
  if (headCallerEl) {
    headCallerEl.innerText = ` [${callerId}]`;
  }
  const headCaller24hEl = document.getElementById("head-caller-id-24h");
  if (headCaller24hEl) {
    headCaller24hEl.innerText = ` [${callerId}]`;
  }
  const headCallerPriceEl = document.getElementById("head-caller-id-price");
  if (headCallerPriceEl) {
    headCallerPriceEl.innerText = ` [${callerId}]`;
  }

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";

  const activeMarket = (store.currentTab === "quickview" || store.currentTab === "quickview-container")
    ? (store.qvMarket || "ALL")
    : (store.currentChartMarket || "ALL");

  const isFuturesMode = activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES";
  const isSpotMode = activeMarket === "SPOT" || activeMarket === "BYBIT";

  // 🚀 선택된 심볼 기준의 최종 대상 배수 (예: 1000SHIB인 경우 1000)
  const storeMult = getMultiplier(row.Symbol || row.Ticker);

  // 국내/해외의 현재 모드별 배수 획득
  const activeOvsTicker = isFuturesMode ? row.Exact_Futures : row.Exact_Spot;
  const ovsMult = getMultiplier(activeOvsTicker || row.Symbol);
  const domMult = getMultiplier(row.Upbit_Symbol || row.Symbol);

  let binanceP = null;
  let bybitP = null;
  let upbitP = row.Upbit_Price || row.Price_KRW || null;
  let bithumbP = row.Bithumb_Price || row.Price_KRW || null;

  if (isFuturesMode) {
    binanceP = row.Binance_Price_Futures ?? row.Price_Raw ?? null;
    bybitP = row.Bybit_Price_Futures ?? row.Price_Raw ?? null;
  } else if (isSpotMode) {
    binanceP = row.Binance_Price_Spot ?? row.Price_Raw ?? null;
    bybitP = row.Bybit_Price_Spot ?? row.Price_Raw ?? null;
  } else {
    // ALL, KIMCHI, NEW 등 기본 탭 모드일 때 독점 우선순위 (선물 -> 현물)
    const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

    if (hasFutures) {
      binanceP = row.Binance_Price_Futures ?? row.Price_Raw ?? null;
      bybitP = row.Bybit_Price_Futures ?? row.Price_Raw ?? null;
    } else if (hasSpot) {
      binanceP = row.Binance_Price_Spot ?? row.Price_Raw ?? null;
      bybitP = row.Bybit_Price_Spot ?? row.Price_Raw ?? null;
    } else {
      binanceP = row.Price_Raw ?? null;
      bybitP = row.Price_Raw ?? null;
    }
  }

  if (newPrice !== undefined && newPrice !== null) {
    if (activeMarket === "UPBIT") {
      upbitP = newPrice;
      row.Upbit_Price = newPrice;
      row.Price_KRW = newPrice;
      /* [대표 지표 교차 오염 방지를 위해 프론트엔드 전광판의 가격/변동률 직접 덮어쓰기 연산 주석 처리]
      const openKrw = row.utc0_open_KRW ? parseFloat(row.utc0_open_KRW) : 0;
      if (openKrw > 0) {
        const todayKrw = ((newPrice - openKrw) / openKrw) * 100;
        row.Change_Today_Upbit = todayKrw;
        row.Change_Today_Raw = todayKrw;
        if (rate > 0) row.Price_Raw = newPrice / rate;
      }
      */
    } else if (activeMarket === "BITHUMB") {
      /* [빗썸 모드 ALL 탭 지향에 따른 대표가 개입 차단 및 주석 처리]
      bithumbP = newPrice;
      row.Bithumb_Price = newPrice;
      */
    } else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES") {
      /* [바이비트 모드 ALL 탭 지향에 따른 대표가 개입 차단 및 주석 처리]
      bybitP = newPrice;
      */
    } else {
      binanceP = newPrice;
      if (isFuturesMode) {
        row.Binance_Price_Futures = newPrice;
        /* [대표 지표 교차 오염 방지를 위해 프론트엔드 전광판의 가격/변동률 직접 덮어쓰기 연산 주석 처리]
        const openPrice = parseFloat(row.futures_utc0_open_Raw || row.utc0_open_Raw || 0);
        if (openPrice > 0) {
          const todayUsd = ((newPrice - openPrice) / openPrice) * 100;
          row.Change_Today_Futures = todayUsd;
          row.Change_Today_Raw = todayUsd;
          row.Price_Raw = newPrice;
        }
        */
      } else if (isSpotMode) {
        row.Binance_Price_Spot = newPrice;
        /* [대표 지표 교차 오염 방지를 위해 프론트엔드 전광판의 가격/변동률 직접 덮어쓰기 연산 주석 처리]
        const openPrice = parseFloat(row.spot_utc0_open_Raw || row.utc0_open_Raw || 0);
        if (openPrice > 0) {
          const todayUsd = ((newPrice - openPrice) / openPrice) * 100;
          row.Change_Today_Binance = todayUsd;
          row.Change_Today_Raw = todayUsd;
          row.Price_Raw = newPrice;
        }
        */
      }
    }
  }

  let activeExchange = "binance";
  if (activeMarket === "UPBIT") activeExchange = "upbit";
  else if (activeMarket === "BITHUMB") activeExchange = "bithumb";
  else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES") activeExchange = "bybit";

  let rawPriceForTab = 0;
  if (activeExchange === "binance") rawPriceForTab = binanceP;
  else if (activeExchange === "bybit") rawPriceForTab = bybitP;
  else if (activeExchange === "upbit") rawPriceForTab = upbitP;
  else if (activeExchange === "bithumb") rawPriceForTab = bithumbP;

  if (rawPriceForTab && typeof window.updateTabTitleManager === "function") {
    window.updateTabTitleManager(
      rawPriceForTab,
      row.Symbol || row.Ticker,
      ["upbit", "bithumb"].includes(activeExchange)
    );
  }

  // 모든 가격을 선택된 심볼의 배수 스케일(storeMult)에 맞추어 스케일링
  if (binanceP !== null) binanceP = binanceP / ovsMult * storeMult;
  if (bybitP !== null) bybitP = bybitP / ovsMult * storeMult;
  if (upbitP !== null) upbitP = upbitP / domMult * storeMult;
  if (bithumbP !== null) bithumbP = bithumbP / domMult * storeMult;

  const pNormalized = p;

  let displayPrice = 0;
  let subPrice = null;
  const isMainKrw = isKrwMode || (activeExchange === "upbit" || activeExchange === "bithumb");

  if (activeExchange === "binance") {
    const rawP = binanceP || 0;
    const actualKrw = upbitP || bithumbP || null;
    if (isMainKrw) {
      displayPrice = actualKrw || (rawP * rate);
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = actualKrw || (rawP * rate);
    }
  } else if (activeExchange === "bybit") {
    const rawP = bybitP || 0;
    const actualKrw = upbitP || bithumbP || null;
    if (isMainKrw) {
      displayPrice = actualKrw || (rawP * rate);
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = actualKrw || (rawP * rate);
    }
  } else if (activeExchange === "upbit") {
    const rawP = upbitP || 0;
    const actualUsd = binanceP || bybitP || null;
    if (isMainKrw) {
      displayPrice = rawP;
      subPrice = actualUsd || (rate > 0 ? rawP / rate : null);
    } else {
      displayPrice = actualUsd || (rate > 0 ? rawP / rate : 0);
      subPrice = rawP;
    }
  } else if (activeExchange === "bithumb") {
    const rawP = bithumbP || 0;
    const actualUsd = binanceP || bybitP || null;
    if (isMainKrw) {
      displayPrice = rawP;
      subPrice = actualUsd || (rate > 0 ? rawP / rate : null);
    } else {
      displayPrice = actualUsd || (rate > 0 ? rawP / rate : 0);
      subPrice = rawP;
    }
  }

  const topEl = document.getElementById("head-price-main");
  const bottomEl = document.getElementById("head-price-sub");

  if (topEl) {
    if (isMainKrw) {
      const krwP = getKrwPrecision(displayPrice);
      topEl.innerText = `${Number(displayPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} 원`;
    } else {
      topEl.innerText = window.formatSmartPrice(displayPrice, pNormalized);
    }
  }
  if (bottomEl) {
    if (subPrice !== null && subPrice > 0) {
      if (isMainKrw) {
        bottomEl.innerText = `$ ${window.formatSmartPrice(subPrice, pNormalized)}`;
      } else {
        const krwP = getKrwPrecision(subPrice);
        bottomEl.innerText = `${Number(subPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} ₩`;
      }
      bottomEl.classList.remove("hidden");
    } else {
      bottomEl.classList.add("hidden");
    }
  }

  // 🚀 최종 대표 등락률(Raw) 값을 다이렉트로 매핑하여 좌측 테이블과 우측 전광판의 싱크를 완전히 일치시킵니다.
  let n24 = 0;
  let nDay = 0;

  if (activeMarket === "UPBIT") {
    n24 = row.Change_24h_Upbit ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Upbit ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "BITHUMB") {
    n24 = row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES") {
    n24 = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Futures ?? row.Change_Today_Raw ?? 0;
  } else if (activeMarket === "SPOT" || activeMarket === "BYBIT") {
    n24 = (activeMarket === "SPOT" ? row.Change_24h_Binance : row.Change_24h_Bybit) ?? row.Change_24h_Raw ?? 0;
    nDay = (activeMarket === "SPOT" ? row.Change_Today_Binance : row.Change_Today_Bybit) ?? row.Change_Today_Raw ?? 0;
  } else {
    // ALL, KIMCHI, NEW 등 기본 탭 모드에서의 우선순위 분기
    const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");
    if (hasFutures) {
      n24 = row.Change_24h_Futures_Ex ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Futures ?? row.Change_Today_Raw ?? 0;
    } else if (hasSpot) {
      n24 = row.Change_24h_Binance ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Binance ?? row.Change_Today_Raw ?? 0;
    } else {
      n24 = row.Change_24h_Upbit ?? row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
      nDay = row.Change_Today_Upbit ?? row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
    }
  }

  if (headChg24h) {
    const c24 =
      n24 > 0
        ? "text-theme-up"
        : n24 < 0
          ? "text-theme-down"
          : "text-theme-text";
    headChg24h.className = `text-[12px] md:text-[13px] font-tempTestDss mt-0.5 ${c24}`;
    headChg24h.innerText = `${n24 > 0 ? "+" : ""}${Number(n24).toFixed(2)}%`;
  }
  if (headChgDay) {
    const cDay =
      nDay > 0
        ? "text-theme-up"
        : nDay < 0
          ? "text-theme-down"
          : "text-theme-text";
    headChgDay.className = `text-[12px] md:text-[13px] font-tempTestDss mt-0.5 ${cDay}`;
    headChgDay.innerText = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;
  }

  // 🚀 [수정 이동] 가격과 등락폭은 agg(실시간 차트 체결) 및 실시간 스트림을 통해 항상 갱신하고,
  // 볼륨 및 시총 등 기타 지표만 조기 리턴(return)하여 보존합니다.
  if (newPrice !== undefined || isRealtimeStream) {
    return;
  }

  // 🚀 실시간 마켓캡 계산 및 출력
  let displayMcap = row.MarketCap_Formatted || "-";
  if (row.Price_Raw > 0 && row.MarketCap_Raw > 0) {
    if (!row._CirculatingSupply) {
      row._CirculatingSupply = row.MarketCap_Raw / row.Price_Raw;
    }
    const liveMcap = row.Price_Raw * row._CirculatingSupply;
    if (liveMcap >= 1e9) displayMcap = (liveMcap / 1e9).toFixed(2) + " B";
    else if (liveMcap >= 1e6) displayMcap = (liveMcap / 1e6).toFixed(2) + " M";
    else if (liveMcap >= 1e3) displayMcap = (liveMcap / 1e3).toFixed(2) + " K";
    else displayMcap = liveMcap.toFixed(2);
  }

  if (headMcap) headMcap.innerText = displayMcap;
  if (headVolB) headVolB.innerText = row.Volume_Formatted || "-";
  if (headVolU) headVolU.innerText = row.Upbit_Vol_Formatted || "-";
};

if (!window.headerThrottleMap) {
  window.headerThrottleMap = new Map();
}

window.updateHeaderDisplay = (row, newPrice, p, isRealtimeStream = false) => {
  if (!row || !row.Ticker) return;
  const tKey = row.Ticker;

  // Capture caller from stack trace before setTimeout
  let autoCaller = "UNKNOWN";
  if (store.traceRowCaller) {
    const err = new Error();
    const stack = err.stack || "";
    if (stack.includes("stream.js") || stack.includes("stream-") || stack.includes("updateStatus") || isRealtimeStream === true || isRealtimeStream === "STREAM") {
      autoCaller = "1 (Stream)";
    } else if (stack.includes("chart_utils.js") || stack.includes("chart_utils") || stack.includes("table_render")) {
      autoCaller = "2 (Chart)";
    } else if (stack.includes("ui_control") || stack.includes("table_filter") || stack.includes("main")) {
      autoCaller = "3 (UI/Filter)";
    } else {
      if (isRealtimeStream === true || isRealtimeStream === "STREAM") {
        autoCaller = "1 (Stream)";
      } else if (newPrice !== undefined && newPrice !== null) {
        autoCaller = "2 (Chart)";
      } else {
        autoCaller = "3 (UI/Filter)";
      }
    }
  } else {
    // 🚀 [렉 차단] 디버그가 꺼진 경우 스택 연산 없이 매개변수 기반 초고속 추론
    if (isRealtimeStream === true || isRealtimeStream === "STREAM") {
      autoCaller = "1 (Stream)";
    } else if (newPrice !== undefined && newPrice !== null) {
      autoCaller = "2 (Chart)";
    } else {
      autoCaller = "3 (UI/Filter)";
    }
  }

  // Ticker별로 덮어쓰지 않고 격리하여 데이터 보관
  const existing = window.headerThrottleMap.get(tKey) || {};
  window.headerThrottleMap.set(tKey, {
    row: row,
    price: newPrice !== undefined ? newPrice : existing.price,
    p: p,
    isRealtimeStream: isRealtimeStream,
    caller: autoCaller
  });

  if (!headerThrottleTimeout) {
    headerThrottleTimeout = setTimeout(() => {
      headerThrottleTimeout = null;
      // 대기했던 Ticker별 격리된 요청들을 꼬임 없이 각각 업데이트
      window.headerThrottleMap.forEach((state) => {
        realUpdateHeaderDisplay(
          state.row,
          state.price,
          state.p,
          state.isRealtimeStream,
          state.caller
        );
      });
      window.headerThrottleMap.clear();
    }, 100); // 100ms 쓰로틀 가동
  }
};

// 🚀 엔진 시동 파트
// 🚀 사용자의 테마, 사이드바, 테이블 뷰 모드 설정을 로컬 저장소로부터 복원하는 함수
function restoreSavedUserSettings() {
  try {
    // 1. 테마 복원
    const savedTheme = localStorage.getItem("sellnance_theme");
    if (savedTheme === "upbit") {
      const body = document.body;
      body.classList.remove("theme-binance");
      body.classList.add("theme-upbit");
      store.currentTheme = "upbit";

      const btn = document.getElementById("theme-toggle-btn");
      if (btn) btn.innerHTML = "🌙";
      const faviconLink = document.getElementById("favicon-link");
      if (faviconLink) faviconLink.href = "../static/luma-deer-svg-light.svg";
      const mainLogoImg = document.getElementById("main-logo-img");
      if (mainLogoImg) mainLogoImg.src = "../static/luma-deer-svg-light.svg";
    }

    // 2. 사이드바 폴딩 상태 복원
    const isSidebarCollapsed = localStorage.getItem("sellnance_sidebar_collapsed") === "true";
    if (isSidebarCollapsed) {
      store.isSidebarOpen = false;
      const leftPanel = document.getElementById("left-panel");
      if (leftPanel) {
        leftPanel.classList.remove("md:flex");
        leftPanel.classList.add("md:hidden");
      }
      const toggleText = document.getElementById("sidebar-toggle-text");
      if (toggleText) toggleText.innerText = "▶ 펼치기";
    }

    // 3. 차트 헤더 폴딩 상태 복원
    const isHeaderCollapsed = localStorage.getItem("sellnance_header_collapsed") === "true";
    if (isHeaderCollapsed) {
      const assetRow = document.getElementById("head-asset-row");
      const infoRow = document.getElementById("head-info-row");
      const badgesRow = document.getElementById("head-badges-row");
      const btn = document.getElementById("toggle-header-top-btn");

      const elements = [assetRow, infoRow, badgesRow];
      elements.forEach((el) => {
        if (el) {
          el.style.display = "none";
          el.classList.add("hidden");
        }
      });
      if (btn) btn.innerText = "▼ 헤더 펼치기";
    }

    // 4. 좌우 패널 스왑 상태 복원
    const isPanelSwapped = localStorage.getItem("sellnance_panel_swapped") === "true";
    if (isPanelSwapped) {
      const container = document.getElementById("panel-split-container");
      if (container) {
        container.classList.remove("md:flex-row");
        container.classList.add("md:flex-row-reverse");
      }
    }

    // 5. 테이블 상세/간편 뷰 모드 복원 (모바일은 강제로 simple 모드 적용)
    // const isMobile = window.innerWidth < 1200;
    // const savedViewMode = isMobile ? "simple" : (localStorage.getItem("sellnance_table_view_mode") || "basic");
    switchViewMode(savedViewMode);
  } catch (e) {
    // Xconsole.error("Failed to restore user settings:", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Xconsole.log("🏁 대시보드 엔진 가동 시작...");
  restoreSavedUserSettings();
  if (typeof initOrderbookDOM === "function") initOrderbookDOM();

  try {
    // 1️⃣ [데이터 로드] 마켓 구성 정보 + 실제 테이블 장부를 '순서대로' 가져온다
    await loadSymbols(); // 코인 맵핑 정보 로드
    // Xconsole.log("✅ 1-A. 마켓 맵 로드 완료");

    if (typeof loadTableData === "function") {
      // 🚨 핵심: 실시간 시세가 기록될 '진짜 장부'가 채워질 때까지 기다립니다.
      await loadTableData();
      // Xconsole.log("✅ 1-B. 실시간 시세 장부(currentTableData) 입고 완료");
    }

    // 2️⃣ [엔진 준비] 이제 장부가 확실히 있으니 차트를 그리고 엔진을 점화한다
    if (store.currentTableData && store.currentTableData.length > 0) {
      initMeasureEvents();
      initDrawingEvents();
      initDrawingToolbar();
      initInfiniteScroll();
      // 🚀 [추가] 리팩토링된 6대 거래소 전용 실시간 피드 파이프라인 점화!!!
      if (typeof window.initAllExchangeFeeds === "function") {
        window.initAllExchangeFeeds();
      }

      // 🚀 [수정] 최초 선택을 기다리지 않고 차트 엔진 및 스나이퍼 소켓 즉시 점화!!!
      store.isEngineStarted = true;
      if (typeof window.initChart === "function") window.initChart();
      else if (typeof initChart === "function") initChart();
      initSniperSocket();

      // 🚀 [신규] 브라우저 로컬 타이머 루프 구동 (서버 부하 0%)
      window.updateStatusBadge = () => {
        const timerEl = document.getElementById("status-timer");
        const usersEl = document.getElementById("status-users");
        if (!timerEl || !usersEl) return;

        // 1. 접속자 수 동기화
        const users = store.activeUsers || 1;
        usersEl.innerText = `${users} Active`;

        // 2. 이원화 쿨타임 동기화 (유저 키: 15분, 사장님 키: 24시간)
        if (!store.lastUpdatedRaw) {
          timerEl.innerText = "--:--:-- 이후 시가총액 갱신";
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        const hasKey = localStorage.getItem("CMC_API_KEY") && localStorage.getItem("CMC_API_KEY").trim() !== "";
        const interval = hasKey ? 900 : 86400; // 유저 15분, 사장님 24시간
        const nextUpdate = Math.floor(store.lastUpdatedRaw) + interval;
        let diff = Math.floor(nextUpdate - now);

        if (diff < 0) {
          timerEl.innerText = hasKey ? "수집 완료 대기 중..." : "일일 수집 대기 중...";
          return;
        }

        if (hasKey) {
          // 15분 카운트다운 (MM:SS)
          const m = Math.floor(diff / 60);
          const s = diff % 60;
          const formattedTime = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
          timerEl.innerText = `${formattedTime} 이후 시가총액 갱신`;
          timerEl.title = "";
          timerEl.style.cursor = "default";
        } else {
          // 24시간 카운트다운 (HH:MM:SS) + 경고(이모지) 및 도움말 툴팁 추가
          const h = Math.floor(diff / 3600);
          const m = Math.floor((diff % 3600) / 60);
          const s = diff % 60;
          const formattedTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
          timerEl.innerText = `⚠️ ${formattedTime} (일일캐시)`;
          timerEl.title = "📢 [일일 캐시 모드 안내]\n" +
            "개인 CMC API 키를 입력하지 않았어요\n" +
            "하루에 한 번 수집하는 일일 캐시 모드로 동작 중입니다.\n" +
            "더 잦은 실시간 시총 갱신을 원하시면 설정을 통해 개인 키를 등록해 주세요.";
          timerEl.style.cursor = "help";
        }
      };

      // 🚀 [신규] 1초마다 성능 디버거 통계 수치 갱신 및 렉 위험 요인 동적 분석
      window.updatePerformanceDebugger = () => {
        if (!store.bypassCounters) return;
        const total = Object.values(store.bypassCounters).reduce((a, b) => a + b, 0);

        const totalEl = document.getElementById("perf-total-bypass");
        if (totalEl) totalEl.innerText = `Total: ${total}`;

        // 각 개별 항목 갱신
        const keys = ["leftDom", "tabScroll", "tableUpdate", "kimchi", "radarBatch", "mouseEvent", "dynamicHtml", "throttleBypass", "throttlePass"];
        keys.forEach(k => {
          const el = document.getElementById(`bypass-cnt-${k}`);
          if (el) el.textContent = store.bypassCounters[k] || 0;
        });

        // 🚨 어떤 녀석이 가장 큰 위험요소(가장 많은 빠꾸 횟수를 유도하는 병목 지점)인지 1위 도출
        const riskEl = document.getElementById("perf-top-risk-analysis");
        if (riskEl) {
          let maxVal = -1;
          let maxKey = "NONE";
          Object.entries(store.bypassCounters).forEach(([k, v]) => {
            if (v > maxVal) {
              maxVal = v;
              maxKey = k;
            }
          });

          if (maxVal === 0) {
            riskEl.innerText = "안정 (소켓 수급 정체 혹은 렉 유발 없음)";
            riskEl.className = "text-[8.5px] font-semibold text-emerald-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans";
          } else {
            const labelMap = {
              leftDom: "좌측 테이블 DOM 최적화 차단",
              chartDom: "우측 차트 렌더러 지연 차단",
              orderbook: "실시간 호가창 렌더링 락",
              legend: "상단 가격 레전드 문자열 덮어쓰기",
              resize: "차트 리사이즈 오버헤드",
              mouseEvent: "차트 십자선 마우스 이벤트 지연",
              sort: "테이블 실시간 순위 재배치 루프",
              tabScroll: "테이블 전체 리렌더링 리플로우",
              tableUpdate: "개별 행 셀 텍스트 갱신 과부하",
              kimchi: "3초 주기 김프 연산 전파 루프",
              radarBatch: "3초 레이더 일괄 갱신 차단",
              dynamicHtml: "김프 전파 HTML 동적 렌더링 과부하",
            };
            riskEl.innerText = `⚠️ ${labelMap[maxKey] || maxKey} (${maxVal}회 Bypass)`;
            riskEl.className = "text-[8.5px] font-semibold text-rose-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans";
          }
        }
      };

      let perfIntervalId = null;
      let perfDebugStartTime = null;

      window.startPerformanceDebugger = () => {
        if (perfIntervalId) clearInterval(perfIntervalId);
        perfDebugStartTime = Date.now();
        // 디버그 활성 시 카운터들을 깨끗하게 초기화하여 이전 누적치 왜곡 방지
        if (store.bypassCounters) {
          Object.keys(store.bypassCounters).forEach(k => {
            store.bypassCounters[k] = 0;
          });
        }

        // 시간 표시기 초기화
        const timeEl = document.getElementById("perf-run-time-display");
        if (timeEl) timeEl.innerText = "(0s 경과)";

        window.updatePerformanceDebugger();
        perfIntervalId = setInterval(() => {
          // 경과 시간 렌더링
          if (perfDebugStartTime) {
            const elapsed = Math.floor((Date.now() - perfDebugStartTime) / 1000);
            const timeDisplay = document.getElementById("perf-run-time-display");
            if (timeDisplay) timeDisplay.innerText = `(${elapsed}s 경과)`;
          }
          window.updatePerformanceDebugger();
        }, 1000);
      };

      window.stopPerformanceDebugger = () => {
        if (perfIntervalId) {
          clearInterval(perfIntervalId);
          perfIntervalId = null;
        }
      };

      // 기본적으로 시작 (초기 패널 표시 상태에 맞춰 기동)
      window.startPerformanceDebugger();

      // 1초마다 브라우저에서 직접 카운트다운 연산 수행
      setInterval(window.updateStatusBadge, 1000);

      // Xconsole.log("✅ 2. 테이블 실시간 시세 및 차트/스나이퍼 소켓 점화 완료!");
    } else {
      // 🚀 [수정] 성급하게 에러 던지지 말고 재시도 유도
      // Xconsole.warn("⚠️ 장부가 아직 비어있습니다. 수집 완료를 기다리는 중...");
      const loadingText = document.querySelector("#loading-modal h2");
      if (loadingText)
        loadingText.innerText = "데이터 수집 완료 대기 중 (5초 후 재시도)...";

      setTimeout(() => {
        // Xconsole.log("🔄 데이터 수집 완료 재확인 시도...");
        location.reload();
      }, 5000);
      return;
    }

    // 4️⃣ [UI 이벤트] 슬라이더 및 버튼 반응 설정
    setupSliderEvents();
    setupButtonEvents();
    setupSearchNavigation();

    // 🚀 [추가] 초기 필터 UI 상태 동기화 (3단 토글 슬라이더 위치 등)
    if (typeof switchFilter === "function") {
      switchFilter(store.filterMode);
    }

    // 🚀 [신규] 초기 로드 완료 시 주소창 해시 기반 자동 렌더링 (쌀먹 최적화)
    if (window.location.hash && window.location.hash.length > 1) {
      const hashTicker = window.location.hash.substring(1);
      if (typeof window.selectSymbol === "function") {
        window.selectSymbol(hashTicker);
      }
    } else {
      // 🚀 [UX 복원] 해시가 없는 경우 마지막 선택 코인 및 타임프레임 자동 복원
      try {
        const lastSymbol = localStorage.getItem("sellnance_last_symbol");
        const lastTF = localStorage.getItem("sellnance_last_tf");

        // 타임프레임 먼저 복원 (selectSymbol이 fetchHistory를 호출하기 전에 TF를 세팅해야 정확한 봉 데이터 요청)
        if (lastTF && typeof window.executeSetTF === "function") {
          store.currentTF = lastTF; // store만 바꾸고 fetchHistory는 아직 미실행
        }

        // 코인 복원 (차트 + 우측 패널 전체를 마지막 상태로 자동 복원)
        if (lastSymbol && typeof window.selectSymbol === "function") {
          window.selectSymbol(lastSymbol);
        }
      } catch (e) {
        // 로컬 캐시 복원 실패 시 조용히 무시 (폴백: 기본 화면 유지)
      }
    }

    // 🚀 브라우저 뒤로가기/앞으로가기 대응 (해시 변경 감지)
    window.addEventListener("hashchange", () => {
      if (window.location.hash && window.location.hash.length > 1) {
        const hashTicker = window.location.hash.substring(1);
        if (typeof window.selectSymbol === "function") {
          window.selectSymbol(hashTicker);
        }
      }
    });
  } catch (err) {
    // Xconsole.error("🚨 시동 실패:", err);
    // 보험: 2초 뒤 자동 새로고침 시도
    // setTimeout(() => location.reload(), 2000);
  }
});

// 💡 슬라이더 로직 (가독성을 위해 분리)
function setupSliderEvents() {
  ["body", "top", "bottom"].forEach((id) => {
    const inputEl = document.getElementById("input-" + id);
    if (inputEl) {
      inputEl.oninput = () => {
        const val = inputEl.value;
        document.getElementById("val-" + id).innerText = val + "%";
        if (id === "body") {
          if (store.curDir === "bull") store.bullBody = val;
          else store.bearBody = val;
        }
        if (typeof window.updateStatus === "function") window.updateStatus();
        if (store.isHover && typeof window.updatePreview === "function")
          window.updatePreview();
      };
    }
  });
}

// 💡 버튼 호버 로직
function setupButtonEvents() {
  const genBtn = document.getElementById("btn-generate");
  if (genBtn) {
    genBtn.onmouseenter = () => {
      store.isHover = true;
      if (typeof window.updatePreview === "function") window.updatePreview();
    };
    genBtn.onmouseleave = () => {
      store.isHover = false;
      if (store.previewSeries) store.previewSeries.setData([]);
    };
  }

  // 🚀 flip-toggle (경주마 애니메이션) UI 바인딩
  const flipToggle = document.getElementById("flip-toggle");
  if (flipToggle) {
    store.useFlip = flipToggle.checked;
    flipToggle.addEventListener("change", (e) => {
      store.useFlip = e.target.checked;
      // Xconsole.log("Flip animation status changed:", store.useFlip);
    });
  }
}

// 💡 검색창 내 방향키 위/아래 이동 및 엔터 선택 로직 (눈에 보이는 절대 인덱스 기준 완전 동기화)
function setupSearchNavigation() {
  const symbolInput = document.getElementById("symbol-input");
  if (!symbolInput) return;

  let activeIndex = -1;

  // 인덱스 리셋 함수
  const resetActiveIndex = () => {
    activeIndex = -1;
    const resDiv = document.getElementById("search-results");
    if (resDiv) {
      const items = Array.from(resDiv.children);
      updateHighlight(items, -1);
    }
  };

  symbolInput.addEventListener("input", () => {
    // 검색어가 바뀔 때만 리셋하되 하이라이트를 즉각 해제
    activeIndex = -1;
  });

  symbolInput.addEventListener("keydown", (e) => {
    const resDiv = document.getElementById("search-results");
    if (!resDiv || resDiv.style.display === "none") return;

    // 실시간으로 렌더링된 자식 노드(절대 순서)를 매번 새로 수집
    const items = Array.from(resDiv.children).filter(
      (item) => item.style.display !== "none"
    );
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateHighlight(items, activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateHighlight(items, activeIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].click();
      } else if (items.length > 0) {
        items[0].click(); // 포커스가 없더라도 첫번째 보이는 절대 1위 아이템 선택
      }
      resetActiveIndex();
    } else if (e.key === "Escape") {
      resDiv.style.display = "none";
      resetActiveIndex();
    }
  });

  function updateHighlight(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
        item.style.color = "#0ecb81"; // 포커스 대상 글자색 강조
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.style.backgroundColor = "";
        item.style.color = "";
      }
    });
  }
}

// ⚙️ 시간 변환 통합 헬퍼 (전역으로 이동!)
// 이제 initChart와 startRealtimeCandle 양쪽에서 모두 사용 가능합니다.

// 🚀 검색창 바깥 클릭 시 닫기
document.addEventListener("click", (e) => {
  const searchResults = document.getElementById("search-results");
  const symbolInput = document.getElementById("symbol-input");

  // 입력창이나 결과창 내부를 클릭한 게 아니라면 숨김 처리
  if (
    searchResults &&
    symbolInput &&
    !symbolInput.contains(e.target) &&
    !searchResults.contains(e.target)
  ) {
    searchResults.style.display = "none";
  }
});

// 🚀 탭 활성화 감지 (Sleep -> Wake Up 스턴 방어)
// let tabHiddenTime = 0;
// document.addEventListener("visibilitychange", () => {
//   if (document.visibilityState === "hidden") {
//     tabHiddenTime = Date.now();
//     store.isTabHidden = true;
//   } else if (document.visibilityState === "visible") {
//     // Xconsole.log("☀️ 탭 활성화: 절전 모드 해제 및 데이터 클렌징");
//     store.isRestoringTab = true;
//     store.isTabHidden = false;

//     // 1. 잠든 사이 폭주해서 쌓인 찌꺼기 버퍼 즉시 소각
//     for (let key in store.tickerBuffer) delete store.tickerBuffer[key];

//     // 2. 🚀 백그라운드 동안 누락된 차트 봉 데이터를 채우기 위해 히스토리 API만 동기화
//     // (소켓은 유지되므로 소켓 재연결은 건너뛰고 최신 캔들 동기화만 수행)
//     const hiddenDuration = Date.now() - tabHiddenTime;
//     if (tabHiddenTime > 0 && hiddenDuration > 5000) {
//       // Xconsole.log("🔄 백그라운드 복귀: 차트 히스토리 실시간 동기화");
//       if (store.currentAsset && typeof fetchHistory === "function") {
//         fetchHistory(store.currentAsset, false, true)
//           .then(() => {
//             store.isRestoringTab = false;
//           })
//           .catch(() => {
//             store.isRestoringTab = false;
//           });
//       } else {
//         store.isRestoringTab = false;
//       }
//     } else {
//       store.isRestoringTab = false;
//     }
//     tabHiddenTime = 0;
//   }
// });

// 🚀 정렬 순서 퀵 서칭 탐색 및 타임프레임 변경 엔진 (방향키 이벤트)
document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT") return;

  const up = e.key === "ArrowUp";
  const down = e.key === "ArrowDown";
  const left = e.key === "ArrowLeft";
  const right = e.key === "ArrowRight";

  // 💡 1. 좌우 방향키: 타임프레임(TF) 퀵 스위칭
  if (left || right) {
    e.preventDefault();
    const tfArray = (store.visibleTfs && store.visibleTfs.length > 0)
      ? store.visibleTfs
      : [
        "1m",
        "3m",
        "5m",
        "15m",
        "30m",
        "1h",
        "2h",
        "4h",
        "12h",
        "1d",
        "3d",
        "1w",
        "1M",
      ];
    let idx = tfArray.indexOf(store.currentTF);
    if (left && idx > 0 && typeof window.setTF === "function")
      window.setTF(tfArray[idx - 1]);
    else if (
      right &&
      idx < tfArray.length - 1 &&
      typeof window.setTF === "function"
    )
      window.setTF(tfArray[idx + 1]);
    return;
  }

  // 💡 2. 상하 방향키: 테이블 리스트 탐색 (논리적 정렬 데이터 절대 인덱스 기준 이동)
  if (up || down) {
    e.preventDefault();

    // 1. 현재 필터/정렬 상태가 반영된 전체 논리 데이터 목록 수집
    let sortedList = [];
    if (typeof window.getFilteredData === "function") {
      sortedList = window.getFilteredData();
    } else {
      sortedList = store.currentTableData || [];
    }

    if (sortedList.length === 0) return;

    // 2. 현재 선택된 심볼이 논리 리스트의 몇 번째 인덱스에 있는지 탐색
    let currentIdx = sortedList.findIndex(
      (item) => item.Ticker === store.currentSelectedSymbol
    );

    let nextCoin = null;

    if (currentIdx === -1) {
      // 선택된 코인이 없으면 리스트 맨 처음 코인 선택
      nextCoin = sortedList[0];
    } else {
      let targetIdx = up ? currentIdx - 1 : currentIdx + 1;

      // 아래 방향키로 이동 시 렌더 한계점 자동 조절
      if (down && targetIdx >= store.currentRenderLimit) {
        store.currentRenderLimit = Math.min(
          sortedList.length,
          store.currentRenderLimit + 15
        );
        if (typeof window.renderTable === "function") window.renderTable();
        else if (typeof renderTable === "function") renderTable();
      }

      // 인덱스 범위 한계 도달 체크 및 보정
      if (targetIdx >= 0 && targetIdx < sortedList.length) {
        nextCoin = sortedList[targetIdx];
      }
    }

    if (nextCoin) {
      store.currentSelectedSymbol = nextCoin.Ticker;
      selectSymbol(nextCoin.Ticker, null, nextCoin.UID);

      // 🚀 가상 스크롤로 포커싱 코인이 화면 밖으로 탈출할 때 자동 스크롤 동기화
      setTimeout(() => {
        const targetRow = document.querySelector(
          `#coin-list-body .coin-row[data-sym="${nextCoin.Ticker}"]`
        );
        if (targetRow) {
          targetRow.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
        if (typeof window.applySelectedHighlight === "function") {
          window.applySelectedHighlight();
        } else if (typeof applySelectedHighlight === "function") {
          applySelectedHighlight();
        }
      }, 30);
      return;
    }
  }
});

// 🚀 [추가] 차트 우측 패널 상단부 접고 펼치는 기능
window.toggleHeaderTop = function () {
  const assetRow = document.getElementById("head-asset-row");
  const infoRow = document.getElementById("head-info-row");
  const badgesRow = document.getElementById("head-badges-row");
  const btn = document.getElementById("toggle-header-top-btn");

  if (btn) {
    const isHidden = btn.innerText.includes("펼치기");
    const elements = [assetRow, infoRow, badgesRow];
    const topZone = document.getElementById("chart-top-zone");

    if (isHidden) {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "";
          el.classList.remove("hidden");
        }
      });
      btn.innerText = "▲ 헤더 접기";
      localStorage.setItem("sellnance_header_collapsed", "false");
      if (topZone) {
        topZone.style.height = "224px";
        topZone.style.maxHeight = "224px";
      }
    } else {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "none";
          el.classList.add("hidden");
        }
      });
      btn.innerText = "▼ 헤더 펼치기";
      localStorage.setItem("sellnance_header_collapsed", "true");
      if (topZone) {
        topZone.style.height = "";
        topZone.style.maxHeight = "";
      }
    }
    if (typeof window.resetChartScale === "function") {
      window.resetChartScale();
    } else if (typeof resetChartScale === "function") {
      resetChartScale();
    }
  }
};

// 🚀 [신규] 프론트엔드 정밀 타이머 리셋 (매일 오전 9시 정각 00분 00초 000밀리초 KST 무지연 덮어쓰기)
function scheduleDailyReset() {
  const now = new Date();
  const nextReset = new Date();

  // UTC 기준 자정 (KST 오전 9시 0분 0초 000밀리초)
  // 단 1밀리초의 지연도 없이 경주마(펌핑 코인) 등락률을 잡기 위해 00초 정각으로 세팅
  nextReset.setUTCHours(0, 0, 0, 0);

  if (now > nextReset) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  const timeUntilReset = nextReset.getTime() - now.getTime();
  // Xconsole.log(`⏰ 다음 9시 정각(KST) 무지연 일일 리셋까지 ${(timeUntilReset / 1000 / 3600).toFixed(2)}시간 남았습니다.`);

  setTimeout(() => {
    // Xconsole.log("🚨 09:00:00.000 KST 정각! 프론트엔드 무지연 0% 리셋 발동!");

    // 1. [무지연 덮어쓰기] 백엔드를 기다리지 않고, 프론트가 들고 있는 현재 웹소켓 가격을 즉시 '오늘의 시가'로 확정!
    if (store.currentTableData && Array.isArray(store.currentTableData)) {
      store.currentTableData.forEach(row => {
        if (row.Price_Raw) {
          row.utc0_open_Raw = row.Price_Raw; // 9시 정각 가격을 시가로 덮어쓰기
          row.Change_Today_Raw = 0; // 등락률 즉각 0% 리셋
        }
      });
      // 화면 즉시 리렌더링 (0% 리셋 적용)
      if (typeof window.renderTable === "function") window.renderTable();
    }

    // 2. 현재 열려있는 차트 전광판 가격도 최신화
    if (store.currentAsset && typeof window.selectSymbol === "function") {
      window.selectSymbol(store.currentAsset);
    }

    // 3. [백그라운드 사후 동기화] 2초 뒤에 백엔드를 조용히 찔러서, 거래소의 공식 데이터와 장부를 완벽하게 일치시킴
    setTimeout(() => {
      // Xconsole.log("🔄 09:00:02 KST 백그라운드 서버 동기화 진행");
      if (typeof window.loadTableData === "function") {
        window.loadTableData(true, true); // force=true, silent=true 로 로딩 마스크 없이 동기화
      }
    }, 2000);

    // 4. 내일 9시를 위해 다시 스케줄링
    scheduleDailyReset();
  }, timeUntilReset);
}

// 타이머 최초 가동
scheduleDailyReset();

// 📱 PWA Service Worker 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/static/sw.js")
      .then((reg) => console.log("✅ PWA SW registered:", reg.scope))
      .catch((err) => console.warn("PWA SW registration failed:", err));
  });
}
