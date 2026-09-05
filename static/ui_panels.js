// ui_panels.js
// 🖥️ [사이드바, 패널 스왑, 뷰 모드, 온보딩 모달 제어 모듈]
import { store } from "./_store.js";

// 데스크탑: 좌측 패널 접기/펴기
export function toggleSidebar() {
  const leftPanel = document.getElementById("left-panel");
  const toggleText = document.getElementById("sidebar-toggle-text");

  store.isSidebarOpen = !store.isSidebarOpen;

  if (store.isSidebarOpen) {
    leftPanel.classList.remove("md:hidden");
    leftPanel.classList.add("md:flex");
    if (toggleText) toggleText.innerText = "◀ 접기";
  } else {
    leftPanel.classList.remove("md:flex");
    leftPanel.classList.add("md:hidden");
    if (toggleText) toggleText.innerText = "▶ 펼치기";
  }

  localStorage.setItem(
    "sellnance_sidebar_collapsed",
    (!store.isSidebarOpen).toString(),
  );
}

export function switchViewMode(mode, saveToStorage = true) {
  store.tableViewMode = mode;
  const panel = document.getElementById("left-panel");
  if (!panel) return;

  if (saveToStorage) {
    try {
      localStorage.setItem("sellnance_table_view_mode", mode);
    } catch (e) { }
  }

  panel.classList.remove(
    "view-mode-simple",
    "view-mode-basic",
    "view-mode-expert",
  );
  panel.classList.add(`view-mode-${mode}`);

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

  const isSimple = mode === "simple";
  const btnSmallCap = document.getElementById("btn-small-cap");

  if (typeof window.updateFavoritesCount === "function") {
    window.updateFavoritesCount();
  }
  if (btnSmallCap)
    btnSmallCap.innerHTML = `<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg><span>Mcap &lt; 1M</span>`;

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

  if (typeof checkLayoutOverlap === "function") {
    checkLayoutOverlap();
  }
}

let _panelSwapTimer = null;
let _panelSwapLayoutTimer = null;

// 🚀 좌우 패널 위치 스왑 (FLIP 애니메이션)
export function togglePanelSwap() {
  const container = document.getElementById("panel-split-container");
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  if (!container || !leftPanel || !rightPanel) return;

  // 이전 진행 중인 애니메이션/타이머 즉시 정리
  if (_panelSwapTimer) clearTimeout(_panelSwapTimer);
  if (_panelSwapLayoutTimer) clearTimeout(_panelSwapLayoutTimer);
  leftPanel.style.transition = "none";
  rightPanel.style.transition = "none";
  leftPanel.style.transform = "";
  rightPanel.style.transform = "";

  // 1. First (변환 전 위치 측정)
  const firstLeft = leftPanel.getBoundingClientRect();
  const firstRight = rightPanel.getBoundingClientRect();

  // 2. State Toggle
  const isCurrentlySwapped =
    container.classList.contains("panel-swapped") ||
    container.classList.contains("flex-row-reverse") ||
    container.style.flexDirection === "row-reverse" ||
    localStorage.getItem("sellnance_panel_swapped") === "true";

  if (isCurrentlySwapped) {
    container.style.setProperty("flex-direction", "row", "important");
    container.classList.remove("panel-swapped", "flex-row-reverse", "md:flex-row-reverse");
    container.classList.add("flex-row");
    leftPanel.style.borderRightWidth = "";
    leftPanel.style.borderLeftWidth = "";
    localStorage.setItem("sellnance_panel_swapped", "false");
  } else {
    container.style.setProperty("flex-direction", "row-reverse", "important");
    container.classList.remove("flex-row", "md:flex-row");
    container.classList.add("panel-swapped", "flex-row-reverse");
    leftPanel.style.borderRightWidth = "0px";
    leftPanel.style.borderLeftWidth = "1px";
    localStorage.setItem("sellnance_panel_swapped", "true");
  }

  // 3. Last (변환 후 위치 측정)
  const lastLeft = leftPanel.getBoundingClientRect();
  const lastRight = rightPanel.getBoundingClientRect();

  // 4. Invert (원래 위치로 순간 이동)
  const deltaLeft = firstLeft.left - lastLeft.left;
  const deltaRight = firstRight.left - lastRight.left;

  leftPanel.style.transition = "none";
  rightPanel.style.transition = "none";
  leftPanel.style.transform = `translateX(${deltaLeft}px)`;
  rightPanel.style.transform = `translateX(${deltaRight}px)`;

  // 강제 Reflow 유도
  void leftPanel.offsetWidth;

  // 5. Play (목표 위치로 부드럽게 슬라이드 애니메이션)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      leftPanel.style.transition =
        "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
      rightPanel.style.transition =
        "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
      leftPanel.style.transform = "translateX(0)";
      rightPanel.style.transform = "translateX(0)";

      _panelSwapTimer = setTimeout(() => {
        leftPanel.style.transition = "";
        rightPanel.style.transition = "";
        leftPanel.style.transform = "";
        rightPanel.style.transform = "";
        _panelSwapTimer = null;
      }, 500);
    });
  });

  _panelSwapLayoutTimer = setTimeout(() => {
    if (typeof window.applyChartLayout === "function") {
      window.applyChartLayout();
    }
    _panelSwapLayoutTimer = null;
  }, 520);
}

