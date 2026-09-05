// ui_search.js
// 🔍 [심볼 검색 및 최근 검색어 관리 전담 모듈]
import { store } from "./_store.js";
import { renderTable } from "./table_render.js";

// 🚀 탭 바 내 돋보기(🔍) 검색창 열기/닫기 제어 (모바일 전용)
export function toggleTabSearch(open) {
  const searchWrap = document.getElementById("tab-search-wrapper");
  const tabGroup = document.getElementById("tab-buttons-group");
  const actionsGroup = document.getElementById("tab-actions-group");
  const toggleBtn = document.getElementById("btn-toggle-tab-search");
  const inputMobile = document.getElementById("symbol-input-mobile");
  if (!searchWrap) return;

  if (open) {
    searchWrap.classList.remove(
      "opacity-0",
      "pointer-events-none",
    );
    searchWrap.classList.add(
      "opacity-100",
      "pointer-events-auto",
    );
    if (tabGroup) tabGroup.classList.add("opacity-0", "pointer-events-none");
    if (actionsGroup) actionsGroup.classList.add("opacity-0", "pointer-events-none");
    if (toggleBtn) toggleBtn.classList.add("opacity-0", "pointer-events-none");
    if (inputMobile) {
      setTimeout(() => inputMobile.focus(), 30);
    }
  } else {
    searchWrap.classList.add(
      "opacity-0",
      "pointer-events-none",
    );
    searchWrap.classList.remove(
      "opacity-100",
      "pointer-events-auto",
    );
    if (tabGroup) tabGroup.classList.remove("opacity-0", "pointer-events-none");
    if (actionsGroup) actionsGroup.classList.remove("opacity-0", "pointer-events-none");
    if (toggleBtn)
      toggleBtn.classList.remove("opacity-0", "pointer-events-none");
    if (inputMobile && inputMobile.value.trim() !== "") {
      clearSearch();
    }
  }
}

// 검색창 비우기 (X 버튼용 - PC/모바일 공통 지원)
export function clearSearch() {
  const input = document.getElementById("symbol-input");
  const inputMobile = document.getElementById("symbol-input-mobile");
  if (input) {
    input.value = "";
  }
  if (inputMobile) {
    inputMobile.value = "";
  }
  searchSymbols("");
}

let searchTimeout = null;

// 🚀 검색 리스트 (목록 즉각 필터링 로직 - 100ms 디바운스)
export function searchSymbols(v) {
  const resDiv = document.getElementById("search-results");
  if (resDiv) {
    resDiv.style.display = "none";
  }

  store.searchQuery = v || "";

  if (v && v.trim().length > 0) {
    hideRecentSearchChips();
  } else {
    showRecentSearchChips();
  }

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const loadingBar = document.getElementById("search-loading-bar");

  // 🚀 타이핑 감지 시 즉각 로딩바 전진 (300ms 디바운스 기간 동안 100% 충전)
  if (v && loadingBar) {
    loadingBar.style.transition = "none";
    loadingBar.style.width = "0%";
    void loadingBar.offsetWidth; // 강제 리플로우로 브라우저 애니메이션 프레임 동기화
    loadingBar.style.transition =
      "width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    loadingBar.style.width = "100%";
  }

  const runSearch = () => {
    renderTable();
    // 🚀 검색 렌더링 완료 시 로딩바 초기화
    if (loadingBar) {
      loadingBar.style.transition = "width 150ms ease";
      loadingBar.style.width = "0%";
    }
  };

  if (!v) {
    if (loadingBar) {
      loadingBar.style.transition = "none";
      loadingBar.style.width = "0%";
    }
    runSearch();
  } else {
    searchTimeout = setTimeout(runSearch, 300);
  }
}

// ================== 최근 검색 코인 칩 ==================
let globalRecentSearchDropdown = null;

function getOrCreateRecentSearchDropdown() {
  if (!globalRecentSearchDropdown) {
    globalRecentSearchDropdown = document.getElementById(
      "recent-search-container",
    );
    if (!globalRecentSearchDropdown) {
      globalRecentSearchDropdown = document.createElement("div");
      globalRecentSearchDropdown.id = "recent-search-container";
      document.body.appendChild(globalRecentSearchDropdown);
    }
  }
  return globalRecentSearchDropdown;
}

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem("sellnance_recent_searches");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { }
  return [];
}

export function addRecentSearch(ticker) {
  if (!ticker) return;
  const t = String(ticker).toUpperCase().trim();
  let list = getRecentSearches();
  list = list.filter((item) => item !== t);
  list.unshift(t);
  if (list.length > 10) list = list.slice(0, 10);
  try {
    localStorage.setItem("sellnance_recent_searches", JSON.stringify(list));
  } catch (e) { }
}

export function removeRecentSearch(ticker, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  let list = getRecentSearches();
  list = list.filter((item) => item !== ticker);
  try {
    localStorage.setItem("sellnance_recent_searches", JSON.stringify(list));
  } catch (e) { }
  showRecentSearchChips();
}

