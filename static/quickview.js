// quickview.js
import { store, tfSec } from "./_store.js";
import { getRowExchangeMeta } from "./_market_rules.js";
import { getPureBase } from "./chart_utils.js";

// ⚡ 퀵뷰 전용 상태 제어 장치
const qvState = {
  baseTarget: "ALL", // 'ALL' (전체 코인), 'FAV' (즐겨찾기 전용)
  sortType: "", // '24h', 'day', 'mcap'
  page: 1,
  timeframe: "1h", // '1m', '5m', '15m', '1h', '4h'
  layout: "spread", // 'spread' (퍼트리기), 'overlap' (겹치기)
  activeAssets: [], // 현재 활성화된 8개 자산 객체 리스트
  charts: [], // 8개 차트 인스턴스 배열
  series: [], // 8개 캔들 시리즈 인스턴스 배열
  binanceWs: null, // 바이낸스 현물 복합 스트림 소켓
  binanceFuturesWs: null, // 바이낸스 선물 복합 스트림 소켓
  upbitWs: null, // 업비트 정밀 체결 소켓
  bithumbWs: null, // 빗썸 정밀 체결 소켓
  focusIndex: -1, // 겹치기 모드에서 현재 마우스 포커스(호버)된 자산 인덱스
  candleColorMode: "default", // 'default' (빨강/초록), 'asset' (자산별 고유색상)
  maxPage: 1, // 동적으로 계산될 최대 페이지
  barCounts: [], // 8개 차트의 실제 로드된 캔들 개수 배열 (역방향 앵커링/최신 캔들 동기화용)
};

// 🎨 겹치기 모드에서 각 라인을 시각적으로 뚜렷하게 구별하기 위한 8가지 네온/파스텔 자산 컬러 셋
const ASSET_COLORS = [
  "#3b82f6", // Neon Blue
  "#26a69a", // Mint Green
  "#ef5350", // Coral Red
  "#f0b90b", // Binance Gold
  "#a855f7", // Electric Purple
  "#ec4899", // Hot Pink
  "#f97316", // Bright Orange
  "#06b6d4", // Neon Cyan
];

// ⏱️ 타임프레임 텍스트 매핑 헬퍼
const TF_LABELS = {
  "1m": "1분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일",
};

// 🏁 퀵뷰 엔진 점화
export async function initQuickView() {
  const container = document.getElementById("quickview-container");
  if (container) {
    container.classList.remove("hidden");
    container.classList.add("qv-modal");
    container.style.display = "flex";
  }
  const initOverlay = document.getElementById("quickview-init-overlay");
  if (!qvState.sortType) {
    // 최초 진입 시 정렬 기준 선택 화면 노출
    if (initOverlay) initOverlay.classList.remove("hidden");
    return;
  }

  if (initOverlay) initOverlay.classList.add("hidden");

  // 🚀 [초기 동기화] 정렬 및 타임프레임 버튼들의 active 스타일 강제 동화
  const sortBtns = document.querySelectorAll(".qv-sort-btn");
  sortBtns.forEach((btn) => {
    if (btn.id === `qv-sort-${qvState.sortType}`) {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-white bg-theme-accent";
    } else {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-theme-text opacity-50 hover:opacity-100";
    }
  });

  const tfBtns = document.querySelectorAll(".qv-tf-btn");
  tfBtns.forEach((btn) => {
    if (btn.id === `qv-tf-${qvState.timeframe}`) {
      btn.className =
        "px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-white bg-theme-accent";
    } else {
      btn.className =
        "px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-theme-text opacity-50 hover:opacity-100";
    }
  });

  // 레이아웃 토글 슬라이더 UI 동기화
  updateLayoutToggleUI(qvState.layout);

  // 1. 상태에 맞는 코인 8개 슬라이싱
  resolveTopAssets();

  const pageIndicator = document.getElementById("qv-page-indicator");
  if (pageIndicator)
    pageIndicator.innerText = `PAGE ${qvState.page} / ${qvState.maxPage}`;

  // 2. 퀵뷰 UI 컨트롤러 및 차트 재생성
  await rebuildQuickViewCharts();

  // 3. 실시간 웹소켓 파이프라인 점화
  connectQuickViewSockets();
}

// 🛑 퀵뷰 강제 파괴 및 자원 소각 (탭 이탈 시 메모리 누수 원천 차단)
export function destroyQuickView() {
  // Xconsole.log("🧹 퀵뷰 전용 자원 및 실시간 소켓 소각 시작...");

  // 1. 웹소켓 차단
  disconnectQuickViewSockets();

  // 2. 차트 인스턴스 파괴
  qvState.charts.forEach((chart) => {
    if (chart) {
      try {
        chart.remove();
      } catch (e) {
        console.error("Chart destroy error:", e);
      }
    }
  });

  qvState.charts = [];
  qvState.series = [];
  qvState.barCounts = [];
  qvState.activeAssets = [];
  qvState.focusIndex = -1;

  // 3. UI 래퍼 초기화
  const wrapper = document.getElementById("qv-charts-wrapper");
  if (wrapper) wrapper.innerHTML = "";

  const legend = document.getElementById("qv-overlap-legend");
  if (legend) {
    if (legend._initTimeout) {
      clearTimeout(legend._initTimeout);
      legend._initTimeout = null;
    }
    legend.innerHTML = "";
    legend.classList.add("hidden");
    legend.classList.remove("collapsed");
  }

  const container = document.getElementById("quickview-container");
  if (container) {
    container.classList.remove("qv-modal");
    container.classList.add("hidden");
    container.style.display = "none";
  }
}

// 📊 상위 32개 정렬 자산 중 현재 페이지 8개 추출
function resolveTopAssets() {
  // store의 테이블 원본 데이터를 클론하여 정렬 진행
  let source = [...(store.currentTableData || store.originalTableData || [])];

  // 🚀 즐겨찾기(FAV) 전용 모드인 경우 필터링 적용 (UID 타입 안전성 100% 보장)
  if (qvState.baseTarget === "FAV") {
    const favorites = JSON.parse(
      localStorage.getItem("sellnance_favs") || "[]",
    ).map(String);
    const favSet = new Set(favorites);
    source = source.filter((d) => d.UID && favSet.has(String(d.UID)));
  } else if (qvState.baseTarget === "FAV2") {
    const favorites2 = JSON.parse(
      localStorage.getItem("sellnance_favs2") || "[]",
    ).map(String);
    const favSet2 = new Set(favorites2);
    source = source.filter((d) => d.UID && favSet2.has(String(d.UID)));
  }

  if (source.length === 0) {
    qvState.activeAssets = [];
    return;
  }

  if (qvState.sortType === "24h") {
    source.sort((a, b) => (b.Change_24h_Raw || 0) - (a.Change_24h_Raw || 0));
  } else if (qvState.sortType === "day") {
    source.sort(
      (a, b) => (b.Change_Today_Raw || 0) - (a.Change_Today_Raw || 0),
    );
  } else if (qvState.sortType === "mcap") {
    source.sort((a, b) => (b.MarketCap_Raw || 0) - (a.MarketCap_Raw || 0));
  }

  // 최대 페이지 계산 (무제한)
  qvState.maxPage = Math.max(1, Math.ceil(source.length / 8));
  if (qvState.page > qvState.maxPage) qvState.page = qvState.maxPage;

  // 현재 페이지네이션에 해당되는 8개 코인 추출
  const startIdx = (qvState.page - 1) * 8;
  qvState.activeAssets = source.slice(startIdx, startIdx + 8);
}

