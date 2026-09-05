// ui_mobile.js
// 📱 [모바일 뷰 & 탭 & 바텀시트 오버레이 제어 모듈]
import { store, CONFIG } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import { showConfirm } from "./ui_dialog.js";

let _closeMobileChartTimer = null;

// 📱 [터치 스크린 / 모바일 기기 감지 헬퍼]
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}

export function syncTouchDeviceClass() {
  if (typeof document !== "undefined" && document.documentElement) {
    const isTouch = isTouchDevice();
    document.documentElement.classList.toggle("is-touch-device", isTouch);
  }
}

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
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH || !isTouchDevice()) return;

  try {
    sessionStorage.setItem("sellnance_active_mobile_tab", "chart");
  } catch (e) { }

  store._currentMobileTab = "chart";
  window.dispatchEvent(
    new CustomEvent("mobile-tab-changed", { detail: "chart" }),
  );

  if (_closeMobileChartTimer) {
    clearTimeout(_closeMobileChartTimer);
    _closeMobileChartTimer = null;
  }

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const content = document.getElementById("mobile-chart-content");
  const rightPanel = document.getElementById("right-panel");
  const leftPanel = document.getElementById("left-panel");

  if (!overlay || !panel || !content || !rightPanel) return;

  if (!store.currentSelectedSymbol && !store.currentAsset) {
    if (typeof window.selectSymbol === "function") {
      window.selectSymbol("BINANCE:BTC_FUTURES");
      return;
    }
  }

  if (!content.contains(rightPanel)) {
    content.appendChild(rightPanel);
  }

  rightPanel.style.cssText =
    "display:flex;flex-direction:column;height:100%;width:100%;min-width:0;overflow:hidden;";
  rightPanel.classList.remove("hidden");

  overlay.style.cssText =
    "display:flex;opacity:1;pointer-events:auto;top:44px;bottom:0px;";
  overlay.classList.remove("hidden");

  panel.style.transform = "";
  panel.style.transition = "";
  panel.classList.remove("translate-y-full");

  if (leftPanel) {
    leftPanel.style.pointerEvents = "none";
  }

  requestAnimationFrame(() => {
    panel.classList.add("translate-y-0");
    if (typeof window.applyChartLayout === "function") {
      window.applyChartLayout();
    }
    if (typeof window.syncPriceScaleWidths === "function") {
      window.syncPriceScaleWidths(true);
    }
    if (typeof window.autoFit === "function") {
      window.autoFit(true);
    }
    if (typeof window.scrollActiveTfIntoView === "function") {
      window.scrollActiveTfIntoView(false);
    }
  });

  setTimeout(() => {
    if (typeof window.applyChartLayout === "function") {
      window.applyChartLayout();
    }
    if (typeof window.syncPriceScaleWidths === "function") {
      window.syncPriceScaleWidths(true);
    }
    // 🚀 [PC와 100% 동일한 우측 10봉 여백 & 상하 차트 동기화] fitContent 0여백 버그 제거하고 autoFit 연동
    if (typeof window.autoFit === "function") {
      window.autoFit(true);
    }
    if (typeof window.scrollActiveTfIntoView === "function") {
      window.scrollActiveTfIntoView(false);
    }
  }, 320);
}

