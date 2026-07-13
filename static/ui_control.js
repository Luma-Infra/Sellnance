// ui_control.js
// --- 📱 UI/UX 컨트롤 로직 ---
import { store, CONFIG } from "./_store.js";
import { initChart, updateChartTheme } from "./chart.js";
import { fetchHistory } from "./chart_data.js";
import { getPureBase } from "./chart_utils.js";
import { selectSymbol, updateExchangeBadges } from "./ui_selection.js";
import { renderTable } from "./table_render.js";
export { selectSymbol, updateExchangeBadges };

let isThemeToggling = false; // 🚀 라이트/다크 모드 연타 방어 플래그
let _closeMobileChartTimer = null; // 🚀 closeMobileChart 타이머 ID (충돌 방지용)

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
    if (faviconLink) faviconLink.href = staticPath + "luma-deer-svg-light.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "luma-deer-svg-light.svg";
  } else {
    body.classList.remove("theme-upbit");
    body.classList.add("theme-binance");
    store.currentTheme = "binance";
    if (btn) btn.innerHTML = "☀️";
    if (faviconLink) faviconLink.href = staticPath + "luma-deer-svg-dark.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "luma-deer-svg-dark.svg";
  }

  // 🚀 테마 설정을 로컬에 영구 저장
  localStorage.setItem("sellnance_theme", store.currentTheme);

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

  // 🚀 사이드바 폴딩 상태를 로컬에 영구 저장
  localStorage.setItem("sellnance_sidebar_collapsed", (!store.isSidebarOpen).toString());
}

