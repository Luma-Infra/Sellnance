// stream_render.js
import { store } from "./_store.js";

/**
 * 정제된 틱 데이터를 받아 메인 캔들과 거래량 시리즈에 안전하게 실시간 업데이트를 주입
 */
export function renderRealtimeUpdate(normalizedTime, currentCandle) {
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
    } catch (candleUpdateErr) {
        console.warn("🚨 candleSeries.update 예외 우회 완료:", candleUpdateErr);
    }

    // 2️⃣ 하단 거래량(Volume) 히스토그램 업데이트 (Value is null 원천 봉쇄 Zone)
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
            const lastVolItem = store.volumeData && store.volumeData.length > 0
                ? store.volumeData[store.volumeData.length - 1]
                : null;

            if (!lastVolItem || normalizedTime >= lastVolItem.time) {
                store.volumeSeries.update(volObj);
                if (store.volumeData && store.volumeData.length > 0) {
                    if (normalizedTime > lastVolItem.time) {
                        store.volumeData.push(volObj);
                    } else if (normalizedTime === lastVolItem.time) {
                        store.volumeData[store.volumeData.length - 1] = volObj;
                    }
                }
            }
        } catch (e) {
            console.warn("🚨 volumeSeries.update 예외 발생, 완전 멸균 후 재바인딩 복구 가동:", e);
            restoreVolumeDataSterilized();
        }
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

            // 🔥 [필수 추가] 메모리 원본 소독: 전역 스토어 배열 자체를 깨끗한 놈으로 갈아끼웁니다.
            store.volumeData = sterileVolumeData;

            store.volumeSeries.setData([]);
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