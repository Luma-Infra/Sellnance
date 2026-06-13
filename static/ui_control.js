// ui_control.js
// --- 📱 UI/UX 컨트롤 로직 ---
import { store, CONFIG } from "./_store.js";
import { initChart, updateChartTheme } from "./chart.js";
import { fetchHistory } from "./chart_data.js";

let isThemeToggling = false; // 🚀 라이트/다크 모드 연타 방어 플래그

function toggleTheme() {
  if (isThemeToggling) return;
  isThemeToggling = true;
  setTimeout(() => {
    isThemeToggling = false;
  }, 500);

  const body = document.body;
  const btn = document.getElementById("theme-toggle-btn");
  const isCurrentlyDark = body.classList.contains("theme-binance");
  const faviconLink = document.getElementById("favicon-link");
  const mainLogoImg = document.getElementById("main-logo-img");
  const staticPath = "../static/";

  if (isCurrentlyDark) {
    body.classList.remove("theme-binance");
    body.classList.add("theme-upbit");
    store.currentTheme = "upbit";
    if (btn) btn.innerHTML = "🌙";
    if (faviconLink) faviconLink.href = staticPath + "_gemini-svg-light.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "_gemini-svg-light.svg";
  } else {
    body.classList.remove("theme-upbit");
    body.classList.add("theme-binance");
    store.currentTheme = "binance";
    if (btn) btn.innerHTML = "☀️";
    if (faviconLink) faviconLink.href = staticPath + "_gemini-svg-dark.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "_gemini-svg-dark.svg";
  }

  // 🚀 차트 테마 업데이트 (브라우저 스타일 재계산 및 트랜지션 즉각 반영을 위해 즉시 호출 및 50ms 후 최종 확정 호출)
  if (typeof updateChartTheme === "function") {
    updateChartTheme();
    setTimeout(updateChartTheme, 50);
  }
}

// 데스크탑: 좌측 패널 접기/펴기
function toggleSidebar() {
  const leftPanel = document.getElementById("left-panel");
  const toggleText = document.getElementById("sidebar-toggle-text");

  store.isSidebarOpen = !store.isSidebarOpen;

  if (store.isSidebarOpen) {
    // 사이드바 열기
    leftPanel.classList.remove("md:hidden");
    leftPanel.classList.add("md:flex");
    if (toggleText) toggleText.innerText = "◀ 접기";
  } else {
    // 사이드바 숨기기
    leftPanel.classList.remove("md:flex");
    leftPanel.classList.add("md:hidden");
    if (toggleText) toggleText.innerText = "▶ 펼치기";
  }
}

export function switchViewMode(mode) {
  store.tableViewMode = mode;
  const panel = document.getElementById("left-panel");
  if (!panel) return;

  // 기존 모드 클래스 제거
  panel.classList.remove(
    "view-mode-simple",
    "view-mode-basic",
    "view-mode-expert",
  );
  panel.classList.add(`view-mode-${mode}`);

  // 버튼 스타일 갱신
  const modes = ["simple", "basic", "expert"];
  modes.forEach((m) => {
    const btn = document.getElementById(`view-mode-${m}-btn`);
    if (btn) {
      if (m === mode) {
        btn.className =
          "px-3 py-1 text-[10px] font-bold rounded bg-theme-accent text-white transition-all shadow-md";
      } else {
        btn.className =
          "px-3 py-1 text-[10px] font-medium rounded opacity-50 hover:opacity-100 transition-all text-theme-text";
      }
    }
  });

  // 탭 라벨 텍스트 교체 (simple: 단축, 그 외: 원문)
  const isSimple = mode === "simple";
  const tabAll = document.getElementById("tab-all");
  const tabFav = document.getElementById("tab-fav");
  const tabFav2 = document.getElementById("tab-fav2");
  const btnSmallCap = document.getElementById("btn-small-cap");

  if (tabAll) tabAll.textContent = isSimple ? "ALL" : "ALL LIST";

  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
  if (btnSmallCap)
    btnSmallCap.textContent = isSimple ? "🚫 Mcap < 1M" : "🚫 Hiding Mcap < 1M";

  // 🚀 [추가] 뷰 모드 변경 시 좌측 패널 너비 변화로 인한 겹침/렉 감지
  if (typeof checkLayoutOverlap === "function") {
    checkLayoutOverlap();
  }
}

// 모바일: 리스트/차트 화면 전환
function switchMobileView(view) {
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  const btnList = document.getElementById("nav-btn-list");
  const btnChart = document.getElementById("nav-btn-chart");

  if (view === "list") {
    leftPanel.classList.remove("hidden");
    leftPanel.classList.add("flex");
    rightPanel.classList.remove("flex");
    rightPanel.classList.add("hidden");

    btnList.classList.replace("border-transparent", "border-theme-accent");
    btnList.classList.replace("opacity-50", "text-theme-accent");
    btnChart.classList.replace("border-theme-accent", "border-transparent");
    btnChart.classList.replace("text-theme-accent", "opacity-50");

    // 🚀 [추가] 모바일 리스트 모드일 때 높이 제한과 스크롤 주입
    leftPanel.classList.add("overflow-y-auto", "flex-1", "pb-[80px]");
    leftPanel.classList.remove("h-[calc(100vh-64px)]");
    leftPanel.style.removeProperty("height");
  } else {
    leftPanel.classList.remove("flex");
    leftPanel.classList.add("hidden");
    rightPanel.classList.remove("hidden");
    rightPanel.classList.add("flex");

    btnChart.classList.replace("border-transparent", "border-theme-accent");
    btnChart.classList.replace("opacity-50", "text-theme-accent");
    btnList.classList.replace("border-theme-accent", "border-transparent");
    btnList.classList.replace("text-theme-accent", "opacity-50");

    // 🚀 [모바일] 그리기 툴바 인라인 style 강제 덮어쓰기 (CSS !important로는 인라인 style을 이길 수 없음)
    requestAnimationFrame(() => {
      const toolbar = document.querySelector(".drawing-toolbar-wrap");
      if (!toolbar) return;
      toolbar.style.cssText = [
        "position: absolute",
        "bottom: 0",
        "top: auto",
        "left: 0",
        "width: 100%",
        "height: 52px",
        "z-index: 100",
        "border-right: none",
        "border-top: 1px solid var(--border)",
        "background-color: var(--panel)",
        "display: flex",
        "flex-direction: row",
        "overflow-x: auto",
      ].join(";");
    });
  }
}