export function switchViewMode(mode) {
  store.tableViewMode = mode;
  const panel = document.getElementById("left-panel");
  if (!panel) return;

  // 🚀 뷰 모드 설정을 로컬에 영구 저장
  localStorage.setItem("sellnance_table_view_mode", mode);

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

  // if (tabAll) tabAll.textContent = isSimple ? "ALL" : "ALL LIST";

  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
  if (btnSmallCap)
    btnSmallCap.textContent = isSimple ? "🚫 Mcap < 1M" : "🚫 Hiding Mcap < 1M";

  const btnCustomText = document.getElementById("btn-custom-filter-text");
  if (btnCustomText) {
    if (isSimple) {
      btnCustomText.classList.add("hidden");
      btnCustomText.classList.remove("md:inline");
    } else {
      btnCustomText.classList.remove("hidden");
      btnCustomText.classList.add("md:inline");
    }
  }

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

  // 🚀 이전 close 타이머가 실행 중이면 취소해서 race condition 방지
  if (_closeMobileChartTimer) {
    clearTimeout(_closeMobileChartTimer);
    _closeMobileChartTimer = null;
  }

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const content = document.getElementById("mobile-chart-content");
  const rightPanel = document.getElementById("right-panel");

  if (!overlay || !panel || !content || !rightPanel) return;

  // 1. right-panel 인라인 스타일 직접 강제 설정 (CSS 클래스 충돌 완전 차단)
  rightPanel.style.cssText =
    "display:flex;flex-direction:column;height:100%;width:100%;min-width:0;overflow:hidden;";
  rightPanel.classList.remove("hidden");

  // 2. DOM 이동 (아직 이동 안 된 경우만)
  if (!content.contains(rightPanel)) {
    content.appendChild(rightPanel);
  }

  // 3. 오버레이 직접 표시 (.active CSS 룰 불필요) — bottom:48px 유지해서 네비바 위까지만 표시
  overlay.style.cssText =
    "display:flex;align-items:flex-end;justify-content:flex-end;opacity:1;pointer-events:auto;bottom:48px;";
  overlay.classList.remove("hidden");

  // 4. 패널 초기 위치 설정 — 먼저 translate-y-full 제거 후 rAF로 트랜지션 트리거
  panel.style.transform = ""; // 인라인 transform 제거
  panel.style.transition = ""; // 인라인 transition 제거
  panel.classList.remove("translate-y-full"); // 즉시 제거 (이전 closeMobileChart 잔여 클래스 방지)

  requestAnimationFrame(() => {
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
  const mainContainer = document.getElementById("panel-split-container");

  if (!overlay || !panel || !rightPanel || !mainContainer) return;

  // 1. 패널 닫기 애니메이션 (Tailwind 클래스 사용)
  panel.classList.remove("translate-y-0");
  panel.classList.add("translate-y-full");

  // 2. 트랜지션 완료 후 정리
  _closeMobileChartTimer = setTimeout(() => {
    _closeMobileChartTimer = null;
    // 오버레이 숨김 (인라인 스타일 초기화)
    overlay.style.cssText = "";
    overlay.classList.add("hidden");

    // right-panel 인라인 스타일 완전 초기화
    rightPanel.style.cssText = "";
    rightPanel.classList.remove("flex");
    rightPanel.classList.add("hidden", "min-[1200px]:flex");

    // 원래 panel-split-container 안으로 복구
    if (!mainContainer.contains(rightPanel)) {
      mainContainer.appendChild(rightPanel);
    }
  }, 320);
}


// 🚀 모바일 하단 네비 탭 전환 컨트롤러
function switchMobileTab(tab) {
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH) return;

  const leftPanel = document.getElementById("left-panel");
  const settingsModal = document.getElementById("settings-modal");

  // Alpine.js에 탭 변경 이벤트 전파하여 버튼 하이라이트/비활성화 상태를 선언적으로 처리
  window.dispatchEvent(new CustomEvent("mobile-tab-changed", { detail: tab }));

  if (tab === "list") {
    // 차트 오버레이 닫기
    closeMobileChart();
    // 설정 모달 닫기
    if (settingsModal) {
      settingsModal.style.display = "none";
    }
    // 리스트 보이기
    if (leftPanel) leftPanel.style.display = "";

  } else if (tab === "chart") {
    // 설정 모달 닫기
    if (settingsModal) {
      settingsModal.style.display = "none";
    }

    // 🚀 모바일: 시뮬/퀵뷰를 fetchHistory 재호출 없이 직접 숨기기
    const simControls = document.getElementById("sim-controls");
    if (simControls) simControls.style.display = "none";
    const qvContainer = document.getElementById("quickview-container");
    if (qvContainer) {
      qvContainer.classList.add("hidden");
      qvContainer.style.display = "none";
    }
    if (typeof window.destroyQuickView === "function") window.destroyQuickView();

    // 차트 오버레이 열기
    if (store.currentSelectedSymbol) {
      // 이미 차트가 로드된 경우: selectSymbol 재호출 없이 오버레이만 열기
      if (typeof window.showMobileChart === "function") {
        window.showMobileChart();
      }
    } else {
      // 최초 진입 시: 첫 번째 코인 선택 (selectSymbol 내부에서 showMobileChart 호출됨)
      const firstRow = document.querySelector("#coin-list-body .coin-row");
      if (firstRow && typeof window.selectSymbol === "function") {
        window.selectSymbol(firstRow.dataset.sym);
      }
    }

  } else if (tab === "settings") {
    // 차트 오버레이 닫기
    closeMobileChart();
    // 설정 모달 열기
    if (typeof window.openSettingsModal === "function") {
      window.openSettingsModal();
    }
  }

  store._currentMobileTab = tab;
}

window.switchMobileTab = switchMobileTab;

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

    if (typeof fetchHistory === "function")
      fetchHistory(undefined, false, true);
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
    localStorage.setItem("sellnance_panel_swapped", "false");
  } else {
    container.classList.remove("md:flex-row");
    container.classList.add("md:flex-row-reverse");
    localStorage.setItem("sellnance_panel_swapped", "true");
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
  // force가 true가 아니고, 이미 보지 않기 설정을 한 경우 모달을 띄우지 않음
  if (!force && localStorage.getItem("sellnance_onboarding_shown") === "true") {
    return;
  }

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

  // '다시 보지 않기' 체크박스 선택 여부 확인 후 로컬스토리지에 저장
  const neverShowChk = document.getElementById("onboarding-never-show");
  if (neverShowChk && neverShowChk.checked) {
    localStorage.setItem("sellnance_onboarding_shown", "true");
  }

  modal.classList.remove("opacity-100");
  modal.classList.add("opacity-0");
  content.classList.remove("scale-100");
  content.classList.add("scale-95");

  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 300);
}

