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

export function createRowElement(row) {
  const rowEl = document.createElement("div");
  rowEl.classList.add("coin-row");
  const ticker = row.Ticker; // 🚀 중복 없는 유니크 티커 사용 (BTCKRW != BTCUSDT)
  rowEl.dataset.sym = ticker;
  rowEl.style.position = "relative";

  updateRowInnerHTML(rowEl, row);

  if (store.tableObserver) store.tableObserver.observe(rowEl);
  return rowEl;
}

export function updateRowStaticHTML(rowEl, row) {
  // 🚀 [버그 수정] innerHTML 재작성으로 인해 기존 하위 DOM들이 파괴되므로 캐시 무효화
  rowEl._priceCell = null;
  rowEl._volBCell = null;
  rowEl._volUCell = null;
  rowEl._kimchiCell = null;
  rowEl._priceEl = null;

  const pureSymbol = row.Symbol;
  const tId = row.Ticker; // 🚀 DOM ID용 완벽한 고유키
  rowEl.dataset.sym = tId; // 🚀 화면 추적용
  rowEl.dataset.uid = row.UID; // 🚀 UID 추적용 추가

  // 🐛 [DEBUG] 데이터 침범 및 오염 추적용 로그
  if (!row.Ticker || !row.Symbol) {
    console.error(
      "[TABLE DEBUG] 🚨 비정상 데이터 유입 (Ticker/Symbol 누락)!",
      row,
    );
  }

  const favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  const favorites2 = JSON.parse(
    localStorage.getItem("sellnance_favs2") || "[]",
  );
  const uId = row.UID; // 🚀 백엔드에서 제공하는 근본 고유 식별키 (final_ucid)
  const isFav = favorites.includes(uId);
  const isFav2 = favorites2.includes(uId);

  const pendingAction =
    store.pendingFavActions && store.pendingFavActions.get(uId);
  rowEl.dataset.renderedPending = pendingAction ? "true" : "false";
  let currentFavState;
  if (pendingAction) {
    currentFavState = pendingAction.targetState;
  } else {
    currentFavState = isFav ? "FAV" : isFav2 ? "FAV2" : "NONE";
  }

  let starText = "☆";
  let starColor = "gray";
  let starClass = "";
  if (currentFavState === "FAV") {
    starText = "★";
    starColor = "#e3b30a"; // 🚀 노란색 고정 (라이트모드 파란색 오염 방어)
    starClass = "active";
  } else if (currentFavState === "FAV2") {
    starText = "★";
    starColor = "#3b82f6";
    starClass = "active-blue";
  }

  // 🚀 정적 식별 정보 레이아웃 렌더링 (순위, 즐겨찾기 별, 로고, 코인명)
  // 동적 수치 데이터 영역은 빈 Placeholder div 구조로 생성하여 레이아웃 깨짐을 방지하고 스크롤 시 공백(하얀 칸) 노출을 방어합니다.
  rowEl.innerHTML = `
  <div class="p-2 col-asset overflow-hidden">
    ${pendingAction
      ? `
      <div class="row-progress-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 2.5px; z-index: 50; pointer-events: none;">
         <div id="progress-bar-${row.Ticker}" class="row-progress-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%); transition: width 50ms linear;"></div>
      </div>
    `
      : ""
    }
    <div class="flex items-center gap-0.5 min-w-0">
      <!-- 0. 절대 순위 번호 (CSS 카운터로 1부터 800까지 순차 자동 렌더링) -->
      <div class="w-[20px] flex-shrink-0 text-center">
        <span class="row-counter text-[10px] font-tempTestDss font-medium text-theme-text opacity-40 flex-shrink-0 px-0 leading-none"></span>
      </div>
      <!-- 1. 별 버튼 -->
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <button onclick="toggleFavorite('${uId}', event)" class="star-btn text-[14px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
          ${starText}
        </button>
        ${pendingAction
      ? `
          <button onclick="window.confirmFavoriteChange('${uId}', event)" class="confirm-fav-btn text-[9px] font-medium px-1.5 py-0.5 rounded transition-all flex-shrink-0 mr-1">
            확인
          </button>
          <button onclick="window.cancelFavoriteChange('${uId}', event)" class="cancel-fav-btn text-[9px] font-medium px-1.5 py-0.5 rounded transition-all flex-shrink-0">
            취소
          </button>
        `
      : ""
    }
      </div>
      
      <!-- 2. 티커 이미지 -->
      <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/1 overflow-hidden">
        ${row.Logo || ""}
      </div>
      
      <!-- 3. 티커 & 이름 -->
      <div class="flex flex-col leading-[1.1] min-w-0 flex-1">
        <b class="text-[12px] text-theme-text truncate font-medium tracking-tighter">${row.DisplayTicker || row.Symbol}</b>
        <span class="text-[9px] text-theme-text opacity-60 truncate font-medium tracking-tighter">
          ${(() => {
      const n =
        store.lang === "KR"
          ? row.Name_KR || row.Name || ""
          : row.Name || "";
      return n.length > 8 ? n.substring(0, 8) + ".." : n;
    })()}
        </span>
      </div>
    </div>
  </div>
  <div class="p-2 col-price overflow-hidden price-placeholder text-theme-text font-medium text-[14px]">
    <div class="flex flex-col leading-tight min-w-0 gap-0.5">
      <div class="font-medium text-[14px] tracking-tighter truncate block flex items-center">-</div>
      <div class="flex items-center justify-between gap-2 text-[10px] font-medium text-left mt-0.5 w-full min-w-0 opacity-0">
        <span class="flex-1">-</span>
        <span class="flex-1">-</span>
      </div>
    </div>
  </div>
  <div class="p-2 col-vol-b overflow-hidden vol-b-placeholder text-[11px] font-bold text-theme-text">
    <div class="flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5">
      <span class="text-[11px] font-tempTestDss font-bold truncate">-</span>
      <span class="text-[10px] font-bold mt-0.5 truncate opacity-0">-</span>
    </div>
  </div>
  <div class="p-2 col-vol-u overflow-hidden vol-u-placeholder text-[11px] font-bold text-theme-text text-right">
    <div class="flex flex-col h-full justify-center items-end leading-tight min-w-0 gap-0.5 text-right w-full">
      <span class="text-[11px] font-tempTestDss font-bold truncate w-full text-right">-</span>
      <span class="text-[10px] font-bold mt-0.5 truncate w-full text-right opacity-0">-</span>
    </div>
  </div>
  <div class="p-2 col-kimch overflow-hidden kimchi-placeholder text-[12px] font-medium text-theme-text">
    <div class="flex flex-col h-full justify-center leading-tight items-start min-w-0">
      <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
        <span class="text-[12px] font-medium">-</span>
      </div>
      <div class="flex items-center justify-start gap-2 text-[10px] font-medium mt-0.5 min-w-0 max-w-full opacity-0">
        <span>-</span>
      </div>
    </div>
  </div>
  <div class="p-2 col-exch overflow-visible exch-placeholder">
    <div class="grid grid-cols-4 content-center h-full gap-[2px] w-fit text-left min-w-0 opacity-0">
      <div class="w-[14px] h-[14px]"></div>
      <div class="w-[14px] h-[14px]"></div>
      <div class="w-[14px] h-[14px]"></div>
      <div class="w-[14px] h-[14px]"></div>
      <div class="w-[14px] h-[14px]"></div>
    </div>
  </div>
  <div class="p-2 col-listing overflow-hidden listing-placeholder text-[10px]">-</div>
  `;

  rowEl.dataset.metricsRendered = "false";

  // 🚀 코인 클릭/업데이트 시 순위 번호가 증발하는 현상 원천 방지
  const counterEl = rowEl.querySelector(".row-counter");
  const targetIdx = parseInt(rowEl.dataset.index);
  if (counterEl && !isNaN(targetIdx)) {
    counterEl.textContent = targetIdx + 1;
  }

  // 🚀 정적 데이터 갱신 시 Trace 기록 트리거 (1번 행일 경우)
  if (targetIdx === 0 && typeof window.traceMetricCall === "function") {
    window.traceMetricCall("Ticker");
    window.traceMetricCall("Name");
    window.traceMetricCall("Exchanges");
    window.traceMetricCall("BF");
  }

  // 🚀 [디버그 추가] 1번 행(index 0)에만 디버그 용도의 callerId 전광판 확장 영역 추가 (store.traceRowCaller 플래그 제어)
  if (targetIdx === 0 && store.traceRowCaller) {
    rowEl.style.height = "221px";
    rowEl.style.maxHeight = "221px";

    // 이미 추가되어 있는지 확인하고 없으면 디버그 영역 삽입
    let debugArea = rowEl.querySelector(".first-row-debug-area");
    if (!debugArea) {
      debugArea = document.createElement("div");
      debugArea.className = "first-row-debug-area absolute bottom-1 left-[10px] right-2 h-[165px] flex flex-col justify-start border-t border-[#ff0055]/30 text-[9px] text-[#ff0055] font-semibold font-mono z-50 pointer-events-none p-1.5 bg-[#1a050f]/85 rounded-b-md";
      debugArea.innerHTML = `
        <div class="flex items-center gap-1.5 border-b border-[#ff0055]/20 pb-1 mb-1 flex-shrink-0">
          <span class="opacity-80 text-[8px] uppercase text-white bg-[#ff0055] px-1 rounded flex-shrink-0 font-bold">Metrics Call Trace (Index 0 Row)</span>
          <span class="text-white/40">Realtime Tracker</span>
        </div>
        <div class="grid grid-cols-3 gap-x-3 gap-y-1 overflow-y-auto max-h-[140px] pr-1">
          <div class="flex items-center gap-1"><span class="text-white/60">TICKER:</span> <span class="trace-Ticker text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">PRICE:</span> <span class="trace-Price text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">BF:</span> <span class="trace-BF text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">VOL:</span> <span class="trace-Vol text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">UVOL:</span> <span class="trace-UVol text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">KIMCH:</span> <span class="trace-Kimch text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">EXCH:</span> <span class="trace-Exchanges text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">NAME:</span> <span class="trace-Name text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">24H:</span> <span class="trace-24H text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">TODAY:</span> <span class="trace-Day text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">MCAP:</span> <span class="trace-Mcap text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">VMC:</span> <span class="trace-VMC text-[#ff0055]">-</span></div>
          <div class="flex items-center gap-1"><span class="text-white/60">FUNDING:</span> <span class="trace-Funding text-[#ff0055]">-</span></div>
        </div>
      `;
      rowEl.appendChild(debugArea);
    }
  } else {
    rowEl.style.height = "52px";
    rowEl.style.maxHeight = "52px";
    const debugArea = rowEl.querySelector(".first-row-debug-area");
    if (debugArea) debugArea.remove();
  }

  // 🚀 전역 메트릭 Trace 로깅 함수 바인딩
  if (!window.traceMetricCall) {
    window.traceMetricCall = (metricName) => {
      if (!store.traceRowCaller) return;
      const stack = new Error().stack || "";
      let callerId = "3 (UI/Filter)";
      if (stack.includes("stream.js") || stack.includes("stream_korea.js") || stack.includes("updateStatus")) {
        callerId = "1 (Stream)";
      } else if (stack.includes("chart_utils.js") || stack.includes("chart.js") || stack.includes("chart_data.js")) {
        callerId = "2 (Chart)";
      }
      const debugText = `${callerId}`;
      const firstRowDebug = document.querySelector('#coin-list-body > div[data-index="0"] .first-row-debug-area');
      if (firstRowDebug) {
        const spanEl = firstRowDebug.querySelector(`.trace-${metricName}`);
        if (spanEl && spanEl.textContent !== debugText) {
          spanEl.textContent = debugText;
        }
      }
    };
  }
}

