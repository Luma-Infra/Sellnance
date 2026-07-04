export const store = {
  marketDataMap: { upbit: [], spot: [], futures: [], krw_usd_rate: 0.0 },
  allSymbols: [],
  originalTableData: [],
  currentTableData: [],
  tickerBuffer: {},
  tickerCache: {},
  visibleSymbols: new Set(),
  intersectingSymbols: new Set(),
  btcRateCache: {}, // 🚀 합성 환율 전용 메모리 캐시 엔진 추가
  tickerRowMap: new Map(), // 🚀 [단일 진실 공급원] 전역 테이블 행 O(1) 광속 탐색 맵

  currentAsset: null,
  currentSelectedSymbol: null,
  isScrolling: false, // 🚀 스크롤 중 여부 플래그
  isEngineStarted: false, // 🚀 최초 코인 선택 시 소켓 및 차트 점화 여부 플래그
  mcapMin: 0, // 🚀 시총 최소값 (기본 0)
  mcapMax: 10000000000, // 🚀 시총 최대값 (기본 10B)
  customMcapMin: 0, // 🚀 커스텀 시총 최소값
  customMcapMax: 10000000000000, // 🚀 커스텀 시총 최대값 (기본 10T)
  customVolMin: 0, // 🚀 커스텀 거래량 최소값
  customVolMax: 100000000000, // 🚀 커스텀 거래량 최대값 (기본 100B)
  customVolSource: "BINANCE", // 🚀 커스텀 거래량 소스 (BINANCE 또는 UPBIT)
  tempMcapMin: 0,
  tempMcapMax: 10000000000000,
  tempVolMin: 0,
  tempVolMax: 100000000000,
  tempVolSource: "BINANCE",
  useFlip: true, // 🚀 플립 애니메이션 사용 여부
  hideSmallCap: false, // 🚀 시총 1M 미만 숨기기 여부
  lang: "EN", // 🚀 한/영 토글 (KR, EN)
  filterMode: "BINANCE", // 🚀 [추가] ALL, BINANCE, UPBIT, FUTURES, SPOT
  currentMarket: "ALL", // 🚀 테이블 활성 마켓 탭 상태 추적
  currentChartMarket: "ALL", // 🚀 우측 차트/호가창 활성 마켓 상태 추적
  currencyMode: "USD", // 🚀 [추가] USD, KRW 토글 모드
  viewMode: "DETAILED",
  tableViewMode: "basic",
  listingDates: {}, // 📅 거래소별 상장일 { BTC: { binance_listing: "2019-09-08", upbit_listing: "..." } }
  settings: {
    CMC_API_KEY: "",
  },
  currentTF: "1d",
  visibleTfs: [
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "12h",
    "1d",
    "3d",
    "1w",
    "1M",
  ],

  chart: null,
  candleSeries: null,
  previewSeries: null,
  volumeSeries: null,
  savedZoomWidth: null, // 🚀 [UX 개선] 사용자가 스크롤/줌을 통해 설정한 캔들 개수(가로폭) 저장용
  savedPriceScaleWidth: null, // 🚀 [UX 개선] 우측 가격 축의 실시간 너비 저장용 (멀티 뷰포트 정밀 동기화용)
  kimchiSeries: null,
  chartVol: null,
  chartKimchi: null,
  kimchiData: null,
  mainData: [],
  countdownPriceLine: null,
  paneConfig: { volume: true, kimchi: true },
  chartSplits: { s1: 0.65, s2: 0.85 },
  exchFilterStates: {
    BINANCE: 0,
    BINANCE_FUTURES: 0,
    BINANCE_STOCK: 0,
    UPBIT: 0,
    BITHUMB: 0,
    BYBIT: 0,
    OKX: 0,
    BITGET: 0,
    GATEIO: 0,
    COINBASE: 0,
  },
  exchFilterMode: "AND", // 🚀 거래소 필터링 결합 모드 (AND, OR, ONLY)

  isFetchingChart: false, // 🚀 차트 데이터 호출 진행 상태 플래그
  blockLeftDom: false, // 🚀 좌측 테이블 DOM 렌더링 최적화/차단 여부
  blockRightDom: false, // 🚀 우측 패널 DOM 렌더링 최적화/차단 여부
  blockChartDom: false, // 🚀 실시간 차트 갱신 렌더링 최적화/차단 여부
  blockChartMouseEvent: false, // 🚀 우측 차트 영역 마우스 이벤트/십자선 렉 유발 차단 토글
  blockOrderbook: true, // 🚀 실시간 호가창 렌더링 최적화/차단 여부
  blockSort: false, // 🚀 테이블 실시간 순위 재배치 정렬 최적화/차단 여부
  blockTableUpdate: false, // 🚀 좌측 테이블 실시간 셀/시세 갱신 차단 토글
  blockKimchi: false, // 🚀 실시간 김프 연산 차단 여부
  blockLegend: false, // 🚀 OHLC 레전드 갱신 차단 여부
  blockChartResize: false, // 🚀 차트 리사이즈 동기화 차단 여부
  blockTableTabScroll: false, // 🚀 테이블 스크롤/탭 갱신 차단 여부
  blockRadarBatch: false, // 🚀 실시간 레이더 배치 처리 차단 여부
  blockRowDynamicHTML: false, // 🚀 [신규] 김프 전파 동적 HTML 갱신 차단 토글 (기본값: TRUE)
  aggTradeInterval: 0, // 🚀 aggTrade 주기 조절 (ms 단위, 0 = Raw)
  lastFetchTime: 0, // 🚀 마지막 데이터 수집 시간 기록용
  isLogMode: false, // 🚀 차트 로그 스케일 활성화 여부
  traceRowCaller: false, // 🚀 [디버그 토글] 단 1줄로 좌측 1번 행(Index 0) callerId 전광판 추적 및 확장 영역 보이기/사라지기 제어!
  enableOrderbookVisual: true, // 호가창 보기
  showCountdown: true, // 🚀 차트 카운트다운 표시 여부
  currentRenderLimit: 1000, // 🚀 최대 렌더링 캔들 제한 개수

  // 🚀 [성능 통계 카운터] 차단 가드에 의해 연산/갱신이 바이패스(빠꾸)처리된 실시간 카운트 집계기
  bypassCounters: {
    rightDom: 0,
    chartDom: 0,
    orderbook: 0,
    legend: 0,
    resize: 0,
    mouseEvent: 0,
    leftDom: 0,
    sort: 0,
    tabScroll: 0,
    tableUpdate: 0,
    kimchi: 0,
    radarBatch: 0,
    dynamicHtml: 0,
    throttleBypass: 0, // 🚀 [신규] 100ms 진입 쓰로틀링 걸려 빠꾸먹은 건수
    throttlePass: 0,   // 🚀 [신규] 100ms 가드 통과해서 실제 처리된 건수
  },

  curDir: "bull",
  bullBody: 10,
  bearBody: 5,
  isHover: false,

  binanceChartWs: null,
  upbitChartWs: null,
  bithumbChartWs: null,
  bybitChartWs: null,
  currentKlineStream: null,
  currentBithumbStream: null,
  currentBybitStream: null,
  binanceRadarWs: null,
  binanceFuturesRadarWs: null, // 🚀 선물 레이더 소켓 변수 추가
  upbitRadarWs: null,
  sniperWs: null,
  activeSubs: new Set(),
  radarIntervalId: null,

  currentTheme: "binance",
  isCollapsed: false,
  isSidebarOpen: true,
  countdownTimerId: null,
  countdownOverlay: null,
  localTimeAtUpdate: 0,
  lastServerMs: 0,
  displayTime: "Wait...",
  currentSortCol: "Volume",
  sortState: "desc",
  tableObserver: null,
  isCrosshairActive: false, // 🚀 십자선(크로스헤어) 활성화 상태 추적용

  isMeasuring: false,
  measureStart: null,
  measureEnd: null,
  cachedChartTd: null,
  cachedPriceTd: null,

  // 🚀 그리기 관련 전역 상태 변수들
  activeTool: "cursor",
  drawings: { trendlines: [], horizontals: [], fibs: [], brushes: [] },
  drawingStart: null,
  drawingTempEnd: null,
  drawingBrush: null, // 임시 브러시 궤적
  drawingsHidden: false,
  drawingsLocked: false,
  magnetActive: false,
  _drawingPrimitive: null,

  // 🚀 [단일 진실 공급원] 조건식 떡칠 제거용 전역 정밀도 캐시 맵 및 헬퍼
  precisionMap: new Map(),
  getPrecision: function (sym) {
    if (!sym) return store.currentPrecision || 2;
    const key = String(sym).toUpperCase();

    if (store.precisionMap.has(key)) {
      return store.precisionMap.get(key);
    }

    let row = store.tickerRowMap.get(key);
    if (!row) {
      let cleanKey = key;
      if (cleanKey.endsWith("KRW")) cleanKey = cleanKey.slice(0, -3);
      else if (cleanKey.endsWith("USDT")) cleanKey = cleanKey.slice(0, -4);

      row = store.tickerRowMap.get(cleanKey);
      if (!row) {
        for (const [k, r] of store.tickerRowMap.entries()) {
          const cleanK = k.endsWith("KRW") ? k.slice(0, -3) : (k.endsWith("USDT") ? k.slice(0, -4) : k);
          if (cleanK === cleanKey) {
            row = r;
            break;
          }
        }
      }
    }

    if (!row) {
      const allSource = store.currentTableData || store.originalTableData || [];
      let cleanKey = key;
      if (cleanKey.endsWith("KRW")) cleanKey = cleanKey.slice(0, -3);
      else if (cleanKey.endsWith("USDT")) cleanKey = cleanKey.slice(0, -4);

      row = allSource.find((r) => {
        const t = (r.Ticker || "").toUpperCase();
        const dt = (r.DisplayTicker || "").toUpperCase();
        const s = (r.Symbol || "").toUpperCase();
        const cleanT = t.endsWith("KRW") ? t.slice(0, -3) : (t.endsWith("USDT") ? t.slice(0, -4) : t);
        const cleanDt = dt.endsWith("KRW") ? dt.slice(0, -3) : (dt.endsWith("USDT") ? dt.slice(0, -4) : dt);
        const cleanS = s.endsWith("KRW") ? s.slice(0, -3) : (s.endsWith("USDT") ? s.slice(0, -4) : s);
        return cleanT === cleanKey || cleanDt === cleanKey || cleanS === cleanKey;
      });
    }

    const p =
      row && row.precision !== undefined
        ? Number(row.precision)
        : store.currentPrecision || 2;

    if (row) {
      if (row.Ticker) store.precisionMap.set(row.Ticker.toUpperCase(), p);
      if (row.DisplayTicker)
        store.precisionMap.set(row.DisplayTicker.toUpperCase(), p);
      if (row.Symbol) store.precisionMap.set(row.Symbol.toUpperCase(), p);
    } else {
      store.precisionMap.set(key, p);
    }

    store.currentPrecision = p;
    return p;
  },
};

