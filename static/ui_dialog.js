// ui_dialog.js
// 🌟 Sellnance 자체 초경량 토스트 & 확인 모달 통합 시스템
// - PC 토스트: 우측 상단 (Top-Right)
// - PC 모달: 정중앙 (Center)
// - 모바일 토스트 & 모달: 상단 중앙 (Top-Center, 작고 아담한 UI)
// - 테마 CSS 변수 (--panel, --border, --text, --accent, --up, --down) 100% 자동 연동

function getToastContainer() {
  let container = document.getElementById("sellnance-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "sellnance-toast-container";
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = {
  success: `<svg class="w-4 h-4 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  error: `<svg class="w-4 h-4 shrink-0 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  warning: `<svg class="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  info: `<svg class="w-4 h-4 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
};

/**
 * 🚀 플로팅 토스트 알림 표시
 * @param {string} message - 토스트 메시지
 * @param {'success'|'error'|'warning'|'info'} type - 알림 종류
 * @param {number} duration - 노출 시간 (ms, 기본 2200ms)
 */
export function showToast(message, type = "success", duration = 2200) {
  if (typeof document === "undefined") return;
  const container = getToastContainer();

  // 🚀 최대 동시 노출 개수 제한 (기본 4개): 초과 시 가장 오래된 토스트부터 부드럽게 밀어내기(FIFO)
  const MAX_TOASTS = 4;
  const activeToasts = container.querySelectorAll(".sellnance-toast:not(.sellnance-toast-hide)");
  if (activeToasts.length >= MAX_TOASTS) {
    for (let i = 0; i <= activeToasts.length - MAX_TOASTS; i++) {
      const oldToast = activeToasts[i];
      oldToast.classList.add("sellnance-toast-hide");
      setTimeout(() => {
        if (oldToast.parentElement) oldToast.parentElement.removeChild(oldToast);
      }, 255);
    }
  }

  const toast = document.createElement("div");
  toast.className = "sellnance-toast";

  const iconSvg = ICONS[type] || ICONS.info;

  toast.innerHTML = `
    <div class="sellnance-toast-inner">
      <div class="sellnance-toast-icon">${iconSvg}</div>
      <div class="sellnance-toast-msg">${message}</div>
      <button type="button" class="sellnance-toast-close" aria-label="Close">✕</button>
    </div>
    <div class="sellnance-toast-bar" style="animation-duration: ${duration}ms;"></div>
  `;

  const closeBtn = toast.querySelector(".sellnance-toast-close");
  let isClosing = false;

  const removeToast = () => {
    if (isClosing) return;
    isClosing = true;
    toast.classList.add("sellnance-toast-hide");
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 255);
  };

  if (closeBtn) closeBtn.addEventListener("click", removeToast);
  toast.addEventListener("click", removeToast);

  // 모바일 터치 스와이프 제스처 지원
  let startX = 0, startY = 0;
  toast.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  toast.addEventListener("touchend", (e) => {
    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      if (Math.abs(diffX) > 40 || diffY < -30) {
        removeToast();
      }
    }
  }, { passive: true });

  container.appendChild(toast);

  // 🚀 강제 리플로우 및 0ms 즉각 진입 애니메이션 보장
  void toast.offsetHeight;
  requestAnimationFrame(() => {
    toast.classList.add("sellnance-toast-show");
  });

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

/**
 * 🚀 확인 / 취소 모달 다이얼로그 (Promise 기반)
 * @param {object} options
 * @returns {Promise<boolean>}
 */
export function showConfirm({
  title = "확인",
  text = "",
  html = "",
  confirmText = "확인",
  cancelText = "취소",
  confirmColor = "var(--accent)",
  cancelColor = "transparent",
  showCancelButton = true,
  icon = "warning",
} = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(false);

    const overlay = document.createElement("div");
    overlay.className = "sellnance-modal-overlay";

    const iconSvg = ICONS[icon] || ICONS.warning;

    overlay.innerHTML = `
      <div class="sellnance-modal-card" role="dialog" aria-modal="true">
        <div class="sellnance-modal-icon-wrap">
          <div class="sellnance-modal-icon-circle sellnance-modal-icon-${icon}">
            ${iconSvg}
          </div>
        </div>
        ${title ? `<h3 class="sellnance-modal-title">${title}</h3>` : ""}
        ${html ? `<div class="sellnance-modal-body">${html}</div>` : text ? `<div class="sellnance-modal-body">${text}</div>` : ""}
        <div class="sellnance-modal-actions">
          ${showCancelButton ? `<button type="button" class="sellnance-modal-btn-cancel">${cancelText}</button>` : ""}
          <button type="button" class="sellnance-modal-btn-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    const card = overlay.querySelector(".sellnance-modal-card");
    const confirmBtn = overlay.querySelector(".sellnance-modal-btn-confirm");
    const cancelBtn = overlay.querySelector(".sellnance-modal-btn-cancel");

    if (confirmBtn && confirmColor) {
      if (confirmColor.startsWith("var(")) {
        confirmBtn.style.backgroundColor = confirmColor;
      } else {
        confirmBtn.style.backgroundColor = confirmColor;
      }
    }

    let isDone = false;
    const closeModal = (result) => {
      if (isDone) return;
      isDone = true;
      document.removeEventListener("keydown", handleKeyDown, true);
      overlay.classList.add("sellnance-modal-hide");
      setTimeout(() => {
        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
        resolve(result);
      }, 180);
    };

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => closeModal(true));
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => closeModal(false));
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(false);
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        closeModal(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("sellnance-modal-show");
      if (confirmBtn) confirmBtn.focus();
    });
  });
}

// 🚀 SweetAlert2 완전 호환 드롭인 브릿지
export const SwalBridge = {
  fire: function (opts = {}) {
    if (typeof opts === "string") {
      showToast(opts, "info");
      return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false });
    }

    if (opts.toast) {
      const msg = opts.title || opts.text || "";
      const type = opts.icon || "info";
      const timer = typeof opts.timer === "number" ? opts.timer : 2200;
      showToast(msg, type, timer);
      return Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false });
    }

    return showConfirm({
      title: opts.title || "",
      text: opts.text || "",
      html: opts.html || "",
      icon: opts.icon || "warning",
      confirmText: opts.confirmButtonText || "확인",
      cancelText: opts.cancelButtonText || "취소",
      confirmColor: opts.confirmButtonColor || "var(--accent)",
      cancelColor: opts.cancelButtonColor || "transparent",
      showCancelButton: opts.showCancelButton !== false,
    }).then((confirmed) => ({
      isConfirmed: confirmed,
      isDenied: false,
      isDismissed: !confirmed,
    }));
  },
};

// 글로벌 바인딩
if (typeof window !== "undefined") {
  window.showToast = showToast;
  window.showConfirm = showConfirm;
  window.Swal = SwalBridge;
  window.Sweetalert2 = SwalBridge;
}