function showMobileChart() {
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH) return;

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const content = document.getElementById("mobile-chart-content");
  const rightPanel = document.getElementById("right-panel");

  if (!overlay || !panel || !content || !rightPanel) return;

  // 1. right-panel 인라인 스타일 직접 강제 설정 (CSS 클래스 충돌 완전 차단)
  rightPanel.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;min-width:0;overflow:hidden;";
  rightPanel.classList.remove("hidden");

  // 2. DOM 이동 (아직 이동 안 된 경우만)
  if (!content.contains(rightPanel)) {
    content.appendChild(rightPanel);
  }

  // 3. 오버레이 직접 표시 (.active CSS 룰 불필요)
  overlay.style.cssText = "display:flex;align-items:flex-end;justify-content:flex-end;opacity:1;pointer-events:auto;";
  overlay.classList.remove("hidden");

  // 4. 패널 초기 위치 설정 후 rAF로 트랜지션 안정적으로 트리거 (Tailwind 클래스 사용)
  panel.style.transform = ""; // 인라인 transform 제거
  panel.style.transition = ""; // 인라인 transition 제거

  requestAnimationFrame(() => {
    panel.classList.remove("translate-y-full");
    panel.classList.add("translate-y-0");
  });

  // 5. 애니메이션 완료 후 차트 캔버스 크기 강제 재계산
  setTimeout(() => {
    if (typeof window.applyChartLayout === "function") {
      window.applyChartLayout();
    }
    if (store.chart) {
      store.chart.timeScale().fitContent();
    }
  }, 380);
}


function closeMobileChart() {
  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const rightPanel = document.getElementById("right-panel");
  const mainContainer = document.getElementById("main-dashboard-content");

  if (!overlay || !panel || !rightPanel || !mainContainer) return;

  // 1. 패널 닫기 애니메이션 (Tailwind 클래스 사용)
  panel.classList.remove("translate-y-0");
  panel.classList.add("translate-y-full");

  // 2. 트랜지션 완료 후 정리
  setTimeout(() => {
    // 오버레이 숨김 (인라인 스타일 초기화)
    overlay.style.cssText = "";
    overlay.classList.add("hidden");

    // right-panel 인라인 스타일 완전 초기화
    rightPanel.style.cssText = "";
    rightPanel.classList.remove("flex");
    rightPanel.classList.add("hidden", "md:flex");

    // 원래 데스크톱 레이아웃으로 복구
    if (!mainContainer.contains(rightPanel)) {
      mainContainer.appendChild(rightPanel);
    }
  }, 320);
}


// ⭐️ 1. 탭 전환 기능 (차트 ↔ 시뮬레이터) ⭐️
function switchChartTab(mode) {
  const btnSim = document.getElementById("tab-btn-sim");
  if (mode === "chart" && btnSim.classList.contains("active")) {
    Swal.fire({
      title: "시뮬레이션 종료 🚨",
      text: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아갑니다. 종료하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      background: "var(--panel)",
      color: "var(--text)",
      confirmButtonColor: "var(--down)",
      cancelButtonColor: "var(--border)",
      confirmButtonText: "네, 초기화할게요 🗑️",
      cancelButtonText: "아니요, 계속할게요",
    }).then((result) => {
      if (result.isConfirmed) executeTabSwitch(mode);
    });
  } else {
    executeTabSwitch(mode);
  }
}

// 2. 🚨 진짜 탭을 바꾸고 화면을 업데이트하는 알맹이 로직 (여기로 분리!)
function executeTabSwitch(mode) {
  const btnChart = document.getElementById("tab-btn-chart"),
    btnSim = document.getElementById("tab-btn-sim"),
    btnQuick = document.getElementById("tab-btn-quickview"),
    controls = document.getElementById("sim-controls");

  if (mode === "chart") {
    if (btnChart) btnChart.classList.add("active");
    if (btnSim) btnSim.classList.remove("active");
    if (btnQuick) btnQuick.classList.remove("active");
    if (controls) controls.style.display = "none";

    // 퀵뷰 퇴장 처리
    const qvContainer = document.getElementById("quickview-container");
    if (qvContainer) {
      qvContainer.classList.add("hidden");
      qvContainer.style.display = "none";
    }
    if (typeof window.destroyQuickView === "function") {
      window.destroyQuickView();
    }

    if (typeof fetchHistory === "function") fetchHistory(undefined, false, true);
  } else if (mode === "sim") {
    if (btnSim) btnSim.classList.add("active");
    if (btnChart) btnChart.classList.remove("active");
    if (btnQuick) btnQuick.classList.remove("active");
    if (controls) controls.style.display = "flex";

    // 퀵뷰 퇴장 처리
    const qvContainer = document.getElementById("quickview-container");
    if (qvContainer) {
      qvContainer.classList.add("hidden");
      qvContainer.style.display = "none";
    }
    if (typeof window.destroyQuickView === "function") {
      window.destroyQuickView();
    }

    [store.binanceChartWs, store.upbitChartWs].forEach((ws) => {
      if (ws) {
        ws.onmessage = null;
        ws.close();
      }
    });
    store.binanceChartWs = null;
    store.upbitChartWs = null;

    const statusDot = document.getElementById("status-dot");
    if (statusDot) statusDot.style.background = "gray";
    const statusText = document.getElementById("status-text");
    if (statusText) statusText.innerText = "SIMULATION";
  } else if (mode === "quickview") {
    if (btnQuick) btnQuick.classList.add("active");
    if (btnChart) btnChart.classList.remove("active");
    if (btnSim) btnSim.classList.remove("active");
    if (controls) controls.style.display = "none";

    // 퀵뷰 엔진 점화
    if (typeof window.initQuickView === "function") {
      window.initQuickView();
    }
  }
}

