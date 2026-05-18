// table_render.js
import { store, CONFIG } from "./_store.js";
import { formatSmartPrice } from "./chart_utils.js";
import { getFilteredData } from "./table_filter.js";

export function createRowElement(row) {
  const tr = document.createElement("tr");
  const ticker = row.Ticker;
  tr.dataset.sym = ticker;

  updateRowInnerHTML(tr, row);

  if (store.tableObserver) store.tableObserver.observe(tr);
  return tr;
}

export function updateRowInnerHTML(tr, row) {
  const pureSymbol = row.Symbol;
  const tId = row.Ticker;
  tr.dataset.sym = tId;

  const p = row.precision || 2;
  const n24h = row.Change_24h_Raw ?? 0;
  const nPrice = row.Price_Raw ?? 0;

  const formattedPrice = formatSmartPrice(nPrice, p);

  const color24h = n24h > 0 ? "text-theme-up" : n24h < 0 ? "text-theme-down" : "text-theme-text";

  const favorites = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  const isFav = favorites.includes(pureSymbol);

  const nDay = row.Change_Today_Raw ?? 0;
  const colorDay = nDay > 0 ? "text-theme-up" : nDay < 0 ? "text-theme-down" : "text-theme-text";

  tr.innerHTML = `
  <td class="p-2 col-asset overflow-hidden">
    <div class="flex items-center gap-2 min-w-0">
      <button onclick="toggleFavorite('${pureSymbol}', event)" class="star-btn text-[14px] transition-all hover:scale-125 flex-shrink-0 ${isFav ? "active" : ""}" style="color: ${isFav ? "var(--accent)" : "gray"}">
        ${isFav ? "⭐" : "☆"}
      </button>
      <div class="flex-shrink-0 w-8 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
        ${row.Logo || ""}
      </div>
      <div class="flex flex-col leading-[1.1] min-w-0 flex-1">
        <b class="text-[12px] text-theme-text truncate font-black tracking-tighter">${row.DisplayTicker || row.Symbol}</b>
        <span class="text-[9px] text-theme-text opacity-60 truncate font-bold tracking-tighter">
          ${(() => {
            const n = store.lang === "KR" ? row.Name_KR || row.Name || "" : row.Name || "";
            return n.length > 8 ? n.substring(0, 8) + ".." : n;
          })()}
        </span>
      </div>
    </div>
  </td>
  <td class="p-2 col-price overflow-hidden">
    <div class="flex flex-col leading-tight min-w-0">
      <span id="price-${tId}" data-raw-price="${nPrice}" class="font-black text-[14px] text-theme-text price-cell tracking-tighter truncate">
        ${formattedPrice}
        ${row.Price_KRW ? `<span class="text-[12px] text-theme-text opacity-70 ml-1"> ( ${Number(row.Price_KRW).toLocaleString()} 원 )</span>` : ""}
      </span>
      <div class="flex items-center justify-between gap-2 text-[10px] font-black text-left mt-0.5 w-full min-w-0">
        <span id="change-${tId}" class="${color24h} ${store.currentSortCol === "Change_Today" ? "opacity-40" : "opacity-100"} flex-1 text-left truncate">${n24h > 0 ? "+" : ""}${Number(n24h).toFixed(2)}%</span>
        <span id="today-${tId}" class="${colorDay} ${store.currentSortCol === "Change_Today" ? "opacity-100" : "opacity-40"} flex-1 text-left truncate">${nDay > 0 ? "+" : ""}${Number(nDay).toFixed(2)}%</span>
      </div>
    </div>
  </td>
  <td class="p-2 col-mcap overflow-hidden">
    <div class="flex flex-col leading-tight min-w-0">
      <span id="vol-binance-${tId}" class="text-[12px] font-black text-theme-text opacity-90 tracking-tighter truncate">${row.Volume_Formatted || "0"}</span>
      <div class="flex items-center justify-between gap-2 text-[10px] font-black opacity-60 text-left mt-0.5 w-full min-w-0">
        <span class="flex-1 text-left truncate">${row.MarketCap_Formatted || "0"}</span>
        <span class="text-theme-accent flex-1 text-left truncate">${row.VMC_Formatted || "0.0%"}</span>
      </div>
    </div>
  </td>
  <td class="p-2 text-left col-kimch overflow-hidden">
    <div class="flex flex-col leading-tight items-start min-w-0">
      <div class="flex items-center justify-start gap-1 min-w-0 max-w-full">
         ${(!row.Kimchi_Label || row.Kimchi_Label === "-")
           ? `<span class="text-[12px] font-black text-theme-text opacity-40">-</span>`
           : `<span class="text-[12px] font-black truncate ${row.Kimchi_Raw > 0 ? "text-theme-up" : "text-theme-down"}">${row.Kimchi_Formatted || "0.0%"}</span>`}
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
          { id: "BINANCE", cmcId: 270 }, { id: "UPBIT", cmcId: 351 }, { id: "BITHUMB", cmcId: 200 },
          { id: "BYBIT", cmcId: 521 }, { id: "OKX", cmcId: 294 }, { id: "BITGET", cmcId: 513 },
          { id: "GATEIO", cmcId: 302 }, { id: "COINBASE", cmcId: 89 },
        ];
        return list
          .map((ex) => {
            const isListed = exchanges.some((e) => e.includes(ex.id)) || (ex.id === "UPBIT" && row.Upbit === "O");
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

export function renderTable() {
  const tbody = document.getElementById("table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  store.visibleSymbols.clear();

  if (store.tableObserver) {
    store.tableObserver.disconnect();
    store.tableObserver = null;
  }

  store.tableObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const sym = entry.target.dataset.sym;
        if (entry.isIntersecting) store.visibleSymbols.add(sym);
        else store.visibleSymbols.delete(sym);
      });
    },
    { root: document.querySelector(".table-container"), rootMargin: "50px 0px" },
  );

  const filteredData = getFilteredData();
  const topData = filteredData.slice(0, store.currentRenderLimit);
  topData.forEach((row) => {
    tbody.appendChild(createRowElement(row));
  });
  applySelectedHighlight();

  updateVisibleSymbols();

  if (typeof window.refreshSniperTarget === "function") {
    setTimeout(() => {
      window.refreshSniperTarget();
    }, 10);
  }
}

export function updateVisibleSymbols() {
  const container = document.querySelector(".table-container");
  if (!container) return;

  const rows = container.querySelectorAll("tr[data-sym]");
  const containerRect = container.getBoundingClientRect();

  rows.forEach((row) => {
    const rect = row.getBoundingClientRect();
    const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
    const sym = row.dataset.sym;
    if (isVisible) store.visibleSymbols.add(sym);
    else store.visibleSymbols.delete(sym);
  });
}

export function applySelectedHighlight() {
  const selectedSymbol = store.currentSelectedSymbol;
  if (!selectedSymbol) return;

  document.querySelectorAll("#table-body tr").forEach((tr) => {
    tr.style.outline = "none";
    tr.style.boxShadow = "none";
  });

  const targetTr = document.querySelector(`#table-body tr[data-sym="${selectedSymbol}"]`);
  if (targetTr) {
    targetTr.style.outline = "2px solid var(--accent)";
    targetTr.style.outlineOffset = "-2px";
    targetTr.style.boxShadow = "inset 0 0 10px rgba(var(--accent-rgb), 0.2)";
    targetTr.style.zIndex = "10";
  }
}