function toggleRightDomBlock(checked) {
  store.blockRightDom = checked;
  // Xconsole.log(`⚡ [DEBUG] 우측 패널 DOM 차단 모드: ${checked ? "ON" : "OFF"}`);

  // 🚀 부모 차단 시 자식 체크박스들 강제 제어 (disabled 및 opacity 비주얼 싱크)
  const childChart = document.getElementById("block-chart-dom-toggle");
  const childOb = document.getElementById("block-orderbook-toggle");
  const childLegend = document.getElementById("block-legend-toggle");
  const childResize = document.getElementById("block-resize-toggle");
  const childMouseEvent = document.getElementById("block-mouse-event-toggle");

  const containerChart = document.getElementById("child-chart-container");
  const containerOb = document.getElementById("child-orderbook-container");
  const containerLegend = document.getElementById("child-legend-container");
  const containerResize = document.getElementById("child-resize-container");
  const containerMouseEvent = document.getElementById("child-mouse-event-container");

  if (checked) {
    if (childChart) { childChart.disabled = true; childChart.checked = true; store.blockChartDom = true; }
    if (childOb) { childOb.disabled = true; childOb.checked = true; store.blockOrderbook = true; if (typeof window.stopOrderbookStream === "function") window.stopOrderbookStream(); }
    if (childLegend) { childLegend.disabled = true; childLegend.checked = true; store.blockLegend = true; }
    if (childResize) { childResize.disabled = true; childResize.checked = true; store.blockChartResize = true; }
    if (childMouseEvent) {
      childMouseEvent.disabled = true;
      childMouseEvent.checked = true;
      toggleChartMouseEventBlock(true);
    }

    if (containerChart) containerChart.style.opacity = "0.4";
    if (containerOb) containerOb.style.opacity = "0.4";
    if (containerLegend) containerLegend.style.opacity = "0.4";
    if (containerResize) containerResize.style.opacity = "0.4";
    if (containerMouseEvent) containerMouseEvent.style.opacity = "0.4";
  } else {
    if (childChart) { childChart.disabled = false; childChart.checked = false; store.blockChartDom = false; }
    if (childOb) { childOb.disabled = false; childOb.checked = false; store.blockOrderbook = false; if (typeof window.startOrderbookStream === "function") window.startOrderbookStream(store.currentAsset, store.currentChartMarket); }
    if (childLegend) { childLegend.disabled = false; childLegend.checked = false; store.blockLegend = false; }
    if (childResize) { childResize.disabled = false; childResize.checked = false; store.blockChartResize = false; }
    if (childMouseEvent) {
      childMouseEvent.disabled = false;
      childMouseEvent.checked = false;
      toggleChartMouseEventBlock(false);
    }

    if (containerChart) containerChart.style.opacity = "1.0";
    if (containerOb) containerOb.style.opacity = "1.0";
    if (containerLegend) containerLegend.style.opacity = "1.0";
    if (containerResize) containerResize.style.opacity = "1.0";
    if (containerMouseEvent) containerMouseEvent.style.opacity = "1.0";
  }
}

