// Real Integration Test directly importing workspace's static/chart_fetch.js and static/_store.js!
// 🔒 [외부 API 차단 안전망] globalThis.fetch를 가상 Mock으로 100% 가로채어 실제 거래소/서버 네트워크 통신 0회 보장

globalThis.location = {
    hostname: "localhost",
    pathname: "/",
    hash: "",
    protocol: "http:",
    origin: "http://localhost:8000"
};

globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};
globalThis.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

function createMockElem() {
    const el = {
        style: { setProperty: () => {}, getPropertyValue: () => "" },
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        innerHTML: "",
        appendChild: () => {},
        prepend: () => {},
        insertBefore: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => createMockElem(),
        setAttribute: () => {},
        getAttribute: () => null,
        value: "",
        parentElement: null
    };
    el.parentElement = {
        querySelector: () => el,
        querySelectorAll: () => [],
        appendChild: () => {},
        prepend: () => {},
        insertBefore: () => {}
    };
    return el;
}

globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    location: globalThis.location,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    updateHeaderDisplay: () => {},
    syncPriceScaleWidths: () => {},
    isFetchingChart: false,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage
};
globalThis.document = {
    body: createMockElem(),
    getElementById: (id) => createMockElem(),
    querySelectorAll: () => [],
    querySelector: () => createMockElem(),
    createElement: () => createMockElem(),
    addEventListener: () => {},
    removeEventListener: () => {}
};
globalThis.getComputedStyle = () => ({
    getPropertyValue: () => "#26a69a"
});
globalThis.requestAnimationFrame = (cb) => {
    setImmediate(cb);
};

// 🔒 [원천 차단] 외부 네트워크 요청을 메모리 가상 응답으로 100% 가로챔 (API 통신 0회)
globalThis.fetch = async (url) => {
    const urlStr = String(url).toUpperCase();
    console.log(`  🌐 [Mock Fetch Intercepted] URL: ${urlStr}`);
    if (urlStr.includes("DOGE")) {
        // DOGE (0.1$) 가상 응답 지연 80ms
        await new Promise(r => setTimeout(r, 80));
        return {
            ok: true,
            status: 200,
            json: async () => [
                [1000000, "0.1", "0.105", "0.098", "0.1", "1000", 1000000, "100", 1, "0", "0", "0"]
            ],
            text: async () => ""
        };
    } else if (urlStr.includes("AAVE")) {
        // AAVE (100$) 가상 응답 지연 25ms
        await new Promise(r => setTimeout(r, 25));
        return {
            ok: true,
            status: 200,
            json: async () => [
                [1000000, "100.0", "102.0", "99.0", "100.0", "500", 1000000, "50000", 1, "0", "0", "0"]
            ],
            text: async () => ""
        };
    }
    return { ok: true, status: 200, json: async () => [], text: async () => "" };
};

async function testRealCode() {
    const { store } = await import("../static/_store.js");
    const { fetchHistory } = await import("../static/chart_fetch.js");

    let chartSeriesLog = [];
    store.candleSeries = {
        setData: (data) => {
            console.log(`  🎯 [store.candleSeries.setData 호출됨!] 종가: ${data[data.length - 1]?.close}$`);
            chartSeriesLog.push({
                time: Date.now(),
                dataLength: data.length,
                firstClose: data[0]?.close,
                lastClose: data[data.length - 1]?.close
            });
        },
        applyOptions: () => {},
        setMarkers: () => {},
        createPriceLine: () => ({ applyOptions: () => {} }),
        removePriceLine: () => {}
    };

    console.log("========================================================================");
    console.log("🔥 [실제 static/chart_fetch.js 및 static/_store.js 직접 import 실행 검증]");
    console.log("🔒 외부 API 요청 차단 여부: 100% Mock Intercept (실제 API 호출 0회)");
    console.log("========================================================================");

    // 1. User clicks DOGE -> fetchHistory("DOGE") called (takes 80ms)
    console.log("1. fetchHistory('DOGE') 실제 프로젝트 함수 호출 (가상 지연 80ms)...");
    const p1 = fetchHistory("DOGE", false, false, false, "UID_DOGE");

    // 2. User clicks AAVE after 15ms -> fetchHistory("AAVE") called (takes 25ms, finishes at t=40ms)
    await new Promise(r => setTimeout(r, 15));
    console.log("2. 15ms 후 fetchHistory('AAVE') 실제 프로젝트 함수 호출 (가상 지연 25ms)...");
    const p2 = fetchHistory("AAVE", false, false, false, "UID_AAVE");

    // Wait for both real fetchHistory calls to finish
    await Promise.all([p1, p2]);
    await new Promise(r => setTimeout(r, 200));

    console.log("\n📊 [실제 store.candleSeries.setData() 호출 요약]");
    chartSeriesLog.forEach((entry, idx) => {
        console.log(`  [SetData #${idx + 1}] 차트에 주입된 캔들 종가: ${entry.lastClose}$ (데이터 수: ${entry.dataLength})`);
    });

    const finalLoadedPrice = chartSeriesLog[chartSeriesLog.length - 1]?.lastClose;
    console.log(`\n• 최종 차트 화면에 남은 캔들 가격 : ${finalLoadedPrice}$`);
    console.log(`• 사용자가 마지막으로 선택한 코인  : ${store.currentAsset}`);

    if (finalLoadedPrice === 0.1) {
        console.log("\n🚨 [실제 파일 검증 결과: 침범 참사 100% 재현 확인!]");
        console.log("  뒤늦게 응답이 도착한 0.1$ DOGE의 fetchHistory가 100$ AAVE 차트 데이터를 덮어써서 파괴했습니다.");
    } else {
        console.log("\n✅ 정상 방어됨");
    }
    console.log("========================================================================\n");
    process.exit(0);
}

testRealCode().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