export const CONFIG = {
  SCREEN_WIDTH: 768,
  UI_UPDATE_INTERVAL: 1000,
  RENDER_CHUNK: 50,
  CHART_CONFIG: { GHOST_COUNT: 500, VISIBLE_COUNT: 200, RIGHT_PADDING: 10 },
  FONT_SCALE: {
    PRICE_THRESHOLD: 8,
    PRICE_MIN_SIZE: 8,
    PRICE_BASE_SIZE: 14,
    PRICE_REDUCE_STEP: 0.8,
    ASSET_THRESHOLD: 10,
    ASSET_MIN_REM: 0.65,
    ASSET_BASE_REM: 1.125,
    ASSET_LOG_MULT: 0.6,
    VOL_THRESHOLD: 8,
    VOL_MIN_SIZE: 8,
    VOL_BASE_SIZE: 11,
    VOL_REDUCE_STEP: 0.4,
    MCAP_THRESHOLD: 8,
    MCAP_MIN_SIZE: 7.5,
    MCAP_BASE_SIZE: 10,
    MCAP_REDUCE_STEP: 0.4,
    VMC_THRESHOLD: 5,
    VMC_MIN_SIZE: 7.5,
    VMC_BASE_SIZE: 10,
    VMC_REDUCE_STEP: 0.4,
  },
};

