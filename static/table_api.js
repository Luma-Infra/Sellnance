// table_api.js
import { store } from "./_store.js";

// 1. 데이터 로드 함수
export async function loadTableData(force = false, silent = false) {
  const modal = document.getElementById("loading-modal");
  const updateTimeSpan = document.getElementById("update-time");

  if (!silent && modal) {
    modal.classList.remove("hidden");
  }
  // updateTimeSpan.innerText = "업데이트 중...";

  try {
    // Xconsole.log("1. 파이썬 서버에 테이블 데이터 요청 시작!"); // ⭐️ 추가
    const res = await fetch(`/api/market-data?force=${force}`);
    // Xconsole.log("2. 파이썬 서버가 응답 완료!"); // ⭐️ 추가
    const result = await res.json();
    // updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;

    store.originalTableData = JSON.parse(JSON.stringify(result.data)); // 🛡️ 철벽 방어 원본
    store.currentTableData = JSON.parse(JSON.stringify(result.data)); // 🏃 실시간 작업용

    // 🚀 [신규] 상태 데이터 동기화
    if (result.active_users !== undefined) {
      store.activeUsers = result.active_users;
      if (typeof window.updateStatusBadge === "function") window.updateStatusBadge();
    }
    if (result.last_updated_raw !== undefined) {
      store.lastUpdatedRaw = result.last_updated_raw;
    }

    store.tickerRowMap.clear();
    store.currentTableData.forEach((row) => {
      row.DisplayTicker = (row.DisplayTicker || row.Symbol)
        .toString()
        .toUpperCase();
      if (row.Ticker) store.tickerRowMap.set(row.Ticker.toUpperCase(), row);
      if (row.DisplayTicker)
        store.tickerRowMap.set(row.DisplayTicker.toUpperCase(), row);
      // 🚀 [오류 방어] 중복 가능성이 높은 일반 Symbol로 단일 Map 덮어쓰기 금지! (동명이인 코인 가격 오염 원인 제거)
    });

    if (store.currentSortCol && store.sortState !== "") {
      // 1. 순위 재계산 (경주마 로직 실행)
      if (typeof window.applyRealtimeSort === "function")
        window.applyRealtimeSort();
    } else {
      // 2. 정렬 상태가 아니면 그냥 평소대로 그리기
      if (typeof window.renderTable === "function") window.renderTable();
    }
  } catch (error) {
    console.error("데이터 로드 에러:", error);
    alert("서버에서 데이터를 가져오지 못했습니다.");
    if (updateTimeSpan) updateTimeSpan.innerText = "업데이트 실패";
  } finally {
    if (modal) {
      modal.classList.add("hidden");
    }
  }
}

// 🚀 [HTS급 사일런트 백그라운드 동기화 엔진] 1분마다 로딩 모달 없이 메모리에서 조용히 파이썬 서버 데이터를 낚아채와 테이블 전체 장부(펀딩비, 시총 등)를 갱신합니다!
export async function loadTableDataSilent() {
  try {
    const res = await fetch("/api/market-data-silent");
    if (!res.ok) return;
    const result = await res.json();

    if (result && result.data) {
      store.originalTableData = JSON.parse(JSON.stringify(result.data));

      const freshUidMap = new Map(result.data.map((item) => [item.UID, item]));
      let needReRender = false;

      // 1. 기존 장부 순회하며 값 업데이트 및 Ticker 교체 처리
      store.currentTableData.forEach((row) => {
        let fresh = freshUidMap.get(row.UID);
        if (!fresh && row.Symbol) {
          fresh = result.data.find(item => item.Symbol === row.Symbol);
        }

        if (fresh) {
          if (row.Ticker !== fresh.Ticker) {
            // Ticker가 변경된 경우 (예: TAIKOKRW -> TAIKO/TAIKOUSDT)
            if (row.Ticker) store.tickerRowMap.delete(row.Ticker.toUpperCase());
            if (row.DisplayTicker) store.tickerRowMap.delete(row.DisplayTicker.toUpperCase());

            Object.assign(row, fresh);

            row.DisplayTicker = (row.DisplayTicker || row.Symbol)
              .toString()
              .toUpperCase();

            if (row.Ticker) store.tickerRowMap.set(row.Ticker.toUpperCase(), row);
            if (row.DisplayTicker) store.tickerRowMap.set(row.DisplayTicker.toUpperCase(), row);

            needReRender = true;
          } else {
            row.Funding_Raw = fresh.Funding_Raw;
            row.Funding_Formatted = fresh.Funding_Formatted;
            row.MarketCap_Raw = fresh.MarketCap_Raw;
            row.MarketCap_Formatted = fresh.MarketCap_Formatted;
            row.VMC_Raw = fresh.VMC_Raw;
            row.VMC_Formatted = fresh.VMC_Formatted;
            row.Basis_Raw = fresh.Basis_Raw;
            row.Basis_Formatted = fresh.Basis_Formatted;
          }
        }
      });

      const currentUids = new Set(store.currentTableData.map((d) => d.UID));
      const currentTickers = new Set(store.currentTableData.map((d) => d.Ticker));

      // 2. 신규 유입 코인만 찾아서 장부에 꽂아넣기
      result.data.forEach((freshItem) => {
        if (!currentUids.has(freshItem.UID) && !currentTickers.has(freshItem.Ticker)) {
          // Xconsole.log(`➕ [사일런트 동기화] 신규 코인 장부 주입: ${freshItem.Ticker}`,);

          freshItem.DisplayTicker = (
            freshItem.DisplayTicker || freshItem.Symbol
          )
            .toString()
            .toUpperCase();
          store.currentTableData.push(freshItem);

          // 맵핑 캐시 동기화
          if (freshItem.Ticker)
            store.tickerRowMap.set(freshItem.Ticker.toUpperCase(), freshItem);
          if (freshItem.DisplayTicker)
            store.tickerRowMap.set(
              freshItem.DisplayTicker.toUpperCase(),
              freshItem,
            );
          // 🚀 [오류 방어] Symbol 단일 매핑 금지

          needReRender = true;
        }
      });

      // 3. 신규 주입이 이루어졌다면 테이블 즉각 갱신
      if (needReRender && typeof window.renderTable === "function") {
        window.renderTable();
      }

      // 🚀 [신규] 사일런트 갱신 시 상태 바 업데이트
      if (result.active_users !== undefined) {
        store.activeUsers = result.active_users;
        if (typeof window.updateStatusBadge === "function") window.updateStatusBadge();
      }
      if (result.last_updated_raw !== undefined) {
        store.lastUpdatedRaw = result.last_updated_raw;
      }

      const updateTimeSpan = document.getElementById("update-time");
      if (updateTimeSpan) 0;
      // updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;
    }
  } catch (e) {
    console.error("사일런트 갱신 오류:", e);
  }
}

// 5분
setInterval(loadTableDataSilent, 300000);