export function toggleChartMouseEventBlock(checked) {
  store.blockChartMouseEvent = checked;
  // Xconsole.log(`⚡ [DEBUG] 차트 마우스 이벤트 차단 모드: ${checked ? "ON" : "OFF"}`);
  if (checked) {
    if (store._mainCrosshair) store._mainCrosshair.setX(null);
    if (store._volCrosshair) store._volCrosshair.setX(null);
    try {
      if (store.chart) store.chart.clearCrosshairPosition();
      if (store.chartVol) store.chartVol.clearCrosshairPosition();
    } catch (e) { }
  }
}

function toggleLeftDomBlock(checked) {
  store.blockLeftDom = checked;
  // Xconsole.log(`⚡ [DEBUG] 좌측 테이블 DOM 차단 모드: ${checked ? "ON" : "OFF"}`);

  // 🚀 부모 차단 시 자식 체크박스들 강제 제어
  const childSort = document.getElementById("block-sort-toggle");
  const childTabScroll = document.getElementById("block-tabscroll-toggle");
  const childTableUpdate = document.getElementById("block-table-update-toggle");

  const containerSort = document.getElementById("child-sort-container");
  const containerTabScroll = document.getElementById("child-tabscroll-container");
  const containerTableUpdate = document.getElementById("child-table-update-container");

  if (checked) {
    if (childSort) { childSort.disabled = true; childSort.checked = true; store.blockSort = true; }
    if (childTabScroll) { childTabScroll.disabled = true; childTabScroll.checked = true; store.blockTableTabScroll = true; }
    if (childTableUpdate) {
      childTableUpdate.disabled = true;
      childTableUpdate.checked = true;
      toggleTableUpdateBlock(true);
    }

    if (containerSort) containerSort.style.opacity = "0.4";
    if (containerTabScroll) containerTabScroll.style.opacity = "0.4";
    if (containerTableUpdate) containerTableUpdate.style.opacity = "0.4";
  } else {
    if (childSort) { childSort.disabled = false; childSort.checked = false; store.blockSort = false; }
    if (childTabScroll) { childTabScroll.disabled = false; childTabScroll.checked = false; store.blockTableTabScroll = false; }
    if (childTableUpdate) {
      childTableUpdate.disabled = false;
      childTableUpdate.checked = false;
      toggleTableUpdateBlock(false);
    }

    if (containerSort) containerSort.style.opacity = "1.0";
    if (containerTabScroll) containerTabScroll.style.opacity = "1.0";
    if (containerTableUpdate) containerTableUpdate.style.opacity = "1.0";
  }
}

export function toggleTableUpdateBlock(checked) {
  store.blockTableUpdate = checked;
  // Xconsole.log(`⚡ [DEBUG] 좌측 테이블 실시간 셀/시세 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleChartDomBlock(checked) {
  store.blockChartDom = checked;
  // Xconsole.log(`⚡ [DEBUG] 차트 실시간 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleOrderbookBlock(checked) {
  store.blockOrderbook = checked;
  // Xconsole.log(`⚡ [DEBUG] 호가창 실시간 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
  if (checked && typeof window.stopOrderbookStream === "function") {
    window.stopOrderbookStream();
  } else if (!checked && typeof window.startOrderbookStream === "function") {
    window.startOrderbookStream(store.currentAsset, store.currentChartMarket);
  }
}

function toggleSortBlock(checked) {
  store.blockSort = checked;
  // Xconsole.log(`⚡ [DEBUG] 테이블 실시간 정렬 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleKimchiBlock(checked) {
  // Xstore.blockKimchi = checked;
  console.log(`⚡ [DEBUG] 김프 실시간 연산 차단 모드: ${checked ? "ON" : "OFF"}`);

  const childRadar = document.getElementById("block-radardatabatch-toggle");
  const containerRadar = document.getElementById("child-radardatabatch-container");
  const childDynamicHtml = document.getElementById("block-dynamic-html-toggle");
  const containerDynamicHtml = document.getElementById("child-dynamichtml-container");

  if (checked) {
    if (childRadar) { childRadar.disabled = true; childRadar.checked = true; store.blockRadarBatch = true; }
    if (containerRadar) containerRadar.style.opacity = "0.4";
    if (childDynamicHtml) { childDynamicHtml.disabled = true; childDynamicHtml.checked = true; store.blockRowDynamicHTML = true; }
    if (containerDynamicHtml) containerDynamicHtml.style.opacity = "0.4";
  } else {
    if (childRadar) { childRadar.disabled = false; childRadar.checked = false; store.blockRadarBatch = false; }
    if (containerRadar) containerRadar.style.opacity = "1.0";
    if (childDynamicHtml) { childDynamicHtml.disabled = false; childDynamicHtml.checked = false; store.blockRowDynamicHTML = false; }
    if (containerDynamicHtml) containerDynamicHtml.style.opacity = "1.0";
  }
}

