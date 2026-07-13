// table_api.js
import { store } from "./_store.js";
import { getPureBase } from "./chart_utils.js";

// 1. 데이터 파싱 및 가상 맵/테이블 구성 헬퍼 함수
export function processTableData(result) {
  if (!result || !result.data) return;

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
  store.uidToKrwRowMap = new Map();
  store.pureBaseToRowsMap = new Map();
  store.currentTableData.forEach((row) => {
    row.DisplayTicker = (row.DisplayTicker || row.Symbol)
      .toString()
      .toUpperCase();

    const pureBase = getPureBase(row.Symbol || row.Ticker);
    if (pureBase) {
      if (!store.pureBaseToRowsMap.has(pureBase)) {
        store.pureBaseToRowsMap.set(pureBase, []);
      }
      store.pureBaseToRowsMap.get(pureBase).push(row);
    }

    const uid = row.UID ? String(row.UID) : null;
    if (uid && row.Ticker && row.Ticker.endsWith("KRW")) {
      store.uidToKrwRowMap.set(uid, row);
    }
    const tKey = row.Ticker ? row.Ticker.toUpperCase() : null;
    const dKey = row.DisplayTicker ? row.DisplayTicker.toUpperCase() : null;

    // 1. UID 0순위 매핑
    if (uid) {
      store.tickerRowMap.set(uid, row);
    }

    // 2. Ticker 및 DisplayTicker 매핑 (단, 동명이인 코인은 UID가 일치하는 녀석이 맵을 소유하게 제어)
    if (tKey) {
      const exist = store.tickerRowMap.get(tKey);
      if (!exist) {
        store.tickerRowMap.set(tKey, row);
      } else if (exist.UID !== row.UID) {
        const isMajor = row.Upbit === "O" || row.Bithumb === "O" || row.Binance === "O" || row.Binance_Futures === "O";
        const existIsMajor = exist.Upbit === "O" || exist.Bithumb === "O" || exist.Binance === "O" || exist.Binance_Futures === "O";
        if (isMajor && !existIsMajor) {
          store.tickerRowMap.set(tKey, row);
        }
      }
    }

    if (dKey) {
      const exist = store.tickerRowMap.get(dKey);
      if (!exist) {
        store.tickerRowMap.set(dKey, row);
      } else if (exist.UID !== row.UID) {
        const isMajor = row.Upbit === "O" || row.Bithumb === "O" || row.Binance === "O" || row.Binance_Futures === "O";
        const existIsMajor = exist.Upbit === "O" || exist.Bithumb === "O" || exist.Binance === "O" || exist.Binance_Futures === "O";
        if (isMajor && !existIsMajor) {
          store.tickerRowMap.set(dKey, row);
        }
      }
    }
  });

  // 🚀 [추가] 최초 데이터 로드 시점에 모든 코인에 대해 대표 지표(Price_Raw, Change_Today_Raw 등) 우선순위 조율 강제 실행
  if (typeof window.syncRowPrioritizedMetrics === "function") {
    store.currentTableData.forEach((row) => {
      window.syncRowPrioritizedMetrics(row);
    });
  }

  if (store.currentSortCol && store.sortState !== "") {
    if (typeof window.applyRealtimeSort === "function")
      window.applyRealtimeSort();
  } else {
    if (typeof window.renderTable === "function") window.renderTable();
  }
}

