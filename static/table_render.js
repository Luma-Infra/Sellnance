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
  const tr = document.createElement("tr");
  const ticker = row.Ticker; // 🚀 중복 없는 유니크 티커 사용 (BTCKRW != BTCUSDT)
  tr.dataset.sym = ticker;
  tr.style.position = "relative";

  updateRowInnerHTML(tr, row);

  if (store.tableObserver) store.tableObserver.observe(tr);
  return tr;
}

export function updateRowInnerHTML(tr, row) {
  const pureSymbol = row.Symbol;
  const tId = row.Ticker; // 🚀 DOM ID용 완벽한 고유키
  tr.dataset.sym = tId; // 🚀 화면 추적용

  // 🐛 [DEBUG] 데이터 침범 및 오염 추적용 로그
  if (!row.Ticker || !row.Symbol) {
    console.error(
      "[TABLE DEBUG] 🚨 비정상 데이터 유입 (Ticker/Symbol 누락)!",
      row,
    );
  }
  // console.log(
  //   `[TABLE DEBUG] 렌더링 -> Ticker: ${tId}, 현재 tr.sym: ${tr.dataset.sym}, 가격: ${row.Price_Raw}`,
  // );

  const p = row.precision || 2;
  const n24h = row.Change_24h_Raw ?? 0;
  const nPrice = row.Price_Raw ?? 0;

  const formattedPrice = formatSmartPrice(nPrice, p);

  const color24h =
    n24h > 0
      ? "text-theme-up"
      : n24h < 0
        ? "text-theme-down"
        : "text-theme-text";

  const favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  const favorites2 = JSON.parse(
    localStorage.getItem("sellnance_favs2") || "[]",
  );
  const uId = row.UID; // 🚀 백엔드에서 제공하는 근본 고유 식별키 (final_ucid)
  const isFav = favorites.includes(uId);
  const isFav2 = favorites2.includes(uId);

  const pendingAction =
    store.pendingFavActions && store.pendingFavActions.get(uId);
  tr.dataset.renderedPending = pendingAction ? "true" : "false";
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

  const isDetailed = store.viewMode === "detailed";
  const nDay = row.Change_Today_Raw ?? 0;
  const colorDay =
    nDay > 0
      ? "text-theme-up"
      : nDay < 0
        ? "text-theme-down"
        : "text-theme-text";

  // 🚀 [최신] 2층 구조 레이아웃 (디자인 가이드 준수 + z_style.css 단일 관리소 강제 종속)
  tr.innerHTML = `
  <td class="p-2 col-asset overflow-hidden">
    ${pendingAction
      ? `
      <div class="row-progress-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 2.5px; z-index: 50; pointer-events: none;">
         <div id="progress-bar-${row.Ticker}" class="row-progress-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%); transition: width 50ms linear;"></div>
      </div>
      : ""
    }
    <div class="flex items-center gap-1.5 min-w-0">
      <!-- 0. 절대 순위 번호 (1 ~ max length 고정 배치, CSS 카운터 기반) -->
      <span class="row-counter text-[10px] font-mono font-bold text-theme-text opacity-40 w-[14px] text-right flex-shrink-0 mr-[2px]"></span>
 
      <!-- 1. 별 버튼 (완전 분리) -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="toggleFavorite('${uId}', event)" class="star-btn text-[14px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
        <button onclick="toggleFavorite('${uId}', event)" class="star-btn text-[14px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
          ${starText}
        </button>
        ${pendingAction
        ? `
          <button onclick="window.confirmFavoriteChange('${uId}', event)" class="confirm-fav-btn text-[9px] font-bold px-1.5 py-0.5 rounded transition-all flex-shrink-0 mr-1">
            확인
          </button>
            취소
          </button>
        `
        : ""
      }
    }
      </div>
      
      <!-- 2. 티커 이미지 (고정 영역) rounded-full 제거 -->
      <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/1 overflow-hidden">
        ${row.Logo || ""}
      </div>
      
        <b class="text-[12px] text-theme-text truncate font-black tracking-tighter">${row.DisplayTicker || row.Symbol}</b>
        <span class="text-[9px] text-theme-text opacity-60 truncate font-bold tracking-tighter">
        <b class="text-[12px] text-theme-text truncate font-black tracking-tighter">${row.DisplayTicker || row.Symbol}</b>
        <span class="text-[9px] text-theme-text opacity-60 truncate font-bold tracking-tighter">
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
    <div class="flex flex-col leading-tight min-w-0 gap-0.5">
      <div id="price-${tId}" data-raw-price="0" class="font-black text-[14px] text-theme-text price-cell tracking-tighter truncate block flex items-center">
        <span id="price-val-binance-${tId}" class="hidden items-center">
          <span class="price-num">-</span>
          <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png" alt="binance" class="w-full h-full object-contain rounded-[2px]" />
            <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-black px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
          </div>
        </span>
        <span id="price-val-bybit-${tId}" class="hidden items-center">
          <span class="price-num">-</span>
          <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png" alt="bybit" class="w-full h-full object-contain rounded-[2px]" />
            <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-black px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
          </div>
        </span>
        <span id="price-val-upbit-${tId}" class="hidden items-center">
          <span class="price-num">-</span>
          <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/351.png" alt="upbit" class="w-full h-full object-contain rounded-[2px]" />
            <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-black px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
          </div>
        </span>
        <span id="price-val-bithumb-${tId}" class="hidden items-center">
          <span class="price-num">-</span>
          <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
            <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/200.png" alt="bithumb" class="w-full h-full object-contain rounded-[2px]" />
            <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-black px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
          </div>
        </span>
      </div>
      <div class="flex items-center justify-between gap-2 text-[10px] font-black text-left mt-0.5 w-full min-w-0">
        <span id="change-${tId}" class="${color24h} ${store.currentSortCol === "Change_Today" ? "opacity-40" : "opacity-100"} flex-1 text-left truncate">${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%</span>
        <span id="today-${tId}" class="${colorDay} ${store.currentSortCol === "Change_Today" ? "opacity-100" : "opacity-40"} flex-1 text-left truncate">${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%</span>
      </div>
    </div>
  </td>
  <td class="p-2 col-mcap overflow-hidden">
    <div class="flex flex-col leading-tight min-w-0 gap-0.5">
      <div class="flex items-center justify-between gap-1 w-full min-w-0 truncate text-[11px] font-mono">
        <span id="vol-binance-${tId}" class="text-[#f0b90b] font-bold truncate">${row.Volume_Formatted && row.Volume_Formatted !== "-" && row.Volume_Formatted !== "0" ? row.Volume_Formatted : "-"}</span>
        <span id="vol-upbit-${tId}" class="text-[#093687] font-bold truncate">${row.Upbit_Vol_Formatted && row.Upbit_Vol_Formatted !== "-" && row.Upbit_Vol_Formatted !== "0" ? row.Upbit_Vol_Formatted : "-"}</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-[10px] font-black opacity-60 text-left mt-0.5 w-full min-w-0">
        <span class="flex-1 text-left truncate">${row.MarketCap_Formatted || "0"}</span>
        <span class="text-theme-accent flex-1 text-left truncate">${row.VMC_Formatted || "0.0%"}</span>
      </div>
    </div>
  </td>
  <td class="p-2 text-left col-kimch overflow-hidden">
    <div class="flex flex-col leading-tight items-start min-w-0">
  <td class="p-2 text-left col-kimch overflow-hidden">
    <div class="flex flex-col leading-tight items-start min-w-0">
      <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
         ${!row.Kimchi_Label || row.Kimchi_Label === "-"
        ? `<span class="text-[12px] font-black text-theme-text opacity-40">-</span>`
        : `<span class="text-[12px] font-black truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}">${row.Kimchi_Formatted || "0.0%"}</span>`
      }
      </div>
      <div class="flex items-center justify-start gap-2 text-[10px] font-black mt-0.5 min-w-0 max-w-full">
         <span class="text-theme-accent opacity-70 truncate">${row.Funding_Formatted || "-"}</span>
  <td class="p-2 col-exch overflow-hidden">
    <div class="grid grid-cols-4 gap-[2px] w-fit text-left min-w-0">
  <td class="p-2 col-exch overflow-hidden">
    <div class="grid grid-cols-4 gap-[2px] w-fit text-left min-w-0">
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
            const badgeHtml = isFutures
              ? `<div class="absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-black px-[2px] rounded-[2px] leading-none z-10 scale-[0.65]">F</div>`
              : "";
            const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
            return `
            <div class="relative w-[14px] h-[14px] flex items-center justify-center rounded-[2px] overflow-visible bg-white/5 transition-all flex-shrink-0"
                 style="${isListed ? "filter: none; opacity: 1;" : "filter: grayscale(1); opacity: 0.1;"}">
              <img src="${imgUrl}" alt="${ex.id}" class="w-full h-full object-contain rounded-[2px]" />
            </div>
          `;
          })
          .join("");
      })()}
    </div>
  </td>
  <td class="p-2 col-listing overflow-hidden text-[10px] font-mono whitespace-nowrap text-left opacity-70 truncate" id="listing-${tId}">
  </td>
