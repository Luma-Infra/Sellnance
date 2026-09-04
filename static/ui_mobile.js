// ui_mobile.js
// 📱 [모바일 뷰 & 탭 & 바텀시트 오버레이 제어 모듈]
import { store, CONFIG } from "./_store.js";
import { fetchHistory } from "./chart_data.js";

let _closeMobileChartTimer = null;

// 모바일: 리스트/차트 화면 전환
export function switchMobileView(view) {
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

export function showMobileChart() {
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH) return;

  if (_closeMobileChartTimer) {
    clearTimeout(_closeMobileChartTimer);
    _closeMobileChartTimer = null;
  }

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const content = document.getElementById("mobile-chart-content");
  const rightPanel = document.getElementById("right-panel");

  if (!overlay || !panel || !content || !rightPanel) return;

  rightPanel.style.cssText =
    "display:flex;flex-direction:column;height:100%;width:100%;min-width:0;overflow:hidden;";
  rightPanel.classList.remove("hidden");

  if (!content.contains(rightPanel)) {
    content.appendChild(rightPanel);
  }

  overlay.style.cssText =
    "display:flex;align-items:flex-end;justify-content:flex-end;opacity:1;pointer-events:auto;bottom:calc(56px + env(safe-area-inset-bottom, 0px));";
  overlay.classList.remove("hidden");

  panel.style.transform = "";
  panel.style.transition = "";
  panel.classList.remove("translate-y-full");

  requestAnimationFrame(() => {
    panel.classList.add("translate-y-0");
  });

  setTimeout(() => {
    if (typeof window.applyChartLayout === "function") {
      window.applyChartLayout();
    }
    if (store.chart) {
      store.chart.timeScale().fitContent();
    }
  }, 380);
}

export function closeMobileChart() {
  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const rightPanel = document.getElementById("right-panel");
  const mainContainer = document.getElementById("panel-split-container");

  if (!overlay || !panel || !rightPanel || !mainContainer) return;

  panel.classList.remove("translate-y-0");
  panel.classList.add("translate-y-full");

  _closeMobileChartTimer = setTimeout(() => {
    _closeMobileChartTimer = null;
    overlay.style.cssText = "";
    overlay.classList.add("hidden");

    rightPanel.style.cssText = "";
    rightPanel.classList.remove("flex");
    rightPanel.classList.add("hidden", "min-[1200px]:flex");

    if (!mainContainer.contains(rightPanel)) {
      mainContainer.appendChild(rightPanel);
    }
  }, 320);
}

export function switchMobileTab(tab) {
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH) return;

  const leftPanel = document.getElementById("left-panel");
  const settingsModal = document.getElementById("settings-modal");

  window.dispatchEvent(
    new CustomEvent("mobile-tab-changed", { detail: tab }),
  );

  if (tab === "list") {
    closeMobileChart();
    if (settingsModal) settingsModal.style.display = "none";
    if (leftPanel) leftPanel.style.display = "";
  } else if (tab === "chart") {
    if (settingsModal) settingsModal.style.display = "none";

    const simControls = document.getElementById("sim-controls");
    if (simControls) simControls.style.display = "none";
    const qvContainer = document.getElementById("quickview-container");
    if (qvContainer) {
      qvContainer.classList.add("hidden");
      qvContainer.style.display = "none";
    }
    if (typeof window.destroyQuickView === "function") {
      window.destroyQuickView();
    }

    if (store.currentSelectedSymbol) {
      if (typeof window.showMobileChart === "function") {
        window.showMobileChart();
      }
    } else {
      const firstRow = document.querySelector("#coin-list-body .coin-row");
      if (firstRow && typeof window.selectSymbol === "function") {
        window.selectSymbol(firstRow.dataset.sym);
      }
    }
  } else if (tab === "settings") {
    closeMobileChart();
    if (typeof window.openSettingsModal === "function") {
      window.openSettingsModal();
    }
  }

  store._currentMobileTab = tab;
}

export function switchChartTab(mode) {
  const btnSim = document.getElementById("tab-btn-sim");
  if (mode === "chart" && btnSim && btnSim.classList.contains("active")) {
    window.Swal.fire({
      title: "시뮬레이션 종료 🚨",
      html: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아가요<br/>진짜로 넘어갈까요?",
      icon: "warning",
      showCancelButton: true,
      background: "var(--panel)",
      color: "var(--text)",
      confirmButtonColor: "var(--down)",
      cancelButtonColor: "var(--border)",
      confirmButtonText: "네, 넘어갈게요",
      cancelButtonText: "아니요, 계속할게요",
    }).then((result) => {
      if (result.isConfirmed) {
        executeTabSwitch(mode);
      } else {
        // 취소 시 슬라이더 활성 바를 시뮬레이터(index 1) 위치로 확실하게 유지/복원
        if (typeof window.moveTabSlider === "function") {
          window.moveTabSlider(1);
        }
      }
    });
  } else {
    executeTabSwitch(mode);
  }
}

export function executeTabSwitch(mode) {
  const btnChart = document.getElementById("tab-btn-chart"),
    btnSim = document.getElementById("tab-btn-sim"),
    btnQuick = document.getElementById("tab-btn-quickview"),
    controls = document.getElementById("sim-controls");

  if (mode === "chart") {
    if (typeof window.moveTabSlider === "function") window.moveTabSlider(0);
    if (btnChart) btnChart.classList.add("active");
    if (btnSim) btnSim.classList.remove("active");
    if (btnQuick) btnQuick.classList.remove("active");
    if (controls) controls.style.display = "none";

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

    requestAnimationFrame(() => {
      if (typeof window.applyChartLayout === "function") {
        window.applyChartLayout();
      }
    });
  } else if (mode === "sim") {
    if (typeof window.moveTabSlider === "function") window.moveTabSlider(1);
    if (btnSim) btnSim.classList.add("active");
    if (btnChart) btnChart.classList.remove("active");
    if (btnQuick) btnQuick.classList.remove("active");
    if (controls) controls.style.display = "flex";

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

    if (typeof window.changeDir === "function") {
      window.changeDir(store.curDir || "bull");
    }

    requestAnimationFrame(() => {
      if (typeof window.applyChartLayout === "function") {
        window.applyChartLayout();
      }
    });
  } else if (mode === "quickview") {
    if (typeof window.moveTabSlider === "function") window.moveTabSlider(2);
    if (btnQuick) btnQuick.classList.add("active");
    if (btnChart) btnChart.classList.remove("active");
    if (btnSim) btnSim.classList.remove("active");
    if (controls) controls.style.display = "none";

    if (typeof window.initQuickView === "function") {
      window.initQuickView();
    }
  }
}

// 🚀 전역 노출
window.switchMobileView = switchMobileView;
window.showMobileChart = showMobileChart;
window.closeMobileChart = closeMobileChart;
window.switchMobileTab = switchMobileTab;
window.switchChartTab = switchChartTab;
window.executeTabSwitch = executeTabSwitch;
