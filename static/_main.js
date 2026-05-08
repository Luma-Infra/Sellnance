// _main.js
import { store, CONFIG, tfSec, measureDOM } from './store.js';
import { loadSymbols, searchSymbols, clearSearch, selectSymbol, fetchHistory, clearChartData, updateExchangeBadges } from './api.js';
import './chart_utils.js';
import { initChart } from './chart.js';
import './sim_engine.js';
import './ui_control.js';
import './stream.js';
import './streamEach.js';
import './table.js';
import './start.js';
import './app_loader.js';

// 🚀 Vite 모듈 환경에서 인라인 이벤트 처리용 함수 노출
window.searchSymbols = searchSymbols;
window.clearSearch = clearSearch;
window.selectSymbol = selectSymbol;

// 🚀 엔진 시동 파트
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🏁 대시보드 엔진 가동 시작...");

  try {
    // 1️⃣ [데이터 로드] 마켓 구성 정보 + 실제 테이블 장부를 '순서대로' 가져온다
    await loadSymbols(); // 코인 맵핑 정보 로드
    console.log("✅ 1-A. 마켓 맵 로드 완료");

    if (typeof loadTableData === "function") {
      // 🚨 핵심: 실시간 시세가 기록될 '진짜 장부'가 채워질 때까지 기다립니다.
      await loadTableData();
      console.log("✅ 1-B. 실시간 시세 장부(currentTableData) 입고 완료");
    }

    // 2️⃣ [엔진 준비] 이제 장부가 확실히 있으니 차트를 그린다
    if (store.currentTableData && store.currentTableData.length > 0) {
      initChart();
      initMeasureEvents();
      initInfiniteScroll();
      console.log("✅ 2. 차트 및 인터페이스 준비 완료");

      // 3️⃣ [소켓 점화] 모든 준비가 끝났을 때 비로소 소켓을 연결!
      // (장부가 꽉 차 있어서 켜지자마자 바로 구독 성공함)
      initSniperSocket();
      if (typeof startBinanceMarketRadar === "function")
        startBinanceMarketRadar();
      if (typeof startUpbitMarketRadar === "function") startUpbitMarketRadar();
      console.log("✅ 3. 실시간 소켓 연결 성공!");
    } else {
      throw new Error("장부 데이터가 비어있습니다.");
    }

    // 4️⃣ [UI 이벤트] 슬라이더 및 버튼 반응 설정
    setupSliderEvents();
    setupButtonEvents();
  } catch (err) {
    console.error("🚨 시동 실패:", err);
    // 보험: 2초 뒤 자동 새로고침 시도
    // setTimeout(() => location.reload(), 2000);
  }
});

// 💡 슬라이더 로직 (가독성을 위해 분리)
function setupSliderEvents() {
  ["body", "top", "bottom"].forEach((id) => {
    const inputEl = document.getElementById("input-" + id);
    if (inputEl) {
      inputEl.oninput = () => {
        const val = inputEl.value;
        document.getElementById("val-" + id).innerText = val + "%";
        if (id === "body") {
          if (curDir === "bull") bullBody = val;
          else bearBody = val;
        }
        updateStatus();
        if (isHover && typeof updatePreview === "function") updatePreview();
      };
    }
  });
}

// 💡 버튼 호버 로직
function setupButtonEvents() {
  const genBtn = document.getElementById("btn-generate");
  if (genBtn) {
    genBtn.onmouseenter = () => {
      isHover = true;
      if (typeof updatePreview === "function") updatePreview();
    };
    genBtn.onmouseleave = () => {
      store.isHover = false;
      store.previewSeries.setData([]);
    };
  }
}

// ⚙️ 시간 변환 통합 헬퍼 (전역으로 이동!)
// 이제 initChart와 startRealtimeCandle 양쪽에서 모두 사용 가능합니다.
const getUnixSeconds = (t) => {
  if (typeof t === "object" && t !== null)
    return new Date(t.year, t.month - 1, t.day).getTime() / 1000;
  if (typeof t === "string") return new Date(t).getTime() / 1000;
  return t;
};

// function initChart() {
//   const container = document.getElementById("chart-container");
//   // 🚀 과거와의 작별 (이게 메모리 아끼는 핵심!)
//   if (chart) {
//     chart.remove(); // 엔진 내부 메모리 해제
//     chart = null;
//     candleSeries = null;
//     countdownPriceLine = null; // 👈 유령 방지
//   }