export const tfSec = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "6h": 21600,
  "8h": 28800,
  "12h": 43200,
  "1d": 86400,
  "3d": 259200,
  "1w": 604800,
  "1M": 2592000,
  "1y": 31104000,
};

export const measureDOM = {
  box: document.createElement("div"),
  startLabel: document.createElement("div"),
  endLabel: document.createElement("div"),
  rangeBar: document.createElement("div"),
};

measureDOM.box.style.cssText = `position: absolute; z-index: 50; pointer-events: none; display: none; border: 1px solid; transition: background-color 0.2s, border-color 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; text-align: center; line-height: 1.4;`;
measureDOM.startLabel.style.cssText = `position: absolute; left: 0; width: 100%; box-sizing: border-box; z-index: 98; pointer-events: none; display: none; padding: 2px 6px; font-size: 10px; font-weight: bold; color: white; text-align: center; opacity: 1; white-space: nowrap;`;
measureDOM.endLabel.style.cssText = `position: absolute; left: 0; width: 100%; box-sizing: border-box; z-index: 100; pointer-events: none; display: none; padding: 2px 6px; font-size: 10px; font-weight: bold; color: white; text-align: center; opacity: 1; white-space: nowrap; transition: background-color 0.2s;`;
measureDOM.rangeBar.style.cssText = `position: absolute; left: 0; width: 100%; z-index: 90; pointer-events: none; display: none; transition: background-color 0.2s; background-color: var(--bg-chart, #131722); opacity: 0.3;`;
