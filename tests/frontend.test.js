import { describe, it, expect } from "vitest";
import { TIMEZONE_LIST, getSavedTimezoneId } from "../static/chart_timezone.js";
import { ensureSafeUnixSeconds, getUnixSeconds } from "../static/chart_utils.js";
import { isValidPriceRatio } from "../static/stream_utils.js";
import { resampleSubCandles } from "../static/chart_data_kimchi.js";
import { CONFIG, tfSec } from "../static/_store.js";

describe("Frontend Core Modules Direct Tests", () => {
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

  // 2. 검색 및 티커 필터 가중치 정렬 테스트
  it("2. Search & Ticker Filter Ranking", () => {
    const mockCoins = [
      { Symbol: "BTC", Korean_Name: "비트코인", DisplayTicker: "BTC" },
      { Symbol: "BTCDOWN", Korean_Name: "비트코인다운", DisplayTicker: "BTCDOWN" },
      { Symbol: "ETH", Korean_Name: "이더리움", DisplayTicker: "ETH" },
      { Symbol: "BAT", Korean_Name: "베이직어텐션토큰", DisplayTicker: "BAT" },
    ];

    function searchAndRank(query, items) {
      const q = query.trim().toUpperCase();
      if (!q) return items;

      return items
        .filter((item) => {
          const sym = (item.Symbol || "").toUpperCase();
          const name = (item.Korean_Name || "").toUpperCase();
          return sym.includes(q) || name.includes(q);
        })
        .sort((a, b) => {
          const aExact = (a.Symbol || "").toUpperCase() === q ? 2 : 0;
          const bExact = (b.Symbol || "").toUpperCase() === q ? 2 : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aStarts = (a.Symbol || "").toUpperCase().startsWith(q) ? 1 : 0;
          const bStarts = (b.Symbol || "").toUpperCase().startsWith(q) ? 1 : 0;
          return bStarts - aStarts;
        });
    }

    const resBtc = searchAndRank("BTC", mockCoins);
    expect(resBtc.length).toBe(2);
    expect(resBtc[0].Symbol).toBe("BTC"); // Exact match ranks first
    expect(resBtc[1].Symbol).toBe("BTCDOWN");

    const resEth = searchAndRank("이더", mockCoins);
    expect(resEth.length).toBe(1);
    expect(resEth[0].Symbol).toBe("ETH");
  });

  // 3. 거래소 다중 필터 (AND vs OR) 로직 검증
  it("3. Multi-exchange Filter Logic (AND vs OR)", () => {
    const mockRows = [
      { Symbol: "BTC", Upbit: "O", Bithumb: "O", Binance: "O" },
      { Symbol: "ALT1", Upbit: "O", Bithumb: "X", Binance: "X" },
      { Symbol: "ALT2", Upbit: "X", Bithumb: "X", Binance: "O" },
    ];

    function filterByExchanges(rows, activeExchs, mode = "AND") {
      if (activeExchs.length === 0) return rows;

      return rows.filter((row) => {
        if (mode === "AND") {
          return activeExchs.every((exch) => row[exch] === "O");
        } else {
          // OR mode
          return activeExchs.some((exch) => row[exch] === "O");
        }
      });
    }

    // AND 모드: Upbit AND Binance 상장 코인 -> BTC만 해당
    const andResult = filterByExchanges(mockRows, ["Upbit", "Binance"], "AND");
    expect(andResult.length).toBe(1);
    expect(andResult[0].Symbol).toBe("BTC");

    // OR 모드: Upbit OR Binance 상장 코인 -> BTC, ALT1, ALT2 모두 해당
    const orResult = filterByExchanges(mockRows, ["Upbit", "Binance"], "OR");
    expect(orResult.length).toBe(3);
  });

  // 4. 커스텀 필터 슬라이더 범위 및 SessionStorage 상태 복원
  it("4. Custom Filter State Serialization & Bounds", () => {
    const defaultBounds = {
      mcapMin: 0,
      mcapMax: 100_000_000_000,
      volMin: 0,
      volMax: 10_000_000_000,
      volSource: "BINANCE",
      hideSmallCap: false,
    };

    function serializeFilterState(state) {
      return JSON.stringify(state);
    }

    function deserializeFilterState(savedStr, fallback) {
      if (!savedStr) return fallback;
      try {
        const parsed = JSON.parse(savedStr);
        return {
          mcapMin: Math.max(0, parsed.mcapMin ?? fallback.mcapMin),
          mcapMax: Math.min(fallback.mcapMax, parsed.mcapMax ?? fallback.mcapMax),
          volMin: Math.max(0, parsed.volMin ?? fallback.volMin),
          volMax: Math.min(fallback.volMax, parsed.volMax ?? fallback.volMax),
          volSource: parsed.volSource || fallback.volSource,
          hideSmallCap: Boolean(parsed.hideSmallCap),
        };
      } catch {
        return fallback;
      }
    }

    const userSettings = {
      mcapMin: 50_000_000,
      mcapMax: 200_000_000_000, // exceeds max bound
      volMin: 1_000_000,
      volMax: 5_000_000_000,
      volSource: "UPBIT",
      hideSmallCap: true,
    };

    const saved = serializeFilterState(userSettings);
    const restored = deserializeFilterState(saved, defaultBounds);

    expect(restored.mcapMin).toBe(50_000_000);
    expect(restored.mcapMax).toBe(100_000_000_000); // clamped to upper limit
    expect(restored.volSource).toBe("UPBIT");
    expect(restored.hideSmallCap).toBe(true);
  });

  // 5. 패널 스왑 토글 및 레이아웃 상태 검증
  it("5. Panel Swap State Toggle & Layout Orientation", () => {
    let isSwapped = false;

    function togglePanelSwap(currentState) {
      const nextState = !currentState;
      // return layout classes for left and right panel
      return {
        isSwapped: nextState,
        leftPanelOrder: nextState ? "order-2" : "order-1",
        rightPanelOrder: nextState ? "order-1" : "order-2",
      };
    }

    const firstToggle = togglePanelSwap(isSwapped);
    expect(firstToggle.isSwapped).toBe(true);
    expect(firstToggle.leftPanelOrder).toBe("order-2");
    expect(firstToggle.rightPanelOrder).toBe("order-1");

    const secondToggle = togglePanelSwap(firstToggle.isSwapped);
    expect(secondToggle.isSwapped).toBe(false);
    expect(secondToggle.leftPanelOrder).toBe("order-1");
    expect(secondToggle.rightPanelOrder).toBe("order-2");
  });
});
