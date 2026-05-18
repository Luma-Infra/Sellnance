// table_api.js
import { store } from "./_store.js";

// 1. 데이터 로드 함수
export async function loadTableData(force = false) {
  const modal = document.getElementById("loading-modal");
  const updateTimeSpan = document.getElementById("update-time");

  modal.classList.remove("hidden");
  updateTimeSpan.innerText = "업데이트 중...";

  try {
    console.log("1. 파이썬 서버에 테이블 데이터 요청 시작!"); // ⭐️ 추가
    const res = await fetch(`/api/market-data?force=${force}`);
    console.log("2. 파이썬 서버가 응답 완료!"); // ⭐️ 추가
    const result = await res.json();
    updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;

    store.originalTableData = JSON.parse(JSON.stringify(result.data)); // 🛡️ 철벽 방어 원본
    store.currentTableData = JSON.parse(JSON.stringify(result.data)); // 🏃 실시간 작업용

    store.currentTableData.forEach((row) => {
      row.DisplayTicker = (row.DisplayTicker || row.Symbol)
        .toString()
        .toUpperCase();
      // 💡 여기서 정밀도(p) 맵핑 데이터도 같이 만들면 find 지옥 탈출 가능!
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
    updateTimeSpan.innerText = "업데이트 실패";
  } finally {
    modal.classList.add("hidden");
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

      const freshMap = new Map(result.data.map((item) => [item.Ticker, item]));
      store.currentTableData.forEach((row) => {
        const fresh = freshMap.get(row.Ticker);
        if (fresh) {
          row.Funding_Raw = fresh.Funding_Raw;
          row.Funding_Formatted = fresh.Funding_Formatted;
          row.MarketCap_Raw = fresh.MarketCap_Raw;
          row.MarketCap_Formatted = fresh.MarketCap_Formatted;
          row.VMC_Raw = fresh.VMC_Raw;
          row.VMC_Formatted = fresh.VMC_Formatted;
          row.Basis_Raw = fresh.Basis_Raw;
          row.Basis_Formatted = fresh.Basis_Formatted;
        }
      });

      const updateTimeSpan = document.getElementById("update-time");
      if (updateTimeSpan)
        updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;
    }
  } catch (e) {}
}

// 5분
setInterval(loadTableDataSilent, 300000);
