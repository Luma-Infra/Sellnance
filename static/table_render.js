// table_render.js
// 📊 [테이블 메인 렌더링 엔진 & 가상화 스크롤 허브]
// - 각 전담 모듈(table_tooltips, table_badges, table_row_builder)을 통합하고
//   기존 100% 동일한 import/export 인터페이스와 window 바인딩을 제공합니다.

import { store, CONFIG } from "./_store.js";
import { formatSmartPrice, getMultiplier, getPureBase } from "./chart_utils.js";
import { getFilteredData } from "./table_filter.js";
import {
  isFuturesCoin,
  getRowDisplayMetrics,
  getDisplayTickerHtml,
  getRowExchangeMeta,
} from "./_market_rules.js";

// ==========================================
// 1. 툴팁 및 호버 팝오버 (table_tooltips.js)
// ==========================================
export {
  getOrCreateGlobalCautionTooltip,
  showCautionTooltip,
  hideCautionTooltip,
  EXCH_LOGO_MAP,
} from "./table_tooltips.js";

// ==========================================
// 2. 경고 뱃지 및 상장일 계산 (table_badges.js)
// ==========================================
export {
  getWarningBadgeHtml,
  getListingDate,
  formatListingDateWithExchange,
} from "./table_badges.js";

// ==========================================
// 3. 행 DOM 생성 및 셀 렌더링 (table_row_builder.js)
// ==========================================
export {
  createRowElement,
  updateRowStaticHTML,
  updateRowDynamicHTML,
  updateRowInnerHTML,
  applyPriceFlash,
} from "./table_row_builder.js";

