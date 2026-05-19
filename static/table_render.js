// table_render.js
import { store, CONFIG } from "./_store.js";
import { formatSmartPrice } from "./chart_utils.js";
import { getFilteredData } from "./table_filter.js";

export function createRowElement(row) {
  const tr = document.createElement("tr");
  const ticker = row.Ticker; // 🚀 중복 없는 유니크 티커 사용 (BTCKRW != BTCUSDT)
  tr.dataset.sym = ticker;

  updateRowInnerHTML(tr, row);

  if (store.tableObserver) store.tableObserver.observe(tr);
  return tr;
}

export function updateRowInnerHTML(tr, row) {
  const pureSymbol = row.Symbol;
  const tId = row.Ticker; // 🚀 DOM ID용 완벽한 고유키
  tr.dataset.sym = tId; // 🚀 화면 추적용
  const rowIndex = parseInt(tr.dataset.index || "0", 10) + 1; // 🚀 1부터 시작하는 절대 행 번호

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
  const isFav = favorites.includes(pureSymbol);

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
    <div class="flex items-center gap-1.5 min-w-0">
      <!-- 0. 절대 순위 번호 (1 ~ max length 고정 배치) -->
      <span class="text-[10px] font-mono font-bold text-theme-text opacity-40 w-5 text-center flex-shrink-0">${rowIndex}</span>

      <!-- 1. 별 버튼 (완전 분리) -->
      <button onclick="toggleFavorite('${pureSymbol}', event)" class="star-btn text-[14px] transition-all hover:scale-125 flex-shrink-0 ${isFav ? "active" : ""}" style="color: ${isFav ? "var(--accent)" : "gray"}">
        ${isFav ? "⭐" : "☆"}
      </button>
      
      <!-- 2. 티커 이미지 (고정 영역) -->
      <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/1 rounded-full overflow-hidden">
        ${row.Logo || ""}
      </div>
      
      <!-- 3. 티커 & 이름 묶음 -->
      <div class="flex flex-col leading-[1.1] min-w-0 flex-1">
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
  </td>
  <td class="p-2 col-price overflow-hidden">
    <div class="flex flex-col leading-tight min-w-0 gap-0.5">
      ${(() => {
        const rate = store.marketDataMap?.krw_usd_rate || 0;
        const hasBinance =
          row.Listed_Exchanges?.some(
            (e) => e.includes("BINANCE") || e.includes("BYBIT"),
          ) || row.Price_Raw > 0;
        const hasUpbit =
          row.Listed_Exchanges?.includes("UPBIT") ||
          row.Listed_Exchanges?.includes("BITHUMB") ||
          row.Upbit === "O" ||
          row.Price_KRW > 0;

        let finalUsd = row.Price_Raw ?? 0;
        let finalKrw = row.Price_KRW ?? 0;
        if (!hasBinance && hasUpbit) finalUsd = finalKrw / rate;
        else if (hasBinance && !hasUpbit) finalKrw = finalUsd * rate;

        const isKrwMode = store.currencyMode === "KRW";
        const mainP = isKrwMode
          ? `${Number(finalKrw).toLocaleString()} 원`
          : formatSmartPrice(finalUsd, p);
        const subP = isKrwMode
          ? `$ ${formatSmartPrice(finalUsd, p)}`
          : `${Number(finalKrw).toLocaleString()} ₩`;

        return `
          <span id="price-${tId}" data-raw-price="${nPrice}" class="font-black text-[14px] text-theme-text price-cell tracking-tighter truncate block">
            ${mainP}
          </span>
          <span class="text-[11px] text-theme-text opacity-50 block truncate font-mono">${subP}</span>
        `;
      })()}
      <div class="flex items-center justify-between gap-2 text-[10px] font-black text-left mt-0.5 w-full min-w-0">
        <span id="change-${tId}" class="${color24h} ${store.currentSortCol === "Change_Today" ? "opacity-40" : "opacity-100"} flex-1 text-left truncate">${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%</span>
        <span id="today-${tId}" class="${colorDay} ${store.currentSortCol === "Change_Today" ? "opacity-100" : "opacity-40"} flex-1 text-left truncate">${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%</span>
      </div>
    </div>
  </td>
  <td class="p-2 col-mcap overflow-hidden">
    <div class="flex flex-col leading-tight min-w-0 gap-0.5">
      <div class="flex items-center justify-between gap-1 w-full min-w-0 truncate text-[11px] font-mono">
        <span id="vol-binance-${tId}" class="text-[#f0b90b] font-bold truncate">B: ${row.Volume_Formatted && row.Volume_Formatted !== "-" && row.Volume_Formatted !== "0" ? row.Volume_Formatted : "-"}</span>
        <span class="text-[#093687] font-bold truncate">U: ${row.Upbit_Vol_Formatted && row.Upbit_Vol_Formatted !== "-" && row.Upbit_Vol_Formatted !== "0" ? row.Upbit_Vol_Formatted : "-"}</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-[10px] font-black opacity-60 text-left mt-0.5 w-full min-w-0">
        <span class="flex-1 text-left truncate">${row.MarketCap_Formatted || "0"}</span>
        <span class="text-theme-accent flex-1 text-left truncate">${row.VMC_Formatted || "0.0%"}</span>
      </div>
    </div>
  </td>
  <td class="p-2 text-left col-kimch overflow-hidden">
    <div class="flex flex-col leading-tight items-start min-w-0">
      <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
         ${
           !row.Kimchi_Label || row.Kimchi_Label === "-"
             ? `<span class="text-[12px] font-black text-theme-text opacity-40">-</span>`
             : `<span class="text-[12px] font-black truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}">${row.Kimchi_Formatted || "0.0%"}</span>`
         }
      </div>
      <div class="flex items-center justify-start gap-2 text-[10px] font-black mt-0.5 min-w-0 max-w-full">
         <span class="text-theme-accent opacity-70 truncate">${row.Funding_Formatted || "-"}</span>
      </div>
    </div>
  </td>
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
            const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${ex.cmcId}.png`;
            return `
            <div class="w-[14px] h-[14px] flex items-center justify-center rounded-[2px] overflow-hidden bg-white/5 transition-all flex-shrink-0"
                 style="${isListed ? "filter: none; opacity: 1;" : "filter: grayscale(1); opacity: 0.1;"}">
              <img src="${imgUrl}" alt="${ex.id}" class="w-full h-full object-contain" />
            </div>
          `;
          })
          .join("");
      })()}
    </div>
  </td>
`;
}

// 🚀 [신규 아키텍처] 고정 DOM 풀 및 Lazy 렌더링 상태 관리
store.tablePoolInitialized = false;

// 🚀 [신규] 텅 빈 껍데기 상태일 때도 테이블 가로 구분선(그리드)이 100% 완벽하게 보이도록 유지하는 빈 셀 템플릿!
const EMPTY_ROW_HTML = `
  <td class="p-2 col-asset overflow-hidden"></td>
  <td class="p-2 col-price overflow-hidden"></td>
  <td class="p-2 col-mcap overflow-hidden"></td>
  <td class="p-2 col-kimch overflow-hidden"></td>
  <td class="p-2 col-exch overflow-hidden"></td>
`;

export function renderTable() {
  const tbody = document.getElementById("table-body");
  if (!tbody) return;

  const filteredData = getFilteredData();
  const totalCount = filteredData.length;

  // 1. 최초 1회 전체 껍데기 풀(Pool) 생성 (DOM 파괴/생성 원천 차단, 가상화 스크롤 바 확보)
  if (!store.tablePoolInitialized || tbody.children.length !== totalCount) {
    tbody.innerHTML = "";
    store.rowDomMap = new Map();
    store.visibleSymbols.clear();

    if (store.tableObserver) {
      store.tableObserver.disconnect();
    }

    // 🚀 화면 추적용 옵저버 (화면에 들어오면 Lazy하게 내용 채워넣기!)
    store.tableObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const tr = entry.target;
          const idx = parseInt(tr.dataset.index, 10);
          const currentFiltered = getFilteredData();
          const rowData = currentFiltered[idx];

          if (entry.isIntersecting) {
            if (rowData) {
              store.visibleSymbols.add(rowData.Ticker);
              if (
                !tr.dataset.renderedSym ||
                tr.dataset.renderedSym !== rowData.Ticker
              ) {
                updateRowInnerHTML(tr, rowData);
                tr.dataset.renderedSym = rowData.Ticker;
              }
            }
          } else {
            if (rowData) {
              store.visibleSymbols.delete(rowData.Ticker);
            }
          }
        });
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
      tr.style.height = "45px"; // 🚀 고정 높이 할당으로 완벽한 800개 스크롤 바 생성!
      tr.style.contain = "content"; // 🚀 브라우저 렌더링 격리 최적화!

      const rowData = filteredData[i];
      if (rowData) {
        tr.dataset.sym = rowData.Ticker;
        store.rowDomMap.set(rowData.Ticker, tr);
        // 최초 화면에 보일 법한 상위 40개만 즉시 렌더링, 나머지는 빈 껍데기 그리드로 Lazy 대기!
        if (i < 40) {
          updateRowInnerHTML(tr, rowData);
          tr.dataset.renderedSym = rowData.Ticker;
          store.visibleSymbols.add(rowData.Ticker);
        } else {
          // 🚀 껍데기 상태일 때도 가로 구분선이 완벽히 유지되도록 EMPTY_ROW_HTML 삽입!
          tr.innerHTML = EMPTY_ROW_HTML;
          tr.dataset.renderedSym = "";
        }
      }
      store.tableObserver.observe(tr);
      fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);
    store.tablePoolInitialized = true;
    applySelectedHighlight();
    return;
  }

  // 2. 이미 풀이 생성되어 있다면? (정렬 버튼 클릭 등 0초컷 In-place 업데이트 발동!)
  // DOM 추가/삭제 0%! 오직 연결되는 데이터 맵핑과 화면 내 노드만 초고속 갱신!
  store.rowDomMap.clear();
  store.visibleSymbols.clear();

  const rows = tbody.children;
  for (let i = 0; i < totalCount; i++) {
    const tr = rows[i];
    const rowData = filteredData[i];

    if (rowData) {
      tr.dataset.index = i;
      tr.dataset.sym = rowData.Ticker;
      store.rowDomMap.set(rowData.Ticker, tr);

      // 🚀 화면에 보이는 놈(상위 40개 또는 옵저버 감지 영역)만 즉시 내용 갱신!
      if (i < 40) {
        updateRowInnerHTML(tr, rowData);
        tr.dataset.renderedSym = rowData.Ticker;
        store.visibleSymbols.add(rowData.Ticker);
      } else {
        // 화면 밖의 놈들은 껍데기만 두고 내용 소각 (메인 스레드 0초컷 보장 및 그리드 유지!)
        if (tr.dataset.renderedSym) {
          tr.innerHTML = EMPTY_ROW_HTML;
          tr.dataset.renderedSym = "";
        }
      }
    }
  }

  applySelectedHighlight();
  if (typeof window.refreshSniperTarget === "function") {
    setTimeout(() => window.refreshSniperTarget(), 10);
  }
}

