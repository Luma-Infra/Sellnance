// ui_perf_blocker.js
// ⚡ [성능 디버깅 및 DOM 차단 가드 전담 모듈]
import { store } from "./_store.js";

export function toggleRightDomBlock(checked) {
  store.blockRightDom = checked;

  const childChart = document.getElementById("block-chart-dom-toggle");
  const childOb = document.getElementById("block-orderbook-toggle");
  const childLegend = document.getElementById("block-legend-toggle");
  const childResize = document.getElementById("block-resize-toggle");
  const childMouseEvent = document.getElementById("block-mouse-event-toggle");

  const containerChart = document.getElementById("child-chart-container");
  const containerOb = document.getElementById("child-orderbook-container");
  const containerLegend = document.getElementById("child-legend-container");
  const containerResize = document.getElementById("child-resize-container");
  const containerMouseEvent = document.getElementById("child-mouse-event-container");

  if (checked) {
    if (childChart) {
      childChart.disabled = true;
      childChart.checked = true;
      store.blockChartDom = true;
    }
    if (childOb) {
      childOb.disabled = true;
      childOb.checked = true;
      store.blockOrderbook = true;
      if (typeof window.stopOrderbookStream === "function")
        window.stopOrderbookStream();
    }
    if (childLegend) {
      childLegend.disabled = true;
      childLegend.checked = true;
      store.blockLegend = true;
    }
    if (childResize) {
      childResize.disabled = true;
      childResize.checked = true;
      store.blockChartResize = true;
    }
    if (childMouseEvent) {
      childMouseEvent.disabled = true;
      childMouseEvent.checked = true;
      toggleChartMouseEventBlock(true);
    }

    if (containerChart) containerChart.style.opacity = "0.4";
    if (containerOb) containerOb.style.opacity = "0.4";
    if (containerLegend) containerLegend.style.opacity = "0.4";
    if (containerResize) containerResize.style.opacity = "0.4";
    if (containerMouseEvent) containerMouseEvent.style.opacity = "0.4";
  } else {
    if (childChart) {
      childChart.disabled = false;
      childChart.checked = false;
      store.blockChartDom = false;
    }
    if (childOb) {
      childOb.disabled = false;
      childOb.checked = false;
      store.blockOrderbook = false;
      if (typeof window.startOrderbookStream === "function")
        window.startOrderbookStream(
          store.currentAsset,
          store.currentChartMarket,
        );
    }
    if (childLegend) {
      childLegend.disabled = false;
      childLegend.checked = false;
      store.blockLegend = false;
    }
    if (childResize) {
      childResize.disabled = false;
      childResize.checked = false;
      store.blockChartResize = false;
    }
    if (childMouseEvent) {
      childMouseEvent.disabled = false;
      childMouseEvent.checked = false;
      toggleChartMouseEventBlock(false);
    }

    if (containerChart) containerChart.style.opacity = "1.0";
    if (containerOb) containerOb.style.opacity = "1.0";
    if (containerLegend) containerLegend.style.opacity = "1.0";
    if (containerResize) containerResize.style.opacity = "1.0";
    if (containerMouseEvent) containerMouseEvent.style.opacity = "1.0";
  }
}

export function toggleChartMouseEventBlock(checked) {
  store.blockChartMouseEvent = checked;
  if (checked) {
    if (store._mainCrosshair) store._mainCrosshair.setX(null);
    if (store._volCrosshair) store._volCrosshair.setX(null);
    try {
      if (store.chart) store.chart.clearCrosshairPosition();
      if (store.chartVol) store.chartVol.clearCrosshairPosition();
    } catch (e) { }
  }
}