export function updateRowDynamicHTML(rowEl, row, lightweight = false) {
  if (typeof window !== "undefined" && !window.updateRowDynamicHTML) {
    window.updateRowDynamicHTML = updateRowDynamicHTML;
  }
  // if (typeof window.syncRowPrioritizedMetrics === "function") {
  //   window.syncRowPrioritizedMetrics(row);
  // }
  const tId = row.Ticker;
  const p = row.precision || 2;
  const currentMarket = store.currentMarket || "ALL";
  const rate = store.marketDataMap?.krw_usd_rate || 0;
  let nPrice = row.Price_Raw ?? 0;
  let n24h = row.Change_24h_Raw ?? 0;
  if (currentMarket === "UPBIT") {
    nPrice = row.Upbit_Price ?? nPrice;
    n24h = row.Change_24h_Upbit ?? n24h;
  } else if (currentMarket === "BITHUMB") {
    nPrice = row.Bithumb_Price ?? nPrice;
    n24h = row.Change_24h_Bithumb ?? n24h;
  } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
    nPrice =
      (currentMarket === "FUTURES"
        ? row.Binance_Price_Futures
        : row.Bybit_Price_Futures) ?? nPrice;
    n24h = row.Change_24h_Futures_Ex ?? n24h;
  } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
    nPrice =
      (currentMarket === "SPOT"
        ? row.Binance_Price_Spot
        : row.Bybit_Price_Spot) ?? nPrice;
    n24h =
      (currentMarket === "SPOT"
        ? row.Change_24h_Binance
        : row.Change_24h_Bybit) ?? n24h;
  } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
    /* [테이블 렌더러가 가격 우선순위를 독단적으로 재계산하여 가격을 꼬던 기존 코드들을 싹 다 주석 처리]
    const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

    let binanceP = null;
    let bybitP = null;

    if (hasFutures) {
      binanceP = row.Binance_Price_Futures ?? row.Binance_Price;
      bybitP = row.Bybit_Price_Futures ?? row.Bybit_Price;
    } else if (hasSpot) {
      binanceP = row.Binance_Price_Spot ?? row.Binance_Price;
      bybitP = row.Bybit_Price_Spot ?? row.Bybit_Price;
    }

    const upbitP = row.Upbit_Price || null;
    const bithumbP = null;

    if (binanceP !== null) {
      nPrice = binanceP;
    } else if (bybitP !== null) {
      nPrice = bybitP;
    } else if (upbitP !== null) {
      nPrice = rate > 0 ? upbitP / rate : upbitP;
    } else {
      nPrice = row.Ticker?.endsWith("KRW") ? (rate > 0 ? (row.Price_KRW || 0) / rate : (row.Price_KRW || 0)) : (row.Price_Raw || 0);
    }
    */

    // 🚀 [구원] 렌더러는 가격 연산에 직접 개입하지 않고, 오직 stream.js가 확정해놓은 단일 진실 대표값만 그대로 매핑해 그립니다!
    nPrice = row.Price_Raw ?? 0;
    n24h = row.Change_24h_Raw ?? 0;
  }
  const isKrw = store.currencyMode === "KRW" || currentMarket === "UPBIT" || currentMarket === "BITHUMB" || row.Ticker?.endsWith("KRW");
  const formattedPrice = formatSmartPrice(nPrice, p, isKrw);

  const color24h =
    n24h > 0
      ? "text-theme-up"
      : n24h < 0
        ? "text-theme-down"
        : "text-theme-text";

  const isDetailed = store.viewMode === "detailed";
  let nDay = row.Change_Today_Raw ?? 0;
  if (currentMarket === "UPBIT") {
    nDay = row.Change_Today_Upbit ?? nDay;
  } else if (currentMarket === "BITHUMB") {
    nDay = row.Change_Today_Bithumb ?? nDay;
  } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
    nDay = row.Change_Today_Futures ?? nDay;
  } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
    nDay =
      (currentMarket === "SPOT"
        ? row.Change_Today_Binance
        : row.Change_Today_Bybit) ?? nDay;
  } else if (currentMarket === "ALL" || currentMarket === "KIMCHI" || currentMarket === "NEW") {
    // 🚀 [추가] ALL 모드에서 오늘(Today) 변동률 우선순위 단일 매칭 독점 바인딩 (Change_Today_Raw 직접 락킹)
    nDay = row.Change_Today_Raw ?? 0;
  }
  const colorDay =
    nDay > 0
      ? "text-theme-up"
      : nDay < 0
        ? "text-theme-down"
        : "text-theme-text";

  const vmcFormatted = row.VMC_Formatted || "-";
  const vmcColorClass = "text-theme-text";

  // 🚀 가격, 등락률 렌더링
  const priceCell = rowEl._priceCell || (rowEl._priceCell = rowEl.querySelector(".col-price"));
  if (priceCell) {
    priceCell.classList.remove("price-placeholder");

    // 구조가 없으면 최초 1회만 innerHTML 생성
    let container = priceCell._container;
    if (!container) {
      container = priceCell.querySelector(".price-container");
      if (!container) {
        priceCell.innerHTML = `
          <div class="price-container flex flex-col leading-tight min-w-0 gap-0.5">
            <div id="price-${tId}" data-raw-price="0" class="font-medium text-[14px] text-theme-text price-cell tracking-tighter truncate block flex items-center">
              <span id="price-val-binance-${tId}" class="hidden items-center">
                <span class="price-num">-</span>
                <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-hidden bg-white/2 ml-1 align-middle flex-shrink-0">
                  <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png" alt="binance" class="w-full h-full object-contain rounded-[2px]" />
                  <div class="price-futures-badge absolute bottom-[0.5px] right-[0.5px] bg-[#f0b90b] text-black text-[8px] font-black px-[0.5px] rounded-[1px] leading-none z-10 scale-[0.6] origin-bottom-right hidden">F</div>
                </div>
              </span>
              <span id="price-val-bybit-${tId}" class="hidden items-center">
                <span class="price-num">-</span>
                <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-hidden bg-white/2 ml-1 align-middle flex-shrink-0">
                  <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png" alt="bybit" class="w-full h-full object-contain rounded-[2px]" />
                  <div class="price-futures-badge absolute bottom-[0.5px] right-[0.5px] bg-[#f0b90b] text-black text-[8px] font-black px-[0.5px] rounded-[1px] leading-none z-10 scale-[0.6] origin-bottom-right hidden">F</div>
                </div>
              </span>
              <span id="price-val-upbit-${tId}" class="hidden items-center">
                <span class="price-num">-</span>
                <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-hidden bg-white/2 ml-1 align-middle flex-shrink-0">
                  <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/351.png" alt="upbit" class="w-full h-full object-contain rounded-[2px]" />
                </div>
              </span>
              <span id="price-val-bithumb-${tId}" class="hidden items-center">
                <span class="price-num">-</span>
                <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-hidden bg-white/2 ml-1 align-middle flex-shrink-0">
                  <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/200.png" alt="bithumb" class="w-full h-full object-contain rounded-[2px]" />
                </div>
              </span>
            </div>
            <div class="flex items-center justify-between gap-1 text-[10px] font-medium text-left mt-0.5 w-full min-w-0">
              <span id="change-${tId}" class="whitespace-nowrap flex-shrink-0">-</span>
              <span id="today-${tId}" class="whitespace-nowrap flex-shrink-0">-</span>
            </div>
          </div>
        `;
        container = priceCell.querySelector(".price-container");
      }
      priceCell._container = container;
    }

    // Direct textContent 및 클래스 갱신 (리플로우 방지)
    const chgText = `${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%`;
    const todayText = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;

    const changeEl = container._changeEl || (container._changeEl = container.querySelector(`#change-${tId}`));
    if (changeEl) {
      changeEl.textContent = chgText;
      changeEl.className = `${color24h} ${chgText.length > 7 ? "text-[9px]" : "text-[10px]"} whitespace-nowrap flex-shrink-0`;
    }

    const todayEl = container._todayEl || (container._todayEl = container.querySelector(`#today-${tId}`));
    if (todayEl) {
      todayEl.textContent = todayText;
      todayEl.className = `${colorDay} ${todayText.length > 7 ? "text-[9px]" : "text-[10px]"} whitespace-nowrap flex-shrink-0`;
    }
  }

  // 🚀 바이낸스 볼륨/시총 렌더링
  const volBCell = rowEl._volBCell || (rowEl._volBCell = rowEl.querySelector(".col-vol-b"));
  if (volBCell) {
    volBCell.classList.remove("vol-b-placeholder");

    let container = volBCell._container;
    if (!container) {
      container = volBCell.querySelector(".vol-b-container");
      if (!container) {
        volBCell.innerHTML = `
          <div class="vol-b-container flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5">
            <span id="vol-binance-${tId}" class="text-[#f0b90b] text-[11px] font-tempTestDss font-bold truncate"></span>
            <span id="mcap-${tId}" class="text-[10px] font-bold opacity-60 text-left mt-0.5 truncate"></span>
          </div>
        `;
        container = volBCell.querySelector(".vol-b-container");
      }
      volBCell._container = container;
    }

    const volBText = (row.Volume_Formatted && row.Volume_Formatted !== "-" && row.Volume_Formatted !== "0") ? row.Volume_Formatted : "-";
    const mcapText = row.MarketCap_Formatted || "-";

    const volBEl = container._volBEl || (container._volBEl = container.querySelector(`#vol-binance-${tId}`));
    if (volBEl && volBEl.textContent !== volBText) {
      volBEl.textContent = volBText;
      const fs = CONFIG.FONT_SCALE;
      if (fs && volBText.length > fs.VOL_THRESHOLD) {
        const size = Math.max(fs.VOL_MIN_SIZE, fs.VOL_BASE_SIZE - (volBText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP);
        if (volBEl.style.fontSize !== `${size}px`) volBEl.style.fontSize = `${size}px`;
      } else {
        if (volBEl.style.fontSize !== "") volBEl.style.fontSize = "";
      }
    }

    const mcapEl = container._mcapEl || (container._mcapEl = container.querySelector(`#mcap-${tId}`));
    if (mcapEl) {
      mcapEl.textContent = mcapText;
      const fs = CONFIG.FONT_SCALE;
      if (fs && mcapText.length > fs.MCAP_THRESHOLD) {
        const size = Math.max(fs.MCAP_MIN_SIZE, fs.MCAP_BASE_SIZE - (mcapText.length - fs.MCAP_THRESHOLD) * fs.MCAP_REDUCE_STEP);
        mcapEl.style.fontSize = `${size}px`;
      } else {
        mcapEl.style.fontSize = "";
      }
    }
  }

  // 🚀 업비트 볼륨/VMC 렌더링
  const volUCell = rowEl._volUCell || (rowEl._volUCell = rowEl.querySelector(".col-vol-u"));
  if (volUCell) {
    volUCell.classList.remove("vol-u-placeholder");

    let container = volUCell._container;
    if (!container) {
      container = volUCell.querySelector(".vol-u-container");
      if (!container) {
        volUCell.innerHTML = `
          <div class="vol-u-container flex flex-col h-full justify-center items-end leading-tight min-w-0 gap-0.5 text-right w-full">
            <span id="vol-upbit-${tId}" class="text-[#093687] text-[11px] font-tempTestDss font-bold truncate w-full text-right"></span>
            <span id="vmc-${tId}" class="text-[10px] font-bold opacity-60 mt-0.5 truncate w-full text-right ${vmcColorClass}"></span>
          </div>
        `;
        container = volUCell.querySelector(".vol-u-container");
      }
      volUCell._container = container;
    }

    const volUText = (row.Upbit_Vol_Formatted && row.Upbit_Vol_Formatted !== "-" && row.Upbit_Vol_Formatted !== "0") ? row.Upbit_Vol_Formatted : "-";

    const volUEl = container._volUEl || (container._volUEl = container.querySelector(`#vol-upbit-${tId}`));
    if (volUEl && volUEl.textContent !== volUText) {
      volUEl.textContent = volUText;
      const fs = CONFIG.FONT_SCALE;
      if (fs && volUText.length > fs.VOL_THRESHOLD) {
        const size = Math.max(fs.VOL_MIN_SIZE, fs.VOL_BASE_SIZE - (volUText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP);
        volUEl.style.fontSize = `${size}px`;
      } else {
        volUEl.style.fontSize = "";
      }
    }

    const vmcEl = container._vmcEl || (container._vmcEl = container.querySelector(`#vmc-${tId}`));
    if (vmcEl && vmcEl.textContent !== vmcFormatted) {
      vmcEl.textContent = vmcFormatted;
      const fs = CONFIG.FONT_SCALE;
      if (fs && vmcFormatted.length > fs.VMC_THRESHOLD) {
        const size = Math.max(fs.VMC_MIN_SIZE, fs.VMC_BASE_SIZE - (vmcFormatted.length - fs.VMC_THRESHOLD) * fs.VMC_REDUCE_STEP);
        vmcEl.style.fontSize = `${size}px`;
      } else {
        vmcEl.style.fontSize = "";
      }
    }
  }

  // 🚀 김프/펀딩비 렌더링
  const kimchiCell = rowEl._kimchiCell || (rowEl._kimchiCell = rowEl.querySelector(".col-kimch"));
  if (kimchiCell) {
    kimchiCell.classList.remove("kimchi-placeholder");

    let container = kimchiCell._container;
    if (!container) {
      container = kimchiCell.querySelector(".kimchi-container");
      if (!container) {
        kimchiCell.innerHTML = `
          <div class="kimchi-container flex flex-col h-full justify-center leading-tight items-start min-w-0">
            <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
              <span class="kimchi-pct text-[12px] font-medium truncate">-</span>
            </div>
            <div class="flex items-center justify-start gap-2 text-[10px] font-medium mt-0.5 min-w-0 max-w-full">
               <span class="funding-val text-theme-accent opacity-70 truncate">-</span>
            </div>
          </div>
        `;
        container = kimchiCell.querySelector(".kimchi-container");
      }
      kimchiCell._container = container;
    }

    const kimchiPctEl = container._kimchiPctEl || (container._kimchiPctEl = container.querySelector(".kimchi-pct"));
    if (kimchiPctEl) {
      if (!row.Kimchi_Label || row.Kimchi_Label === "-" || !row.Kimchi_Formatted) {
        kimchiPctEl.textContent = "-";
        kimchiPctEl.className = "kimchi-pct text-[12px] font-medium text-theme-text opacity-40";
      } else {
        kimchiPctEl.textContent = row.Kimchi_Formatted;
        kimchiPctEl.className = `kimchi-pct text-[12px] font-medium truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}`;
      }
    }

    const fundingEl = container._fundingEl || (container._fundingEl = container.querySelector(".funding-val"));
    if (fundingEl) {
      fundingEl.textContent = row.Funding_Formatted || "-";
    }
  }

  // 🚀 [경량 렌더링 최적화 분기]
  // lightweight=true 일 때, 렉을 유발하는 거래소 뱃지 갱신/상장일 빌드 단계를 스킵
  // 가격과 김프 등락률만 다이렉트 텍스트 갱신 후 즉각 탈출하여 GPU/CPU 점유율 극단적 단축!
  if (lightweight) {
    if (typeof window.updateRowPriceDisplay === "function") {
      window.updateRowPriceDisplay(rowEl, row);
    }
    rowEl.dataset.metricsRendered = "true";
    return;
  }

  // 🚀 상장 거래소 그리드 렌더링 (그레이스케일 필터 연산)
  const exchCell = rowEl.querySelector(".col-exch");
  if (exchCell) {
    exchCell.classList.remove("exch-placeholder");

    // exchCell은 변경 빈도가 극히 낮으므로 innerHTML이 없을 때만 1회 빌드
    if (!exchCell.querySelector(".exch-grid-trigger")) {
      exchCell.innerHTML = `
        <div class="grid grid-cols-4 content-center h-full gap-[2px] w-fit text-left min-w-0 cursor-pointer exch-grid-trigger">
          ${(() => {
          const exchanges = row.Listed_Exchanges || [];
          const list = [
            { id: "BINANCE", cmcId: 270 },
            { id: "UPBIT", cmcId: 351 },
            { id: "BITHUMB", cmcId: 200 },
            { id: "BYBIT", cmcId: 521 },
            { id: "OKX", cmcId: 294 },
            { id: "BITGET", cmcId: 513 },
            { id: "GATEIO", cmcId: 302 },
            { id: "COINBASE", cmcId: 89 },
          ];
          return list
            .map((ex) => {
              const isListed =
                exchanges.some((e) => e.includes(ex.id)) ||
                (ex.id === "UPBIT" && row.Upbit === "O");
              const isFutures = exchanges.includes(`${ex.id}_FUTURES`);
              const isSpot = exchanges.includes(ex.id) || (ex.id === "UPBIT" && row.Upbit === "O");

              let badgeHtml = "";
              if (isListed && (isFutures || isSpot)) {
                badgeHtml = `
                  <div class="absolute bottom-0 right-0 flex items-center gap-[0.5px] z-10 scale-[0.55] origin-bottom-right">
                    ${isSpot ? `<div class="badge-spot bg-[#0ecb81]/90 text-white text-[9px] font-black px-[1px] rounded-[1px] leading-none">S</div>` : ""}
                    ${isFutures ? `<div class="badge-futures bg-[#f0b90b]/90 text-black text-[9px] font-black px-[1px] rounded-[1px] leading-none">F</div>` : ""}
                  </div>
                `;
              }
              const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
              return `
                <div class="relative w-[14px] h-[14px] flex items-center justify-center rounded-[2px] overflow-hidden bg-white/5 transition-all flex-shrink-0"
                     style="${isListed ? "filter: none; opacity: 1;" : "filter: grayscale(1); opacity: 0.1;"}">
                  <img src="${imgUrl}" alt="${ex.id}" class="w-full h-full object-contain rounded-[2px]" />
                  ${badgeHtml}
                </div>
              `;
            })
            .join("");
        })()}
        </div>
      `;
    }
  }

  // 🚀 상장일 렌더링
  const listingCell = rowEl.querySelector(".col-listing");
  if (listingCell) {
    if (store.tableViewMode === "simple" || store.viewMode === "simple") {
      listingCell.style.display = "none";
    } else {
      listingCell.style.display = "";
      listingCell.classList.remove("listing-placeholder");
      listingCell.id = `listing-${tId}`;
      listingCell.textContent = formatListingDateWithExchange(row);
    }
  }

  window.updateRowPriceDisplay(rowEl, row);
  rowEl.dataset.metricsRendered = "true";

  // 🚀 동적 데이터 갱신 시 Trace 기록 트리거 (1번 행일 경우)
  const targetIdx = parseInt(rowEl.dataset.index);
  if (targetIdx === 0 && typeof window.traceMetricCall === "function") {
    window.traceMetricCall("Price");
    window.traceMetricCall("Vol");
    window.traceMetricCall("UVol");
    window.traceMetricCall("Kimch");
    window.traceMetricCall("24H");
    window.traceMetricCall("Day");
    window.traceMetricCall("Mcap");
    window.traceMetricCall("VMC");
    window.traceMetricCall("Funding");
  }
}

export function updateRowInnerHTML(rowEl, row) {
  // 🚀 외부 모듈 호환성을 유지하기 위한 래퍼 함수 (정적/동적 레이어 동시 업데이트)
  updateRowStaticHTML(rowEl, row);
  updateRowDynamicHTML(rowEl, row);
}

// 🚀 [신규 아키텍처] 고정 DOM 풀 및 Lazy 렌더링 상태 관리
store.tablePoolInitialized = false;

// 🚀 [신규] 상위 30위 경마장(실시간 정렬) 경계선 및 배경 그라데이션 관리 함수
export function updateBoundaryClass(tbody) {
  // 1. 기존 클래스 O(N) 전체 초기화 방지 및 효율적인 target 초기화
  tbody.querySelectorAll(".realtime-live-row").forEach((el) => {
    el.classList.remove("realtime-live-row");
  });
  tbody.querySelectorAll(".realtime-boundary-row").forEach((el) => {
    el.classList.remove("realtime-boundary-row");
  });

  const filteredData = getFilteredData();
  const limit = Math.min(30, filteredData.length);

  for (let i = 0; i < limit; i++) {
    const rowData = filteredData[i];
    if (rowData) {
      const rowEl = store.rowDomMap.get(rowData.Ticker);
      if (rowEl) {
        rowEl.classList.add("realtime-live-row");
        // 30등 코인(index 29)의 밑바닥에만 절취선 표시
        if (i === 29) {
          rowEl.classList.add("realtime-boundary-row");
        }
      }
    }
  }
}

export function renderTable(isRealtime = false) {
  if (store.blockTableTabScroll && !isRealtime) return;
  const tbody = document.getElementById("coin-list-body");
  if (!tbody) return;

  tbody.dataset.sortCol = store.currentSortCol || "";

  const filteredData = getFilteredData();
  const totalCount = filteredData.length;

  // 🚀 [사건 X] 필터링, 정렬, 검색, 탭전환 등 화면 구성 변화 시 반드시 상위 30개 코인을 visibleSymbols에 등록하여 실시간 구독 시작
  if (!isRealtime) {
    store.visibleSymbols.clear();
    const initLimit = Math.min(30, totalCount);
    for (let i = 0; i < initLimit; i++) {
      if (filteredData[i]) {
        store.visibleSymbols.add(filteredData[i].Ticker);
      }
    }
    // 🚀 선택된 코인도 무조건 실시간 구독 대상 유지
    if (store.currentSelectedSymbol) {
      store.visibleSymbols.add(store.currentSelectedSymbol);
    }
    // 🚀 화면 내 관찰 중인 심볼들도 즉시 복구
    if (store.intersectingSymbols) {
      store.intersectingSymbols.forEach((sym) => {
        store.visibleSymbols.add(sym);
      });
    }
  }

  // 1. 최초 1회 전체 껍데기 풀(Pool) 생성 (DOM 파괴/생성 원천 차단, 가상화 스크롤 바 확보)
  const allSource = store.originalTableData || store.currentTableData || [];
  if (!store.tablePoolInitialized || tbody.children.length !== allSource.length) {
    tbody.innerHTML = "";
    store.rowDomMap = new Map();
    store.visibleSymbols.clear();
    if (store.intersectingSymbols) {
      store.intersectingSymbols.clear();
    }
    store.lastSortedTickers = null; // 🚀 풀 재구성 시 정렬 비교 캐시도 초기화!

    if (store.tableObserver) {
      store.tableObserver.disconnect();
    }

    // 🚀 화면 추적용 옵저버 (화면에 들어오면 Lazy하게 내용 채워넣기!)
    store.tableObserver = new IntersectionObserver(
      (entries) => {
        let changed = false;
        entries.forEach((entry) => {
          const rowEl = entry.target;
          const sym = rowEl.dataset.sym;
          if (!sym) return;

          const rowData = store.tickerRowMap.get(sym.toUpperCase());
          if (entry.isIntersecting) {
            if (rowData) {
              if (store.intersectingSymbols) {
                store.intersectingSymbols.add(rowData.Ticker);
              }
              if (!store.visibleSymbols.has(rowData.Ticker)) {
                store.visibleSymbols.add(rowData.Ticker);
                changed = true;
              }
              const isPending = !!(
                store.pendingFavActions &&
                store.pendingFavActions.has(rowData.UID)
              );

              // 🚀 화면에 들어온 행의 순위만 갱신
              const targetIdx = parseInt(rowEl.dataset.index);
              if (!isNaN(targetIdx)) {
                const counterEl = rowEl.querySelector(".row-counter");
                if (counterEl) {
                  counterEl.textContent = targetIdx + 1;
                }
              }

              // 🚀 정적 레이어 갱신 체크 (티커 변화, 언어 번역, 즐겨찾기 대기 상태 반영)
              const needsStatic =
                !rowEl.dataset.renderedSym ||
                rowEl.dataset.renderedSym !== rowData.Ticker ||
                rowEl.dataset.renderedLang !== store.lang ||
                (rowEl.dataset.renderedPending === "true") !== isPending;

              if (needsStatic) {
                updateRowStaticHTML(rowEl, rowData);
                rowEl.dataset.renderedSym = rowData.Ticker;
                rowEl.dataset.renderedLang = store.lang;
              }

              // 🚀 동적 지표 레이어 갱신 체크 (지연 로딩 및 화폐 설정 동기화)
              const needsDynamic =
                rowEl.dataset.metricsRendered !== "true" ||
                rowEl.dataset.renderedCurrency !== store.currencyMode ||
                rowEl.dataset.renderedLang !== store.lang;

              if (needsDynamic) {
                updateRowDynamicHTML(rowEl, rowData);
                rowEl.dataset.renderedCurrency = store.currencyMode;
                rowEl.dataset.renderedLang = store.lang;
              }
            }
          } else {
            if (rowData) {
              if (store.intersectingSymbols) {
                store.intersectingSymbols.delete(rowData.Ticker);
              }
              if (store.visibleSymbols.has(rowData.Ticker)) {
                store.visibleSymbols.delete(rowData.Ticker);
                changed = true;
              }
            }
          }
        });

        // 🚀 변경사항이 있을 때만 웹소켓 구독 싱크 호출 (쓰로틀링 적용)
        if (changed && typeof window.syncSniperSubscriptions === "function") {
          if (store.syncSubTimer) clearTimeout(store.syncSubTimer);
          store.syncSubTimer = setTimeout(() => {
            window.syncSniperSubscriptions();
          }, 100);
        }
      },
      {
        root: document.querySelector("#left-panel .overflow-y-auto"),
        rootMargin: "300px 0px", // 🚀 위아래 300px 여유를 두어 스크롤 시 부드럽게 미리 로딩!
      },
    );

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < allSource.length; i++) {
      const rowEl = document.createElement("div");
      rowEl.classList.add("coin-row");
      if (i < 30) {
        rowEl.classList.add("flip-row");
      }
      rowEl.dataset.index = i;
      rowEl.style.height = (i === 0 && store.traceRowCaller) ? "221px" : "52px";
      rowEl.style.position = "absolute";
      rowEl.style.transform = `translateY(${(i === 0 || !store.traceRowCaller) ? i * 52 : 221 + (i - 1) * 52}px)`;
      rowEl.style.contain = "content";

      const rowData = allSource[i];
      if (rowData) {
        rowEl.dataset.sym = rowData.Ticker;
        store.rowDomMap.set(rowData.Ticker, rowEl);

        // 🚀 최초 생성 시: 800개 전체 코인의 정적 레이어(명칭, 로고 등)를 즉시 그려 공백을 제거함!
        updateRowStaticHTML(rowEl, rowData);
        rowEl.dataset.renderedSym = rowData.Ticker;
        rowEl.dataset.renderedLang = store.lang;

        // 🚀 자바스크립트로 절대 순위 주입
        const counterEl = rowEl.querySelector(".row-counter");
        if (counterEl) {
          counterEl.textContent = i + 1;
        }

        // 🚀 상위 30개만 동적 데이터 즉시 채워넣기
        if (i < 30) {
          updateRowDynamicHTML(rowEl, rowData);
          rowEl.dataset.renderedCurrency = store.currencyMode;
          store.visibleSymbols.add(rowData.Ticker);
        } else {
          rowEl.dataset.renderedCurrency = "";
        }
      }
      store.tableObserver.observe(rowEl);
      fragment.appendChild(rowEl);
    }
    tbody.appendChild(fragment);
    store.tablePoolInitialized = true;
  }

  // 2. 이미 풀이 생성되어 있다면? (물리적 DOM 추가/삭제 없이 각 코인의 고유 상자 위치를 translateY로 재배치!)
  store.visibleSymbols.clear();
  if (store.currentSelectedSymbol) {
    store.visibleSymbols.add(store.currentSelectedSymbol);
  }
  if (store.intersectingSymbols) {
    store.intersectingSymbols.forEach((sym) => {
      store.visibleSymbols.add(sym);
    });
  }
  tbody.style.height = `${store.traceRowCaller ? 221 + (totalCount - 1) * 52 : totalCount * 52}px`;

  // 🚀 [최적화] 먼저 전체 코인 행들을 숨김 처리 (display = none !important)
  for (const child of tbody.children) {
    child.style.setProperty("display", "none", "important");
  }

  for (let i = 0; i < totalCount; i++) {
    const rowData = filteredData[i];
    if (rowData) {
      const rowEl = store.rowDomMap.get(rowData.Ticker);
      if (rowEl) {
        rowEl.style.removeProperty("display");
        const oldIndex = parseInt(rowEl.dataset.index);
        // 🚀 실시간 정렬 시 30위 이하(31등~) 코인은 불필요한 연속 렌더링 방지를 위해 위치를 고정시키되,
        // 현재 위치(oldIndex)가 실제 정렬 순위(i)와 달라질 때만 딱 1번 올바른 목적지(31위든 300위든)에 공백/겹침 없이 정밀 배치하고 고정시킵니다.
        let needsPositionUpdate = !isRealtime || i < 30 || oldIndex < 30 || isNaN(oldIndex) || oldIndex !== i;
        if (isRealtime && i >= 30 && oldIndex >= 30) {
          needsPositionUpdate = (oldIndex !== i);
        }

        if (needsPositionUpdate) {
          rowEl.dataset.index = i;
          rowEl.style.height = (i === 0 && store.traceRowCaller) ? "221px" : "52px";
          rowEl.style.transform = `translateY(${(i === 0 || !store.traceRowCaller) ? i * 52 : 221 + (i - 1) * 52}px)`;

          // 🚀 자바스크립트로 절대 순위 실시간 주입
          const counterEl = rowEl.querySelector(".row-counter");
          if (counterEl) {
            counterEl.textContent = i + 1;
          }
        }

        // 🚀 30위 바깥 코인들은 실시간 정렬(경주마 효과) 애니메이션 제거 (즉시 순간이동)
        if (i < 30) {
          rowEl.classList.add("flip-row");
        } else {
          rowEl.classList.remove("flip-row");
        }

        const isPreRender = i < 30;
        if (isPreRender) {
          store.visibleSymbols.add(rowData.Ticker);
        }

        const isPending = !!(
          store.pendingFavActions && store.pendingFavActions.has(rowData.UID)
        );

        // 🚀 정적 식별 정보 갱신 검사 (화면에 보이지 않는 행은 IntersectionObserver 콜백이 알아서 채움)
        if (isPreRender || store.visibleSymbols.has(rowData.Ticker)) {
          const needsStatic =
            !rowEl.dataset.renderedSym ||
            rowEl.dataset.renderedSym !== rowData.Ticker ||
            rowEl.dataset.renderedLang !== store.lang ||
            (rowEl.dataset.renderedPending === "true") !== isPending;
          if (needsStatic) {
            updateRowStaticHTML(rowEl, rowData);
            rowEl.dataset.renderedSym = rowData.Ticker;
            rowEl.dataset.renderedLang = store.lang;

            // 🚀 HTML 재할당으로 밀렸을 수도 있는 순위 카운터 다시 복구
            const reCounterEl = rowEl.querySelector(".row-counter");
            if (reCounterEl) {
              reCounterEl.textContent = i + 1;
            }
          }

          // 🚀 동적 데이터 갱신 검사
          const needsDynamic =
            rowEl.dataset.metricsRendered !== "true" ||
            rowEl.dataset.renderedCurrency !== store.currencyMode ||
            rowEl.dataset.renderedLang !== store.lang;
          if (needsDynamic) {
            updateRowDynamicHTML(rowEl, rowData);
            rowEl.dataset.renderedCurrency = store.currencyMode;
            rowEl.dataset.renderedLang = store.lang;
          }
        }
      }
    }
  }

  store.lastSortedTickers = null; // 캐시 무효화
  updateBoundaryClass(tbody);
  applySelectedHighlight();
  if (typeof window.refreshSniperTarget === "function") {
    setTimeout(() => window.refreshSniperTarget(), 10);
  }
  if (typeof window.syncSniperSubscriptions === "function") {
    window.syncSniperSubscriptions();
  }
}

