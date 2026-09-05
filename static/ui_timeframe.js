// ui_timeframe.js
// ⏱️ [차트 타임프레임(주기) 및 스케일 제어 전담 모듈]
import { store } from "./_store.js";
import { fetchHistory } from "./chart_data.js";

export const timeframes = [
  { label: "1분", value: "1m" },
  { label: "3분", value: "3m" },
  { label: "5분", value: "5m" },
  { label: "15분", value: "15m" },
  { label: "30분", value: "30m" },
  { label: "1시간", value: "1h" },
  { label: "4시간", value: "4h" },
  { label: "12시간", value: "12h" },
  { label: "1D", value: "1d" },
  { label: "3D", value: "3d" },
  { label: "1W", value: "1w" },
  { label: "1달", value: "1M" },
];

export function getVisibleTfs() {
  try {
    const saved = localStorage.getItem("sellnance_tf_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((val) =>
          timeframes.some((tf) => tf.value === val),
        );
      }
    }
  } catch (e) { }
  return timeframes.map((t) => t.value);
}

export function saveVisibleTfs(arr) {
  localStorage.setItem("sellnance_tf_settings", JSON.stringify(arr));
  if (window.store) window.store.visibleTfs = arr;
}

export function renderTimeframeButtons(currentTF = "1d") {
  const container = document.getElementById("tf-container");
  if (!container) return;
  const existingButtons = container.querySelectorAll(".tf-btn");
  existingButtons.forEach((btn) => btn.remove());

  const visibleVals = getVisibleTfs();

  timeframes
    .slice()
    .reverse()
    .forEach((tf) => {
      if (!visibleVals.includes(tf.value)) return;
      const btn = document.createElement("button");
      const activeClass =
        tf.value === currentTF
          ? "active !opacity-100 border-theme-accent"
          : "border-transparent";
      btn.className = `tf-btn px-2.5 py-1 text-[11px] font-medium bg-transparent text-theme-text opacity-50 border rounded hover:bg-theme-border/50 hover:opacity-100 transition-all ${activeClass}`;
      btn.innerText = tf.label;
      btn.onclick = () => {
        setTF(tf.value);
        renderTimeframeButtons(tf.value);
      };

      container.prepend(btn);
    });

  if (typeof window.updateElementScrollMask === "function") {
    requestAnimationFrame(() => window.updateElementScrollMask(container));
  }
}

let pendingTfSettings = null;

export function syncChartControlsModalUI() {
  const updateBtn = (id, isActive, activeText, inactiveText) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const textSpan = btn.querySelector("span") || btn;
    if (activeText && inactiveText) {
      textSpan.innerText = isActive ? activeText : inactiveText;
    }
    if (isActive) {
      btn.className =
        "px-2 py-1.5 text-[11px] font-bold rounded border transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-theme-accent text-white border-theme-accent shadow-sm";
    } else {
      btn.className =
        "px-2 py-1.5 text-[11px] font-medium rounded border transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-theme-panel/50 text-theme-text opacity-50 border-theme-border/50 hover:opacity-100 hover:border-theme-border";
    }
  };

  const isOhlc = localStorage.getItem("sellnance_ohlc_hidden") !== "true";
  const isPct = store.showCrosshairPct !== false;
  const isCountdown = !!store.showCountdown;
  const isKimchi = !store.isKimchiDisabled;

  updateBtn("modal-ctrl-ohlc", isOhlc, "OHLC 정보 ON", "OHLC 정보 OFF");
  updateBtn("modal-ctrl-pct", isPct, "우측 % 켜짐", "우측 % 꺼짐");
  updateBtn("modal-ctrl-countdown", isCountdown, "카운트다운 ON", "카운트다운 OFF");
  updateBtn("modal-ctrl-kimchi", isKimchi, "김프 비교 ON", "김프 비교 OFF");
}

export function toggleTfSettings() {
  const dropdown = document.getElementById("tf-settings-dropdown");
  if (!dropdown) return;
  if (dropdown.classList.contains("hidden")) {
    pendingTfSettings = [...getVisibleTfs()];
    renderTfCheckboxList();
    syncChartControlsModalUI();
    dropdown.classList.remove("hidden");
    dropdown.classList.add("flex");
    void dropdown.offsetWidth;
    dropdown.classList.remove("opacity-0", "translate-y-[-10px]");
    dropdown.classList.add("opacity-100", "translate-y-0");
  } else {
    dropdown.classList.remove("opacity-100", "translate-y-0");
    dropdown.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => {
      dropdown.classList.remove("flex");
      dropdown.classList.add("hidden");
      pendingTfSettings = null;
    }, 200);
  }
}

export function renderTfCheckboxList() {
  const container = document.getElementById("tf-checkbox-container");
  if (!container) return;
  container.innerHTML = "";
  const visibleVals = pendingTfSettings || getVisibleTfs();

  timeframes.forEach((tf) => {
    const btn = document.createElement("button");
    const isChecked = visibleVals.includes(tf.value);

    btn.className = `px-2 py-1.5 text-[11px] font-bold rounded border transition-all cursor-pointer ${isChecked
      ? "bg-theme-accent text-white border-theme-accent shadow-sm"
      : "bg-theme-panel/50 text-theme-text opacity-50 border-theme-border/50 hover:opacity-100 hover:border-theme-border"
      }`;
    btn.innerText = tf.label;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newChecked = !visibleVals.includes(tf.value);
      if (newChecked) {
        pendingTfSettings.push(tf.value);
      } else {
        pendingTfSettings = pendingTfSettings.filter((v) => v !== tf.value);
      }
      if (pendingTfSettings.length === 0) pendingTfSettings = [tf.value];

      renderTfCheckboxList();
    });

    container.appendChild(btn);
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.className =
    "col-start-4 px-2 py-1.5 text-[11px] font-bold border border-theme-accent text-theme-accent hover:bg-theme-accent hover:text-white rounded transition-all shadow-sm flex items-center justify-center";
  confirmBtn.innerText = "확인";
  confirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.applyTfSettings) window.applyTfSettings();
  });
  container.appendChild(confirmBtn);
}