//   const isDark = currentTheme === "binance" || currentTheme === "upbit-dark";
//   const upColor = currentTheme === "binance" ? "#26a69a" : "#c84a31";
//   const downColor = currentTheme === "binance" ? "#ef5350" : "#1261c4";

//   chart = LightweightCharts.createChart(container, {
//     width: container.clientWidth,
//     height: container.clientHeight,
//     layout: {
//       background: {
//         color: getComputedStyle(document.body).getPropertyValue("--bg").trim(),
//       },
//       textColor: getComputedStyle(document.body)
//         .getPropertyValue("--text")
//         .trim(),
//     },
//     grid: {
//       vertLines: { color: isDark ? "#2a2a22" : "#f1f1f11f" },
//       horzLines: { color: isDark ? "#2a2a22" : "#f1f1f11f" },
//     },
//     timeScale: {
//       borderColor: isDark ? "#2a2a22" : "#f1f1f11f",
//       timeVisible: true,
//       secondsVisible: false,
//       fixRightEdge: false,
//       tickMarkFormatter: (time, tickMarkType) => {
//         const d = new Date(getUnixSeconds(time) * 1000);
//         if (isNaN(d.getTime())) return "";

//         // 🚀 핵심: tickMarkType이 'Year'(0)이면 연도를 최우선으로 반환
//         // LightweightCharts.TickMarkType.Year 값은 보통 0입니다.
//         if (tickMarkType === 0) {
//           return `${d.getFullYear()}년`;
//         }

//         const isDayUnit = !(currentTF || "1h").match(/[hm]/);

//         if (isDayUnit) {
//           // 일봉 이상: 연도 첫날이 아니면 '월/일' 표시
//           return `${d.getMonth() + 1}/${d.getDate()}`;
//         } else {
//           // 분/시간봉: '시:분' 표시
//           return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
//         }
//       },
//     },
//     localization: {
//       locale: navigator.language,
//       timeFormatter: (tick) => {
//         const d = new Date(getUnixSeconds(tick) * 1000);
//         if (isNaN(d.getTime())) return "";

//         const y = d.getFullYear();
//         const m = String(d.getMonth() + 1).padStart(2, "0");
//         const date = String(d.getDate()).padStart(2, "0");
//         const h = String(d.getHours()).padStart(2, "0");
//         const min = String(d.getMinutes()).padStart(2, "0");

//         // 🚀 십자선(Crosshair) 라벨도 동일한 규칙 적용
//         if ((currentTF || "1h").match(/[hm]/)) {
//           return `${y}-${m}-${date} ${h}:${min}`;
//         } else {
//           return `${y}-${m}-${date}`;
//         }
//       },
//     },
//     rightPriceScale: {
//       autoScale: true,
//       visible: true,
//       entireTextOnly: false,
//       borderColor: isDark ? "#2a2a22" : "#f1f1f11f",
//       mode: isLogMode ? 1 : 0,
//     },
//     crosshair: {
//       mode: LightweightCharts.CrosshairMode.Normal,
//     },
//   });

//   // 🚀 공통 커스텀 가격 포맷 설정 (함수 추가 없이 기존 formatSmartPrice 재활용!)
//   // 🚀 p 값을 무조건 '순수 숫자(Number)'로 강제 변환! (문자열 방어)
//   const row = currentTableData.find((c) => c.Symbol === currentAsset);
//   const p = row && row.precision !== undefined ? Number(row.precision) : 2;

//   // 🚀 minMove도 안전하게 계산
//   const safeMinMove = p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1;
//   const customPriceFormat = {
//     type: "price",
//     precision: p,
//     minMove: safeMinMove,
//     formatter: (price) => {
//       if (price === null || price === undefined || isNaN(price)) return "";
//       // 💡 formatSmartPrice가 똑똑하게 소수점을 찍어줄 겁니다.
//       return formatSmartPrice(price, p);
//     },
//   };

//   candleSeries = chart.addCandlestickSeries({
//     upColor,
//     downColor,
//     borderUpColor: upColor,
//     borderDownColor: downColor,
//     wickUpColor: upColor,
//     wickDownColor: downColor,
//     priceFormat: customPriceFormat, // 👈 여기 추가
//     lastValueVisible: false,
//   });

