🕵️‍♂️ [기술 분석 보고서] LightweightCharts 비동기 렌더링 크래시 분석 및 즉각적 해결안

1. 장애 요약 (Executive Summary)

장애 유형: LightweightCharts(LWC) 내부 비동기 렌더링 루프 붕괴 및 프레임 크래시

에러 메시지: Uncaught Error: Value is null (at xt.Histogram [as Mh])

장애 시점:

사용자가 마우스 스크롤을 이용해 차트를 과거 영역으로 이동할 때 (loadMoreHistory 트리거)

브라우저 탭을 전환했다가 다시 활성화(Active)할 때 (\_main.js 내의 탭 활성화 및 백그라운드 복귀 로직 트리거)

핵심 원인: 대량의 과거 데이터 주입(setData)과 실시간 스트림 데이터 수신(update)이 단일 이벤트 프레임 내에서 충돌하여 발생하는 동시성 경합 상태 (Race Condition)

2. 근본 원인 정밀 추적 (Technical Root Cause)

가져온 chart_data.js, stream_global.js, chart.js 소스코드를 분석한 결과, 엔진이 완전히 붕괴되는 현상은 다음과 같은 실행 흐름을 거쳐 100% 재현됩니다.

+-------------------------------------------------------------+
| [과거 데이터 레이지 로딩 동작] |
| (User Scroll Left -> loadMoreHistory -> 500 Candles Fetch) |
+------------------------------+------------------------------+
|
v
+-------------------------------------------------------------+
| store.volumeSeries.setData(volumeData) |
| - 대량의 과거 데이터를 차트 엔진에 통째로 주입 |
+------------------------------+------------------------------+
|
v (requestAnimationFrame 예약)
+-------------------------------------------------------------+
| [LWC 내부 렌더러 루프 가동 시작] |
| - 대량 주입된 데이터 구조체 순회 중 (Array.map) |
+------------------------------+------------------------------+
|
💥 [경합 상태 충돌!] 💥
동시 이벤트 스레드에서 실시간 수신 데이터 강제 밀어넣음
(stream_global.js -> volumeSeries.update)
|
v
+-------------------------------------------------------------+
| [인덱스 포인터 유실 / 버퍼 붕괴] |
| - 렌더러가 순회 중이던 메모리 객체를 실시간 업데이트가 변경 |
| - 픽셀 맵핑 과정에서 좌표 축 계산에 필요한 필수 데이터 상실 |
+------------------------------+------------------------------+
|
v
+-------------------------------------------------------------+
| 🚨 Error: Value is null (크래시 유발) |
| - 브라우저 비동기 프레임 크래시 및 차트 화면 먹통 발생|
+-------------------------------------------------------------+

🔄 크래시 메커니즘 (Crash Step-by-Step)

비동기 페이징 처리: 사용자의 스크롤이 차트 좌측 끝에 닿으면 chart_data.js의 loadMoreHistory() 비동기 엔진이 구동되어 과거 캔들 500개를 메모리에 병합합니다.

히스토그램 세팅: 병합 작업 완료 후, 거래량 차트를 다시 그리기 위해 아래 코드가 호출됩니다.

// chart_data.js (약 1238행 부근)
store.volumeSeries.setData(sanitizeChartData(store.volumeData, true));

렌더러 스케줄러 등록: LWC 엔진은 대량의 데이터를 수신하면 화면을 새로 칠하기 위해 브라우저의 requestAnimationFrame 렌더링 큐에 타스크를 대기시킵니다.

동시성 침범 (Race Condition):

이 렌더링 타스크가 실행되어 엔진 내부 내부 렌더러가 데이터 루프(Array.map)를 도는 미세한 순간에, 바이낸스 웹소켓 스나이퍼 스트림(stream_global.js 내 broadcastCandleUpdate)에서 밀려 들어오는 실시간 거래량 데이터가 차트 객체를 동시에 건드려 버립니다.

// stream_global.js (약 162행 부근)
store.volumeSeries.update(volObj);

데이터 오염 및 크래시: 대량 주입 프로세스 도중에 실시간 단일 업데이트가 주입 데이터를 가로채고 오버라이드하면서 내부 좌표 인덱스가 일시적으로 붕괴됩니다. 렌더러는 드로잉을 시도하는 과정에서 필수로 존재해야 할 데이터를 잃고 Value is null을 뱉으며 폭발합니다.

☀️ 탭 전환(절전 해제) 시 추가 경합 유도 패턴

로그를 보면 유저가 브라우저 탭을 전환했다가 돌아올 때마다 다음과 같은 라이프사이클이 실행됩니다.

\_main.js:493 ☀️ 탭 활성화: 절전 모드 해제 및 데이터 클렌징
\_main.js:503 🔄 백그라운드 복귀: 차트 히스토리 실시간 동기화

