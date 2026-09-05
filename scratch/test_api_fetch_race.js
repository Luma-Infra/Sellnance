// Unit Test: HTTP API Fetch Race Condition (Out-of-order response)
// Testing if an earlier, slower HTTP response overwrites a newer, faster response.
// (100% Mock, 0 External Network Requests)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class MockChartStore {
    constructor() {
        this.currentAsset = null;
        this.currentSelectedUid = null;
        this.isFetchingChart = false;
        this.mainData = [];
        this.renderedSeriesData = [];
    }

    setSeriesData(data) {
        this.renderedSeriesData = [...data];
    }
}

// Simulated fetchHistory WITHOUT Fetch Guard (Current chart_fetch.js structure)
async function fetchHistory_CurrentCode(store, symbol, latencyMs, candles) {
    store.currentAsset = symbol;
    store.isFetchingChart = true;

    // Simulated async HTTP API network delay
    await sleep(latencyMs);

    // Current chart_fetch.js logic (No snapshotAsset or fetchId check!)
    store.mainData = [...candles];
    store.setSeriesData(store.mainData);
    store.isFetchingChart = false;
}

// Simulated fetchHistory WITH Fetch Guard (Protected structure)
let globalFetchSeq = 0;
async function fetchHistory_ProtectedCode(store, symbol, latencyMs, candles) {
    const currentFetchId = ++globalFetchSeq;
    const snapshotAsset = symbol;
    store.currentAsset = symbol;
    store.isFetchingChart = true;

    // Simulated async HTTP API network delay
    await sleep(latencyMs);

    // 🛡️ [Fetch Guard] 만약 요청 완료 시점에 더 최신의 fetch가 시작되었거나 심볼이 바뀌었으면 폐기(Drop)!
    if (currentFetchId !== globalFetchSeq || store.currentAsset !== snapshotAsset) {
        return; // DROPPED!
    }

    store.mainData = [...candles];
    store.setSeriesData(store.mainData);
    store.isFetchingChart = false;
}

async function runUnitTest() {
    console.log("========================================================================");
    console.log("🧪 [단위 테스트] HTTP API 캔들스틱 도착 순서 역전(Out-of-order) 침범 테스트");
    console.log("========================================================================");

    // 1. Current Code Test
    console.log("\n[TEST 1] 현재 chart_fetch.js 구조 테스트:");
    console.log("  1) 0.1$ 코인(DOGE) 클릭 -> API 요청 (지연시간 100ms)");
    console.log("  2) 100$ 코인(AAVE) 20ms 후 빠르게 클릭 -> API 요청 (지연시간 30ms)");
    
    const storeCurrent = new MockChartStore();
    const dogeCandles = [{ time: 1000, close: 0.1 }];
    const aaveCandles = [{ time: 1000, close: 100.0 }];

    // Request 1: DOGE (100ms)
    const p1 = fetchHistory_CurrentCode(storeCurrent, "DOGE", 100, dogeCandles);
    
    // User clicks AAVE after 20ms
    await sleep(20);
    // Request 2: AAVE (30ms latency -> finishes at t=50ms)
    const p2 = fetchHistory_CurrentCode(storeCurrent, "AAVE", 30, aaveCandles);

    await Promise.all([p1, p2]);

    const currentRenderedPrice = storeCurrent.renderedSeriesData[0]?.close;
    const currentTargetAsset = storeCurrent.currentAsset;

    console.log(`  • 사용자 선택 코인 : ${currentTargetAsset} (기대 가격: 100$)`);
    console.log(`  • 실제 차트에 그려진 종가 : ${currentRenderedPrice}$`);
    if (currentRenderedPrice === 0.1) {
        console.log("  🚨 [침범 참사 발생!] 느린 0.1$ API 응답이 빠른 100$ 차트를 덮어씌움 (FAIL)");
    } else {
        console.log("  ✅ 정상 렌더링 (PASS)");
    }

    // 2. Protected Code Test
    console.log("\n------------------------------------------------------------------------");
    console.log("[TEST 2] Fetch Guard(fetchId / snapshotAsset 검증) 적용 후 테스트:");
    
    const storeProtected = new MockChartStore();
    globalFetchSeq = 0;

    const p3 = fetchHistory_ProtectedCode(storeProtected, "DOGE", 100, dogeCandles);
    await sleep(20);
    const p4 = fetchHistory_ProtectedCode(storeProtected, "AAVE", 30, aaveCandles);

    await Promise.all([p3, p4]);

    const protectedRenderedPrice = storeProtected.renderedSeriesData[0]?.close;
    const protectedTargetAsset = storeProtected.currentAsset;

    console.log(`  • 사용자 선택 코인 : ${protectedTargetAsset} (기대 가격: 100$)`);
    console.log(`  • 실제 차트에 그려진 종가 : ${protectedRenderedPrice}$`);
    if (protectedRenderedPrice === 100.0) {
        console.log("  🛡️ [완벽 방어 성공!] 뒤늦게 도착한 0.1$ 응답을 폐기하고 100$ 차트 유지 (PASS)");
    } else {
        console.log("  🚨 오염 발생 (FAIL)");
    }
    console.log("========================================================================\n");
}

runUnitTest();