//   previewSeries = chart.addCandlestickSeries({
//     upColor: upColor + "4D",
//     downColor: downColor + "4D",
//     borderVisible: false,
//     wickVisible: false,
//     priceFormat: customPriceFormat, // 👈 여기 추가
//   });

//   chart.subscribeCrosshairMove((p) => {
//     // 1. 마우스가 차트 위에 있고 데이터가 존재할 때 (탐색 모드)
//     if (p && p.time) {
//       const d = p.seriesData.get(candleSeries);
//       if (d) {
//         updateLegend(d);
//       }
//     }
//     // 2. 마우스가 차트를 벗어났을 때 (실시간 추적 모드)
//     else if (mainData && mainData.length > 0) {
//       // 가장 최근 봉(현재가) 데이터를 전광판에 고정!
//       updateLegend(mainData[mainData.length - 1]);
//     }
//   });

//   // 🚀 설정 변수를 활용한 유령 데이터 렌더링
//   if (mainData.length > 1) {
//     const lastTime = getUnixSeconds(mainData[mainData.length - 1].time);
//     const interval =
//       lastTime - getUnixSeconds(mainData[mainData.length - 2].time);

//     // 🚀 전역 변수 적용
//     const ghostData = Array.from(
//       { length: CHART_CONFIG.GHOST_COUNT },
//       (_, i) => ({
//         time: lastTime + interval * (i + 1),
//       }),
//     );

//     candleSeries.setData([...mainData, ...ghostData]);

//     // VISIBLE_COUNT, RIGHT_PADDING 변수 사용
//     chart.timeScale().setVisibleLogicalRange({
//       from: Math.max(0, mainData.length - CHART_CONFIG.VISIBLE_COUNT),
//       to: mainData.length + CHART_CONFIG.RIGHT_PADDING,
//     });
//   } else if (mainData.length === 1) {
//     candleSeries.setData(mainData);
//     autoFit();
//   }

//   // 측정 도구 세팅
//   setTimeout(setupMeasureTool, 50);

//   // 리사이즈 옵저버 디바운스
//   if (window.chartResizeObserver) window.chartResizeObserver.disconnect();

//   let resizeTimeout;
//   window.chartResizeObserver = new ResizeObserver(([entry]) => {
//     // 1. 부모 컨테이너 크기 실시간 감지
//     const { width, height } = entry.contentRect;

//     // 2. 0달러 방지 (크기가 0일 땐 패스)
//     if (!width || !height) return;

//     // 3. 디바운스 (너무 자주 그리면 렉 걸리니까 잠시 대기)
//     clearTimeout(resizeTimeout);
//     resizeTimeout = setTimeout(() => {
//       if (chart) {
//         chart.resize(width, height);
//         // 🚀 리사이즈 직후 차트 범위를 다시 맞춰야 안 찌그러짐
//         // chart.timeScale().fitContent();
//         // console.log(`📏 리사이즈 완료: ${width}x${height}`);
//       }

//       // 🚀 모바일 오버레이 방어 (아까 그 기준 적용!)
//       if (width >= SCREEN_WIDTH) {
//         const overlay = document.getElementById("mobile-chart-overlay");
//         if (overlay && !overlay.classList.contains("hidden")) {
//           closeMobileChart();
//         }
//       }
//     }, 50);
//   });
//   // 🎯 차트 컨테이너 감시 시작!
//   const chartContainer = document.getElementById("chart-container");
//   if (chartContainer) {
//     window.chartResizeObserver.observe(chartContainer);
//   }
// }

