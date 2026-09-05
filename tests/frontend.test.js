import { describe, it, expect } from "vitest";

describe("Frontend Unit Tests (5 Types)", () => {
  // 1. 타임존 변환 및 UTC 오프셋 계산 테스트
  it("1. Timezone offset & Timestamp conversion", () => {
    function parseTzOffsetHours(tzString) {
      if (!tzString || tzString === "UTC") return 0;
      const match = tzString.match(/UTC([+-]\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    function convertUtcToLocalEpoch(utcSeconds, tzString) {
      const offsetHours = parseTzOffsetHours(tzString);
      return utcSeconds + offsetHours * 3600;
    }

    // UTC+9 (KST)
    expect(parseTzOffsetHours("UTC+9")).toBe(9);
    expect(convertUtcToLocalEpoch(1700000000, "UTC+9")).toBe(1700000000 + 9 * 3600);

    // UTC-5 (EST)
    expect(parseTzOffsetHours("UTC-5")).toBe(-5);
    expect(convertUtcToLocalEpoch(1700000000, "UTC-5")).toBe(1700000000 - 5 * 3600);

    // Default UTC
    expect(parseTzOffsetHours("UTC")).toBe(0);
    expect(convertUtcToLocalEpoch(1700000000, "UTC")).toBe(1700000000);
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