export function toggleLeftDomBlock(checked) {
  store.blockLeftDom = checked;

  const childSort = document.getElementById("block-sort-toggle");
  const childTabScroll = document.getElementById("block-tabscroll-toggle");
  const childTableUpdate = document.getElementById("block-table-update-toggle");

  const containerSort = document.getElementById("child-sort-container");
  const containerTabScroll = document.getElementById("child-tabscroll-container");
  const containerTableUpdate = document.getElementById("child-table-update-container");

  if (checked) {
    if (childSort) {
      childSort.disabled = true;
      childSort.checked = true;
      store.blockSort = true;
    }
    if (childTabScroll) {
      childTabScroll.disabled = true;
      childTabScroll.checked = true;
      store.blockTableTabScroll = true;
    }
    if (childTableUpdate) {
      childTableUpdate.disabled = true;
      childTableUpdate.checked = true;
      toggleTableUpdateBlock(true);
    }

    if (containerSort) containerSort.style.opacity = "0.4";
    if (containerTabScroll) containerTabScroll.style.opacity = "0.4";
    if (containerTableUpdate) containerTableUpdate.style.opacity = "0.4";
  } else {
    if (childSort) {
      childSort.disabled = false;
      childSort.checked = false;
      store.blockSort = false;
    }
    if (childTabScroll) {
      childTabScroll.disabled = false;
      childTabScroll.checked = false;
      store.blockTableTabScroll = false;
    }
    if (childTableUpdate) {
      childTableUpdate.disabled = false;
      childTableUpdate.checked = false;
      toggleTableUpdateBlock(false);
    }

    if (containerSort) containerSort.style.opacity = "1.0";
    if (containerTabScroll) containerTabScroll.style.opacity = "1.0";
    if (containerTableUpdate) containerTableUpdate.style.opacity = "1.0";
  }
}

export function toggleTableUpdateBlock(checked) {
  store.blockTableUpdate = checked;
}

export function toggleChartDomBlock(checked) {
  store.blockChartDom = checked;
}

export function toggleOrderbookBlock(checked) {
  store.blockOrderbook = checked;
  if (checked && typeof window.stopOrderbookStream === "function") {
    window.stopOrderbookStream();
  } else if (!checked && typeof window.startOrderbookStream === "function") {
    window.startOrderbookStream(store.currentAsset, store.currentChartMarket);
  }
}

export function toggleSortBlock(checked) {
  store.blockSort = checked;
}

export function toggleKimchiBlock(checked) {
  console.log(`⚡ [DEBUG] 김프 실시간 연산 차단 모드: ${checked ? "ON" : "OFF"}`);

  const childRadar = document.getElementById("block-radardatabatch-toggle");
  const containerRadar = document.getElementById("child-radardatabatch-container");
  const childDynamicHtml = document.getElementById("block-dynamic-html-toggle");
  const containerDynamicHtml = document.getElementById("child-dynamichtml-container");

  if (checked) {
    if (childRadar) {
      childRadar.disabled = true;
      childRadar.checked = true;
      store.blockRadarBatch = true;
    }
    if (containerRadar) containerRadar.style.opacity = "0.4";
    if (childDynamicHtml) {
      childDynamicHtml.disabled = true;
      childDynamicHtml.checked = true;
      store.blockRowDynamicHTML = true;
    }
    if (containerDynamicHtml) containerDynamicHtml.style.opacity = "0.4";
  } else {
    if (childRadar) {
      childRadar.disabled = false;
      childRadar.checked = false;
      store.blockRadarBatch = false;
    }
    if (containerRadar) containerRadar.style.opacity = "1.0";
    if (childDynamicHtml) {
      childDynamicHtml.disabled = false;
      childDynamicHtml.checked = false;
      store.blockRowDynamicHTML = false;
    }
    if (containerDynamicHtml) containerDynamicHtml.style.opacity = "1.0";
  }
}

export function toggleLegendBlock(checked) {
  store.blockLegend = checked;
}

export function toggleResizeBlock(checked) {
  store.blockChartResize = checked;
}

export function toggleTabScrollBlock(checked) {
  store.blockTableTabScroll = checked;
}

export function toggleRadarBatchBlock(checked) {
  store.blockRadarBatch = checked;
}

export function toggleDynamicHtmlBlock(checked) {
  store.blockRowDynamicHTML = checked;
}

export function setAggTradeInterval(ms) {
  store.aggTradeInterval = ms;

  const intervals = [0, 100, 500, 1500];
  intervals.forEach((val) => {
    const btnId =
      val === 0 ? "aggtrade-interval-raw" : `aggtrade-interval-${val}`;
    const btn = document.getElementById(btnId);
    if (btn) {
      if (val === ms) {
        btn.className =
          "py-1 px-1.5 rounded bg-theme-accent text-white font-bold cursor-pointer text-center transition-all";
      } else {
        btn.className =
          "py-1 px-1.5 rounded bg-theme-border/40 text-theme-text/80 hover:bg-theme-border/60 cursor-pointer text-center transition-all";
      }
    }
  });
}