export function showOnboardingModal(force = false) {
  if (!force && localStorage.getItem("sellnance_onboarding_shown") === "true") {
    return;
  }

  const modal = document.getElementById("onboarding-modal");
  const content = document.getElementById("onboarding-modal-content");
  if (!modal || !content) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  void modal.offsetWidth;

  modal.classList.remove("opacity-0");
  modal.classList.add("opacity-100");
  content.classList.remove("scale-95");
  content.classList.add("scale-100");
}

export function closeOnboardingModal() {
  const modal = document.getElementById("onboarding-modal");
  const content = document.getElementById("onboarding-modal-content");
  if (!modal || !content) return;

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

export function checkLayoutOverlap() {
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  if (!leftPanel || !rightPanel) return;

  const isTouch = typeof window.isTouchDevice === "function"
    ? window.isTouchDevice()
    : ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window) || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

  // 1. 진짜 모바일/F12 터치 기기일 때 (<1200px)
  if (isTouch && window.innerWidth < 1200) {
    const overlay = document.getElementById("mobile-chart-overlay");
    const isOverlayOpen = overlay && overlay.style.opacity === "1";
    if (!isOverlayOpen) {
      rightPanel.style.display = "none";
    }
    return;
  }

  // 2. PC 데스크탑 환경 (마우스 포인터): 창을 좁혀도 차트가 절대 사라지지 않고 2분할 유지!
  if (rightPanel.style.display === "none") {
    rightPanel.style.display = "flex";
  }
  leftPanel.style.width = "";
  leftPanel.style.flex = "";
  leftPanel.style.maxWidth = "";

  if (typeof window.applyChartLayout === "function") {
    window.applyChartLayout();
  }
}

export function adjustNoticeFontSizes() {
  const container = document.getElementById("header-notice-container");
  const slider = document.getElementById("notice-slider");
  if (!slider) return;

  // 1000px 미만이면 공지사항 바 자체를 숨김 처리
  if (window.innerWidth < 1000) {
    if (container) container.style.display = "none";
    return;
  } else {
    if (container) container.style.display = "";
  }

  const items = slider.querySelectorAll("div");
  items.forEach((div) => {
    if (window.innerWidth >= 1200) {
      div.style.fontSize = "";
      return;
    }

    const text = div.innerText || "";
    const len = text.length;

    // 🚀 감쇄율 2배 완화(0.45 -> 0.22) & 하한선 상향(0.45 -> 0.65rem): 글자가 덜 깎이고 시인성 보장
    const threshold = 40;
    const baseRem = 0.75;
    const minRem = 0.65;
    const logMult = 0.22;

    let sizeRem = baseRem;
    if (len > threshold) {
      sizeRem = Math.max(
        minRem,
        baseRem - Math.log10(len / threshold) * logMult,
      );
    }

    // 1000px ~ 1200px 구간에서도 과도한 축소 방지 (최소 0.9배 유지)
    const scaleFactor = Math.max(0.9, Math.min(1, window.innerWidth / 1200));
    const finalRem = Math.max(minRem, sizeRem * scaleFactor);

    div.style.fontSize = `${finalRem.toFixed(3)}rem`;
  });
}

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
          // 우측 가격 축 영역(약 75px)을 터치하면 버튼 표시, 아니면 숨김
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

// 🚀 전역 노출
window.toggleSidebar = toggleSidebar;
window.switchViewMode = switchViewMode;
window.togglePanelSwap = togglePanelSwap;
window.showOnboardingModal = showOnboardingModal;
window.closeOnboardingModal = closeOnboardingModal;
window.checkLayoutOverlap = checkLayoutOverlap;
window.adjustNoticeFontSizes = adjustNoticeFontSizes;