export function applyTfSettings() {
  if (pendingTfSettings && pendingTfSettings.length > 0) {
    saveVisibleTfs(pendingTfSettings);

    const activeBtn = document.querySelector("#tf-container .tf-btn.active");
    let curTf = "1d";
    if (activeBtn) {
      const match = timeframes.find((t) => t.label === activeBtn.innerText);
      if (match) curTf = match.value;
    }
    renderTimeframeButtons(curTf);
  }
  toggleTfSettings();
}

export function setTF(tf) {
  if (store.currentTF === tf) return;

  const btnSim = document.getElementById("tab-btn-sim");
  const isSimMode = btnSim ? btnSim.classList.contains("active") : false;

  if (isSimMode) {
    window.Swal.fire({
      title: "초기화 경고!",
      text: "타임프레임을 변경하면 현재 그려둔 가상 차트가 모두 날아갑니다. 바꿀까요?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--up)",
      cancelButtonColor: "var(--border)",
      confirmButtonText: "네, 변경할게요 🚀",
      cancelButtonText: "아니요, 취소",
      background: "var(--panel)",
      color: "var(--text)",
    }).then((result) => {
      if (result.isConfirmed) executeSetTF(tf);
    });
  } else {
    executeSetTF(tf);
  }
}

export function executeSetTF(tf) {
  store.currentTF = tf;
  try {
    localStorage.setItem("sellnance_last_tf", tf);
  } catch (e) { }
  document.querySelectorAll(".tf-btn").forEach((b) => {
    const onClickAttr = b.getAttribute("onclick") || "";
    const isMatch = onClickAttr.includes(`'${tf}'`);

    b.classList.toggle("active", isMatch);
    b.classList.toggle("opacity-100", isMatch);
    b.classList.toggle("opacity-50", !isMatch);
  });

  if (typeof window.renderTimeframeButtons === "function") {
    window.renderTimeframeButtons(tf);
  }

  if (typeof fetchHistory === "function")
    fetchHistory(store.currentAsset, true);
}

export function toggleLogScale(forceVal) {
  if (forceVal !== undefined) {
    store.isLogMode = forceVal;
  } else {
    store.isLogMode = !store.isLogMode;
  }
  if (store.chart) {
    store.chart
      .priceScale("right")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
  }
  const btn = document.getElementById("toggle-log-scale-btn");
  if (btn) {
    btn.innerText = store.isLogMode ? "Log 축" : "Linear 축";
    if (!store.isLogMode) {
      btn.classList.add(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.remove("bg-theme-panel/50");
    } else {
      btn.classList.remove(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.add("bg-theme-panel/50");
    }
  }

  const overlayLBtn = document.getElementById("main-scale-l-btn");
  const overlayVolLBtn = document.getElementById("vol-scale-l-btn");

  if (store.chartVol) {
    store.chartVol
      .priceScale("right")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
    store.chartVol
      .priceScale("left")
      .applyOptions({ mode: store.isLogMode ? 1 : 0 });
  }

  const isLog = store.isLogMode;
  if (overlayLBtn) {
    if (isLog) {
      overlayLBtn.classList.add(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "font-bold",
      );
      overlayLBtn.classList.remove(
        "bg-theme-border/20",
        "text-theme-text",
        "border-theme-border/30",
      );
    } else {
      overlayLBtn.classList.remove(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "font-bold",
      );
      overlayLBtn.classList.add(
        "bg-theme-border/20",
        "text-theme-text",
        "border-theme-border/30",
      );
    }
  }

  if (overlayVolLBtn) {
    if (isLog) {
      overlayVolLBtn.classList.add(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "font-bold",
      );
      overlayVolLBtn.classList.remove(
        "bg-theme-border/20",
        "text-theme-text",
        "border-theme-border/30",
      );
    } else {
      overlayVolLBtn.classList.remove(
        "bg-theme-accent",
        "text-white",
        "border-theme-accent",
        "font-bold",
      );
      overlayVolLBtn.classList.add(
        "bg-theme-border/20",
        "text-theme-text",
        "border-theme-border/30",
      );
    }
  }
}

// 🚀 전역 노출
window.setTF = setTF;
window.executeSetTF = executeSetTF;
window.toggleLogScale = toggleLogScale;
window.renderTimeframeButtons = renderTimeframeButtons;
window.toggleTfSettings = toggleTfSettings;
window.applyTfSettings = applyTfSettings;
window.syncChartControlsModalUI = syncChartControlsModalUI;

function handleOutsideTfClick(e) {
  const dropdown = document.getElementById("tf-settings-dropdown");
  if (!dropdown || dropdown.classList.contains("hidden")) return;

  const btn =
    document.getElementById("tf-settings-toggle-btn") ||
    (e.target.closest && e.target.closest("button[onclick*='toggleTfSettings']"));

  if (btn && (btn === e.target || btn.contains(e.target))) return;
  if (!dropdown.contains(e.target)) {
    toggleTfSettings();
  }
}

document.addEventListener("pointerdown", handleOutsideTfClick, true);
document.addEventListener("touchstart", handleOutsideTfClick, { capture: true, passive: true });
document.addEventListener("click", handleOutsideTfClick, true);
