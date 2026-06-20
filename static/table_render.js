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
  const pureSymbol = row.Symbol;
  const tId = row.Ticker; // 🚀 DOM ID용 완벽한 고유키
  rowEl.dataset.sym = tId; // 🚀 화면 추적용

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
    ${
      pendingAction
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
        ${
          pendingAction
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
    <div class="flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5 text-right">
      <span class="text-[11px] font-tempTestDss font-bold truncate">-</span>
      <span class="text-[10px] font-bold mt-0.5 truncate opacity-0">-</span>
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
  <div class="p-2 col-exch overflow-hidden exch-placeholder">
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
  if (counterEl && rowEl.dataset.index !== undefined) {
    counterEl.textContent = parseInt(rowEl.dataset.index) + 1;
  }
}

export function updateRowDynamicHTML(rowEl, row) {
  const tId = row.Ticker;
  const p = row.precision || 2;
  const currentMarket = store.currentMarket || "ALL";
  let nPrice = row.Price_Raw ?? 0;
  let n24h = row.Change_24h_Raw ?? 0;
  0.0;
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
  }

  const formattedPrice = formatSmartPrice(nPrice, p);

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
  const priceCell = rowEl.querySelector(".col-price");
  if (priceCell) {
    priceCell.classList.remove("price-placeholder");
    priceCell.innerHTML = `
      <div class="flex flex-col leading-tight min-w-0 gap-0.5">
        <div id="price-${tId}" data-raw-price="0" class="font-medium text-[14px] text-theme-text price-cell tracking-tighter truncate block flex items-center">
          <span id="price-val-binance-${tId}" class="hidden items-center">
            <span class="price-num">-</span>
            <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
              <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png" alt="binance" class="w-full h-full object-contain rounded-[2px]" />
              <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-medium px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
            </div>
          </span>
          <span id="price-val-bybit-${tId}" class="hidden items-center">
            <span class="price-num">-</span>
            <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
              <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png" alt="bybit" class="w-full h-full object-contain rounded-[2px]" />
              <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-medium px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
            </div>
          </span>
          <span id="price-val-upbit-${tId}" class="hidden items-center">
            <span class="price-num">-</span>
            <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
              <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/351.png" alt="upbit" class="w-full h-full object-contain rounded-[2px]" />
              <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-medium px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
            </div>
          </span>
          <span id="price-val-bithumb-${tId}" class="hidden items-center">
            <span class="price-num">-</span>
            <div class="relative inline-flex items-center justify-center w-[12px] h-[12px] rounded-[2px] overflow-visible bg-white/2 ml-1 align-middle flex-shrink-0">
              <img src="https://s2.coinmarketcap.com/static/img/exchanges/64x64/200.png" alt="bithumb" class="w-full h-full object-contain rounded-[2px]" />
              <div class="price-futures-badge absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-medium px-[2px] rounded-[2px] leading-none z-10 scale-75 hidden">F</div>
            </div>
          </span>
        </div>
        <div class="flex items-center justify-between gap-1 text-[10px] font-medium text-left mt-0.5 w-full min-w-0">
          ${(() => {
            const chgText = `${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%`;
            const todayText = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;

            // 🚀 세자리/네자리 폭등락 대응: 글자 수가 7글자(예: +123.45%)를 넘으면 폰트 크기를 동적으로 축소
            const chgFontSize =
              chgText.length > 7 ? "text-[9px]" : "text-[10px]";
            const todayFontSize =
              todayText.length > 7 ? "text-[9px]" : "text-[10px]";

            return `
              <span id="change-${tId}" class="${color24h} ${chgFontSize} whitespace-nowrap flex-shrink-0">${chgText}</span>
              <span id="today-${tId}" class="${colorDay} ${todayFontSize} whitespace-nowrap flex-shrink-0">${todayText}</span>
            `;
          })()}
        </div>
      </div>
    `;
  }

  // 🚀 바이낸스 볼륨/시총 렌더링
  const volBCell = rowEl.querySelector(".col-vol-b");
  if (volBCell) {
    const volBText =
      row.Volume_Formatted &&
      row.Volume_Formatted !== "-" &&
      row.Volume_Formatted !== "0"
        ? row.Volume_Formatted
        : "-";
    let volBStyle = "";
    const fs = CONFIG.FONT_SCALE;
    if (fs && volBText.length > fs.VOL_THRESHOLD) {
      const size = Math.max(
        fs.VOL_MIN_SIZE,
        fs.VOL_BASE_SIZE -
          (volBText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP,
      );
      volBStyle = `style="font-size: ${size}px;"`;
    }

    const mcapText = row.MarketCap_Formatted || "-";
    let mcapStyle = "";
    if (fs && mcapText.length > fs.MCAP_THRESHOLD) {
      const size = Math.max(
        fs.MCAP_MIN_SIZE,
        fs.MCAP_BASE_SIZE -
          (mcapText.length - fs.MCAP_THRESHOLD) * fs.MCAP_REDUCE_STEP,
      );
      mcapStyle = `style="font-size: ${size}px;"`;
    }

    volBCell.classList.remove("vol-b-placeholder");
    volBCell.innerHTML = `
      <div class="flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5">
        <span id="vol-binance-${tId}" class="text-[#f0b90b] text-[11px] font-tempTestDss font-bold truncate" ${volBStyle}>${volBText}</span>
        <span id="mcap-${tId}" class="text-[10px] font-bold opacity-60 text-left mt-0.5 truncate" ${mcapStyle}>${mcapText}</span>
      </div>
    `;
  }

  // 🚀 업비트 볼륨/VMC 렌더링
  const volUCell = rowEl.querySelector(".col-vol-u");
  if (volUCell) {
    const volUText =
      row.Upbit_Vol_Formatted &&
      row.Upbit_Vol_Formatted !== "-" &&
      row.Upbit_Vol_Formatted !== "0"
        ? row.Upbit_Vol_Formatted
        : "-";
    let volUStyle = "";
    const fs = CONFIG.FONT_SCALE;
    if (fs && volUText.length > fs.VOL_THRESHOLD) {
      const size = Math.max(
        fs.VOL_MIN_SIZE,
        fs.VOL_BASE_SIZE -
          (volUText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP,
      );
      volUStyle = `style="font-size: ${size}px;"`;
    }

    let vmcStyle = "";
    if (fs && vmcFormatted.length > fs.VMC_THRESHOLD) {
      const size = Math.max(
        fs.VMC_MIN_SIZE,
        fs.VMC_BASE_SIZE -
          (vmcFormatted.length - fs.VMC_THRESHOLD) * fs.VMC_REDUCE_STEP,
      );
      vmcStyle = `style="font-size: ${size}px;"`;
    }

    volUCell.classList.remove("vol-u-placeholder");
    volUCell.innerHTML = `
      <div class="flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5 text-right">
        <span id="vol-upbit-${tId}" class="text-[#093687] text-[11px] font-tempTestDss font-bold truncate" ${volUStyle}>${volUText}</span>
        <span id="vmc-${tId}" class="text-[10px] font-bold opacity-60 mt-0.5 truncate ${vmcColorClass}" ${vmcStyle}>${vmcFormatted}</span>
      </div>
    `;
  }

  // 🚀 김프/펀딩비 렌더링
  const kimchiCell = rowEl.querySelector(".col-kimch");
  if (kimchiCell) {
    kimchiCell.classList.remove("kimchi-placeholder");
    kimchiCell.innerHTML = `
      <div class="flex flex-col h-full justify-center leading-tight items-start min-w-0">
        <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
           ${
             !row.Kimchi_Label || row.Kimchi_Label === "-"
               ? `<span class="text-[12px] font-medium text-theme-text opacity-40">-</span>`
               : `<span class="text-[12px] font-medium truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}">${row.Kimchi_Formatted || "0.0%"}</span>`
           }
        </div>
        <div class="flex items-center justify-start gap-2 text-[10px] font-medium mt-0.5 min-w-0 max-w-full">
           <span class="text-theme-accent opacity-70 truncate">${row.Funding_Formatted || "-"}</span>
        </div>
      </div>
    `;
  }

  // 🚀 상장 거래소 그리드 렌더링 (그레이스케일 필터 연산)
  const exchCell = rowEl.querySelector(".col-exch");
  if (exchCell) {
    exchCell.classList.remove("exch-placeholder");
    exchCell.innerHTML = `
      <div class="grid grid-cols-4 content-center h-full gap-[2px] w-fit text-left min-w-0">
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
                ? `<div class="absolute -top-1.5 -right-1.5 bg-[#f0b90b] text-black text-[8px] font-medium px-[2px] rounded-[2px] leading-none z-10 scale-[0.65]">F</div>`
                : "";
              const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
              return `
              <div class="relative w-[14px] h-[14px] flex items-center justify-center rounded-[2px] overflow-visible bg-white/5 transition-all flex-shrink-0"
                   style="${isListed ? "filter: none; opacity: 1;" : "filter: grayscale(1); opacity: 0.1;"}">
                <img src="${imgUrl}" alt="${ex.id}" class="w-full h-full object-contain rounded-[2px]" />
                ${isListed ? badgeHtml : ""}
              </div>
            `;
            })
            .join("");
        })()}
      </div>
    `;
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
          const rowEl = entry.target;
          const sym = rowEl.dataset.sym;
          if (!sym) return;

          const rowData = store.tickerRowMap.get(sym.toUpperCase());
          if (entry.isIntersecting) {
            if (rowData) {
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
      const rowEl = document.createElement("div");
      rowEl.classList.add("coin-row");
      if (i < 30) {
        rowEl.classList.add("flip-row");
      }
      rowEl.dataset.index = i;
      rowEl.style.height = "52px"; // 🚀 고정 높이 할당으로 완벽한 800개 스크롤 바 생성!
      rowEl.style.position = "absolute";
      rowEl.style.transform = `translateY(${i * 52}px)`;
      rowEl.style.contain = "content"; // 🚀 브라우저 렌더링 격리 최적화!

      const rowData = filteredData[i];
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
    tbody.style.height = `${totalCount * 52}px`;
    tbody.appendChild(fragment);
    store.tablePoolInitialized = true;
    updateBoundaryClass(tbody);
    applySelectedHighlight();
    if (typeof window.refreshSniperTarget === "function") {
      setTimeout(() => window.refreshSniperTarget(), 10);
    }
    return;
  }

  // 2. 이미 풀이 생성되어 있다면? (물리적 DOM 추가/삭제 없이 각 코인의 고유 상자 위치를 translateY로 재배치!)
  store.visibleSymbols.clear();
  tbody.style.height = `${totalCount * 52}px`;

  for (let i = 0; i < totalCount; i++) {
    const rowData = filteredData[i];
    if (rowData) {
      const rowEl = store.rowDomMap.get(rowData.Ticker);
      if (rowEl) {
        const oldIndex = parseInt(rowEl.dataset.index);
        const needsPositionUpdate = !isRealtime || i < 30 || oldIndex < 30 || isNaN(oldIndex);

        if (needsPositionUpdate) {
          rowEl.dataset.index = i;
          rowEl.style.transform = `translateY(${i * 52}px)`;

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
  element.classList.remove("flash-up", "flash-down");

  // 🚀 [기존 로직 100% 보존 + 렉 제로]
  // 기존 동기식 offsetWidth(렉 주범) 대신 비동기식 requestAnimationFrame을 사용하여
  // 브라우저 렌더링 큐를 막지 않고 CSS 애니메이션을 부드럽게 리스타트 시킵니다.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.classList.add(flashClass);
      setTimeout(() => element.classList.remove(flashClass), 500);
    });
  });
}

window.updateRowPriceDisplay = (target, row) => {
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

  const currentMarket = store.currentMarket || "ALL";
  let binanceP = row.Binance_Price || null;
  let bybitP = row.Bybit_Price || null;

  if (currentMarket === "FUTURES") {
    binanceP = row.Binance_Price_Futures ?? binanceP;
    bybitP = row.Bybit_Price_Futures ?? bybitP;
  } else if (currentMarket === "SPOT") {
    binanceP = row.Binance_Price_Spot ?? binanceP;
    bybitP = row.Bybit_Price_Spot ?? bybitP;
  } else if (currentMarket === "BYBIT") {
    bybitP = row.Bybit_Price_Spot ?? bybitP;
  } else if (currentMarket === "BYBIT_FUTURES") {
    bybitP = row.Bybit_Price_Futures ?? bybitP;
  }

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
      // 🚀 [성능 극대화] innerText는 CSS 레이아웃을 계산하므로 렌더링 폭탄입니다. 단순 textContent로 교체하여 브라우저 부담을 90% 이상 줄입니다.
      // 🚀 또한 값이 실제로 다를 때만 DOM을 건드리도록 방어코드 추가 (DOM Mutation 렉 차단)
      if (numEl && numEl.textContent !== formattedPrice) {
        numEl.textContent = formattedPrice;
      }

      // 🚀 글자 수에 비례하여 동적으로 폰트 크기 축소
      const len = formattedPrice.length;
      const fs = CONFIG.FONT_SCALE;
      if (fs && len > fs.PRICE_THRESHOLD) {
        const sizePx = Math.max(
          fs.PRICE_MIN_SIZE,
          fs.PRICE_BASE_SIZE -
            (len - fs.PRICE_THRESHOLD) * fs.PRICE_REDUCE_STEP,
        );
        parentEl.style.fontSize = `${sizePx}px`;
      } else {
        parentEl.style.fontSize = "";
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
};
