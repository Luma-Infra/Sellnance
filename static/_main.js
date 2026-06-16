// _main.js
import { store, CONFIG, tfSec, measureDOM } from "./_store.js";
import { loadSymbols } from "./chart_api.js";
import {
  searchSymbols,
  clearSearch,
  selectSymbol,
  updateExchangeBadges,
} from "./ui_control.js";
import { fetchHistory, clearChartData } from "./chart_data.js";
import { initChart } from "./chart.js";
import { initSniperSocket } from "./stream_table.js";
import { initMeasureEvents } from "./chart_measure.js";
import { initDrawingEvents, initDrawingToolbar } from "./chart_draw.js";
import "./chart_utils.js";
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

// 🚀 [역할 분리] 스트림 엔진(stream.js)의 렌더링 과부하를 막기 위해, 차트 상단 헤더 전광판 조작 전담 함수를 메인 UI 컨트롤러 영역에 선언합니다!
window.updateHeaderDisplay = (row, newPrice, p, isRealtimeStream = false) => {
  const headChg24h = document.getElementById("head-chg-24h");
  const headChgDay = document.getElementById("head-chg-day");
  const headMcap = document.getElementById("head-mcap");
  const headVolB = document.getElementById("head-vol-binance");
  const headVolU = document.getElementById("head-vol-upbit");

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";

  const activeMarket = (store.currentTab === "quickview" || store.currentTab === "quickview-container")
    ? (store.qvMarket || "ALL")
    : (store.currentMarket || "ALL");

  const isFuturesMode = activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES";
  const isSpotMode = activeMarket === "SPOT" || activeMarket === "BYBIT";

  let binanceP = null;
  if (isFuturesMode) {
    binanceP = (row.Binance_Price_Futures !== undefined && row.Binance_Price_Futures !== null)
      ? row.Binance_Price_Futures
      : null;
  } else if (isSpotMode) {
    binanceP = (row.Binance_Price_Spot !== undefined && row.Binance_Price_Spot !== null)
      ? row.Binance_Price_Spot
      : null;
  } else {
    binanceP = (row.Binance_Price_Spot !== undefined && row.Binance_Price_Spot !== null)
      ? row.Binance_Price_Spot
      : ((row.Binance_Price_Futures !== undefined && row.Binance_Price_Futures !== null)
        ? row.Binance_Price_Futures
        : row.Binance_Price || null);
  }

  let bybitP = null;
  if (isFuturesMode) {
    bybitP = (row.Bybit_Price_Futures !== undefined && row.Bybit_Price_Futures !== null)
      ? row.Bybit_Price_Futures
      : null;
  } else if (isSpotMode) {
    bybitP = (row.Bybit_Price_Spot !== undefined && row.Bybit_Price_Spot !== null)
      ? row.Bybit_Price_Spot
      : null;
  } else {
    bybitP = (row.Bybit_Price_Spot !== undefined && row.Bybit_Price_Spot !== null)
      ? row.Bybit_Price_Spot
      : ((row.Bybit_Price_Futures !== undefined && row.Bybit_Price_Futures !== null)
        ? row.Bybit_Price_Futures
        : row.Bybit_Price || null);
  }

  // Upbit/Bithumb: row.Upbit_Price가 0이거나 없으면 Price_KRW를 fallback으로 사용
  let upbitP = row.Upbit_Price || row.Price_KRW || null;
  let bithumbP = row.Bithumb_Price || null;

  if (newPrice !== undefined) {
    if (activeMarket === "UPBIT") {
      upbitP = newPrice;
    } else if (activeMarket === "BITHUMB") {
      bithumbP = newPrice;
    } else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES") {
      bybitP = newPrice;
    } else {
      binanceP = newPrice;
    }
  }

  let activeExchange = "binance";
  if (activeMarket === "UPBIT") activeExchange = "upbit";
  else if (activeMarket === "BITHUMB") activeExchange = "bithumb";
  else if (activeMarket === "BYBIT" || activeMarket === "BYBIT_FUTURES") activeExchange = "bybit";

  let displayPrice = 0;
  let subPrice = null;

  if (activeExchange === "binance") {
    const rawP = binanceP || 0;
    if (isKrwMode) {
      displayPrice = rawP * rate;
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = rawP * rate;
    }
  } else if (activeExchange === "bybit") {
    const rawP = bybitP || 0;
    if (isKrwMode) {
      displayPrice = rawP * rate;
      subPrice = rawP;
    } else {
      displayPrice = rawP;
      subPrice = rawP * rate;
    }
  } else if (activeExchange === "upbit") {
    const rawP = upbitP || 0;
    if (isKrwMode) {
      displayPrice = rawP;
      subPrice = rate > 0 ? rawP / rate : null;
    } else {
      displayPrice = rate > 0 ? rawP / rate : 0;
      subPrice = rawP;
    }
  } else if (activeExchange === "bithumb") {
    const rawP = bithumbP || 0;
    if (isKrwMode) {
      displayPrice = rawP;
      subPrice = rate > 0 ? rawP / rate : null;
    } else {
      displayPrice = rate > 0 ? rawP / rate : 0;
      subPrice = rawP;
    }
  }

  const exchanges = ["binance", "bybit", "upbit", "bithumb"];
  exchanges.forEach((ex) => {
    const container = document.getElementById(`head-price-${ex}`);
    if (!container) return;

    if (ex === activeExchange) {
      const topEl = container.querySelector("b");
      const bottomEl = container.querySelector("span");

      if (topEl) {
        if (isKrwMode) {
          const krwP = getKrwPrecision(displayPrice);
          topEl.innerText = `${Number(displayPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} 원`;
        } else {
          topEl.innerText = window.formatSmartPrice(displayPrice, p);
        }
      }
      if (bottomEl) {
        if (subPrice !== null && subPrice > 0) {
          if (isKrwMode) {
            bottomEl.innerText = `$ ${window.formatSmartPrice(subPrice, p)}`;
          } else {
            const krwP = getKrwPrecision(subPrice);
            bottomEl.innerText = `${Number(subPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })} ₩`;
          }
          bottomEl.classList.remove("hidden");
        } else {
          bottomEl.classList.add("hidden");
        }
      }

      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });
  // 🚀 [수정] 가격은 agg(실시간 차트 체결) 및 실시간 스트림을 통해 갱신하고, 변동등락폭 및 기타 지표(시총/거래대금)는 테이블 데이터만 따라가도록 분리!
  // newPrice가 제공되거나 실시간 스트림 업데이트인 경우, 가격 업데이트만 완료한 뒤 조기 리턴(return)하여 나머지 지표 영역을 보존합니다.
  if (newPrice !== undefined || isRealtimeStream) {
    return;
  }

  // 🚀 activeExchange 기준으로 거래소별 변동률 선택 (UPBIT ↔ BINANCE 스위칭 시 각자 수치 표시)
  const isActiveFutures =
    store.currentMarket === "FUTURES" ||
    store.currentMarket === "BYBIT_FUTURES";
  let n24, nDay;
  if (activeExchange === "upbit") {
    n24 = row.Change_24h_Upbit ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Upbit ?? row.Change_Today_Raw ?? 0;
  } else if (activeExchange === "bithumb") {
    n24 = row.Change_24h_Bithumb ?? row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Bithumb ?? row.Change_Today_Raw ?? 0;
  } else if (activeExchange === "binance") {
    n24 =
      (isActiveFutures ? row.Change_24h_Futures_Ex : row.Change_24h_Binance) ??
      row.Change_24h_Raw ??
      0;
    nDay =
      (isActiveFutures ? row.Change_Today_Futures : row.Change_Today_Binance) ??
      row.Change_Today_Raw ??
      0;
  } else if (activeExchange === "bybit") {
    n24 =
      (isActiveFutures ? row.Change_24h_Futures_Ex : row.Change_24h_Bybit) ??
      row.Change_24h_Raw ??
      0;
    nDay =
      (isActiveFutures ? row.Change_Today_Futures : row.Change_Today_Bybit) ??
      row.Change_Today_Raw ??
      0;
  } else {
    n24 = row.Change_24h_Raw ?? 0;
    nDay = row.Change_Today_Raw ?? 0;
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
      if (faviconLink) faviconLink.href = "../static/_gemini-svg-light.svg";
      const mainLogoImg = document.getElementById("main-logo-img");
      if (mainLogoImg) mainLogoImg.src = "../static/_gemini-svg-light.svg";
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

    // 5. 테이블 상세/간편 뷰 모드 복원
    const savedViewMode = localStorage.getItem("sellnance_table_view_mode") || "basic";
    import("./ui_control.js").then(({ switchViewMode }) => {
      switchViewMode(savedViewMode);
    });
  } catch (e) {
    console.error("Failed to restore user settings:", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🏁 대시보드 엔진 가동 시작...");
  restoreSavedUserSettings();
  if (typeof initOrderbookDOM === "function") initOrderbookDOM();

  try {
    // 1️⃣ [데이터 로드] 마켓 구성 정보 + 실제 테이블 장부를 '순서대로' 가져온다
    await loadSymbols(); // 코인 맵핑 정보 로드
    console.log("✅ 1-A. 마켓 맵 로드 완료");

    if (typeof loadTableData === "function") {
      // 🚨 핵심: 실시간 시세가 기록될 '진짜 장부'가 채워질 때까지 기다립니다.
      await loadTableData();
      console.log("✅ 1-B. 실시간 시세 장부(currentTableData) 입고 완료");
    }

    // 2️⃣ [엔진 준비] 이제 장부가 확실히 있으니 차트를 그리고 엔진을 점화한다
    if (store.currentTableData && store.currentTableData.length > 0) {
      initMeasureEvents();
      initDrawingEvents();
      initDrawingToolbar();
      initInfiniteScroll();
      // 🚀 [추가] 사령관님 요청: 서버 시작 시 테이블 코인들의 실시간 등락 움직임(Market Radar)은 즉시 점화!!!
      if (typeof window.startBinanceMarketRadar === "function")
        window.startBinanceMarketRadar();
      if (typeof window.startUpbitMarketRadar === "function")
        window.startUpbitMarketRadar();

      // 🚀 [수정] 최초 선택을 기다리지 않고 차트 엔진 및 스나이퍼 소켓 즉시 점화!!!
      store.isEngineStarted = true;
      if (typeof window.initChart === "function") window.initChart();
      else if (typeof initChart === "function") initChart();
      initSniperSocket();

      console.log("✅ 2. 테이블 실시간 시세 및 차트/스나이퍼 소켓 점화 완료!");
    } else {
      // 🚀 [수정] 성급하게 에러 던지지 말고 재시도 유도
      console.warn("⚠️ 장부가 아직 비어있습니다. 수집 완료를 기다리는 중...");
      const loadingText = document.querySelector("#loading-modal h2");
      if (loadingText)
        loadingText.innerText = "데이터 수집 완료 대기 중 (5초 후 재시도)...";

      setTimeout(() => {
        console.log("🔄 데이터 수집 완료 재확인 시도...");
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
    console.error("🚨 시동 실패:", err);
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
      console.log("Flip animation status changed:", store.useFlip);
    });
  }
}

// 💡 검색창 내 방향키 위/아래 이동 및 엔터 선택 로직
function setupSearchNavigation() {
  const symbolInput = document.getElementById("symbol-input");
  if (!symbolInput) return;

  let activeIndex = -1;

  const resetActiveIndex = () => {
    activeIndex = -1;
  };

  symbolInput.addEventListener("input", resetActiveIndex);
  symbolInput.addEventListener("click", resetActiveIndex);
  symbolInput.addEventListener("focus", resetActiveIndex);

  symbolInput.addEventListener("keydown", (e) => {
    const resDiv = document.getElementById("search-results");
    if (!resDiv || resDiv.style.display === "none") return;

    const items = Array.from(resDiv.children);
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
        items[0].click();
      }
    }
  });

  function updateHighlight(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.style.backgroundColor = "";
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
let tabHiddenTime = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    tabHiddenTime = Date.now();
    store.isTabHidden = true;
  } else if (document.visibilityState === "visible") {
    console.log("☀️ 탭 활성화: 절전 모드 해제 및 데이터 클렌징");
    store.isRestoringTab = true;
    store.isTabHidden = false;

    // 1. 잠든 사이 폭주해서 쌓인 찌꺼기 버퍼 즉시 소각
    for (let key in store.tickerBuffer) delete store.tickerBuffer[key];

    // 2. 🚀 백그라운드 동안 누락된 차트 봉 데이터를 채우기 위해 히스토리 API만 동기화
    // (소켓은 유지되므로 소켓 재연결은 건너뛰고 최신 캔들 동기화만 수행)
    const hiddenDuration = Date.now() - tabHiddenTime;
    if (tabHiddenTime > 0 && hiddenDuration > 5000) {
      console.log("🔄 백그라운드 복귀: 차트 히스토리 실시간 동기화");
      if (store.currentAsset && typeof fetchHistory === "function") {
        fetchHistory(store.currentAsset, false, true); // 🚀 isTabRestore = true로 전달하여 줌 원복 방어!
      }
    }
    tabHiddenTime = 0;

    // 🚀 100ms 지연을 주어 히스토리와 실시간 스트림이 엉키지 않고 순차적으로 수립되도록 보장
    setTimeout(() => {
      store.isRestoringTab = false;
    }, 100);
  }
});

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
    const tfArray = [
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

  // 💡 2. 상하 방향키: 테이블 리스트 탐색 (화면상 보이는 HTML 행 기준 위/아래 전후진)
  if (up || down) {
    e.preventDefault();

    const activeRow = document.querySelector(
      `#coin-list-body .coin-row[data-sym="${store.currentSelectedSymbol}"]`,
    );

    let nextRow = null;

    if (!activeRow) {
      // 선택된 행이 없으면 화면에 노출된 첫 번째 비숨김 행 선택
      const firstRow = document.querySelector("#coin-list-body .coin-row");
      if (firstRow) {
        nextRow = firstRow;
        while (
          nextRow &&
          (nextRow.style.display === "none" ||
            nextRow.classList.contains("hidden"))
        ) {
          nextRow = nextRow.nextElementSibling;
        }
      }
    } else {
      // 🚀 아래 방향키로 탐색 시 마지막 렌더링 행에 도달하면 자동으로 한계치를 늘려 추가 렌더링 수행
      if (down && !activeRow.nextElementSibling) {
        let sortedList = [];
        if (typeof window.getFilteredData === "function") {
          sortedList = window.getFilteredData();
        } else {
          sortedList = store.currentTableData || [];
        }
        let currentIndex = sortedList.findIndex(
          (item) => item.Ticker === store.currentSelectedSymbol,
        );
        if (currentIndex !== -1 && currentIndex + 1 < sortedList.length) {
          store.currentRenderLimit = Math.min(
            sortedList.length,
            store.currentRenderLimit + 15,
          );
          if (typeof window.renderTable === "function") window.renderTable();
          else if (typeof renderTable === "function") renderTable();
        }
      }

      // 현재 선택된 행 기준 위/아래로 이동하며 화면에 표시된 다음 행 탐색
      let temp = activeRow;
      do {
        temp = up ? temp.previousElementSibling : temp.nextElementSibling;
      } while (
        temp &&
        (temp.style.display === "none" || temp.classList.contains("hidden"))
      );
      nextRow = temp;
    }

    if (!nextRow) return;

    const nextSym = nextRow.getAttribute("data-sym");
    if (!nextSym) return;

    const nextCoin = (
      store.originalTableData ||
      store.currentTableData ||
      []
    ).find((c) => c.Ticker === nextSym);

    if (nextCoin) {
      store.currentSelectedSymbol = nextCoin.Ticker;
      selectSymbol(nextCoin.DisplayTicker);

      // 🚀 [해결] DOM 구조와 선택 상태 맵핑이 완벽히 수립된 50ms 뒤에 scroll 및 highlight 처리
      setTimeout(() => {
        const targetRow = document.querySelector(
          `#coin-list-body .coin-row[data-sym="${nextCoin.Ticker}"]`,
        );
        if (targetRow) {
          targetRow.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
        if (typeof window.applySelectedHighlight === "function") {
          window.applySelectedHighlight();
        } else if (typeof applySelectedHighlight === "function") {
          applySelectedHighlight();
        }
      }, 50);
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

    if (isHidden) {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "";
          el.classList.remove("hidden");
        }
      });
      btn.innerText = "▲ 헤더 접기";
      localStorage.setItem("sellnance_header_collapsed", "false");
    } else {
      elements.forEach((el) => {
        if (el) {
          el.style.display = "none";
          el.classList.add("hidden");
        }
      });
      btn.innerText = "▼ 헤더 펼치기";
      localStorage.setItem("sellnance_header_collapsed", "true");
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
  console.log(`⏰ 다음 9시 정각(KST) 무지연 일일 리셋까지 ${(timeUntilReset / 1000 / 3600).toFixed(2)}시간 남았습니다.`);

  setTimeout(() => {
    console.log("🚨 09:00:00.000 KST 정각! 프론트엔드 무지연 0% 리셋 발동!");

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
      window.selectSymbol(store.currentAsset.DisplayTicker || store.currentAsset.Ticker);
    }

    // 3. [백그라운드 사후 동기화] 2초 뒤에 백엔드를 조용히 찔러서, 거래소의 공식 데이터와 장부를 완벽하게 일치시킴
    setTimeout(() => {
      console.log("🔄 09:00:02 KST 백그라운드 서버 동기화 진행");
      if (typeof window.loadTableData === "function") {
        window.loadTableData(true); // force=true로 백엔드 캐시 초기화 및 재조회
      }
    }, 2000);

    // 4. 내일 9시를 위해 다시 스케줄링
    scheduleDailyReset();
  }, timeUntilReset);
}

// 타이머 최초 가동
scheduleDailyReset();
