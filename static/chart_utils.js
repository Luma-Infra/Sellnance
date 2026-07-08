// chart_utils.js
import { store, tfSec, CONFIG } from "./_store.js";

// ⚙️ 시간 변환 통합 헬퍼
export const getUnixSeconds = (t) => {
  if (typeof t === "object" && t !== null) {
    // 🚀 [UTC 고정] t.year, t.month, t.day를 절대적인 UTC 0시로 변환
    return Date.UTC(t.year, t.month - 1, t.day) / 1000;
  }
  if (typeof t === "string") {
    // 🚀 [UTC 고정] 문자열 뒤에 Z를 붙이거나 T00:00:00Z를 강제하여 UTC로 파싱
    if (!t.includes("T") && !t.includes("Z")) {
      return Date.parse(t + "T00:00:00Z") / 1000;
    }
    return Date.parse(t) / 1000;
  }
  return t; // 이미 숫자(타임스탬프)인 경우 그대로 반환
};
window.getUnixSeconds = getUnixSeconds;

export const ensureSafeUnixSeconds = (t) => {
  try {
    if (t === null || t === undefined) return 0;
    const sec = getUnixSeconds(t);
    if (isNaN(sec) || typeof sec !== "number") return 0;
    return sec;
  } catch (e) {
    console.warn("Time parsing warning in ensureSafeUnixSeconds:", t, e);
    return 0;
  }
};
window.ensureSafeUnixSeconds = ensureSafeUnixSeconds;

function resetChartScale() {
  if (!store.chart || !store.candleSeries) return;

  store.chart.priceScale("right").applyOptions({ autoScale: true });

  const margin = 10; // 🚀 [수동 오토핏 버튼] 우측 마진 고정값 10으로 강제 세팅

  try {
    const timeScale = store.chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (range && store.mainData && store.mainData.length) {
      const len = store.mainData.length;
      const width = range.to - range.from;
      timeScale.setVisibleLogicalRange({
        from: len - 1 - width + margin,
        to: len - 1 + margin,
      });
    } else {
      timeScale.scrollToRealtime();
    }
  } catch (e) {
    try { store.chart.timeScale().scrollToRealtime(); } catch (err) { }
  }

  if (store.chartVol) {
    store.chartVol.priceScale("right").applyOptions({ minimumWidth: 0, autoScale: true });
    store.chartVol.priceScale("left").applyOptions({ minimumWidth: 0, autoScale: true });

    try {
      const timeScaleVol = store.chartVol.timeScale();
      const rangeVol = timeScaleVol.getVisibleLogicalRange();
      if (rangeVol && store.mainData && store.mainData.length) {
        const len = store.mainData.length;
        const width = rangeVol.to - rangeVol.from;
        timeScaleVol.setVisibleLogicalRange({
          from: len - 1 - width + margin,
          to: len - 1 + margin,
        });
      } else {
        timeScaleVol.scrollToRealtime();
      }
    } catch (e) {
      try { store.chartVol.timeScale().scrollToRealtime(); } catch (err) { }
    }
  }

  setTimeout(() => {
    if (typeof window.syncPriceScaleWidths === "function") {
      window.syncPriceScaleWidths(true);
    }
  }, 150);
}

// ✅ 포맷팅 by precision (원화 가격과 달러 가격 분리 규칙 적용)
export function formatSmartPrice(price, p, isKrw = false) {
  try {
    if (price === 0) return "0";
    if (!price || isNaN(price)) return "";

    const numPrice = parseFloat(price);

    // 1️⃣ 원화(KRW) 가격 규칙: 실제 원화 가격 또는 추정된 원화 가격
    if (isKrw) {
      // 100원 이상: 소수점 없이 정수 콤마 표기
      if (numPrice >= 100) {
        return Math.round(numPrice).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }

      // 100원 미만 원화: 무조건 유효숫자 출몰부터 3개만 표기 (예: 1.22, 0.123, 0.000123)
      const formattedStr = numPrice.toPrecision(3);
      const parts = formattedStr.split("e");
      if (parts.length === 1) {
        const dotIndex = formattedStr.indexOf(".");
        let decimals = 0;
        if (dotIndex !== -1) {
          const sub = formattedStr.substring(dotIndex + 1);
          const firstActive = sub.search(/[1-9]/);
          decimals = firstActive !== -1 ? firstActive + 3 : 3;
        }
        return numPrice.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      } else {
        const exp = Math.abs(parseInt(parts[1], 10));
        const decimals = exp + 2; // e-N 일 때 유효숫자 3개를 위해 N+2 소수 자릿수가 필요함
        return numPrice.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      }
    }

    // 2️⃣ 달러(USD) 가격 규칙: 무조건 내려주는 precision에만 의존
    const decimals = p !== undefined && p !== null ? Math.max(0, parseInt(p, 10)) : 2;
    return numPrice.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } catch (error) {
    console.error("❌ formatSmartPrice 에러:", error.message);
    return String(price || "");
  }
}

