// stream_utils.js - 실시간 스트림 파이프라인 공통 가드 및 연산 유틸리티
import { store } from "./_store.js";
import { getPureBase, getUnixSeconds } from "./chart_utils.js";
import { mapTime } from "./chart_data.js";

/**
 * 타임프레임에 맞춰 일봉(YYYY-MM-DD) 또는 분/시봉(Unix초)으로 시간 정규화
 * @param {Object|number|string} d 
 * @returns {*} 정규화된 time 값
 */
export function getNormalizedTime(d) {
  if (typeof d === "object" && d !== null && d.time !== undefined) {
    return mapTime(d, store.currentTF).time;
  }
  return mapTime({ time: d }, store.currentTF).time;
}

/**
 * 타임스탬프 또는 날짜 형식 유효성 검증
 * @param {*} chartTime 
 * @returns {boolean}
 */
export function isTimeValid(chartTime) {
  if (chartTime === undefined || chartTime === null) return false;
  if (typeof chartTime === "number") {
    return !isNaN(chartTime) && chartTime > 0;
  }
  if (typeof chartTime === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(chartTime)) return true;
    const num = Number(chartTime);
    if (!isNaN(num) && num > 0) return true;
    const parsed = Date.parse(
      chartTime.includes("T") ? chartTime : chartTime + "T00:00:00Z",
    );
    return !isNaN(parsed);
  }
  return false;
}

/**
 * 차트가 데이터 패칭, 탭 복원, 과거 데이터 로딩 중인지 확인하는 공통 락 가드
 * @returns {boolean} 차트가 바쁜 상태이면 true
 */
export function isChartBusy() {
  return Boolean(
    store.isFetchingChart ||
    window.isFetchingChart ||
    store.isLoadingMoreHistory ||
    store.isRestoringTab
  );
}

/**
 * 수신된 웹소켓 틱 심볼이 현재 활성화(선택)된 코인과 일치하는지 안전하게 검증
 * @param {string} tickSymbol - 웹소켓 수신 심볼 (예: 'BTCUSDT', 'KRW-BTC', 'BTC_KRW', 'BTC')
 * @returns {boolean} 현재 활성 심볼과 일치하면 true
 */
export function isMatchingCurrentSymbol(tickSymbol) {
  if (!tickSymbol) return false;
  const currentExpected = (store.currentSelectedSymbol || store.currentAsset || "")
    .replace(/USDT$/i, "")
    .replace(/^KRW-/, "")
    .replace(/_KRW$/, "")
    .toUpperCase();

  if (!currentExpected) return false;

  const cleanTick = String(tickSymbol)
    .replace(/USDT$/i, "")
    .replace(/^KRW-/, "")
    .replace(/_KRW$/, "")
    .toUpperCase();

  return (
    cleanTick === currentExpected ||
    getPureBase(cleanTick) === getPureBase(currentExpected) ||
    getPureBase(tickSymbol) === getPureBase(currentExpected)
  );
}

/**
 * 🛡️ [가격 이상치/코인 교차 오염 안전망]
 * 직전 봉 종가 대비 10배 폭등 또는 99% 폭락 등 비정상 틱 유입 방어
 * @param {number} newPrice - 신규 체결가
 * @param {number} currentClose - 직전 봉 종가
 * @param {number} maxRatio - 최대 허용 배수 (기본: 10.0배)
 * @param {number} minRatio - 최소 허용 배수 (기본: 0.01 = -99%)
 * @returns {boolean} 정상 가격 범위 내이면 true
 */
export function isValidPriceRatio(newPrice, currentClose, maxRatio = 10.0, minRatio = 0.01) {
  if (typeof newPrice !== "number" || isNaN(newPrice) || newPrice <= 0) return false;
  if (typeof currentClose !== "number" || isNaN(currentClose) || currentClose <= 0) return true;
  const ratio = newPrice / currentClose;
  return ratio <= maxRatio && ratio >= minRatio;
}

/**
 * 단일 체결(Trade) 틱을 현재 캔들에 반영하거나 다음 봉으로 진행
 * @param {Object} lastCandle - 현재 마지막 캔들 객체
 * @param {number} newPrice - 신규 체결가
 * @param {number} tradeQty - 체결 수량
 * @param {number} currentUnix - 체결 시각 (초 단위)
 * @param {number} nextBarTime - 다음 봉 시작 시각 (초 단위)
 * @returns {{ isNewCandle: boolean, activeCandle: Object }}
 */
export function applyTradeToCandle(lastCandle, newPrice, tradeQty, currentUnix, nextBarTime) {
  if (currentUnix < nextBarTime) {
    lastCandle.close = newPrice;
    lastCandle.high = Math.max(lastCandle.high, newPrice);
    lastCandle.low = Math.min(lastCandle.low, newPrice);
    lastCandle.volume = (lastCandle.volume || 0) + (tradeQty || 0);
    return { isNewCandle: false, activeCandle: lastCandle };
  } else {
    const normTime = getNormalizedTime({ time: nextBarTime });
    const activeCandle = {
      time: normTime,
      open: newPrice,
      high: newPrice,
      low: newPrice,
      close: newPrice,
      volume: tradeQty || 0,
    };
    store.mainData.push(activeCandle);
    store.mainDataMap.set(getUnixSeconds(activeCandle.time), activeCandle);
    return { isNewCandle: true, activeCandle };
  }
}