// 🚀 좌우 패널 위치 스왑 (FLIP 애니메이션 기반 무결점 스왑 엔진)
function togglePanelSwap() {
  const container = document.getElementById("panel-split-container");
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  if (!container || !leftPanel || !rightPanel) return;

  // 1. First: 현재 위치 기록
  const firstLeft = leftPanel.getBoundingClientRect();
  const firstRight = rightPanel.getBoundingClientRect();

  // 2. 클래스 토글 (md:flex-row ↔ md:flex-row-reverse)
  const isReverse = container.classList.contains("md:flex-row-reverse");
  if (isReverse) {
    container.classList.remove("md:flex-row-reverse");
    container.classList.add("md:flex-row");
  } else {
    container.classList.remove("md:flex-row");
    container.classList.add("md:flex-row-reverse");
  }

  // 3. Last: 변경된 위치 기록
  const lastLeft = leftPanel.getBoundingClientRect();
  const lastRight = rightPanel.getBoundingClientRect();

  // 4. Invert: 변화량 계산 및 역방향 이동(transform) 강제 적용
  const deltaLeftX = firstLeft.left - lastLeft.left;
  const deltaRightX = firstRight.left - lastRight.left;

  leftPanel.style.transition = "none";
  rightPanel.style.transition = "none";
  leftPanel.style.transform = `translateX(${deltaLeftX}px)`;
  rightPanel.style.transform = `translateX(${deltaRightX}px)`;

  // 강제 리플로우(Reflow) 브라우저 레이아웃 확정
  leftPanel.getBoundingClientRect();

  // 5. Play: 2중 requestAnimationFrame으로 브라우저 프레임 스킵 버그를 완벽히 차단하고, Apple 스타일 이징으로 스르르르륵 황홀하게 스왑!
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      leftPanel.style.transition =
        "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      rightPanel.style.transition =
        "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      leftPanel.style.transform = "translateX(0)";
      rightPanel.style.transform = "translateX(0)";

      setTimeout(() => {
        leftPanel.style.transition = "";
        rightPanel.style.transition = "";
        leftPanel.style.transform = "";
        rightPanel.style.transform = "";
      }, 600);
    });
  });

  // 🚀 차트 리사이징 안전 보장
  setTimeout(() => {
    if (typeof window.applyChartLayout === "function")
      window.applyChartLayout();
  }, 620);
}

// 🚀 온보딩 모달 제어
function showOnboardingModal(force = false) {
  const modal = document.getElementById("onboarding-modal");
  const content = document.getElementById("onboarding-modal-content");
  if (!modal || !content) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  // 강제 리플로우
  void modal.offsetWidth;

  modal.classList.remove("opacity-0");
  modal.classList.add("opacity-100");
  content.classList.remove("scale-95");
  content.classList.add("scale-100");
}

function closeOnboardingModal() {
  const modal = document.getElementById("onboarding-modal");
  const content = document.getElementById("onboarding-modal-content");
  if (!modal || !content) return;

  modal.classList.remove("opacity-100");
  modal.classList.add("opacity-0");
  content.classList.remove("scale-100");
  content.classList.add("scale-95");

  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 300);
}

// 🚀 전역 스코프 노출 (HTML 인라인 onclick 이벤트용)
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.switchMobileView = switchMobileView;
window.showMobileChart = showMobileChart;
window.closeMobileChart = closeMobileChart;
window.switchChartTab = switchChartTab;
window.executeTabSwitch = executeTabSwitch;
window.togglePanelSwap = togglePanelSwap;
window.showOnboardingModal = showOnboardingModal;
window.closeOnboardingModal = closeOnboardingModal;