function setTF(tf) {
  const isSimMode = document
    .getElementById("tab-btn-sim")
    .classList.contains("active");
  if (isSimMode) {
    Swal.fire({
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

function executeSetTF(tf) {
  store.currentTF = tf;
  document.querySelectorAll(".tf-btn").forEach((b) => {
    const onClickAttr = b.getAttribute("onclick") || "";
    // 현재 버튼이 클릭된 타임프레임(tf)과 일치하는지 확인
    const isMatch = onClickAttr.includes(`'${tf}'`);

    // active 클래스 토글
    b.classList.toggle("active", isMatch);

    // 투명도 조절 (Tailwind 기준) - 반드시 루프 안에서 실행!
    b.classList.toggle("opacity-100", isMatch);
    b.classList.toggle("opacity-50", !isMatch);
  });

  // 🚀 [추가] index.html에 정의된 버튼 렌더링 함수를 호출하여 UI 갱신
  if (typeof renderTimeframeButtons === "function") {
    renderTimeframeButtons(tf);
  }

  // 4. 차트 데이터 갱신 함수 호출
  if (typeof fetchHistory === "function") fetchHistory(store.currentAsset);
}
window.setTF = setTF;
window.executeSetTF = executeSetTF;

function toggleLogScale() {
  store.isLogMode = !store.isLogMode;
  const btn = document.getElementById("log-btn");
  if (btn) {
    btn.innerText = store.isLogMode ? "Log ON" : "Log Off";
    btn.classList.toggle("active", store.isLogMode);
  }
  store.chart.priceScale("right").applyOptions({ mode: store.isLogMode ? 1 : 0 });
}

function updatePreview() {
  if (store.mainData.length && store.isHover && typeof getNext === "function")
    store.previewSeries.setData([getNext()]);
}

function stopMeasuring() {
  store.isMeasuring = false;
  store.measureStart = null;
  store.measureEnd = null;
  [measureDOM.box, measureDOM.startLabel, measureDOM.endLabel, measureDOM.rangeBar].forEach((el) => {
    el.style.display = "none";
    el.innerText = "";
  });
}

// --- 🚀 2. 렌더링 시 DOM만 다시 붙여주는 함수 (initChart 내부에서 호출) ---
function setupMeasureTool() {
  // const container = document.getElementById("chart-container");
  const container = document.getElementById("pane-main");
  store.cachedChartTd = container.querySelector("td:nth-child(2)");
  store.cachedPriceTd = container.querySelector("td:nth-child(3)");

  if (!store.cachedChartTd || !store.cachedPriceTd) return;

  store.cachedChartTd.style.position = "relative";
  store.cachedPriceTd.style.position = "relative";
  store.cachedChartTd.appendChild(measureDOM.box);
  store.cachedPriceTd.appendChild(measureDOM.rangeBar);
  store.cachedPriceTd.appendChild(measureDOM.startLabel);
  store.cachedPriceTd.appendChild(measureDOM.endLabel);
}

// --- ⚡ 3. 마우스 이벤트 (단 한 번만 실행되도록 분리) ---
function initMeasureEvents() {
  // const container = document.getElementById("chart-container");
  const container = document.getElementById("pane-main");

  container.addEventListener("mousedown", (e) => {
    // 🚀 매번 찾지 않고 캐싱된 DOM 사용
    if (!store.cachedChartTd || !store.cachedPriceTd || !store.chart || !store.candleSeries) return;

    const rect = container.getBoundingClientRect();
    if (e.clientX - rect.left > rect.width - (store.cachedPriceTd.clientWidth || 60))
      return;

    if (e.shiftKey && e.button === 0) {
      stopMeasuring();
      store.isMeasuring = true;

      const chartRect = store.cachedChartTd.getBoundingClientRect();
      const sX = e.clientX - chartRect.left;
      const sY = e.clientY - chartRect.top;
      const price = store.candleSeries.coordinateToPrice(sY);

      store.measureStart = {
        x: sX,
        y: sY,
        price: price,
        time: store.chart.timeScale().coordinateToTime(sX),
      };

      // 초기화 및 노출
      measureDOM.box.style.cssText += `left: ${sX}px; top: ${sY}px; width: 0px; height: 0px; display: flex;`;
      measureDOM.rangeBar.style.cssText += `top: ${sY}px; height: 0px; display: block;`;
      measureDOM.startLabel.style.cssText += `top: ${sY - 10}px; display: block;`;
      measureDOM.endLabel.style.cssText += `top: ${sY - 10}px; display: block;`;

      measureDOM.box.innerText = "";
      measureDOM.startLabel.innerText = formatSmartPrice(price);
      measureDOM.endLabel.innerText = formatSmartPrice(price);
      e.preventDefault();
    } else if (e.button === 0 && store.isMeasuring) {
      store.isMeasuring = false;
    } else if (!e.shiftKey && !store.isMeasuring && store.measureStart) {
      stopMeasuring();
    }
  });

  container.addEventListener("mousemove", (e) => {
    if (!store.isMeasuring || !store.measureStart || !store.cachedChartTd || !store.candleSeries)
      return;

    const chartRect = store.cachedChartTd.getBoundingClientRect();
    const curX = e.clientX - chartRect.left;
    const curY = e.clientY - chartRect.top;

    const curPrice = store.candleSeries.coordinateToPrice(curY);
    const curTime = store.chart.timeScale().coordinateToTime(curX);
    if (curPrice === null || curTime === null) return;

    store.measureEnd = { price: curPrice, time: curTime };

    // 🚀 실시간 좌표 역산
    const startX = store.chart.timeScale().timeToCoordinate(store.measureStart.time);
    const startY = store.candleSeries.priceToCoordinate(store.measureStart.price);
    if (startX === null || startY === null) return;

    const priceDiff = curPrice - store.measureStart.price;
    const percentDiff = (priceDiff / store.measureStart.price) * 100;
    const isUp = priceDiff >= 0;
    const tColor = isUp ? "var(--up, #26a69a)" : "var(--down, #ef5350)";
    const tBg = isUp ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)";

    const topY = Math.min(startY, curY),
      heightY = Math.max(0.5, Math.abs(curY - startY));
    const leftX = Math.min(startX, curX),
      widthX = Math.abs(curX - startX);

    measureDOM.box.style.cssText += `left: ${leftX}px; top: ${topY}px; width: ${widthX}px; height: ${heightY}px; border-color: ${tColor}; background-color: ${tBg}; color: ${tColor};`;
    measureDOM.rangeBar.style.cssText += `top: ${topY}px; height: ${heightY}px; background-color: ${tBg};`;
    measureDOM.startLabel.style.cssText += `top: ${startY - 10}px; background-color: ${tColor};`;
    measureDOM.endLabel.style.cssText += `top: ${curY - 10}px; background-color: ${tColor};`;
    measureDOM.endLabel.innerText = formatSmartPrice(curPrice);

    const barsDiff = Math.abs(
      Math.round((curTime - store.measureStart.time) / (tfSec[store.currentTF] || 86400)),
    );
    measureDOM.box.innerText = `${barsDiff} bars\n${formatSmartPrice(priceDiff)}\n(${isUp ? "+" : ""}${percentDiff.toFixed(2)}%)`;
  });

  container.addEventListener("contextmenu", (e) => {
    if (store.measureStart) {
      e.preventDefault();
      stopMeasuring();
    }
  });
}

function toggleCountdown(isChecked) {
  store.showCountdown = isChecked;
  const knob = document.getElementById("countdown-knob");

  // UI 토글 애니메이션
  if (isChecked) {
    knob.style.transform = "translateX(10px)";
    knob.parentElement.classList.add("bg-theme-accent");
  } else {
    knob.style.transform = "translateX(0)";
    knob.parentElement.classList.remove("bg-theme-accent");
    if (countdownOverlay) countdownOverlay.style.display = "none";
  }
}

function updateRealtimeCountdown(serverMs) {
  // 1. 기본 방어 (차트 시리즈 없으면 삭제)
  if (!store.candleSeries || store.mainData.length === 0) {
    if (store.countdownPriceLine) {
      store.candleSeries.removePriceLine(store.countdownPriceLine);
      store.countdownPriceLine = null;
    }
    return;
  }

  // 2. 보간 엔진 가동 조건 (serverMs가 유효할 때만)
  if (serverMs && serverMs > 0) {
    if (serverMs !== store.lastServerMs) {
      store.lastServerMs = serverMs;
      store.localTimeAtUpdate = performance.now();
    }

    // 🚀 보간 계산
    const interpolatedMs =
      store.lastServerMs + (performance.now() - store.localTimeAtUpdate);

    // 🎯 마감 시간 체크 로직 추가
    const secondsPerBar = tfSec[store.currentTF] || 60;
    const lastCandleTime = store.mainData[store.mainData.length - 1].time; // Unix Sec
    const nextBarTimeMs = (lastCandleTime + secondsPerBar) * 1000; // MS 변환

    if (interpolatedMs >= nextBarTimeMs) {
      // 🚨 시간이 이미 지났다? 서버 신호 올 때까지 "00:00"으로 강제 고정!
      displayTime = "00:00";
    } else {
      // 아직 시간 남았으면 정상 카운트다운
      // displayTime = calculateTimeRemaining(store.currentTF, interpolatedMs);
    }
  }

  // 3. 봉 색상 및 상태 파악
  const lastCandle = store.mainData[store.mainData.length - 1];
  const isDown = lastCandle.close < lastCandle.open;
  const style = getComputedStyle(document.body);
  const varName = isDown ? "--down" : "--up";
  const rawColor =
    style.getPropertyValue(varName).trim() || (isDown ? "#ef5350" : "#26a69a");

  // 4. 차트 레이블 옵션 (보간된 displayTime 적용)
  const lineOptions = {
    price: lastCandle.close,
    color: "transparent",
    lineWidth: 0,
    axisLabelVisible: true,
    title: store.showCountdown ? `${displayTime} ` : "", // 🚀 Wait... 또는 05:20
    axisLabelColor: rawColor,
    axisLabelTextColor: "#ffffff",
  };

  // 5. 생성 및 갱신
  if (!store.countdownPriceLine) {
    store.countdownPriceLine = store.candleSeries.createPriceLine(lineOptions);
  } else {
    store.countdownPriceLine.applyOptions(lineOptions);
  }
}

// 실시간 카운트다운 보간
setInterval(() => {
  if (typeof updateRealtimeCountdown === "function" && store.lastServerMs > 0) {
    updateRealtimeCountdown(store.lastServerMs);
  }
}, 50);

// 🚀 검색창 바깥 클릭 시 닫기
document.addEventListener("click", (e) => {
  const searchResults = document.getElementById("search-results");
  const symbolInput = document.getElementById("symbol-input");

  // 입력창이나 결과창 내부를 클릭한 게 아니라면 숨김 처리
  if (searchResults && symbolInput && !symbolInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.style.display = "none";
  }
});

// 🚀 탭 활성화 감지 (Sleep -> Wake Up 스턴 방어)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("☀️ 탭 활성화: 절전 모드 해제 및 데이터 클렌징");

    // 1. 잠든 사이 폭주해서 쌓인 찌꺼기 버퍼 즉시 소각
    // tickerBuffer = {};

    // 2. 10초 이상 자리를 비웠다면 차트를 아예 새로고침 (유령 캔들, 끊김 방지)
    const now = Date.now();
    if (now - store.lastFetchTime > 10000 && store.currentAsset) {
      console.log("🔄 장시간 부재 감지: 차트를 재동기화합니다.");
      if (typeof fetchHistory === "function") fetchHistory(store.currentAsset);
    }
  }
});

