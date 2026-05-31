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
import { initMeasureEvents } from "./chart_measure.js";
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
window.updateHeaderDisplay = (row, newPrice, p) => {
  const headChg24h = document.getElementById("head-chg-24h");
  const headChgDay = document.getElementById("head-chg-day");
  const headMcap = document.getElementById("head-mcap");
  const headVolB = document.getElementById("head-vol-binance");
  const headVolU = document.getElementById("head-vol-upbit");

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";

  // 🚀 [추가] 퀵뷰 전용 마켓을 기준으로 현물/선물 데이터 선택
  const isQvFutures =
    store.qvMarket === "FUTURES" || store.qvMarket === "BYBIT_FUTURES";
  const isQvSpot = store.qvMarket === "SPOT";

  let binanceP = row.Binance_Price || null;
  if (isQvFutures && row.Binance_Price_Futures !== undefined)
    binanceP = row.Binance_Price_Futures;
  else if (isQvSpot && row.Binance_Price_Spot !== undefined)
    binanceP = row.Binance_Price_Spot;

  let bybitP = row.Bybit_Price || null;
  if (isQvFutures && row.Bybit_Price_Futures !== undefined)
    bybitP = row.Bybit_Price_Futures;
  else if (isQvSpot && row.Bybit_Price_Spot !== undefined)
    bybitP = row.Bybit_Price_Spot;

  // Upbit/Bithumb: row.Upbit_Price가 0이거나 없으면 Price_KRW를 fallback으로 사용
  let upbitP = row.Upbit_Price || row.Price_KRW || null;
  let bithumbP = row.Bithumb_Price || null;

  if (newPrice !== undefined) {
    // 🚀 currentMarket(뱃지 클릭)을 1순위로 라우팅 → qvMarket은 퀵뷰 전용이라 뱃지 클릭과 무관
    if (store.currentMarket === "UPBIT") {
      upbitP = newPrice;
    } else if (store.currentMarket === "BITHUMB") {
      bithumbP = newPrice;
    } else if (
      store.currentMarket === "BYBIT" ||
      store.currentMarket === "BYBIT_FUTURES"
    ) {
      bybitP = newPrice;
    } else if (
      store.currentMarket === "FUTURES" ||
      store.currentMarket === "SPOT"
    ) {
      binanceP = newPrice;
    } else if (store.qvMarket === "UPBIT") {
      upbitP = newPrice;
    } else if (store.qvMarket === "BITHUMB") {
      bithumbP = newPrice;
    } else if (
      store.qvMarket === "BYBIT" ||
      store.qvMarket === "BYBIT_FUTURES"
    ) {
      bybitP = newPrice;
    } else {
      binanceP = newPrice;
    }
  }

  // 🚀 [핵심] qvMarket(뱃지 선택)을 1순위로 해당 거래소 div를 강제 활성화
  //  → KRW 모드면 해당 거래소 원화가 상단(크게), USD가 하단(작게)
  //  → USD 모드면 해당 거래소 달러가 상단(크게), 원화가 하단(작게)
  let activeExchange = "";
  let displayPrice = 0;
  let subPrice = null;

  const marketToEx = {
    UPBIT: "upbit",
    BITHUMB: "bithumb",
    FUTURES: "binance",
    SPOT: "binance",
    BYBIT: "bybit",
    BYBIT_FUTURES: "bybit",
  };
  // 뱃지 클릭 시 selectSymbol → store.currentMarket을 업데이트하므로 이걸 우선 사용
  const forcedEx = store.currentMarket ? marketToEx[store.currentMarket] : null;

  if (!isKrwMode) {
    // ── USD 모드 ──────────────────────────────────────────────
    if (forcedEx === "upbit" && upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = upbitP / rate;
      subPrice = upbitP; // 하단: 원화
    } else if (forcedEx === "bithumb" && bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = bithumbP / rate;
      subPrice = bithumbP; // 하단: 원화
    } else if (forcedEx === "bybit" && bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = bybitP;
      subPrice = bybitP * rate;
    } else if (binanceP !== null) {
      activeExchange = "binance";
      displayPrice = binanceP;
      subPrice = binanceP * rate;
    } else if (bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = bybitP;
      subPrice = bybitP * rate;
    } else if (upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = upbitP / rate;
      subPrice = upbitP;
    } else if (bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = bithumbP / rate;
      subPrice = bithumbP;
    } else {
      activeExchange = "binance";
      displayPrice = row.Price_Raw || 0;
      subPrice = displayPrice * rate;
    }
  } else {
    // ── KRW 모드 ──────────────────────────────────────────────
    if (forcedEx === "upbit" && upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = upbitP; // 상단: 원화 크게
      subPrice = rate > 0 ? upbitP / rate : null; // 하단: USD 작게
    } else if (forcedEx === "bithumb" && bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = bithumbP;
      subPrice = rate > 0 ? bithumbP / rate : null;
    } else if (forcedEx === "binance" && binanceP !== null) {
      activeExchange = "binance";
      displayPrice = rate > 0 ? binanceP * rate : 0; // 상단: 원화 환산
      subPrice = binanceP; // 하단: USD 작게
    } else if (forcedEx === "bybit" && bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = rate > 0 ? bybitP * rate : 0;
      subPrice = bybitP;
    } else if (upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = upbitP;
      subPrice = rate > 0 ? upbitP / rate : null;
    } else if (bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = bithumbP;
      subPrice = rate > 0 ? bithumbP / rate : null;
    } else if (binanceP !== null) {
      activeExchange = "binance";
      displayPrice = rate > 0 ? binanceP * rate : 0;
      subPrice = binanceP;
    } else if (bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = rate > 0 ? bybitP * rate : 0;
      subPrice = bybitP;
    } else {
      activeExchange = "upbit";
      displayPrice = row.Price_KRW || 0;
      subPrice = rate > 0 ? displayPrice / rate : null;
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
    headChg24h.className = `text-[12px] md:text-[13px] font-mono mt-0.5 ${c24}`;
    headChg24h.innerText = `${n24 > 0 ? "+" : ""}${Number(n24).toFixed(2)}%`;
  }
  if (headChgDay) {
    const cDay =
      nDay > 0
        ? "text-theme-up"
        : nDay < 0
          ? "text-theme-down"
          : "text-theme-text";
    headChgDay.className = `text-[12px] md:text-[13px] font-mono mt-0.5 ${cDay}`;
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
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🏁 대시보드 엔진 가동 시작...");
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

    // 2️⃣ [엔진 준비] 이제 장부가 확실히 있으니 차트를 그린다
    if (store.currentTableData && store.currentTableData.length > 0) {
      initMeasureEvents();
      initInfiniteScroll();
      // 🚀 [추가] 사령관님 요청: 서버 시작 시 테이블 코인들의 실시간 등락 움직임(Market Radar)은 즉시 점화!!!
      if (typeof window.startBinanceMarketRadar === "function")
        window.startBinanceMarketRadar();
      if (typeof window.startUpbitMarketRadar === "function")
        window.startUpbitMarketRadar();

      console.log(
        "✅ 2. 테이블 실시간 시세 점화 완료! (차트 및 스나이퍼 소켓은 사용자 최초 선택 시 점화 대기 중...)",
      );
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

  // 🚀 countdown-toggle 초기 상태 동기화
  const countdownToggle = document.getElementById("toggle-countdown");
  if (countdownToggle && typeof window.toggleCountdown === "function") {
    window.toggleCountdown(countdownToggle.checked);
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
      `#table-body tr[data-sym="${store.currentSelectedSymbol}"]`
    );

    let nextRow = null;

    if (!activeRow) {
      // 선택된 행이 없으면 화면에 노출된 첫 번째 비숨김 행 선택
      const firstRow = document.querySelector("#table-body tr");
      if (firstRow) {
        nextRow = firstRow;
        while (nextRow && (nextRow.style.display === "none" || nextRow.classList.contains("hidden"))) {
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
          (item) => item.Ticker === store.currentSelectedSymbol
        );
        if (currentIndex !== -1 && currentIndex + 1 < sortedList.length) {
          store.currentRenderLimit = Math.min(sortedList.length, store.currentRenderLimit + 15);
          if (typeof window.renderTable === "function") window.renderTable();
          else if (typeof renderTable === "function") renderTable();
        }
      }

      // 현재 선택된 행 기준 위/아래로 이동하며 화면에 표시된 다음 행 탐색
      let temp = activeRow;
      do {
        temp = up ? temp.previousElementSibling : temp.nextElementSibling;
      } while (temp && (temp.style.display === "none" || temp.classList.contains("hidden")));
      nextRow = temp;
    }

    if (!nextRow) return;

    const nextSym = nextRow.getAttribute("data-sym");
    if (!nextSym) return;

    const nextCoin = (store.originalTableData || store.currentTableData || []).find(
      (c) => c.Ticker === nextSym
    );

    if (nextCoin) {
      store.currentSelectedSymbol = nextCoin.Ticker;
      selectSymbol(nextCoin.DisplayTicker);

      // 🚀 [해결] DOM 구조와 선택 상태 맵핑이 완벽히 수립된 50ms 뒤에 scroll 및 highlight 처리
      setTimeout(() => {
        const targetRow = document.querySelector(
          `#table-body tr[data-sym="${nextCoin.Ticker}"]`
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
window.toggleHeaderTop = function() {
  const row = document.getElementById("head-asset-row");
  const btn = document.getElementById("toggle-header-top-btn");
  if (row && btn) {
    const isHidden = row.classList.contains("hidden") || row.style.display === "none";
    if (isHidden) {
      row.style.display = "";
      row.classList.remove("hidden");
      btn.innerText = "▲ 헤더 접기";
    } else {
      row.style.display = "none";
      row.classList.add("hidden");
      btn.innerText = "▼ 헤더 펼치기";
    }
    if (typeof window.resetChartScale === "function") {
      window.resetChartScale();
    } else if (typeof resetChartScale === "function") {
      resetChartScale();
    }
  }
};