export function initInfiniteScroll() {
  const scrollContainer = document.querySelector("#left-panel .overflow-y-auto");
  if (!scrollContainer) return;

  let isFetchingMore = false;
  let scrollTimer;

  const loadingIndicator = document.createElement("div");
  loadingIndicator.id = "scroll-loading";
  loadingIndicator.innerHTML = `
    <div class="py-4 flex justify-center items-center gap-2 opacity-50 text-[12px] font-bold">
      <div class="w-4 h-4 border-2 border-theme-text border-t-transparent rounded-full animate-spin"></div>
      더 불러오는 중...
    </div>
  `;
  loadingIndicator.style.display = "none";
  scrollContainer.appendChild(loadingIndicator);

  scrollContainer.addEventListener(
    "scroll",
    () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

      if (!isFetchingMore && scrollTop + clientHeight >= scrollHeight - clientHeight * 1.2) {
        if (store.currentRenderLimit < store.currentTableData.length) {
          isFetchingMore = true;
          loadingIndicator.style.display = "block";

          setTimeout(() => {
            const oldLimit = store.currentRenderLimit;
            store.currentRenderLimit += CONFIG.RENDER_CHUNK;

            const tbody = document.getElementById("table-body");
            const nextBatch = store.currentTableData.slice(oldLimit, store.currentRenderLimit);

            nextBatch.forEach((row) => {
              tbody.appendChild(createRowElement(row));
            });

            if (typeof window.refreshSniperTarget === "function") window.refreshSniperTarget();

            loadingIndicator.style.display = "none";
            isFetchingMore = false;
          }, 50);
        }
      }

      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (typeof window.refreshSniperTarget === "function") window.refreshSniperTarget();
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

// 좌우 넓이 드래그 조절 기능
const leftPanel = document.getElementById("left-panel");
let isResizing = false;
let animationFrameId = null;

document.addEventListener("mousemove", (e) => {
  if (!isResizing || !leftPanel) return;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  animationFrameId = requestAnimationFrame(() => {
    const containerWidth = document.body.clientWidth;
    let newWidth = (e.clientX / containerWidth) * 100;
    if (newWidth < 25) newWidth = 25;
    if (newWidth > 75) newWidth = 75;
    leftPanel.style.width = newWidth + "%";
  });
});

document.addEventListener("mouseup", () => {
  isResizing = false;
  document.body.classList.remove("resizing-active");
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("table-body");
  if (typeof window.loadTableData === "function") window.loadTableData();

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn")) return;

      const tr = e.target.closest("tr");
      if (tr && tr.dataset.sym) {
        const ticker = tr.dataset.sym;
        store.currentSelectedSymbol = ticker;
        if (typeof window.selectSymbol === "function") window.selectSymbol(ticker);
        applySelectedHighlight();

        if (window.innerWidth <= CONFIG.SCREEN_WIDTH && typeof window.showMobileChart === "function") {
          window.showMobileChart();
        }
      }
    });
  }
});