// 🚀 정렬 순서 퀵 서칭 탐색 및 타임프레임 변경 엔진
document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT") return;

  const up = e.key === "ArrowUp";
  const down = e.key === "ArrowDown";
  const left = e.key === "ArrowLeft";
  const right = e.key === "ArrowRight";

  // 💡 1. 좌우 방향키: 타임프레임(TF) 퀵 스위칭
  if (left || right) {
    e.preventDefault();
    const tfArray = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "12h", "1d", "3d", "1w", "1M"];
    let idx = tfArray.indexOf(store.currentTF);
    if (left && idx > 0) setTF(tfArray[idx - 1]);
    else if (right && idx < tfArray.length - 1) setTF(tfArray[idx + 1]);
    return;
  }

  // 💡 2. 상하 방향키: 테이블 리스트 탐색 (기존 코드)
  if (up || down) {
    e.preventDefault();
    const sortedList = store.currentTableData;
    if (!sortedList || sortedList.length === 0) return;

    let currentIndex = sortedList.findIndex((item) => item.Symbol === store.currentSelectedSymbol);
    let nextIndex;

    if (up) nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    else nextIndex = currentIndex >= sortedList.length - 1 ? sortedList.length - 1 : currentIndex + 1;

    if (nextIndex === currentIndex) return;

    const nextCoin = sortedList[nextIndex];
    if (nextCoin) {
      if (nextIndex >= store.currentRenderLimit) {
        store.currentRenderLimit = nextIndex + 1;
        renderTable();
      }
      store.currentSelectedSymbol = nextCoin.Symbol;
      selectSymbol(nextCoin.Symbol);

      setTimeout(() => {
        const targetRow = document.querySelector(`#table-body tr[data-sym="${nextCoin.Symbol}"]`);
        if (targetRow) {
          targetRow.scrollIntoView({ block: "nearest", behavior: "instant" });
          applySelectedHighlight();
        }
      }, 0);
    }
  }
});