// 🚀 크로스헤어 전용 가격표 포맷팅 (플마 퍼센트 및 가격차이 표시)
export function formatCrosshairPrice(price, p, isLeftScale = false) {
  if (!isLeftScale) {
    return formatSmartPrice(price, p);
  }
  // 좌측 스케일: showCrosshairPct 플래그가 켜진 경우에만 퍼센트 표시
  // (DrawingPriceAxisView.visible()이 제어하므로 여기서는 항상 비워둠)
  return ""; // 좌측 스케일 등락률 크로스헤어 라벨 완전히 비활성화
}
window.formatCrosshairPrice = formatCrosshairPrice;

// 🚀 달러/원화 거래대금 포맷팅 (실시간 소켓용)
export function formatVolumeDollar(vol) {
  if (!vol || isNaN(vol)) return "0";
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(2) + " B";
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(2) + " M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(2) + " K";
  return vol.toFixed(2);
}

export function formatVolumeKRW(vol) {
  if (!vol || isNaN(vol)) return "0";
  if (vol >= 100_000_000) return (vol / 100_000_000).toFixed(0) + "억";
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(0) + "백만";
  if (vol >= 1_000) return (vol / 1_000).toFixed(0) + "천";
  return vol.toFixed(0);
}

function updateLegend(d, v, k) {
  // 🚀 [디버그 옵션] 우측 패널 DOM 차단 또는 레전드 개별 차단 시 범인 추적용 즉시 리턴
  if (store.blockRightDom || store.blockLegend) {
    const nowTime = Date.now();
    if (!window._lastLegendUpdateTime) window._lastLegendUpdateTime = 0;
    if (nowTime - window._lastLegendUpdateTime < 100) {
      return;
    }
    window._lastLegendUpdateTime = nowTime;
  }

  const leg = document.getElementById("ohlc-legend");
  if (!leg) return;

  const placeholder = document.getElementById("ohlc-placeholder");
  const valuesContainer = document.getElementById("ohlc-values");

  if (!d) {
    if (placeholder) placeholder.classList.remove("hidden");
    if (valuesContainer) valuesContainer.classList.add("hidden");
    return;
  }

  if (placeholder) placeholder.classList.add("hidden");
  if (valuesContainer) valuesContainer.classList.remove("hidden");

  // 🚀 [수정] 단일 진실 공급원(Single Source of Truth)인 store.getPrecision 사용! (O(1) 초광속 참조)
  let p = store.getPrecision(store.currentAsset);
  if (store.currencyMode === "KRW" && typeof window.getKrwPrecision === "function") {
    p = window.getKrwPrecision(d.close);
  }

  // 🚀 0일 때를 위한 삼항 연산자 (보합색 추가)
  const cls =
    d.close > d.open
      ? "text-theme-up"
      : d.close < d.open
        ? "text-theme-down"
        : "text-theme-text opacity-70";
  const chg = d.close - d.open;

  // 🚀 저가~고가 진폭(Range) 및 진폭 백분율 계산
  const range = d.high - d.low;
  const rangePercent =
    d.open && d.open !== 0 ? ((range / d.open) * 100).toFixed(2) : "0.00";

  // 🚀 분모 0 방지 및 chg가 0일 때 직접 처리
  const chgPercent =
    d.open && d.open !== 0 ? ((chg / d.open) * 100).toFixed(2) : "0.00";
  const sign = chg >= 0 ? "+" : "";

  // 🚀 formatSmartPrice에 0이 들어가도 안 죽게 안전하게 호출
  const safeFormat = (val, precision) => {
    if (val === 0) return (0).toFixed(precision); // 0이면 그냥 0.00... 출력
    return formatSmartPrice(val, precision);
  };

  // 🚀 값 및 클래스 업데이트
  const openEl = document.getElementById("ohlc-open");
  const highEl = document.getElementById("ohlc-high");
  const lowEl = document.getElementById("ohlc-low");
  const closeEl = document.getElementById("ohlc-close");
  const chgEl = document.getElementById("ohlc-change");
  const rangeEl = document.getElementById("ohlc-range");

  const priceCls = `font-medium ${cls}`;
  if (openEl) {
    openEl.innerText = safeFormat(d.open, p);
    openEl.className = priceCls;
  }
  if (highEl) {
    highEl.innerText = safeFormat(d.high, p);
    highEl.className = priceCls;
  }
  if (lowEl) {
    lowEl.innerText = safeFormat(d.low, p);
    lowEl.className = priceCls;
  }
  if (closeEl) {
    closeEl.innerText = safeFormat(d.close, p);
    closeEl.className = priceCls;
  }
  if (rangeEl) {
    // innerHTML 대신 innerText 사용 (클래스 유지) , 절대값 표기 제외하고 퍼센트만 표기
    rangeEl.innerText = `${rangePercent}%`;
  }
  if (chgEl) {
    // 절대값 표기 제외하고 퍼센트만 표기
    chgEl.innerHTML = `<span>${sign}${chgPercent}%</span>`;
    chgEl.className = `font-medium block leading-normal ${cls}`;
  }

  // 🚀 볼륨 전광판 포맷팅 및 색상 적용
  const volContainer = document.getElementById("ohlc-vol-container");
  if (store.paneConfig.volume) {
    let volValue = "-";
    let volColor = "text-theme-text";
    const rawVol =
      d && d.volume !== undefined
        ? d.volume
        : v && v.value !== undefined
          ? v.value
          : null;
    if (rawVol !== null) {
      if (
        store.currencyMode === "KRW" &&
        typeof window.formatVolumeKRW === "function"
      ) {
        const rate = store.marketDataMap?.krw_usd_rate || 1;
        const volToFormat =
          store.currentMarket === "BINANCE" ? rawVol * rate : rawVol;
        volValue = window.formatVolumeKRW(volToFormat);
      } else {
        volValue = window.formatVolumeDollar
          ? window.formatVolumeDollar(rawVol)
          : rawVol.toLocaleString();
      }
      volColor = cls;
    }
    if (volContainer) volContainer.classList.remove("hidden");
    const volEl = document.getElementById("ohlc-volume");
    if (volEl) {
      volEl.innerText = volValue;
      volEl.className = `font-medium ${volColor}`;
    }
  } else {
    if (volContainer) volContainer.classList.add("hidden");
  }

  // 🚀 김프 전광판 포맷팅 및 다이내믹 색상 적용
  const kimchiContainer = document.getElementById("ohlc-kimchi-container");
  if (store.paneConfig.kimchi) {
    // 🚀 [분리 락킹] 마우스가 과거의 역사적인 봉을 호버 중일 때만 해당 과거 시점(k)의 김프를 보여주고,
    // 마우스가 우측 여백(최신 시점)에 있거나 벗어난 실시간 상태일 때는 항상 최신 실시간 김프를 보여줍니다!
    const isLatest = store.mainData && store.mainData.length > 0 && d && d.time === store.mainData[store.mainData.length - 1].time;
    const targetKim = (store.isCrosshairActive && !isLatest)
      ? k
      : (store.realtimeKimchi || k || (store.kimchiData && store.kimchiData.length > 0 ? store.kimchiData[store.kimchiData.length - 1] : null));

    let kimValue = "-";
    let kimColorStyle = "";
    if (targetKim && targetKim.value !== undefined) {
      kimValue = (targetKim.value > 0 ? "+" : "") + targetKim.value.toFixed(2) + "%";
      kimColorStyle = targetKim.color || "#57a4fc";
    }
    if (kimchiContainer) kimchiContainer.classList.remove("hidden");

    // 항상 안전하게 김프 범례를 갱신합니다.
    const kimchiEl = document.getElementById("ohlc-kimchi");
    if (kimchiEl) {
      kimchiEl.innerText = kimValue;
      kimchiEl.style.color = kimColorStyle;
    }

    // 🚀 범례 및 김프 업데이트 추적기 (callerId)
    const ohlcCallerEl = document.getElementById("ohlc-caller-id");
    const kimchiCallerEl = document.getElementById("ohlc-kimchi-caller");

    let callerId = "UNKNOWN";
    if (store.traceRowCaller) {
      const stack = new Error().stack || "";
      if (store.isCrosshairActive === true) {
        callerId = "2 (Chart)"; // 🚀 마우스 크로스헤어 이동 시는 무조건 Chart
      } else if (stack.includes("stream") || stack.includes("updateStatus")) {
        callerId = "1 (Stream)";
      } else if (stack.includes("chart_utils.js") || stack.includes("chart.js") || stack.includes("chart_data.js")) {
        callerId = "2 (Chart)";
      } else if (
        stack.includes("ui_control") ||
        stack.includes("table_filter") ||
        stack.includes("main")
      ) {
        callerId = "3 (UI/Filter)";
      }
    } else if (store.isCrosshairActive === true) {
      callerId = "2 (Chart)";
    }

    if (ohlcCallerEl) ohlcCallerEl.innerText = `[${callerId}]`;
    if (kimchiCallerEl) kimchiCallerEl.innerText = ` [${callerId}]`;

    // 🚀 [디버그 동적 전파] 무조건 첫번째 행(index 0)에 있는 디버그 영역에도 함께 기록해줍니다.
    const firstRowDebug = document.querySelector('#coin-list-body > div[data-index="0"] .first-row-debug-area');
    if (firstRowDebug) {
      const ohlcDebug = firstRowDebug.querySelector(".debug-ohlc-caller");
      const kimchiDebug = firstRowDebug.querySelector(".debug-kimchi-caller");
      if (ohlcDebug) ohlcDebug.innerText = `OHLC: ${callerId}`;
      if (kimchiDebug) kimchiDebug.innerText = `KIMP: ${callerId}`;
    }
  } else {
    if (kimchiContainer) kimchiContainer.classList.add("hidden");
  }
}