// 🔍 국내외 통합 우선 거래소 판별기 (바낸선물 -> 바낸현물 -> 업비트 -> 빗썸 -> 바이빗선물 -> 바이빗현물)
function resolveAssetExchange(asset) {
  let exchange = "";
  let symbol = "";

  const meta = getRowExchangeMeta(asset);
  const hasBithumb = meta.hasBithumb || asset.Bithumb === "O" || !!asset.Bithumb_Symbol;

  if (meta.hasBinanceFutures) {
    exchange = "binance_futures";
    symbol = asset.Exact_Futures || getPureBase(asset.Ticker || asset.Symbol);
    if (symbol && !symbol.endsWith("USDT")) symbol = `${symbol}USDT`;
  } else if (meta.hasBinanceSpot) {
    exchange = "binance_spot";
    symbol = asset.Exact_Spot || getPureBase(asset.Ticker || asset.Symbol);
    if (symbol && !symbol.endsWith("USDT")) symbol = `${symbol}USDT`;
  } else if (meta.hasUpbit) {
    exchange = "upbit";
    symbol = asset.Upbit_Symbol || getPureBase(asset.Symbol || asset.Ticker);
  } else if (hasBithumb) {
    exchange = "bithumb";
    symbol = asset.Bithumb_Symbol || getPureBase(asset.Symbol || asset.Ticker);
  } else if (meta.hasBybitFutures) {
    exchange = "bybit_futures";
    symbol = asset.Exact_Futures || getPureBase(asset.Ticker || asset.Symbol);
    if (symbol && !symbol.endsWith("USDT")) symbol = `${symbol}USDT`;
  } else if (meta.hasBybitSpot) {
    exchange = "bybit_spot";
    symbol = asset.Exact_Spot || getPureBase(asset.Ticker || asset.Symbol);
    if (symbol && !symbol.endsWith("USDT")) symbol = `${symbol}USDT`;
  }

  asset.resolvedExchange = exchange;
  asset.resolvedSymbol = symbol;
}

// 🛠️ 8개 차트 카드 재생성 및 Lightweight Charts 바인딩
async function rebuildQuickViewCharts() {
  const wrapper = document.getElementById("qv-charts-wrapper");
  if (!wrapper) return;

  // 기존 차트 카드 파괴
  qvState.charts.forEach((c) => {
    if (c) c.remove();
  });
  qvState.charts = [];
  qvState.series = [];
  qvState.barCounts = [];
  wrapper.innerHTML = "";

  // 레이아웃 모드 클래스 설정
  if (qvState.layout === "spread") {
    wrapper.className = "qv-spread-mode w-full h-full relative";
  } else {
    wrapper.className = "qv-overlap-mode w-full h-full relative";
  }

  // 8개 차트 카드 동적 생성 및 바인딩
  const promises = qvState.activeAssets.map(async (asset, idx) => {
    // 동기적으로 우선 거래소 분석 수행
    resolveAssetExchange(asset);

    const card = document.createElement("div");
    card.className = "qv-chart-card";
    card.id = `qv-card-${idx}`;
    card.setAttribute("data-index", idx);

    // 겹치기 모드 호버 처리를 위한 이벤트 등록
    card.addEventListener("mouseenter", () => {
      if (qvState.layout === "overlap") {
        setQuickViewFocus(idx);
      }
    });

    // 1. 카드 상단 헤더
    const header = document.createElement("div");
    header.className = "qv-chart-header";

    // 거래소 구분 라벨 및 코인명 기입
    const exTag = asset.resolvedExchange.replace("_", " ").toUpperCase();
    const isUpbit = asset.resolvedExchange === "upbit";
    const tagClass = isUpbit
      ? "text-upbit-color"
      : (asset.resolvedExchange === "bithumb" ? "text-[#f37321]" : "text-[#f0b90b]");
    const tagStyle = isUpbit ? 'style="color: var(--upbit-blue);"' : "";
    const priceText =
      (asset.resolvedExchange === "upbit" || asset.resolvedExchange === "bithumb")
        ? `${Number(asset.Price_KRW || 0).toLocaleString()} ₩`
        : `$ ${Number(asset.Price_Raw || 0).toLocaleString()}`;
    const chgValue =
      qvState.sortType === "day"
        ? asset.Change_Today_Raw || 0
        : asset.Change_24h_Raw || 0;
    const chgText = `${chgValue > 0 ? "+" : ""}${chgValue.toFixed(2)}%`;
    const chgColor =
      chgValue > 0 ? "text-theme-up" : chgValue < 0 ? "text-theme-down" : "";

    header.innerHTML = `
      <div class="flex items-center gap-1.5">
        <span class="text-[8px] font-bold uppercase ${tagClass}" ${tagStyle}>${exTag}</span>
        <div class="w-4 h-4 flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-white/5 [&>img]:w-full [&>img]:h-full [&>img]:object-contain">
          ${asset.Logo || ""}
        </div>
        <span class="text-xs text-theme-text font-bold">${asset.Ticker}</span>
      </div>
      <div class="flex items-center gap-2 font-tempTestDss">
        <span id="qv-change-${idx}" class="text-[10px] font-bold ${chgColor}">${chgText}</span>
      </div>
    `;

    // 가격 불필요하니 숨기기
    // <span id="qv-price-${idx}" class="text-[10px] opacity-80">${priceText}</span>

    card.appendChild(header);

    // 2. 차트 캔버스 영역
    const canvasArea = document.createElement("div");
    canvasArea.className = "qv-chart-canvas-area";
    canvasArea.id = `qv-canvas-${idx}`;
    card.appendChild(canvasArea);

    wrapper.appendChild(card);

    // 3. 차트 라이브러리 초기화 (비동기 병렬 실행을 위해 리턴)
    return initSingleQuickViewChart(canvasArea, asset, idx);
  });

  // 8개 차트 병렬 렌더링 대기
  await Promise.all(promises);

  // 🚀 최신 캔들(우측 끝) 기준 전 차트 역방향 앵커링 정렬
  alignQuickViewChartsToEnd(70);

  // 🚀 [역방향/최신 캔들 기준 동기화 파이프라인]
  // 100개, 94개, 23개, 1개 등 캔들 개수가 다른 코인도 최신 캔들 기준으로 오프셋을 역산하여 완벽 동기화
  let isSyncing = false;
  qvState.charts.forEach((sourceChart, sourceIndex) => {
    if (!sourceChart) return;

    sourceChart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((logicalRange) => {
        // 다른 차트가 동기화를 주도하고 있거나 범위값이 없으면 무시 (무한루프 방지)
        if (isSyncing || !logicalRange) return;

        isSyncing = true;

        const sourceLen = (qvState.barCounts && qvState.barCounts[sourceIndex]) || 100;
        const sourceLast = Math.max(0, sourceLen - 1);
        const rightOffset = logicalRange.to - sourceLast; // 최신 캔들 기준 우측 여백 칸수
        const span = logicalRange.to - logicalRange.from; // 현재 줌 배율 (보이는 봉 개수)

        qvState.charts.forEach((targetChart, targetIndex) => {
          if (targetIndex !== sourceIndex && targetChart) {
            const targetLen = (qvState.barCounts && qvState.barCounts[targetIndex]) || 100;
            const targetLast = Math.max(0, targetLen - 1);
            const targetTo = targetLast + rightOffset; // 대상 차트의 최신 캔들 기준 동일 우측 여백 적용
            const targetFrom = targetTo - span;       // 동일 줌 배율 적용

            try {
              targetChart.timeScale().setVisibleLogicalRange({
                from: targetFrom,
                to: targetTo,
              });
            } catch (e) {}
          }
        });

        // 다음 렌더링 프레임에서 동기화 락 해제
        requestAnimationFrame(() => {
          isSyncing = false;
        });
      });
  });
  // 🚀 [여기까지 추가]

  // 겹치기 범례판 빌드
  renderOverlapLegend();

  // 최초 리사이즈 보정
  triggerResizeQuickView();
  // 🚀 [초정밀] 브라우저 리플로우(Reflow) 지연 속도를 이기는 이중 비동기 보정
  setTimeout(triggerResizeQuickView, 50);
  setTimeout(triggerResizeQuickView, 250);
}