function toggleLegendBlock(checked) {
  store.blockLegend = checked;
  // Xconsole.log(`⚡ [DEBUG] OHLC 레전드 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleResizeBlock(checked) {
  store.blockChartResize = checked;
  // Xconsole.log(`⚡ [DEBUG] 차트 리사이즈 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleTabScrollBlock(checked) {
  store.blockTableTabScroll = checked;
  // Xconsole.log(`⚡ [DEBUG] 테이블 스크롤/탭 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleRadarBatchBlock(checked) {
  store.blockRadarBatch = checked;
  // Xconsole.log(`⚡ [DEBUG] 레이더 배치 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function toggleDynamicHtmlBlock(checked) {
  store.blockRowDynamicHTML = checked;
  // Xconsole.log(`⚡ [DEBUG] 김프 전파 동적 HTML 갱신 차단 모드: ${checked ? "ON" : "OFF"}`);
}

function setAggTradeInterval(ms) {
  store.aggTradeInterval = ms;
  // Xconsole.log(`⚡ [DEBUG] aggTrade 주기 변경: ${ms === 0 ? "Raw" : ms + "ms"}`);

  const intervals = [0, 100, 500, 1500];
  intervals.forEach((val) => {
    const btnId = val === 0 ? "aggtrade-interval-raw" : `aggtrade-interval-${val}`;
    const btn = document.getElementById(btnId);
    if (btn) {
      if (val === ms) {
        btn.className = "py-1 px-1.5 rounded bg-theme-accent text-white font-bold cursor-pointer text-center transition-all";
      } else {
        btn.className = "py-1 px-1.5 rounded bg-theme-border/40 text-theme-text/80 hover:bg-theme-border/60 cursor-pointer text-center transition-all";
      }
    }
  });
}

// 🚀 전역 스코프 노출 (HTML 인라인 onclick 이벤트용)
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.setAggTradeInterval = setAggTradeInterval;
window.switchMobileView = switchMobileView;
window.showMobileChart = showMobileChart;
window.closeMobileChart = closeMobileChart;
window.switchChartTab = switchChartTab;
window.executeTabSwitch = executeTabSwitch;
window.togglePanelSwap = togglePanelSwap;
window.showOnboardingModal = showOnboardingModal;
window.closeOnboardingModal = closeOnboardingModal;
window.toggleRightDomBlock = toggleRightDomBlock;
window.toggleLeftDomBlock = toggleLeftDomBlock;
window.toggleChartDomBlock = toggleChartDomBlock;
window.toggleOrderbookBlock = toggleOrderbookBlock;
window.toggleSortBlock = toggleSortBlock;
window.toggleKimchiBlock = toggleKimchiBlock;
window.toggleLegendBlock = toggleLegendBlock;
window.toggleResizeBlock = toggleResizeBlock;
window.toggleTabScrollBlock = toggleTabScrollBlock;
window.toggleRadarBatchBlock = toggleRadarBatchBlock;
window.toggleDynamicHtmlBlock = toggleDynamicHtmlBlock;
window.toggleChartMouseEventBlock = toggleChartMouseEventBlock;
window.toggleTableUpdateBlock = toggleTableUpdateBlock;

