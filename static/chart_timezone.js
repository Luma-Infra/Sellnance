// chart_timezone.js
// 🚀 전 세계 모든 시간대 (UTC-12 ~ UTC+14) 완벽 지원 & 트레이딩뷰 스타일 시간대 선택기 모듈
import { store } from "./_store.js";
import { getUnixSeconds } from "./chart_utils.js";

export const TIMEZONE_LIST = [
  { id: "UTC-12", offset: -720, label: "UTC-12", desc: "베이커 섬 (Baker Is.)" },
  { id: "UTC-11", offset: -660, label: "UTC-11", desc: "사모아, 니우에 (Samoa)" },
  { id: "UTC-10", offset: -600, label: "UTC-10", desc: "호놀룰루, 하와이 (Honolulu)" },
  { id: "UTC-9", offset: -540, label: "UTC-9", desc: "앵커리지, 알래스카 (Anchorage)" },
  { id: "UTC-8", offset: -480, label: "UTC-8", desc: "로스앤젤레스, 샌프란시스코 (PST)" },
  { id: "UTC-7", offset: -420, label: "UTC-7", desc: "덴버, 피닉스 (MST)" },
  { id: "UTC-6", offset: -360, label: "UTC-6", desc: "시카고, 멕시코시티 (CST)" },
  { id: "UTC-5", offset: -300, label: "UTC-5", desc: "뉴욕, 토론토 (EST)" },
  { id: "UTC-4", offset: -240, label: "UTC-4", desc: "산티아고, 카라카스 (CLT)" },
  { id: "UTC-3", offset: -180, label: "UTC-3", desc: "상파울루, 부에노스아이레스 (BRT)" },
  { id: "UTC-2", offset: -120, label: "UTC-2", desc: "대서양 중부 (Mid-Atlantic)" },
  { id: "UTC-1", offset: -60, label: "UTC-1", desc: "아소르스 제도, 카보베르데 (Azores)" },
  { id: "UTC+0", offset: 0, label: "UTC+0", desc: "런던, 더블린, 그리니치 (UTC/GMT)" },
  { id: "UTC+1", offset: 60, label: "UTC+1", desc: "파리, 베를린, 로마, 프랑크푸르트 (CET)" },
  { id: "UTC+2", offset: 120, label: "UTC+2", desc: "카이로, 아테네, 헬싱키 (EET)" },
  { id: "UTC+3", offset: 180, label: "UTC+3", desc: "모스크바, 리야드, 이스탄불 (MSK)" },
  { id: "UTC+3:30", offset: 210, label: "UTC+3:30", desc: "테헤란, 이란 (IRST)" },
  { id: "UTC+4", offset: 240, label: "UTC+4", desc: "두바이, 아부다비 (GST)" },
  { id: "UTC+4:30", offset: 270, label: "UTC+4:30", desc: "카불, 아프가니스탄 (AFT)" },
  { id: "UTC+5", offset: 300, label: "UTC+5", desc: "카라치, 타슈켄트 (PKT)" },
  { id: "UTC+5:30", offset: 330, label: "UTC+5:30", desc: "뉴델리, 뭄바이 (IST)" },
  { id: "UTC+5:45", offset: 345, label: "UTC+5:45", desc: "카트만두, 네팔 (NPT)" },
  { id: "UTC+6", offset: 360, label: "UTC+6", desc: "다카, 알마티 (BST)" },
  { id: "UTC+6:30", offset: 390, label: "UTC+6:30", desc: "양곤, 미얀마 (MMT)" },
  { id: "UTC+7", offset: 420, label: "UTC+7", desc: "방콕, 자카르타, 하노이 (ICT)" },
  { id: "UTC+8", offset: 480, label: "UTC+8", desc: "싱가포르, 홍콩, 베이징, 타이베이 (SGT/CST)" },
  { id: "UTC+9", offset: 540, label: "UTC+9", desc: "서울, 도쿄 (KST/JST)" },
  { id: "UTC+9:30", offset: 570, label: "UTC+9:30", desc: "애들레이드, 다윈 (ACST)" },
  { id: "UTC+10", offset: 600, label: "UTC+10", desc: "시드니, 브리즈번, 괌 (AEST)" },
  { id: "UTC+11", offset: 660, label: "UTC+11", desc: "솔로몬 제도, 누메아 (SBT)" },
  { id: "UTC+12", offset: 720, label: "UTC+12", desc: "오클랜드, 피지 (NZST)" },
  { id: "UTC+12:45", offset: 765, label: "UTC+12:45", desc: "채텀 제도 (CHAST)" },
  { id: "UTC+13", offset: 780, label: "UTC+13", desc: "통가, 아피아 (TOT)" },
  { id: "UTC+14", offset: 840, label: "UTC+14", desc: "키리바시 (LINT)" },
];

