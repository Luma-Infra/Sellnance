The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
// stream.js
// --- ? ?¤ěę°??šěěź??ě§ ę´?í (Orchestrator) ---
import { store, tfSec } from "./_store.js";
import { getMultiplier } from "./chart_utils.js";

// ?ě ?¤í¸ëŚ??ě§???ľíŠ ëĄë
import "./stream_table.js";
import "./stream_korea.js";
import "./stream_global.js";

// ?? [? ęˇ] ?ëë§?ęłźë???ë°Šě????°ëĄ? ëŠëŞ¨ëŚ?
const lastRenderMap = new Map();

// ??[HTS ?ľěŹ] ę°ëł ???ë? ?ëë§??ě§ (?šěěź??ěŠ)
function renderRealtimeRow(tId, data, isFutures = false) {
  const now = Date.now();
  const lastRender = lastRenderMap.get(tId) || 0;

  // ?? [?´ę˛°] PEPE vs 1000PEPE, XRP vs XRPDOWN ???Źëłź ?ˇę°ëŚ?ë°Šě? (?ë°ę¸?ë˛ęˇ¸ ěť?
  const dataSym = (data.s || tId).toUpperCase();

  // ?? [?¨ěź ě§ě¤ ęłľę¸??O(1) ę´ě ?ě]
  let row = store.tickerRowMap.get(dataSym);
  if (!row && (dataSym.startsWith("KRW-") || tId.startsWith("KRW-"))) {
    const upbitTicker = tId.replace("KRW-", "") + "KRW";
    row = store.tickerRowMap.get(upbitTicker);
  }

  if (!row) return;

  // ?¨ [ěľě˘ ?ëŹ¸?? PEPE vs 1000PEPE ??ë°°ě ę¸°í¸ę° ?¤ëĽ´ëŠ??¤ëĽ¸ ě˝ě¸??(?¤ěź ě°¨ë¨)
  if (getMultiplier(dataSym) !== getMultiplier(row.Ticker)) return;

  const newPrice = parseFloat(data.c || data.p);
  if (isNaN(newPrice)) return;

  const isKrwCoin =
    row.Ticker.endsWith("KRW") ||
    data.isUpbitRealtime ||
    tId.startsWith("KRW-");
  const rate = store.marketDataMap?.krw_usd_rate || 0;

  if (isKrwCoin) {
    row.Price_KRW = newPrice;
    row.Price_Raw = newPrice / rate;
    if (data.isUpbitRealtime) {
      row.Upbit_Price = newPrice;

