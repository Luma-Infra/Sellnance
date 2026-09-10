// settings_modal.js
// CMC API 키 관리 및 시스템 설정 모달 전담 모듈

import { store } from "./_store.js";
import { showToast } from "./ui_dialog.js";
import { loadTableData } from "./table_api.js";

let tempCmcKey = "";
let isListenersBound = false;

export function maskApiKey(key) {
  if (!key) return "";
  const len = key.length;
  if (len <= 8) return key;

  const start = key.slice(0, 4);
  const end = key.slice(-4);
  const dots = "*".repeat(len - 8);
  return `${start}${dots}${end}`;
}

function syncClearButtonState() {
  const clearBtn =
    document.getElementById("btn-clear-setting-cmc-key") ||
    document.querySelector("button[onclick*='clearCmcKey']");
  if (!clearBtn) return;
  if (tempCmcKey && tempCmcKey.length > 0) {
    clearBtn.classList.remove("opacity-0", "pointer-events-none", "scale-75");
    clearBtn.classList.add("opacity-60", "pointer-events-auto", "scale-100");
  } else {
    clearBtn.classList.remove("opacity-60", "pointer-events-auto", "scale-100");
    clearBtn.classList.add("opacity-0", "pointer-events-none", "scale-75");
  }
}

function bindInputListeners() {
  if (isListenersBound) return;
  const input = document.getElementById("setting-cmc-key");
  if (!input) return;

  isListenersBound = true;

  input.addEventListener("focus", () => {
    input.value = tempCmcKey;
    syncClearButtonState();
  });

  input.addEventListener("input", () => {
    tempCmcKey = input.value.replace(/[^a-zA-Z0-9]/g, "");
    input.value = tempCmcKey;
    syncClearButtonState();
  });

  input.addEventListener("blur", () => {
    if (input.dataset.masked === "true") {
      input.value = maskApiKey(tempCmcKey);
    } else {
      input.value = tempCmcKey;
    }
    syncClearButtonState();
  });
}

export async function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.style.display = "flex";

  bindInputListeners();

  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    store.settings = data || {};
  } catch (e) {
    console.error("Failed to load settings:", e);
  }

  tempCmcKey = (localStorage.getItem("CMC_API_KEY") || "").trim();
  const input = document.getElementById("setting-cmc-key");
  const toggleBtn =
    document.getElementById("btn-toggle-setting-cmc-key") ||
    (input ? input.nextElementSibling : null);

  if (input) {
    input.type = "text";
    input.value = maskApiKey(tempCmcKey);
    input.dataset.masked = "true";
  }
  if (toggleBtn) {
    toggleBtn.innerText = "🙈";
    toggleBtn.title = "키 보기";
  }
  syncClearButtonState();
}

export function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

export async function saveSettings() {
  const input = document.getElementById("setting-cmc-key");
  if (!input) return;

  // 인풋 포커스 상태에서 직접 입력 중이었을 경우 최신 값 반영
  if (!input.value.includes("*")) {
    tempCmcKey = input.value.replace(/[^a-zA-Z0-9]/g, "").trim();
  }

  const cleanKey = (tempCmcKey || "").trim();

  // 1) 키가 비어있지 않은 경우 32자리 유효성 검사
  if (cleanKey.length > 0 && cleanKey.length !== 32) {
    input.classList.add(
      "!border-red-500/80",
      "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    );
    setTimeout(() => {
      input.classList.remove(
        "!border-red-500/80",
        "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
      );
    }, 2000);
    input.focus();
    showToast(
      `CMC API 키는 32자여야 합니다 (${cleanKey.length}/32자)`,
      "warning",
      2500,
    );
    return;
  }

  const saveBtn =
    document.getElementById("btn-save-settings") ||
    document.querySelector("button[onclick*='saveSettings']");
  if (saveBtn) {
    saveBtn.innerText = "SAVING...";
    saveBtn.style.pointerEvents = "none";
  }

  try {
    const prevKey = (localStorage.getItem("CMC_API_KEY") || "").trim();
    const isKeyChanged = prevKey !== cleanKey;

    // 백엔드 환경 설정 동기화
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CMC_API_KEY: cleanKey }),
    });

    if (cleanKey) {
      localStorage.setItem("CMC_API_KEY", cleanKey);
      showToast("CMC API 키가 성공적으로 저장되었습니다", "success", 2000);
    } else {
      localStorage.removeItem("CMC_API_KEY");
      showToast("CMC API 키가 삭제되었습니다", "info", 2000);
    }

    closeSettingsModal();

    // 키가 변경되었을 때 화면 프리징 없는 사일런트(silent) 백그라운드 갱신
    if (isKeyChanged && typeof loadTableData === "function") {
      loadTableData(true, true);
    }
  } catch (e) {
    console.error("Failed to save settings:", e);
    showToast("설정 저장 중 오류가 발생했습니다.", "error", 2500);
  } finally {
    if (saveBtn) {
      saveBtn.innerText = "SAVE & APPLY";
      saveBtn.style.pointerEvents = "auto";
    }
  }
}

export function togglePasswordVisibility(id = "setting-cmc-key") {
  const input = document.getElementById(id);
  if (!input) return;
  const btn =
    document.getElementById("btn-toggle-setting-cmc-key") ||
    input.nextElementSibling;

  if (input.dataset.masked === "true") {
    input.value = tempCmcKey;
    input.dataset.masked = "false";
    if (btn) {
      btn.innerText = "🙉";
      btn.title = "키 숨기기";
    }
  } else {
    input.value = maskApiKey(tempCmcKey);
    input.dataset.masked = "true";
    if (btn) {
      btn.innerText = "🙈";
      btn.title = "키 보기";
    }
  }
}

export function clearCmcKey() {
  const input = document.getElementById("setting-cmc-key");
  tempCmcKey = "";
  if (input) {
    input.value = "";
    input.dataset.masked = "false";
    input.focus();
  }
  syncClearButtonState();
}

// ESC 키로 모달 닫기 이벤트 리스너 등록
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("settings-modal");
      if (modal && modal.style.display !== "none") {
        closeSettingsModal();
      }
    }
  });
}

// 글로벌 window 객체에 바인딩
if (typeof window !== "undefined") {
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.saveSettings = saveSettings;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.clearCmcKey = clearCmcKey;
}