// 📈 개별 Lightweight Chart 초기화 및 과거 데이터 100개 로드
async function initSingleQuickViewChart(container, asset, idx) {
  // 1. 차트 인스턴스 구성
  const isDark = document.body.classList.contains("theme-binance");
  const gridColor = isDark
    ? "rgba(42, 46, 57, 0.2)"
    : "rgba(213, 213, 213, 0.2)";
  const textColor = isDark ? "#8a8d97" : "#4a4a4a";

  const chartOptions = {
    layout: {
      background: { color: "transparent" }, // 투명 배경을 주어 겹칠 수 있게 함
      textColor: textColor,
      fontSize: 9,
      fontFamily: "Outfit, sans-serif",
      attributionLogo: false, // 🚀 트레이딩뷰 워터마크 끄기
    },
    grid: {
      vertLines: { color: gridColor, style: 2 },
      horzLines: { color: gridColor, style: 2 },
    },
    crosshair: {
      vertLine: { visible: true },
      horzLine: { visible: false },
    },
    rightPriceScale: {
      borderVisible: false,
      textColor: textColor,
      visible: true,
    },
    timeScale: {
      borderVisible: false,
      textColor: textColor,
      visible: true,
      timeVisible: true,
      rightOffset: 3,
    },
    handleScale: {
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
    },
  };

  const chart = LightweightCharts.createChart(container, chartOptions);

  // 차트 테마별 캔들 컬러 셋업
  const upColor = isDark ? "#26a69a" : "#c84a31";
  const downColor = isDark ? "#ef5350" : "#1261c4";

  // 겹치기 모드에서는 캔들이 가독성을 헤치므로 캔들 외에 자산 전용 라인 컬러도 추가해 둡니다.
  const assetColor = ASSET_COLORS[idx];

  const isCandleAssetColor = qvState.candleColorMode === "asset";
  const series = chart.addSeries(window.LightweightCharts.CandlestickSeries, {
    upColor: isCandleAssetColor ? assetColor : upColor,
    downColor: isCandleAssetColor ? assetColor : downColor,
    wickUpColor: isCandleAssetColor ? assetColor : upColor,
    wickDownColor: isCandleAssetColor ? assetColor : downColor,
    borderVisible: false,
  });

  qvState.charts[idx] = chart;
  qvState.series[idx] = series;

  // 2. API 과거 데이터 로드 (최신 100개 봉, 클라 ↔ 거래소 직통)
  try {
    let candles = [];

    // 개별 자산의 상장 거래소 및 심볼명 (resolveAssetExchange 결과 활용)
    if (!asset.resolvedExchange) {
      resolveAssetExchange(asset);
    }
    const exchange = asset.resolvedExchange;
    let symbol = asset.resolvedSymbol;

    if (exchange === "upbit") {
      const uTF = qvState.timeframe;
      let upbitInterval = "days";
      if (uTF === "1m") upbitInterval = "minutes/1";
      else if (uTF === "15m") upbitInterval = "minutes/15";
      else if (uTF === "1h") upbitInterval = "minutes/60";
      else if (uTF === "4h") upbitInterval = "minutes/240";

      const rawSym = String(symbol).trim().toUpperCase();
      const cleanSym = (rawSym === "USDT" || rawSym === "KRW-USDT")
        ? "USDT"
        : rawSym.replace(/^KRW-?/i, "").replace(/KRW$/i, "").replace(/USDT$/i, "").trim();

      let raw = null;
      try {
        if (idx > 0) await new Promise((r) => setTimeout(r, idx * 50));
        const res = await fetch(
          `https://api.upbit.com/v1/candles/${upbitInterval}?market=KRW-${cleanSym}&count=100`,
        );
        if (res.ok) raw = await res.json();
      } catch (e) {}

      if (!raw) {
        try {
          const res = await fetch(
            `/api/candles?exchange=upbit&symbol=KRW-${cleanSym}&interval=${upbitInterval}&limit=100`,
          );
          if (res.ok) raw = await res.json();
        } catch (e) {}
      }

      if (Array.isArray(raw)) {
        candles = raw
          .map((d) => ({
            time: new Date(d.candle_date_time_utc + "Z").getTime() / 1000,
            open: d.opening_price,
            high: d.high_price,
            low: d.low_price,
            close: d.trade_price,
          }))
          .reverse();
      }
    } else if (exchange === "bithumb") {
      // ✅ 빗썸: 타임프레임 연동 (1m, 30m, 1h, 6h, 24h)
      const bTFMap = {
        "1m": "1m",
        "15m": "30m",
        "1h": "1h",
        "4h": "6h",
        "1d": "24h",
      };
      const bInterval = bTFMap[qvState.timeframe] || "24h";
      const rawSym = String(symbol).trim().toUpperCase();
      const cleanSym = (rawSym === "USDT" || rawSym === "USDT_KRW")
        ? "USDT"
        : rawSym.replace(/_?KRW$/i, "").replace(/USDT$/i, "").trim();
      const bSym = `${cleanSym}_KRW`;
      const res = await fetch(
        `https://api.bithumb.com/public/candlestick/${bSym}/${bInterval}`,
      );
      const raw = await res.json();
      if (raw && raw.status === "0000" && Array.isArray(raw.data)) {
        candles = raw.data.slice(-100).map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          close: Number(d[2]),
          high: Number(d[3]),
          low: Number(d[4]),
        }));
      }
    } else if (exchange === "binance_futures" || exchange === "binance_spot") {
      if (symbol && !symbol.endsWith("USDT")) symbol = `${symbol}USDT`;
      // 소켓 매칭 시 정확한 룩업 키를 위해 심볼 업데이트
      asset.resolvedSymbol = symbol;

      // ⚡ 바이낸스: 브라우저 직접 시도
      const baseUrl = exchange === "binance_futures"
        ? `https://fapi.binance.com/fapi/v1/klines`
        : `https://api.binance.com/api/v3/klines`;
      const res = await fetch(
        `${baseUrl}?symbol=${symbol}&interval=${qvState.timeframe}&limit=100`,
      );
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        candles = raw.map((d) => ({
          time: Number(d[0]) / 1000,
          open: Number(d[1]),
          high: Number(d[2]),
          low: Number(d[3]),
          close: Number(d[4]),
        }));
      }
    }

    if (candles.length > 0) {
      qvState.barCounts[idx] = candles.length;
      series.setData(candles);
      // 💡 개별 fitContent()는 23개/32개 등 소량 캔들을 좌우로 늘려 최신 캔들이 잘리게 하므로 제외
    } else {
      qvState.barCounts[idx] = 0;
    }
  } catch (err) {
    console.error(`Failed to fetch history for ${asset.Ticker}:`, err);
  }
}

