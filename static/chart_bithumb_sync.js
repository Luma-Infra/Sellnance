// chart_bithumb_sync.js
// 🚀 빗썸 전용 KST 시간/가격 정규화 및 분해·재창조 조립 통합 엔진

import { store } from "./_store.js";

/**
 * 빗썸 KST 기준 타임프레임별 경계 시각(Unix 초) 계산
 * 4h: KST 00, 04, 08, 12, 16, 20시 4시간 단위 시작
 * 12h: KST 00(자정), 12(정오) 12시간 단위 시작
 * 1d: KST 00(자정) 일봉 시작
 * 3d: KST 00(자정) 3일 단위 시작
 * 1w: KST 월요일 00:00 주봉 시작 (일요일 23:59 지나자마자)
 * 1M: KST 매월 1일 00:00 월봉 시작 (말일 23:59 지나자마자)
 */
export function getBithumbGroupTime(tSec, tf) {
  const kstSec = tSec + 32400; // UTC -> KST
  const dKst = new Date(kstSec * 1000);

  if (tf === "15m") {
    return Math.floor(tSec / 900) * 900;
  }
  if (tf === "4h") {
    const kstGroup = Math.floor(kstSec / 14400) * 14400;
    return kstGroup - 32400;
  }
  if (tf === "12h") {
    const kstGroup = Math.floor(kstSec / 43200) * 43200;
    return kstGroup - 32400;
  }
  if (tf === "1d") {
    const kstGroup = Math.floor(kstSec / 86400) * 86400;
    return kstGroup - 32400;
  }
  if (tf === "3d") {
    const kstGroup = Math.floor(kstSec / 259200) * 259200;
    return kstGroup - 32400;
  }
  if (tf === "1w") {
    const day = dKst.getUTCDay();
    const diff = dKst.getUTCDate() - day + (day === 0 ? -6 : 1);
    const kstMonTs = Date.UTC(dKst.getUTCFullYear(), dKst.getUTCMonth(), diff, 0, 0, 0) / 1000;
    return kstMonTs - 32400;
  }
  if (tf === "1M") {
    const kstFirstTs = Date.UTC(dKst.getUTCFullYear(), dKst.getUTCMonth(), 1, 0, 0, 0) / 1000;
    return kstFirstTs - 32400;
  }
  return tSec;
}

/**
 * 빗썸 데이터 호출 -> 분해 -> 재창조 및 조립 통합 파이프라인
 * @param {Object} options - { symbol, tf, exactFutures, exactSpot, pureBase, fetchCandlesSmart }
 * @returns {Promise<Array>} 정규화된 캔들 객체 배열 [{ time, open, high, low, close, vol }, ...]
 */
