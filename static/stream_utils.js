// stream_utils.js
import { store } from "./_store.js";

/**
 * 캔들 객체의 시간을 현재 타임프레임(TF)에 맞춰 정문화된 포맷으로 변환
 */
export function getNormalizedTime(currentCandle) {
    if (!currentCandle) return null;
    const isDayUnit = !(store.currentTF || "1h").match(/[hm]/);

    let chartTime = currentCandle.time;
    if (isDayUnit) {
        if (typeof chartTime === "string" && chartTime.includes("-")) return chartTime;
        const numTime = Number(chartTime);
        if (isNaN(numTime)) return chartTime;
        const dt = new Date(numTime * 1000);
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    } else {
        if (typeof chartTime === "string" && chartTime.includes("-")) {
            const parsedUnix = Math.floor(new Date(chartTime).getTime() / 1000);
            return isNaN(parsedUnix) ? chartTime : parsedUnix;
        }
        return chartTime;
    }
}

/**
 * 변환된 시간이 Lightweight Charts가 받아들일 수 있는 유효한 규격인지 검증
 */
export function isTimeValid(t) {
    if (t === undefined || t === null) return false;
    if (typeof t === "number") {
        return !isNaN(t) && t > 0;
    }
    if (typeof t === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;
        const num = Number(t);
        if (!isNaN(num) && num > 0) return true;
        const parsed = Date.parse(t.includes("T") ? t : t + "T00:00:00Z");
        return !isNaN(parsed);
    }
    return false;
}