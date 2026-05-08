// api.js
import { store, tfSec } from './store.js';

// --- 📡 API Fetch 로직 ---
export async function loadSymbols() {
  try {
    const res = await fetch("/api/market-map");
    const data = await res.json();

    // 🚀 [핵심] 모든 엔진이 공통으로 쓰는 '장부'에 데이터를 꽂아넣으세요!
    store.marketDataMap = data;
    store.allSymbols = data.all_assets;

    // 만약 table.js의 currentTableData를 여기서 관리한다면?
    // 백엔드에서 주는 전체 리스트를 장부에 복사!
    // if (data.table_data) {
    //   currentTableData = JSON.parse(JSON.stringify(data.table_data));
    //   originalTableData = JSON.parse(JSON.stringify(data.table_data));
    // }

    console.log("✅ [데이터센터] 장부 로드 완료!");
  } catch (e) {
    console.error("🚨 마켓 데이터 로드 실패", e);
  }
}

// 검색창 비우기 (X 버튼용)
export function clearSearch() {
  const input = document.getElementById("symbol-input");
  input.value = "";
  input.focus();
  searchSymbols("");
}

// 검색 리스트 (티커 + 태그 유지 버전)
export function searchSymbols(v) {
  const resDiv = document.getElementById("search-results");
  if (!resDiv) return;

  if (!v || v.trim() === "") {
    resDiv.style.display = "none";
    return;
  }

  // 🚀 [핵심] 검색어가 있든 없든, 필터링해서 보여줌
  const query = v.toUpperCase();
  const filtered = query
    ? store.allSymbols.filter((s) => s.includes(query)).slice(0, 15)
    : store.allSymbols.slice(0, 15); // 빈 값이면 상위 15개 그냥 노출

  if (filtered.length === 0) {
    resDiv.style.display = "none";
    return;
  }

  resDiv.innerHTML = filtered
    .map((s) => {
      const isUpbit = store.marketDataMap.upbit?.includes(s);
      const isBinanceSpot = store.marketDataMap.spot?.includes(s);
      const isBinanceFutures = store.marketDataMap.futures?.includes(s);

      // 거래소 버튼 (분기 유지)
      let upbitBtn = isUpbit
        ? `<button class="bg-[#093687] text-white text-[9px] px-2 py-1 rounded font-bold mr-1 hover:brightness-125" 
                 onclick="event.stopPropagation(); selectSymbol('${s}', 'UPBIT')">UPBIT</button>`
        : "";
      let binanceBtn = isBinanceFutures
        ? `<button class="bg-[#f0b90b] text-black text-[9px] px-2 py-1 rounded font-bold hover:brightness-110" 
                 onclick="event.stopPropagation(); selectSymbol('${s}', 'FUTURES')">B-FUT</button>`
        : isBinanceSpot
          ? `<button class="bg-[#333] text-white text-[9px] px-2 py-1 rounded font-bold border border-[#555]" 
                                   onclick="event.stopPropagation(); selectSymbol('${s}', 'SPOT')">B-SPOT</button>`
          : "";

      return `
      <div class="flex items-center justify-between p-2 cursor-pointer border-b border-theme-border text-[13px] hover:bg-white/5" 
           onclick="selectSymbol('${s}')">
        <div class="flex items-center gap-2">
          <b class="w-[50px]">${s}</b>
          <div class="flex gap-1">${upbitBtn}${binanceBtn}</div>
        </div>
      </div>`;
    })
    .join("");

  resDiv.style.display = "block";
}