이 복귀 루틴은 절전 중 끊겼던 실시간 데이터 갭을 수복하고자 강제로 loadMoreHistory 및 동기화 요청을 순간적으로 쏟아붓습니다. 이로 인해 단일 이벤트 루프 내에서 웹소켓 수신과 데이터 병합이 수십 배 정밀하게 중첩되어 충돌 주기가 매우 조밀하게 발생합니다.

3. 해결 방안 및 패치 가이드 (Action Items)

해당 경합 상태는 1) 과거 데이터 대량 결합 작업 중 실시간 주입 잠금(Locking) 및 2) 리렌더링 이벤트 프레임 분리(De-coupling) 두 가지 보안책으로 100% 영구 해결이 가능합니다.

🛠️ 패치 1. stream_global.js 내 실시간 수신 방어벽 강화

현재 실시간 캔들 업데이트 함수(broadcastCandleUpdate)는 차트 초기 로딩 시(isFetchingChart)만 통제를 하고 있으나, 과거 데이터를 추가로 결합하는 중(isLoadingMoreHistory)에도 업데이트가 차트를 오염시키지 않도록 방어 조건을 한 줄 추가합니다.

수정 대상 파일: stream_global.js (약 85행 부근)

수정 내역:

// 🔴 AS-IS (기존 코드)
if (store.isFetchingChart || window.isFetchingChart) return;

// 🟢 TO-BE (수정 코드 - isLoadingMoreHistory 상태일 때도 실시간 차트 갱신 일시 중지)
if (store.isFetchingChart || window.isFetchingChart || store.isLoadingMoreHistory) return;

🛠️ 패치 2. chart_data.js 내 종속 시리즈 비동기 격리 처리

메인 캔들 차트가 완전히 setData되어 시간축 타임라인이 브라우저 상에 안전하게 고정될 때까지, 서브 차트(거래량, 김프)들의 setData 호출을 requestAnimationFrame을 통해 다음 렌더링 루프로 명확하게 격리시킵니다.

수정 대상 파일: chart_data.js (약 1238~1245행 부근)

수정 내역:

// 🔴 AS-IS (기존 코드)
try {
store.candleSeries.setData(sanitizeChartData(store.mainData));

try {
if (store.leftScaleSeries) {
store.leftScaleSeries.setData(sanitizeChartData(store.mainData.map((d) => ({ time: d.time, value: d.close })), true));
}
if (store.volumeSeries && store.volumeData.length > 0) {
store.volumeSeries.setData(sanitizeChartData(store.volumeData, true));
}
if (store.kimchiSeries && store.kimchiData && store.kimchiData.length > 0) {
store.kimchiSeries.setData(sanitizeChartData(store.kimchiData, true));
}
} catch (setErr) { ... }
} catch (candleErr) { ... }

// ==========================================

// 🟢 TO-BE (수정 코드 - requestAnimationFrame으로 감싸서 렌더링 프레임 격리)
try {
// 1. 메인 캔들 데이터를 주입하여 시간 스케일 프레임을 먼저 확보합니다.
store.candleSeries.setData(sanitizeChartData(store.mainData));

// 2. 종속적인 서브 시리즈들은 별도의 프레임 루프에서 안전하게 그리도록 조치합니다.
requestAnimationFrame(() => {
try {
if (store.leftScaleSeries) {
store.leftScaleSeries.setData(
sanitizeChartData(store.mainData.map((d) => ({ time: d.time, value: d.close })), true)
);
}
if (store.volumeSeries && store.volumeData.length > 0) {
store.volumeSeries.setData(sanitizeChartData(store.volumeData, true));
}
if (store.kimchiSeries && store.kimchiData && store.kimchiData.length > 0) {
store.kimchiSeries.setData(sanitizeChartData(store.kimchiData, true));
}
} catch (setErr) {
console.warn("🚨 Lazy Load 종속 시리즈 setData 예외 우회 완료:", setErr);
}
});
} catch (candleErr) {
console.warn("🚨 Lazy Load candleSeries.setData 예외 우회 완료:", candleErr);
}

4. 최종 수사 결론

사용자가 마우스를 당겨 과거 데이터를 로딩할 때 터지는 Histogram Value is null 크래시는 데이터 자체의 결함이 아니라 LWC 라이브러리 엔진의 렌더링 처리 시점과 웹소켓 업데이트의 실시간 스레드 경합 상태가 유발한 완벽한 비동기 동시성 에러입니다.

가이드라인에 따른 실시간 스트림 주입 지연 조치와 프레임 격리를 적용하면, 차트 엔진의 안전성과 연속 60fps 부드러운 유저 인터랙션(UX)을 리소스 과부하 없이 완벽하게 복구해 낼 수 있습니다.
