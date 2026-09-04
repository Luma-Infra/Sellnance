// table_row_builder.js
// 🧱 [테이블 행(Row) DOM 생성 및 정적/동적 셀 렌더링 모듈]
// 1. createRowElement, updateRowStaticHTML, updateRowDynamicHTML, updateRowInnerHTML
// 2. applyPriceFlash, window.updateRowPriceDisplay, window.traceMetricCall

import { store, CONFIG } from "./_store.js";
import { formatSmartPrice, getMultiplier, getPureBase } from "./chart_utils.js";
import {
  isFuturesCoin,
  getRowDisplayMetrics,
  getDisplayTickerHtml,
  getRowExchangeMeta,
} from "./_market_rules.js";
import { getWarningBadgeHtml, getListingDate, formatListingDateWithExchange } from "./table_badges.js";

export function createRowElement(row) {
  const rowEl = document.createElement("div");
  rowEl.classList.add("coin-row");
  if (row.isDelisted) {
    rowEl.classList.add("opacity-40", "grayscale", "hover:opacity-90", "transition-opacity");
  }
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

  if (row.isDelisted) {
    rowEl.classList.add("opacity-40", "grayscale", "hover:opacity-90", "transition-opacity");
  } else {
    rowEl.classList.remove("opacity-40", "grayscale", "hover:opacity-90");
  }

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
  <div class="p-2 col-asset overflow-visible">
    ${pendingAction
      ? `
      <div class="row-progress-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 2.5px; z-index: 50; pointer-events: none;">
         <div id="progress-bar-${row.Ticker}" class="row-progress-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%); transition: width 50ms linear;"></div>
      </div>
    `
      : ""
    }
    <div class="flex items-center gap-0.5 min-w-0 w-full">
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
        ${row.Logo || `<img src="${document.body?.classList.contains('theme-upbit') ? '/static/luma-deer-svg-light.svg' : '/static/luma-deer-svg-dark.svg'}" class="fallback-logo" loading="lazy" style="width: 24px; height: 24px; vertical-align: middle; border-radius: 50%;">`}
      </div>
      
      <!-- 3. 티커 & 이름 -->
      <div class="flex flex-col leading-[1.1] min-w-0 flex-1">
        <b class="text-[12px] text-theme-text truncate font-medium tracking-tighter">
          ${getDisplayTickerHtml(row)}
        </b>
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
      <!-- 4. 유의/상폐 경고 뱃지 (셀 우측 끝에 배치) -->
      ${row.isDelisted ? `<span class="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] px-1 py-0.5 rounded font-bold ml-auto shrink-0">상폐</span>` : getWarningBadgeHtml(row.Warnings)}
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
    <div class="kimchi-container flex flex-col h-full justify-center leading-tight items-start min-w-0">
      <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
        <span class="kimchi-pct text-[12px] font-medium truncate">-</span>
      </div>
      <div class="flex items-center justify-start gap-2 text-[10px] font-medium mt-0.5 min-w-0 max-w-full">
        <span class="funding-val text-theme-accent opacity-70 truncate">-</span>
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
      debugArea.className =
        "first-row-debug-area absolute bottom-1 left-[10px] right-2 h-[165px] flex flex-col justify-start border-t border-[#ff0055]/30 text-[9px] text-[#ff0055] font-semibold font-mono z-50 pointer-events-none p-1.5 bg-[#1a050f]/85 rounded-b-md";
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
      if (
        stack.includes("stream.js") ||
        stack.includes("stream_korea.js") ||
        stack.includes("updateStatus")
      ) {
        callerId = "1 (Stream)";
      } else if (
        stack.includes("chart_utils.js") ||
        stack.includes("chart.js") ||
        stack.includes("chart_data.js")
      ) {
        callerId = "2 (Chart)";
      }
      const debugText = `${callerId}`;
      const firstRowDebug = document.querySelector(
        '#coin-list-body > div[data-index="0"] .first-row-debug-area',
      );
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
  if (row.Ticker === store.currentSelectedSymbol) {
    lightweight = false;
  }
  //   window.syncRowPrioritizedMetrics(row);
  // }
  const tId = row.Ticker;
  const p =
    row.precision !== undefined && row.precision !== null
      ? Number(row.precision)
      : store.getPrecision(row.Ticker || row.DisplayTicker || row.Symbol);
  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrw = store.currencyMode === "KRW";

  const { displayPrice: nPrice, n24h, nDay, activeExchange } = getRowDisplayMetrics(row, isKrw, rate);
  const formattedPrice = formatSmartPrice(nPrice, p, isKrw);

  const color24h =
    n24h > 0
      ? "text-theme-up"
      : n24h < 0
        ? "text-theme-down"
        : "text-theme-text";

  const colorDay =
    nDay > 0
      ? "text-theme-up"
      : nDay < 0
        ? "text-theme-down"
        : "text-theme-text";

  const vmcFormatted = row.VMC_Formatted || "-";
  const vmcColorClass = "text-theme-text";

  // 🚀 가격, 등락률 렌더링
  const priceCell =
    rowEl._priceCell || (rowEl._priceCell = rowEl.querySelector(".col-price"));
  if (priceCell) {
    priceCell.classList.remove("price-placeholder");

    // 구조가 없으면 최초 1회만 innerHTML 생성
    let container = priceCell._container;
    if (!container) {
      container = priceCell.querySelector(".price-container");
      if (!container) {
        priceCell.innerHTML = `
          <div class="price-container flex flex-col leading-tight min-w-0 gap-0.5">
            <div id="price-${tId}" data-raw-price="0" class="font-medium text-[14px] text-theme-text price-cell tracking-tighter block flex items-center min-w-0">
              <span class="price-num whitespace-nowrap">${formattedPrice}</span>
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

    // 🚀 가격 수치 및 data-raw-price 실시간 갱신 (플래시 애니메이션 및 폰트 축소 연동)
    const priceDiv =
      container._priceDiv ||
      (container._priceDiv = container.querySelector(`#price-${tId}`));
    if (priceDiv) {
      const numEl =
        priceDiv._numEl ||
        (priceDiv._numEl = priceDiv.querySelector(".price-num"));
      if (numEl) {
        const oldPrice = parseFloat(priceDiv.getAttribute("data-raw-price") || "0");
        if (numEl.textContent !== formattedPrice) {
          if (oldPrice > 0 && nPrice > 0 && oldPrice !== nPrice && typeof window.applyPriceFlash === "function") {
            window.applyPriceFlash(numEl, nPrice, oldPrice);
          }
          numEl.textContent = formattedPrice;

          // 🚀 글자 수에 비례하여 폰트 크기 유동 축소
          const len = formattedPrice.length;
          const fs = CONFIG.FONT_SCALE;
          const threshold = fs?.PRICE_THRESHOLD || 8;
          if (len > threshold) {
            const sizePx = Math.max(
              fs?.PRICE_MIN_SIZE || 11,
              (fs?.PRICE_BASE_SIZE || 14) - (len - threshold) * (fs?.PRICE_REDUCE_STEP || 0.6),
            );
            if (priceDiv.style.fontSize !== `${sizePx}px`)
              priceDiv.style.fontSize = `${sizePx}px`;
          } else {
            if (priceDiv.style.fontSize !== "") priceDiv.style.fontSize = "";
          }
        }
      }
      priceDiv.setAttribute("data-raw-price", nPrice);
      priceDiv.setAttribute("data-active-exchange", activeExchange || "binance");
    }

    // Direct textContent 및 클래스 갱신 (리플로우 방지)
    const chgText = `${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%`;
    const todayText = `${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%`;

    const changeEl =
      container._changeEl ||
      (container._changeEl = container.querySelector(`#change-${tId}`));
    if (changeEl) {
      changeEl.textContent = chgText;
      changeEl.className = `${color24h} ${chgText.length > 7 ? "text-[9px]" : "text-[10px]"} whitespace-nowrap flex-shrink-0`;
    }

    const todayEl =
      container._todayEl ||
      (container._todayEl = container.querySelector(`#today-${tId}`));
    if (todayEl) {
      todayEl.textContent = todayText;
      todayEl.className = `${colorDay} ${todayText.length > 7 ? "text-[9px]" : "text-[10px]"} whitespace-nowrap flex-shrink-0`;
    }
  }

  // 🚀 바이낸스 볼륨/시총 렌더링
  const volBCell =
    rowEl._volBCell || (rowEl._volBCell = rowEl.querySelector(".col-vol-b"));
  if (volBCell) {
    volBCell.classList.remove("vol-b-placeholder");

    let container = volBCell._container;
    if (!container) {
      container = volBCell.querySelector(".vol-b-container");
      if (!container) {
        volBCell.innerHTML = `
          <div class="vol-b-container flex flex-col h-full justify-center leading-tight min-w-0 gap-0.5">
            <span id="vol-binance-${tId}" class="text-binance-color text-[11px] font-tempTestDss font-bold truncate"></span>
            <span id="mcap-${tId}" class="text-[10px] font-bold opacity-60 text-left mt-0.5 truncate"></span>
          </div>
        `;
        container = volBCell.querySelector(".vol-b-container");
      }
      volBCell._container = container;
    }

    const hasBinance =
      row.Binance === "O" ||
      row.Binance_Futures === "O" ||
      (row.Listed_Exchanges &&
        (row.Listed_Exchanges.includes("BINANCE_SPOT") ||
          row.Listed_Exchanges.includes("BINANCE") ||
          row.Listed_Exchanges.includes("BINANCE_FUTURES")));
    const volBText =
      hasBinance &&
        row.Volume_Formatted &&
        row.Volume_Formatted !== "-" &&
        row.Volume_Formatted !== "0"
        ? row.Volume_Formatted
        : "-";
    const mcapText = row.isDelisted
      ? `uid : ${row.UID || "-"}`
      : row.MarketCap_Formatted || "-";

    const volBEl =
      container._volBEl ||
      (container._volBEl = container.querySelector(`#vol-binance-${tId}`));
    if (volBEl && volBEl.textContent !== volBText) {
      volBEl.textContent = volBText;
      const fs = CONFIG.FONT_SCALE;
      if (fs && volBText.length > fs.VOL_THRESHOLD) {
        const size = Math.max(
          fs.VOL_MIN_SIZE,
          fs.VOL_BASE_SIZE -
          (volBText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP,
        );
        if (volBEl.style.fontSize !== `${size}px`)
          volBEl.style.fontSize = `${size}px`;
      } else {
        if (volBEl.style.fontSize !== "") volBEl.style.fontSize = "";
      }
    }

    const mcapEl =
      container._mcapEl ||
      (container._mcapEl = container.querySelector(`#mcap-${tId}`));
    if (mcapEl) {
      mcapEl.textContent = mcapText;
      if (row.isDelisted) {
        volBCell.style.overflow = "visible";
        mcapEl.className = "text-[10px] font-bold opacity-80 text-left mt-0.5 whitespace-nowrap text-theme-accent z-10 pointer-events-none";
        mcapEl.style.whiteSpace = "nowrap";
      } else {
        volBCell.style.overflow = "";
        mcapEl.style.whiteSpace = "";
        mcapEl.className = "text-[10px] font-bold opacity-60 text-left mt-0.5 truncate";
      }
      const fs = CONFIG.FONT_SCALE;
      if (!row.isDelisted && fs && mcapText.length > fs.MCAP_THRESHOLD) {
        const size = Math.max(
          fs.MCAP_MIN_SIZE,
          fs.MCAP_BASE_SIZE -
          (mcapText.length - fs.MCAP_THRESHOLD) * fs.MCAP_REDUCE_STEP,
        );
        mcapEl.style.fontSize = `${size}px`;
      } else {
        mcapEl.style.fontSize = "";
      }
    }
  }

  // 🚀 업비트 볼륨/VMC 렌더링
  const volUCell =
    rowEl._volUCell || (rowEl._volUCell = rowEl.querySelector(".col-vol-u"));
  if (volUCell) {
    volUCell.classList.remove("vol-u-placeholder");

    let container = volUCell._container;
    if (!container) {
      container = volUCell.querySelector(".vol-u-container");
      if (!container) {
        volUCell.innerHTML = `
          <div class="vol-u-container flex flex-col h-full justify-center items-end leading-tight min-w-0 gap-0.5 text-right w-full">
            <span id="vol-upbit-${tId}" class="text-upbit-color text-[11px] font-tempTestDss font-bold truncate w-full text-right"></span>
            <span id="vmc-${tId}" class="text-[10px] font-bold opacity-60 mt-0.5 truncate w-full text-right ${vmcColorClass}"></span>
          </div>
        `;
        container = volUCell.querySelector(".vol-u-container");
      }
      volUCell._container = container;
    }

    const volUText = row.isDelisted
      ? ""
      : row.Upbit_Vol_Formatted &&
        row.Upbit_Vol_Formatted !== "-" &&
        row.Upbit_Vol_Formatted !== "0"
        ? row.Upbit_Vol_Formatted
        : "-";
    const vmcText = row.isDelisted ? "" : vmcFormatted;

    const volUEl =
      container._volUEl ||
      (container._volUEl = container.querySelector(`#vol-upbit-${tId}`));
    if (volUEl && volUEl.textContent !== volUText) {
      volUEl.textContent = volUText;
        const fs = CONFIG.FONT_SCALE;
        if (fs && volUText.length > fs.VOL_THRESHOLD) {
          const size = Math.max(
            fs.VOL_MIN_SIZE,
            fs.VOL_BASE_SIZE -
            (volUText.length - fs.VOL_THRESHOLD) * fs.VOL_REDUCE_STEP,
          );
          volUEl.style.fontSize = `${size}px`;
        } else {
          volUEl.style.fontSize = "";
        }
      }

    const vmcEl =
      container._vmcEl ||
      (container._vmcEl = container.querySelector(`#vmc-${tId}`));
    if (vmcEl && vmcEl.textContent !== vmcText) {
      vmcEl.textContent = vmcText;
      const fs = CONFIG.FONT_SCALE;
      if (fs && vmcFormatted.length > fs.VMC_THRESHOLD) {
        const size = Math.max(
          fs.VMC_MIN_SIZE,
          fs.VMC_BASE_SIZE -
          (vmcFormatted.length - fs.VMC_THRESHOLD) * fs.VMC_REDUCE_STEP,
        );
        vmcEl.style.fontSize = `${size}px`;
      } else {
        vmcEl.style.fontSize = "";
      }
    }
  }

  // 🚀 김프/펀딩비 렌더링
  const kimchiCell =
    rowEl._kimchiCell ||
    (rowEl._kimchiCell = rowEl.querySelector(".col-kimch"));
  if (kimchiCell) {
    kimchiCell.classList.remove("kimchi-placeholder");

    let container = kimchiCell._container;
    if (!container) {
      container = kimchiCell.querySelector(".kimchi-container") || kimchiCell;
      kimchiCell._container = container;
    }

    const kimchiPctEl =
      container._kimchiPctEl ||
      (container._kimchiPctEl = container.querySelector(".kimchi-pct"));
    if (kimchiPctEl) {
      const exList = (row.Listed_Exchanges || []).map((e) => e.toUpperCase());
      const hasUpbit =
        row.Upbit === "O" || exList.includes("UPBIT") || !!row.Upbit_Symbol;
      const hasBithumb = exList.includes("BITHUMB") || !!row.Bithumb_Symbol;
      const hasGlobal =
        row.Binance === "O" ||
        // row.Binance_Futures === "O" ||
        exList.includes("BINANCE") ||
        // exList.includes("BINANCE_FUTURES") ||
        exList.includes("BYBIT") ||
        // exList.includes("BYBIT_FUTURES") ||
        // row.Binance_Price_Futures > 0 ||
        row.Binance_Price_Spot > 0 ||
        row.Binance_Price > 0 ||
        row.Bybit_Price > 0;
      const hasBoth = hasGlobal && (hasUpbit || hasBithumb);

      const isInvalidKimchi =
        !hasBoth ||
        !row.Kimchi_Label ||
        row.Kimchi_Label === "-" ||
        !row.Kimchi_Formatted ||
        row.Kimchi_Formatted === "-" ||
        row.Kimchi_Raw === null ||
        row.Kimchi_Raw === undefined;

      if (isInvalidKimchi) {
        if (kimchiPctEl.textContent !== "-") kimchiPctEl.textContent = "-";
        kimchiPctEl.className =
          "kimchi-pct text-[12px] font-medium text-theme-text opacity-40";
        if (kimchiPctEl.style.fontSize) kimchiPctEl.style.fontSize = "";
      } else if (
        row.Kimchi_Raw > 500 ||
        row.Kimchi_Raw <= -90 ||
        row.Kimchi_Formatted === "VOID"
      ) {
        if (kimchiPctEl.textContent !== "VOID")
          kimchiPctEl.textContent = "VOID";
        kimchiPctEl.className =
          "kimchi-pct text-[11px] font-bold text-amber-500/80 tracking-wider";
        if (kimchiPctEl.style.fontSize) kimchiPctEl.style.fontSize = "";
      } else {
        if (kimchiPctEl.textContent !== row.Kimchi_Formatted)
          kimchiPctEl.textContent = row.Kimchi_Formatted;
        kimchiPctEl.className = `kimchi-pct text-[12px] font-medium truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}`;

        // 🚀 최대 +333.33%(8글자) 대응 로그 폰트 축소 (6글자 초과 시 10.0px까지 스케일 다운)
        const kLen = (row.Kimchi_Formatted || "").length;
        if (kLen > 6) {
          const scaledPx = Math.max(10.0, 12.0 - Math.log10(kLen / 6) * 16.0);
          kimchiPctEl.style.fontSize = `${scaledPx.toFixed(1)}px`;
        } else if (kimchiPctEl.style.fontSize) {
          kimchiPctEl.style.fontSize = "";
        }
      }
    }

    const fundingEl =
      container._fundingEl ||
      (container._fundingEl = container.querySelector(".funding-val"));
    if (fundingEl) {
      const fundVal = row.Funding_Formatted || "-";
      if (fundingEl.textContent !== fundVal) fundingEl.textContent = fundVal;
      if (fundVal === "-") {
        fundingEl.className = "funding-val text-theme-accent opacity-30 truncate";
      } else {
        fundingEl.className = "funding-val text-theme-accent opacity-70 truncate";
      }
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
              const isSpot =
                exchanges.includes(`${ex.id}_SPOT`) ||
                exchanges.includes(ex.id) ||
                (ex.id === "BINANCE" && row.Binance === "O") ||
                (ex.id === "BYBIT" && row.Bybit === "O") ||
                (ex.id === "UPBIT" && row.Upbit === "O");

              const isFutures =
                exchanges.includes(`${ex.id}_FUTURES`) ||
                (ex.id === "BINANCE" && (row.Binance_Futures === "O" || !!row.Exact_Futures)) ||
                (ex.id === "BYBIT" && (row.Bybit_Futures === "O" || !!row.Exact_Futures));

              const isListed = isSpot || isFutures || exchanges.some((e) => e.startsWith(ex.id));

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
  const rowEl =
    target instanceof HTMLElement ? target : store.rowDomMap?.get(row.Ticker);
  if (!rowEl) return;

  const tId = row.Ticker || row.Symbol;
  const parentEl =
    rowEl._priceEl || (rowEl._priceEl = rowEl.querySelector(`#price-${tId}`));
  if (!parentEl) return;

  const rate = store.marketDataMap?.krw_usd_rate || 0;
  const isKrwMode = store.currencyMode === "KRW";
  const p =
    row.precision !== undefined && row.precision !== null
      ? Number(row.precision)
      : store.getPrecision(row.Ticker || row.DisplayTicker || row.Symbol);

  const oldPrice = parseFloat(parentEl.getAttribute("data-raw-price") || "0");
  const { displayPrice, activeExchange } = getRowDisplayMetrics(row, isKrwMode, rate);
  const isKrw = isKrwMode;
  const formattedPrice = window.formatSmartPrice(displayPrice, p, isKrw);

  const numEl = parentEl._numEl || (parentEl._numEl = parentEl.querySelector(".price-num"));
  if (numEl && numEl.textContent !== formattedPrice) {
    // 🚀 가격 변동 시 글자 번쩍임(Flash) 애니메이션 활성화
    if (oldPrice > 0 && displayPrice > 0 && oldPrice !== displayPrice) {
      applyPriceFlash(numEl, displayPrice, oldPrice);
    }
    numEl.textContent = formattedPrice;

    // 🚀 글자 수에 비례하여 폰트 크기 유동 축소
    const len = formattedPrice.length;
    const fs = CONFIG.FONT_SCALE;
    const threshold = fs?.PRICE_THRESHOLD || 8;
    if (len > threshold) {
      const sizePx = Math.max(
        fs?.PRICE_MIN_SIZE || 11,
        (fs?.PRICE_BASE_SIZE || 14) - (len - threshold) * (fs?.PRICE_REDUCE_STEP || 0.6),
      );
      if (parentEl.style.fontSize !== `${sizePx}px`)
        parentEl.style.fontSize = `${sizePx}px`;
    } else {
      if (parentEl.style.fontSize !== "") parentEl.style.fontSize = "";
    }
  }

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
    const firstRow = document.querySelector(
      '#coin-list-body > div[data-index="0"]',
    );
    if (
      firstRow &&
      firstRow.dataset.sym === tId &&
      typeof window.traceMetricCall === "function"
    ) {
      window.traceMetricCall("Price");
    }
  }
};