// 겹쳤을 때 가격 축과 시간 축 가독성을 확보하기 위해 포커스 자산 이외의 축 감추기 제어
function updateChartsAxisVisibility() {
  const isOverlap = qvState.layout === "overlap";

  qvState.charts.forEach((chart, idx) => {
    if (!chart) return;

    // Overlap 모드일 때는 포커스된 차트만 가격축과 시간축 텍스트를 활성화
    const showAxis = !isOverlap || idx === qvState.focusIndex;
    const isDark = document.body.classList.contains("theme-binance");
    const textColor = isDark ? "#8a8d97" : "#4a4a4a";

    chart.applyOptions({
      rightPriceScale: {
        visible: showAxis,
        textColor: showAxis ? textColor : "transparent",
      },
      timeScale: {
        visible: showAxis,
        textColor: showAxis ? textColor : "transparent",
      },
    });

    // 겹치기 모드에서는 캔들의 투명도를 다르게 주기 위해 카드 자체의 클래스로 다룹니다.
    const card = document.getElementById(`qv-card-${idx}`);
    if (card) {
      if (isOverlap) {
        if (idx === qvState.focusIndex) {
          card.classList.add("qv-focus-active");
        } else {
          card.classList.remove("qv-focus-active");
        }
      } else {
        card.classList.remove("qv-focus-active");
      }
    }
  });
}

// 겹치기 모드에서 특정 차트 포커스(호버) 시점
function setQuickViewFocus(idx) {
  qvState.focusIndex = idx;
  updateChartsAxisVisibility();

  // 범례 보드 하이라이팅 연동
  const items = document.querySelectorAll(".qv-legend-item");
  items.forEach((item) => {
    const itemIdx = parseInt(item.getAttribute("data-index"));
    if (itemIdx === idx) {
      item.classList.add("active");
      item.style.borderColor = ASSET_COLORS[idx];
    } else {
      item.classList.remove("active");
      item.style.borderColor = "transparent";
    }
  });
}

// 겹치기 모드 플로팅 범례(Legend) 렌더링
function renderOverlapLegend() {
  const legend = document.getElementById("qv-overlap-legend");
  if (!legend) return;

  if (qvState.layout === "spread") {
    legend.classList.add("hidden");
    legend.innerHTML = "";
    return;
  }

  legend.classList.remove("hidden");
  legend.innerHTML = `
    <div class="qv-legend-header text-[10px] font-bold text-theme-accent border-b border-theme-border/20 flex items-center justify-between uppercase">
    </div>
  `;

  // inner 문구 심플하게 가야되니깐 일단 빼버림
  // div ... pb-1.5 mb-2
  // <span>Asset Overview</span>
  // <span class="opacity-40 text-[8px] font-bold">Hover to focus</span>

  qvState.activeAssets.forEach((asset, idx) => {
    const item = document.createElement("div");
    item.className =
      "qv-legend-item border border-transparent rounded-lg transition-all";
    item.setAttribute("data-index", idx);

    const color = ASSET_COLORS[idx];
    const chgValue =
      qvState.sortType === "day"
        ? asset.Change_Today_Raw || 0
        : asset.Change_24h_Raw || 0;
    const chgText = `${chgValue > 0 ? "+" : ""}${chgValue.toFixed(2)}%`;
    const chgColor =
      chgValue > 0 ? "text-theme-up" : chgValue < 0 ? "text-theme-down" : "";

    item.innerHTML = `
      <span class="qv-legend-color-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></span>
      <span class="text-[10px] text-theme-text font-bold">${asset.Ticker}</span>
      <span class="ml-auto font-tempTestDss text-[9px] ${chgColor}">${chgText}</span>
    `;

    // 범례 호버 시 해당 차트 포커스
    item.addEventListener("mouseenter", () => {
      setQuickViewFocus(idx);
    });

    legend.appendChild(item);
  });

  // 최초 0번 인덱스 포커스 활성화
  setQuickViewFocus(0);

  // 🚀 마우스 호버 여부 및 1초 지연 collapse 바인딩
  if (!legend.dataset.eventsBound) {
    let legendTimeout = null;

    legend.addEventListener("mouseenter", () => {
      if (legendTimeout) {
        clearTimeout(legendTimeout);
        legendTimeout = null;
      }
      legend.classList.remove("collapsed");
    });

    legend.addEventListener("mouseleave", () => {
      if (legendTimeout) clearTimeout(legendTimeout);
      legendTimeout = setTimeout(() => {
        legend.classList.add("collapsed");
      }, 1000);
    });

    legend.dataset.eventsBound = "true";
  }

  // 최초 렌더링 시 1초 후 접히도록 타이머 작동 (만약 이미 마우스가 올라가 있으면 접지 않음)
  legend.classList.remove("collapsed");
  if (legend._initTimeout) clearTimeout(legend._initTimeout);
  legend._initTimeout = setTimeout(() => {
    if (!legend.matches(":hover")) {
      legend.classList.add("collapsed");
    }
  }, 1000);
}