// 내부에서 직접 사용하는 함수들 import
import {
  createRowElement,
  updateRowStaticHTML,
  updateRowDynamicHTML,
  updateRowInnerHTML,
} from "./table_row_builder.js";

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

  // 🚀 [추가] 정렬/필터링/탭전환 등 테이블 레이아웃 변화 시 1회성 우선순위 동기화 실행
  if (!isRealtime && typeof window.syncRowPrioritizedMetrics === "function") {
    const allSource = store.originalTableData || store.currentTableData || [];
    allSource.forEach((row) => {
      window.syncRowPrioritizedMetrics(row);
    });
  }

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
  if (
    !store.tablePoolInitialized ||
    !store.lastPoolSourceLength ||
    store.lastPoolSourceLength !== allSource.length
  ) {
    store.lastPoolSourceLength = allSource.length;
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
    const INITIAL_SYNC_ROWS = 50; // 🚀 초기 뷰포트 50개만 즉시 렌더 (5ms 컷, 2800개 DOM 폭탄 차단)
    for (let i = 0; i < allSource.length; i++) {
      const rowEl = document.createElement("div");
      rowEl.classList.add("coin-row");
      if (i < 30) {
        rowEl.classList.add("flip-row");
      }
      rowEl.dataset.index = i;
      rowEl.style.height = i === 0 && store.traceRowCaller ? "221px" : "52px";
      rowEl.style.position = "absolute";
      rowEl.style.transform = `translateY(${i === 0 || !store.traceRowCaller ? i * 52 : 221 + (i - 1) * 52}px)`;
      rowEl.style.contain = "content";

      const rowData = allSource[i];
      if (rowData) {
        rowEl.dataset.sym = rowData.Ticker;
        store.rowDomMap.set(rowData.Ticker, rowEl);
        if (rowData.UID) store.rowDomMap.set(String(rowData.UID), rowEl);
        if (rowData.DisplayTicker)
          store.rowDomMap.set(rowData.DisplayTicker, rowEl);

        if (i < INITIAL_SYNC_ROWS) {
          // 🚀 상위 50개는 즉시 정적 레이어 주입
          updateRowStaticHTML(rowEl, rowData);
          rowEl.dataset.renderedSym = rowData.Ticker;
          rowEl.dataset.renderedLang = store.lang;

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
        } else {
          // 🚀 50번 이후 행은 가벼운 스켈레톤으로 등록 → IntersectionObserver가 뷰포트 진입 시 0ms로 채움
          rowEl.dataset.renderedSym = "";
          rowEl.dataset.renderedLang = "";
          rowEl.dataset.renderedCurrency = "";
          rowEl.dataset.metricsRendered = "false";
        }
      }
      store.tableObserver.observe(rowEl);
      fragment.appendChild(rowEl);
    }

    // 🚀 [상폐 코인 영구 풀 등록] 로컬스토리지 즐겨찾기 상폐 코인도 풀에 1회성 사전 탑승 (무한 깜빡임 0% 차단)
    try {
      const allUids = new Set(allSource.map((d) => String(d.UID)));
      const fav1 = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
      const fav2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]");
      const favMeta = JSON.parse(localStorage.getItem("sellnance_fav_meta") || "{}");
      const delistedFavUids = Array.from(new Set([...fav1, ...fav2])).filter((uid) => !allUids.has(String(uid)));

      delistedFavUids.forEach((uid) => {
        const meta = favMeta[uid] || {};
        const cleanSym = meta.symbol || String(uid)
          .replace(/^\d+_/, "")
          .replace(/_(BINANCE|UPBIT|BITHUMB|BYBIT)$/i, "")
          .toUpperCase();
        const ghostRowEl = document.createElement("div");
        ghostRowEl.classList.add("coin-row");
        ghostRowEl.dataset.sym = cleanSym;
        ghostRowEl.dataset.delisted = "true";
        ghostRowEl.style.cursor = "default";
        ghostRowEl.style.position = "absolute";
        ghostRowEl.style.height = "52px";
        ghostRowEl.style.contain = "content";
        ghostRowEl.style.setProperty("display", "none", "important");
        store.rowDomMap.set(cleanSym, ghostRowEl);
        store.rowDomMap.set(String(uid), ghostRowEl);
        store.tableObserver.observe(ghostRowEl);
        fragment.appendChild(ghostRowEl);
      });
    } catch (e) { }

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

  const currentVisibleSet = new Set();
  for (let i = 0; i < totalCount; i++) {
    const d = filteredData[i];
    if (d) {
      currentVisibleSet.add(d.Ticker);
      if (d.UID) currentVisibleSet.add(String(d.UID));
      if (d.DisplayTicker) currentVisibleSet.add(d.DisplayTicker);
    }
  }

  // 🚀 [스마트 숨김] 전체를 껐다 켜지 않고, 이번 필터에 없는 행들만 골라서 숨김 (화면 점멸/깜빡임 0% 원천 차단)
  for (const child of tbody.children) {
    const sym = child.dataset.sym;
    if (!sym || !currentVisibleSet.has(sym)) {
      if (child.style.display !== "none") {
        child.style.setProperty("display", "none", "important");
      }
    }
  }

  for (let i = 0; i < totalCount; i++) {
    const rowData = filteredData[i];
    if (rowData) {
      // 🚀 [자가 치유 DOM 풀: 8등, 14등 구멍 뚫림 영구 방어]
      let rowEl = store.rowDomMap.get(rowData.Ticker);
      if (!rowEl && rowData.UID)
        rowEl = store.rowDomMap.get(String(rowData.UID));
      if (!rowEl && rowData.DisplayTicker)
        rowEl = store.rowDomMap.get(rowData.DisplayTicker);

      // 풀에 아예 없는 신규 코인이 상위권으로 진입한 경우 즉시 상자 1개 생성 보충
      if (!rowEl) {
        rowEl = document.createElement("div");
        rowEl.classList.add("coin-row");
        if (i < 30) rowEl.classList.add("flip-row");
        rowEl.dataset.index = i;
        rowEl.style.height = i === 0 && store.traceRowCaller ? "221px" : "52px";
        rowEl.style.position = "absolute";
        rowEl.style.transform = `translateY(${i === 0 || !store.traceRowCaller ? i * 52 : 221 + (i - 1) * 52}px)`;
        rowEl.style.contain = "content";
        rowEl.dataset.sym = rowData.Ticker;
        store.rowDomMap.set(rowData.Ticker, rowEl);
        if (rowData.UID) store.rowDomMap.set(String(rowData.UID), rowEl);
        if (rowData.DisplayTicker)
          store.rowDomMap.set(rowData.DisplayTicker, rowEl);
        updateRowInnerHTML(rowEl, rowData);
        store.tableObserver.observe(rowEl);
        tbody.appendChild(rowEl);
      }

      if (rowEl) {
        if (rowData.isDelisted) {
          rowEl.dataset.delisted = "true";
          rowEl.style.cursor = "default";
        }
        rowEl.style.removeProperty("display");
        const oldIndex = parseInt(rowEl.dataset.index);
        // 🚀 실시간 정렬 시 30위 이하(31등~) 코인은 불필요한 연속 렌더링 방지를 위해 위치를 고정시키되,
        // 현재 위치(oldIndex)가 실제 정렬 순위(i)와 달라질 때만 딱 1번 올바른 목적지(31위든 300위든)에 공백/겹침 없이 정밀 배치하고 고정시킵니다.
        let needsPositionUpdate =
          !isRealtime ||
          i < 30 ||
          oldIndex < 30 ||
          isNaN(oldIndex) ||
          oldIndex !== i;
        if (isRealtime && i >= 30 && oldIndex >= 30) {
          needsPositionUpdate = oldIndex !== i;
        }

        if (needsPositionUpdate) {
          rowEl.dataset.index = i;
          rowEl.style.height =
            i === 0 && store.traceRowCaller ? "221px" : "52px";
          rowEl.style.transform = `translateY(${i === 0 || !store.traceRowCaller ? i * 52 : 221 + (i - 1) * 52}px)`;

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

export function updateHeaderStar(uid) {
  const headStarBtn = document.querySelector("#head-asset-name .star-btn");
  if (!headStarBtn) return;
  const curUid = String(store.currentSelectedUid || "");
  const targetUid = String(uid || "");
  if (curUid && targetUid && curUid !== targetUid) {
    const curSym = String(store.currentAsset || "").toUpperCase();
    const row = store.tickerRowMap?.get(targetUid);
    if (row && row.Ticker?.toUpperCase() !== curSym && row.Symbol?.toUpperCase() !== curSym) {
      return;
    }
  }
  const favs = JSON.parse(localStorage.getItem("sellnance_favs") || "[]");
  const favs2 = JSON.parse(localStorage.getItem("sellnance_favs2") || "[]");
  const isFav = favs.includes(uid) || (curUid && favs.includes(curUid));
  const isFav2 = favs2.includes(uid) || (curUid && favs2.includes(curUid));

  let starText = "☆";
  let starColor = "gray";
  let starClass = "";
  if (isFav) {
    starText = "★";
    starColor = "#e3b30a";
    starClass = "active";
  } else if (isFav2) {
    starText = "★";
    starColor = "#3b82f6";
    starClass = "active-blue";
  }
  headStarBtn.innerText = starText;
  headStarBtn.style.color = starColor;
  headStarBtn.className = `star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}`;
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

    const row = store.currentTableData.find((r) => r.UID === uid) || (store.tickerRowMap && store.tickerRowMap.get(String(uid)));
    if (row) {
      const rowEl = store.rowDomMap.get(row.Ticker) || store.rowDomMap.get(String(row.UID));
      if (rowEl) {
        updateRowInnerHTML(rowEl, row);
      }
    }

    updateProgressBar();
    if (typeof window.updateFavoritesCount === "function") {
      window.updateFavoritesCount();
    }
    updateHeaderStar(uid);
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

  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }

  const row = store.currentTableData.find((r) => r.UID === uid) || (store.tickerRowMap && store.tickerRowMap.get(String(uid)));
  if (row) {
    const rowEl = store.rowDomMap.get(row.Ticker) || store.rowDomMap.get(String(row.UID));
    if (rowEl) {
      updateRowInnerHTML(rowEl, row);
    }
  }

  updateHeaderStar(uid);

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
  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
  updateHeaderStar(uid);
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
  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
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
  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
}