function updateStatus(d, p) {
  // 🚀 [디버그 옵션] 우측 패널 DOM 차단 또는 레전드 개별 차단 시 범인 추적용 즉시 리턴
  if (store.blockRightDom || store.blockLegend) {
    const nowTime = Date.now();
    if (!window._lastStatusUpdateTime) window._lastStatusUpdateTime = 0;
    if (nowTime - window._lastStatusUpdateTime < 100) {
      return;
    }
    window._lastStatusUpdateTime = nowTime;
  }

  // 🚀 핵심: d(실시간 데이터)가 들어오면 그걸 최우선으로 쓴다!
  // d가 없으면(마우스 이벤트 등) 그때만 mainData에서 꺼내온다.
  const last =
    d ||
    (store.mainData.length ? store.mainData[store.mainData.length - 1] : null);

  if (!last) return;

  // 🚀 [수정] 정밀도(p)가 있으면 사용하고, 없으면 단일 진실 공급원인 store.getPrecision에서 가져옴!
  const precision =
    p !== undefined ? p : store.getPrecision(store.currentAsset);

  // 가격 업데이트
  const asset = store.currentAsset || store.currentSelectedSymbol;
  const allSource = store.currentTableData || store.originalTableData || [];
  const row = store.tickerRowMap.get(asset) || allSource.find(
    (r) =>
      r.DisplayTicker === asset || r.Ticker === asset || r.Symbol === asset,
  );
  if (row && typeof window.updateHeaderDisplay === "function") {
    const btnSim = document.getElementById("tab-btn-sim");
    const isSimMode = btnSim ? btnSim.classList.contains("active") : false;
    // 🚀 [수정] 실시간 aggTrade 틱(d)이 있거나 시뮬레이터 모드일 때만 실시간 전광판 갱신을 허용하여,
    // 초기 로드 시 느린 역사 데이터 종가가 전광판 가격을 덮어쓰지 않도록 차단합니다.
    if (d || isSimMode) {
      window.updateHeaderDisplay(row, last.close, precision);
    }
  }

  // 거래량 업데이트
  // (이제 헤더의 거래량은 24시간 기준으로 api.js에서 고정 관리하므로 제거합니다)
  // const volEl = document.getElementById("head-volume");
  // if (volEl) {
  //   volEl.innerText = last.volume ? last.volume.toLocaleString() : "-";
  // }

  // 시뮬레이터 타겟 & 레전드 동시 갱신
  const targetEl = document.getElementById("head-target");
  if (targetEl && typeof getNext === "function") {
    targetEl.innerText = formatSmartPrice(getNext().close);
    targetEl.style.color =
      store.curDir === "bull" ? "var(--up)" : "var(--down)";
  }

  // 🚀 대망의 레전드 업데이트 (십자선 활성화 중일 때는 덮어쓰기 방어!)
  if (!store.isCrosshairActive) {
    const lastIdx = store.mainData.length ? store.mainData.length - 1 : -1;
    const v =
      store.volumeData && store.volumeData.length > 0
        ? store.volumeData[lastIdx]
        : null;

    let k = null;
    if (lastIdx !== -1) {
      const matchTime = last.time;
      if (matchTime) {
        k = store.kimchiDataMap.get(getUnixSeconds(matchTime)) || null;
      }
      if (!k && store.kimchiData && store.kimchiData.length > 0) {
        k = store.kimchiData[lastIdx];
      }
    }

    updateLegend(last, v, k);
  }

  // 🚀 실시간 시세 변동 시 우측 현재가 등락폭 레이블 갱신 강제 트리거
  if (store._drawingPrimitive) {
    store._drawingPrimitive.updateAll();
  }
}