// ⚡ 실시간 웹소켓 통합 연결 및 멀티플렉스 스트림 가동
function connectQuickViewSockets() {
  disconnectQuickViewSockets();

  const binanceSpotAssets = qvState.activeAssets.filter(
    (a) => a.resolvedExchange === "binance_spot"
  );
  const binanceFuturesAssets = qvState.activeAssets.filter(
    (a) => a.resolvedExchange === "binance_futures"
  );
  const upbitAssets = qvState.activeAssets.filter(
    (a) => a.resolvedExchange === "upbit"
  );
  const bithumbAssets = qvState.activeAssets.filter(
    (a) => a.resolvedExchange === "bithumb"
  );

  const interval = qvState.timeframe;

  // 공통 바이낸스 웹소켓 수신 핸들러
  const handleBinanceWsMessage = (e, isFutures) => {
    const res = JSON.parse(e.data);
    if (!res.data) return;

    const data = res.data;
    const eventType = data.e;

    if (eventType !== "kline" && eventType !== "aggTrade") return;

    const tickSymbol = data.s.toUpperCase();

    // 해당하는 차트 인덱스 찾기
    const idx = qvState.activeAssets.findIndex((a) => {
      if (!a.resolvedSymbol) return false;
      const targetSym = a.resolvedSymbol.toUpperCase();
      return targetSym === tickSymbol || `${targetSym}USDT` === tickSymbol;
    });
    if (idx === -1) return;

    const series = qvState.series[idx];
    const chart = qvState.charts[idx];
    if (!series || !chart) return;

    if (eventType === "kline") {
      const k = data.k;
      const candle = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };

      try {
        series.update(candle);
        updateLiveHeaderPrice(idx, candle.close, k.P || "0.0");
      } catch (err) { }
    } else if (eventType === "aggTrade") {
      const newPrice = parseFloat(data.p);
      if (isNaN(newPrice)) return;

      const secondsPerBar = tfSec[qvState.timeframe] || 3600;
      const barTime =
        Math.floor(data.E / 1000 / secondsPerBar) * secondsPerBar;

      const candle = {
        time: barTime,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
      };

      try {
        series.update(candle);
        const asset = qvState.activeAssets[idx];
        const chgValue =
          qvState.sortType === "day"
            ? asset.Change_Today_Raw || 0
            : asset.Change_24h_Raw || 0;
        updateLiveHeaderPrice(idx, newPrice, chgValue.toString(), true);
      } catch (err) { }
    }
  };

  // 1. 바이낸스 현물 스트림 채널 활성화
  if (binanceSpotAssets.length > 0) {
    const wsBase = "wss://stream.binance.com:9443/stream?streams=";
    const streamsList = [];
    binanceSpotAssets.forEach((asset) => {
      if (asset.resolvedSymbol) {
        const sym = asset.resolvedSymbol.toLowerCase();
        streamsList.push(`${sym}@kline_${interval}`);
        streamsList.push(`${sym}@aggtrade`);
      }
    });
    const streams = streamsList.join("/");
    qvState.binanceWs = new WebSocket(wsBase + streams);
    qvState.binanceWs.onmessage = (e) => handleBinanceWsMessage(e, false);
  }

  // 2. 바이낸스 선물 스트림 채널 활성화
  if (binanceFuturesAssets.length > 0) {
    const wsBase = "wss://fstream.binance.com/stream?streams=";
    const streamsList = [];
    binanceFuturesAssets.forEach((asset) => {
      if (asset.resolvedSymbol) {
        const sym = asset.resolvedSymbol.toLowerCase();
        streamsList.push(`${sym}@kline_${interval}`);
        streamsList.push(`${sym}@aggtrade`);
      }
    });
    const streams = streamsList.join("/");
    qvState.binanceFuturesWs = new WebSocket(wsBase + streams);
    qvState.binanceFuturesWs.onmessage = (e) => handleBinanceWsMessage(e, true);
  }

  // 3. 업비트 Ticker 스트림 활성화
  if (upbitAssets.length > 0) {
    qvState.upbitWs = new WebSocket("wss://api.upbit.com/websocket/v1");
    qvState.upbitWs.binaryType = "arraybuffer";

    qvState.upbitWs.onopen = () => {
      const codes = upbitAssets.map(
        (a) => `KRW-${String(a.resolvedSymbol).replace(/^KRW-?/i, "").replace(/KRW$/i, "").replace(/USDT$/i, "").trim().toUpperCase()}`,
      );
      qvState.upbitWs.send(
        JSON.stringify([
          { ticket: "quickview_upbit_engine" },
          { type: "ticker", codes: codes },
        ]),
      );
    };

    const decoder = new TextDecoder("utf-8");
    qvState.upbitWs.onmessage = (e) => {
      try {
        const ticker = JSON.parse(decoder.decode(e.data));
        if (!ticker.code) return;

        const pureSym = ticker.code.replace("KRW-", "").toUpperCase();

        // 해당하는 차트 인덱스 찾기
        const idx = qvState.activeAssets.findIndex(
          (a) => a.resolvedExchange === "upbit" && String(a.resolvedSymbol).replace(/^KRW-?/i, "").replace(/KRW$/i, "").toUpperCase() === pureSym,
        );
        if (idx === -1) return;

        const series = qvState.series[idx];
        const chart = qvState.charts[idx];
        if (!series || !chart) return;

        const nowMs = ticker.timestamp;
        const secondsPerBar = tfSec[qvState.timeframe] || 3600;
        const barTime =
          Math.floor(nowMs / 1000 / secondsPerBar) * secondsPerBar;

        const tradePrice = parseFloat(ticker.trade_price);

        const candle = {
          time: barTime,
          open: tradePrice,
          high: tradePrice,
          low: tradePrice,
          close: tradePrice,
        };

        series.update(candle);
        updateLiveHeaderPrice(
          idx,
          tradePrice,
          (ticker.signed_change_rate * 100).toString(),
          true,
        );
      } catch (err) {
        console.error("퀵뷰 업비트 소켓 파싱 에러:", err);
      }
    };
  }

  // 4. 빗썸 Transaction 스트림 활성화
  if (bithumbAssets.length > 0) {
    qvState.bithumbWs = new WebSocket("wss://pubwss.bithumb.com/pub/ws");

    qvState.bithumbWs.onopen = () => {
      const symbols = bithumbAssets.map((a) => {
        const cleanSym = String(a.resolvedSymbol).replace(/_?KRW$/i, "").replace(/USDT$/i, "").trim().toUpperCase();
        return `${cleanSym}_KRW`;
      });
      try {
        qvState.bithumbWs.send(
          JSON.stringify({
            type: "transaction",
            symbols: symbols,
          }),
        );
      } catch (e) {
        console.error("퀵뷰 빗썸 소켓 구독 에러:", e);
      }
    };

    qvState.bithumbWs.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data);
        if (res.type !== "transaction" || !res.content?.list) return;

        res.content.list.forEach((trade) => {
          const pureSym = trade.symbol.replace("_KRW", "").toUpperCase();
          const newPrice = parseFloat(trade.contPrice);
          if (isNaN(newPrice)) return;

          // 해당하는 차트 인덱스 찾기
          const idx = qvState.activeAssets.findIndex((a) => {
            if (a.resolvedExchange !== "bithumb" || !a.resolvedSymbol) return false;
            const target = String(a.resolvedSymbol).replace(/_?KRW$/i, "").toUpperCase();
            return target === pureSym;
          });
          if (idx === -1) return;

          const series = qvState.series[idx];
          const chart = qvState.charts[idx];
          if (!series || !chart) return;

          const secondsPerBar = tfSec[qvState.timeframe] || 3600;
          const nowSec = Math.floor(Date.now() / 1000);
          const barTime = Math.floor(nowSec / secondsPerBar) * secondsPerBar;

          const candle = {
            time: barTime,
            open: newPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice,
          };

          try {
            series.update(candle);
            const asset = qvState.activeAssets[idx];
            const chgValue =
              qvState.sortType === "day"
                ? asset.Change_Today_Raw || 0
                : asset.Change_24h_Raw || 0;
            updateLiveHeaderPrice(idx, newPrice, chgValue.toString(), true);
          } catch (err) {}
        });
      } catch (err) {
        console.error("퀵뷰 빗썸 소켓 파싱 에러:", err);
      }
    };
  }
}