`
  window.updateRowPriceDisplay(tr, row);
}

// 🚀 [신규 아키텍처] 고정 DOM 풀 및 Lazy 렌더링 상태 관리
store.tablePoolInitialized = false;

// 🚀 [신규] 텅 빈 껍데기 상태일 때도 테이블 가로 구분선(그리드)이 100% 완벽하게 보이도록 유지하는 빈 셀 템플릿!
const EMPTY_ROW_HTML = `
  <td class="p-2 col-asset overflow-hidden">
    <div class="flex items-center gap-1.5 min-w-0">
      <!-- 빈 껍데기 상태에서도 고정된 행 번호는 보이도록 유지 (CSS 카운터 기반) -->
      <span class="row-counter text-[10px] font-mono font-bold text-theme-text opacity-40 w-[14px] text-right flex-shrink-0 mr-[2px]"></span>
    </div>
  </td>
  <td class="p-2 col-price overflow-hidden"></td>
  <td class="p-2 col-mcap overflow-hidden"></td>
  <td class="p-2 col-kimch overflow-hidden"></td>
  <td class="p-2 col-exch overflow-hidden"></td>
  <td class="p-2 col-listing overflow-hidden"></td>
`;

export function renderTable(isRealtime = false) {
  const tbody = document.getElementById("table-body");
  if (!tbody) return;

  const filteredData = getFilteredData();
  const totalCount = filteredData.length;

  // 🚀 [사건 X] 필터링, 정렬, 검색, 탭전환 등 화면 구성 변화 시 반드시 상위 30개 코인을 visibleSymbols에 등록하여 실시간 구독 시작
  if (!isRealtime) {
    store.visibleSymbols.clear();
    const initLimit = Math.min(30, totalCount);
  }
}

// 1. 최초 1회 전체 껍데기 풀(Pool) 생성 (DOM 파괴/생성 원천 차단, 가상화 스크롤 바 확보)
if (!store.tablePoolInitialized || tbody.children.length !== totalCount) {
  tbody.innerHTML = "";
  store.rowDomMap = new Map();
  store.visibleSymbols.clear();
  store.lastSortedTickers = null; // 🚀 풀 재구성 시 정렬 비교 캐시도 초기화!

  if (store.tableObserver) {
    store.tableObserver.disconnect();
  }

  // 🚀 화면 추적용 옵저버 (화면에 들어오면 Lazy하게 내용 채워넣기!)
  store.tableObserver = new IntersectionObserver(
    (entries) => {
      let changed = false;
      entries.forEach((entry) => {
        const tr = entry.target;
        const sym = tr.dataset.sym;
        if (!sym) return;

        const rowData = store.tickerRowMap.get(sym.toUpperCase());
        if (entry.isIntersecting) {
          if (rowData) {
            if (!store.visibleSymbols.has(rowData.Ticker)) {
              store.visibleSymbols.add(rowData.Ticker);
              changed = true;
            }
            // 🚀 [성능 최적화] 무조건 updateRowInnerHTML를 부르지 않고, 내용이나 설정이 바뀐 경우에만 선별적으로 렌더링하여 layout thrashing 차단!
            const isPending = !!(
              store.pendingFavActions &&
              store.pendingFavActions.has(rowData.UID)
            );
            const needsRender =
              !tr.dataset.renderedSym ||
              tr.dataset.renderedSym !== rowData.Ticker ||
              tr.dataset.renderedCurrency !== store.currencyMode ||
              tr.dataset.renderedLang !== store.lang ||
              (tr.dataset.renderedPending === "true") !== isPending;
            if (needsRender) {
              updateRowInnerHTML(tr, rowData);
              tr.dataset.renderedSym = rowData.Ticker;
              tr.dataset.renderedCurrency = store.currencyMode;
              tr.dataset.renderedLang = store.lang;
            }
          }
        } else {
          if (rowData) {
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
  for (let i = 0; i < totalCount; i++) {
    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.style.height = "52px"; // 🚀 고정 높이 할당으로 완벽한 800개 스크롤 바 생성!
    tr.style.position = "relative";
    tr.style.contain = "content"; // 🚀 브라우저 렌더링 격리 최적화!
    tr.classList.add("flip-row"); // 🚀 FLIP 애니메이션용 클래스 추가!

    const rowData = filteredData[i];
    if (rowData) {
      tr.dataset.sym = rowData.Ticker;
      store.rowDomMap.set(rowData.Ticker, tr);
      // 최초 화면에 보일 법한 상위 20개만 즉시 렌더링, 나머지는 빈 껍데기 그리드로 Lazy 대기!
      if (i < 20) {
        updateRowInnerHTML(tr, rowData);
        tr.dataset.renderedSym = rowData.Ticker;
        tr.dataset.renderedCurrency = store.currencyMode;
        tr.dataset.renderedLang = store.lang;
        // 🚀 Pre-populate visibleSymbols for immediate real-time updates on load
        store.visibleSymbols.add(rowData.Ticker);
      } else {
        // 🚀 껍데기 상태일 때도 가로 구분선이 완벽히 유지되도록 EMPTY_ROW_HTML 삽입!
        tr.innerHTML = EMPTY_ROW_HTML;
        tr.dataset.renderedSym = "";
        tr.dataset.renderedCurrency = "";
        tr.dataset.renderedLang = "";
        tr.dataset.renderedPending = "false";
      }
    }
    store.tableObserver.observe(tr);
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  store.tablePoolInitialized = true;
  applySelectedHighlight();
  if (typeof window.refreshSniperTarget === "function") {
    setTimeout(() => window.refreshSniperTarget(), 10);
  }
  return;
}

// 2. 이미 풀이 생성되어 있다면? (정렬/실시간 갱신 시 물리적 DOM 재배치 + FLIP 애니메이션 발동!)
if (!isRealtime) {
  // 🚀 Clear old visible symbols and rebuild based on the new sorted layout
  store.visibleSymbols.clear();

  // 🚀 [수동 정렬/필터링/초기화] 800개 전체 코인을 순서에 맞게 DOM에 즉시 배치 (FLIP 애니메이션 생략, 0초 만에 바로 꽂기)
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < totalCount; i++) {
    const rowData = filteredData[i];
    if (rowData) {
      const tr = store.rowDomMap.get(rowData.Ticker);
      if (tr) {
        tr.dataset.index = i;

        // 보이고 있는 행이거나 상위 20위권인 경우 즉각 렌더링
        const isPreRender = i < 20;
        if (isPreRender) {
          store.visibleSymbols.add(rowData.Ticker);
        }

        if (isPreRender || store.visibleSymbols.has(rowData.Ticker)) {
          const isPending = !!(
            store.pendingFavActions &&
            store.pendingFavActions.has(rowData.UID)
          );
          const needsRender =
            !tr.dataset.renderedSym ||
            tr.dataset.renderedSym !== rowData.Ticker ||
            tr.dataset.renderedCurrency !== store.currencyMode ||
            tr.dataset.renderedLang !== store.lang ||
            (tr.dataset.renderedPending === "true") !== isPending;
          if (needsRender) {
            updateRowInnerHTML(tr, rowData);
            tr.dataset.renderedSym = rowData.Ticker;
            tr.dataset.renderedCurrency = store.currencyMode;
            tr.dataset.renderedLang = store.lang;
          }
        }
        fragment.appendChild(tr);
      }
    }
  }
  tbody.appendChild(fragment);
  store.lastSortedTickers = null; // 수동 정렬 후 실시간 비교용 캐시 초기화
  applySelectedHighlight();
  if (typeof window.refreshSniperTarget === "function") {
    setTimeout(() => window.refreshSniperTarget(), 10);
  }
  return;
}

let orderChanged = false;
const limit = Math.min(20, totalCount);
if (!store.lastSortedTickers || store.lastSortedTickers.length !== limit) {
  orderChanged = true;
} else {
  for (let i = 0; i < limit; i++) {
    if (store.lastSortedTickers[i] !== filteredData[i].Ticker) {
      orderChanged = true;
      break;
    }
  }
}

if (!orderChanged) {
  // 🚀 [성능 극대화] 정렬 순서가 이전과 동일하다면 DOM 재배치 전체를 건너뛰고 가시 영역만 갱신!
  for (const sym of store.visibleSymbols) {
    const tr = store.rowDomMap.get(sym);
    const rowData = store.tickerRowMap.get(sym.toUpperCase());
    if (tr && rowData) {
      const isPending = !!(
        store.pendingFavActions && store.pendingFavActions.has(rowData.UID)
      );
      const needsRender =
        !tr.dataset.renderedSym ||
        tr.dataset.renderedSym !== rowData.Ticker ||
        tr.dataset.renderedCurrency !== store.currencyMode ||
        tr.dataset.renderedLang !== store.lang ||
        (tr.dataset.renderedPending === "true") !== isPending;
      if (needsRender) {
        updateRowInnerHTML(tr, rowData);
        tr.dataset.renderedSym = rowData.Ticker;
        tr.dataset.renderedCurrency = store.currencyMode;
        tr.dataset.renderedLang = store.lang;
      }
    }
  }
  applySelectedHighlight();
  return;
}

store.lastSortedTickers = filteredData.slice(0, limit).map((r) => r.Ticker);

const firstRects = new Map();
if (store.useFlip && isRealtime) {
  for (const sym of store.visibleSymbols) {
    const tr = store.rowDomMap.get(sym);
    if (tr) {
      firstRects.set(sym, tr.getBoundingClientRect().top);
    }
  }
}

// 🚀 상위 30개 행만 역순(19 -> 0)으로 insertBefore를 호출하여 table-body 맨 앞으로 재배치!
for (let i = limit - 1; i >= 0; i--) {
  const rowData = filteredData[i];
  if (rowData) {

    // 🚀 상위 20위 안의 행은 무조건 즉시 최신 정보로 렌더링
    const isPending = !!(
      store.pendingFavActions && store.pendingFavActions.has(rowData.UID)
    );
    const needsRender =
      !tr.dataset.renderedSym ||
      tr.dataset.renderedSym !== rowData.Ticker ||
      tr.dataset.renderedCurrency !== store.currencyMode ||
      tr.dataset.renderedLang !== store.lang ||
      (tr.dataset.renderedPending === "true") !== isPending;
    if (needsRender) {
      updateRowInnerHTML(tr, rowData);
      tr.dataset.renderedSym = rowData.Ticker;
      tr.dataset.renderedCurrency = store.currencyMode;
      tr.dataset.renderedLang = store.lang;
    }

    tbody.insertBefore(tr, tbody.firstChild);
  }
}

// 🚀 [성능 극대화] FLIP 애니메이션 실행 (레이아웃 쓰레싱을 완벽 소각하기 위해 batch read/write 형태로 전면 개편!)
if (store.useFlip && isRealtime) {
  const moves = [];

  // Pass 1: Batch Reads (동작 시작 위치 확인)
  for (const [sym, firstY] of firstRects.entries()) {
    const tr = store.rowDomMap.get(sym);
    if (tr) {
      const lastY = tr.getBoundingClientRect().top;
      const deltaY = firstY - lastY;
      if (deltaY !== 0) {
        moves.push({ tr, deltaY });
      }
    }
  }

  // Pass 2: Batch Writes (트랜스폼 선언 후 단 1회의 강제 reflow로 렌더링 락인)
  if (moves.length > 0) {
    moves.forEach(({ tr, deltaY }) => {
      tr.style.transition = "none";
      tr.style.transform = `translateY(${deltaY}px)`;
    });
    tbody.offsetHeight; // 단 한 번의 강제 reflow로 모든 엘리먼트 트랜스폼 반영!
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const sym of firstRects.keys()) {
        const tr = store.rowDomMap.get(sym);
        if (tr) {
          tr.style.transition = "";
          tr.style.transform = "";
        }
      }
    });
  });
}

applySelectedHighlight();
if (typeof window.refreshSniperTarget === "function") {
  setTimeout(() => window.refreshSniperTarget(), 10);
}

export function updateVisibleSymbols() {
  // 🚀 [성능 극대화] IntersectionObserver가 이미 store.visibleSymbols를 정밀하고 효율적으로 실시간 관리하고 있으므로,
  // 800개 행의 getBoundingClientRect()를 동기적으로 강제 호출하여 브라우저 전체를 프리징시키던 레거시 레이아웃 쓰레싱 로직을 영구 폐기합니다!
}

export function applySelectedHighlight() {
  const selectedSymbol = store.currentSelectedSymbol;
  if (!selectedSymbol) return;

  document.querySelectorAll("#table-body tr").forEach((tr) => {
    tr.style.outline = "none";
    tr.style.boxShadow = "none";
  });

  const targetTr = document.querySelector(
    `#table-body tr[data-sym="${selectedSymbol}"]`,
  );
  if (targetTr) {
    targetTr.style.outline = "2px solid var(--accent)";
    targetTr.style.outlineOffset = "-2px";
    targetTr.style.boxShadow = "inset 0 0 10px rgba(var(--accent-rgb), 0.2)";
    targetTr.style.zIndex = "10";
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
      const tr = store.rowDomMap.get(row.Ticker);
      if (tr) {
        updateRowInnerHTML(tr, row);
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
    const tr = store.rowDomMap.get(row.Ticker);
    if (tr) {
      updateRowInnerHTML(tr, row);
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
  if (!element || newPrice === oldPrice) return;
  if (!store.useFlip) return;

  const flashClass = newPrice > oldPrice ? "flash-up" : "flash-down";
  element.classList.remove("flash-up", "flash-down");

  // 🚀 [기존 로직 100% 보존 + 렉 제로] 
  // 기존 동기식 offsetWidth(렉 주범) 대신 비동기식 requestAnimationFrame을 사용하여 
  // 브라우저 렌더링 큐를 막지 않고 CSS 애니메이션을 부드럽게 리스타트 시킵니다.
  let parentEl;
  const tId = row.Ticker || row.Symbol;
  if (target instanceof HTMLElement) {
    parentEl = target.querySelector(`#price-${tId}`);
  } else {
    parentEl = document.getElementById(`price-${tId}`);
  }
  if (!parentEl) return;

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";
  const p = store.getPrecision(row.DisplayTicker || row.Symbol);

  const binanceP = row.Binance_Price || null;
  const bybitP = row.Bybit_Price || null;
  const upbitP = row.Upbit_Price || null;
  const bithumbP = row.Bithumb_Price || null;

  let activeExchange = "";
  let displayPrice = 0;

  const isKrwCoin = row.Ticker?.endsWith("KRW");

  if (!isKrwMode) {
    if (isKrwCoin) {
      if (upbitP !== null) {
        activeExchange = "upbit";
        displayPrice = upbitP / rate;
      } else if (bithumbP !== null) {
        activeExchange = "bithumb";
        displayPrice = bithumbP / rate;
      } else if (binanceP !== null) {
        activeExchange = "binance";
        displayPrice = binanceP;
      } else {
        activeExchange = "upbit";
        displayPrice = (row.Price_KRW || 0) / rate;
      }
    } else {
      if (binanceP !== null) {
        activeExchange = "binance";
        displayPrice = binanceP;
      } else if (bybitP !== null) {
        activeExchange = "bybit";
        displayPrice = bybitP;
      } else {
        activeExchange = "binance";
        displayPrice = row.Price_Raw || 0;
      }
    }
  } else {
    if (isKrwCoin) {
      if (upbitP !== null) {
        activeExchange = "upbit";
        displayPrice = upbitP;
      } else if (bithumbP !== null) {
        activeExchange = "bithumb";
        displayPrice = bithumbP;
      } else {
        activeExchange = "upbit";
        displayPrice = row.Price_KRW || 0;
      }
    } else {
      if (binanceP !== null) {
        activeExchange = "binance";
        displayPrice = binanceP * rate;
      } else if (bybitP !== null) {
        activeExchange = "bybit";
        displayPrice = bybitP * rate;
      } else {
        activeExchange = "upbit";
        displayPrice = row.Price_KRW || 0;
      }
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
    let span;
    if (target instanceof HTMLElement) {
      span = target.querySelector(`#price-val-${ex}-${tId}`);
    } else {
      span = document.getElementById(`price-val-${ex}-${tId}`);
    }
    if (!span) return;

    if (ex === activeExchange) {
      const formattedPrice = isKrwMode
        ? `${Number(displayPrice).toLocaleString()} 원`
        : window.formatSmartPrice(displayPrice, p);

      const numEl = span.querySelector(".price-num");
      if (numEl) numEl.innerText = formattedPrice;

      const isFutures = row.Listed_Exchanges?.includes(
        `${ex.toUpperCase()}_FUTURES`,
      );
      const badge = span.querySelector(".price-futures-badge");
      if (badge) {
        if (isFutures) {
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }

      span.classList.remove("hidden");
      span.classList.add("inline-flex");
    } else {
      span.classList.add("hidden");
      span.classList.remove("inline-flex");
    }
  });

  parentEl.setAttribute("data-raw-price", displayPrice);
  parentEl.setAttribute("data-active-exchange", activeExchange);
};
