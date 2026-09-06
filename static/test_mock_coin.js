// static/test_mock_coin.js
// 🧪 [테스트 전용] Sellnance 가상 코인 모의 데이터 생성 및 주입 전담 모듈

// 💡 [온/오프 스위치] true: Sellnance 테스트 코인 최상단 주입 / false: 0초 컷 즉시 비활성화
export let ENABLE_SELLNANCE_TEST_ROW = false;

if (typeof window !== "undefined") {
  window.ENABLE_SELLNANCE_TEST_ROW = ENABLE_SELLNANCE_TEST_ROW;
  window.toggleSellnanceTestRow = (enable) => {
    ENABLE_SELLNANCE_TEST_ROW = enable !== undefined ? !!enable : !ENABLE_SELLNANCE_TEST_ROW;
    window.ENABLE_SELLNANCE_TEST_ROW = ENABLE_SELLNANCE_TEST_ROW;
    if (typeof window.loadTableData === "function") window.loadTableData(true);
  };
}

export function createSellnanceTestRow(dataList) {
  const btcRow = (dataList || []).find(
    (r) => r.Ticker === "BTCUSDT" || r.Symbol === "BTC" || r.Ticker === "BTC_KRW" || r.Ticker === "BTCKRW"
  );
  const btcPrice = btcRow?.Price || 140000000;
  const btcUpbit = btcRow?.Upbit_Price || 140000000;
  const btcBinanceFut = btcRow?.Binance_Price_Futures || 95000;
  const btcBinanceSpot = btcRow?.Binance_Price_Spot || 95000;

  return {
    UID: 777777,
    Rank: 0,
    Ticker: "SELLNANCE",
    DisplayTicker: "SELLNANCE",
    Symbol: "SELLNANCE",
    Name: "Sellnance",
    Name_KR: "셀낸스",
    Korean_Name: "셀낸스",
    Price: btcPrice,
    Price_Raw: btcPrice,
    Price_KRW: btcUpbit,
    Upbit_Price: btcUpbit,
    Bithumb_Price: btcUpbit,
    Binance_Price_Futures: btcBinanceFut,
    Binance_Price_Spot: btcBinanceSpot,
    Change_24h: 777.77,
    Change_Today: 777.77,
    Change_24h_Raw: 777.77,
    Change_Today_Raw: 777.77,
    Change_24h_Spot: 777.77,
    Change_Today_Spot: 777.77,
    Change_24h_Futures: 777.77,
    Change_Today_Futures: 777.77,
    Change_24h_Upbit: 777.77,
    Change_Today_Upbit: 777.77,
    Binance_Vol_24h: 777770000,
    Upbit_Vol_24h: 777770000,
    Volume_Raw: 777770000,
    Volume_Formatted: "777.77 M",
    Upbit_Vol_Formatted: "777.77 M",
    MarketCap: 777770000000,
    MarketCap_Raw: 777770000000,
    MarketCap_Formatted: "777.77 M",
    Kimchi_Premium: 177.77,
    Kimchi_Raw: 177.77,
    Kimchi_Label: "+177.77%",
    Kimchi_Formatted: "+177.77%",
    Funding_Formatted: "+0.0100%",
    precision: 2,
    Logo: "/static/luma-deer-svg-dark.svg",
    Binance: "O",
    Binance_Futures: "O",
    Upbit: "O",
    Bithumb: "O",
    Bybit: "O",
    Bybit_Futures: "O",
    OKX: "O",
    Bitget: "O",
    Coinbase: "O",
    Gateio: "O",
    Kucoin: "O",
    Listed_Exchanges: [
      "BINANCE", "BINANCE_SPOT", "BINANCE_FUTURES",
      "UPBIT", "BITHUMB",
      "BYBIT", "BYBIT_SPOT", "BYBIT_FUTURES",
      "OKX", "OKX_SPOT", "OKX_FUTURES",
      "BITGET", "BITGET_SPOT", "BITGET_FUTURES",
      "GATEIO", "GATEIO_SPOT", "GATEIO_FUTURES",
      "COINBASE", "COINBASE_SPOT",
      "KUCOIN"
    ],
    Exchanges: [
      "BINANCE_SPOT", "BINANCE_FUTURES",
      "UPBIT", "BITHUMB",
      "BYBIT_SPOT", "BYBIT_FUTURES",
      "OKX_SPOT", "OKX_FUTURES",
      "BITGET_SPOT", "BITGET_FUTURES",
      "GATEIO_SPOT", "GATEIO_FUTURES",
      "COINBASE_SPOT", "COINBASE",
      "KUCOIN"
    ],
    ListingDate: "2030-01-01",
    Warnings: "",
    isFavorite: false,
    _isTestRow: true,
    _chartTargetSymbol: "BTC"
  };
}

export function injectSellnanceTestRow(dataList) {
  if (!ENABLE_SELLNANCE_TEST_ROW || !Array.isArray(dataList)) return dataList;

  const testRow = createSellnanceTestRow(dataList);
  const existingIdx = dataList.findIndex((r) => r.Ticker === "SELLNANCE" || r._isTestRow);
  if (existingIdx !== -1) {
    dataList.splice(existingIdx, 1);
  }
  dataList.unshift(testRow);
  return dataList;
}