// 🔌 실시간 웹소켓 연결 종료
function disconnectQuickViewSockets() {
  if (qvState.binanceWs) {
    qvState.binanceWs.onmessage = null;
    qvState.binanceWs.onerror = null;
    qvState.binanceWs.onclose = null;
    try {
      qvState.binanceWs.close(1000, "Normal Closure");
    } catch (e) {}
    qvState.binanceWs = null;
  }
  if (qvState.binanceFuturesWs) {
    qvState.binanceFuturesWs.onmessage = null;
    qvState.binanceFuturesWs.onerror = null;
    qvState.binanceFuturesWs.onclose = null;
    try {
      qvState.binanceFuturesWs.close(1000, "Normal Closure");
    } catch (e) {}
    qvState.binanceFuturesWs = null;
  }
  if (qvState.upbitWs) {
    qvState.upbitWs.onmessage = null;
    qvState.upbitWs.onerror = null;
    qvState.upbitWs.onclose = null;
    try {
      qvState.upbitWs.close(1000, "Normal Closure");
    } catch (e) {}
    qvState.upbitWs = null;
  }
  if (qvState.bithumbWs) {
    qvState.bithumbWs.onmessage = null;
    qvState.bithumbWs.onerror = null;
    qvState.bithumbWs.onclose = null;
    try {
      qvState.bithumbWs.close(1000, "Normal Closure");
    } catch (e) {}
    qvState.bithumbWs = null;
  }
}

// 💵 실시간 헤더 단가 및 등락률 갱신
function updateLiveHeaderPrice(idx, price, changePct, isFlash = false) {
  const asset = qvState.activeAssets[idx];
  if (!asset) return;

  const priceEl = document.getElementById(`qv-price-${idx}`);
  const changeEl = document.getElementById(`qv-change-${idx}`);

  const isKor = asset.resolvedExchange === "upbit" || asset.resolvedExchange === "bithumb";
  if (isKor) {
    asset.Price_KRW = price;
    if (priceEl) priceEl.innerText = `${price.toLocaleString()} ₩`;
  } else {
    asset.Price_Raw = price;
    if (priceEl) priceEl.innerText = `$ ${price.toLocaleString()}`;
  }

  const numericChg = parseFloat(changePct);
  if (changeEl) {
    changeEl.innerText = `${numericChg > 0 ? "+" : ""}${numericChg.toFixed(2)}%`;
    changeEl.className = `text-[10px] font-bold ${numericChg > 0 ? "text-theme-up" : numericChg < 0 ? "text-theme-down" : ""}`;
  }

  // 실시간 체결 번쩍임(Flash) 효과
  if (isFlash && priceEl) {
    const isDark = document.body.classList.contains("theme-binance");
    priceEl.style.transition = "color 0.1s ease";
    priceEl.style.color = isDark ? "#ffffff" : "#000000";
    if (priceEl._flashTimeout) clearTimeout(priceEl._flashTimeout);
    priceEl._flashTimeout = setTimeout(() => {
      priceEl.style.color = "";
    }, 200);
  }

  // 범례판 내부 실시간 정보 동기화
  const legendItem = document.querySelector(
    `.qv-legend-item[data-index="${idx}"]`,
  );
  if (legendItem) {
    const chgSpan = legendItem.querySelector("span:last-child");
    if (chgSpan) {
      chgSpan.innerText = `${numericChg > 0 ? "+" : ""}${numericChg.toFixed(2)}%`;
      chgSpan.className = `ml-auto font-tempTestDss text-[9px] ${numericChg > 0 ? "text-theme-up" : numericChg < 0 ? "text-theme-down" : ""}`;
    }
  }
}