export function updateVisibleSymbols() {
  const container = document.querySelector("#left-panel .overflow-y-auto");
  if (!container) return;

  const rows = container.querySelectorAll("tr[data-sym]");
  const containerRect = container.getBoundingClientRect();

  rows.forEach((row) => {
    const rect = row.getBoundingClientRect();
    const isVisible =
      rect.top < containerRect.bottom && rect.bottom > containerRect.top;
    const sym = row.dataset.sym;
    if (isVisible) {
      store.visibleSymbols.add(sym);
    } else {
      store.visibleSymbols.delete(sym);
    }
  });
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
  scrollContainer.addEventListener(
    "scroll",
    () => {
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

export function toggleFavorite(symbol, event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  let favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");

  if (favorites.includes(symbol)) {
    favorites = favorites.filter((f) => f !== symbol);
    btn.innerText = "☆";
    btn.style.color = "gray";
    btn.classList.remove("active");
  } else {
    favorites.push(symbol);
    btn.innerText = "⭐";
    btn.style.color = "var(--accent)";
    btn.classList.add("active");
    btn.style.transform = "scale(1.5)";
    setTimeout(() => (btn.style.transform = "scale(1)"), 50);
  }
  localStorage.setItem("sellnance_favs", JSON.stringify(favorites));
}

export function applyPriceFlash(element, newPrice, oldPrice) {
  if (!element || newPrice === oldPrice) return;
  if (!store.useFlip) return;

  const flashClass = newPrice > oldPrice ? "flash-up" : "flash-down";
  element.classList.remove("flash-up", "flash-down");
  void element.offsetWidth;
  element.classList.add(flashClass);
  setTimeout(() => element.classList.remove(flashClass), 100);
}
