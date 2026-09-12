// stream_render.js
import { store } from "./_store.js";
import { getUnixSeconds, rebuildVolumeDataMap, getPureBase } from "./chart_utils.js";
import { isChartBusy, isMatchingCurrentSymbol, isValidPriceRatio } from "./stream_utils.js";

// 🚀 [1프레임 Coalescing 락] 초당 수백 개 틱이 쏟아져도 화면 주사율(16.6ms)에 맞춰 1회만 캔버스 렌더링
let pendingUpdate = null;
let renderTickRaf = null;

export function flushRealtimeRender() {
    if (renderTickRaf) {
        cancelAnimationFrame(renderTickRaf);
        renderTickRaf = null;
    }
    if (!pendingUpdate) return;
    const { normalizedTime, currentCandle } = pendingUpdate;
    pendingUpdate = null;

    if (!store.candleSeries || !currentCandle || normalizedTime === null) return;

    // 1️⃣ 메인 봉 차트 & 좌측 스케일 보조 라인 업데이트
    try {
        store.candleSeries.update({
            time: normalizedTime,
            open: Number(currentCandle.open),
            high: Number(currentCandle.high),
            low: Number(currentCandle.low),
            close: Number(currentCandle.close),
            volume: Number(currentCandle.volume) || 0,
        });

        if (store.leftScaleSeries) {
            store.leftScaleSeries.update({
                time: normalizedTime,
                value: Number(currentCandle.close),
            });
        }

        // 🚀 카운트다운 타이머 바 0ms 실시간 동기화
        if (store.showCountdown && typeof window.updateRealtimeCountdown === "function") {
            window.updateRealtimeCountdown(Date.now(), Number(currentCandle.close));
        }
    } catch (candleUpdateErr) {
        // Xconsole.warn("🚨 candleSeries.update 예외 우회 완료:", candleUpdateErr);
    }

    // 2️⃣ 하단 거래량(Volume) 히스토그램 업데이트
    if (store.volumeSeries && currentCandle.volume !== undefined && currentCandle.volume !== null) {
        if (!store.upColorCache || !store.downColorCache) {
            const curStyle = getComputedStyle(document.body);
            store.upColorCache = curStyle.getPropertyValue("--up").trim() || "#26a69a";
            store.downColorCache = curStyle.getPropertyValue("--down").trim() || "#ef5350";
        }
        const curUpVol = store.upColorCache + "80";
        const curDownVol = store.downColorCache + "80";
        const curVolColor = currentCandle.close >= currentCandle.open ? curUpVol : curDownVol;

        let safeVolume = Number(currentCandle.volume);
        if (isNaN(safeVolume) || safeVolume === null) {
            safeVolume = 0;
        }

        const volObj = {
            time: normalizedTime,
            value: safeVolume,
            color: curVolColor,
        };

        try {
            const volData = store.volumeData;
            if (volData && volData.length > 0) {
                const lastVolItem = volData[volData.length - 1];
                const normSec = getUnixSeconds(normalizedTime);
                const lastSec = lastVolItem ? getUnixSeconds(lastVolItem.time) : -1;

                if (normSec >= lastSec) {
                    // [타입 정합성] 기존 볼륨 배열의 time 형식(문자열 vs 숫자)과 일치시켜 Lightweight Charts 예외 차단
                    if (typeof lastVolItem.time === "string" && typeof normalizedTime === "number") {
                        volObj.time = String(lastVolItem.time);
                    } else if (typeof lastVolItem.time === "number" && typeof normalizedTime === "string") {
                        volObj.time = getUnixSeconds(normalizedTime);
                    }

                    store.volumeSeries.update(volObj);
                    if (normSec > lastSec) {
                        volData.push(volObj);
                    } else if (normSec === lastSec) {
                        volData[volData.length - 1] = volObj;
                    }
                    store.volumeDataMap.set(normSec, volObj);
                }
            }
        } catch (e) {
            // 🛡️ 틱 단위 예외 발생 시에도 차트를 0개로 날리는 깜빡임 없이 다음 프레임에서 자연스럽게 갱신
            // Xconsole.debug("volumeSeries.update bypass:", e);
        }
    }
}

/**
 * 정제된 틱 데이터를 받아 메인 캔들과 거래량 시리즈에 안전하게 실시간 업데이트를 주입
 */