export function updateVisibleSymbols() {
  // 🚀 [성능 극대화] IntersectionObserver가 이미 store.visibleSymbols를 정밀하고 효율적으로 실시간 관리하고 있으므로,
  // 800개 행의 getBoundingClientRect()를 동기적으로 강제 호출하여 브라우저 전체를 프리징시키던 레거시 레이아웃 쓰레싱 로직을 영구 폐기합니다!
}

export function applySelectedHighlight() {
  const selectedSymbol = store.currentSelectedSymbol;
  if (!selectedSymbol) return;

  // 1. 기존 선택된 행 하이라이트 클래스 제거
  const prevSelected = document.querySelector(
    "#coin-list-body .coin-row.selected-highlight",
  );
  if (prevSelected) {
    prevSelected.classList.remove("selected-highlight");
  }

  // 2. 현재 선택된 행에 하이라이트 클래스 적용
  const targetRow = store.rowDomMap
    ? store.rowDomMap.get(selectedSymbol)
    : null;
  const actualRow =
    targetRow ||
    document.querySelector(
      `#coin-list-body .coin-row[data-sym="${selectedSymbol}"]`,
    );
  if (actualRow) {
    actualRow.classList.add("selected-highlight");
  }
}

export function initInfiniteScroll() {
  // 🚀 [신규 아키텍처] 800개 고정 DOM 풀이 존재하므로 무한 스크롤 DOM 추가 로직 영구 소각!
  const scrollContainer = document.querySelector(
    "#left-panel .overflow-y-auto",
  );
  if (!scrollContainer) return;

  let scrollTimer;
  let scrollStopTimer;
  scrollContainer.addEventListener(
    "scroll",
    () => {
      // 🚀 스크롤 중임을 마킹하여 실시간 정렬(DOM 재배치) 차단
      store.isScrolling = true;
      clearTimeout(scrollStopTimer);
      scrollStopTimer = setTimeout(() => {
        store.isScrolling = false;
      }, 200); // 200ms 동안 스크롤이 없으면 정지한 것으로 판단

      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (typeof window.refreshSniperTarget === "function") {
          window.refreshSniperTarget();
        }
      }, 50);
    },
    { passive: true },
  );
}