// ================== api.js에서 이동됨 ==================
// 검색창 비우기 (X 버튼용)
export function clearSearch() {
  const input = document.getElementById("symbol-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  searchSymbols("");
}

// 🚀 검색 리스트 (목록 즉각 필터링 로직으로 변경됨)
export function searchSymbols(v) {
  const resDiv = document.getElementById("search-results");
  if (resDiv) {
    resDiv.style.display = "none";
  }

  store.searchQuery = v || "";

  import("./table_render.js").then(({ renderTable }) => {
    renderTable();
  });
}

// 선택 로직 (티커명 검색창 전송 + 이름 유지)
export function selectSymbol(s, forceMarket = null) {
  const allSourceData = store.originalTableData || store.currentTableData || [];
  const rowInfo = allSourceData.find(
    (c) => c.Ticker === s || c.DisplayTicker === s || c.UID === s,
  );
  const uniqueTicker = rowInfo ? rowInfo.Ticker : s;

  // 🚀 [INP 최적화 Phase 1] 클릭 즉시 최소한의 상태만 변경하고 즉각 시각적 피드백 제공 (Next Paint 0~16ms 달성!)
  store.isFetchingChart = false;
  window.isFetchingChart = false;
  store.isUserZoomed = false;
  store.currentAsset = uniqueTicker;
  store.currentSelectedSymbol = uniqueTicker;

  // 🚀 주소창 해시 연동 (쌀먹 라우팅 최적화)
  if (window.history && window.history.pushState) {
    if (window.location.hash !== "#" + uniqueTicker) {
      window.history.pushState(null, null, "#" + uniqueTicker);
    }
  }

  // 1. 검색창 닫기 및 입력값 동기화 (가벼운 DOM 조작 즉시 실행)
  const symInput = document.getElementById("symbol-input");
  if (symInput) {
    symInput.value = rowInfo ? rowInfo.Symbol : s;
  }
  const searchRes = document.getElementById("search-results");
  if (searchRes) searchRes.style.display = "none";

  // 🚀 [추가] 초기 안내 오버레이 숨기기
  const initMessage = document.getElementById("chart-init-message");
  if (initMessage) initMessage.style.display = "none";

  // 2. 리스트(목록) 행 즉시 하이라이트 반영 (시각적 피드백 선행)
  if (typeof applySelectedHighlight === "function") {
    applySelectedHighlight();
  }

  // 🚀 [INP 최적화 Phase 2] 무거운 배열 탐색, DOM 재생성, API 통신, 차트 렌더링(fetchHistory)을 다음 페인트 이후로 양보(Yielding)
  requestAnimationFrame(() => {
    setTimeout(() => {
      // 마켓 우선순위 결정
      if (forceMarket) {
        store.currentMarket = forceMarket;
      } else if (rowInfo && rowInfo.Listed_Exchanges) {
        const ex = rowInfo.Listed_Exchanges;
        const isQuoteCurrency = uniqueTicker.startsWith("USDT");

        // 🚀 [추가] 필터 모드가 UPBIT이면 무조건 업비트를 최우선으로 잡도록 분기 처리
        if (store.filterMode === "UPBIT" && ex.includes("UPBIT")) {
          store.currentMarket = "UPBIT";
        } else if (
          isQuoteCurrency &&
          (ex.includes("UPBIT") || ex.includes("BITHUMB"))
        ) {
          store.currentMarket = ex.includes("UPBIT") ? "UPBIT" : "BITHUMB";
        } else if (ex.includes("BINANCE_FUTURES")) {
          store.currentMarket = "FUTURES";
        } else if (ex.includes("BINANCE")) {
          store.currentMarket = "SPOT";
        } else if (ex.includes("UPBIT")) {
          store.currentMarket = "UPBIT";
        } else if (ex.includes("BITHUMB")) {
          store.currentMarket = "BITHUMB";
        } else if (ex.includes("BYBIT")) {
          store.currentMarket = "BYBIT";
        }
      }

      const p = store.getPrecision(uniqueTicker);
      const headAssetName = document.getElementById("head-asset-name");

      if (rowInfo) {
        if (headAssetName) {
          const favorites = JSON.parse(
            localStorage.getItem("sellnance_favs") || "[]",
          );
          const favorites2 = JSON.parse(
            localStorage.getItem("sellnance_favs2") || "[]",
          );
          const isFav = favorites.includes(rowInfo.UID);
          const isFav2 = favorites2.includes(rowInfo.UID);

          let starText = "☆";
          let starColor = "gray";
          let starClass = "";
          if (isFav) {
            starText = "★";
            starColor = "#e3b30a"; // 🚀 노란색 고정 (라이트모드 파란색 오염 방어)
            starClass = "active";
          } else if (isFav2) {
            starText = "★";
            starColor = "#3b82f6";
            starClass = "active-blue";
          }

          const logoHtml = rowInfo.Logo || "";
          const fullText = `${rowInfo.Symbol} (${rowInfo.Name || ""})`;
          const len = fullText.length;
          // 수학적 로그 방식 적용: 10글자 초과 시 길이에 반비례하여 부드럽게 폰트 크기 축소 (기본 1.125rem, 최소 0.65rem)
          let fontSizeStyle = "";
          if (len > 10) {
            const sizeRem = Math.max(0.65, 1.125 - Math.log10(len / 10) * 0.6);
            fontSizeStyle = `style="font-size: ${sizeRem.toFixed(3)}rem; line-height: 1.1; word-break: break-all; white-space: normal;"`;
          } else {
            fontSizeStyle = `style="white-space: nowrap;"`;
          }

          headAssetName.innerHTML = `
            <div class="flex items-center gap-2">
              <button onclick="window.toggleFavorite('${rowInfo.UID}', event, true); setTimeout(() => window.selectSymbol('${uniqueTicker}'), 50);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                ${starText}
              </button>
              <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                ${logoHtml}
              </div>
              <span ${fontSizeStyle}>${fullText}</span>
            </div>
          `;
        }

        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(rowInfo, undefined, p);
        }
      }

      updateExchangeBadges(uniqueTicker);

      // 🚀 호가창(Orderbook) 업데이트 (호가창 패널이 열려 있을 경우 자동 재연결)
      if (typeof window.startOrderbookStream === "function") {
        window.startOrderbookStream(uniqueTicker, store.currentMarket);
      }

      // 코인 상세 이름 비동기 패치
      try {
        const querySym = rowInfo ? rowInfo.DisplayTicker : uniqueTicker;
        fetch(`/api/coin-info/${querySym}`)
          .then((res) => res.json())
          .then((infoData) => {
            if (headAssetName && infoData.name) {
              const displaySym =
                infoData.symbol ||
                (rowInfo ? rowInfo.Symbol : querySym.split("(")[0]);
              const favorites = JSON.parse(
                localStorage.getItem("sellnance_favs") || "[]",
              );
              const favorites2 = JSON.parse(
                localStorage.getItem("sellnance_favs2") || "[]",
              );
              const isFav = favorites.includes(
                rowInfo ? rowInfo.UID : uniqueTicker,
              );
              const isFav2 = favorites2.includes(
                rowInfo ? rowInfo.UID : uniqueTicker,
              );

              let starText = "☆";
              let starColor = "gray";
              let starClass = "";
              if (isFav) {
                starText = "★";
                starColor = "#e3b30a"; // 🚀 노란색 고정 (라이트모드 파란색 오염 방어)
                starClass = "active";
              } else if (isFav2) {
                starText = "★";
                starColor = "#3b82f6";
                starClass = "active-blue";
              }

              const logoHtml = rowInfo ? rowInfo.Logo || "" : "";
              const fullText2 = `${displaySym} (${infoData.name})`;
              const len2 = fullText2.length;
              let fontSizeStyle2 = "";
              if (len2 > 10) {
                const sizeRem = Math.max(
                  0.65,
                  1.125 - Math.log10(len2 / 10) * 0.6,
                );
                fontSizeStyle2 = `style="font-size: ${sizeRem.toFixed(3)}rem; line-height: 1.1; word-break: break-all; white-space: normal;"`;
              } else {
                fontSizeStyle2 = `style="white-space: nowrap;"`;
              }

              headAssetName.innerHTML = `
                <div class="flex items-center gap-2">
                  <button onclick="window.toggleFavorite('${rowInfo ? rowInfo.UID : uniqueTicker}', event, true); setTimeout(() => window.selectSymbol('${uniqueTicker}'), 50);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                    ${starText}
                  </button>
                  <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                    ${logoHtml}
                  </div>
                  <span ${fontSizeStyle2}>${fullText2}</span>
                </div>
              `;
            }
          })
          .catch((e) => console.error("이름 로드 실패", e));
      } catch (e) {
        console.error("이름 로드 에러", e);
      }

      // 리스트 스크롤 이동
      const sortedList = store.currentTableData;
      const targetIdx = sortedList.findIndex(
        (item) =>
          item.DisplayTicker === uniqueTicker || item.Ticker === uniqueTicker,
      );

      if (targetIdx !== -1) {
        if (targetIdx >= store.currentRenderLimit) {
          store.currentRenderLimit = targetIdx + 1;
          if (typeof renderTable === "function") renderTable();
        }
        setTimeout(() => {
          store.currentSelectedSymbol = uniqueTicker;
          const targetRow = document.querySelector(
            `#coin-list-body > div[data-sym="${uniqueTicker}"]`,
          );
          if (targetRow) {
            // targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
            if (typeof applySelectedHighlight === "function")
              applySelectedHighlight();
          }
        }, 50);
      }

      // 🚀 [핵심] 차트 데이터 패치 실행 (메인 스레드 경합 완벽 해소)
      if (typeof fetchHistory === "function") {
        fetchHistory(uniqueTicker, false, false);
      }
    }, 0);
  });
}