export function copyPerformanceStats() {
  if (!store.bypassCounters) return;
  const elapsedText =
    document.getElementById("perf-run-time-display")?.innerText ||
    "(알수없음 경과)";
  const total = Object.values(store.bypassCounters).reduce((a, b) => a + b, 0);
  const riskText =
    document.getElementById("perf-top-risk-analysis")?.innerText || "NONE";

  const textToCopy = `⚡ Sellnance 렉 디버거 성능 리포트
경과 시간: ${elapsedText}
총 Bypass 건수: ${total}

[상세 지표 목록]
- LeftDom (좌측 테이블 차단): ${store.bypassCounters.leftDom || 0}
- TabScroll (테이블 전체 리플로우): ${store.bypassCounters.tabScroll || 0}
- TableUp (개별 셀 갱신 과부하): ${store.bypassCounters.tableUpdate || 0}
- Kimchi (3초 김프 연산 전파): ${store.bypassCounters.kimchi || 0}
- Radar (3초 레이더 일괄 갱신): ${store.bypassCounters.radarBatch || 0}
- M-Event (차트 마우스 십자선 지연): ${store.bypassCounters.mouseEvent || 0}
- DynHtml (김프 전파 HTML 동적 렌더): ${store.bypassCounters.dynamicHtml || 0}
- T-Bypass (100ms 쓰로틀 차단): ${store.bypassCounters.throttleBypass || 0}
- T-Pass (100ms 가드 통과 처리): ${store.bypassCounters.throttlePass || 0}

🚨 최대 렉 위협 요소: ${riskText}
  `;

  navigator.clipboard
    .writeText(textToCopy.trim())
    .then(() => {
      const btn = document.getElementById("copy-perf-stats-btn");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✓ 복사됨!";
        btn.style.color = "#0ecb81";
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.color = "";
        }, 1200);
      }
    })
    .catch((err) => console.error("성능 로그 클립보드 복사 실패:", err));
}

export function syncCheckboxesFromStore() {
  const check = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  check("block-right-dom-toggle", store.blockRightDom);
  check("block-chart-dom-toggle", store.blockChartDom);
  check("block-orderbook-toggle", store.blockOrderbook);
  check("block-legend-toggle", store.blockLegend);
  check("block-resize-toggle", store.blockChartResize);
  check("block-mouse-event-toggle", store.blockChartMouseEvent);
  check("block-left-dom-toggle", store.blockLeftDom);
  check("block-sort-toggle", store.blockSort);
  check("block-table-update-toggle", store.blockTableUpdate);
  check("block-kimchi-toggle", store.blockKimchi);
  check("block-tabscroll-toggle", store.blockTableTabScroll);
  check("block-radardatabatch-toggle", store.blockRadarBatch);
  check("block-dynamic-html-toggle", store.blockRowDynamicHTML);

  toggleRightDomBlock(!!store.blockRightDom);
  toggleLeftDomBlock(!!store.blockLeftDom);
  toggleKimchiBlock(!!store.blockKimchi);
}

// 🚀 전역 노출
window.toggleRightDomBlock = toggleRightDomBlock;
window.toggleLeftDomBlock = toggleLeftDomBlock;
window.toggleChartDomBlock = toggleChartDomBlock;
window.toggleOrderbookBlock = toggleOrderbookBlock;
window.toggleSortBlock = toggleSortBlock;
window.toggleKimchiBlock = toggleKimchiBlock;
window.toggleLegendBlock = toggleLegendBlock;
window.toggleResizeBlock = toggleResizeBlock;
window.toggleTabScrollBlock = toggleTabScrollBlock;
window.toggleRadarBatchBlock = toggleRadarBatchBlock;
window.toggleDynamicHtmlBlock = toggleDynamicHtmlBlock;
window.toggleChartMouseEventBlock = toggleChartMouseEventBlock;
window.toggleTableUpdateBlock = toggleTableUpdateBlock;
window.setAggTradeInterval = setAggTradeInterval;
window.copyPerformanceStats = copyPerformanceStats;
window.syncCheckboxesFromStore = syncCheckboxesFromStore;