// 🚀 빠른 O(1) 탐색용 맵
const TZ_MAP = new Map(TIMEZONE_LIST.map((tz) => [tz.id, tz]));

/**
 * 저장된 타임존 가져오기 (기본값: UTC+9)
 */
export function getSavedTimezoneId() {
  try {
    const saved = localStorage.getItem("sellnance_chart_timezone");
    if (saved && TZ_MAP.has(saved)) {
      return saved;
    }
  } catch (e) { }
  return "UTC+9";
}

/**
 * 현재 활성화된 타임존 오프셋(분) 가져오기
 */
export function getCurrentTimezoneOffset() {
  const tzId = store.chartTimezone || getSavedTimezoneId();
  const tz = TZ_MAP.get(tzId);
  return tz ? tz.offset : 540; // 기본 +540분 (KST UTC+9)
}

/**
 * ⚡ [GC-Free] X축 하단 틱 마크 시간 포맷터
 */
export function formatChartTickMark(time, tickMarkType, tf) {
  const sec = getUnixSeconds(time);
  if (isNaN(sec) || sec <= 0) return "";

  const offsetMin = getCurrentTimezoneOffset();
  const d = new Date((sec + offsetMin * 60) * 1000);
  if (isNaN(d.getTime())) return "";

  // 🚀 연도 (0) 단위 스마트 표시
  if (tickMarkType === 0) return `${d.getUTCFullYear()}년`;

  const isDayUnit = !(tf || store.currentTF || "1h").match(/[hm]/);
  if (isDayUnit) {
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  } else {
    const h = String(d.getUTCHours()).padStart(2, "0");
    const m = String(d.getUTCMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}

/**
 * ⚡ [GC-Free] 십자선 호버 툴팁 날짜/시간 포맷터
 */
export function formatChartTime(tick, tf) {
  const sec = getUnixSeconds(tick);
  if (isNaN(sec) || sec <= 0) return "";

  const offsetMin = getCurrentTimezoneOffset();
  const d = new Date((sec + offsetMin * 60) * 1000);
  if (isNaN(d.getTime())) return "";

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const date = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");

  if ((tf || store.currentTF || "1h").match(/[hm]/)) {
    return `${y}-${m}-${date} ${h}:${min}`;
  } else {
    return `${y}-${m}-${date}`;
  }
}

/**
 * 🚀 차트에 타임존 포맷터 즉시 적용 (0ms 무부하 갱신)
 */
export function applyTimezoneToCharts() {
  const tickMarkFormatter = (time, tickMarkType) =>
    formatChartTickMark(time, tickMarkType, store.currentTF);

  const timeFormatter = (tick) =>
    formatChartTime(tick, store.currentTF);

  if (store.chart) {
    store.chart.applyOptions({
      timeScale: { tickMarkFormatter },
      localization: { timeFormatter },
    });
  }

  if (store.chartVol) {
    store.chartVol.applyOptions({
      timeScale: { tickMarkFormatter },
      localization: { timeFormatter },
    });
  }

  updateTimezoneButtonLabel();
}

/**
 * 타임존 변경 함수
 */
export function setChartTimezone(tzId) {
  if (!TZ_MAP.has(tzId)) return;
  store.chartTimezone = tzId;
  try {
    localStorage.setItem("sellnance_chart_timezone", tzId);
  } catch (e) { }

  applyTimezoneToCharts();
  closeTimezoneMenu();
}

// -------------------------------------------------------------
// 🎨 UI 렌더링: 우측 하단 스텁 전용 버튼 & 팝업 메뉴
// -------------------------------------------------------------

let tzMenuElement = null;

function updateTimezoneButtonLabel() {
  const tzId = store.chartTimezone || getSavedTimezoneId();
  const btns = document.querySelectorAll(".chart-tz-btn");
  btns.forEach((btn) => {
    btn.textContent = tzId;
    btn.title = `시간대 설정 (현재: ${tzId})`;
  });
}

function createTimezoneMenu() {
  if (tzMenuElement) return tzMenuElement;

  const menu = document.createElement("div");
  menu.id = "chart-tz-dropdown-menu";
  menu.className =
    "fixed z-[250] hidden flex-col w-[280px] max-w-[calc(100vw-20px)] max-h-[calc(100dvh-40px)] bg-theme-panel/95 backdrop-blur-md border border-theme-border/80 shadow-2xl rounded-xl overflow-hidden text-theme-text text-xs select-none transition-all duration-150 font-medium";

  menu.innerHTML = `
    <div class="p-2.5 border-b border-theme-border/40 flex items-center justify-between bg-theme-panel/80 shrink-0">
      <span class="font-bold text-[11px] text-theme-accent flex items-center gap-1.5">
        <span>🌐</span> 시간대 선택 (Timezone)
      </span>
      <button id="chart-tz-menu-close" class="text-theme-text opacity-60 hover:opacity-100 px-1 py-0.5 rounded cursor-pointer">✕</button>
    </div>
    <div class="p-2 border-b border-theme-border/30 shrink-0">
      <input id="chart-tz-search-input" type="text" placeholder="검색 (예: 서울, UTC, 뉴욕, +9)..." 
        class="w-full px-2.5 py-1.5 text-[11px] bg-theme-bg/80 border border-theme-border/50 rounded-lg text-theme-text placeholder:text-theme-text/40 focus:outline-none focus:border-theme-accent/60" />
    </div>
    <div id="chart-tz-items-container" class="flex-1 overflow-y-auto py-1 custom-scrollbar">
      <!-- 동적 리스트 렌더링 -->
    </div>
  `;

  document.body.appendChild(menu);
  tzMenuElement = menu;

  // 🚀 메뉴 내부 클릭/더블클릭이 차트 캔버스나 리사이저로 전파되는 것 원천 차단
  ["pointerdown", "mousedown", "touchstart", "dblclick"].forEach((evt) => {
    menu.addEventListener(evt, (e) => {
      e.stopPropagation();
    });
  });

  // 닫기 버튼
  menu.querySelector("#chart-tz-menu-close").addEventListener("click", closeTimezoneMenu);

  // 검색 인풋 필터
  const searchInput = menu.querySelector("#chart-tz-search-input");
  searchInput.addEventListener("input", (e) => {
    renderTimezoneItems(e.target.value.trim().toLowerCase());
  });

  // ESC 키로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !tzMenuElement.classList.contains("hidden")) {
      closeTimezoneMenu();
    }
  });

  // 바깥 클릭 시 닫기
  document.addEventListener("pointerdown", (e) => {
    if (
      !tzMenuElement.classList.contains("hidden") &&
      !tzMenuElement.contains(e.target) &&
      !e.target.closest(".chart-tz-btn")
    ) {
      closeTimezoneMenu();
    }
  });

  return menu;
}