// 배지 UI 업데이트 헬퍼
export function updateExchangeBadges(s) {
  const rowInfo = store.currentTableData.find(
    (c) => c.DisplayTicker === s || c.Ticker === s,
  );
  let badges = "";
  if (rowInfo) {
    const list = [
      {
        id: "B-FUT",
        label: "B-FUT",
        bg: "bg-[#f0b90b]",
        text: "text-black",
        market: "FUTURES",
        condition: rowInfo.Listed_Exchanges?.includes("BINANCE_FUTURES"),
      },
      {
        id: "B-SPOT",
        label: "B-SPOT",
        bg: "bg-[#444]",
        text: "text-white",
        market: "SPOT",
        condition: rowInfo.Listed_Exchanges?.includes("BINANCE"),
      },
      {
        id: "BYBIT",
        label: "BYBIT",
        bg: "bg-[#f5a800]", // Bybit's brand yellow
        text: "text-black",
        market: "BYBIT",
        condition: rowInfo.Listed_Exchanges?.includes("BYBIT"),
      },
      {
        id: "UPBIT",
        label: "UPBIT",
        bg: "bg-[#093687]",
        text: "text-white",
        market: "UPBIT",
        condition:
          rowInfo.Listed_Exchanges?.includes("UPBIT") || rowInfo.Upbit === "O",
      },
      {
        id: "BITHUMB",
        label: "BITHUMB",
        bg: "bg-[#ff8b00]",
        text: "text-white",
        market: "BITHUMB",
        condition: rowInfo.Listed_Exchanges?.includes("BITHUMB"),
      },
    ];

    list.forEach((item) => {
      if (item.condition) {
        // Highlight active market badge
        const isActive = store.currentMarket === item.market;
        const ringClass = isActive
          ? "ring-2 ring-white scale-105 shadow-lg brightness-110"
          : "opacity-60 hover:opacity-100 hover:scale-105";
        badges += `<button onclick="selectSymbol('${rowInfo.Ticker}', '${item.market}')" class="${item.bg} ${item.text} ${ringClass} text-[11px] font-bold px-2.5 py-1 rounded transition-all duration-200 cursor-pointer select-none active:scale-95 ml-1.5 first:ml-0">${item.label}</button>`;
      }
    });
  }

  const badgeContainer = document.getElementById("exchange-badges");
  if (badgeContainer) badgeContainer.innerHTML = badges;
}

// executeSetTF나 코인 클릭 함수(selectSymbol) 등 마켓이 바뀌는 모든 시점에 이 '세척기'를 돌려야 합니다.
// ================== chart.js에서 이동됨 ==================
export function setTF(tf) {
  // 🚀 [추가] 같은 프레임 봉이면 API 중복 호출 방지를 위해 즉시 튕겨냄!
  if (store.currentTF === tf) return;

  const btnSim = document.getElementById("tab-btn-sim");
  const isSimMode = btnSim ? btnSim.classList.contains("active") : false;

  if (isSimMode) {
    window.Swal.fire({
      title: "초기화 경고!",
      text: "타임프레임을 변경하면 현재 그려둔 가상 차트가 모두 날아갑니다. 바꿀까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--up)",
      cancelButtonColor: "var(--border)",
      confirmButtonText: "네, 변경할게요 🚀",
      cancelButtonText: "아니요, 취소",
      background: "var(--panel)",
      color: "var(--text)",
    }).then((result) => {
      if (result.isConfirmed) executeSetTF(tf);
    });
  } else {
    executeSetTF(tf);
  }
}

export function executeSetTF(tf) {
  store.currentTF = tf;
  document.querySelectorAll(".tf-btn").forEach((b) => {
    const onClickAttr = b.getAttribute("onclick") || "";
    const isMatch = onClickAttr.includes(`'${tf}'`);

    b.classList.toggle("active", isMatch);
    b.classList.toggle("opacity-100", isMatch);
    b.classList.toggle("opacity-50", !isMatch);
  });

  if (typeof window.renderTimeframeButtons === "function") {
    window.renderTimeframeButtons(tf);
  }

  // 4. 차트 데이터 갱신 함수 호출 (타임프레임 변경임을 명시: true)
  if (typeof fetchHistory === "function")
    fetchHistory(store.currentAsset, true);
}

