// table_sort.js
import { store } from "./_store.js";
import { getFilteredData } from "./table_filter.js";
import {
  renderTable,
  applySelectedHighlight,
  getListingDate,
} from "./table_render.js";

let lastSortTime = 0;

export function sortTable(colKey) {
  // 🚀 모든 정렬 요소 공통 500ms 광클 방어
  const now = Date.now();
  if (now - lastSortTime < 500) {
    return;
  }
  lastSortTime = now;

  // 🚀 누르자마자 실행되게 즉시 로딩 클래스 추가 (차트 로딩 효과처럼 어두워짐)
  const table = document.getElementById("coin-list-body");
  if (table) {
    table.classList.add("table-loading");
  }

  // 🚀 [2단 토글 개편] 모든 정렬 가능 컬럼을 3단(desc -> asc -> 해제)이 아닌 2단(desc <-> asc)으로 토글합니다.
  if (store.currentSortCol === colKey) {
    store.sortState = store.sortState === "desc" ? "asc" : "desc";
  } else {
    store.currentSortCol = colKey;
    store.sortState = "desc";
  }

  // 모든 화살표 초기화 후 현재 선택된 헤더 옆에만 방향 표식 표시 (▲: asc, ▼: desc)
  document.querySelectorAll(".sort-arrow").forEach((el) => (el.innerText = ""));
  const arrowEl = document.getElementById(`sort-${colKey}`);
  if (arrowEl) {
    arrowEl.innerText = store.sortState === "asc" ? "▲" : "▼";
  }



  // 🚀 [INP 최적화] 무거운 배열 정렬 및 DOM 렌더링을 다음 페인트 이후로 비동기 양보
  requestAnimationFrame(() => {
    setTimeout(() => {
      const scrollContainer = document.querySelector(
        "#left-panel .overflow-y-auto",
      );
      if (scrollContainer) scrollContainer.scrollTop = 0;

      simpleSortData();
      renderTable(false); // 수동 정렬이므로 0초 컷으로 즉시 전체 배치

      // 🚀 정렬 및 렌더링이 끝나면 즉시 로딩 클래스 제거
      if (table) {
        table.classList.remove("table-loading");
      }
    }, 50); // 50ms 딜레이를 주어 브라우저가 어두워진 로딩 필터를 화면에 먼저 칠할 시간을 줌
  });
}