export function toggleFavorite(uid, event, forceImmediate = false) {
  event.stopPropagation();

  if (!store.pendingFavActions) {
    store.pendingFavActions = new Map();
  }

  let favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  let favorites2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]");

  const isFav = favorites.includes(uid);
  const isFav2 = favorites2.includes(uid);

  // FAV 혹은 FAV2 탭일 경우 5초 대기 취소 메커니즘 실행
  if (
    !forceImmediate &&
    (store.currentTab === "FAV" || store.currentTab === "FAV2")
  ) {
    let originalState;
    let targetState;
    let existingAction = store.pendingFavActions.get(uid);

    if (existingAction) {
      // 이미 대기 중인 상태가 있으면 타이머 취소
      clearTimeout(existingAction.timerId);
      originalState = existingAction.originalState; // 최초 상태 보존!

      // targetState 순환 토글: FAV -> FAV2 -> NONE -> FAV ...
      if (existingAction.targetState === "FAV") {
        targetState = "FAV2";
      } else if (existingAction.targetState === "FAV2") {
        targetState = "NONE";
      } else {
        targetState = "FAV";
      }
    } else {
      // 처음 대기 진입
      originalState = isFav ? "FAV" : isFav2 ? "FAV2" : "NONE";

      if (originalState === "FAV") {
        targetState = "FAV2";
      } else if (originalState === "FAV2") {
        targetState = "NONE";
      } else {
        targetState = "FAV";
      }
    }

    const timerId = setTimeout(() => {
      commitFavoriteChange(uid);
    }, 5000);

    store.pendingFavActions.set(uid, {
      timerId,
      startTimestamp: Date.now(),
      duration: 5000,
      originalState,
      targetState,
    });

    const row = store.currentTableData.find((r) => r.UID === uid);
    if (row) {
      const rowEl = store.rowDomMap.get(row.Ticker);
      if (rowEl) {
        updateRowInnerHTML(rowEl, row);
      }
    }

    updateProgressBar();
    return;
  }

  // 지연 없는 변경 (ALL 탭 또는 빈 별 -> 노란별 추가 등)
  if (store.pendingFavActions.has(uid)) {
    clearTimeout(store.pendingFavActions.get(uid).timerId);
    store.pendingFavActions.delete(uid);
  }

  if (!isFav && !isFav2) {
    favorites.push(uid);
    localStorage.setItem("sellnance_favs", JSON.stringify(favorites));
  } else if (isFav) {
    favorites = favorites.filter((f) => f !== uid);
    localStorage.setItem("sellnance_favs", JSON.stringify(favorites));
    favorites2.push(uid);
    localStorage.setItem("sellnance_favs2", JSON.stringify(favorites2));
  } else {
    favorites2 = favorites2.filter((f) => f !== uid);
    localStorage.setItem("sellnance_favs2", JSON.stringify(favorites2));
  }

  const row = store.currentTableData.find((r) => r.UID === uid);
  if (row) {
    const rowEl = store.rowDomMap.get(row.Ticker);
    if (rowEl) {
      updateRowInnerHTML(rowEl, row);
    }
  }

  if (store.currentTab === "FAV" || store.currentTab === "FAV2") {
    setTimeout(() => renderTable(), 100);
  }
}