function autoFit(isTabRestore = false) {
  // 🚀 [비동기/동기 로딩] 사용자가 맞춰둔 커스텀 여백(savedRightMargin)을 우선 준수, 없으면 10
  const margin = store.savedRightMargin ?? 10;
  const defaultZoom = (typeof CONFIG !== "undefined" && CONFIG.CHART_CONFIG?.VISIBLE_COUNT) ?? 100;
  if (isTabRestore && store.isUserZoomed) {
    // 🚀 [UX 개선] 탭 복귀/전환 시 기존 줌 상태(가로폭)는 유지하면서, 최신 봉(가장 우측) 위치로 화면을 강제 정렬하고 가격 스케일을 맞춥니다.
    try {
      if (store.chart) {
        const timeScale = store.chart.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        if (range && store.mainData && store.mainData.length) {
          const len = store.mainData.length;
          const width = range.to - range.from;
          timeScale.setVisibleLogicalRange({
            from: len - 1 - width + margin,
            to: len - 1 + margin,
          });
        } else {
          timeScale.scrollToRealtime();
        }
        store.chart.priceScale("right").applyOptions({ autoScale: true });
      }
      if (store.chartVol) {
        const timeScaleVol = store.chartVol.timeScale();
        const rangeVol = timeScaleVol.getVisibleLogicalRange();
        if (rangeVol && store.mainData && store.mainData.length) {
          const len = store.mainData.length;
          const width = rangeVol.to - rangeVol.from;
          timeScaleVol.setVisibleLogicalRange({
            from: len - 1 - width + margin,
            to: len - 1 + margin,
          });
        } else {
          timeScaleVol.scrollToRealtime();
        }
        store.chartVol.priceScale("right").applyOptions({ autoScale: true });
        if (store.kimchiSeries) {
          store.chartVol.priceScale("left").applyOptions({ autoScale: true });
        }
      }
    } catch (e) { }
    return;
  }
  if (store.chart && store.mainData.length) {
    const len = store.mainData.length;
    // 🚀 [UX 개선] 저장된 가로폭(줌) 정보가 있다면 해당 값을 적용하고, 없으면 CONFIG.CHART_CONFIG.VISIBLE_COUNT를 사용합니다.
    const zoomWidth = store.savedZoomWidth || defaultZoom;
    const logicalRange = {
      from: len - 1 - zoomWidth + margin,
      to: len - 1 + margin,
    };

    store.chart.timeScale().setVisibleLogicalRange(logicalRange);
    store.chart.priceScale("right").applyOptions({ autoScale: true });

    // 🚀 거래량 차트(vol-pane) 완벽 동기화 오토핏! (스케일 뻗거나 꼬이는 현상 원천 차단)
    if (store.chartVol) {
      try {
        store.chartVol.timeScale().setVisibleLogicalRange(logicalRange);
        store.chartVol.priceScale("right").applyOptions({ autoScale: true });
        if (store.kimchiSeries) {
          store.chartVol.priceScale("left").applyOptions({ autoScale: true });
        }
      } catch (e) { }
    }
  }
}