export function renderRealtimeUpdate(normalizedTime, currentCandle, tickSymbol) {
    // 🚀 [공허 그레이존 방어] 차트 로딩/패칭 중에는 모든 소켓 틱의 캔들 렌더링을 100% 즉시 차단
    if (isChartBusy()) return;

    // 🛡️ [Symbol Guard] 렌더 직전 현재 활성 코인(store.currentAsset)과 틱 심볼 엄격 검증
    const symbolToCheck = tickSymbol || currentCandle?.symbol;
    if (symbolToCheck && !isMatchingCurrentSymbol(symbolToCheck)) {
        return;
    }

    if (store.blockChartDom) {
        const nowTime = Date.now();
        if (!window._lastChartRenderTime) window._lastChartRenderTime = 0;
        if (nowTime - window._lastChartRenderTime < 500) {
            return;
        }
        window._lastChartRenderTime = nowTime;
    }
    if (!store.candleSeries || !currentCandle || normalizedTime === null) return;

    // 🚀 [프론트엔드 강제 필터링] 현재 탭과 들어온 스트림 데이터의 마켓 형식이 일치하지 않으면 렌더링 즉시 차단!
    const normCurMarket = (store.currentChartMarket === "BINANCE_FUTURES" ? "FUTURES" : store.currentChartMarket === "BINANCE" ? "SPOT" : store.currentChartMarket === "BYBIT_SPOT" ? "BYBIT" : store.currentChartMarket);
    const normCandleMarket = (currentCandle.marketType === "BINANCE_FUTURES" ? "FUTURES" : currentCandle.marketType === "BINANCE" ? "SPOT" : currentCandle.marketType === "BYBIT_SPOT" ? "BYBIT" : currentCandle.marketType);
    if (normCurMarket !== normCandleMarket) {
        return;
    }

    // [방어 코드] 차트 데이터 페칭/교체 중이거나 캔들 데이터가 완전히 비어 있는 상태인 경우 실시간 업데이트 차단
    if (store.isFetchingChart || window.isFetchingChart) {
        return;
    }
    const chartData = store.mainData || [];
    if (chartData.length === 0) {
        return;
    }

    // 🚀 [방어 코드] 실시간 캔들의 타임스탬프가 차트의 마지막 캔들보다 이전(과거)이면 업데이트를 스킵하여 시간 역행 예외 방지
    const lastItem = chartData[chartData.length - 1];
    if (lastItem) {
        const lastTimeVal = getUnixSeconds(lastItem.time);
        const newTimeVal = getUnixSeconds(normalizedTime);
        if (newTimeVal < lastTimeVal) {
            return;
        }

        // 🛡️ [가격 이상치/코인 교차 오염 안전망 (Sanity Guard)]
        if (!isValidPriceRatio(Number(currentCandle.close), Number(lastItem.close))) {
            return;
        }
    }

    // 🚀 [초고속 1프레임 큐잉] 최신 틱 데이터를 메모리에 담고 다음 렌더링 프레임에 1회 실행
    pendingUpdate = { normalizedTime, currentCandle };
    if (!renderTickRaf) {
        renderTickRaf = requestAnimationFrame(flushRealtimeRender);
    }
}

// 볼륨 업데이트 실패 시 원본 배열 내부 오염물질(null/NaN)을 제거하고 차트 초기화 복구
function restoreVolumeDataSterilized() {
    if (store.volumeSeries && store.volumeData && store.volumeData.length > 0) {
        try {
            // 기존 volumeData에 null이나 유실된 값이 없는지 맵 돌리며 완전 박멸
            const sterileVolumeData = store.volumeData.map((d) => {
                const safeValue = (d.value === null || d.value === undefined || isNaN(d.value))
                    ? 0
                    : Number(d.value);

                return {
                    time: d.time,
                    value: safeValue,
                    color: d.color
                };
            });

            // 메모리 원본 소독: 전역 스토어 배열 자체를 깨끗한 놈으로 갈아끼웁니다.
            store.volumeData = sterileVolumeData;
            rebuildVolumeDataMap();

            if (typeof window.sanitizeChartData === "function") {
                store.volumeSeries.setData(window.sanitizeChartData(sterileVolumeData, true));
            } else {
                store.volumeSeries.setData(sterileVolumeData);
            }
        } catch (rebindErr) {
            console.error("🚨 볼륨 데이터 최종 재바인딩 실패:", rebindErr);
        }
    }
}

if (typeof window !== "undefined") {
    window.flushRealtimeRender = flushRealtimeRender;
}