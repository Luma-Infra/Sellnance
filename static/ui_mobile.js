// ui_mobile.js
// 📱 [모바일 뷰 & 탭 & 바텀시트 오버레이 제어 모듈]
import { store, CONFIG } from "./_store.js";

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
    const defaultSym =
      (typeof window.getInitialRouteSymbol === "function" ? window.getInitialRouteSymbol() : null) ||
      localStorage.getItem("sellnance_last_symbol") ||
      "BINANCE:BTC_FUTURES";
    if (typeof window.selectSymbol === "function") {
      window.selectSymbol(defaultSym);
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

export function updateMobileNavUI(tab = store._currentMobileTab || "list") {
  const slider = document.getElementById("mobile-nav-slider");
  const sliderInner = document.getElementById("mobile-nav-slider-inner");
  if (!slider) return;

  const isChart = tab === "chart";
  slider.style.transform = isChart ? "translateX(108px)" : "translateX(0px)";
  if (sliderInner) {
    sliderInner.style.transform = isChart ? "translateX(-108px)" : "translateX(0px)";
  }
}

export function switchMobileTab(tab) {
  if (window.innerWidth >= CONFIG.SCREEN_WIDTH || !isTouchDevice()) return;

  try {
    sessionStorage.setItem("sellnance_active_mobile_tab", tab);
  } catch (e) { }

  const leftPanel = document.getElementById("left-panel");
  const settingsModal = document.getElementById("settings-modal");

  store._currentMobileTab = tab;
  updateMobileNavUI(tab);

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

    const targetSym =
      store.currentSelectedSymbol ||
      store.currentAsset ||
      (typeof window.getInitialRouteSymbol === "function" ? window.getInitialRouteSymbol() : null) ||
      localStorage.getItem("sellnance_last_symbol") ||
      "BINANCE:BTC_FUTURES";

    if (!store.currentSelectedSymbol && !store.currentAsset) {
      if (typeof window.selectSymbol === "function") {
        window.selectSymbol(targetSym);
      }
    }

    if (typeof window.showMobileChart === "function") {
      window.showMobileChart();
    }
  } else if (tab === "settings") {
    closeMobileChart();
    if (typeof window.openSettingsModal === "function") {
      window.openSettingsModal();
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

// [모바일 전용] 새로고침 시 잔류 줌/확대 배율을 100%(1.0)로 안전하게 리셋
export function resetMobileViewportScale() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // PC(>=1200px)는 100% 제외
  if (window.innerWidth >= 1200 && !isTouchDevice()) return;

  try {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    const normalContent = "width=device-width, initial-scale=1.0";
    const resetContent = "width=device-width, initial-scale=1.0, maximum-scale=1.0";

    meta.setAttribute("content", resetContent);
    window.scrollTo(0, 0);

    setTimeout(() => {
      try {
        meta.setAttribute("content", normalContent);
      } catch (e) { }
    }, 100);
  } catch (e) { }
}

// 자동 초기화
if (typeof document !== "undefined") {
  const initAllMobileUX = () => {
    resetMobileViewportScale();
    syncTouchDeviceClass();
    initMobileRubberBandScroll();
    initMobileScrollMaskIndicators();
    updateMobileNavUI(store._currentMobileTab || "list");
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllMobileUX);
  } else {
    initAllMobileUX();
  }
  window.addEventListener("mobile-tab-changed", (e) => {
    updateMobileNavUI(e.detail);
  });
  window.addEventListener("resize", () => {
    syncTouchDeviceClass();
    ["exchange-badges", "tf-container"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) updateElementScrollMask(el);
    });
  });
}

// 전역 노출
window.isTouchDevice = isTouchDevice;
window.syncTouchDeviceClass = syncTouchDeviceClass;
window.switchMobileView = switchMobileView;
window.showMobileChart = showMobileChart;
window.closeMobileChart = closeMobileChart;
window.switchMobileTab = switchMobileTab;
window.updateMobileNavUI = updateMobileNavUI;
window.initMobileRubberBandScroll = initMobileRubberBandScroll;
window.updateElementScrollMask = updateElementScrollMask;
window.initMobileScrollMaskIndicators = initMobileScrollMaskIndicators;
window.resetMobileViewportScale = resetMobileViewportScale;