export function clearAllRecentSearches(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  try {
    localStorage.removeItem("sellnance_recent_searches");
  } catch (e) { }
  hideRecentSearchChips();
}

export function getActiveSearchInput() {
  const isMobile = window.innerWidth < 1200;
  const mobileInput = document.getElementById("symbol-input-mobile");
  const pcInput = document.getElementById("symbol-input");

  if (isMobile && mobileInput) {
    return mobileInput;
  }
  return pcInput || mobileInput;
}

export function onRecentSearchChipClick(sym) {
  hideRecentSearchChips();
  if (typeof window.clearSearch === "function") {
    window.clearSearch();
  }
  if (typeof window.toggleTabSearch === "function") {
    window.toggleTabSearch(false);
  }
  if (typeof window.selectSymbol === "function") {
    // 🚀 isRowClick=true (모바일 즉시 차트 탭 전환) + shouldScroll=true (테이블 555등/777등 해당 위치로 중앙 스크롤)
    window.selectSymbol(sym, null, null, true, true);
  }
}

export function showRecentSearchChips() {
  const input = getActiveSearchInput();
  if (!input || input.value.trim().length > 0) {
    hideRecentSearchChips();
    return;
  }

  const list = getRecentSearches();
  if (!list || list.length === 0) {
    hideRecentSearchChips();
    return;
  }

  const dropdown = getOrCreateRecentSearchDropdown();
  const isMobile = window.innerWidth < 768;
  const visibleList = list.slice(0, 10);

  let html = `
    <div class="flex items-center justify-between w-full pb-1.5 border-b border-theme-border/40 mb-1">
      <span class="text-[9px] font-bold text-theme-accent flex items-center gap-1">
        최근 조회 코인 (${visibleList.length}개)
      </span>
      <button onclick="window.clearAllRecentSearches(event)"
        class="text-[9px] text-theme-text opacity-40 hover:opacity-100 hover:text-rose-400 cursor-pointer transition-opacity">
        전체삭제
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-1.5 w-full">
  `;

  visibleList.forEach((sym) => {
    html += `
      <div onclick="window.onRecentSearchChipClick('${sym}')"
        class="group/chip flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme-panel/90 hover:bg-theme-accent/20 border border-theme-border/60 hover:border-theme-accent/60 text-theme-text text-[10px] font-bold cursor-pointer transition-all shadow-sm">
        <span>${sym}</span>
        <button onclick="window.removeRecentSearch('${sym}', event)"
          class="opacity-40 group-hover/chip:opacity-100 hover:text-rose-400 transition-opacity ml-1 text-[9px] leading-none"
          title="삭제">✕</button>
      </div>
    `;
  });

  html += `</div>`;

  dropdown.innerHTML = html;
  dropdown.className =
    "fixed p-2.5 bg-theme-panel/98 backdrop-blur-2xl border border-theme-border/50 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.35)] z-[250] flex flex-col gap-1.5 text-left select-none transition-opacity duration-150 opacity-100";

  // 🚀 정확한 좌표 계산 (모바일/PC 활성 검색창 input 바로 하단에 fixed 오버레이)
  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - (isMobile ? 260 : 320)))}px`;
  dropdown.style.width = `${Math.min(window.innerWidth - 20, Math.max(rect.width, isMobile ? 250 : 300))}px`;
  dropdown.style.maxWidth = "calc(100vw - 20px)";
}

export function hideRecentSearchChips() {
  const dropdown = document.getElementById("recent-search-container");
  if (dropdown) {
    dropdown.className = "hidden";
    dropdown.innerHTML = "";
  }
}

export function renderRecentSearchChips() {
  const dropdown = document.getElementById("recent-search-container");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    showRecentSearchChips();
  }
}

window.onRecentSearchChipClick = onRecentSearchChipClick;
window.toggleTabSearch = toggleTabSearch;
window.clearSearch = clearSearch;
window.searchSymbols = searchSymbols;
window.getRecentSearches = getRecentSearches;
window.addRecentSearch = addRecentSearch;
window.removeRecentSearch = removeRecentSearch;
window.clearAllRecentSearches = clearAllRecentSearches;
window.showRecentSearchChips = showRecentSearchChips;
window.hideRecentSearchChips = hideRecentSearchChips;
window.renderRecentSearchChips = renderRecentSearchChips;
window.getActiveSearchInput = getActiveSearchInput;

window.addEventListener("resize", () => {
  const dropdown = document.getElementById("recent-search-container");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    showRecentSearchChips();
  }
});

document.addEventListener("click", (e) => {
  const input = getActiveSearchInput();
  const dropdown = document.getElementById("recent-search-container");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    if (input && input.contains(e.target)) return;
    if (dropdown.contains(e.target)) return;
    hideRecentSearchChips();
  }
});

document.addEventListener(
  "scroll",
  () => {
    const dropdown = document.getElementById("recent-search-container");
    if (dropdown && !dropdown.classList.contains("hidden")) {
      const input = getActiveSearchInput();
      if (input) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 6}px`;
        dropdown.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 270))}px`;
      }
    }
  },
  true,
);