window.copyPerformanceStats = function () {
  if (!store.bypassCounters) return;
  const elapsedText = document.getElementById("perf-run-time-display")?.innerText || "(알수없음 경과)";
  const total = Object.values(store.bypassCounters).reduce((a, b) => a + b, 0);
  const riskText = document.getElementById("perf-top-risk-analysis")?.innerText || "NONE";

  const textToCopy = `⚡ Sellnance 렉 디버거 성능 리포트
경과 시간: ${elapsedText}
총 Bypass 건수: ${total}

[상세 지표 목록]
- LeftDom (좌측 테이블 차단): ${store.bypassCounters.leftDom || 0}
- TabScroll (테이블 전체 리플로우): ${store.bypassCounters.tabScroll || 0}
- TableUp (개별 셀 갱신 과부하): ${store.bypassCounters.tableUpdate || 0}
- Kimchi (3초 김프 연산 전파): ${store.bypassCounters.kimchi || 0}
- Radar (3초 레이더 일괄 갱신): ${store.bypassCounters.radarBatch || 0}
- M-Event (차트 마우스 십자선 지연): ${store.bypassCounters.mouseEvent || 0}
- DynHtml (김프 전파 HTML 동적 렌더): ${store.bypassCounters.dynamicHtml || 0}
- T-Bypass (100ms 쓰로틀 차단): ${store.bypassCounters.throttleBypass || 0}
- T-Pass (100ms 가드 통과 처리): ${store.bypassCounters.throttlePass || 0}

🚨 최대 렉 위협 요소: ${riskText}
  `;

  navigator.clipboard.writeText(textToCopy.trim())
    .then(() => {
      const btn = document.getElementById("copy-perf-stats-btn");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✓ 복사됨!";
        btn.style.color = "#0ecb81";
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.color = "";
        }, 1200);
      }
    })
    .catch(err => console.error("성능 로그 클립보드 복사 실패:", err));
};

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

let searchTimeout = null;