export function toggleLogScale(forceVal) {
  if (forceVal !== undefined) {
    store.isLogMode = forceVal;
  } else {
    store.isLogMode = !store.isLogMode;
  }
  if (store.chart) {
    store.chart
      .priceScale("right")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
  }
  const btn = document.getElementById("toggle-log-scale-btn");
  if (btn) {
    btn.innerText = store.isLogMode ? "Log 축" : "Linear 축";
    if (!store.isLogMode) {
      btn.classList.add(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.remove("bg-theme-panel/50");
    } else {
      btn.classList.remove(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.add("bg-theme-panel/50");
    }
  }

  // 🚀 [추가] 차트 캔버스 오버레이 L 버튼 활성화 스타일 연동 (메인 + 볼륨 공동)
  const overlayLBtn = document.getElementById("main-scale-l-btn");
  const overlayVolLBtn = document.getElementById("vol-scale-l-btn");

  if (store.chartVol) {
    store.chartVol.priceScale("right").applyOptions({ mode: store.isLogMode ? 1 : 0 });
    store.chartVol.priceScale("left").applyOptions({ mode: store.isLogMode ? 1 : 0 });
  }

  if (overlayLBtn) {
    if (store.isLogMode) {
      overlayLBtn.className = "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      overlayLBtn.className = "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
    }
  }

  if (overlayVolLBtn) {
    if (store.isLogMode) {
      overlayVolLBtn.className = "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      overlayVolLBtn.className = "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
    }
  }

  if (typeof window.resetPriceScaleWidthSync === "function") {
    window.resetPriceScaleWidthSync();
  }
}

export function moveTabSlider(index) {
  const slider = document.getElementById("tab-sliding-bg");
  if (!slider) return;

  const buttons = document.querySelectorAll(".chart-tabs-btn");
  if (buttons.length <= index) return;

  const btn = buttons[index];
  const btnRect = btn.getBoundingClientRect();
  const parent = btn.parentElement;
  const parentRect = parent.getBoundingClientRect();

  const left = btnRect.left - parentRect.left;
  slider.style.left = `${left}px`;
  slider.style.width = `${btnRect.width}px`;

  // Quick View 탭(index 2)일 때만 네온 글로우 활성화
  const neonGlow = document.getElementById("quickview-neon-glow");
  const neonMask = document.getElementById("quickview-neon-mask");
  if (index === 2) {
    if (neonGlow) neonGlow.style.opacity = "0.7";
    if (neonMask) neonMask.style.opacity = "1";
  } else {
    if (neonGlow) neonGlow.style.opacity = "0";
    if (neonMask) neonMask.style.opacity = "0";
  }
}

window.setTF = setTF;
window.executeSetTF = executeSetTF;
window.toggleLogScale = toggleLogScale;
window.switchViewMode = switchViewMode;
window.moveTabSlider = moveTabSlider;

// 🚀 [추가] 탭 컨테이너 크기 변경(리사이즈, 사이드바 접기/펼치기 등) 시 노란색 하이라이터 위치 동적 재조정
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const container = document.getElementById("chart-tab-container");
    if (container) {
      const observer = new ResizeObserver(() => {
        const activeBtn = container.querySelector(".chart-tabs-btn.active");
        if (activeBtn) {
          const buttons = Array.from(container.querySelectorAll(".chart-tabs-btn"));
          const idx = buttons.indexOf(activeBtn);
          if (idx !== -1) {
            moveTabSlider(idx);
          }
        }
      });
      observer.observe(container);

      // 🚀 [추가] 페이지 첫 로딩 시 현재 active 클래스가 설정된 탭(기본 Pure Chart) 위치로 즉시 하이라이터 이동
      const activeBtn = container.querySelector(".chart-tabs-btn.active");
      if (activeBtn) {
        const buttons = Array.from(container.querySelectorAll(".chart-tabs-btn"));
        const idx = buttons.indexOf(activeBtn);
        if (idx !== -1) {
          moveTabSlider(idx);
        }
      }
    }
  }, 100);
});