// ↕️ 레이아웃 모드 설정 (Spread ↔ Overlap)
export function setQuickViewLayout(layout) {
  if (qvState.layout === layout) return;
  qvState.layout = layout;

  updateLayoutToggleUI(layout);

  const wrapper = document.getElementById("qv-charts-wrapper");
  if (!wrapper) return;

  const cards = Array.from(wrapper.querySelectorAll(".qv-chart-card"));
  if (!cards.length) {
    wrapper.className =
      qvState.layout === "spread"
        ? "qv-spread-mode w-full h-full relative"
        : "qv-overlap-mode w-full h-full relative";
    renderOverlapLegend();
    updateChartsAxisVisibility();
    return;
  }

  // [최적화 1] 애니메이션 시작 전 무거운 축 텍스트/범례 상태를 먼저 업데이트
  updateChartsAxisVisibility();

  const wrapperRect = wrapper.getBoundingClientRect();

  if (qvState.layout === "overlap") {
    // ── Spread → Overlap: 각 카드가 제자리에서 스무스하게 중앙 전체로 확대되며 병합 ──
    const firstRects = cards.map((c) => c.getBoundingClientRect());

    wrapper.className = "qv-overlap-mode w-full h-full relative";
    renderOverlapLegend();

    cards.forEach((card, i) => {
      const r = firstRects[i];
      const startCx = r.left - wrapperRect.left + r.width / 2;
      const startCy = r.top - wrapperRect.top + r.height / 2;
      const destCx = wrapperRect.width / 2;
      const destCy = wrapperRect.height / 2;

      const dx = startCx - destCx;
      const dy = startCy - destCy;

      const scaleX = r.width / wrapperRect.width;
      const scaleY = r.height / wrapperRect.height;

      // Invert: Overlap 레이아웃 상에서 크기/위치를 기존 Spread 위치로 강제 매핑
      card.style.transition = "none";
      card.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      card.style.transformOrigin = "center";
      card.style.opacity = "1";
      card.style.zIndex = "5";

      // Play: 원래 위치로 가득 채워지는 애니메이션 진행
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition =
            "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease";
          card.style.transform = "translate(0, 0) scale(1)";
          card.style.opacity = "0.4"; // 겹치기 모드의 불투명도로 수렴
        });
      });
    });

    // [최적화 2] 350ms 애니메이션 트랜지션이 완전히 정지된 이후에 딱 한 번 리사이즈 트리거
    setTimeout(() => {
      cards.forEach((card) => {
        card.style.cssText = "";
      });
      requestAnimationFrame(() => {
        triggerResizeQuickView();
      });
    }, 380);
  } else {
    // ── Overlap → Spread: 중앙의 겹쳐진 레이아웃에서 제자리(그리드)로 흩어지며 축소 ──
    wrapper.className = "qv-spread-mode w-full h-full relative";
    renderOverlapLegend();

    const lastRects = cards.map((c) => c.getBoundingClientRect());

    cards.forEach((card, i) => {
      const r = lastRects[i];
      const destCx = r.left - wrapperRect.left + r.width / 2;
      const destCy = r.top - wrapperRect.top + r.height / 2;
      const startCx = wrapperRect.width / 2;
      const startCy = wrapperRect.height / 2;

      const dx = startCx - destCx;
      const dy = startCy - destCy;

      const scaleX = wrapperRect.width / r.width;
      const scaleY = wrapperRect.height / r.height;

      // Invert: Spread 그리드 내에서 크기/위치를 Overlap 위치(전체화면, 중앙)로 매핑
      card.style.transition = "none";
      card.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      card.style.transformOrigin = "center";
      card.style.opacity = "0.4";
      card.style.zIndex = "10";

      // Play: 그리드 내 제자리로 축소되며 복구 애니메이션 진행
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition =
            "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease";
          card.style.transform = "translate(0, 0) scale(1)";
          card.style.opacity = "1";
        });
      });
    });

    // [최적화 2] 애니메이션이 멈춘 다음 최종 프레임에서 리사이즈 진행
    setTimeout(() => {
      cards.forEach((card) => {
        card.style.cssText = "";
      });
      requestAnimationFrame(() => {
        triggerResizeQuickView();
      });
    }, 380);
  }
}

// 🔀 정렬 기준 교체
export function changeQuickViewSort(type) {
  if (qvState.sortType === type) return;
  qvState.sortType = type;
  qvState.page = 1;

  // 헤더 정렬 버튼 액티브 클래스 업데이트
  const btns = document.querySelectorAll(".qv-sort-btn");
  btns.forEach((btn) => {
    const id = btn.id;
    if (id === `qv-sort-${type}`) {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-white bg-theme-accent";
    } else {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-theme-text opacity-50 hover:opacity-100";
    }
  });

  // 차트 전체 갱신
  initQuickView();
}

// ⏱️ 타임프레임 전환
export function changeQuickViewTF(tf) {
  if (qvState.timeframe === tf) return;
  qvState.timeframe = tf;

  // 타임프레임 버튼 클래스 갱신
  const btns = document.querySelectorAll(".qv-tf-btn");
  btns.forEach((btn) => {
    const id = btn.id;
    if (id === `qv-tf-${tf}`) {
      btn.className =
        "px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-white bg-theme-accent";
    } else {
      btn.className =
        "px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-theme-text opacity-50 hover:opacity-100";
    }
  });

  // 차트 전체 갱신
  initQuickView();
}

// 📄 페이지 이동
export function changeQuickViewPage(dir) {
  const targetPage = qvState.page + dir;
  if (targetPage < 1 || targetPage > qvState.maxPage) return; // 범위 강제

  qvState.page = targetPage;

  const pageIndicator = document.getElementById("qv-page-indicator");
  if (pageIndicator)
    pageIndicator.innerText = `PAGE ${targetPage} / ${qvState.maxPage}`;

  // 차트 전체 갱신
  initQuickView();
}

// 🚪 초기 Glassmorphic 정렬 선택 카드 클릭 처리
export function selectQuickViewInitSort(type) {
  // 정렬 지정 후 퀵뷰 본 시동
  changeQuickViewSort(type);

  const initOverlay = document.getElementById("quickview-init-overlay");
  if (initOverlay) {
    initOverlay.classList.add("hidden");
    initOverlay.style.display = "none";
  }
}

// 🧭 모든 퀵뷰 차트를 최신 캔들(우측 끝) 기준으로 정렬 (100개, 94개, 23개, 1개 등 캔들 수가 적어도 최신봉 완벽 방어)
export function alignQuickViewChartsToEnd(span = 70) {
  qvState.charts.forEach((chart, idx) => {
    if (!chart) return;
    const count = (qvState.barCounts && qvState.barCounts[idx]) || 100;
    const last = Math.max(0, count - 1);
    const to = last + 3; // 최신 캔들 우측 여백 3칸 (잘림 방지)
    const from = to - span;
    try {
      chart.timeScale().setVisibleLogicalRange({ from, to });
    } catch (e) {}
  });
}

function triggerResizeQuickView() {
  qvState.charts.forEach((chart, idx) => {
    if (!chart) return;
    const canvasContainer = document.getElementById(`qv-canvas-${idx}`);
    if (canvasContainer) {
      const width = canvasContainer.clientWidth;
      const height = canvasContainer.clientHeight;
      if (width > 0 && height > 0) {
        chart.resize(width, height);
      } else {
        // 🚀 [보완] 리플로우 지연 등으로 일시적 크기 누락 시 다음 렌더링 프레임에 강제 재시도
        requestAnimationFrame(() => {
          const w = canvasContainer.clientWidth;
          const h = canvasContainer.clientHeight;
          if (w > 0 && h > 0) {
            chart.resize(w, h);
          }
        });
      }
    }
  });
  // 리사이즈 후에도 모든 차트 최신 캔들 기준 역방향 앵커링 정렬 유지
  alignQuickViewChartsToEnd(70);
}

