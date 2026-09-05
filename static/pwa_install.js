// pwa_install.js
// 📱 [PWA 설치 안내 모달 & 프롬프트 매니저]

let deferredInstallPrompt = null;
let pwaModalInitialized = false;

// 1. 브라우저 설치 이벤트 가로채기 (Android / Chrome / Edge)
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  // 이미 설치 완료된 경우 이벤트
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    try {
      localStorage.setItem("sellnance_pwa_installed", "true");
    } catch (err) { }
    closePwaModal();
  });
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isWebview =
    /kakaotalk|line|inapp|instagram|fbav|naver/i.test(ua);
  return isIos && !isWebview;
}

export function initPwaInstallPrompt() {
  // PWA 모달 임시 비활성화 (주석 처리)
  return;
  /*
  if (pwaModalInitialized) return;
  pwaModalInitialized = true;

  // 이미 standalone 앱으로 실행 중이면 팝업 안 띄움
  if (isStandaloneApp()) return;

  // 7일간 보지 않기 확인
  try {
    const dismissedUntil = localStorage.getItem("sellnance_pwa_dismissed_until");
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }
  } catch (err) { }

  // 첫 코인 리스트 로드 후 1.8초 뒤 자연스럽게 노출
  setTimeout(() => {
    // 사용자가 차트 화면으로 바로 진입한 게 아니라 리스트/메인 상태일 때
    showPwaModal();
  }, 1800);
  */
}

export function showPwaModal() {
  if (isStandaloneApp()) return;

  let modal = document.getElementById("pwa-install-modal");
  if (!modal) {
    createPwaModalDOM();
    modal = document.getElementById("pwa-install-modal");
  }
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  void modal.offsetWidth;

  const content = document.getElementById("pwa-install-content");
  modal.classList.remove("opacity-0");
  modal.classList.add("opacity-100");
  if (content) {
    content.classList.remove("scale-95", "translate-y-4");
    content.classList.add("scale-100", "translate-y-0");
  }
}

export function closePwaModal(dismissDays = 0) {
  const modal = document.getElementById("pwa-install-modal");
  const content = document.getElementById("pwa-install-content");
  if (!modal) return;

  if (dismissDays > 0) {
    try {
      const until = Date.now() + dismissDays * 24 * 60 * 60 * 1000;
      localStorage.setItem("sellnance_pwa_dismissed_until", until.toString());
    } catch (err) { }
  }

  modal.classList.remove("opacity-100");
  modal.classList.add("opacity-0");
  if (content) {
    content.classList.remove("scale-100", "translate-y-0");
    content.classList.add("scale-95", "translate-y-4");
  }

  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 250);
}

export async function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        try {
          localStorage.setItem("sellnance_pwa_installed", "true");
        } catch (err) { }
      }
      deferredInstallPrompt = null;
    } catch (err) {
      console.warn("PWA prompt error:", err);
    }
    closePwaModal();
  } else if (isIosSafari()) {
    // iOS 사파리의 경우 안내 단계 표시 유지
    closePwaModal(7);
  } else {
    // 데스크톱 / 기타 환경 안내
    closePwaModal(3);
  }
}

function createPwaModalDOM() {
  const isIos = isIosSafari();
  const isDark = !document.documentElement.classList.contains("theme-upbit");
  const deerLogo = isDark ? "/static/luma-deer-svg-dark.svg" : "/static/luma-deer-svg-light.svg";

  const modalHtml = `
    <div id="pwa-install-modal"
      class="fixed inset-0 z-[9999] hidden items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 opacity-0 select-none">
      <div id="pwa-install-content"
        class="relative w-full max-w-[340px] sm:max-w-[360px] bg-theme-panel border border-theme-border rounded-2xl shadow-2xl p-5 flex flex-col gap-4 transform scale-95 translate-y-4 transition-all duration-300">
        
        <!-- 상단 헤더 & 닫기 -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="${deerLogo}" class="w-7 h-7 rounded-full p-0.5 border border-theme-border/60 bg-theme-bg shadow-sm" alt="Sellnance Logo" />
            <span class="text-sm font-bold text-theme-text tracking-tight">Sellnance 앱 설치</span>
          </div>
          <button onclick="window.closePwaModal && window.closePwaModal(3)"
            class="text-theme-text/50 hover:text-theme-text p-1 text-base leading-none transition-colors cursor-pointer">
            ✕
          </button>
        </div>

        <!-- 안내 본문 -->
        <div class="flex flex-col gap-2.5 text-left">
          <p class="text-[13px] font-bold text-theme-text leading-snug">
            홈 화면에 추가하고 <span class="text-theme-accent">앱처럼 시원한 전체화면</span>으로 사용해보세요!
          </p>
          <div class="flex flex-col gap-2 bg-theme-bg/60 p-3 rounded-xl border border-theme-border/40 text-[11px] text-theme-text/80">
            <div class="flex items-center gap-2">
              <span class="text-xs">⚡</span>
              <span>브라우저 주소창 없는 <b>100% 전체화면</b> 차트</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs">📱</span>
              <span>홈 화면에서 <b>터치 한 번으로 즉시 실행</b></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs">🚀</span>
              <span>딜레이 없는 <b>실시간 통합 시세 & 김프</b></span>
            </div>
          </div>
        </div>

        ${isIos
      ? `
          <!-- iOS Safari 전용 안내 -->
          <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-theme-accent/10 border border-theme-accent/30 text-[11px] text-theme-accent font-medium">
            <div class="flex items-center gap-1.5">
              <span>1️⃣ 사파리 하단 중앙의 <b>공유 버튼(⎋)</b> 터치</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span>2️⃣ 메뉴에서 <b>[홈 화면에 추가 ⊞]</b> 선택</span>
            </div>
          </div>
          <div class="flex flex-col gap-2 pt-1">
            <button onclick="window.closePwaModal && window.closePwaModal(7)"
              class="w-full py-2.5 px-4 rounded-xl bg-theme-accent text-white font-bold text-[12px] shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer">
              확인했어요 ✨
            </button>
          </div>
          `
      : `
          <!-- Android / Chrome / PC 원클릭 설치 버튼 -->
          <div class="flex flex-col gap-2 pt-1">
            <button onclick="window.triggerPwaInstall && window.triggerPwaInstall()"
              class="w-full py-2.5 px-4 rounded-xl bg-theme-accent text-white font-bold text-[12px] shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5">
              <span>🚀</span>
              <span>홈 화면에 앱 설치하기</span>
            </button>
            <div class="flex items-center justify-between px-1 text-[10px] text-theme-text/50">
              <button onclick="window.closePwaModal && window.closePwaModal(7)" class="hover:text-theme-text transition-colors cursor-pointer">
                7일간 보지 않기
              </button>
              <button onclick="window.closePwaModal && window.closePwaModal(0)" class="hover:text-theme-text transition-colors cursor-pointer">
                다음에 하기
              </button>
            </div>
          </div>
          `
    }
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// 전역 바인딩
if (typeof window !== "undefined") {
  window.initPwaInstallPrompt = initPwaInstallPrompt;
  window.showPwaModal = showPwaModal;
  window.closePwaModal = closePwaModal;
  window.triggerPwaInstall = triggerPwaInstall;
}
