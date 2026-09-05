// ui_selection.js
// --- 🪙 코인 선택 및 거래소 배지 업데이트 전담 모듈 ---
import { store, CONFIG } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import { getPureBase } from "./chart_utils.js";
import { getChartDefaultMarket, getRowExchangeMeta } from "./_market_rules.js";

export function selectSymbol(
  s,
  forceMarket = null,
  targetUid = null,
  isRowClick = false,
  shouldScroll = false,
) {
  const allSourceData =
    store.originalTableData && store.originalTableData.length > 0
      ? store.originalTableData
      : (store.currentTableData || []);
  // 1. suffix 및 트레이딩뷰 스타일(EXCHANGE:SYMBOL_MARKET) 파싱
  const originalSym = String(s).trim();
  let parsedSymbol = originalSym.toUpperCase();
  let parsedMarket = null;

  if (parsedSymbol.includes(":")) {
    const parts = parsedSymbol.split(":");
    const exPart = parts[0].trim().toUpperCase();
    const symMarketPart = parts[1].trim().toUpperCase();

    if (symMarketPart.endsWith("_FUTURES")) {
      parsedSymbol = symMarketPart.replace("_FUTURES", "");
      parsedMarket = exPart === "BYBIT" ? "BYBIT_FUTURES" : "FUTURES";
    } else if (symMarketPart.endsWith("_SPOT")) {
      parsedSymbol = symMarketPart.replace("_SPOT", "");
      parsedMarket = exPart === "BYBIT" ? "BYBIT" : "SPOT";
    } else {
      parsedSymbol = symMarketPart;
      if (exPart === "UPBIT") parsedMarket = "UPBIT";
      else if (exPart === "BITHUMB") parsedMarket = "BITHUMB";
      else if (exPart === "BINANCE") parsedMarket = "FUTURES";
      else if (exPart === "BYBIT") parsedMarket = "BYBIT_FUTURES";
    }
  } else if (parsedSymbol.includes("_")) {
    if (parsedSymbol.endsWith("_FUTURES")) {
      parsedSymbol = parsedSymbol.replace("_FUTURES", "");
      parsedMarket = "FUTURES";
    } else if (parsedSymbol.endsWith("_SPOT")) {
      parsedSymbol = parsedSymbol.replace("_SPOT", "");
      parsedMarket = "SPOT";
    } else if (parsedSymbol.endsWith("_UPBIT")) {
      parsedSymbol = parsedSymbol.replace("_UPBIT", "");
      parsedMarket = "UPBIT";
    } else if (parsedSymbol.endsWith("_BITHUMB")) {
      parsedSymbol = parsedSymbol.replace("_BITHUMB", "");
      parsedMarket = "BITHUMB";
    }
  } else if (parsedSymbol.endsWith("KRW")) {
    parsedSymbol = parsedSymbol.slice(0, -3);
    parsedMarket = "UPBIT";
  } else if (parsedSymbol.endsWith("USDT")) {
    parsedSymbol = parsedSymbol.slice(0, -4);
    parsedMarket = "FUTURES";
  }

  // 2. rowInfo 매칭 (UID, Ticker, DisplayTicker, Symbol 및 suffix 제거 비교)
  let rowInfo = null;
  if (targetUid) {
    rowInfo = allSourceData.find((c) => c.UID === targetUid);
  }
  if (!rowInfo && store.tickerRowMap) {
    rowInfo =
      store.tickerRowMap.get(parsedSymbol) ||
      (targetUid ? store.tickerRowMap.get(targetUid) : null);
  }
  if (!rowInfo) {
    // 2-1. 1차 패스: 정확히 일치(Exact Match)하는 대상을 우선 검색
    rowInfo = allSourceData.find(
      (c) =>
        c.UID === parsedSymbol ||
        c.Ticker === parsedSymbol ||
        c.DisplayTicker === parsedSymbol ||
        c.Symbol === parsedSymbol,
    );
  }
  if (!rowInfo) {
    // 2-2. 2차 패스: 접미사(KRW, USDT 등)를 제거하고 유연하게 검색
    rowInfo = allSourceData.find((c) => {
      const t = (c.Ticker || "").toUpperCase();
      const cleanT = t.endsWith("KRW")
        ? t.slice(0, -3)
        : t.endsWith("USDT")
          ? t.slice(0, -4)
          : t;

      const dt = (c.DisplayTicker || "").toUpperCase();
      const cleanDt = dt.endsWith("KRW")
        ? dt.slice(0, -3)
        : dt.endsWith("USDT")
          ? dt.slice(0, -4)
          : dt;

      const sym = (c.Symbol || "").toUpperCase();
      const cleanSym = sym.endsWith("KRW")
        ? sym.slice(0, -3)
        : sym.endsWith("USDT")
          ? sym.slice(0, -4)
          : sym;

      return (
        cleanT === parsedSymbol ||
        cleanDt === parsedSymbol ||
        cleanSym === parsedSymbol
      );
    });
  }

  // 🚀 [쓰레기/오타 URL 방어] 전체 데이터(100개 초과)가 로드된 상태에서 최초 진입 시 목록에 없는 유령 코인이면 BTC_FUTURES로 자동 폴백
  // 🔒 [보고 있는 코인 무한 락업] UID 0순위 일치 검사 및 Ticker/Symbol 일치 검사로 동명이인 코인까지 완벽 방어
  const isAlreadyViewing =
    (targetUid && store.currentSelectedUid && String(targetUid) === String(store.currentSelectedUid)) ||
    (rowInfo && store.currentSelectedUid && String(rowInfo.UID) === String(store.currentSelectedUid)) ||
    store.currentAsset === parsedSymbol ||
    store.currentSelectedSymbol === parsedSymbol ||
    (store.currentAsset && store.currentAsset.toUpperCase().includes(parsedSymbol)) ||
    (store.currentSelectedSymbol && store.currentSelectedSymbol.toUpperCase().includes(parsedSymbol));

  if (
    !rowInfo &&
    allSourceData.length > 100 &&
    !isAlreadyViewing &&
    parsedSymbol !== "BTC" &&
    parsedSymbol !== "BTCUSDT"
  ) {
    return selectSymbol("BINANCE:BTC_FUTURES");
  }

  const uniqueTicker = rowInfo ? rowInfo.Ticker : parsedSymbol;

  // 🚀 [신규 가드] 이미 선택된 코인을 클릭했거나, 이미 선택된 활성 거래소 뱃지를 클릭한 경우
  if (isRowClick && store.currentAsset === uniqueTicker) {
    // 🚀 [모바일 대응] 이미 선택된 코인이더라도 모바일에서는 네비게이션 및 오버레이를 '차트'로 확실히 전환
    const isTouch = typeof window.isTouchDevice === "function"
      ? window.isTouchDevice()
      : ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window) || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
    if (window.innerWidth < 1200 && isTouch) {
      if (typeof window.switchMobileTab === "function") {
        window.switchMobileTab("chart");
      } else if (typeof window.showMobileChart === "function") {
        window.showMobileChart();
      }
    }
    return;
  }
  if (
    forceMarket !== null &&
    store.currentSelectedSymbol === uniqueTicker &&
    store.currentChartMarket === forceMarket
  ) {
    return;
  }

  // 🚀 [INP 최적화 Phase 1] 클릭 즉시 실시간 버퍼 플러시 및 차트 잠금 활성화
  if (typeof window.flushRealtimeBuffers === "function") {
    window.flushRealtimeBuffers();
  }
  store.isFetchingChart = true;
  window.isFetchingChart = true;
  store.isUserZoomed = false;
  store.currentAsset = uniqueTicker;
  store.currentSelectedSymbol = uniqueTicker;
  store.currentSelectedUid = rowInfo ? rowInfo.UID : (targetUid || null);
  // 🚀 [UX 복원] 마지막 선택 코인 로컬 저장 및 최근 조회한 검색어 등록
  try {
    localStorage.setItem("sellnance_last_symbol", uniqueTicker);
  } catch (e) { }
  if (typeof window.addRecentSearch === "function") {
    window.addRecentSearch(uniqueTicker);
  }

  // 🚀 선택된 코인은 화면 가시 영역(30위 바깥)과 상관없이 무조건 실시간 시세 구독에 강제 등록
  if (store.visibleSymbols) {
    store.visibleSymbols.add(uniqueTicker);
    if (typeof window.syncSniperSubscriptions === "function") {
      window.syncSniperSubscriptions();
    }
  }

  // 🚀 주소창 해시 연동 (쌀먹 라우팅 최적화)
  let tempMarket = forceMarket || parsedMarket;
  if (tempMarket === "BINANCE") tempMarket = "SPOT";
  if (tempMarket === "BINANCE_FUTURES") tempMarket = "FUTURES";

  if (tempMarket && rowInfo && rowInfo.Listed_Exchanges) {
    const ex = rowInfo.Listed_Exchanges;
    let isValid = false;
    if (tempMarket === "FUTURES" && ex.includes("BINANCE_FUTURES"))
      isValid = true;
    else if (tempMarket === "SPOT" && ex.includes("BINANCE_SPOT")) isValid = true;
    else if (
      tempMarket === "UPBIT" &&
      (ex.includes("UPBIT") || rowInfo.Upbit === "O")
    )
      isValid = true;
    else if (tempMarket === "BITHUMB" && ex.includes("BITHUMB")) isValid = true;
    else if (tempMarket === "BYBIT" && ex.includes("BYBIT_SPOT")) isValid = true;
    else if (tempMarket === "BYBIT_FUTURES" && ex.includes("BYBIT_FUTURES"))
      isValid = true;
    else if ((tempMarket === "GATE_FUTURES" || tempMarket === "GATE_SPOT") && ["BTC", "ETH", "XRP"].includes(rowInfo.Symbol?.toUpperCase()))
      isValid = true;
    if (!isValid) tempMarket = null;
  }
  if (!tempMarket) {
    tempMarket = getChartDefaultMarket(rowInfo);
  }

  const symbolOnly = rowInfo ? rowInfo.Symbol : parsedSymbol;
  let targetPath = "/" + symbolOnly;
  if (tempMarket === "FUTURES") targetPath = `/BINANCE:${symbolOnly}_FUTURES`;
  else if (tempMarket === "SPOT") targetPath = `/BINANCE:${symbolOnly}_SPOT`;
  else if (tempMarket === "UPBIT") targetPath = `/UPBIT:${symbolOnly}`;
  else if (tempMarket === "BITHUMB") targetPath = `/BITHUMB:${symbolOnly}`;
  else if (tempMarket === "BYBIT_FUTURES")
    targetPath = `/BYBIT:${symbolOnly}_FUTURES`;
  else if (tempMarket === "BYBIT") targetPath = `/BYBIT:${symbolOnly}_SPOT`;
  else if (tempMarket === "GATE_FUTURES")
    targetPath = `/GATEIO:${symbolOnly}_FUTURES`;
  else if (tempMarket === "GATE_SPOT") targetPath = `/GATEIO:${symbolOnly}_SPOT`;

  if (window.history && window.history.pushState) {
    if (window.location.pathname !== targetPath && !window.location.hash) {
      window.history.pushState(null, null, targetPath);
    } else if (
      window.location.hash ||
      window.location.pathname !== targetPath
    ) {
      // 🚀 기존 #해시로 진입한 경우 깔끔한 트레이딩뷰 스타일 URL로 전환
      window.history.replaceState(null, null, targetPath);
    }
  }

  // 1. 검색창 닫기 및 입력값 동기화 (가벼운 DOM 조작 즉시 실행)
  const symInput = document.getElementById("symbol-input");
  // if (symInput) {
  //   symInput.value = rowInfo ? rowInfo.Symbol : s;
  // }
  const searchRes = document.getElementById("search-results");
  if (searchRes) searchRes.style.display = "none";

  // 🚀 [추가] 초기 안내 오버레이 숨기기
  const initMessage = document.getElementById("chart-init-message");
  if (initMessage) initMessage.style.display = "none";

  // 2. 리스트(목록) 행 즉시 하이라이트 반영 (시각적 피드백 선행)
  if (typeof applySelectedHighlight === "function") {
    applySelectedHighlight();
  }

  // 🚀 [INP 최적화 Phase 2] 무거운 배열 탐색, DOM 재생성, API 통신, 차트 렌더링(fetchHistory)을 다음 페인트 이후로 양보(Yielding)
  requestAnimationFrame(() => {
    setTimeout(() => {
      // 마켓 우선순위 결정
      store.currentChartMarket = tempMarket || getChartDefaultMarket(rowInfo);

      const p = store.getPrecision(uniqueTicker);
      const headAssetNames = document.querySelectorAll("#head-asset-name, #head-asset-name-pc");

      if (headAssetNames.length > 0) {
        let contentHtml = "";
        if (rowInfo) {
          const favorites = JSON.parse(
            localStorage.getItem("sellnance_favs") || "[]",
          );
          const favorites2 = JSON.parse(
            localStorage.getItem("sellnance_favs2") || "[]",
          );
          const isFav = favorites.includes(rowInfo.UID);
          const isFav2 = favorites2.includes(rowInfo.UID);

          let starText = "☆";
          let starColor = "gray";
          let starClass = "";
          if (isFav) {
            starText = "★";
            starColor = "#e3b30a"; // 🚀 노란색 고정 (라이트모드 파란색 오염 방어)
            starClass = "active";
          } else if (isFav2) {
            starText = "★";
            starColor = "#3b82f6";
            starClass = "active-blue";
          }

          const defaultDeerFallback = `<img src="${document.body?.classList.contains('theme-upbit') ? '/static/luma-deer-svg-light.svg' : '/static/luma-deer-svg-dark.svg'}" class="fallback-logo" loading="lazy" style="width: 24px; height: 24px; vertical-align: middle; border-radius: 50%;">`;
          const logoHtml = rowInfo.Logo || defaultDeerFallback;
          const pureSym = getPureBase(
            rowInfo.Symbol || rowInfo.DisplayTicker || rowInfo.Ticker,
          );
          const nameStr = (store.lang === "KR" ? rowInfo.Name_KR || rowInfo.Name : rowInfo.Name) || "";
          const fullText = nameStr ? `${pureSym} (${nameStr})` : pureSym;
          const len = fullText.length;
          // 수학적 로그 방식 적용: 10글자 초과 시 길이에 반비례하여 부드럽게 폰트 크기 축소 (기본 1.125rem, 최소 0.65rem)
          let fontSizeStyle = "";
          const fs = CONFIG.FONT_SCALE;

          if (fs && len > fs.ASSET_THRESHOLD) {
            const sizeRem = Math.max(
              fs.ASSET_MIN_REM,
              fs.ASSET_BASE_REM -
              Math.log10(len / fs.ASSET_THRESHOLD) * fs.ASSET_LOG_MULT,
            );
            fontSizeStyle = `style="font-size: ${sizeRem.toFixed(3)}rem; line-height: 1.1; word-break: break-all; white-space: normal;"`;
          } else {
            fontSizeStyle = `style="white-space: nowrap;"`;
          }

          contentHtml = `
            <div class="flex items-center gap-2">
              <button onclick="window.toggleFavorite('${rowInfo.UID}', event, true);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                ${starText}
              </button>
              <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                ${logoHtml}
              </div>
              <!-- 🚀 PC 전용 (>=1200px): 기존 1줄 표기 100% 원본 유지 -->
              <span class="hidden min-[1200px]:inline" ${fontSizeStyle}>${fullText}</span>
              <!-- 🚀 모바일 전용 (<1200px): 코인 이름을 무조건 아랫줄 2단으로 정렬 -->
              <div class="flex flex-col min-[1200px]:hidden leading-none min-w-0">
                <span class="text-sm sm:text-base font-extrabold tracking-wide truncate leading-tight text-theme-accent">${pureSym}</span>
                ${nameStr ? `<span class="text-[10px] text-theme-text/60 font-medium tracking-tight truncate leading-tight mt-0.5">${nameStr}</span>` : ""}
              </div>
            </div>
          `;
        } else {
          // 🚀 [신규] rowInfo 로드 대기 중(직접 URL 진입 등)에도 기본 깔끔한 심볼 표기
          const pureSym = getPureBase(uniqueTicker || parsedSymbol);
          contentHtml = `
            <div class="flex items-center gap-2">
              <span style="white-space: nowrap;">${pureSym}</span>
            </div>
          `;
        }

        headAssetNames.forEach((el) => {
          el.innerHTML = contentHtml;
        });

        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(rowInfo, undefined, p);
        }
      }

      updateExchangeBadges(uniqueTicker, rowInfo ? rowInfo.UID : null);

      // 🚀 호가창(Orderbook) 업데이트 (호가창 패널이 열려 있을 경우 자동 재연결)
      if (typeof window.startOrderbookStream === "function") {
        window.startOrderbookStream(uniqueTicker, store.currentChartMarket);
      }

      // 코인 상세 이름 비동기 패치 (메모리에 이름이 없을 때만 보조 패치)
      if (!rowInfo || !rowInfo.Name) {
        try {
          const querySym = rowInfo
            ? rowInfo.DisplayTicker
            : uniqueTicker || parsedSymbol || originalSym;
          fetch(`/api/coin-info/${encodeURIComponent(querySym)}`)
            .then((res) => res.json())
            .then((infoData) => {
              const headAssetElements = document.querySelectorAll(
                "#head-asset-name, #head-asset-name-pc",
              );
              if (headAssetElements.length > 0 && infoData && infoData.name) {
                const displaySym = getPureBase(
                  infoData.symbol ||
                  (rowInfo ? rowInfo.Symbol : querySym.split("(")[0]),
                );
                const favorites = JSON.parse(
                  localStorage.getItem("sellnance_favs") || "[]",
                );
                const favorites2 = JSON.parse(
                  localStorage.getItem("sellnance_favs2") || "[]",
                );
                const isFav = favorites.includes(
                  rowInfo ? rowInfo.UID : uniqueTicker,
                );
                const isFav2 = favorites2.includes(
                  rowInfo ? rowInfo.UID : uniqueTicker,
                );

                let starText = "☆";
                let starColor = "gray";
                let starClass = "";
                if (isFav) {
                  starText = "★";
                  starColor = "#e3b30a"; // 🚀 노란색 고정 (라이트모드 파란색 오염 방어)
                  starClass = "active";
                } else if (isFav2) {
                  starText = "★";
                  starColor = "#3b82f6";
                  starClass = "active-blue";
                }

                const logoHtml =
                  (rowInfo && rowInfo.Logo)
                    ? rowInfo.Logo
                    : `<img src="${document.body?.classList.contains('theme-upbit') ? '/static/luma-deer-svg-light.svg' : '/static/luma-deer-svg-dark.svg'}" class="fallback-logo" loading="lazy" style="width: 24px; height: 24px; vertical-align: middle; border-radius: 50%;">`;
                const nameStr2 = infoData.name || "";
                const fullText2 = nameStr2 ? `${displaySym} (${nameStr2})` : displaySym;
                const len2 = fullText2.length;
                let fontSizeStyle2 = "";
                if (len2 > 10) {
                  const sizeRem = Math.max(
                    0.65,
                    1.125 - Math.log10(len2 / 10) * 0.6,
                  );
                  fontSizeStyle2 = `style="font-size: ${sizeRem.toFixed(3)}rem; line-height: 1.1; word-break: break-all; white-space: normal;"`;
                } else {
                  fontSizeStyle2 = `style="white-space: nowrap;"`;
                }

                const updateHtml2 = `
                  <div class="flex items-center gap-2">
                    <button onclick="window.toggleFavorite('${rowInfo ? rowInfo.UID : uniqueTicker}', event, true);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                      ${starText}
                    </button>
                    <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                      ${logoHtml}
                    </div>
                    <!-- 🚀 PC 전용 (>=1200px): 기존 1줄 표기 100% 원본 유지 -->
                    <span class="hidden min-[1200px]:inline" ${fontSizeStyle2}>${fullText2}</span>
                    <!-- 🚀 모바일 전용 (<1200px): 코인 이름을 무조건 아랫줄 2단으로 정렬 -->
                    <div class="flex flex-col min-[1200px]:hidden leading-none min-w-0">
                      <span class="text-sm sm:text-base font-extrabold tracking-wide truncate leading-tight text-theme-accent">${displaySym}</span>
                      ${nameStr2 ? `<span class="text-[10px] text-theme-text/60 font-medium tracking-tight truncate leading-tight mt-0.5">${nameStr2}</span>` : ""}
                    </div>
                  </div>
                `;
                headAssetElements.forEach((el) => {
                  el.innerHTML = updateHtml2;
                });
              }
            })
            .catch((e) => console.error("이름 로드 실패", e));
        } catch (e) {
          console.error("이름 로드 에러", e);
        }
      }

      // 리스트 스크롤 이동 및 가상 렌더 리밋 확장 (555등, 777등 등 깊은 순위 대응)
      const sortedList = store.currentTableData || [];
      const targetIdx = sortedList.findIndex(
        (item) =>
          item.DisplayTicker === uniqueTicker ||
          item.Ticker === uniqueTicker ||
          (rowInfo && item.UID === rowInfo.UID),
      );

      if (targetIdx !== -1) {
        if (targetIdx >= store.currentRenderLimit) {
          store.currentRenderLimit = Math.max(store.currentRenderLimit, targetIdx + 30);
          if (typeof renderTable === "function") renderTable();
        }
        setTimeout(() => {
          store.currentSelectedSymbol = uniqueTicker;
          if (typeof applySelectedHighlight === "function") {
            applySelectedHighlight();
          }
          if (shouldScroll) {
            const targetRow =
              document.querySelector(`#coin-list-body > div[data-sym="${uniqueTicker}"]`) ||
              (rowInfo?.UID ? document.querySelector(`#coin-list-body > div[data-uid="${rowInfo.UID}"]`) : null) ||
              (store.rowDomMap ? store.rowDomMap.get(uniqueTicker) || (rowInfo?.UID ? store.rowDomMap.get(String(rowInfo.UID)) : null) : null);
            if (targetRow && targetRow.style.display !== "none") {
              targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          }
        }, 50);
      }

      // 🚀 [핵심] 차트 데이터 패치 실행 (메인 스레드 경합 완벽 해소)
      if (typeof fetchHistory === "function") {
        fetchHistory(uniqueTicker, false, false, false, rowInfo?.UID);
      }

      // 🚀 [추가] 코인 선택 시 실시간 정렬 엔진 강제 점화 및 즉시 적용
      if (typeof window.applyRealtimeSort === "function") {
        window.applyRealtimeSort();
      }

      // 🚀 모바일 터치 환경(1200px 미만 & 터치 기기)일 경우: 행 직접 터치(isRowClick) 또는 차트 탭 활성 상태일 때만 차트 오버레이 열기
      const isTouch = typeof window.isTouchDevice === "function"
        ? window.isTouchDevice()
        : ((window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window) || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

      if (window.innerWidth < 1200 && isTouch) {
        let activeTab = "list";
        try {
          activeTab = sessionStorage.getItem("sellnance_active_mobile_tab") || "list";
        } catch (e) { }

        if (isRowClick || activeTab === "chart") {
          try {
            sessionStorage.setItem("sellnance_active_mobile_tab", "chart");
          } catch (e) { }
          if (typeof window.switchMobileTab === "function") {
            window.switchMobileTab("chart");
          } else if (typeof window.showMobileChart === "function") {
            window.showMobileChart();
          }
          window.dispatchEvent(
            new CustomEvent("mobile-tab-changed", { detail: "chart" }),
          );
        }
      }
    }, 0);
  });
}