export function commitFavoriteChange(uid) {
  if (!store.pendingFavActions || !store.pendingFavActions.has(uid)) return;

  const action = store.pendingFavActions.get(uid);
  clearTimeout(action.timerId); // Clear background timeout to prevent double commits!
  store.pendingFavActions.delete(uid);

  let favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  let favorites2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]");

  // targetState 기준으로 최종 반영
  favorites = favorites.filter((f) => f !== uid);
  favorites2 = favorites2.filter((f) => f !== uid);

  if (action.targetState === "FAV") {
    favorites.push(uid);
  } else if (action.targetState === "FAV2") {
    favorites2.push(uid);
  }

  localStorage.setItem("sellnance_favs", JSON.stringify(favorites));
  localStorage.setItem("sellnance_favs2", JSON.stringify(favorites2));

  renderTable();
  updateProgressBar();

  const row = store.currentTableData.find((r) => r.UID === uid);
  if (
    row &&
    store.currentSelectedSymbol &&
    (store.currentSelectedSymbol === row.Ticker ||
      store.currentSelectedSymbol.startsWith(row.Symbol + "/"))
  ) {
    if (typeof window.selectSymbol === "function") {
      window.selectSymbol(store.currentSelectedSymbol);
    }
  }
}

window.cancelFavoriteChange = function (uid, event) {
  if (event) event.stopPropagation();
  if (!store.pendingFavActions || !store.pendingFavActions.has(uid)) return;

  const action = store.pendingFavActions.get(uid);
  clearTimeout(action.timerId);
  store.pendingFavActions.delete(uid);

  // localStorage는 건드린 적이 없으므로 pendingAction만 삭제하고 renderTable()을 실행해
  // 원래 localStorage의 상태(isFav, isFav2)대로 안전하게 되돌려줍니다.
  renderTable();
  updateProgressBar();
};

