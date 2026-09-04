// settings_modal.js
// CMC API 키 관리 및 시스템 설정 모달 전담 모듈

import { store } from "./_store.js";
import { loadTableData } from "./table_api.js";

export function maskApiKey(key) {
  if (!key) return "";
  const len = key.length;
  if (len <= 8) return key;

  const start = key.slice(0, 4);
  const end = key.slice(-4);
  const dots = "*".repeat(len - 8);
  return `${start}${dots}${end}`;
}

export async function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  modal.style.display = "flex";

  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    store.settings = data;
    const currentKey = data.CMC_API_KEY || localStorage.getItem("CMC_API_KEY") || "";
    if (!data.CMC_API_KEY && currentKey) {
      data.CMC_API_KEY = currentKey;
    }
    const input = document.getElementById("setting-cmc-key");
    const btn = input ? input.nextElementSibling : null;
    if (input) {
      input.type = "text";
      input.value = maskApiKey(currentKey);
      input.dataset.masked = "true";
    }
    if (btn) btn.innerText = "🙈";
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
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
  let newKey = input.value.trim();

  if (newKey.includes("*") && store.settings) {
    newKey = store.settings.CMC_API_KEY || localStorage.getItem("CMC_API_KEY") || "";
  }

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CMC_API_KEY: newKey }),
    });

    if (res.ok) {
      localStorage.setItem("CMC_API_KEY", newKey);
      alert("Settings saved successfully! Restarting data fetch...");
      closeSettingsModal();
      if (typeof loadTableData === "function") {
        loadTableData(true);
      }
    }
  } catch (e) {
    alert("Failed to save settings.");
  }
}

export function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const btn = input.nextElementSibling;
  if (!store.settings) return;
  const raw = store.settings.CMC_API_KEY || localStorage.getItem("CMC_API_KEY") || "";

  if (input.dataset.masked === "true") {
    input.value = raw;
    input.dataset.masked = "false";
    if (btn) btn.innerText = "🙉";
  } else {
    input.value = maskApiKey(raw);
    input.dataset.masked = "true";
    if (btn) btn.innerText = "🙈";
  }
}

export function clearCmcKey() {
  const input = document.getElementById("setting-cmc-key");
  if (input) {
    input.value = "";
    input.dataset.masked = "false";
    input.focus();
  }
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