// 선택 로직 (티커명 검색창 전송 + 이름 유지)
export async function selectSymbol(s, forceMarket = null) {
  store.currentAsset = s;
  store.currentSelectedSymbol = s; // 🚀 전역 선택자 동기화

  // [중요] 검색창에 티커명 즉시 반영 (기존 기능 유지)
  const symInput = document.getElementById("symbol-input");
  if (symInput) symInput.value = s;

  const searchRes = document.getElementById("search-results");
  if (searchRes) searchRes.style.display = "none";

  // 마켓 우선순위 결정 (기본: 선물 > 현물 > 업비트)
  if (forceMarket) {
    store.currentMarket = forceMarket;
  } else {
    // 🚀 [수정] 중괄호로 감싸고 "문자열"임을 명확히 선언!
    if (store.marketDataMap.futures && store.marketDataMap.futures.includes(s)) {
      store.currentMarket = "FUTURES";
    } else if (store.marketDataMap.spot && store.marketDataMap.spot.includes(s)) {
      store.currentMarket = "SPOT";
    } else if (store.marketDataMap.upbit && store.marketDataMap.upbit.includes(s)) {
      store.currentMarket = "UPBIT";
    }
  }
  // 헤더 텍스트 초기화
  const headAssetName = document.getElementById("head-asset-name");
  if (headAssetName) headAssetName.innerText = s;

  // 배지 업데이트
  updateExchangeBadges(s);

  // 🚀 [핵심] 코인 이름 가져와서 "티커 (이름)" 형태로 덮어쓰기
  try {
    const infoRes = await fetch(`/api/coin-info/${s}`);
    const infoData = await infoRes.json();
    if (headAssetName && infoData.name) {
      headAssetName.innerText = `${s} (${infoData.name})`;
    }
  } catch (e) {
    console.error("이름 로드 실패", e);
  }

  // 차트 호출
  const isFutures = store.currentMarket === "FUTURES";
  const isSpot = store.currentMarket === "SPOT";
  fetchHistory(s, isFutures, isSpot);

  // 🚀 [추가] 검색해서 선택했으면 왼쪽 테이블도 해당 코인 위치로 멱살 잡고 끌고 옴
  setTimeout(() => {
    store.currentSelectedSymbol = s; // 선택자 동기화
    const targetRow = document.querySelector(`#table-body tr[data-sym="${s}"]`);
    if (targetRow) {
      targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
      if (typeof applySelectedHighlight === "function") applySelectedHighlight();
    }
  }, 100); // 렌더링 대기 후 이동

  // 🚀 [추가] 검색한 코인이 현재 테이블 렌더링 범위(50개) 밖에 있을 경우 대응
  const sortedList = store.currentTableData;
  const targetIdx = sortedList.findIndex(item => item.Symbol === s);

  if (targetIdx !== -1) {
    // 1. 만약 현재 렌더링 한도보다 뒤에 있다면 한도를 늘리고 재렌더링
    if (targetIdx >= store.currentRenderLimit) {
      store.currentRenderLimit = targetIdx + 1;
      if (typeof renderTable === "function") renderTable();
    }

    // 2. 해당 행으로 스크롤 이동 및 하이라이트
    setTimeout(() => {
      const targetRow = document.querySelector(`#table-body tr[data-sym="${s}"]`);
      if (targetRow) {
        targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
        if (typeof applySelectedHighlight === "function") applySelectedHighlight();
      }
    }, 100);
  }

  // 차트 호출
  fetchHistory(s, store.currentMarket === "FUTURES", store.currentMarket === "SPOT");
}

// 배지 UI 업데이트 헬퍼
export function updateExchangeBadges(s) {
  let badges = "";
  if (store.marketDataMap.upbit?.includes(s))
    badges += `<span class="bg-[#093687] text-white text-[10px] px-1.5 py-0.5 rounded">UPBIT</span>`;
  if (store.marketDataMap.futures?.includes(s))
    badges += `<span class="bg-[#f0b90b] text-black text-[10px] px-1.5 py-0.5 rounded ml-1">B-FUTURES</span>`;
  if (store.marketDataMap.spot?.includes(s))
    badges += `<span class="bg-[#444] text-white text-[10px] px-1.5 py-0.5 rounded ml-1">B-SPOT</span>`;

  const badgeContainer = document.getElementById("exchange-badges");
  if (badgeContainer) badgeContainer.innerHTML = badges;
}