export function closeMobileChart() {
  try {
    sessionStorage.setItem("sellnance_active_mobile_tab", "list");
  } catch (e) { }

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const rightPanel = document.getElementById("right-panel");
  const mainContainer = document.getElementById("panel-split-container");
  const leftPanel = document.getElementById("left-panel");

  if (!overlay || !panel || !rightPanel || !mainContainer) return;

  if (leftPanel) {
    leftPanel.style.pointerEvents = "";
  }

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
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH || !isTouchDevice()) return;

  try {
    sessionStorage.setItem("sellnance_active_mobile_tab", tab);
  } catch (e) { }

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
      // 🚀 [모바일 전용] 선택된 코인이 없을 때 테이블 최상단(변동률 1위 등 개잡코) 대신 항상 비트코인(BTC)을 기본 로드
      if (typeof window.selectSymbol === "function") {
        window.selectSymbol("BINANCE:BTC_FUTURES");
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
    showConfirm({
      title: "시뮬레이션 종료 🚨",
      html: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아가요<br/>진짜로 넘어갈까요?",
      icon: "warning",
      confirmText: "네, 넘어갈게요",
      cancelText: "아니요, 계속할게요",
      confirmColor: "var(--down)",
      cancelColor: "transparent",
      showCancelButton: true,
    }).then((confirmed) => {
      if (confirmed) {
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

// 📱 모바일/패드 전용 탄성 고무줄(Rubber-Band Elastic Overscroll) 풀업 UX
export function initMobileRubberBandScroll() {
  const listBody = document.getElementById("coin-list-body");
  if (!listBody || listBody._rubberBandInitialized) return;
  listBody._rubberBandInitialized = true;

  const fadeOverlay = document.getElementById("coin-list-bottom-fade");
  let startY = 0;
  let isPullingBottom = false;
  let isPullingTop = false;
  let pullStartOffset = 0;

  listBody.addEventListener(
    "touchstart",
    (e) => {
      if (window.innerWidth >= CONFIG.SCREEN_WIDTH || e.touches.length !== 1)
        return;
      startY = e.touches[0].clientY;
      isPullingBottom = false;
      isPullingTop = false;
      pullStartOffset = 0;
      listBody.style.transition = "";
      if (fadeOverlay) fadeOverlay.style.transition = "";
    },
    { passive: true },
  );

  listBody.addEventListener(
    "touchmove",
    (e) => {
      if (window.innerWidth >= CONFIG.SCREEN_WIDTH || e.touches.length !== 1)
        return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const maxScroll = listBody.scrollHeight - listBody.clientHeight;

      // 1. 하단 도달 후 위로 더 당길 때 (Elastic Pull-Up)
      if (deltaY < 0 && listBody.scrollTop >= maxScroll - 2) {
        if (!isPullingBottom) {
          isPullingBottom = true;
          pullStartOffset = currentY;
        }
        const overscroll = Math.abs(currentY - pullStartOffset);
        // iOS 물리 기반 탄성 감쇠 곡선
        const tension = (overscroll * 130) / (overscroll + 110);
        listBody.style.transform = `translate3d(0, -${tension.toFixed(2)}px, 0)`;

        if (fadeOverlay) {
          fadeOverlay.style.opacity = Math.max(0.2, 1 - tension / 60).toFixed(2);
        }

        if (e.cancelable && overscroll > 5) {
          e.preventDefault();
        }
      }
      // 2. 상단 도달 후 아래로 더 당길 때 (Elastic Pull-Down)
      else if (deltaY > 0 && listBody.scrollTop <= 2) {
        if (!isPullingTop) {
          isPullingTop = true;
          pullStartOffset = currentY;
        }
        const overscroll = currentY - pullStartOffset;
        const tension = (overscroll * 70) / (overscroll + 100);
        listBody.style.transform = `translate3d(0, ${tension.toFixed(2)}px, 0)`;

        if (e.cancelable && overscroll > 5) {
          e.preventDefault();
        }
      } else {
        if (isPullingBottom || isPullingTop) {
          listBody.style.transform = "";
          if (fadeOverlay) fadeOverlay.style.opacity = "";
          isPullingBottom = false;
          isPullingTop = false;
        }
      }
    },
    { passive: false },
  );

  const resetElastic = () => {
    if (!isPullingBottom && !isPullingTop) return;
    isPullingBottom = false;
    isPullingTop = false;

    // 쫀득한 고무줄 텐션 스프링 복귀
    listBody.style.transition =
      "transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.22)";
    listBody.style.transform = "translate3d(0, 0, 0)";

    if (fadeOverlay) {
      fadeOverlay.style.transition = "opacity 0.35s ease";
      fadeOverlay.style.opacity = "";
    }

    setTimeout(() => {
      listBody.style.transition = "";
      listBody.style.transform = "";
      if (fadeOverlay) fadeOverlay.style.transition = "";
    }, 450);
  };

  listBody.addEventListener("touchend", resetElastic, { passive: true });
  listBody.addEventListener("touchcancel", resetElastic, { passive: true });
}

// 🚀 [모바일 전용] 가로 스크롤 끝단 블러/페이드 마스크 UX 인디케이터
export function updateElementScrollMask(el) {
  if (!el || window.innerWidth >= CONFIG.SCREEN_WIDTH) {
    if (el) el.classList.remove("scroll-mask-left", "scroll-mask-right", "scroll-mask-both");
    return;
  }
  const maxScroll = el.scrollWidth - el.clientWidth;
  if (maxScroll <= 3) {
    el.classList.remove("scroll-mask-left", "scroll-mask-right", "scroll-mask-both");
    return;
  }
  const canLeft = el.scrollLeft > 3;
  const canRight = el.scrollLeft < maxScroll - 3;

  if (canLeft && canRight) {
    el.classList.add("scroll-mask-both");
    el.classList.remove("scroll-mask-left", "scroll-mask-right");
  } else if (canLeft) {
    el.classList.add("scroll-mask-left");
    el.classList.remove("scroll-mask-right", "scroll-mask-both");
  } else if (canRight) {
    el.classList.add("scroll-mask-right");
    el.classList.remove("scroll-mask-left", "scroll-mask-both");
  } else {
    el.classList.remove("scroll-mask-left", "scroll-mask-right", "scroll-mask-both");
  }
}

export function initMobileScrollMaskIndicators() {
  const ids = ["exchange-badges", "tf-container"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el._scrollMaskInitialized) return;
    el._scrollMaskInitialized = true;

    el.addEventListener(
      "scroll",
      () => {
        updateElementScrollMask(el);
      },
      { passive: true },
    );

    // 내용물 동적 변화 및 리사이즈 감지
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => updateElementScrollMask(el)).observe(el);
    }
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(() => updateElementScrollMask(el)).observe(el, {
        childList: true,
        subtree: true,
      });
    }

    updateElementScrollMask(el);
  });
}

// 자동 초기화
if (typeof document !== "undefined") {
  const initAllMobileUX = () => {
    syncTouchDeviceClass();
    initMobileRubberBandScroll();
    initMobileScrollMaskIndicators();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllMobileUX);
  } else {
    initAllMobileUX();
  }
  window.addEventListener("resize", () => {
    syncTouchDeviceClass();
    ["exchange-badges", "tf-container"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) updateElementScrollMask(el);
    });
  });
}

// 🚀 전역 노출
window.isTouchDevice = isTouchDevice;
window.syncTouchDeviceClass = syncTouchDeviceClass;
window.switchMobileView = switchMobileView;
window.showMobileChart = showMobileChart;
window.closeMobileChart = closeMobileChart;
window.switchMobileTab = switchMobileTab;
window.switchChartTab = switchChartTab;
window.executeTabSwitch = executeTabSwitch;
window.initMobileRubberBandScroll = initMobileRubberBandScroll;
window.updateElementScrollMask = updateElementScrollMask;
window.initMobileScrollMaskIndicators = initMobileScrollMaskIndicators;