// 2. 데이터 로드 함수
export async function loadTableData(force = false, silent = false) {
  const modal = document.getElementById("loading-modal");
  const updateTimeSpan = document.getElementById("update-time");

  // 🚀 [1단계] 로컬 캐시 즉시 복원 및 선제 화면 출력 (0초 컷 최적화)
  const cachedDataStr = localStorage.getItem("sellnance_market_data_cache");
  let hasCache = false;
  if (cachedDataStr) {
    try {
      const cachedResult = JSON.parse(cachedDataStr);
      if (cachedResult && cachedResult.data && cachedResult.data.length > 0) {
        // 🚀 [상위 30개 즉시 렌더] 마지막 정렬 기준으로 캐시 데이터를 빠르게 정렬 후 상위 30개만 선제 노출
        const lastSortCol = localStorage.getItem("sellnance_last_sort_col") || "Volume";
        const lastSortState = localStorage.getItem("sellnance_last_sort_state") || "desc";

        const sortKeyMap = {
          MarketCap: "MarketCap_Raw", Price: "Price_Raw",
          Change_24h: "Change_24h_Raw", Change_Today: "Change_Today_Raw",
          Volume: "Volume_Raw", VolumeUpbit: "Upbit_Vol",
          Ticker: "DisplayTicker", Kimchi: "Kimchi_Raw",
          Gap: "Basis_Raw", Funding: "Funding_Raw", VMC: "VMC_Raw",
        };
        const key = sortKeyMap[lastSortCol] || lastSortCol;
        const isAsc = lastSortState === "asc";
        const isTextCol = lastSortCol === "Ticker" || lastSortCol === "Listing_Date";

        const top30 = [...cachedResult.data]
          .sort((a, b) => {
            const va = isTextCol ? (a[key] || "") : (Number(a[key]) || -Infinity);
            const vb = isTextCol ? (b[key] || "") : (Number(b[key]) || -Infinity);
            if (isTextCol) return isAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return isAsc ? va - vb : vb - va;
          })
          .slice(0, 30);

        // store 정렬 상태 복원 (화살표 표시 등 UI 싱크)
        store.currentSortCol = lastSortCol;
        store.sortState = lastSortState;

        processTableData({ ...cachedResult, data: top30 });
        hasCache = true;
      }
    } catch (e) {
      console.warn("로컬 스토리지 캐시 파싱 에러:", e);
    }
  }


  // 캐시가 존재할 때는 로딩 모달 창으로 유저의 시야를 블로킹하지 않고 뒤편에서 즉각 리스트 노출
  if (!silent && modal && !hasCache) {
    modal.classList.remove("hidden");
  }

  try {
    const headers = {};
    const localCmcKey = localStorage.getItem("CMC_API_KEY") || "";
    if (localCmcKey) {
      headers["X-CMC-API-KEY"] = localCmcKey;
    }
    
    // Xconsole.log("1. 파이썬 서버에 테이블 데이터 요청 시작!"); // ⭐️ 추가
    const res = await fetch(`/api/market-data?force=${force}`, { headers });
    // Xconsole.log("2. 파이썬 서버가 응답 완료!"); // ⭐️ 추가
    const result = await res.json();
    // updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;
    
    // 로컬 스토리지에 데이터 캐시
    try {
      localStorage.setItem("sellnance_market_data_cache", JSON.stringify(result));
    } catch (e) {
      console.warn("로컬 캐시 쓰기 실패:", e);
    }

    processTableData(result);
  } catch (error) {
    console.error("데이터 로드 에러:", error);
    if (!hasCache) {
      alert("서버에서 데이터를 가져오지 못했습니다.");
    }
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
    const headers = {};
    const localCmcKey = localStorage.getItem("CMC_API_KEY") || "";
    if (localCmcKey) {
      headers["X-CMC-API-KEY"] = localCmcKey;
    }
    const res = await fetch("/api/market-data-silent", { headers });
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

            const uid = row.UID ? String(row.UID) : null;
            const tKey = row.Ticker ? row.Ticker.toUpperCase() : null;
            const dKey = row.DisplayTicker ? row.DisplayTicker.toUpperCase() : null;
            const isDomestic = row.Upbit === "O" || row.Bithumb === "O";

            if (uid) {
              store.tickerRowMap.set(uid, row);
            }
            if (tKey) {
              const exist = store.tickerRowMap.get(tKey);
              if (!exist || isDomestic || exist.UID === row.UID) {
                store.tickerRowMap.set(tKey, row);
              }
            }
            if (dKey) {
              const exist = store.tickerRowMap.get(dKey);
              if (!exist || isDomestic || exist.UID === row.UID) {
                store.tickerRowMap.set(dKey, row);
              }
            }

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
            
            // 🚀 실시간 소켓이 없는 코인들을 위해, 백엔드로부터 최신 시세와 변동률(24h/Day) 데이터도 강제 갱신합니다.
            row.Price_Raw = fresh.Price_Raw;
            row.Price_KRW = fresh.Price_KRW;
            row.Change_24h_Raw = fresh.Change_24h_Raw;
            row.Change_Today_Raw = fresh.Change_Today_Raw;
            
            // 거래소별 개별 속성들도 함께 머징하여 지표 정합성 보장
            row.Upbit_Price = fresh.Upbit_Price;
            row.Bithumb_Price = fresh.Bithumb_Price;
            row.Binance_Price_Spot = fresh.Binance_Price_Spot;
            row.Binance_Price_Futures = fresh.Binance_Price_Futures;
            row.Change_24h_Upbit = fresh.Change_24h_Upbit;
            row.Change_Today_Upbit = fresh.Change_Today_Upbit;
            row.Change_24h_Bithumb = fresh.Change_24h_Bithumb;
            row.Change_Today_Bithumb = fresh.Change_Today_Bithumb;
            row.Change_24h_Binance = fresh.Change_24h_Binance;
            row.Change_Today_Binance = fresh.Change_Today_Binance;
            row.Change_24h_Futures_Ex = fresh.Change_24h_Futures_Ex;
            row.Change_Today_Futures = fresh.Change_Today_Futures;
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

          // 맵핑 캐시 동기화 (UID 0순위 및 동명이인 교통정리)
          const fUid = freshItem.UID ? String(freshItem.UID) : null;
          const fTkey = freshItem.Ticker ? freshItem.Ticker.toUpperCase() : null;
          const fDkey = freshItem.DisplayTicker ? freshItem.DisplayTicker.toUpperCase() : null;
          const fIsDomestic = freshItem.Upbit === "O" || freshItem.Bithumb === "O";

          if (fUid) {
            store.tickerRowMap.set(fUid, freshItem);
          }
          if (fTkey) {
            const exist = store.tickerRowMap.get(fTkey);
            if (!exist || fIsDomestic || exist.UID === freshItem.UID) {
              store.tickerRowMap.set(fTkey, freshItem);
            }
          }
          if (fDkey) {
            const exist = store.tickerRowMap.get(fDkey);
            if (!exist || fIsDomestic || exist.UID === freshItem.UID) {
              store.tickerRowMap.set(fDkey, freshItem);
            }
          }
          // 🚀 [오류 방어] Symbol 단일 매핑 금지

          needReRender = true;
        }
      });

      // Rebuild store.uidToKrwRowMap and store.pureBaseToRowsMap
      store.uidToKrwRowMap = new Map();
      store.pureBaseToRowsMap = new Map();
      store.currentTableData.forEach((row) => {
        if (row.UID && row.Ticker && row.Ticker.endsWith("KRW")) {
          store.uidToKrwRowMap.set(String(row.UID), row);
        }
        const pureBase = getPureBase(row.Symbol || row.Ticker);
        if (pureBase) {
          if (!store.pureBaseToRowsMap.has(pureBase)) {
            store.pureBaseToRowsMap.set(pureBase, []);
          }
          store.pureBaseToRowsMap.get(pureBase).push(row);
        }
      });

      // 🚀 [추가] 백그라운드 동기화 완료 후 대표 지표 우선순위 조율 강제 실행
      if (typeof window.syncRowPrioritizedMetrics === "function") {
        store.currentTableData.forEach((row) => {
          window.syncRowPrioritizedMetrics(row);
        });
      }

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
