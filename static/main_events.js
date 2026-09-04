// main_events.js
// ⌨️ 키보드 단축키, 검색창 탐색, 슬라이더/버튼 UI 이벤트 및 포커스 관리 모듈

import { store } from "./_store.js";
import { selectSymbol } from "./ui_control.js";

// 💡 슬라이더 로직 (가독성을 위해 분리)
export function setupSliderEvents() {
  ["body", "top", "bottom"].forEach((id) => {
    const inputEl = document.getElementById("input-" + id);
    if (inputEl) {
      inputEl.oninput = () => {
        const val = inputEl.value;
        const valEl = document.getElementById("val-" + id);
        if (valEl) valEl.innerText = val + "%";
        if (id === "body") {
          if (store.curDir === "bull") store.bullBody = val;
          else store.bearBody = val;
        }
        if (typeof window.updateStatus === "function") window.updateStatus();
        if (store.isHover && typeof window.updatePreview === "function")
          window.updatePreview();
      };
    }
  });
}

// 💡 버튼 호버 로직
export function setupButtonEvents() {
  const genBtn = document.getElementById("btn-generate");
  if (genBtn) {
    genBtn.onmouseenter = () => {
      store.isHover = true;
      if (typeof window.updatePreview === "function") window.updatePreview();
    };
    genBtn.onmouseleave = () => {
      store.isHover = false;
      if (store.previewSeries) store.previewSeries.setData([]);
    };
  }

  // 🚀 flip-toggle (경주마 애니메이션) UI 바인딩
  const flipToggle = document.getElementById("flip-toggle");
  if (flipToggle) {
    store.useFlip = flipToggle.checked;
    flipToggle.addEventListener("change", (e) => {
      store.useFlip = e.target.checked;
    });
  }
}

// 💡 검색창 내 방향키 위/아래 이동 및 엔터 선택 로직 (눈에 보이는 절대 인덱스 기준 완전 동기화)
export function setupSearchNavigation() {
  const symbolInput = document.getElementById("symbol-input");
  if (!symbolInput) return;

  let activeIndex = -1;

  const resetActiveIndex = () => {
    activeIndex = -1;
    const resDiv = document.getElementById("search-results");
    if (resDiv) {
      const items = Array.from(resDiv.children);
      updateHighlight(items, -1);
    }
  };

  symbolInput.addEventListener("input", () => {
    activeIndex = -1;
  });

  symbolInput.addEventListener("keydown", (e) => {
    const resDiv = document.getElementById("search-results");
    if (!resDiv || resDiv.style.display === "none") return;

    const items = Array.from(resDiv.children).filter(
      (item) => item.style.display !== "none",
    );
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateHighlight(items, activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateHighlight(items, activeIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].click();
      } else if (items.length > 0) {
        items[0].click();
      }
      resetActiveIndex();
    } else if (e.key === "Escape") {
      resDiv.style.display = "none";
      resetActiveIndex();
    }
  });

  function updateHighlight(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
        item.style.color = "#0ecb81";
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.style.backgroundColor = "";
        item.style.color = "";
      }
    });
  }
}

// 🚀 전역 키보드 및 클릭 이벤트 등록
export function initGlobalEventListeners() {
  // 검색창 바깥 클릭 시 닫기
  document.addEventListener("click", (e) => {
    const searchResults = document.getElementById("search-results");
    const symbolInput = document.getElementById("symbol-input");

    if (
      searchResults &&
      symbolInput &&
      !symbolInput.contains(e.target) &&
      !searchResults.contains(e.target)
    ) {
      searchResults.style.display = "none";
    }
  });

  // 정렬 순서 퀵 서칭 탐색 및 타임프레임 변경 엔진 (방향키 이벤트)
  document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return;

    const up = e.key === "ArrowUp";
    const down = e.key === "ArrowDown";
    const left = e.key === "ArrowLeft";
    const right = e.key === "ArrowRight";

    // 1. 좌우 방향키: 타임프레임(TF) 퀵 스위칭
    if (left || right) {
      e.preventDefault();
      const tfArray =
        store.visibleTfs && store.visibleTfs.length > 0
          ? store.visibleTfs
          : [
            "1m",
            "3m",
            "5m",
            "15m",
            "30m",
            "1h",
            "4h",
            "12h",
            "1d",
            "3d",
            "1w",
            "1M",
          ];
      let idx = tfArray.indexOf(store.currentTF);
      if (left && idx > 0 && typeof window.setTF === "function")
        window.setTF(tfArray[idx - 1]);
      else if (
        right &&
        idx < tfArray.length - 1 &&
        typeof window.setTF === "function"
      )
        window.setTF(tfArray[idx + 1]);
      return;
    }

    // 2. 상하 방향키: 테이블 리스트 탐색
    if (up || down) {
      e.preventDefault();

      let sortedList = [];
      if (typeof window.getFilteredData === "function") {
        sortedList = window.getFilteredData();
      } else {
        sortedList = store.currentTableData || [];
      }

      if (sortedList.length === 0) return;

      let currentIdx = sortedList.findIndex(
        (item) => item.Ticker === store.currentSelectedSymbol,
      );

      let nextCoin = null;

      if (currentIdx === -1) {
        nextCoin = sortedList[0];
      } else {
        let targetIdx = up ? currentIdx - 1 : currentIdx + 1;

        if (down && targetIdx >= store.currentRenderLimit) {
          store.currentRenderLimit = Math.min(
            sortedList.length,
            store.currentRenderLimit + 15,
          );
          if (typeof window.renderTable === "function") window.renderTable();
        }

        if (targetIdx >= 0 && targetIdx < sortedList.length) {
          nextCoin = sortedList[targetIdx];
        }
      }

      if (nextCoin) {
        store.currentSelectedSymbol = nextCoin.Ticker;
        selectSymbol(nextCoin.Ticker, null, nextCoin.UID);

        setTimeout(() => {
          const targetRow = document.querySelector(
            `#coin-list-body .coin-row[data-sym="${nextCoin.Ticker}"]`,
          );
          if (targetRow) {
            targetRow.scrollIntoView({ block: "nearest", behavior: "instant" });
          }
          if (typeof window.applySelectedHighlight === "function") {
            window.applySelectedHighlight();
          }
        }, 30);
        return;
      }
    }
  });
}
