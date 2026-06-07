The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
// table_api.js
import { store } from "./_store.js";

// 1. 데이터 로드 함수
export async function loadTableData(force = false) {
  const modal = document.getElementById("loading-modal");
  const updateTimeSpan = document.getElementById("update-time");

  modal.classList.remove("hidden");
  // updateTimeSpan.innerText = "업데이트 중...";

  try {
    console.log("1. 파이썬 서버에 테이블 데이터 요청 시작!"); // ⭐️ 추가
    const res = await fetch(`/api/market-data?force=${force}`);
    console.log("2. 파이썬 서버가 응답 완료!"); // ⭐️ 추가
    const result = await res.json();
    // updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;

    store.originalTableData = JSON.parse(JSON.stringify(result.data)); // 🛡️ 철벽 방어 원본
    store.currentTableData = JSON.parse(JSON.stringify(result.data)); // 🏃 실시간 작업용

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

