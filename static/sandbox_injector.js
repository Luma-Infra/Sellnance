// static/sandbox_injector.js
// 🧪 [샌드박스 주입기] 9대 거래소 + 바이낸스 알파 4,365개 전수조사 독립 플러그인

import { store } from "./_store.js";
import { renderTable } from "./table_render.js";
import { showToast } from "./ui_dialog.js";
import { processTableData } from "./table_api.js";

let isSandboxActive = false;
let sandboxDataCache = null;
let originalBackup = null;

export async function toggleSandboxMode(forceState) {
  const targetState = forceState !== undefined ? !!forceState : !isSandboxActive;

  if (targetState === isSandboxActive) return;
  isSandboxActive = targetState;

  const toggleBtn = document.getElementById("sandbox-toggle-btn");

  if (isSandboxActive) {
    try {
      if (!sandboxDataCache) {
        if (toggleBtn) toggleBtn.textContent = "⏳ 로딩 중...";
        const res = await fetch(`/static/sandbox_data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error("sandbox_data.json 로드 실패");
        const json = await res.json();
        sandboxDataCache = json.data || [];
      }

      // 1. 기존 정규 데이터 안전 백업
      if (!originalBackup && store.originalTableData && store.originalTableData.length > 0) {
        originalBackup = store.originalTableData;
      }

      // 2. 샌드박스 진입 전 기존 DOM 풀 및 옵저버 클린 리셋
      const tbody = document.getElementById("coin-list-body");
      if (tbody) tbody.innerHTML = "";
      store.tablePoolInitialized = false;
      store.lastPoolSourceLength = 0;
      store.rowDomMap = new Map();
      store.visibleSymbols.clear();
      if (store.intersectingSymbols) store.intersectingSymbols.clear();
      if (store.tableObserver) store.tableObserver.disconnect();
      store._sandboxVisibleDoms = null;

      // 3. 샌드박스 전수 데이터로 교체 주입
      store.originalTableData = sandboxDataCache.map((r) => ({ ...r }));
      store.currentTableData = sandboxDataCache.map((r) => ({ ...r }));
      store.isTableLoaded = true;
      store.currentRenderLimit = 1000;

      // 4. 인메모리 빠른 매핑 테이블 동기화
      store.uidRowMap = new Map(store.currentTableData.map((r) => [String(r.UID), r]));
      store.tickerRowMap.clear();
      store.currentTableData.forEach((r) => {
        if (r.Ticker) store.tickerRowMap.set(r.Ticker.toUpperCase(), r);
        if (r.DisplayTicker) store.tickerRowMap.set(r.DisplayTicker.toUpperCase(), r);
      });

      // 5. 테이블 렌더링
      if (typeof renderTable === "function") renderTable();

      // 6. UI 버튼 스타일 및 거래소 필터 동기화
      if (typeof window.updateExchFilterUI === "function") window.updateExchFilterUI();

      showToast(`🧪 전수조사 샌드박스 활성화 (${sandboxDataCache.length.toLocaleString()}개 종목)`, "info", 2500);
      console.log(`[SANDBOX] 🧪 전수조사 모드 ON (총 ${sandboxDataCache.length}개 종목 주입됨)`);
    } catch (e) {
      console.error("[SANDBOX ERROR]", e);
      isSandboxActive = false;
      if (typeof window.updateExchFilterUI === "function") window.updateExchFilterUI();
      showToast("⚠️ 샌드박스 데이터를 불러오지 못했습니다. (modules/sandbox_scanner.py 실행 필요)", "warning", 3000);
    }
  } else {
    // 샌드박스 OFF:
    // 1. 알파 필터 상태 잔여물 제거 (정규 코인 오염 방지)
    if (store.exchFilterStates) {
      delete store.exchFilterStates["BINANCE_ALPHA"];
    }

    // 2. 샌드박스 DOM 풀 및 옵저버 완전 초기화
    const tbody = document.getElementById("coin-list-body");
    if (tbody) tbody.innerHTML = "";
    store.tablePoolInitialized = false;
    store.lastPoolSourceLength = 0;
    store.rowDomMap = new Map();
    store.visibleSymbols.clear();
    if (store.intersectingSymbols) store.intersectingSymbols.clear();
    if (store.tableObserver) store.tableObserver.disconnect();
    store._sandboxVisibleDoms = null;

    // 3. 공식 processTableData로 정규 데이터 복원
    if (window._latestServerResult) {
      const savedResult = window._latestServerResult;
      window._latestServerResult = null;
      processTableData(savedResult);
    } else if (originalBackup && originalBackup.length > 0) {
      processTableData({ data: originalBackup });
    } else if (typeof window.loadTableData === "function") {
      window.loadTableData(true);
    }

    if (typeof window.updateExchFilterUI === "function") window.updateExchFilterUI();

    showToast("정규 셀낸스 데이터로 복귀 완료", "success", 1500);
    console.log("[SANDBOX] 🔄 정규 셀낸스 데이터 복귀 완료");
  }
}

if (typeof window !== "undefined") {
  window.toggleSandboxMode = toggleSandboxMode;
  window.isSandboxActive = () => isSandboxActive;
}
