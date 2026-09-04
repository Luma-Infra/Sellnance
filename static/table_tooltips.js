// table_tooltips.js
// 🔍 [테이블 전역 툴팁 & 호버 팝오버 관리 모듈]
// 1. 거래소별 유의/상폐/모니터링 경고 전역 포털 툴팁 (document.body 직속)
// 2. 상장 거래소 그리드 마우스 호버 시 3배 확대 프리뷰 전역 팝오버

export const EXCH_LOGO_MAP = {
  UPBIT: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/351.png",
  BITHUMB: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/200.png",
  BINANCE: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png",
  BYBIT: "https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png",
};

let globalCautionTooltip = null;

export function getOrCreateGlobalCautionTooltip() {
  if (!globalCautionTooltip) {
    globalCautionTooltip = document.createElement("div");
    globalCautionTooltip.id = "global-caution-tooltip";
    globalCautionTooltip.className =
      "fixed pointer-events-none opacity-0 transition-opacity duration-150 p-2.5 bg-theme-panel/98 backdrop-blur-2xl border border-rose-500/50 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.25)] z-[9999999] flex flex-col gap-1.5 text-left font-sans min-w-[220px] max-w-[320px] text-theme-text";
    document.body.appendChild(globalCautionTooltip);
  }
  return globalCautionTooltip;
}

export function showCautionTooltip(e, warningsJsonStr) {
  const target = e.currentTarget || e.target;
  const rect = target.getBoundingClientRect();
  const tooltip = getOrCreateGlobalCautionTooltip();

  try {
    const warnings =
      typeof warningsJsonStr === "string"
        ? JSON.parse(decodeURIComponent(warningsJsonStr))
        : warningsJsonStr;
    const entries = Object.entries(warnings || {});
    if (entries.length === 0) return;

    const detailsHtml = entries
      .map(([ex, msg]) => {
        const logoUrl = EXCH_LOGO_MAP[ex];
        const logoHtml = logoUrl
          ? `<img src="${logoUrl}" alt="${ex}" class="w-3.5 h-3.5 object-contain rounded-[2px] flex-shrink-0 bg-theme-panel p-[0.5px]" />`
          : `<span class="text-[9px] font-bold text-theme-text opacity-70">${ex}</span>`;
        return `
        <div class="flex items-center gap-2 py-1 text-[11px] leading-tight border-b border-theme-border/30 last:border-0">
          ${logoHtml}
          <span class="font-bold text-rose-500 font-mono tracking-tight">${ex}</span>
          <span class="text-theme-text font-medium text-[11px]">${msg}</span>
        </div>
      `;
      })
      .join("");

    tooltip.innerHTML = `
      <div class="flex flex-col">
        ${detailsHtml}
      </div>
    `;

    // 툴팁 위치 계산 (배지 우측에 정렬, 화면 벗어남 방지)
    const top = Math.max(
      10,
      Math.min(window.innerHeight - 150, rect.top + rect.height / 2),
    );
    let left = rect.right + 10;
    if (left + 280 > window.innerWidth) {
      left = Math.max(10, rect.left - 290);
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.transform = "translateY(-50%)";
    tooltip.classList.remove("opacity-0", "pointer-events-none");
    tooltip.classList.add("opacity-100");
  } catch (err) { }
}

export function hideCautionTooltip() {
  if (globalCautionTooltip) {
    globalCautionTooltip.classList.remove("opacity-100");
    globalCautionTooltip.classList.add("opacity-0", "pointer-events-none");
  }
}

// 🚀 window 전역 노출 및 닫기 이벤트 등록
window.showCautionTooltip = showCautionTooltip;
window.hideCautionTooltip = hideCautionTooltip;

if (typeof document !== "undefined") {
  document.addEventListener("scroll", hideCautionTooltip, true);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".caution-badge")) {
      hideCautionTooltip();
    }
  });
}

