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
    // 선물 전용 코인 검증
    expect(isFuturesCoin({ Binance_Futures: "O" })).toBe(true);
    expect(isFuturesCoin({ Bybit_Futures: "O" })).toBe(true);
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
});
