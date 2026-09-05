// ui_control.js
// --- 📱 UI/UX 컨트롤 허브 모듈 ---
// 기존 기능 및 전역 바인딩(window.*), import/export 역할을 100% 보존하면서
// 유지보수를 위해 각 전담 하위 모듈로 체계화된 허브 파일입니다.

import { store, CONFIG } from "./_store.js";
import { initChart, updateChartTheme } from "./chart.js";
import { fetchHistory } from "./chart_data.js";
import { getPureBase } from "./chart_utils.js";
import { renderTable } from "./table_render.js";

// ==========================================
// 1. 테마 & 캔들 컬러 관리 (theme_manager.js)
// ==========================================
export {
  toggleTheme,
  toggleCandleTheme,
  updateCandleThemeButtons,
  applyCandleTheme,
  getCandleThemeColors,
  restoreThemeSettings,
} from "./theme_manager.js";

// ==========================================
// 2. 심볼 검색 & 최근 검색어 (ui_search.js)
// ==========================================
export {
  searchSymbols,
  clearSearch,
  toggleTabSearch,
  getActiveSearchInput,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearAllRecentSearches,
  renderRecentSearchChips,
  showRecentSearchChips,
  hideRecentSearchChips,
} from "./ui_search.js";

// ==========================================
// 3. 성능 최적화 & DOM 블로커 (ui_perf_blocker.js)
// ==========================================
export {
  syncCheckboxesFromStore,
  toggleRightDomBlock,
  toggleChartDomBlock,
  toggleOrderbookBlock,
  toggleLegendBlock,
  toggleResizeBlock,
  toggleChartMouseEventBlock,
  toggleLeftDomBlock,
  toggleSortBlock,
  toggleTableUpdateBlock,
  toggleKimchiBlock,
  toggleTabScrollBlock,
  toggleRadarBatchBlock,
  toggleDynamicHtmlBlock,
  setAggTradeInterval,
  copyPerformanceStats,
} from "./ui_perf_blocker.js";

// ==========================================
// 4. 타임프레임 및 스케일 제어 (ui_timeframe.js)
// ==========================================
export {
  timeframes,
  getVisibleTfs,
  saveVisibleTfs,
  renderTimeframeButtons,
  toggleTfSettings,
  renderTfCheckboxList,
  applyTfSettings,
  syncChartControlsModalUI,
  setTF,
  executeSetTF,
  toggleLogScale,
} from "./ui_timeframe.js";

// ==========================================
// 5. 사이드바, 패널 스왑, 뷰 모드, 온보딩 (ui_panels.js)
// ==========================================
export {
  toggleSidebar,
  switchViewMode,
  togglePanelSwap,
  checkLayoutOverlap,
  adjustNoticeFontSizes,
  showOnboardingModal,
  closeOnboardingModal,
} from "./ui_panels.js";

// ==========================================
// 6. 모바일 뷰, 바텀시트 차트, 탭 (ui_mobile.js)
// ==========================================
export {
  switchMobileView,
  switchMobileTab,
  showMobileChart,
  closeMobileChart,
  executeTabSwitch,
  switchChartTab,
} from "./ui_mobile.js";

// ==========================================
// 7. 심볼 선택 및 거래소 뱃지 (ui_selection.js)
// ==========================================
export {
  selectSymbol,
  updateExchangeBadges,
} from "./ui_selection.js";

// ==========================================
// 8. 탭 슬라이더 하이라이터 (moveTabSlider)
// ==========================================
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

// 🚀 탭 컨테이너 크기 변경 시 하이라이터 위치 동적 재조정
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

      // 페이지 첫 로딩 시 현재 active 클래스가 설정된 탭 위치로 즉시 하이라이터 이동
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

// ==========================================
// 9. 차트 전체화면 래퍼 및 전체화면 시 tf-container 연동
// ==========================================
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
          "hidden min-[1200px]:flex px-2.5 py-1 text-[11px] font-bold bg-transparent text-theme-text opacity-60 border border-theme-border/30 rounded hover:bg-theme-border/50 hover:opacity-100 transition-all ml-2 flex-shrink-0 cursor-pointer items-center gap-1";

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

            // head-control-buttons를 tf-container 안에 함께 배치
            if (headCtrl) {
              headCtrl.style.marginLeft = "auto";
              container.appendChild(headCtrl);
            }

            // 전체화면 버튼도 tf-container 안으로 이동
            container.appendChild(fullscreenBtn);

            // OHLC 레전드가 tf-container에 겹치지 않도록 아래로 밀기
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

            // head-control-buttons를 원래 부모로 복원
            if (headCtrl && headCtrl._origParent) {
              headCtrl._origParent.insertBefore(headCtrl, headCtrl._origNext);
              headCtrl.style.marginLeft = "";
            }

            // tf-container를 원래 위치로 복원
            if (container._origParent) {
              container._origParent.insertBefore(
                container,
                container._origNext,
              );
            }

            // 전체화면 버튼을 원래 위치로 복원
            if (fullscreenBtn._origParent) {
              fullscreenBtn._origParent.insertBefore(
                fullscreenBtn,
                fullscreenBtn._origNext,
              );
            }

            // OHLC 레전드 탑 위치 원복
            if (legend) {
              legend.style.removeProperty("top");
            }

            fullscreenBtn.innerHTML = "<span>🖥️</span> <span>전체화면</span>";
            fullscreenBtn.classList.remove(
              "text-theme-accent",
              "border-theme-accent/40",
            );
          }

          // DOM 재배치 후 캔버스 높이 재계산을 위한 차트 레이아웃 강제 갱신
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

// ==========================================
// 10. 전역 바인딩 (window.*) 100% 보존
// ==========================================
window.moveTabSlider = moveTabSlider;

// ==========================================
// 11. 초기 상태 복원 및 컴포넌트 렌더링
// ==========================================
import { renderRecentSearchChips } from "./ui_search.js";
import { syncCheckboxesFromStore } from "./ui_perf_blocker.js";
import { renderTimeframeButtons } from "./ui_timeframe.js";

document.addEventListener("DOMContentLoaded", () => {
  renderTimeframeButtons("1d");
  const isOhlcHidden = localStorage.getItem("sellnance_ohlc_hidden") === "true";
  if (isOhlcHidden) {
    document.getElementById("ohlc-legend")?.classList.add("hidden");
  }
  syncCheckboxesFromStore();
  renderRecentSearchChips();
});