// 윈도우 리사이즈 이벤트 바인딩
window.addEventListener("resize", () => {
  const qvContainer = document.getElementById("quickview-container");
  if (qvContainer && !qvContainer.classList.contains("hidden")) {
    triggerResizeQuickView();
  }
});

// 🔄 퀵뷰 상태 리셋 및 오버레이 초기화 복구
export function resetQuickView() {
  qvState.sortType = "";
  qvState.page = 1;
  destroyQuickView();

  // destroyQuickView가 컨테이너를 display: none으로 만들기 때문에 다시 노출 처리
  const container = document.getElementById("quickview-container");
  if (container) {
    container.classList.remove("hidden");
    container.classList.add("qv-modal");
    container.style.display = "flex";
  }

  const initOverlay = document.getElementById("quickview-init-overlay");
  if (initOverlay) {
    initOverlay.classList.remove("hidden");
    initOverlay.style.display = "flex";
  }
}

export function closeQuickViewModal() {
  if (typeof window.switchChartTab === "function") {
    window.switchChartTab("chart");
  }
  if (typeof window.moveTabSlider === "function") {
    window.moveTabSlider(0);
  }
}

export function toggleQuickViewCandleColor() {
  qvState.candleColorMode =
    qvState.candleColorMode === "asset" ? "default" : "asset";

  // 버튼 스타일 업데이트
  const btn = document.getElementById("qv-color-toggle-btn");
  if (btn) {
    if (qvState.candleColorMode === "asset") {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-lg border border-theme-accent text-white bg-theme-accent transition-all flex items-center gap-1.5 cursor-pointer";
    } else {
      btn.className =
        "px-3 py-1.5 text-[10px] font-bold rounded-lg border border-theme-border/50 hover:border-theme-accent text-theme-text hover:text-theme-accent bg-transparent transition-all flex items-center gap-1.5 cursor-pointer";
    }
  }

  // 실시간 캔들 색상 변경 적용
  updateQuickViewTheme();
}

export function setQuickViewBase(base) {
  if (qvState.baseTarget === base) return;
  qvState.baseTarget = base;

  const btnAll = document.getElementById("qv-base-all");
  const btnFav = document.getElementById("qv-base-fav");
  const btnFav2 = document.getElementById("qv-base-fav2");

  if (btnAll && btnFav) {
    [btnAll, btnFav, btnFav2].forEach((btn) => {
      if (btn) {
        btn.className =
          "px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all text-theme-text opacity-50 hover:opacity-100 cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0";
      }
    });
    const activeBtn =
      base === "ALL" ? btnAll : base === "FAV" ? btnFav : btnFav2;
    if (activeBtn) {
      activeBtn.className =
        "px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all text-white bg-theme-accent cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0";
    }
  }
}

export function resetQuickViewChartsScale() {
  alignQuickViewChartsToEnd(70);
}

// 전역 window 바인딩 노출
window.initQuickView = initQuickView;
window.destroyQuickView = destroyQuickView;
window.setQuickViewBase = setQuickViewBase;
window.alignQuickViewChartsToEnd = alignQuickViewChartsToEnd;
window.resetQuickViewChartsScale = resetQuickViewChartsScale;
window.setQuickViewLayout = setQuickViewLayout;
window.changeQuickViewSort = changeQuickViewSort;
window.changeQuickViewTF = changeQuickViewTF;
window.changeQuickViewPage = changeQuickViewPage;
window.selectQuickViewInitSort = selectQuickViewInitSort;
window.triggerResizeQuickView = triggerResizeQuickView;
window.resetQuickView = resetQuickView;
window.closeQuickViewModal = closeQuickViewModal;
window.toggleQuickViewCandleColor = toggleQuickViewCandleColor;

// 🎨 레이아웃 토글 슬라이더 UI 렌더링 헬퍼
export function updateLayoutToggleUI(layout) {
  const btnSpread = document.getElementById("qv-layout-spread");
  const btnOverlap = document.getElementById("qv-layout-overlap");
  const slider = document.getElementById("qv-layout-slider");

  if (btnSpread && btnOverlap && slider) {
    if (layout === "spread") {
      btnSpread.className =
        "relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-white cursor-pointer";
      btnOverlap.className =
        "relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-theme-text opacity-60 hover:opacity-100 cursor-pointer";
      slider.style.transform = "translateX(0px)";
    } else {
      btnSpread.className =
        "relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-theme-text opacity-60 hover:opacity-100 cursor-pointer";
      btnOverlap.className =
        "relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-white cursor-pointer";
      // offsetLeft 측정으로 동적인 슬라이딩 트랜지션 연출
      const offset = btnOverlap.offsetLeft - btnSpread.offsetLeft;
      slider.style.transform = `translateX(${offset}px)`;
    }
  }
}
window.updateLayoutToggleUI = updateLayoutToggleUI;

export function updateQuickViewTheme() {
  const isDark = document.body.classList.contains("theme-binance");
  const gridColor = isDark
    ? "rgba(42, 46, 57, 0.2)"
    : "rgba(213, 213, 213, 0.2)";
  const textColor = isDark ? "#8a8d97" : "#4a4a4a";
  const upColor = isDark ? "#26a69a" : "#c84a31";
  const downColor = isDark ? "#ef5350" : "#1261c4";

  // 테마 변경 시에도 레이아웃 슬라이더 위치 재보정
  updateLayoutToggleUI(qvState.layout);

  qvState.charts.forEach((chart, idx) => {
    if (!chart) return;

    const showAxis = qvState.layout !== "overlap" || idx === qvState.focusIndex;
    chart.applyOptions({
      layout: {
        textColor: showAxis ? textColor : "transparent",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        textColor: showAxis ? textColor : "transparent",
      },
      timeScale: {
        textColor: showAxis ? textColor : "transparent",
      },
    });

    const series = qvState.series[idx];
    if (series) {
      if (qvState.candleColorMode === "asset") {
        const assetColor = ASSET_COLORS[idx];
        series.applyOptions({
          upColor: assetColor,
          downColor: assetColor,
          wickUpColor: assetColor,
          wickDownColor: assetColor,
        });
      } else {
        series.applyOptions({
          upColor: upColor,
          downColor: downColor,
          wickUpColor: upColor,
          wickDownColor: downColor,
        });
      }
    }
  });
}
window.updateQuickViewTheme = updateQuickViewTheme;
window.initQuickView = initQuickView;
window.destroyQuickView = destroyQuickView;
