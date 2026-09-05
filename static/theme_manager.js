// theme_manager.js
// 🎨 [스타일 & 컬러 테마 전담 지휘소]
// - 배경 테마 (라이트: theme-upbit ↔ 다크: theme-binance)
// - 상승/하락 컬러 모드 (한국식 빨/파 ↔ 글로벌식 초/빨)
// - 캔들, 거래량, 테이블(24h/Day 등락률, 김프), 호가창, 경주마 플래시까지 전역 CSS 변수 일괄 제어

import { store } from "./_store.js";
import { updateChartTheme } from "./chart.js";

let isThemeToggling = false; // 연타 방지 플래그

/**
 * 🚀 CSS 변수에서 차트 캔들 전용 상승/하락 색상 읽기
 */
export function getCandleThemeColors() {
  const style = getComputedStyle(document.body);
  const up =
    style.getPropertyValue("--candle-up").trim() ||
    style.getPropertyValue("--up").trim() ||
    "#26a69a";
  const down =
    style.getPropertyValue("--candle-down").trim() ||
    style.getPropertyValue("--down").trim() ||
    "#ef5350";
  return { up, down };
}

function getCandleSvgIcon(upColor, downColor) {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="pointer-events-none">
    <line x1="4.5" y1="1.5" x2="4.5" y2="12.5" stroke="${upColor}" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="2.5" y="3.5" width="4" height="6.5" rx="0.75" fill="${upColor}"/>
    <line x1="11.5" y1="3.5" x2="11.5" y2="14.5" stroke="${downColor}" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="9.5" y="6" width="4" height="6.5" rx="0.75" fill="${downColor}"/>
  </svg>`;
}

/**
 * 🚀 차트 캔들 테마 토글 버튼 아이콘/타이틀 UI 갱신
 */
export function updateCandleThemeButtons() {
  const currentMode =
    store.candleTheme ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("sellnance_candle_theme")) ||
    "kr";
  const btn = document.getElementById("candle-theme-btn");
  const icon = document.getElementById("candle-theme-icon");
  if (!btn || !icon) return;

  if (currentMode === "kr") {
    icon.innerHTML = getCandleSvgIcon("#f7525f", "#3179f5");
    btn.title = "차트 캔들 업비트";
  } else {
    icon.innerHTML = getCandleSvgIcon("#26a69a", "#ef5350");
    btn.title = "차트 캔들 바이낸스";
  }
}

/**
 * 🚀 캔들 및 전역 텍스트/경주마 상승하락 컬러 모드 적용 (KR vs GLOBAL)
 */
export function applyCandleTheme(theme) {
  if (theme) {
    store.candleTheme = theme;
    try {
      localStorage.setItem("sellnance_candle_theme", theme);
    } catch (e) { }
  } else {
    store.candleTheme =
      store.candleTheme ||
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("sellnance_candle_theme")) ||
      "kr";
  }

  // 1. 전역 CSS data-color-mode 주입 → CSS 변수(--up, --down, --candle-up, --flash-up 등) 즉시 0ms 전환!
  //    (이를 통해 캔들뿐 아니라 24h 변동률, 김프 %, 호가창, 경주마 플래시까지 일괄 연동)
  document.documentElement.setAttribute("data-color-mode", store.candleTheme);
  document.body.setAttribute("data-color-mode", store.candleTheme);

  // 2. CSS 변수에서 최신 색상 추출
  const { up, down } = getCandleThemeColors();
  store.upColorCache = up;
  store.downColorCache = down;

  // 3. 메인 차트 캔들 시리즈 업데이트
  if (store.candleSeries) {
    store.candleSeries.applyOptions({
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
  }

  // 4. 가상 시뮬레이터 프리뷰 시리즈 업데이트
  if (store.previewSeries) {
    store.previewSeries.applyOptions({
      upColor: up + "4D",
      downColor: down + "4D",
    });
  }

  // 5. 볼륨 시리즈 동기화
  if (store.volumeSeries && store.volumeData && store.mainData) {
    const upColorVol = up + "80";
    const downColorVol = down + "80";

    store.volumeSeries.applyOptions({ color: upColorVol });

    store.volumeData.forEach((volItem, index) => {
      const candle = store.mainData[index];
      if (candle) {
        volItem.color = candle.close >= candle.open ? upColorVol : downColorVol;
      }
    });

    const _idleFn = () => {
      if (!store.volumeSeries || !store.volumeData) return;
      const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);
      const mapTime = (d) => {
        if (isDayUnit) {
          if (typeof d.time === "string" && d.time.includes("-")) return d;
          const numTime = Number(d.time);
          if (isNaN(numTime)) return d;
          const dt = new Date(numTime * 1000);
          return {
            ...d,
            time: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
          };
        } else {
          if (typeof d.time === "string" && d.time.includes("-")) {
            const parsedUnix = Math.floor(new Date(d.time).getTime() / 1000);
            return { ...d, time: isNaN(parsedUnix) ? d.time : parsedUnix };
          }
          return d;
        }
      };
      try {
        const mappedVol = store.volumeData.map(mapTime);
        store.volumeSeries.setData(
          window.sanitizeChartData
            ? window.sanitizeChartData(mappedVol, true)
            : mappedVol,
        );
      } catch (volThemeErr) { }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(_idleFn, { timeout: 500 });
    } else {
      setTimeout(_idleFn, 0);
    }
  }

  // 6. 버튼 UI 갱신
  updateCandleThemeButtons();

  // 7. 시뮬레이터 콩나물 대가리 색상 즉시 동기화
  if (typeof window.changeDir === "function" && store.curDir) {
    window.changeDir(store.curDir);
  }

  // 8. 🚀 퀵뷰(QuickView) 캔들 차트 색상 실시간 동기화
  if (typeof window.updateQuickViewTheme === "function") {
    window.updateQuickViewTheme();
  }
}

/**
 * 🚀 캔들/텍스트 컬러 모드 토글 (한국식 ↔ 글로벌식)
 */
export function toggleCandleTheme() {
  const currentMode =
    store.candleTheme ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("sellnance_candle_theme")) ||
    "kr";
  const newMode = currentMode === "kr" ? "global" : "kr";
  applyCandleTheme(newMode);
}

/**
 * 🚀 배경 테마 토글 (라이트 ↔ 다크)
 */
export function toggleTheme() {
  if (isThemeToggling) return;

  const THEME_MS =
    parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-transition-ms")
        .trim(),
    ) || 0;

  isThemeToggling = true;
  setTimeout(() => {
    isThemeToggling = false;
  }, THEME_MS > 0 ? THEME_MS + 20 : 100);

  const html = document.documentElement;
  const body = document.body;
  const isCurrentlyDark =
    body.classList.contains("theme-binance") ||
    html.classList.contains("theme-binance");
  const faviconLink = document.getElementById("favicon-link");
  const mainLogoImg = document.getElementById("main-logo-img");
  const staticPath = "../static/";

  // 🚀 [0초 즉각 전환 및 트랜지션 강제 오버라이드]
  // HTML 태그들의 Tailwind 기본 duration-300을 calc(var(--theme-transition-ms) * 1ms) !important 로 0초 강제 제압
  html.classList.add("theme-transitioning");
  setTimeout(() => {
    html.classList.remove("theme-transitioning");
  }, THEME_MS > 0 ? THEME_MS : 50);

  const updateThemeButtons = (emoji) => {
    document
      .querySelectorAll("#theme-toggle-btn, #start-theme-toggle-btn")
      .forEach((b) => {
        b.innerHTML = emoji;
      });
  };

  if (isCurrentlyDark) {
    body.classList.remove("theme-binance");
    body.classList.add("theme-upbit");
    html.classList.remove("theme-binance");
    html.classList.add("theme-upbit");
    store.currentTheme = "upbit";
    updateThemeButtons("🌙");
    if (faviconLink) faviconLink.href = staticPath + "luma-deer-svg-light.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "luma-deer-svg-light.svg";
  } else {
    body.classList.remove("theme-upbit");
    body.classList.add("theme-binance");
    html.classList.remove("theme-upbit");
    html.classList.add("theme-binance");
    store.currentTheme = "binance";
    updateThemeButtons("☀️");
    if (faviconLink) faviconLink.href = staticPath + "luma-deer-svg-dark.svg";
    if (mainLogoImg) mainLogoImg.src = staticPath + "luma-deer-svg-dark.svg";
  }

  // 🚀 캔들, 볼륨(vol), 프리뷰 차트 색상 일괄 동기화
  applyCandleTheme(store.candleTheme || "kr");

  // 🚀 [딜레이 제거] 차트 그리드선/경계선/배경색을 RAF로 미루지 않고 동기적으로 즉시 실행하여 0초 동시 전환
  updateChartTheme();

  localStorage.setItem("sellnance_theme", store.currentTheme);

  // 무거운 이미지 DOM 교체만 다음 프레임에 비동기 처리
  requestAnimationFrame(() => {
    const targetSvg =
      store.currentTheme === "upbit"
        ? "luma-deer-svg-light.svg"
        : "luma-deer-svg-dark.svg";
    const fallbackSrc = "/static/" + targetSvg;

    document
      .querySelectorAll('img[src*="luma-deer-svg"]:not(#onboarding-modal img), img.fallback-logo')
      .forEach((img) => {
        img.src = fallbackSrc;
        img.classList.add("fallback-logo");
      });
  });
}

/**
 * 🚀 초기 테마 설정 일괄 복원
 */
export function restoreThemeSettings() {
  try {
    // 1. 라이트/다크 테마 복원
    const savedTheme = localStorage.getItem("sellnance_theme") || "binance";
    const isUpbit = savedTheme === "upbit";
    const body = document.body;
    const html = document.documentElement;

    if (isUpbit) {
      body.classList.remove("theme-binance");
      body.classList.add("theme-upbit");
      html.classList.remove("theme-binance");
      html.classList.add("theme-upbit");
      store.currentTheme = "upbit";
      const btn = document.getElementById("theme-toggle-btn");
      if (btn) btn.innerHTML = "🌙";
    } else {
      body.classList.remove("theme-upbit");
      body.classList.add("theme-binance");
      html.classList.remove("theme-upbit");
      html.classList.add("theme-binance");
      store.currentTheme = "binance";
      const btn = document.getElementById("theme-toggle-btn");
      if (btn) btn.innerHTML = "☀️";
    }

    // 2. 캔들/텍스트 컬러 모드 복원
    const savedColorMode = localStorage.getItem("sellnance_candle_theme") || "kr";
    applyCandleTheme(savedColorMode);
  } catch (e) { }
}

// 🚀 전역 window 노출
window.toggleTheme = toggleTheme;
window.toggleCandleTheme = toggleCandleTheme;
window.updateCandleThemeButtons = updateCandleThemeButtons;
window.applyCandleTheme = applyCandleTheme;
window.getCandleThemeColors = getCandleThemeColors;