window.confirmFavoriteChange = function (uid, event) {
  if (event) event.stopPropagation();
  commitFavoriteChange(uid);
};

export function updateProgressBar() {
  if (!store.pendingFavActions || store.pendingFavActions.size === 0) {
    if (store.progressInterval) {
      clearInterval(store.progressInterval);
      store.progressInterval = null;
    }
    return;
  }

  if (!store.progressInterval) {
    store.progressInterval = setInterval(() => {
      if (!store.pendingFavActions || store.pendingFavActions.size === 0) {
        if (store.progressInterval) {
          clearInterval(store.progressInterval);
          store.progressInterval = null;
        }
        return;
      }

      for (const [uid, action] of store.pendingFavActions.entries()) {
        const row = store.currentTableData.find((r) => r.UID === uid);
        if (row) {
          const bar = document.getElementById(`progress-bar-${row.Ticker}`);
          if (bar) {
            const elapsed = Date.now() - action.startTimestamp;
            const remaining = action.duration - elapsed;
            if (remaining <= 0) {
              bar.style.width = "0%";
            } else {
              const pct = (remaining / action.duration) * 100;
              bar.style.width = `${pct}%`;
            }
          }
        }
      }
    }, 50);
  }
}

export function clearAllPendingFavActions() {
  if (store.pendingFavActions && store.pendingFavActions.size > 0) {
    for (const [symbol, action] of store.pendingFavActions.entries()) {
      clearTimeout(action.timerId);
    }
    store.pendingFavActions.clear();
  }
  if (store.progressInterval) {
    clearInterval(store.progressInterval);
    store.progressInterval = null;
  }
}