export async function fetchBithumbUnifiedCandles(options) {
  const {
    symbol,
    tf,
    exactFutures = "",
    exactSpot = "",
    pureBase = "",
    fetchCandlesSmart,
  } = options;

  if (typeof fetchCandlesSmart !== "function") return [];

  const isSynthesisTF = ["4h", "12h", "1d", "3d", "1w", "1M"].includes(tf);
  const cleanSymbol = symbol.replace("KRW-", "").replace("_KRW", "");
  const bithumbSym = `${cleanSymbol}_KRW`;

  // 1️⃣ 4시간봉, 12시간봉, 일봉, 3일봉, 주봉, 월봉 200개 캔들 풀 합성 조립
  if (isSynthesisTF) {
    const glbTicker = exactFutures
      ? `${exactFutures}USDT`
      : exactSpot
        ? `${exactSpot}USDT`
        : pureBase
          ? `${pureBase}USDT`
          : `${cleanSymbol}USDT`;
    const glbEx = exactFutures ? "binance_futures" : "binance_spot";

    const bFetchInt = ["4h", "12h"].includes(tf) ? tf : "24h";
    const [bData, glbData] = await Promise.all([
      fetchCandlesSmart("bithumb", bithumbSym, bFetchInt, 1000),
      fetchCandlesSmart(glbEx, glbTicker, tf, 200).catch(() => null),
    ]);

    const rawBithumbList = Array.isArray(bData?.data) ? bData.data : [];
    const bLen = rawBithumbList.length;
    const currentRate = store.marketDataMap?.krw_usd_rate || 1353;

    // 바이낸스 표준 글로벌 24시간 변동폭(몸통/꼬리)에 빗썸 KRW 환율/김프를 입혀 완벽한 200개 캔들 합성
    if (Array.isArray(glbData) && glbData.length > 0) {
      const gLen = glbData.length;
      return glbData
        .map((d, idx) => {
          const tSec = Math.floor(Number(d[0]) / 1000);
          const open = Number(d[1]) * currentRate;
          const high = Number(d[2]) * currentRate;
          const low = Number(d[3]) * currentRate;
          const close = Number(d[4]) * currentRate;
          // 💡 vol은 시프트/쪼개기 없이 빗썸 원본 볼륨 그대로 직결 매핑
          const bIdx = bLen - (gLen - idx);
          const vol = bIdx >= 0 && rawBithumbList[bIdx] ? Number(rawBithumbList[bIdx][5]) : Number(d[5]) || 0;
          return { time: tSec, open, high, low, close, vol };
        })
        .sort((a, b) => a.time - b.time);
    }

    // 폴백: 순수 국내 코인은 24h 시프트 후 그룹 조립
    if (rawBithumbList.length > 0) {
      const raw24hMapped = rawBithumbList
        .map((d) => ({
          time: Math.floor(Number(d[0]) / 1000) + 32400,
          open: Number(d[1]),
          close: Number(d[2]),
          high: Number(d[3]),
          low: Number(d[4]),
          vol: Number(d[5]),
        }))
        .sort((a, b) => a.time - b.time);

      const groups = {};
      raw24hMapped.forEach((d) => {
        const gt = getBithumbGroupTime(d.time, tf);
        if (!groups[gt]) groups[gt] = [];
        groups[gt].push(d);
      });

      return Object.keys(groups)
        .sort((a, b) => Number(a) - Number(b))
        .map((gtStr) => {
          const gt = Number(gtStr);
          const chunk = groups[gt].sort((a, b) => a.time - b.time);
          return {
            time: gt,
            open: chunk[0].open,
            close: chunk[chunk.length - 1].close,
            high: Math.max(...chunk.map((c) => c.high)),
            low: Math.min(...chunk.map((c) => c.low)),
            vol: chunk.reduce((sum, c) => sum + (c.vol || 0), 0),
          };
        });
    }
    return [];
  }

  // 2️⃣ 단기봉 (1m~1h, 15m 분해조립)
  const bMap = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "5m",
    "30m": "30m",
    "1h": "1h",
  };
  const bFetchInt = bMap[tf] || "1h";
  const bData = await fetchCandlesSmart("bithumb", bithumbSym, bFetchInt, 1000);

  if (bData?.status === "0000" && Array.isArray(bData.data)) {
    const rawMapped = bData.data
      .map((d) => ({
        time: Math.floor(Number(d[0]) / 1000),
        open: Number(d[1]),
        close: Number(d[2]),
        high: Number(d[3]),
        low: Number(d[4]),
        vol: Number(d[5]),
      }))
      .sort((a, b) => a.time - b.time);

    const tfNeedsResample = ["15m", "4h", "12h"].includes(tf);
    if (tfNeedsResample) {
      const groups = {};
      rawMapped.forEach((d) => {
        const gt = getBithumbGroupTime(d.time, tf);
        if (!groups[gt]) groups[gt] = [];
        groups[gt].push(d);
      });

      return Object.keys(groups)
        .sort((a, b) => Number(a) - Number(b))
        .map((gtStr) => {
          const gt = Number(gtStr);
          const chunk = groups[gt].sort((a, b) => a.time - b.time);
          return {
            time: gt,
            open: chunk[0].open,
            close: chunk[chunk.length - 1].close,
            high: Math.max(...chunk.map((c) => c.high)),
            low: Math.min(...chunk.map((c) => c.low)),
            vol: chunk.reduce((sum, c) => sum + (c.vol || 0), 0),
          };
        });
    }
    return rawMapped;
  }

  return [];
}