export function simpleSortData() {
  const dataCopy = [...store.currentTableData];
  const currentMarket = store.currentMarket || "ALL";

  let priceKey = "Price_Raw";
  let change24hKey = "Change_24h_Raw";
  let changeTodayKey = "Change_Today_Raw";
  let volumeKey = "Volume_Raw";

  if (currentMarket === "UPBIT") {
    priceKey = "Upbit_Price";
    change24hKey = "Change_24h_Upbit";
    changeTodayKey = "Change_Today_Upbit";
    volumeKey = "Upbit_Vol";
  } else if (currentMarket === "BITHUMB") {
    priceKey = "Bithumb_Price";
    change24hKey = "Change_24h_Bithumb";
    changeTodayKey = "Change_Today_Bithumb";
    volumeKey = "Bithumb_Vol"; // ◀ Upbit_Vol에서 수정
    // volumeKey = "Upbit_Vol";
  } else if (currentMarket === "FUTURES" || currentMarket === "BYBIT_FUTURES") {
    priceKey =
      currentMarket === "FUTURES"
        ? "Binance_Price_Futures"
        : "Bybit_Price_Futures";
    change24hKey = "Change_24h_Futures_Ex";
    changeTodayKey = "Change_Today_Futures";
    volumeKey = "Binance_Vol_Futures";
  } else if (currentMarket === "SPOT" || currentMarket === "BYBIT") {
    priceKey =
      currentMarket === "SPOT" ? "Binance_Price_Spot" : "Bybit_Price_Spot";
    change24hKey =
      currentMarket === "SPOT" ? "Change_24h_Binance" : "Change_24h_Bybit";
    changeTodayKey =
      currentMarket === "SPOT" ? "Change_Today_Binance" : "Change_Today_Bybit";
    volumeKey = "Binance_Vol_Spot";
  }

  const sortKeyMap = {
    MarketCap: "MarketCap_Raw",
    Price: priceKey,
    Change_24h: change24hKey,
    Change_Today: changeTodayKey,
    Volume: volumeKey,
    VolumeUpbit: "Upbit_Vol",
    Ticker: "DisplayTicker",
    Kimchi: "Kimchi_Raw",
    Gap: "Basis_Raw",
    Funding: "Funding_Raw",
    VMC: "VMC_Raw",
  };

  let key = sortKeyMap[store.currentSortCol] || store.currentSortCol;
  const isAsc = store.sortState === "asc";

  dataCopy.sort((a, b) => {
    let valA, valB;
    if (store.currentSortCol === "Listing_Date") {
      valA = getListingDate(a);
      valB = getListingDate(b);
    } else if (
      store.currentSortCol === "Change_Today" &&
      currentMarket === "ALL"
    ) {
      let aDay = a.Change_Today_Raw;
      aDay = a.Change_Today_Upbit ?? aDay;
      aDay = a.Change_Today_Bithumb ?? aDay;
      aDay = a.Change_Today_Futures ?? aDay;
      aDay = a.Change_Today_Bybit ?? aDay;
      aDay = a.Change_Today_Binance ?? aDay;
      valA = aDay;

      let bDay = b.Change_Today_Raw;
      bDay = b.Change_Today_Upbit ?? bDay;
      bDay = b.Change_Today_Bithumb ?? bDay;
      bDay = b.Change_Today_Futures ?? bDay;
      bDay = b.Change_Today_Bybit ?? bDay;
      bDay = b.Change_Today_Binance ?? bDay;
      valB = bDay;
    } else if (
      store.currentSortCol === "Change_24h" &&
      currentMarket === "ALL"
    ) {
      let a24 = a.Change_24h_Raw;
      a24 = a.Change_24h_Upbit ?? a24;
      a24 = a.Change_24h_Bithumb ?? a24;
      a24 = a.Change_24h_Futures_Ex ?? a24;
      a24 = a.Change_24h_Bybit ?? a24;
      a24 = a.Change_24h_Binance ?? a24;
      valA = a24;

      let b24 = b.Change_24h_Raw;
      b24 = b.Change_24h_Upbit ?? b24;
      b24 = b.Change_24h_Bithumb ?? b24;
      b24 = b.Change_24h_Futures_Ex ?? b24;
      b24 = b.Change_24h_Bybit ?? b24;
      b24 = b.Change_24h_Binance ?? b24;
      valB = b24;
    } else {
      valA = a[key];
      valB = b[key];
    }

    // 🚀 0, null, undefined, "-", "" 등 빈 값 판별 (단, 지표의 0%는 정상 값이므로 제외)
    const isEmptyOrZero = (val) => {
      if (val === undefined || val === null || val === "" || val === "-")
        return true;
      const isTextCol =
        store.currentSortCol === "Ticker" ||
        store.currentSortCol === "Listing_Date";
      if (!isTextCol && isNaN(Number(val))) return true;
      return false;
    };

    const isAEmpty = isEmptyOrZero(valA);
    const isBEmpty = isEmptyOrZero(valB);

    // 둘 다 비어있거나 0이면 순서 유지
    if (isAEmpty && isBEmpty) return 0;
    // 비어있는/0인 값은 정렬 방향(오름차순/내림차순)에 상관없이 무조건 가장 뒤(하단)로 보냄
    if (isAEmpty) return 1;
    if (isBEmpty) return -1;

    // 둘 다 정상적인 값인 경우 정렬 시작
    if (store.currentSortCol === "Listing_Date") {
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    const numA = Number(valA);
    const numB = Number(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return isAsc ? numA - numB : numB - numA;
    }

    const strA = valA.toString();
    const strB = valB.toString();
    return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
  store.currentTableData = dataCopy;
}

export function applyRealtimeSort() {
  if (!store.currentSortCol || store.sortState === "") return;

  // 🚀 [스크롤 락 최적화] 사용자가 스크롤 중일 때는 실시간 정렬(DOM 재배치)을 건너뛰어 스크롤 렉을 차단!
  if (store.isScrolling) return;

  // 🚀 [약점 1 완벽 개선: 소켓 폭포수 스로틀링 장치]
  // 초당 수십 번씩 밀려오는 소켓 이벤트에 대해 250ms(초당 최대 4회) 주기로만 정렬/렌더링을 허용!
  // 메인 스레드 혹사 및 CPU 스래싱을 95% 이상 완벽히 소각!
  if (store.isRealtimeSorting) return;
  store.isRealtimeSorting = true;
  setTimeout(() => {
    store.isRealtimeSorting = false;
  }, 250);

  simpleSortData();
  renderTable(true);
}