function renderTimezoneItems(filterText = "") {
  const container = document.getElementById("chart-tz-items-container");
  if (!container) return;

  const currentId = store.chartTimezone || getSavedTimezoneId();
  container.innerHTML = "";

  const filtered = TIMEZONE_LIST.filter((tz) => {
    if (!filterText) return true;
    return (
      tz.id.toLowerCase().includes(filterText) ||
      tz.label.toLowerCase().includes(filterText) ||
      tz.desc.toLowerCase().includes(filterText)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-theme-text/50 text-[11px]">
        검색 결과가 없습니다.
      </div>
    `;
    return;
  }

  filtered.forEach((tz) => {
    const isSelected = tz.id === currentId;
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.tzId = tz.id;
    item.className = `w-full px-2.5 py-1.5 flex items-center justify-between text-left cursor-pointer transition-colors border-none text-[11px] ${isSelected
      ? "bg-theme-accent/20 text-theme-accent font-bold"
      : "bg-transparent text-theme-text/80 hover:bg-theme-border/30 hover:text-theme-text"
      }`;

    item.innerHTML = `
      <div class="flex flex-col min-w-0 pr-2">
        <div class="flex items-center gap-1.5">
          <span class="font-mono ${isSelected ? "text-theme-accent font-bold" : "text-theme-text"}">${tz.label}</span>
          ${tz.id === "UTC+9" ? '<span class="text-[9px] px-1 py-0.2 rounded bg-theme-accent/20 text-theme-accent font-mono font-normal">KST</span>' : ""}
          ${tz.id === "UTC+0" ? '<span class="text-[9px] px-1 py-0.2 rounded bg-theme-border/40 text-theme-text/70 font-mono font-normal">UTC</span>' : ""}
        </div>
        <span class="text-[10px] text-theme-text/50 truncate">${tz.desc}</span>
      </div>
      ${isSelected ? '<span class="text-theme-accent text-xs font-bold flex-shrink-0">✓</span>' : ""}
    `;

    item.addEventListener("click", () => {
      setChartTimezone(tz.id);
    });

    container.appendChild(item);
  });

  // 선택된 아이템으로 자동 스크롤
  if (!filterText) {
    const activeEl = container.querySelector(`[data-tz-id="${currentId}"]`);
    if (activeEl) {
      setTimeout(() => {
        activeEl.scrollIntoView({ block: "center", behavior: "auto" });
      }, 10);
    }
  }
}

export function openTimezoneMenu(anchorButton) {
  const menu = createTimezoneMenu();
  if (menu && !menu.classList.contains("hidden")) {
    closeTimezoneMenu();
    return;
  }
  const searchInput = menu.querySelector("#chart-tz-search-input");
  if (searchInput) searchInput.value = "";

  renderTimezoneItems();

  // 앵커 버튼 기준 위치 산출
  const rect = anchorButton.getBoundingClientRect();
  menu.classList.remove("hidden");
  menu.classList.add("flex");

  const menuWidth = Math.min(280, window.innerWidth - 16);
  const targetHeight = Math.min(520, window.innerHeight - 30);

  let left = rect.right - menuWidth;
  let top = rect.top - targetHeight - 6;

  // 화면 경계 방어: 위쪽 공간이 부족할 경우 아래로 또는 최적 위치로 조정
  if (top < 10) {
    top = Math.max(10, Math.min(rect.bottom + 6, window.innerHeight - targetHeight - 10));
  }
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.width = `${menuWidth}px`;
  menu.style.height = `${targetHeight}px`;

  if (searchInput) {
    setTimeout(() => searchInput.focus(), 50);
  }
}

export function closeTimezoneMenu() {
  if (tzMenuElement) {
    tzMenuElement.classList.add("hidden");
    tzMenuElement.classList.remove("flex");
  }
}

/**
 * 🚀 차트 우측 하단 스텁 코너에 타임존 버튼 마운트
 */
export function mountTimezoneButton() {
  const paneMain = document.getElementById("pane-main");
  const paneVol = document.getElementById("pane-vol");
  if (!paneMain) return;

  // 초기 상태 로드
  if (!store.chartTimezone) {
    store.chartTimezone = getSavedTimezoneId();
  }

  const isVolVisible =
    paneVol &&
    paneVol.style.display !== "none" &&
    (store.paneConfig?.volume || store.paneConfig?.kimchi);

  const containers = [
    { el: paneMain, id: "chart-tz-btn-main", shouldShow: !isVolVisible },
    { el: paneVol, id: "chart-tz-btn-vol", shouldShow: !!isVolVisible },
  ];

  containers.forEach(({ el, id, shouldShow }) => {
    if (!el) return;
    let btn = el.querySelector(`#${id}`);
    if (!btn) {
      btn = document.createElement("button");
      btn.id = id;
      btn.type = "button";
      btn.className =
        "chart-tz-btn absolute bottom-[4px] right-[4px] z-50 h-[22px] min-w-[54px] px-2.5 flex items-center justify-center font-medium text-[10px] font-bold rounded cursor-pointer select-none transition-all duration-150 bg-theme-panel/90 text-theme-text/80 hover:text-theme-accent hover:bg-theme-panel border border-theme-border/60 hover:border-theme-accent/50 shadow-sm tracking-tight";
      btn.textContent = store.chartTimezone || "UTC+9";
      btn.title = `시간대 설정 (현재: ${store.chartTimezone || "UTC+9"})`;

      ["pointerdown", "mousedown", "touchstart", "dblclick"].forEach((evt) => {
        btn.addEventListener(evt, (e) => e.stopPropagation());
      });

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTimezoneMenu(btn);
      });

      el.appendChild(btn);
    } else {
      btn.className =
        "chart-tz-btn absolute bottom-[4px] right-[4px] z-50 h-[22px] min-w-[54px] px-2.5 flex items-center justify-center font-medium text-[10px] font-bold rounded cursor-pointer select-none transition-all duration-150 bg-theme-panel/90 text-theme-text/80 hover:text-theme-accent hover:bg-theme-panel border border-theme-border/60 hover:border-theme-accent/50 shadow-sm tracking-tight";
      btn.textContent = store.chartTimezone || "UTC+9";
    }

    btn.style.display = shouldShow ? "flex" : "none";
  });

  updateTimezoneButtonLabel();
}

// 전역 윈도우 바인딩
if (typeof window !== "undefined") {
  window.setChartTimezone = setChartTimezone;
  window.mountTimezoneButton = mountTimezoneButton;
  window.applyTimezoneToCharts = applyTimezoneToCharts;
  window.formatChartTickMark = formatChartTickMark;
  window.formatChartTime = formatChartTime;
}