// _main.js 에서 기존 함수를 이걸로 교체
function calculateTimeRemaining(tf, serverMs) {
  const now = new Date(serverMs);
  let nextClose;

  if (tfSec[tf] && tfSec[tf] <= 43200) {
    const ms = tfSec[tf] * 1000;

    // 🚨 0.1초 오차 방지를 위해 1ms 더해서 올림 처리
    nextClose = Math.ceil((serverMs + 1) / ms) * ms;
  }
  // 2. 날짜 단위 계산이 필요한 봉들 (하루 ~ 1년)
  else {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const date = now.getUTCDate();

    switch (tf) {
      case "1d":
        nextClose = Date.UTC(year, month, date + 1);
        break;
      case "3d":
        // 상장일 기준이 아니라 UTC 0시 기준 3일씩 끊기 (바이낸스 방식)
        const dayDiff =
          Math.ceil((serverMs + 1) / (86400000 * 3)) * (86400000 * 3);
        nextClose = dayDiff;
        break;
      case "1w":
        // 다음주 월요일 00:00 UTC (일요일 23:59:59 마감)
        const dayOfWeek = now.getUTCDay(); // 0(일)~6(토)
        const diffToMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        nextClose = Date.UTC(year, month, date + diffToMon);
        break;
      case "1M":
        nextClose = Date.UTC(year, month + 1, 1);
        break;
      case "1y":
        nextClose = Date.UTC(year + 1, 0, 1);
        break;
      default:
        return "";
    }
  }

  // 3. 남은 시간 계산 및 포맷팅
  const diff = Math.max(0, nextClose - serverMs);
  if (diff <= 0) return "00:00";

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  // 포맷팅은 그냥 일:시:분:초 스타일로 보여주기
  const dd = d > 0 ? `${d}d ` : "";
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");

  if (d > 0) return `${dd}${hh}h`;
  return h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

window.resetChartScale = resetChartScale;
window.formatSmartPrice = formatSmartPrice;
window.formatVolumeDollar = formatVolumeDollar;
window.formatVolumeKRW = formatVolumeKRW;
window.updateLegend = updateLegend;
window.updateStatus = updateStatus;
window.autoFit = autoFit;
window.calculateTimeRemaining = calculateTimeRemaining; // 🚀 이거 빠져있었음!

// 🚀 [추가] 백엔드 정규식 이식: 1000XEC, 1MBABYDOGE 등 단위 배수 추출기
export function getMultiplier(sym) {
  if (!sym) return 1;
  const match = sym.match(/^(10+|1[MB])(?=[A-Z])/i);
  if (!match) return 1;
  const p = match[1].toUpperCase();
  if (p === "1M") return 1000000;
  if (p === "1B") return 1000000000;
  return parseInt(p, 10);
}

// 🚀 [추가] 순수 코인명(Base Asset) 추출기 (1000XEC -> XEC)
export function getPureBase(sym) {
  if (!sym) return "";
  return sym.replace(/^(10+|1[MB])(?=[A-Z])/i, "").toUpperCase();
}

// ================== chart.js에서 이동됨 ==================
// 🚀 김프 다채로운 색상 적용 엔진
window.getKimchiColor = function (val) {
  if (val < -4) return "#4B0082"; // 인디고
  if (val < -2) return "#1E3A8A"; // 딥 블루
  if (val < 0) return "#2E8B57"; // 씨그린
  if (val < 2) return "#57a4fc"; // 하늘색
  if (val < 4) return "#FF69B4"; // 핫핑크
  if (val < 6) return "#B22222"; // 파이어브릭
  if (val < 8) return "#FF4500"; // 오렌지레드
  return "#8B0000"; // 다크레드
};

export function toggleCountdown(forceVal) {
  if (forceVal !== undefined) {
    store.showCountdown = forceVal;
  } else {
    store.showCountdown = !store.showCountdown;
  }
  const btn = document.getElementById("toggle-countdown-btn");
  if (btn) {
    btn.innerText = store.showCountdown ? "카운트다운 끄기" : "카운트다운 켜기";
    if (store.showCountdown) {
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
  if (!store.showCountdown && store.countdownOverlay) {
    store.countdownOverlay.style.display = "none";
  }
}

export function toggleOhlc(forceVal) {
  const isHidden = localStorage.getItem("sellnance_ohlc_hidden") === "true";
  let active = !isHidden;
  if (forceVal !== undefined) {
    active = forceVal;
  } else {
    active = !active;
  }
  const leg = document.getElementById("ohlc-legend");
  if (leg) {
    if (active) {
      leg.classList.remove("hidden");
    } else {
      leg.classList.add("hidden");
    }
    localStorage.setItem("sellnance_ohlc_hidden", active ? "false" : "true");
  }
  const btn = document.getElementById("toggle-ohlc-legend-btn");
  if (btn) {
    btn.innerText = active ? "OHLC 끄기" : "OHLC 켜기";
    if (active) {
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
}

export function updateRealtimeCountdown(serverMs) {
  if (store.isFetchingChart) return;
  if (!store.candleSeries || store.mainData.length === 0) {
    if (store.countdownPriceLine) {
      store.candleSeries.removePriceLine(store.countdownPriceLine);
      store.countdownPriceLine = null;
    }
    return;
  }

  let displayTime = "Wait...";
  if (serverMs && serverMs > 0) {
    if (!store.localTimeAtUpdate) {
      store.localTimeAtUpdate = performance.now();
    }

    const interpolatedMs =
      store.lastServerMs + (performance.now() - store.localTimeAtUpdate);

    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleTime = store.mainData[store.mainData.length - 1].time;
    const nextBarTimeMs = (lastCandleTime + secondsPerBar) * 1000;

    if (interpolatedMs >= nextBarTimeMs) {
      displayTime = "00:00";
    } else {
      if (typeof window.calculateTimeRemaining === "function") {
        displayTime = window.calculateTimeRemaining(
          store.currentTF,
          interpolatedMs,
        );
      }
    }
  }

  // 🚀 [시뮬레이터 강제 off] 시뮬레이터 탭 활성화 시 카운트다운 시간 표시를 강제로 off
  const btnSim = document.getElementById("tab-btn-sim");
  const isSimActive = btnSim && btnSim.classList.contains("active");
  const showTitle = store.showCountdown && !isSimActive;

  const lastCandle = store.mainData[store.mainData.length - 1];
  const isDown = lastCandle.close < lastCandle.open;

  if (!store.upColorCache || !store.downColorCache) {
    const style = getComputedStyle(document.body);
    store.upColorCache = style.getPropertyValue("--up").trim() || "#26a69a";
    store.downColorCache = style.getPropertyValue("--down").trim() || "#ef5350";
  }
  const rawColor = isDown ? store.downColorCache : store.upColorCache;

  const lineOptions = {
    price: lastCandle.close,
    color: rawColor, // 🚀 투명색 대신 현재 양봉/음봉 색상 사용 (이게 없어서 안 보였음)
    lineWidth: 1,
    lineStyle: window.LightweightCharts
      ? window.LightweightCharts.LineStyle.Dashed
      : 2, // 🚀 점선(Dashed)으로 차별화
    axisLabelVisible: true,
    title: showTitle ? `${displayTime}` : "",
    axisLabelColor: rawColor,
    axisLabelTextColor: "#ffffff",
  };

  if (!store.countdownPriceLine) {
    store.countdownPriceLine = store.candleSeries.createPriceLine(lineOptions);
  } else {
    store.countdownPriceLine.applyOptions(lineOptions);
  }
}

// 🚀 크로스헤어 퍼센트 라벨 보이기/숨기기 토글
export function toggleCrosshairPct(forceVal) {
  if (forceVal !== undefined) {
    store.showCrosshairPct = forceVal;
  } else {
    const current =
      typeof store.showCrosshairPct === "boolean"
        ? store.showCrosshairPct
        : true;
    store.showCrosshairPct = !current;
  }

  const btn = document.getElementById("toggle-crosshair-pct-btn");
  if (btn) {
    if (store.showCrosshairPct) {
      btn.innerText = "우측 퍼센트% 끄기";
      btn.classList.add(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.remove("bg-theme-panel/50");
    } else {
      btn.innerText = "우측 퍼센트% 켜기";
      btn.classList.remove(
        "text-theme-accent",
        "border-theme-accent/40",
        "bg-theme-accent/10",
      );
      btn.classList.add("bg-theme-panel/50");
    }
  }

  // DrawingPrimitive 재렌더 요청
  if (window.store && window.store._drawingPrimitive) {
    window.store._drawingPrimitive.updateAll();
  }
}

window.toggleCountdown = toggleCountdown;
window.toggleOhlc = toggleOhlc;
window.toggleCrosshairPct = toggleCrosshairPct;
window.updateRealtimeCountdown = updateRealtimeCountdown;

setInterval(() => {
  if (store.lastServerMs > 0) {
    updateRealtimeCountdown(store.lastServerMs);
  }
}, 250);

// 🚀 페이지 로드 직후 토글 UI들의 슬라이더 슬라이딩 초기 위치 동기화
setTimeout(() => {
  const isOhlcHidden = localStorage.getItem("sellnance_ohlc_hidden") === "true";
  if (typeof toggleOhlc === "function") toggleOhlc(!isOhlcHidden);
  if (typeof toggleLogScale === "function") toggleLogScale(store.isLogMode);
  if (typeof toggleCountdown === "function")
    toggleCountdown(store.showCountdown);
  if (typeof toggleCrosshairPct === "function")
    toggleCrosshairPct(store.showCrosshairPct !== false);
}, 200);

// 🎯 브라우저 탭 제목 실시간 스위칭 통합 매니저 (소켓 중복 생성 ZERO, 메인 차트 소켓 100% 재활용)
let lastTabTitleUpdateMs = 0;
let lastTabSymbol = "";
let lastTabMarket = "";

export function updateTabTitleManager(price, symbol, isKor) {
  if (isNaN(price) || price <= 0) return;

  const activeMarket = store.currentChartMarket || "ALL";
  const nowMs = performance.now();
  const isStateChanged = (symbol !== lastTabSymbol || activeMarket !== lastTabMarket);

  // 🚀 500ms 쓰로틀링으로 브라우저 탭 깜빡임 부하 완벽 방어! (단, 심볼이나 마켓이 바뀌었을 경우 즉시 갱신)
  if (isStateChanged || !lastTabTitleUpdateMs || nowMs - lastTabTitleUpdateMs > 500) {
    lastTabTitleUpdateMs = nowMs;
    lastTabSymbol = symbol;
    lastTabMarket = activeMarket;

    const row = store.currentTableData?.find(
      (c) => c.Ticker === store.currentSelectedSymbol || c.Symbol === symbol || c.DisplayTicker === symbol
    );
    const targetSymbol = row?.Symbol || symbol;

    const isFuturesMode = activeMarket === "FUTURES" || activeMarket === "BYBIT_FUTURES";

    // 🚀 선택된 심볼 기준의 최종 대상 배수 (예: 1000SHIB인 경우 1000)
    const storeMult = getMultiplier(targetSymbol);

    // 국내/해외의 현재 모드별 배수 획득
    const activeOvsTicker = isFuturesMode ? row?.Exact_Futures : row?.Exact_Spot;
    const ovsMult = getMultiplier(activeOvsTicker || targetSymbol);
    const domMult = getMultiplier(row?.Upbit_Symbol || targetSymbol);

    const activeExchangeMult = isKor ? domMult : ovsMult;

    // 가격 스케일 조정 (예: SHIB Spot 가격 0.000005를 1000SHIB에 맞춰 0.005로 변환)
    const scaledPrice = price / activeExchangeMult * storeMult;

    const isMainKrw = store.currencyMode === "KRW" || isKor;
    let formatted = "";

    if (isMainKrw) {
      // 업비트/빗썸 KRW 마켓 호가 단위 정밀도 자동 계산
      const getLocalKrwPrecision = (pr) => {
        if (!pr || isNaN(pr)) return 0;
        if (pr >= 100000) return 0;
        if (pr >= 10000) return 1;
        if (pr >= 100) return 2;
        if (pr >= 1) return 3;
        return 4;
      };
      const krwP = getLocalKrwPrecision(scaledPrice);
      formatted = `${Number(scaledPrice).toLocaleString(undefined, { maximumFractionDigits: krwP })}`;
    } else {
      // 바이낸스/바이빗 USDT 마켓 정밀도 참조
      const p = store.getPrecision(store.currentSelectedSymbol || symbol);
      formatted = `${formatSmartPrice(scaledPrice, p)}`;
    }

    document.title = `${formatted} ${targetSymbol.toUpperCase()} | Sellnance`;
  }
}
window.updateTabTitleManager = updateTabTitleManager;

export const sanitizeChartData = (dataArr, hasValueField = false) => {
  if (!Array.isArray(dataArr)) return [];
  const sanitized = [];
  const seen = new Set();

  for (let i = 0; i < dataArr.length; i++) {
    const d = dataArr[i];
    if (!d || d.time === undefined || d.time === null) continue;

    let t = d.time;
    let finalTime = null;

    // time 정규화 및 강제 검증
    if (typeof t === "string") {
      // YYYY-MM-DD 포맷 검증
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        finalTime = t;
      } else {
        // 숫자가 섞여 있거나 파싱이 필요한 문자열
        const parsed = Date.parse(t.includes("T") ? t : t + "T00:00:00Z");
        if (!isNaN(parsed)) {
          finalTime = Math.floor(parsed / 1000);
        } else {
          const num = Number(t);
          if (!isNaN(num) && num > 0) {
            finalTime = num;
          }
        }
      }
    } else if (typeof t === "number") {
      if (!isNaN(t) && t > 0) {
        finalTime = t;
      }
    } else if (typeof t === "object" && t !== null && t.year !== undefined) {
      const parsed = Date.UTC(t.year, t.month - 1, t.day) / 1000;
      if (!isNaN(parsed)) {
        finalTime = parsed;
      }
    }

    if (finalTime === null) continue;

    // 🎯 변경 코드 (최신 데이터 덮어쓰기 전략)
    const timeKey = String(finalTime);
    if (seen.has(timeKey)) {
      // 이미 들어간 중복 데이터가 있으면 지우고 최신 틱 데이터로 교체하기 위해 필터링
      const idx = sanitized.findIndex((item) => String(item.time) === timeKey);
      if (idx !== -1) sanitized.splice(idx, 1);
      seen.delete(timeKey);
    }
    if (seen.has(timeKey)) continue;

    if (hasValueField) {
      const isInvalidValue =
        d.value === undefined || d.value === null || isNaN(Number(d.value));
      const safeValue = isInvalidValue ? 0 : Number(d.value);

      sanitized.push({
        ...d,
        time: finalTime,
        value: safeValue,
      });
    } else {
      if (
        d.open === undefined ||
        d.open === null ||
        isNaN(Number(d.open)) ||
        d.high === undefined ||
        d.high === null ||
        isNaN(Number(d.high)) ||
        d.low === undefined ||
        d.low === null ||
        isNaN(Number(d.low)) ||
        d.close === undefined ||
        d.close === null ||
        isNaN(Number(d.close))
      ) {
        continue;
      }
      sanitized.push({
        ...d,
        time: finalTime,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume:
          d.volume !== undefined &&
            d.volume !== null &&
            !isNaN(Number(d.volume))
            ? Number(d.volume)
            : 0,
      });
    }
    seen.add(timeKey);
  }

  // 정교한 시간 오름차순 정렬
  return sanitized.sort((a, b) => {
    const getTimeVal = (time) => {
      if (typeof time === "string") {
        const parsed = Date.parse(time + "T00:00:00Z");
        return isNaN(parsed) ? 0 : parsed;
      }
      return time * 1000;
    };
    return getTimeVal(a.time) - getTimeVal(b.time);
  });
};
window.sanitizeChartData = sanitizeChartData;

export function rebuildMainDataMap() {
  store.mainDataMap.clear();
  if (store.mainData) {
    store.mainData.forEach((d) => {
      const sec = getUnixSeconds(d.time);
      store.mainDataMap.set(sec, d);
    });
  }
}
window.rebuildMainDataMap = rebuildMainDataMap;

export function rebuildVolumeDataMap() {
  store.volumeDataMap.clear();
  if (store.volumeData) {
    store.volumeData.forEach((d) => {
      const sec = getUnixSeconds(d.time);
      store.volumeDataMap.set(sec, d);
    });
  }
}
window.rebuildVolumeDataMap = rebuildVolumeDataMap;

export function rebuildKimchiDataMap() {
  store.kimchiDataMap.clear();
  if (store.kimchiData) {
    store.kimchiData.forEach((d) => {
      const sec = getUnixSeconds(d.time);
      store.kimchiDataMap.set(sec, d);
    });
  }
}
window.rebuildKimchiDataMap = rebuildKimchiDataMap;