// executeSetTF나 코인 클릭 함수(selectSymbol) 등 마켓이 바뀌는 모든 시점에 이 '세척기'를 돌려야 합니다.
export function clearChartData() {
  // 🚀 전역 데이터 장부 완전 소각
  store.mainData = [];

  // 🚀 차트 시리즈 데이터 즉시 비우기
  // if (store.candleSeries) store.candleSeries.setData([]);
  // if (store.previewSeries) store.previewSeries.setData([]);

  // 🚀 [추가] 캔들은 남겨두되, 가격축은 미리 '오토'로 풀어서
  // 새 데이터가 올 때 부드럽게 적응할 준비를 시킵니다.
  if (store.chart) {
    store.chart.priceScale("right").applyOptions({ autoScale: true });
  }

  // 🚀 카운트다운 라벨도 유령 방지를 위해 삭제
  if (store.countdownPriceLine && store.candleSeries) {
    store.candleSeries.removePriceLine(store.countdownPriceLine);
    store.countdownPriceLine = null;
  }
  console.log("🧹 차트 찌꺼기 청소 및 잔상 제거 준비 완료! (장대봉 방지)");
}

export async function fetchHistory(symbol) {
  const now = Date.now();
  if (now - store.lastFetchTime < 10) return;
  store.lastFetchTime = now;

  store.isFetchingChart = true;
  clearChartData();

  const displayName = symbol || store.currentAsset;
  const rawSymbol = displayName.split("(")[0].trim().toUpperCase();
  store.currentAsset = displayName;

  // 🚀 2. 여기서 전역 변수(currentMarket)를 기준으로 마켓을 직접 판별하게 복구!
  const isFutures = store.currentMarket === "FUTURES";
  const isSpot = store.currentMarket === "SPOT";
  const isUpbit = store.currentMarket === "UPBIT";

  // 🚀 [세련된 방법] 현재 클릭한 코인의 전체 데이터(장부)를 찾습니다.
  const rowInfo = store.currentTableData.find((c) => c.Symbol === rawSymbol);

  // 🚀 장부에 Upbit_Symbol이 적혀있으면 그거 쓰고, 없으면 그냥 원본(rawSymbol) 씁니다.
  const bTicker = rawSymbol;
  const uTicker =
    rowInfo && rowInfo.Upbit_Symbol ? rowInfo.Upbit_Symbol : rawSymbol;

  // 티커 규격 맞추기 (알아서 BTTC와 BTT로 나뉘어 들어감)
  const binanceTicker = `${bTicker}USDT`;
  const upbitTicker = `KRW-${uTicker}`;

  // 🚀 [백엔드 장부 200% 활용] 김프를 계산할 수 있는 자격증명
  const hasUpbit = store.marketDataMap.upbit?.includes(uTicker);
  const hasBinanceSpot = store.marketDataMap.spot?.includes(bTicker);
  const hasBinanceFutures = store.marketDataMap.futures?.includes(bTicker);
  const canCalcKimchi = hasUpbit && (hasBinanceSpot || hasBinanceFutures);

  // 🚀 임시 환율 (백엔드 장부에 krw_usd_rate를 담아주면 더 좋습니다!)
  const exchangeRate = store.marketDataMap.krw_usd_rate || 1480.0;

  const loadingModal = document.getElementById("chart-loading-modal");
  if (loadingModal) loadingModal.classList.remove("hidden");

  // 🚀 [추가] 차트 영역에 로딩 클래스 부여 (어둡고 축소 시작)
  const wrapper = document.getElementById("chart-wrapper");
  if (wrapper) wrapper.classList.add("chart-loading");

  try {
    store.mainData = [];
    let raw = [];
    let volumeData = []; // 볼륨 배열
    let kimchiData = []; // 김프 배열

    // 🚀 [구조화] 바이낸스 vs 업비트 분기
    if (isFutures || isSpot) {
      const exchange = isFutures ? "binance_futures" : "binance_spot";
      const res = await fetch(
        `/api/candles?exchange=${exchange}&symbol=${binanceTicker}&interval=${store.currentTF}&limit=500`,
      );
      raw = await res.json();

      if (Array.isArray(raw) && !raw.error) {
        store.mainData = raw.map((d) => {
          const time = Number(d[0]) / 1000;
          const open = Number(d[1]);
          const high = Number(d[2]);
          const low = Number(d[3]);
          const close = Number(d[4]);
          const vol = Number(d[5]);

          volumeData.push({
            time: time,
            value: vol,
            color: close >= open ? "rgba(38, 166, 154, 0.5)" : "rgba(239, 83, 80, 0.5)",
          });
          return { time, open, high, low, close };
        });
      }
    } else {
      // 업비트/빗썸 등 원화 거래소
      const supportedMin = [1, 3, 5, 10, 15, 30, 60, 240];
      const totalSec = tfSec[store.currentTF] || 60;
      let fetchInterval, step = 1;

      const u = store.currentTF.replace(/[0-9]/g, "");
      if (u === "d" || u === "w" || u === "M") {
        fetchInterval = u === "w" ? "weeks" : u === "M" ? "months" : "days";
        step = store.currentTF === "3d" ? 3 : 1;
      } else {
        const targetMin = totalSec / 60;
        const baseMin = supportedMin.reverse().find((m) => targetMin % m === 0) || 1;
        fetchInterval = `minutes/${baseMin}`;
        step = targetMin / baseMin;
      }

      // 🚀 무한 펌프기 투입! 바이낸스랑 똑같이 500개 꽉꽉 채워서 가져옴!
      const fetchLimit = 500 * step;
      raw = await fetchUpbitPaginated(upbitTicker, fetchInterval, fetchLimit);

      if (Array.isArray(raw) && !raw.error) {
        let baseData = raw.reverse().map((d) => ({
          time: Math.floor(Date.parse(d.candle_date_time_utc + "Z") / 1000),
          open: d.opening_price,
          high: d.high_price,
          low: d.low_price,
          close: d.trade_price,
          vol: d.candle_acc_trade_volume,
        }));

        for (let i = 0; i < baseData.length; i += step) {
          const chunk = baseData.slice(i, i + step);
          if (chunk.length > 0) {
            const time = chunk[0].time;
            const open = chunk[0].open;
            const close = chunk[chunk.length - 1].close;
            const high = Math.max(...chunk.map((c) => c.high));
            const low = Math.min(...chunk.map((c) => c.low));
            const totalVol = chunk.reduce((sum, c) => sum + (c.vol || 0), 0);

            store.mainData.push({ time, open, high, low, close });
            volumeData.push({
              time: time,
              value: totalVol,
              color: close >= open ? "rgba(38, 166, 154, 0.5)" : "rgba(239, 83, 80, 0.5)",
            });
          }
        }
      }
    }

    // 🚀 [수정됨] 2.5 [김프 엔진 및 BTC 합성 환율 계산기]
    kimchiData = [];

    // 1. 김프 비교 대상 (Fallback logic) 결정
    let subExchange = null;
    let subSymbol = null;

    if (store.currentMarket === "UPBIT" || store.currentMarket === "BITHUMB") {
      // 업비트/빗썸 기준: 바낸 선물 -> 바이비트 현물
      if (store.marketDataMap.futures?.includes(bTicker)) {
        subExchange = "binance_futures";
        subSymbol = `${bTicker}USDT`;
      } else if (store.marketDataMap.bybit_spot?.includes(bTicker)) {
        subExchange = "bybit_spot";
        subSymbol = `${bTicker}USDT`;
      }
    } else {
      // 바낸 기준: 업비트 -> 빗썸
      if (store.marketDataMap.upbit?.includes(uTicker)) {
        subExchange = "upbit";
        subSymbol = `KRW-${uTicker}`;
      } else if (store.marketDataMap.bithumb?.includes(uTicker)) {
        subExchange = "bithumb";
        subSymbol = `${uTicker}_KRW`;
      }
    }

    // 🚀 [핵심] 비교 대상 유무에 따른 UI 처리
    const noDataMsg = document.getElementById("kimchi-no-data");
    if (!subExchange) {
      store.paneConfig.kimchi = false; // 김프 영역 닫기
      if (noDataMsg) noDataMsg.classList.remove("hidden"); // 문구 보여주기
      console.log("ℹ️ 비교군 없음: 김프 차트를 비활성화합니다.");
    } else {
      store.paneConfig.kimchi = true;  // 김프 영역 열기
      if (noDataMsg) noDataMsg.classList.add("hidden");    // 문구 숨기기
    }

    // 레이아웃 즉시 반영 (영역 닫힘 효과)
    if (typeof applyChartLayout === "function") applyChartLayout();

    if (subExchange && store.mainData.length > 0) {
      // BTC 합성 환율을 위한 준비
      const u = store.currentTF.replace(/[0-9]/g, "");
      const totalSec = tfSec[store.currentTF] || 60;
      let upbitInterval = "minutes/1";
      if (u === "d" || u === "w" || u === "M") {
        upbitInterval = u === "w" ? "weeks" : u === "M" ? "months" : "days";
      } else {
        const baseMin = [1, 3, 5, 10, 15, 30, 60, 240].reverse().find((m) => (totalSec / 60) % m === 0) || 1;
        upbitInterval = `minutes/${baseMin}`;
      }

      let subFetchUrl = `/api/candles?exchange=${subExchange}&symbol=${subSymbol}&interval=${store.currentTF}&limit=500`;
      if (subExchange === "upbit" || subExchange === "bithumb") {
        subFetchUrl = `/api/candles?exchange=${subExchange}&symbol=${subSymbol}&interval=${upbitInterval}&limit=1000`;
      }

      const uBtcUrl = `/api/candles?exchange=upbit&symbol=KRW-BTC&interval=${upbitInterval}&limit=1000`;
      const bBtcUrl = `/api/candles?exchange=binance_spot&symbol=BTCUSDT&interval=${store.currentTF}&limit=500`;

      // 업비트는 펌프기로 500개 꽉꽉 채워오고, 바낸은 그냥 한 방에 500개 가져옴
      const results = await Promise.allSettled([
        (subExchange === "upbit" || subExchange === "bithumb")
          ? fetchUpbitPaginated(subSymbol, upbitInterval, 500)
          : fetch(subFetchUrl).then(res => res.json()),
        fetchUpbitPaginated("KRW-BTC", upbitInterval, 500), // 업비트 BTC도 500개!
        fetch(bBtcUrl).then(res => res.json())
      ]);
      const subRaw = results[0].status === 'fulfilled' ? results[0].value : [];
      const uBtcRaw = results[1].status === 'fulfilled' ? results[1].value : [];
      const bBtcRaw = results[2].status === 'fulfilled' ? results[2].value : [];

      if (Array.isArray(subRaw) && !subRaw.error) {
        // BTC 합성 환율 맵 생성
        const bBtcMap = {};
        if (Array.isArray(bBtcRaw) && !bBtcRaw.error) {
          bBtcRaw.forEach(d => { bBtcMap[Number(d[0]) / 1000] = Number(d[4]); });
        }

        const syntheticRateMap = {};
        if (Array.isArray(uBtcRaw) && !uBtcRaw.error) {
          uBtcRaw.forEach(d => {
            const uTime = Math.floor(Date.parse(d.candle_date_time_utc + "Z") / 1000);
            const bPrice = bBtcMap[uTime] || Object.values(bBtcMap)[0];
            if (bPrice) syntheticRateMap[uTime] = d.trade_price / bPrice;
          });
        }

        // 서브 코인 정렬
        subRaw.sort((a, b) => {
          const timeA = (subExchange === "upbit" || subExchange === "bithumb") ? Math.floor(Date.parse(a.candle_date_time_utc + "Z") / 1000) : Number(a[0]) / 1000;
          const timeB = (subExchange === "upbit" || subExchange === "bithumb") ? Math.floor(Date.parse(b.candle_date_time_utc + "Z") / 1000) : Number(b[0]) / 1000;
          return timeA - timeB;
        });

        let subIndex = 0;
        let lastKnownSubClose = null;
        let lastKnownRate = exchangeRate;

        store.mainData.forEach((candle) => {
          if (syntheticRateMap[candle.time]) lastKnownRate = syntheticRateMap[candle.time];

          while (subIndex < subRaw.length) {
            const subItem = subRaw[subIndex];
            const subTime = (subExchange === "upbit" || subExchange === "bithumb")
              ? Math.floor(Date.parse(subItem.candle_date_time_utc + "Z") / 1000)
              : Number(subItem[0]) / 1000;

            if (subTime <= candle.time) {
              lastKnownSubClose = (subExchange === "upbit" || subExchange === "bithumb") ? subItem.trade_price : Number(subItem[4]);
              subIndex++;
            } else break;
          }

          // 🚀 [해결] lastKnownSubClose가 null이 아닐 때만(즉, 두 거래소 데이터가 만나는 시점부터만) 김프를 그림!
          if (lastKnownSubClose !== null) {
            const isKor = ["UPBIT", "BITHUMB"].includes(store.currentMarket);
            const korPrice = isKor ? candle.close : lastKnownSubClose;
            const glbPrice = isKor ? lastKnownSubClose : candle.close;
            const kimchiPct = (korPrice / (glbPrice * lastKnownRate) - 1) * 100;

            if (!isNaN(kimchiPct)) {
              kimchiData.push({ time: candle.time, value: kimchiPct });
            }
          }
        });
      }
    }

    // api.js 수정 부분
    // 3. 차트 렌더링
    if (store.mainData.length > 0 && store.candleSeries) {
      const row = store.currentTableData.find((c) => c.Symbol === rawSymbol);
      const p = row ? Number(row.precision) : 2;

      store.candleSeries.applyOptions({
        priceFormat: {
          type: "price",
          precision: p,
          minMove: p > 0 ? Number((1 / Math.pow(10, p)).toFixed(p)) : 1,
          formatter: (price) => formatSmartPrice(price, p),
        },
      });

      // 🚀 데이터 3개 발사! (하나의 차트에 꽂힘)
      store.candleSeries.setData(store.mainData);
      if (store.volumeSeries && volumeData.length > 0) store.volumeSeries.setData(volumeData);

      // 🚨 차트가 하나로 통합됐으므로 김프 워터마크 로직(chartKimchi.applyOptions)은 삭제해야 에러가 안 납니다!
      if (store.kimchiSeries && kimchiData.length > 0) {
        store.kimchiSeries.setData(kimchiData);
      }

      applyChartLayout();

      if (typeof startRealtimeCandle === "function") {
        // 🚀 업비트 여부(isUpbit)와 업비트 전용 티커(uTicker)를 명시적으로 넘겨줌!
        const isUpbit = store.currentMarket === "UPBIT";
        startRealtimeCandle(isUpbit ? uTicker : rawSymbol, store.currentTF, isFutures, isSpot, isUpbit);
      }

      requestAnimationFrame(() => {
        store.chart.timeScale().fitContent();
        if (typeof updateStatus === "function") updateStatus();
        if (typeof autoFit === "function") autoFit();
        store.isFetchingChart = false;
      });
    }
  } catch (e) {
    console.error("차트 로드 실패:", e);
    // if (wrapper) wrapper.classList.remove("chart-loading");
  } finally {
    // 🚀 [추가] 모달 숨기기 + 차트 어두워짐(로딩) 효과 무조건 강제 해제!
    if (loadingModal) loadingModal.classList.add("hidden");

    const wrapper = document.getElementById("chart-wrapper");
    if (wrapper) wrapper.classList.remove("chart-loading");

    // 🚀 [핵심] 이거 안 풀어주면 다음 코인 클릭할 때 무시당함!
    window.isFetchingChart = false;
  }
}

// 🚀 업비트 200개 제한 돌파용 무한 펌프기 (중복 및 포맷 에러 방어)
async function fetchUpbitPaginated(symbol, interval, totalLimit) {
  let result = [];
  let lastTo = "";
  let remaining = totalLimit;

  while (remaining > 0) {
    const count = Math.min(remaining, 200);
    let url = `/api/candles?exchange=upbit&symbol=${symbol}&interval=${interval}&limit=${count}`;
    if (lastTo) url += `&to=${encodeURIComponent(lastTo.replace("T", " "))}`;

    const res = await fetch(url);
    if (res.status === 429) break;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    result = result.concat(data);
    remaining -= data.length;
    lastTo = data[data.length - 1].candle_date_time_utc;

    // 🚀 [추론 반영 로직] 
    // 첫 200개는 바로 가져오고, 그 이후(과거 데이터)부터는 
    // 누님 말씀대로 천천히 가져오기
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return result;
}