export function updateExchangeBadges(s, targetUid = null) {
  let rowInfo = null;
  const effUid = targetUid || store.currentSelectedUid;
  if (effUid) {
    rowInfo = store.currentTableData.find((c) => String(c.UID) === String(effUid));
  }
  if (!rowInfo) {
    rowInfo = store.currentTableData.find(
      (c) => c.DisplayTicker === s || c.Ticker === s,
    );
  }
  let badges = "";
  if (rowInfo) {
    const list = [
      {
        id: "B-SPOT",
        name: "바이낸스 현물",
        cmcId: 270,
        market: "SPOT",
        type: "SPOT",
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("BINANCE_SPOT")),
      },
      {
        id: "B-FUT",
        name: "바이낸스 선물",
        cmcId: 270,
        market: "FUTURES",
        type: "FUTURE",
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("BINANCE_FUTURES")),
      },
      {
        id: "UPBIT",
        name: "업비트",
        cmcId: 351,
        market: "UPBIT",
        type: null,
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("UPBIT")),
      },
      {
        id: "BITHUMB",
        name: "빗썸",
        cmcId: 200,
        market: "BITHUMB",
        type: null,
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("BITHUMB")),
      },
      {
        id: "BYBIT-SPOT",
        name: "바이비트 현물",
        cmcId: 521,
        market: "BYBIT",
        type: "SPOT",
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("BYBIT_SPOT")),
      },
      {
        id: "BYBIT-FUT",
        name: "바이비트 선물",
        cmcId: 521,
        market: "BYBIT_FUTURES",
        type: "FUTURE",
        condition: Boolean(rowInfo.Listed_Exchanges?.includes("BYBIT_FUTURES")),
      },
      {
        id: "GATE-SPOT",
        name: "Gate.io 현물",
        cmcId: 302,
        market: "GATE_SPOT",
        type: "SPOT",
        condition: ["BTC", "ETH", "XRP"].includes(rowInfo.Symbol?.toUpperCase()),
        isBeta: true,
      },
      {
        id: "GATE-FUT",
        name: "Gate.io 선물",
        cmcId: 302,
        market: "GATE_FUTURES",
        type: "FUTURE",
        condition: ["BTC", "ETH", "XRP"].includes(rowInfo.Symbol?.toUpperCase()),
        isBeta: true,
      },
    ];

    // 🚀 활성 거래소(좌측 우선) -> 비활성 거래소(우측 순차) 정렬
    const sortedList = [
      ...list.filter((item) => item.condition),
      ...list.filter((item) => !item.condition),
    ];

    sortedList.forEach((item) => {
      const imgUrl = `https://s2.coinmarketcap.com/static/img/exchanges/64x64/${item.cmcId}.png`;
      const isCurrentActive = store.currentChartMarket === item.market;

      if (item.condition) {
        // 🌟 활성 거래소 배지
        const ringClass = isCurrentActive
          ? "ring-2 ring-white scale-105 shadow-lg brightness-110 opacity-100"
          : "opacity-60 hover:opacity-100 hover:scale-105";

        let typeBadge = "";
        if (item.type === "SPOT") {
          typeBadge = `<div class="absolute -bottom-1 -right-1.5 bg-zinc-900 text-white text-[8px] px-1.5 py-0.5 rounded-[3px] border border-white/30 leading-none font-black shadow-[0_1px_3px_rgba(0,0,0,0.5)] whitespace-nowrap select-none tracking-tight">SPOT</div>`;
        } else if (item.type === "FUTURE") {
          typeBadge = `<div class="absolute -bottom-1 -right-1.5 bg-[#f0b90b] text-black text-[8px] px-1.5 py-0.5 rounded-[3px] leading-none font-black shadow-[0_1px_3px_rgba(0,0,0,0.5)] whitespace-nowrap select-none tracking-tight">FUTURE</div>`;
        }

        let betaBadge = "";
        if (item.isBeta) {
          betaBadge = `<div class="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center font-bold leading-none shadow-[0_1px_3px_rgba(0,0,0,0.5)] select-none z-10 border border-blue-400/50 whitespace-nowrap">beta</div>`;
        }

        badges += `
          <button onclick="selectSymbol('${rowInfo.Ticker}', '${item.market}', '${rowInfo.UID}')" 
                  title="${item.name}${item.isBeta ? ' (Beta)' : ''}"
                  class="relative flex items-center justify-center p-1 border border-theme-border/30 rounded-xl transition-all duration-200 w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 flex-shrink-0 cursor-pointer select-none active:scale-95 ${ringClass}">
            <img src="${imgUrl}" alt="${item.id}" class="w-full h-full object-contain rounded" />
            ${betaBadge}
            ${typeBadge}
          </button>
        `;
      } else {
        // 🔒 비활성 거래소 배지 (미상장/미지원) - 어둡게 + 클릭 금지 + 점선 테두리
        let typeBadge = "";
        if (item.type === "SPOT") {
          typeBadge = `<div class="absolute -bottom-1 -right-1.5 bg-zinc-800 text-zinc-400 text-[8px] px-1.5 py-0.5 rounded-[3px] border border-zinc-700/50 leading-none font-black opacity-60 whitespace-nowrap select-none tracking-tight">SPOT</div>`;
        } else if (item.type === "FUTURE") {
          typeBadge = `<div class="absolute -bottom-1 -right-1.5 bg-zinc-800 text-zinc-400 text-[8px] px-1.5 py-0.5 rounded-[3px] border border-zinc-700/50 leading-none font-black opacity-60 whitespace-nowrap select-none tracking-tight">FUT</div>`;
        }

        badges += `
          <button disabled
                  title="${item.name} (미지원/미상장)"
                  class="relative flex items-center justify-center p-1 border border-dashed border-theme-border/25 rounded-xl w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 flex-shrink-0 opacity-20 grayscale brightness-50 cursor-not-allowed select-none pointer-events-none">
            <img src="${imgUrl}" alt="${item.id}" class="w-full h-full object-contain rounded opacity-40" />
            ${typeBadge}
          </button>
        `;
      }
    });
  }

  const badgeContainer = document.getElementById("exchange-badges");
  if (badgeContainer) {
    badgeContainer.innerHTML = badges;
    if (typeof window.updateElementScrollMask === "function") {
      requestAnimationFrame(() => window.updateElementScrollMask(badgeContainer));
    }
  }
}

window.selectSymbol = selectSymbol;
window.updateExchangeBadges = updateExchangeBadges;
