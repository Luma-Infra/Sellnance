import { describe, it, expect, beforeEach } from "vitest";
import { TIMEZONE_LIST } from "../static/chart_timezone.js";
import { ensureSafeUnixSeconds, getUnixSeconds } from "../static/chart_utils.js";
import { isValidPriceRatio, isTimeValid } from "../static/stream_utils.js";
import { resampleSubCandles } from "../static/chart_data_kimchi.js";
import { CONFIG, tfSec } from "../static/_store.js";
import { isFuturesCoin, getRowExchangeMeta, isExchangeNativeTF } from "../static/_market_rules.js";
import { addRecentSearch, getRecentSearches, removeRecentSearch, clearAllRecentSearches } from "../static/ui_search.js";
import { getVisibleTfs, saveVisibleTfs } from "../static/ui_timeframe.js";
import { isStockCoin } from "../static/table_filter.js";

describe("Frontend Core Modules Direct Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. 타임존 목록 및 변환 엔진 실제 모듈 검증
  it("1. Real TIMEZONE_LIST & Unix Seconds Conversion", () => {
    expect(TIMEZONE_LIST.length).toBeGreaterThan(20);
    const kstTz = TIMEZONE_LIST.find((t) => t.id === "UTC+9");
    expect(kstTz).toBeDefined();
    expect(kstTz.offset).toBe(540); // 9시간 * 60분 = 540분

    // 유닉스 초 변환 정밀도 테스트 (Object, String, Number)
    expect(getUnixSeconds({ year: 2024, month: 1, day: 1 })).toBe(1704067200);
    expect(getUnixSeconds("2024-01-01")).toBe(1704067200);
    expect(getUnixSeconds(1700000000)).toBe(1700000000);
    expect(ensureSafeUnixSeconds(1700000000)).toBe(1700000000);
    expect(ensureSafeUnixSeconds(null)).toBe(0);
  });

  // 2. 김프 이상치 필터 (isValidPriceRatio) & 서브캔들 합성 (resampleSubCandles) 검증
  it("2. Real isValidPriceRatio & resampleSubCandles", () => {
    // 정상 가격 비율 (오차 10% 내외)
    expect(isValidPriceRatio(100_000, 100_000)).toBe(true);
    expect(isValidPriceRatio(105_000, 100_000)).toBe(true);
    expect(isValidPriceRatio(95_000, 100_000)).toBe(true);

    // 극단적 이상치 방어 (99% 폭락 또는 10배 폭등)
    expect(isValidPriceRatio(100, 100_000)).toBe(false); // 0.001
    expect(isValidPriceRatio(100_000_000, 100_000)).toBe(false); // 1000배

    // 시간 포맷 유효성 검증
    expect(isTimeValid(1700000000)).toBe(true);
    expect(isTimeValid("2024-01-01")).toBe(true);
    expect(isTimeValid(null)).toBe(false);

    // 12h 서브캔들 리샘플링 검증
    const rawCandles = [
      { time: 1700000000, open: 100, high: 110, low: 95, close: 105, vol: 10 },
      { time: 1700003600, open: 105, high: 115, low: 100, close: 112, vol: 15 },
    ];
    const resampled = resampleSubCandles(rawCandles, "12h", "binance");
    expect(resampled.length).toBe(1);
    expect(resampled[0].high).toBe(115);
    expect(resampled[0].volume).toBe(25);
  });

  // 3. 전역 CONFIG 및 타임프레임 초단위 매핑 검증
  it("3. Real CONFIG & tfSec Precision Mapping", () => {
    expect(CONFIG.CHART_CONFIG.MIN_SPAN).toBe(10);
    expect(CONFIG.CHART_CONFIG.MAX_SPAN_LIMIT).toBeGreaterThanOrEqual(800);
    expect(tfSec["1m"]).toBe(60);
    expect(tfSec["1h"]).toBe(3600);
    expect(tfSec["1d"]).toBe(86400);
  });

  // 4. 최근 검색어(Recent Searches) 실제 모듈(ui_search.js) 검증
  it("4. Real Recent Searches Module (ui_search.js)", () => {
    expect(getRecentSearches()).toEqual([]);

    addRecentSearch("BTC");
    addRecentSearch("ETH");
    addRecentSearch("SOL");

    const list = getRecentSearches();
    expect(list).toEqual(["SOL", "ETH", "BTC"]); // 최신순 정렬

    // 중복 추가 시 최상단 이동
    addRecentSearch("ETH");
    expect(getRecentSearches()).toEqual(["ETH", "SOL", "BTC"]);

    // 단일 검색어 삭제
    removeRecentSearch("SOL");
    expect(getRecentSearches()).toEqual(["ETH", "BTC"]);

    // 전체 삭제
    clearAllRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });

  // 5. 마켓 룰 및 거래소 메타 실제 모듈(_market_rules.js) 검증
  it("5. Real Market Rules & Exchange Meta (_market_rules.js)", () => {
    // 선물 코인 검증 (바이낸스 선물 기준)
    expect(isFuturesCoin({ Binance_Futures: "O" })).toBe(true);
    expect(isFuturesCoin({ Listed_Exchanges: ["BINANCE_FUTURES"] })).toBe(true);
    expect(isFuturesCoin({ Bybit_Futures: "O" })).toBe(false); // 바이빗 선물 단독은 .P 미부여
    expect(isFuturesCoin({ Binance_Futures: "X", Bybit_Futures: "X", Upbit: "O" })).toBe(false);

    // 거래소 지원 타임프레임(Native TF) 판별
    expect(isExchangeNativeTF("binance", "1m")).toBe(true);
    expect(isExchangeNativeTF("upbit", "12h")).toBe(false); // 업비트는 12h 미지원 -> 리샘플링 필요

    // 거래소 메타 계산
    const meta = getRowExchangeMeta({
      Upbit: "O",
      Bithumb: "O",
      Binance: "O",
      Bybit: "X",
      Upbit_price: 100000,
      Binance_price: 70,
    });
    expect(meta.hasUpbit).toBe(true);
    expect(meta.hasBinanceSpot).toBe(true);
    expect(meta.hasBybitSpot).toBe(false);
    expect(meta.isSpot).toBe(true);
  });

  // 6. 타임프레임 가시성 설정 실제 모듈(ui_timeframe.js) 검증
  it("6. Real Timeframe Persistence (ui_timeframe.js)", () => {
    const defaultTfs = getVisibleTfs();
    expect(defaultTfs.length).toBeGreaterThanOrEqual(4);

    saveVisibleTfs(["1m", "5m", "1h", "1d"]);
    expect(getVisibleTfs()).toEqual(["1m", "5m", "1h", "1d"]);
  });

  // 7. 주식/지수 코인 및 해외 자산 판정 실제 모듈(table_filter.js) 검증
  it("7. Real Stock/Commodity Coin Filter (table_filter.js)", () => {
    expect(isStockCoin({ Name: "Tesla Stock Token" })).toBe(true);
    expect(isStockCoin({ Is_Stock: true })).toBe(true);
    expect(isStockCoin({ Name: "Rootstock Smart Bitcoin" })).toBe(false); // Rootstock 예외 필터링
    expect(isStockCoin({ Name: "Bitcoin", Symbol: "BTC" })).toBe(false);
  });

  // 8. 스팟 전용 코인(TFUEL 등) USD/KRW 대표가 및 김프 단가 검증
  it("8. Spot Coin (TFUEL) USD/KRW Metrics & Kimchi Calculation", async () => {
    const { getRowDisplayMetrics, getRowKimchiGlobalPrice } = await import("../static/_market_rules.js");
    const tfuelRow = {
      UID: "3822",
      Symbol: "TFUEL",
      Ticker: "TFUELUSDT",
      Upbit: "O",
      Upbit_Price: 17.0,
      Price_KRW: 17.0,
      Binance: "O",
      Binance_Futures: "X",
      Binance_Price_Spot: 0.01256,
      Price_Raw: 0.01256,
      Change_Today_Spot: 38.63,
      Change_Today_Upbit: 37.09,
    };

    // USD 모드에서 선물 없는 코인은 업비트(환산가) 우선 선택 검증
    const usdMetrics = getRowDisplayMetrics(tfuelRow, false, 1340.78);
    expect(usdMetrics.activeExchange).toBe("upbit");
    expect(usdMetrics.displayPrice).toBeCloseTo(17.0 / 1340.78, 5);
    expect(usdMetrics.nDay).toBe(37.09);

    // KRW 모드에서 업비트 원화가 우선 선택 검증
    const krwMetrics = getRowDisplayMetrics(tfuelRow, true, 1340.78);
    expect(krwMetrics.activeExchange).toBe("upbit");
    expect(krwMetrics.displayPrice).toBe(17.0);
    expect(krwMetrics.nDay).toBe(37.09);

    // 김프 해외 단가 연산 검증 (바이낸스 현물가 정상 추출)
    const { rawGlb } = getRowKimchiGlobalPrice(tfuelRow);
    expect(rawGlb).toBe(0.01256);
  });

  // 9. 알파 코인 24h / 당일 시가 정렬 시 후순위 격리 및 B-ALPHA 필터 활성 시 정상 정렬 검증
  it("9. Alpha Coin Ranking Suppression during 24h/Today Sort", async () => {
    const { simpleSortData } = await import("../static/table_sort.js");
    const { store } = await import("../static/_store.js");

    const mockData = [
      {
        Symbol: "ALPHA1",
        DisplayTicker: "APM",
        Change_24h_Raw: 500.0, // 극단적 펌핑 알파 코인
        Price_Raw: 1.0,
        Binance_Alpha: "O",
        Binance_Futures: "X",
        is_futures: false,
      },
      {
        Symbol: "BTC",
        DisplayTicker: "BTC",
        Change_24h_Raw: 5.2, // 일반 메이저 코인
        Price_Raw: 86000,
        Binance_Futures: "O",
        is_futures: true,
      },
      {
        Symbol: "ETH",
        DisplayTicker: "ETH",
        Change_24h_Raw: 3.1, // 일반 메이저 코인
        Price_Raw: 3000,
        Binance_Futures: "O",
        is_futures: true,
      },
    ];

    // [케이스 1]: 전체 마켓 (ALL) 상태에서 24h 내림차순 정렬 시
    // 알파 코인이 +500%라도 상위권을 도배하지 않고 일반 코인(BTC 5.2% -> ETH 3.1%) 뒤로 후순위 배치되어야 함
    store.currentTableData = [...mockData];
    store.currentSortCol = "Change_24h";
    store.sortState = "desc";
    store.exchFilterStates = {};

    simpleSortData();

    expect(store.currentTableData[0].DisplayTicker).toBe("BTC");
    expect(store.currentTableData[1].DisplayTicker).toBe("ETH");
    expect(store.currentTableData[2].DisplayTicker).toBe("APM"); // 알파 코인이 후순위로 이동

    // [케이스 2]: 상단 거래소 필터에서 B-ALPHA 활성화(상태 2) 시
    // 알파 코인 보기 목적이므로 변동률 순위대로 정상 1위에 랭크되어야 함
    store.currentTableData = [...mockData];
    store.exchFilterStates = { BINANCE_SPOT: 2 };

    simpleSortData();

    expect(store.currentTableData[0].DisplayTicker).toBe("APM"); // 알파 코인이 1위
    expect(store.currentTableData[1].DisplayTicker).toBe("BTC");
    expect(store.currentTableData[2].DisplayTicker).toBe("ETH");
  });

  // 10. 업비트/빗썸 원화 차트 가격 정밀도 및 축 포맷팅 검증
  it("10. KRW Price Formatting and Precision for Upbit & Bithumb", async () => {
    const { getKrwPrecision, formatCrosshairPrice, formatSmartPrice } = await import("../static/chart_utils.js");
    const { store } = await import("../static/_store.js");

    // 100원 이상 코인은 무조건 정수 (소수점 0자리)
    expect(getKrwPrecision(120_000_000, "upbit")).toBe(0);
    expect(getKrwPrecision(3_500, "upbit")).toBe(0);
    expect(getKrwPrecision(120_000_000, "bithumb")).toBe(0);
    expect(getKrwPrecision(3_500, "bithumb")).toBe(0);

    // 10~100원 코인은 업비트 소수점 1자리(0.1원 호가), 빗썸 소수점 2자리
    expect(getKrwPrecision(45.67, "upbit")).toBe(1);
    expect(getKrwPrecision(45.67, "bithumb")).toBe(2);

    // 1~10원 코인은 소수점 3자리
    expect(getKrwPrecision(3.456, "bithumb")).toBe(3);

    // 1원 미만 코인은 소수점 4자리
    expect(getKrwPrecision(0.1234, "bithumb")).toBe(4);

    // formatSmartPrice 원화 모드 동작 검증
    expect(formatSmartPrice(120_000_000, 2, true)).toBe("120,000,000"); // 달러 precision 2가 넘어와도 원화는 정수!
    expect(formatSmartPrice(3_500, 4, true)).toBe("3,500");

    // formatCrosshairPrice에서 UPBIT/BITHUMB 활성 시 원화 포맷 자동 적용 검증
    store.currentChartMarket = "UPBIT";
    expect(formatCrosshairPrice(120_000_000, 2, false)).toBe("120,000,000");

    store.currentChartMarket = "BITHUMB";
    expect(formatCrosshairPrice(3_500, 2, false)).toBe("3,500");

    // 달러 마켓(FUTURES)일 때는 달러 규칙(소수점 2자리) 정상 유지 검증
    store.currentChartMarket = "FUTURES";
    expect(formatCrosshairPrice(86000, 2, false)).toBe("86,000.00");
  });

  // 11. 양방향 실시간 김프 갱신 검증 (리버스 락킹 해제)
  it("11. Bidirectional Real-time Kimchi Calculation (Reverse-Locking Removed)", async () => {
    const { updateRealtimeKimchi } = await import("../static/stream_korea.js");
    const { store } = await import("../static/_store.js");

    store.kimchiSeries = { update: () => {} };
    store.paneConfig = { volume: true, kimchi: true };
    store.isKimchiDisabled = false;
    store.blockKimchi = false;
    store.marketDataMap = { krw_usd_rate: 1400 };

    // 테스트용 코인 데이터 주입
    const mockRow = {
      Symbol: "BTC",
      Ticker: "BTCKRW",
      Upbit_Symbol: "BTC",
      Exact_Spot: "BTC",
      Upbit_Price: 140_000_000,
      Binance_Price_Spot: 98_000,
      Listed_Exchanges: ["UPBIT", "BINANCE"],
    };
    store.tickerRowMap = new Map([["BTC", mockRow]]);
    store.tickerBuffer = {
      "KRW-BTC": { c: 140_000_000 },
      BTCUSDT: { c: 98_000 },
    };

    // [상황 1]: 현재 차트가 업비트(UPBIT)일 때, 업비트 실시간 체결 틱이 들어온 경우
    // 과거에는 리버스 락킹으로 인해 return되어 김프가 갱신되지 않았으나, 이제 즉시 연산되어야 함
    store.currentChartMarket = "UPBIT";
    store.preferredKimchiSub = "binance_spot";
    store.realtimeKimchi = null;

    updateRealtimeKimchi(
      { close: 141_000_000, marketType: "UPBIT" },
      "KRW-BTC",
      1700000000,
    );

    // 141,000,000 / (98,000 * 1400) = 141,000,000 / 137,200,000 = ~1.02769 (+2.77%)
    expect(store.realtimeKimchi).not.toBeNull();
    expect(store.realtimeKimchi.value).toBeCloseTo(2.77, 1);
    expect(store.realtimeKimchi.time).toBe(1700000000);

    // [상황 2]: 현재 차트가 업비트(UPBIT)일 때, 해외(SPOT) 실시간 체결 틱이 들어온 경우
    updateRealtimeKimchi(
      { close: 100_000, marketType: "SPOT" },
      "BTCUSDT",
      1700000005,
    );

    // 141,000,000 / (100,000 * 1400) = 141,000,000 / 140,000,000 = 1.00714 (+0.71%)
    expect(store.realtimeKimchi.value).toBeCloseTo(0.71, 1);
    expect(store.realtimeKimchi.time).toBe(1700000005);
  });
});