// 🚀 제일 우측 끝에 나란히 차트 전체화면 버튼 구현 및 전체화면 시 tf-container 노출 연동 래퍼
setTimeout(() => {
  const originalRenderTimeframeButtons = window.renderTimeframeButtons;
  if (typeof originalRenderTimeframeButtons === "function") {
    window.renderTimeframeButtons = function (currentTF) {
      originalRenderTimeframeButtons(currentTF);

      const container = document.getElementById("tf-container");
      if (!container) return;

      let fullscreenBtn = document.getElementById("chart-fullscreen-btn");
      if (!fullscreenBtn) {
        fullscreenBtn = document.createElement("button");
        fullscreenBtn.id = "chart-fullscreen-btn";
        fullscreenBtn.className =
          "px-2.5 py-1 text-[11px] font-bold bg-transparent text-theme-text opacity-60 border border-theme-border/30 rounded hover:bg-theme-border/50 hover:opacity-100 transition-all ml-2 flex-shrink-0 cursor-pointer flex items-center gap-1";

        // 동적 전체화면 CSS 스타일 주입
        if (!document.getElementById("fullscreen-tf-css")) {
          const styleEl = document.createElement("style");
          styleEl.id = "fullscreen-tf-css";
          styleEl.innerHTML = `
            .fullscreen-tf-style {
              background-color: var(--panel, #131722) !important;
              padding: 10px 15px !important;
              border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1)) !important;
              z-index: 150 !important;
              position: relative !important;
            }
            .fullscreen-tf-style #toggle-orderbook-btn {
              display: none !important;
            }
          `;
          document.head.appendChild(styleEl);
        }

        // 오리지널 부모 저장
        const originalParent = container.parentElement;
        const originalHeadCtrlParent =
          document.getElementById("head-control-buttons")?.parentElement ||
          null;

        fullscreenBtn.onclick = () => {
          const wrapper = document.getElementById("chart-wrapper");
          if (!document.fullscreenElement) {
            wrapper.requestFullscreen().catch((err) => {
              console.error(
                `Error attempting to enable fullscreen: ${err.message}`,
              );
            });
          } else {
            document.exitFullscreen();
          }
        };

        document.addEventListener("fullscreenchange", () => {
          const wrapper = document.getElementById("chart-wrapper");
          const legend = document.getElementById("ohlc-legend");
          const headCtrl = document.getElementById("head-control-buttons");
          if (document.fullscreenElement === wrapper) {
            // 전체화면 진입: tf-container를 차트 내부 최상단으로 이동
            container.classList.add("fullscreen-tf-style");
            wrapper.insertBefore(container, wrapper.firstChild);

            // 🚀 head-control-buttons를 tf-container 안에 함께 배치
            if (headCtrl) {
              headCtrl.dataset.fsOrigParent = headCtrl.parentElement
                ? headCtrl.parentElement.id || ""
                : "";
              headCtrl.style.marginLeft = "auto";
              container.insertBefore(headCtrl, fullscreenBtn);
            }

            // 🚀 OHLC 레전드가 tf-container에 겹치지 않도록 아래로 밀기
            if (legend) {
              legend.style.setProperty("top", "52px", "important");
            }

            fullscreenBtn.innerHTML = "<span>🎚️</span> <span>화면 복원</span>";
            fullscreenBtn.classList.add(
              "text-theme-accent",
              "border-theme-accent/40",
            );
          } else {
            // 전체화면 탈출: tf-container를 원래 위치로 복원
            container.classList.remove("fullscreen-tf-style");

            // 🚀 head-control-buttons를 원래 부모로 복원
            if (headCtrl && originalHeadCtrlParent) {
              originalHeadCtrlParent.appendChild(headCtrl);
              headCtrl.style.marginLeft = "";
            }

            if (originalParent) {
              originalParent.appendChild(container);
            }

            // 🚀 OHLC 레전드 탑 위치 원복
            if (legend) {
              legend.style.removeProperty("top");
            }

            fullscreenBtn.innerHTML = "<span>🖥️</span> <span>전체화면</span>";
            fullscreenBtn.classList.remove(
              "text-theme-accent",
              "border-theme-accent/40",
            );
          }

          // 🚀 DOM 재배치 후 캔버스 높이 재계산을 위한 차트 레이아웃 강제 갱신 (겹침 원천 방지)
          setTimeout(() => {
            if (typeof window.applyChartLayout === "function") {
              window.applyChartLayout();
            }
          }, 50);
        });
      }

      // 초기 렌더링 시 텍스트 설정
      if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = "<span>🎚️</span> <span>화면 복원</span>";
        fullscreenBtn.classList.add(
          "text-theme-accent",
          "border-theme-accent/40",
        );
      } else {
        fullscreenBtn.innerHTML = "<span>🖥️</span> <span>전체화면</span>";
        fullscreenBtn.classList.remove(
          "text-theme-accent",
          "border-theme-accent/40",
        );
      }

      // 설정 버튼 우측에 전체화면 버튼이 위치하도록 부모 컨테이너에 추가
      const dropdown = container.parentElement.querySelector("#tf-settings-dropdown");
      if (dropdown) {
        container.parentElement.insertBefore(fullscreenBtn, dropdown);
      } else {
        container.parentElement.appendChild(fullscreenBtn);
      }
    };

    // 강제 1회 재생성
    if (store.currentTF) {
      window.renderTimeframeButtons(store.currentTF);
    } else {
      window.renderTimeframeButtons("1d");
    }
  }
}, 50);

// 🚀 [추가] 브라우저 창 크기나 패널 간 너비 충돌로 인한 렉 현상 방지용 제어 함수
export function checkLayoutOverlap() {
  // 모바일에서는 오버레이로 차트를 띄우므로 레이아웃 충돌 계산이 필요 없습니다. (오히려 렉과 버그 유발)
  if (window.innerWidth < 768) return;

  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  if (!leftPanel || !rightPanel) return;

  // 모바일 오버레이가 열려있을 때도 간섭 금지
  const overlay = document.getElementById("mobile-chart-overlay");
  if (overlay && overlay.style.opacity === "1") return;

  const containerWidth = document.body.clientWidth;
  const leftWidth = leftPanel.offsetWidth;

  // 우측 패널의 HTML min-w인 600px을 기준으로 너비 부족 시 display: none 처리하여 렉 방지
  if (containerWidth < leftWidth + 600) {
    if (rightPanel.style.display !== "none") {
      rightPanel.style.display = "none";
    }
  } else {
    if (rightPanel.style.display !== "flex") {
      rightPanel.style.display = "flex";
    }
  }
}

window.checkLayoutOverlap = checkLayoutOverlap;

// 🚀 창 크기 변경 시 렉 방지: 150ms 디바운스 적용
let _overlapDebounceTimer = null;
window.addEventListener("resize", () => {
  if (_overlapDebounceTimer) clearTimeout(_overlapDebounceTimer);
  _overlapDebounceTimer = setTimeout(checkLayoutOverlap, 150);
});
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(checkLayoutOverlap, 200);

  // 🚀 모바일 환경: 가격 축 터치 시 A/L 버튼 표시, 차트 터치 시 숨김 (트뷰 앱 방식)
  const paneMain = document.getElementById("pane-main");
  if (paneMain) {
    const scaleContainer = paneMain.querySelector(".scale-mode-container");
    if (scaleContainer) {
      paneMain.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const rect = paneMain.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        // 우측 가격 축 영역(약 70px)을 터치하면 버튼 표시, 아니면 숨김
        if (rect.width - touchX <= 75) {
          scaleContainer.classList.add("mobile-show-scale-btn");
        } else {
          scaleContainer.classList.remove("mobile-show-scale-btn");
        }
      }, { passive: true });
    }
  }
});