// 🚀 검색 리스트 (목록 즉각 필터링 로직으로 변경됨 - 100ms 디바운스 도입으로 키보드 렉 제거)
export function searchSymbols(v) {
  const resDiv = document.getElementById("search-results");
  if (resDiv) {
    resDiv.style.display = "none";
  }

  store.searchQuery = v || "";

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const loadingBar = document.getElementById("search-loading-bar");

  // 🚀 타이핑 감지 시 즉각 로딩바 전진 (300ms 디바운스 기간 동안 100% 충전)
  if (v && loadingBar) {
    loadingBar.style.transition = "none";
    loadingBar.style.width = "0%";
    void loadingBar.offsetWidth; // 강제 리플로우로 브라우저 애니메이션 프레임 동기화
    loadingBar.style.transition = "width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
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
  // 🚀 [UX 복원] 마지막 타임프레임 로컈 저장
  try { localStorage.setItem("sellnance_last_tf", tf); } catch(e) {}
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
    store.chartVol
      .priceScale("right")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
    store.chartVol
      .priceScale("left")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
  }

  if (overlayLBtn) {
    if (store.isLogMode) {
      overlayLBtn.className =
        "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      overlayLBtn.className =
        "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
    }
  }

  if (overlayVolLBtn) {
    if (store.isLogMode) {
      overlayVolLBtn.className =
        "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-accent text-white shadow-sm border border-theme-accent";
    } else {
      overlayVolLBtn.className =
        "w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded cursor-pointer transition-colors bg-theme-border/20 text-theme-text hover:bg-theme-border/40 border border-theme-border/30";
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
          const buttons = Array.from(
            container.querySelectorAll(".chart-tabs-btn"),
          );
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
        const buttons = Array.from(
          container.querySelectorAll(".chart-tabs-btn"),
        );
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
            // 전체화면 진입: 원래 위치 및 부모 백업
            container._origParent = container.parentElement;
            container._origNext = container.nextSibling;

            if (headCtrl) {
              headCtrl._origParent = headCtrl.parentElement;
              headCtrl._origNext = headCtrl.nextSibling;
            }

            fullscreenBtn._origParent = fullscreenBtn.parentElement;
            fullscreenBtn._origNext = fullscreenBtn.nextSibling;

            // 전체화면 진입: tf-container를 차트 내부 최상단으로 이동
            container.classList.add("fullscreen-tf-style");
            wrapper.insertBefore(container, wrapper.firstChild);

            // 🚀 head-control-buttons를 tf-container 안에 함께 배치
            if (headCtrl) {
              headCtrl.style.marginLeft = "auto";
              container.appendChild(headCtrl);
            }

            // 🚀 전체화면 버튼도 tf-container 안으로 이동
            container.appendChild(fullscreenBtn);

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
            if (headCtrl && headCtrl._origParent) {
              headCtrl._origParent.insertBefore(headCtrl, headCtrl._origNext);
              headCtrl.style.marginLeft = "";
            }

            // 🚀 tf-container를 원래 위치로 복원
            if (container._origParent) {
              container._origParent.insertBefore(container, container._origNext);
            }

            // 🚀 전체화면 버튼을 원래 위치로 복원
            if (fullscreenBtn._origParent) {
              fullscreenBtn._origParent.insertBefore(fullscreenBtn, fullscreenBtn._origNext);
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
      const dropdown = container.parentElement.querySelector(
        "#tf-settings-dropdown",
      );
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
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  if (!leftPanel || !rightPanel) return;

  // 🚀 1200px 미만인 경우 (모바일/태블릿)
  if (window.innerWidth < 1200) {
    const overlay = document.getElementById("mobile-chart-overlay");
    const isOverlayOpen = overlay && overlay.style.opacity === "1";
    if (!isOverlayOpen) {
      rightPanel.style.display = "none";
    }
    return;
  }

  // 모바일 오버레이가 열려있을 때도 간섭 금지
  const overlay = document.getElementById("mobile-chart-overlay");
  if (overlay && overlay.style.opacity === "1") return;

  // 1200px 이상 데스크톱일 경우, 'none'이었던 inline display 초기화
  if (rightPanel.style.display === "none") {
    rightPanel.style.display = "";
  }

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

export function adjustNoticeFontSizes() {
  const isMobile = window.innerWidth < 1200;
  const slider = document.getElementById("notice-slider");
  if (!slider) return;

  const items = slider.querySelectorAll("div");
  items.forEach((div) => {
    if (!isMobile) {
      div.style.fontSize = "";
      return;
    }

    const text = div.innerText || "";
    const len = text.length;

    // 수학적 로그 방식 적용: 문장이 길어질수록 폰트 크기를 부드럽고 자연스럽게 한계점까지 축소
    const threshold = 30; // 기준 글자수
    const baseRem = 0.72; // 기본 rem 크기
    const minRem = 0.45;  // 최소 rem 크기
    const logMult = 0.45; // 로그 배율

    let sizeRem = baseRem;
    if (len > threshold) {
      sizeRem = Math.max(
        minRem,
        baseRem - Math.log10(len / threshold) * logMult
      );
    }

    // 뷰포트 크기 변화에 대한 미세 스케일 보정 추가 (1200px 기준 비율)
    const scaleFactor = Math.min(1, window.innerWidth / 1200);
    const finalRem = sizeRem * scaleFactor;

    div.style.setProperty("font-size", `${finalRem.toFixed(3)}rem`, "important");
  });
}

window.adjustNoticeFontSizes = adjustNoticeFontSizes;

// 🚀 창 크기 변경 시 렉 방지: 150ms 디바운스 적용
let _overlapDebounceTimer = null;
window.addEventListener("resize", () => {
  if (_overlapDebounceTimer) clearTimeout(_overlapDebounceTimer);
  _overlapDebounceTimer = setTimeout(() => {
    checkLayoutOverlap();
    adjustNoticeFontSizes();
  }, 150);
});
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    checkLayoutOverlap();
    adjustNoticeFontSizes();
  }, 200);

  // 🚀 모바일 환경: 가격 축 터치 시 A/L 버튼 표시, 차트 터치 시 숨김 (트뷰 앱 방식)
  const paneMain = document.getElementById("pane-main");
  if (paneMain) {
    const scaleContainer = paneMain.querySelector(".scale-mode-container");
    if (scaleContainer) {
      paneMain.addEventListener(
        "touchstart",
        (e) => {
          if (!e.touches || e.touches.length === 0) return;
          const rect = paneMain.getBoundingClientRect();
          const touchX = e.touches[0].clientX - rect.left;
          // 우측 가격 축 영역(약 70px)을 터치하면 버튼 표시, 아니면 숨김
          if (rect.width - touchX <= 75) {
            scaleContainer.classList.add("mobile-show-scale-btn");
          } else {
            scaleContainer.classList.remove("mobile-show-scale-btn");
          }
        },
        { passive: true },
      );
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
  // { label: "2시간", value: "2h" },
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
  return timeframes.map((t) => t.value);
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

  timeframes
    .slice()
    .reverse()
    .forEach((tf) => {
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
        pendingTfSettings = pendingTfSettings.filter((v) => v !== tf.value);
      }
      if (pendingTfSettings.length === 0) pendingTfSettings = [tf.value];

      renderTfCheckboxList(); // 모달 UI만 갱신
    });

    container.appendChild(btn);
  });

  // 🚀 마지막 4x4 위치 (col-start-4)에 작게 확인 버튼 배치
  const confirmBtn = document.createElement("button");
  confirmBtn.className =
    "col-start-4 px-2 py-1.5 text-[11px] font-bold border border-theme-accent text-theme-accent hover:bg-theme-accent hover:text-white rounded transition-all shadow-sm flex items-center justify-center";
  confirmBtn.innerText = "확인";
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
      const match = timeframes.find((t) => t.label === activeBtn.innerText);
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
  if (
    !btn &&
    dropdown &&
    !dropdown.contains(e.target) &&
    !dropdown.classList.contains("hidden")
  ) {
    toggleTfSettings();
  }
});