// ==========================================
// 🚀 Web Popover API 기반 3배 확대 프리뷰 전역 팝오버 탑재
// ==========================================
if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    let popoverEl = document.getElementById("global-exch-popover");
    if (!popoverEl) {
      popoverEl = document.createElement("div");
      popoverEl.id = "global-exch-popover";
      popoverEl.setAttribute("popover", "manual");
      popoverEl.style.position = "fixed";
      popoverEl.style.margin = "0";
      popoverEl.style.padding = "6px";
      popoverEl.style.border = "1px solid rgba(255, 255, 255, 0.15)";
      popoverEl.style.background = "rgba(10, 10, 10, 0.96)";
      popoverEl.style.borderRadius = "6px";
      popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.85)";
      popoverEl.style.pointerEvents = "none"; // 호버 중복 간섭 및 깜빡임 방지
      popoverEl.style.zIndex = "999999";
      popoverEl.style.opacity = "0";
      popoverEl.style.transform = "scale(0.9)";
      popoverEl.style.transition = "opacity 0.15s ease, transform 0.15s ease";
      document.body.appendChild(popoverEl);
    }

    let fadeOutTimeout = null;
    let hideTimeout = null;

    const bodyContainer = document.getElementById("coin-list-body");
    if (bodyContainer) {
      bodyContainer.addEventListener("mouseover", (e) => {
        const grid = e.target.closest(".exch-grid-trigger");
        if (grid) {
          if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
          if (hideTimeout) clearTimeout(hideTimeout);

          const isLightMode = document.body.classList.contains("theme-upbit");
          if (isLightMode) {
            popoverEl.style.background = "rgba(255, 255, 255, 0.98)";
            popoverEl.style.border = "1px solid rgba(0, 0, 0, 0.12)";
            popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.12)";
          } else {
            popoverEl.style.background = "rgba(10, 10, 10, 0.96)";
            popoverEl.style.border = "1px solid rgba(255, 255, 255, 0.15)";
            popoverEl.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.85)";
          }

          // 🚀 [디자인 엔진] 단 한 줄로 제어하는 팝오버 배율 변수 (기본 3.0배)
          const scale = 2.5;
          const baseIconSize = 16; // 원래 아이콘 크기인 16px 기준

          const iconSize = baseIconSize * scale; // 예: 3.0배면 48px
          const cellHeight = iconSize + 12 * scale; // 뱃지 영역 포함 높이
          const cellGap = 4;
          const popPadding = 6;

          const rect = grid.getBoundingClientRect();
          popoverEl.innerHTML = "";

          // 1. 상장 거래소 그리드 생성
          const gridWrapper = document.createElement("div");
          gridWrapper.style.display = "grid";
          gridWrapper.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
          gridWrapper.style.gap = `${cellGap}px`;
          gridWrapper.innerHTML = grid.innerHTML;
          popoverEl.appendChild(gridWrapper);

          // 2. 하단 주의 문구 생성
          const warnEl = document.createElement("div");
          warnEl.style.textAlign = "center";
          warnEl.style.fontSize = `${Math.max(8, 3 * scale)}px`;
          warnEl.style.fontWeight = "500";
          warnEl.style.letterSpacing = "-0.025em";
          warnEl.style.marginTop = `${4 * scale}px`;
          warnEl.style.opacity = "0.6";
          warnEl.style.color = isLightMode ? "#333333" : "#d2d2d2";
          warnEl.innerText = "* 실시간 상장 정보와 다를 수 있습니다";
          popoverEl.appendChild(warnEl);

          // 개별 아이콘 및 뱃지 동적 크기 계산 적용
          gridWrapper.querySelectorAll(".relative").forEach((el) => {
            el.style.width = `${iconSize}px`;
            el.style.height = `${cellHeight}px`;
            el.style.overflow = "visible";

            const img = el.querySelector("img");
            if (img) {
              img.style.position = "absolute";
              img.style.top = "0";
              img.style.left = "0";
              img.style.width = `${iconSize}px`;
              img.style.height = `${iconSize}px`;
            }

            const badge = el.querySelector(".absolute");
            if (badge) {
              badge.style.transform = "none";
              badge.className = `absolute left-0 right-0 flex flex-col justify-start items-center w-full z-10`;
              badge.style.top = `${iconSize + 2}px`;
              badge.style.gap = `${1 * scale}px`;

              const sEl = badge.querySelector(".badge-spot");
              if (sEl) {
                sEl.innerText = "SPOT";
                sEl.className =
                  "bg-[#0ecb81] text-black font-black leading-none tracking-tight rounded-[1px]";
                sEl.style.fontSize = `${3.1 * scale}px`;
                sEl.style.padding = `${1 * scale}px ${1.2 * scale}px`;
              }

              const fEl = badge.querySelector(".badge-futures");
              if (fEl) {
                fEl.innerText = "FUTURES";
                fEl.className =
                  "bg-[#f0b90b] text-black font-black leading-none tracking-tight rounded-[1px]";
                fEl.style.fontSize = `${3.1 * scale}px`;
                fEl.style.padding = `${1 * scale}px ${1.2 * scale}px`;
              }
            }
          });

          // 팝오버 총 크기 및 오프셋 동적 정밀 산출
          const popWidth = iconSize * 4 + cellGap * 3 + popPadding * 2;
          const popHeight =
            cellHeight * 2 + cellGap * 1 + popPadding * 2 + 14 * scale;

          popoverEl.style.top = `${rect.top + rect.height / 2 - popHeight / 2}px`;
          if (rect.right + 12 + popWidth > window.innerWidth) {
            popoverEl.style.left = `${Math.max(4, rect.left - popWidth - 12)}px`; // 좌측 배치
          } else {
            popoverEl.style.left = `${rect.right + 12}px`; // 우측 배치
          }

          try {
            popoverEl.showPopover();
            requestAnimationFrame(() => {
              popoverEl.style.opacity = "1";
              popoverEl.style.transform = "scale(1)";
            });
          } catch (err) { }
        }
      });

      bodyContainer.addEventListener("mouseout", (e) => {
        const grid = e.target.closest(".exch-grid-trigger");
        if (grid) {
          if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
          if (hideTimeout) clearTimeout(hideTimeout);

          fadeOutTimeout = setTimeout(() => {
            popoverEl.style.opacity = "0";
            popoverEl.style.transform = "scale(0.9)";

            hideTimeout = setTimeout(() => {
              try {
                popoverEl.hidePopover();
              } catch (err) { }
            }, 150);
          }, 50);
        }
      });
    }
  });
}
