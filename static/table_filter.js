// table_filter.js
import { store, CONFIG } from "./_store.js";
import { renderTable } from "./table_render.js";
import { loadTableData } from "./table_api.js";

export function getFilteredData() {
  let filteredData = [...store.currentTableData];

  // 1. 탭 필터링 (ALL, FAV)
  if (store.currentTab === "FAV") {
    const favorites = JSON.parse(
      localStorage.getItem("sellnance_favs") || "[]",
    );
    filteredData = filteredData.filter((d) =>
      favorites.includes(d.DisplayTicker || d.Symbol),
    );
  }

  // 2. 마켓 필터링 (ALL / BINANCE / UPBIT)
  if (store.filterMode === "UPBIT") {
    filteredData = filteredData.filter(
      (d) =>
        d.Listed_Exchanges?.includes("UPBIT") ||
        d.Listed_Exchanges?.includes("BITHUMB"),
    );
  } else if (store.filterMode === "BINANCE") {
    filteredData = filteredData.filter((d) =>
      d.Listed_Exchanges?.some((ex) => ex.startsWith("BINANCE")),
    );
  }

  // 3. 시총 필터링 (1M 미만 숨기기 토글)
  if (store.hideSmallCap) {
    filteredData = filteredData.filter(
      (d) => (d.MarketCap_Raw || 0) >= 1000000,
    );
  }

  // 4. 바운더리 필터링
  const boundary = store.settings?.SORT_BOUNDARY;
  if (boundary) {
    filteredData = filteredData.filter((d) => {
      const c24 = Math.abs(d.Change_24h_Raw || 0);
      return c24 <= boundary;
    });
  }

  return filteredData;
}

export function switchTab(tab) {
  if (tab === "FAV" && store.currentTab === "FAV") {
    tab = "ALL";
  }

  store.currentTab = tab;
  store.currentRenderLimit = 1000;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("bg-theme-accent", "text-white", "shadow-md");
    btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
  });

  const activeBtn = document.getElementById(`tab-${tab.toLowerCase()}`);
  if (activeBtn) {
    activeBtn.classList.remove(
      "text-theme-text",
      "opacity-50",
      "border-theme-border",
    );
    activeBtn.classList.add("bg-theme-accent", "text-white", "shadow-md");
  }

  renderTable();
}

export function switchFilter(mode) {
  const slider = document.getElementById("filter-slider");
  const btnAll = document.getElementById("filter-all-main");
  const btnBinance = document.getElementById("filter-binance");
  const btnUpbit = document.getElementById("filter-upbit");

  const updateUI = (activeBtn, offset) => {
    [btnAll, btnBinance, btnUpbit].forEach((btn) => {
      if (btn) {
        btn.classList.remove("text-white", "font-black");
        btn.classList.add("text-theme-text", "opacity-50");
      }
    });
    if (activeBtn) {
      activeBtn.classList.remove("text-theme-text", "opacity-50");
      activeBtn.classList.add("text-white", "font-black");
    }
    if (slider) slider.style.left = offset;
  };

  if (mode === "ALL") {
    store.filterMode = "ALL";
    updateUI(btnAll, "4px");
  } else if (mode === "BINANCE") {
    store.filterMode = "BINANCE";
    updateUI(btnBinance, "calc(33.33% + 2px)");
  } else if (mode === "UPBIT") {
    store.filterMode = "UPBIT";
    updateUI(btnUpbit, "calc(66.66% + 1px)");
  } else {
    store.filterMode = mode;
    document.querySelectorAll(".filter-type-btn").forEach((btn) => {
      btn.classList.remove("bg-theme-accent", "text-white", "shadow-sm");
      btn.classList.add("text-theme-text", "opacity-50", "hover:opacity-100");
    });
    const activeBtn = document.getElementById(`filter-${mode.toLowerCase()}`);
    if (activeBtn) {
      activeBtn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "hover:opacity-100",
      );
      activeBtn.classList.add("bg-theme-accent", "text-white", "shadow-sm");
    }
  }

  store.currentRenderLimit = 1000;
  renderTable();
}

export function switchView(mode) {
  store.viewMode = mode;
  document.getElementById("view-detailed").className =
    mode === "detailed"
      ? "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all bg-theme-accent text-white shadow-sm"
      : "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all text-theme-text opacity-50 hover:opacity-100";
  document.getElementById("view-simple").className =
    mode === "simple"
      ? "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all bg-theme-accent text-white shadow-sm"
      : "view-btn px-3 py-1.5 text-[11px] font-bold rounded-md transition-all text-theme-text opacity-50 hover:opacity-100";

  renderTable();
}

export function toggleCurrency() {
  store.currencyMode = store.currencyMode === "USD" ? "KRW" : "USD";
  const btn = document.getElementById("currency-toggle");
  if (btn) {
    btn.innerText = store.currencyMode === "USD" ? "USD ($)" : "KRW (₩)";
  }
  renderTable();

  if (store.currentSelectedSymbol) {
    const allSource = store.originalTableData || store.currentTableData || [];
    const row = allSource.find(
      (r) =>
        r.DisplayTicker === store.currentSelectedSymbol ||
        r.Ticker === store.currentSelectedSymbol,
    );
    if (row && typeof window.updateHeaderDisplay === "function") {
      const p = store.getPrecision(store.currentSelectedSymbol);
      window.updateHeaderDisplay(row, undefined, p);
    }
  }
}

export function toggleLang() {
  store.lang = store.lang === "KR" ? "EN" : "KR";
  const btn = document.getElementById("lang-toggle");
  if (btn) btn.innerText = store.lang;
  renderTable();
}

export function toggleSmallCap() {
  store.hideSmallCap = !store.hideSmallCap;

  const btn = document.getElementById("btn-small-cap");
  if (btn) {
    if (store.hideSmallCap) {
      btn.classList.remove(
        "text-theme-text",
        "opacity-50",
        "border-theme-border",
      );
      btn.classList.add(
        "bg-theme-down",
        "text-white",
        "border-theme-down",
        "shadow-md",
        "opacity-100",
      );
      btn.innerText = "🚫 Hiding Mcap < 1M";
    } else {
      btn.classList.add("text-theme-text", "opacity-50", "border-theme-border");
      btn.classList.remove(
        "bg-theme-down",
        "text-white",
        "border-theme-down",
        "shadow-md",
        "opacity-100",
      );
      btn.innerText = "🚫 Hiding Mcap < 1M";
    }
  }

  store.currentRenderLimit = 1000;
  renderTable();
}

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
  modal.classList.remove("hidden");

  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    store.settings = data;
    const input = document.getElementById("setting-cmc-key");
    const btn = input.nextElementSibling;
    input.type = "text";
    input.value = maskApiKey(data.CMC_API_KEY || "");
    input.dataset.masked = "true";
    if (btn) btn.innerText = "🙈";
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

export function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
}

export async function saveSettings() {
  const input = document.getElementById("setting-cmc-key");
  let newKey = input.value.trim();

  if (newKey.includes("*") && store.settings) {
    newKey = store.settings.CMC_API_KEY || "";
  }

  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ CMC_API_KEY: newKey }),
    });

    if (res.ok) {
      alert("Settings saved successfully! Restarting data fetch...");
      closeSettingsModal();
      loadTableData(true);
    }
  } catch (e) {
    alert("Failed to save settings.");
  }
}

export function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  const btn = input.nextElementSibling;
  if (!store.settings) return;
  const raw = store.settings.CMC_API_KEY || "";

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