function syncCheckboxesFromStore() {
  const check = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  check("block-right-dom-toggle", store.blockRightDom);
  check("block-chart-dom-toggle", store.blockChartDom);
  check("block-orderbook-toggle", store.blockOrderbook);
  check("block-legend-toggle", store.blockLegend);
  check("block-resize-toggle", store.blockChartResize);
  check("block-mouse-event-toggle", store.blockChartMouseEvent);
  check("block-left-dom-toggle", store.blockLeftDom);
  check("block-sort-toggle", store.blockSort);
  check("block-table-update-toggle", store.blockTableUpdate);
  check("block-kimchi-toggle", store.blockKimchi);
  check("block-tabscroll-toggle", store.blockTableTabScroll);
  check("block-radardatabatch-toggle", store.blockRadarBatch);
  check("block-dynamic-html-toggle", store.blockRowDynamicHTML);

  // 🚀 부모 차단 상태에 맞춰 자식 비활성화(disabled) 및 시각 피드백(opacity) 강제 싱크
  toggleRightDomBlock(!!store.blockRightDom);
  toggleLeftDomBlock(!!store.blockLeftDom);
  toggleKimchiBlock(!!store.blockKimchi);
}

document.addEventListener("DOMContentLoaded", () => {
  renderTimeframeButtons("1d");
  const isOhlcHidden = localStorage.getItem("sellnance_ohlc_hidden") === "true";
  if (isOhlcHidden) {
    document.getElementById("ohlc-legend")?.classList.add("hidden");
  }
  syncCheckboxesFromStore();
});