export function applyPriceFlash(element, newPrice, oldPrice) {
  if (store.blockLeftDom || store.blockTableUpdate) return;
  if (!element || newPrice === oldPrice) return;
  if (!store.useFlip) return;

  const flashClass = newPrice > oldPrice ? "flash-up" : "flash-down";

  // ✅ [비동기 누수 원천 차단] 기존에 돌고 있던 플래시 타이머 저격 해제
  if (element._flashTimerId) {
    clearTimeout(element._flashTimerId);
    element._flashTimerId = null;
  }

  // 🚀 [UX 개선] 이미 동일한 방향의 플래시 클래스가 존재하면, 흰색으로 깜빡이지 않고
  // 해당 색상 상태를 부드럽게 유지하면서 타이머만 500ms 리셋(연장)합니다.
  if (element.classList.contains(flashClass)) {
    element._flashTimerId = setTimeout(() => {
      element.classList.remove(flashClass);
      element._flashTimerId = null;
    }, 500);
    return;
  }

  // 🚀 [동기식 색상 전환] 방향 전환 시(초록<->빨강) 1프레임 딜레이(흰색 깜빡임) 없이 
  // 즉시 클래스를 교체하여 중간 흰색 노출 없이 다이렉트로 매끄럽게 변환합니다.
  element.classList.remove("flash-up", "flash-down");
  element.classList.add(flashClass);

  element._flashTimerId = setTimeout(() => {
    element.classList.remove(flashClass);
    element._flashTimerId = null;
  }, 500);
}

window.updateRowPriceDisplay = (target, row) => {
  const rowEl = target instanceof HTMLElement ? target : store.rowDomMap?.get(row.Ticker);
  if (!rowEl) return;

  const tId = row.Ticker || row.Symbol;
  const parentEl = rowEl._priceEl || (rowEl._priceEl = rowEl.querySelector(`#price-${tId}`));
  if (!parentEl) return;

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";
  const p = store.getPrecision(row.DisplayTicker || row.Symbol);
  const currentMarket = store.currentMarket || "ALL";

  const isFuturesOnly = row.Binance === "X" && row.Binance_Futures === "O";
  let binanceP = null;
  let bybitP = null;

  if (currentMarket === "FUTURES") {
    binanceP = row.Binance_Price_Futures ?? row.Binance_Price;
    bybitP = row.Bybit_Price_Futures ?? row.Bybit_Price;
  } else if (currentMarket === "SPOT") {
    binanceP = row.Binance_Price_Spot ?? row.Binance_Price;
    bybitP = row.Bybit_Price_Spot ?? row.Bybit_Price;
  } else if (currentMarket === "BYBIT") {
    bybitP = row.Bybit_Price_Spot ?? row.Bybit_Price;
    binanceP = row.Binance_Price_Spot ?? row.Binance_Price;
  } else if (currentMarket === "BYBIT_FUTURES") {
    bybitP = row.Bybit_Price_Futures ?? row.Bybit_Price;
    binanceP = row.Binance_Price_Futures ?? row.Binance_Price;
  } else {
    // ALL, KIMCHI, NEW 등 기본 탭 모드일 때 독점적 전담 바인딩 우선순위 (선물 -> 현물)
    const hasFutures = row.Binance_Futures === "O" || row.Listed_Exchanges?.includes("BINANCE_FUTURES");
    const hasSpot = row.Binance === "O" || row.Listed_Exchanges?.includes("BINANCE");

    if (hasFutures) {
      binanceP = row.Binance_Price_Futures ?? row.Binance_Price;
      bybitP = row.Bybit_Price_Futures ?? row.Bybit_Price;
    } else if (hasSpot) {
      binanceP = row.Binance_Price_Spot ?? row.Binance_Price;
      bybitP = row.Bybit_Price_Spot ?? row.Bybit_Price;
    } else {
      binanceP = null;
      bybitP = null;
    }
  }

  const upbitP = row.Upbit_Price || null;
  const bithumbP = null;

  let activeExchange = "";
  let displayPrice = 0;

  const isKrwCoin = row.Ticker?.endsWith("KRW");

  // 🚀 해외 거래소 가격(Binance, Bybit)을 최우선으로 매칭하여 환율 오염 방지
  if (!isKrwMode) {
    // 💵 달러(USD) 표시 모드
    if (binanceP !== null) {
      activeExchange = "binance";
      displayPrice = binanceP;
    } else if (bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = bybitP;
    } else if (upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = rate > 0 ? upbitP / rate : upbitP;
    } else if (bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = rate > 0 ? bithumbP / rate : bithumbP;
    } else {
      activeExchange = isKrwCoin ? "upbit" : "binance";
      displayPrice = isKrwCoin ? (rate > 0 ? (row.Price_KRW || 0) / rate : (row.Price_KRW || 0)) : (row.Price_Raw || 0);
    }
  } else {
    // ₩ 원화(KRW) 표시 모드
    if (upbitP !== null) {
      activeExchange = "upbit";
      displayPrice = upbitP;
    } else if (bithumbP !== null) {
      activeExchange = "bithumb";
      displayPrice = bithumbP;
    } else if (binanceP !== null) {
      activeExchange = "binance";
      displayPrice = binanceP * rate;
    } else if (bybitP !== null) {
      activeExchange = "bybit";
      displayPrice = bybitP * rate;
    } else {
      activeExchange = isKrwCoin ? "upbit" : "binance";
      displayPrice = isKrwCoin ? (row.Price_KRW || 0) : (row.Price_Raw || 0) * rate;
    }
  }

  const exchanges = ["binance", "bybit", "upbit", "bithumb"];
  const exchangeImgUrls = {
    binance: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png",
    bybit: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png",
    upbit: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/351.png",
    bithumb: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/200.png",
  };

  exchanges.forEach((ex) => {
    let span = parentEl[`_priceVal_${ex}`];
    if (!span) {
      span = parentEl.querySelector(`#price-val-${ex}-${tId}`);
      parentEl[`_priceVal_${ex}`] = span;
    }
    if (!span) return;

    if (ex === activeExchange) {
      const isKrw = isKrwMode || ["upbit", "bithumb"].includes(ex);
      const formattedPrice = window.formatSmartPrice(displayPrice, p, isKrw) + (isKrw ? " 원" : "");

      const numEl = span._numEl || (span._numEl = span.querySelector(".price-num"));
      // 🚀 [성능 극대화] innerText는 CSS 레이아웃을 계산하므로 렌더링 폭탄입니다. 단순 textContent로 교체하여 브라우저 부담을 90% 이상 줄입니다.
      // 🚀 또한 값이 실제로 다를 때만 DOM을 건드리도록 방어코드 추가 (DOM Mutation 렉 차단)
      if (numEl && numEl.textContent !== formattedPrice) {
        numEl.textContent = formattedPrice;

        // 🚀 글자 수에 비례하여 동적으로 폰트 크기 축소
        const len = formattedPrice.length;
        const fs = CONFIG.FONT_SCALE;
        if (fs && len > fs.PRICE_THRESHOLD) {
          const sizePx = Math.max(fs.PRICE_MIN_SIZE, fs.PRICE_BASE_SIZE - (len - fs.PRICE_THRESHOLD) * fs.PRICE_REDUCE_STEP);
          if (parentEl.style.fontSize !== `${sizePx}px`) parentEl.style.fontSize = `${sizePx}px`;
        } else {
          if (parentEl.style.fontSize !== "") parentEl.style.fontSize = "";
        }
      }

      const isFutures = row.Listed_Exchanges?.includes(
        `${ex.toUpperCase()}_FUTURES`,
      );
      const badge = span.querySelector(".price-futures-badge");
      if (badge) {
        if (isFutures) {
          if (badge.classList.contains("hidden"))
            badge.classList.remove("hidden");
        } else {
          if (!badge.classList.contains("hidden"))
            badge.classList.add("hidden");
        }
      }

      if (span.classList.contains("hidden")) span.classList.remove("hidden");
      if (!span.classList.contains("inline-flex"))
        span.classList.add("inline-flex");
    } else {
      if (!span.classList.contains("hidden")) span.classList.add("hidden");
      if (span.classList.contains("inline-flex"))
        span.classList.remove("inline-flex");
    }
  });

  parentEl.setAttribute("data-raw-price", displayPrice);
  parentEl.setAttribute("data-active-exchange", activeExchange);

  // 🚀 가격 수치 갱신 시 Trace 기록 트리거 (1번 행일 경우)
  if (target instanceof HTMLElement) {
    const targetIdx = parseInt(target.dataset.index);
    if (targetIdx === 0 && typeof window.traceMetricCall === "function") {
      window.traceMetricCall("Price");
    }
  } else {
    // target이 지정되지 않았을 때 DOM에서 첫 번째 행을 조회하여 매칭하는 방어 코드
    const firstRow = document.querySelector('#coin-list-body > div[data-index="0"]');
    if (firstRow && firstRow.dataset.sym === tId && typeof window.traceMetricCall === "function") {
      window.traceMetricCall("Price");
    }
  }
};

