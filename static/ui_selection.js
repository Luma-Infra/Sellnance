// ui_selection.js
// --- 🪙 코인 선택 및 거래소 배지 업데이트 전담 모듈 ---
import { store, CONFIG } from "./_store.js";
import { fetchHistory } from "./chart_data.js";
import { getPureBase } from "./chart_utils.js";

export function selectSymbol(s, forceMarket = null, targetUid = null, isRowClick = false) {
  if (!s) return;
  const allSourceData = store.currentTableData || store.originalTableData || [];

  // 1. suffix 및 순수 심볼 파싱
  let parsedSymbol = String(s).toUpperCase();
  let parsedMarket = null;

  if (parsedSymbol.endsWith("KRW")) {
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
  if (!rowInfo) {
    // 2-1. 1차 패스: 정확히 일치(Exact Match)하는 대상을 우선 검색
    rowInfo = allSourceData.find((c) => c.UID === s || c.Ticker === s || c.DisplayTicker === s || c.Symbol === s);
  }
  if (!rowInfo) {
    // 2-2. 2차 패스: 접미사(KRW, USDT 등)를 제거하고 유연하게 검색
    rowInfo = allSourceData.find((c) => {
      const t = (c.Ticker || "").toUpperCase();
      const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);

      const dt = (c.DisplayTicker || "").toUpperCase();
      const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);

      const sym = (c.Symbol || "").toUpperCase();
      const cleanSym = sym.endsWith("KRW") ? sym.slice(0, -3) : (sym.endsWith("USDT") ? sym.slice(0, -4) : sym);

      return cleanT === parsedSymbol || cleanDt === parsedSymbol || cleanSym === parsedSymbol;
    });
  }

  const uniqueTicker = rowInfo ? rowInfo.Ticker : s;

  // 🚀 [신규 가드] 이미 선택된 코인을 클릭했거나, 이미 선택된 활성 거래소 뱃지를 클릭한 경우 조기 리턴하여 불필요한 차트 초기화 및 리로드 차단
  if (isRowClick && store.currentAsset === uniqueTicker) {
    return;
  }
  if (forceMarket !== null && store.currentSelectedSymbol === uniqueTicker && store.currentChartMarket === forceMarket) {
    return;
  }

  // 🚀 [INP 최적화 Phase 1] 클릭 즉시 최소한의 상태만 변경하고 즉각 시각적 피드백 제공 (Next Paint 0~16ms 달성!)
  store.isFetchingChart = false;
  window.isFetchingChart = false;
  store.isUserZoomed = false;
  store.currentAsset = uniqueTicker;
  store.currentSelectedSymbol = uniqueTicker;

  // 🚀 선택된 코인은 화면 가시 영역(30위 바깥)과 상관없이 무조건 실시간 시세 구독에 강제 등록
  if (store.visibleSymbols) {
    store.visibleSymbols.add(uniqueTicker);
    if (typeof window.syncSniperSubscriptions === "function") {
      window.syncSniperSubscriptions();
    }
  }

  // 🚀 주소창 해시 연동 (쌀먹 라우팅 최적화)
  let tempMarket = forceMarket || parsedMarket;
  if (tempMarket && rowInfo && rowInfo.Listed_Exchanges) {
    const ex = rowInfo.Listed_Exchanges;
    let isValid = false;
    if (tempMarket === "FUTURES" && ex.includes("BINANCE_FUTURES")) isValid = true;
    else if (tempMarket === "SPOT" && ex.includes("BINANCE")) isValid = true;
    else if (tempMarket === "UPBIT" && (ex.includes("UPBIT") || rowInfo.Upbit === "O")) isValid = true;
    else if (tempMarket === "BITHUMB" && ex.includes("BITHUMB")) isValid = true;
    else if (tempMarket === "BYBIT" && ex.includes("BYBIT")) isValid = true;
    else if (tempMarket === "BYBIT_FUTURES" && ex.includes("BYBIT_FUTURES")) isValid = true;
    if (!isValid) tempMarket = null;
  }
  if (!tempMarket && rowInfo && rowInfo.Listed_Exchanges) {
    const ex = rowInfo.Listed_Exchanges;
    if (store.filterMode === "UPBIT" && ex.includes("UPBIT")) {
      tempMarket = "UPBIT";
    } else if (ex.includes("BINANCE_FUTURES")) {
      tempMarket = "FUTURES";
    } else if (ex.includes("BINANCE")) {
      tempMarket = "SPOT";
    } else if (ex.includes("UPBIT")) {
      tempMarket = "UPBIT";
    } else if (ex.includes("BITHUMB")) {
      tempMarket = "BITHUMB";
    } else if (ex.includes("BYBIT")) {
      tempMarket = "BYBIT";
    }
  }

  const symbolOnly = rowInfo ? rowInfo.Symbol : parsedSymbol;
  const targetHash = "#" + symbolOnly;

  if (window.history && window.history.pushState) {
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, null, targetHash);
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
      if (tempMarket) {
        store.currentChartMarket = tempMarket;
      } else if (rowInfo && rowInfo.Listed_Exchanges) {
        const ex = rowInfo.Listed_Exchanges;
        const isQuoteCurrency = uniqueTicker.startsWith("USDT");

        // 🚀 [추가] 필터 모드가 UPBIT이면 무조건 업비트를 최우선으로 잡도록 분기 처리
        if (store.filterMode === "UPBIT" && ex.includes("UPBIT")) {
          store.currentChartMarket = "UPBIT";
        } else if (
          isQuoteCurrency &&
          (ex.includes("UPBIT") || ex.includes("BITHUMB"))
        ) {
          store.currentChartMarket = ex.includes("UPBIT") ? "UPBIT" : "BITHUMB";
        } else if (ex.includes("BINANCE_FUTURES")) {
          store.currentChartMarket = "FUTURES";
        } else if (ex.includes("BINANCE")) {
          store.currentChartMarket = "SPOT";
        } else if (ex.includes("UPBIT")) {
          store.currentChartMarket = "UPBIT";
        } else if (ex.includes("BITHUMB")) {
          store.currentChartMarket = "BITHUMB";
        } else if (ex.includes("BYBIT")) {
          store.currentChartMarket = "BYBIT";
        }
      }

      const p = store.getPrecision(uniqueTicker);
      const headAssetName = document.getElementById("head-asset-name");

      if (rowInfo) {
        if (headAssetName) {
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

          const logoHtml = rowInfo.Logo || "";
          const fullText = `${rowInfo.Symbol} (${rowInfo.Name || ""})`;
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

          headAssetName.innerHTML = `
            <div class="flex items-center gap-2">
              <button onclick="window.toggleFavorite('${rowInfo.UID}', event, true); setTimeout(() => window.selectSymbol('${uniqueTicker}'), 50);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                ${starText}
              </button>
              <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                ${logoHtml}
              </div>
              <span ${fontSizeStyle}>${fullText}</span>
            </div>
          `;
        }

        if (typeof window.updateHeaderDisplay === "function") {
          window.updateHeaderDisplay(rowInfo, undefined, p);
        }
      }

      updateExchangeBadges(uniqueTicker, rowInfo ? rowInfo.UID : null);

      // 🚀 호가창(Orderbook) 업데이트 (호가창 패널이 열려 있을 경우 자동 재연결)
      if (typeof window.startOrderbookStream === "function") {
        window.startOrderbookStream(uniqueTicker, store.currentChartMarket);
      }

      // 코인 상세 이름 비동기 패치
      try {
        const querySym = rowInfo ? rowInfo.DisplayTicker : uniqueTicker;
        fetch(`/api/coin-info/${querySym}`)
          .then((res) => res.json())
          .then((infoData) => {
            if (headAssetName && infoData.name) {
              const displaySym =
                infoData.symbol ||
                (rowInfo ? rowInfo.Symbol : querySym.split("(")[0]);
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

              const logoHtml = rowInfo ? rowInfo.Logo || "" : "";
              const fullText2 = `${displaySym} (${infoData.name})`;
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

              headAssetName.innerHTML = `
                <div class="flex items-center gap-2">
                  <button onclick="window.toggleFavorite('${rowInfo ? rowInfo.UID : uniqueTicker}', event, true); setTimeout(() => window.selectSymbol('${uniqueTicker}'), 50);" class="star-btn text-[16px] transition-all hover:scale-125 flex-shrink-0 ${starClass}" style="color: ${starColor}">
                    ${starText}
                  </button>
                  <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                    ${logoHtml}
                  </div>
                  <span ${fontSizeStyle2}>${fullText2}</span>
                </div>
              `;
            }
          })
          .catch((e) => console.error("이름 로드 실패", e));
      } catch (e) {
        console.error("이름 로드 에러", e);
      }

      // 리스트 스크롤 이동
      const sortedList = store.currentTableData;
      const targetIdx = sortedList.findIndex(
        (item) =>
          item.DisplayTicker === uniqueTicker || item.Ticker === uniqueTicker,
      );

      if (targetIdx !== -1) {
        if (targetIdx >= store.currentRenderLimit) {
          store.currentRenderLimit = targetIdx + 1;
          if (typeof renderTable === "function") renderTable();
        }
        setTimeout(() => {
          store.currentSelectedSymbol = uniqueTicker;
          const targetRow = document.querySelector(
            `#coin-list-body > div[data-sym="${uniqueTicker}"]`,
          );
          if (targetRow) {
            // targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
            if (typeof applySelectedHighlight === "function")
              applySelectedHighlight();
          }
        }, 50);
      }

      // 🚀 [핵심] 차트 데이터 패치 실행 (메인 스레드 경합 완벽 해소)
      if (typeof fetchHistory === "function") {
        fetchHistory(uniqueTicker, false, false);
      }

      // 🚀 [추가] 코인 선택 시 실시간 정렬 엔진 강제 점화 및 즉시 적용
      if (typeof window.applyRealtimeSort === "function") {
        window.applyRealtimeSort();
      }
    }, 0);
  });
}