// ================== 타임프레임 커스텀 설정 UI (index.html에서 이동됨) ==================
const timeframes = [
  { label: "1분", value: "1m" },
  { label: "3분", value: "3m" },
  { label: "5분", value: "5m" },
  { label: "15분", value: "15m" },
  { label: "30분", value: "30m" },
  { label: "1시간", value: "1h" },
  { label: "2시간", value: "2h" },
  { label: "4시간", value: "4h" },
  { label: "12시간", value: "12h" },
  { label: "1D", value: "1d" },
  { label: "3D", value: "3d" },
  { label: "1W", value: "1w" },
  { label: "1달", value: "1M" },
];

function getVisibleTfs() {
  try {
    const saved = localStorage.getItem("sellnance_tf_settings");
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return timeframes.map(t => t.value);
}

function saveVisibleTfs(arr) {
  localStorage.setItem("sellnance_tf_settings", JSON.stringify(arr));
  if (window.store) window.store.visibleTfs = arr;
}

export function renderTimeframeButtons(currentTF = "1d") {
  const container = document.getElementById("tf-container");
  if (!container) return;
  const existingButtons = container.querySelectorAll(".tf-btn");
  existingButtons.forEach((btn) => btn.remove());

  const visibleVals = getVisibleTfs();

  timeframes.slice().reverse().forEach((tf) => {
    if (!visibleVals.includes(tf.value)) return;
    const btn = document.createElement("button");
    const activeClass =
      tf.value === currentTF
        ? "active !opacity-100 border-theme-accent"
        : "border-transparent";
    btn.className = `tf-btn px-2.5 py-1 text-[11px] font-medium bg-transparent text-theme-text opacity-50 border rounded hover:bg-theme-border/50 hover:opacity-100 transition-all ${activeClass}`;
    btn.innerText = tf.label;
    btn.onclick = () => {
      setTF(tf.value);
      renderTimeframeButtons(tf.value);
    };

    container.prepend(btn);
  });
}
window.renderTimeframeButtons = renderTimeframeButtons; // 🚀 전체화면 래퍼와의 호환성 복원!

let pendingTfSettings = null; // 🚀 모달 내 임시 상태 저장소

function toggleTfSettings() {
  const dropdown = document.getElementById("tf-settings-dropdown");
  if (!dropdown) return;
  if (dropdown.classList.contains("hidden")) {
    pendingTfSettings = [...getVisibleTfs()]; // 임시 상태 초기화
    renderTfCheckboxList();
    dropdown.classList.remove("hidden");
    dropdown.classList.add("flex");
    void dropdown.offsetWidth;
    dropdown.classList.remove("opacity-0", "translate-y-[-10px]");
    dropdown.classList.add("opacity-100", "translate-y-0");
  } else {
    dropdown.classList.remove("opacity-100", "translate-y-0");
    dropdown.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => {
      dropdown.classList.remove("flex");
      dropdown.classList.add("hidden");
      pendingTfSettings = null; // 닫힐 때 파기
    }, 200);
  }
}

function renderTfCheckboxList() {
  const container = document.getElementById("tf-checkbox-container");
  if (!container) return;
  container.innerHTML = "";
  const visibleVals = pendingTfSettings || getVisibleTfs();

  timeframes.forEach((tf) => {
    const btn = document.createElement("button");
    const isChecked = visibleVals.includes(tf.value);

    // 🚀 체크박스 대신 예쁜 뱃지 토글 디자인 적용
    btn.className = `px-2 py-1.5 text-[11px] font-bold rounded border transition-all cursor-pointer ${isChecked
      ? "bg-theme-accent text-white border-theme-accent shadow-sm"
      : "bg-theme-panel/50 text-theme-text opacity-50 border-theme-border/50 hover:opacity-100 hover:border-theme-border"
      }`;
    btn.innerText = tf.label;

    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // 모달이 꺼지는 버그 방지
      const newChecked = !visibleVals.includes(tf.value);
      if (newChecked) {
        pendingTfSettings.push(tf.value);
      } else {
        pendingTfSettings = pendingTfSettings.filter(v => v !== tf.value);
      }
      if (pendingTfSettings.length === 0) pendingTfSettings = [tf.value];

      renderTfCheckboxList(); // 모달 UI만 갱신
    });

    container.appendChild(btn);
  });

  // 🚀 마지막 4x4 위치 (col-start-4)에 작게 확인 버튼 배치
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "col-start-4 px-2 py-1.5 text-[11px] font-bold border border-theme-accent text-theme-accent hover:bg-theme-accent hover:text-white rounded transition-all shadow-sm flex items-center justify-center";
  confirmBtn.innerText = "확인"
  confirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.applyTfSettings) window.applyTfSettings();
  });
  container.appendChild(confirmBtn);
}

function applyTfSettings() {
  if (pendingTfSettings && pendingTfSettings.length > 0) {
    saveVisibleTfs(pendingTfSettings);

    const activeBtn = document.querySelector("#tf-container .tf-btn.active");
    let curTf = "1d";
    if (activeBtn) {
      const match = timeframes.find(t => t.label === activeBtn.innerText);
      if (match) curTf = match.value;
    }
    renderTimeframeButtons(curTf);
  }
  toggleTfSettings();
}
window.applyTfSettings = applyTfSettings;
window.toggleTfSettings = toggleTfSettings;

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("tf-settings-dropdown");
  const btn = e.target.closest("button[onclick='toggleTfSettings()']");

  // 모달 영역 바깥을 누르면 자동으로 취소(닫기 + 초기화)
  if (!btn && dropdown && !dropdown.contains(e.target) && !dropdown.classList.contains("hidden")) {
    toggleTfSettings();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderTimeframeButtons("1d");
  const isOhlcHidden = localStorage.getItem("sellnance_ohlc_hidden") === "true";
  if (isOhlcHidden) {
    document.getElementById("ohlc-legend")?.classList.add("hidden");
  }
});