// 🚀 [신규] Web Popover API 기반 초간단 3배 확대 프리뷰 전역 팝오버 탑재
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    let popoverEl = document.getElementById("global-exch-popover");
    if (!popoverEl) {
      popoverEl = document.createElement("div");
      popoverEl.id = "global-exch-popover";
      popoverEl.setAttribute("popover", "manual");
      popoverEl.style.position = "fixed";
      popoverEl.style.margin = "0";
      popoverEl.style.padding = "6px";
      popoverEl.style.border = "1px solid rgba(255, 255, 255, 0.15)";
      popoverEl.style.background = "rgba(10, 10, 10, 0.96)";
      popoverEl.style.borderRadius = "6px";
      popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.85)";
      popoverEl.style.pointerEvents = "none"; // 호버 중복 간섭 및 깜빡임 방지
      popoverEl.style.zIndex = "999999";
      popoverEl.style.opacity = "0";
      popoverEl.style.transform = "scale(0.9)";
      popoverEl.style.transition = "opacity 0.15s ease, transform 0.15s ease";
      document.body.appendChild(popoverEl);
    }

    let fadeOutTimeout = null;
    let hideTimeout = null;

    const bodyContainer = document.getElementById("coin-list-body");
    if (bodyContainer) {
      bodyContainer.addEventListener("mouseover", (e) => {
        const grid = e.target.closest(".exch-grid-trigger");
        if (grid) {
          if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
          if (hideTimeout) clearTimeout(hideTimeout);

          const isLightMode = document.body.classList.contains("theme-upbit");
          if (isLightMode) {
            popoverEl.style.background = "rgba(255, 255, 255, 0.98)";
            popoverEl.style.border = "1px solid rgba(0, 0, 0, 0.12)";
            popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.12)";
          } else {
            popoverEl.style.background = "rgba(10, 10, 10, 0.96)";
            popoverEl.style.border = "1px solid rgba(255, 255, 255, 0.15)";
            popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.85)";
          }

          // 🚀 [디자인 엔진] 단 한 줄로 제어하는 팝오버 배율 변수 (기본 3.0배)
          const scale = 2.5;
          const baseIconSize = 16; // 원래 아이콘 크기인 16px 기준

          const iconSize = baseIconSize * scale; // 예: 3.0배면 48px
          const cellHeight = iconSize + (12 * scale); // 뱃지 영역 포함 높이
          const cellGap = 4;
          const popPadding = 6;

          const rect = grid.getBoundingClientRect();
          popoverEl.innerHTML = "";

          // 1. 상장 거래소 그리드 생성
          const gridWrapper = document.createElement("div");
          gridWrapper.style.display = "grid";
          gridWrapper.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
          gridWrapper.style.gap = `${cellGap}px`;
          gridWrapper.innerHTML = grid.innerHTML;
          popoverEl.appendChild(gridWrapper);

          // 2. 하단 주의 문구 생성
          const warnEl = document.createElement("div");
          warnEl.style.textAlign = "center";
          warnEl.style.fontSize = `${Math.max(8, 3 * scale)}px`;
          warnEl.style.fontWeight = "500";
          warnEl.style.letterSpacing = "-0.025em";
          warnEl.style.marginTop = `${4 * scale}px`;
          warnEl.style.opacity = "0.6";
          warnEl.style.color = isLightMode ? "#333333" : "#d2d2d2";
          warnEl.innerText = "* 실시간 상장 정보와 다를 수 있습니다";
          popoverEl.appendChild(warnEl);

          // 개별 아이콘 및 뱃지 동적 크기 계산 적용
          gridWrapper.querySelectorAll(".relative").forEach(el => {
            el.style.width = `${iconSize}px`;
            el.style.height = `${cellHeight}px`;
            el.style.overflow = "visible";

            const img = el.querySelector("img");
            if (img) {
              img.style.position = "absolute";
              img.style.top = "0";
              img.style.left = "0";
              img.style.width = `${iconSize}px`;
              img.style.height = `${iconSize}px`;
            }

            const badge = el.querySelector(".absolute");
            if (badge) {
              badge.style.transform = "none";
              badge.className = `absolute left-0 right-0 flex flex-col justify-start items-center w-full z-10`;
              badge.style.top = `${iconSize + 2}px`;
              badge.style.gap = `${1 * scale}px`;

              const sEl = badge.querySelector(".badge-spot");
              if (sEl) {
                sEl.innerText = "SPOT";
                sEl.className = "bg-[#0ecb81] text-black font-black leading-none tracking-tight rounded-[1px]";
                sEl.style.fontSize = `${3.1 * scale}px`;
                sEl.style.padding = `${1 * scale}px ${1.2 * scale}px`;
              }

              const fEl = badge.querySelector(".badge-futures");
              if (fEl) {
                fEl.innerText = "FUTURES";
                fEl.className = "bg-[#f0b90b] text-black font-black leading-none tracking-tight rounded-[1px]";
                fEl.style.fontSize = `${3.1 * scale}px`;
                fEl.style.padding = `${1 * scale}px ${1.2 * scale}px`;
              }
            }
          });

          // 팝오버 총 크기 및 오프셋 동적 정밀 산출
          const popWidth = (iconSize * 4) + (cellGap * 3) + (popPadding * 2);
          const popHeight = (cellHeight * 2) + (cellGap * 1) + (popPadding * 2) + (14 * scale);

          popoverEl.style.top = `${rect.top + rect.height / 2 - popHeight / 2}px`;
          popoverEl.style.left = `${rect.right + 12}px`; // 🚀 우측 배치

          try {
            popoverEl.showPopover();
            // 자연스러운 페이드인 트랜지션 작동
            requestAnimationFrame(() => {
              popoverEl.style.opacity = "1";
              popoverEl.style.transform = "scale(1)";
            });
          } catch (err) { }
        }
      });

      bodyContainer.addEventListener("mouseout", (e) => {
        const grid = e.target.closest(".exch-grid-trigger");
        if (grid) {
          if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
          if (hideTimeout) clearTimeout(hideTimeout);

          fadeOutTimeout = setTimeout(() => {
            popoverEl.style.opacity = "0";
            popoverEl.style.transform = "scale(0.9)";

            hideTimeout = setTimeout(() => {
              try {
                popoverEl.hidePopover();
              } catch (err) { }
            }, 150); // 페이드아웃 트랜지션 시간 대기
          }, 50); // 호버 이탈 시 즉각적인 깜빡임 보정을 위한 딜레이
        }
      });
    }
  });
}

