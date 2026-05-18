// table_sort.js
import { store } from "./_store.js";
import { getFilteredData } from "./table_filter.js";
import { createRowElement, updateRowInnerHTML, applySelectedHighlight } from "./table_render.js";

export function sortTable(colKey) {
  store.currentRenderLimit = 50;
  const isTwoStep = colKey.includes("Change") || colKey === "Volume";

  if (store.currentSortCol === colKey) {
    if (isTwoStep) {
      store.sortState = store.sortState === "desc" ? "asc" : "desc";
    } else {
      store.sortState = store.sortState === "" ? "desc" : store.sortState === "desc" ? "asc" : "";
    }
  } else {
    store.currentSortCol = colKey;
    store.sortState = "desc";
  }

  const scrollContainer = document.querySelector("#left-panel .overflow-y-auto");
  if (scrollContainer) scrollContainer.scrollTop = 0;

  document.querySelectorAll(".sort-arrow").forEach((el) => (el.innerText = ""));
  const arrowEl = document.getElementById(`sort-${colKey}`);

  if (store.sortState === "") {
    store.currentTableData = [...store.originalTableData];
    if (arrowEl) arrowEl.innerText = "";
    if (typeof window.renderTable === "function") window.renderTable();
  } else {
    if (arrowEl) arrowEl.innerText = store.sortState === "asc" ? "▲" : "▼";
    simpleSortData();
    if (typeof window.renderTable === "function") window.renderTable();
  }
}

export function simpleSortData() {
  const sortKeyMap = {
    MarketCap: "MarketCap_Raw", Price: "Price_Raw", Change_24h: "Change_24h_Raw", Change_Today: "Change_Today_Raw",
    Volume: "Binance_Vol_Futures", Ticker: "DisplayTicker", Kimchi: "Kimchi_Raw", Gap: "Basis_Raw",
    Funding: "Funding_Raw", VMC: "VMC_Raw",
  };

  const key = sortKeyMap[store.currentSortCol] || store.currentSortCol;
  const isAsc = store.sortState === "asc";

  store.currentTableData.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];

    if (typeof valA === "number" && typeof valB === "number") {
      return isAsc ? valA - valB : valB - valA;
    }

    const strA = (valA || "").toString();
    const strB = (valB || "").toString();
    return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export function applyRealtimeSort() {
  if (!store.currentSortCol || store.sortState === "") return;

  const filteredData = getFilteredData();
  const sortKeyMap = {
    MarketCap: "MarketCap_Raw", Price: "Price_Raw", Change_24h: "Change_24h_Raw", Change_Today: "Change_Today_Raw",
    Volume: "Binance_Vol_Futures", Ticker: "DisplayTicker", Kimchi: "Kimchi_Raw", Funding: "Funding_Raw",
    VMC: "VMC_Raw", Gap: "Basis_Raw",
  };

  const key = sortKeyMap[store.currentSortCol] || store.currentSortCol;
  const isAsc = store.sortState === "asc";

  filteredData.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];
    if (typeof valA === "number" && typeof valB === "number") {
      return isAsc ? valA - valB : valB - valA;
    }
    valA = (valA || "").toString().toLowerCase();
    valB = (valB || "").toString().toLowerCase();
    return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const tbody = document.getElementById("table-body");
  if (!tbody) return;
  const topData = filteredData.slice(0, store.currentRenderLimit);
  const topSymbols = new Set(topData.map((d) => d.Ticker));

  const existingRows = Array.from(tbody.children);
  const firstRects = new Map();

  existingRows.forEach((row) => {
    const sym = row.dataset.sym;
    if (sym) firstRects.set(sym, row.getBoundingClientRect().top);
  });

  const recycleBin = [];
  existingRows.forEach((row) => {
    const sym = row.dataset.sym;
    if (!topSymbols.has(sym)) {
      recycleBin.push(row);
      row.remove();
      store.visibleSymbols.delete(sym);
    }
  });

  topData.forEach((data, index) => {
    const sym = data.Ticker;
    let tr = tbody.querySelector(`tr[data-sym="${sym}"]`);

    if (!tr) {
      if (recycleBin.length > 0) {
        tr = recycleBin.pop();
        if (store.tableObserver) store.tableObserver.unobserve(tr);
        tr.dataset.sym = sym;
        updateRowInnerHTML(tr, data);
        if (store.tableObserver) store.tableObserver.observe(tr);
      } else {
        tr = createRowElement(data);
      }
    }

    if (tbody.children[index] !== tr) {
      tbody.insertBefore(tr, tbody.children[index]);
    }
  });

  recycleBin.forEach((row) => {
    if (store.tableObserver) store.tableObserver.unobserve(row);
    row.remove();
  });

  const finalRows = Array.from(tbody.children);

  if (store.useFlip) {
    const lastRects = new Map();
    finalRows.forEach((row) => {
      const sym = row.dataset.sym;
      if (firstRects.has(sym)) lastRects.set(sym, row.getBoundingClientRect().top);
    });

    finalRows.forEach((row) => {
      const sym = row.dataset.sym;
      const firstY = firstRects.get(sym);
      const lastY = lastRects.get(sym);

      if (firstY !== undefined && lastY !== undefined && firstY !== lastY) {
        const deltaY = firstY - lastY;
        row.style.transition = "none";
        row.style.transform = `translateY(${deltaY}px)`;
        row.style.willChange = "transform";
        row.offsetHeight;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            row.style.transition = "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
            row.style.transform = "";
            setTimeout(() => {
              if (row) row.style.willChange = "auto";
            }, 350);
          });
        });
      }
    });
  } else {
    finalRows.forEach((row) => {
      row.style.transform = "";
      row.style.transition = "none";
    });
  }

  if (typeof window.refreshSniperTarget === "function") window.refreshSniperTarget();
  applySelectedHighlight();
}

setInterval(() => {
  if (store.currentSortCol && store.sortState !== "") {
    applyRealtimeSort();
  }
}, 400);
