// feedback_modal.js
// 💬 다크/라이트 테마 100% 동기화 네이티브 피드백 & 고객센터 모달

import { store } from "./_store.js";
import { showToast } from "./ui_dialog.js";

export function toggleFeedbackModal(show) {
  const modal = document.getElementById("feedback-modal");
  const floatingBtn = document.getElementById("feedback-floating-btn");
  if (!modal) return;

  if (show) {
    modal.classList.remove("scale-0", "opacity-0", "pointer-events-none");
    modal.classList.add("scale-100", "opacity-100");
    if (floatingBtn) {
      floatingBtn.classList.add("scale-0", "opacity-0", "pointer-events-none");
    }
    const textarea = document.getElementById("feedback-content");
    if (textarea) setTimeout(() => textarea.focus(), 120);

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        toggleFeedbackModal(false);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  } else {
    modal.classList.remove("scale-100", "opacity-100");
    modal.classList.add("scale-0", "opacity-0", "pointer-events-none");
    if (floatingBtn) {
      floatingBtn.classList.remove("scale-0", "opacity-0", "pointer-events-none");
    }
  }
}

let lastFeedbackSubmitTime = 0;

export async function submitFeedback(event) {
  if (event) event.preventDefault();

  const now = Date.now();
  if (now - lastFeedbackSubmitTime < 5000) {
    const remainSec = Math.ceil((5000 - (now - lastFeedbackSubmitTime)) / 1000);
    showToast(`${remainSec}초 후 다시 전송할 수 있습니다.`, "warning", 2000);
    return;
  }

  const emailInput = document.getElementById("feedback-email");
  const contentInput = document.getElementById("feedback-content");
  const submitBtn = document.getElementById("feedback-submit-btn");

  const email = emailInput ? emailInput.value.trim() : "";
  const content = contentInput ? contentInput.value.trim() : "";

  if (!content) {
    showToast("내용을 입력해 주세요.", "warning", 2000);
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-70", "cursor-not-allowed");
    submitBtn.innerHTML = `<span>전송 중...</span>`;
  }

  // 🔍 접속 환경 & 해상도 감지
  const ua = navigator.userAgent || "";
  let os = "기타 OS";
  if (/iPhone/i.test(ua)) os = "iOS (iPhone)";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Win/i.test(ua)) os = "Windows";
  else if (/Mac/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "기타 브라우저";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = "Safari";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";

  const isMobile = window.innerWidth < 1200 || /Mobi|Android|iPhone|iPad/i.test(ua);
  const deviceType = isMobile ? "📱 모바일" : "💻 PC";
  const environment = `${deviceType} • ${os} • ${browser}`;
  const screenRes = `${window.screen?.width || window.innerWidth} x ${window.screen?.height || window.innerHeight}`;
  const windowRes = `${window.innerWidth} x ${window.innerHeight}`;
  const resolution = `${screenRes} (창: ${windowRes})`;

  // 🔍 현재 보고 있는 코인 심볼 및 UID 추출
  const currentSymbol = store.currentSelectedSymbol || store.currentAsset || "미선택";
  let currentUid = store.currentSelectedUid || "-";
  if (currentUid === "-" && currentSymbol !== "미선택" && store.tickerRowMap) {
    const row = store.tickerRowMap.get(currentSymbol) || store.tickerRowMap.get(currentSymbol.toUpperCase());
    if (row && row.UID) currentUid = row.UID;
  }

  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: content,
        email: email,
        symbol: currentSymbol,
        uid: String(currentUid),
        environment: environment,
        resolution: resolution,
      }),
    });

    const result = await res.json().catch(() => ({}));
    if (result.status === "error" && result.message) {
      showToast(result.message, "warning", 2000);
      return;
    }

    lastFeedbackSubmitTime = Date.now();
    showToast("피드백 감사해요!", "success", 2500);
    if (contentInput) contentInput.value = "";
    if (emailInput) emailInput.value = "";
    toggleFeedbackModal(false);
  } catch (err) {
    lastFeedbackSubmitTime = Date.now();
    showToast("피드백 감사해요!", "success", 2500);
    toggleFeedbackModal(false);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
      submitBtn.innerHTML = `<span>전송하기</span><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
    }
  }
}

// 전역 window 바인딩
window.toggleFeedbackModal = toggleFeedbackModal;
window.submitFeedback = submitFeedback;