export function updateExchangeBadges(s, targetUid = null) {
  let rowInfo = null;
  if (targetUid) {
    rowInfo = store.currentTableData.find((c) => c.UID === targetUid);
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
        id: "B-FUT",
        label: "B-FUT",
        bg: "bg-[#f0b90b]",
        text: "text-black",
        market: "FUTURES",
        condition: rowInfo.Listed_Exchanges?.includes("BINANCE_FUTURES"),
      },
      {
        id: "B-SPOT",
        label: "B-SPOT",
        bg: "bg-[#444]",
        text: "text-white",
        market: "SPOT",
        condition: rowInfo.Listed_Exchanges?.includes("BINANCE"),
      },
      {
        id: "BYBIT-FUT",
        label: "BYBIT-FUT",
        bg: "bg-[#f5a800]",
        text: "text-black",
        market: "BYBIT_FUTURES",
        condition: rowInfo.Listed_Exchanges?.includes("BYBIT_FUTURES"),
      },
      {
        id: "BYBIT-SPOT",
        label: "BYBIT-SPOT",
        bg: "bg-[#444]",
        text: "text-white",
        market: "BYBIT",
        condition: rowInfo.Listed_Exchanges?.includes("BYBIT"),
      },
      {
        id: "UPBIT",
        label: "UPBIT",
        bg: "bg-[#093687]",
        text: "text-white",
        market: "UPBIT",
        condition:
          rowInfo.Listed_Exchanges?.includes("UPBIT") || rowInfo.Upbit === "O",
      },
      {
        id: "BITHUMB",
        label: "BITHUMB",
        bg: "bg-[#ff8b00]",
        text: "text-white",
        market: "BITHUMB",
        condition: rowInfo.Listed_Exchanges?.includes("BITHUMB"),
      },
    ];

    list.forEach((item) => {
      if (item.condition) {
        // Highlight active market badge
        const isActive = store.currentChartMarket === item.market;
        const ringClass = isActive
          ? "ring-2 ring-white scale-105 shadow-lg brightness-110"
          : "opacity-60 hover:opacity-100 hover:scale-105";
        badges += `<button onclick="selectSymbol('${rowInfo.Ticker}', '${item.market}', '${rowInfo.UID}')" class="${item.bg} ${item.text} ${ringClass} text-[11px] font-bold px-2.5 py-1 rounded transition-all duration-200 cursor-pointer select-none active:scale-95 ml-1.5 first:ml-0">${item.label}</button>`;
      }
    });
  }

  const badgeContainer = document.getElementById("exchange-badges");
  if (badgeContainer) badgeContainer.innerHTML = badges;
}

window.selectSymbol = selectSymbol;
window.updateExchangeBadges = updateExchangeBadges;
