(() => {
  const TOP_N = 10;
  const traceMap = new Map();

  const getTop5 = () => {
    // 1. 가상화 스크롤 및 필터링 환경에서 실제로 화면 활성 상태인 행(.realtime-live-row)만 추출
    const rowEls = document.querySelectorAll('.coin-row.realtime-live-row');
    const visibleTickers = [];
    rowEls.forEach(el => {
      let t = el.getAttribute('data-ticker') || el.dataset.sym || (el.id && el.id.startsWith('row-') ? el.id.replace('row-', '') : null);
      if (t) visibleTickers.push(t);
    });

    // 화면에 코인이 있으면 무조건 화면 순서대로 TOP_N개 추출
    if (visibleTickers.length > 0) {
      return new Set(visibleTickers.slice(0, TOP_N));
    }

    // 만약 화면에서 아무것도 못 긁어왔을 경우 (렌더링 전 등) store 데이터로 폴백
    const fallback = (store?.currentTableData || []).map(r => r.Ticker);
    return new Set(fallback.slice(0, TOP_N));
  };

  const f = (v) => (v != null ? (+v).toFixed(4) : '-');

  const getSource = (stack) => {
    if (stack.includes('stream.js')) return '⏱ 3초레이더';
    if (stack.includes('stream_table.js')) return '🔌 실시간소켓';
    if (stack.includes('table_render.js')) return '📋 테이블렌더';
    return '기타';
  };

  let debugContainer = document.getElementById("realtime-debug-panel");
  if (!debugContainer) {
    debugContainer = document.createElement("div");
    debugContainer.id = "realtime-debug-panel";
    debugContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 550px;
      max-height: 600px;
      background: rgba(15, 18, 27, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      color: #e0e3eb;
      font-family: monospace;
      font-size: 11px;
      padding: 14px;
      box-shadow: 0 12px 35px rgba(0,0,0,0.6);
      z-index: 99999;
      overflow-y: auto;
      backdrop-filter: blur(15px);
    `;
    document.body.appendChild(debugContainer);

    // 🚀 드래그 앤 드롭 이동 로직
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    debugContainer.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      isDragging = true;
      const rect = debugContainer.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      debugContainer.style.cursor = 'grabbing';
      // bottom 초기화 및 top 기준으로 변경하여 이동 안 끊기게 방지
      debugContainer.style.bottom = 'auto';
      debugContainer.style.top = rect.top + 'px';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      debugContainer.style.left = (e.clientX - offsetX) + 'px';
      debugContainer.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      debugContainer.style.cursor = 'default';
    });
  }

  let backendOpenPrices = {};
  const syncBackendCache = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/static/utc0_prices.json');
      if (res.ok) {
        const data = await res.json();
        const todayStr = new Date().toISOString().slice(0, 10);
        backendOpenPrices = data[todayStr] || data || {};
      }
    } catch (e) { }
  };

  syncBackendCache();
  const beSyncInterval = setInterval(syncBackendCache, 5000);

  const updateUIBoard = () => {
    const top5 = getTop5();
    let textToCopy = `⚡ Sellnance 정밀 오염 추적 디버그 로그 (${new Date().toLocaleTimeString()})\n\n`;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #363a45; padding-bottom:8px; margin-bottom:8px;">
        <span style="font-weight:bold; color:#0ecb81; font-size:12px;">🔍 튀는 수치/오염 정밀 추적 패널</span>
        <div style="display:flex; gap:6px;">
          <button id="debug-copy-btn" style="background:#0ecb81; border:none; color:#fff; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;">📋 복사하기</button>
          <button onclick="window._stopTrace()" style="background:#f43f5e; border:none; color:#fff; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;">🛑 끄기</button>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
    `;

    for (let ticker of top5) {
      const state = traceMap.get(ticker) || {};
      const row = store?.tickerRowMap?.get(ticker) || {};

      const baseSym = ticker.replace("USDT", "").replace("KRW", "");
      const isFut = ticker.endsWith("USDT") && (store?.currentMarket === "FUTURES" || ticker.includes("_FUTURES"));
      const cacheKey = isFut ? `${baseSym}_FUTURES` : baseSym;

      const beOpenPrice = backendOpenPrices[cacheKey] || '-';
      const feOpenPrice = row.utc0_open_Raw || '-';

      // 🚨 범인 색출 시각화
      const spikeWarning = state.IsSpike ? `<div style="margin-top:4px; color:#ef4444; font-weight:bold; background:rgba(239,68,68,0.2); padding:4px; border-radius:4px; text-align:center;">🚨 비정상 스파이크 감지! (1초내 5% 튐)</div>` : '';
      const retroWarning = state.IsRetrograde ? `<div style="margin-top:4px; color:#f59e0b; font-weight:bold; background:rgba(245,158,11,0.2); padding:4px; border-radius:4px; text-align:center;">⚠️ 낡은 캐시(3초 레이더) 역행 덮어쓰기 감지!</div>` : '';

      const logLine = `[${ticker}] (${state.Type || ''})
- 가격: ${state.Price} (${state.PriceFormula}) ${state.IsSpike ? '🚨 비정상 유입!' : ''} ${state.IsRetrograde ? '⚠️ 과거 캐시 역행!' : ''}
- 24h: ${state.Chg24h}
- 오늘: ${state.ChgToday}
- 김프: ${row.Kimchi_Formatted || '-'} (Raw: ${row.Kimchi_Raw != null ? row.Kimchi_Raw.toFixed(4) + '%' : '-'})
- [김프 재료] 국내: ${row.Upbit_Price || row.Bithumb_Price || '-'} | 해외: ${row.Price_Raw || '-'} | 환율: ${store.marketDataMap?.krw_usd_rate || '-'}
- [교차 시가] 백엔드: ${beOpenPrice} | 프론트: ${feOpenPrice}
- [추적 필드] Exact_Spot: ${row.Exact_Spot} | Exact_Futures: ${row.Exact_Futures} | Symbol: ${row.Symbol} | Inflow_Path: ${row.Inflow_Path}
- [갱신원 필드] Price: "${row._lastPriceRawCaller || '대입없음'}" | ChangeToday: "${row._lastTodayRawCaller || '대입없음'}" | Kimchi: "${row._lastKimchiRawCaller || '대입없음'}" ${row._lastKimchiRawCaller ? `(급변: ${row._lastKimchiRawValBefore.toFixed(2)}% ➔ ${row._lastKimchiRawValAfter.toFixed(2)}%)` : ''}
- 경로: ${state.Source}\n`;
      textToCopy += logLine;

      html += `
        <div style="background:rgba(255,255,255,0.03); border:${state.IsSpike ? '2px solid #ef4444' : state.IsRetrograde ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)'}; padding:8px; border-radius:8px; margin-bottom:4px;">
          <div style="display:flex; justify-content:space-between; font-weight:bold; color:#f59e0b; margin-bottom:4px; font-size:12px;">
            <span>🪙 ${ticker}</span>
            <span style="font-size:10px; color:#aaa;">${state.Type || ''}</span>
          </div>
          <div style="padding-left:6px; line-height:1.5;">
            <div>💵 현재 가격: <span style="color:${state.IsSpike ? '#ef4444' : state.IsRetrograde ? '#f59e0b' : '#22d3ee'}; font-weight:bold;">${state.Price || '-'}</span> <span style="color:#888; font-size:9px;">(${state.PriceFormula || ''})</span></div>
            <div>📈 전일 24h: <span style="color:#0ecb81;">${state.Chg24h || '-'}</span></div>
            <div>📅 금일 변동: <span style="color:#ff6b6b; font-weight:bold;">${state.ChgToday || '-'}</span></div>
            <div>🥬 실시간 김프: <span style="color:#10b981; font-weight:bold;">${row.Kimchi_Formatted || '-'}</span> <span style="color:#888; font-size:9px;">(Raw: ${row.Kimchi_Raw != null ? row.Kimchi_Raw.toFixed(4) + '%' : '-'})</span></div>
            <div style="font-size:9px; color:#aaa; margin-bottom:4px;">ㄴ ⚖️ 재료 - 국내가: ${((row.Upbit_Price || row.Bithumb_Price || 0)).toLocaleString()}원 | 해외가: $${(row.Price_Raw || 0).toLocaleString()} | 환율: ${store.marketDataMap?.krw_usd_rate || '0'}원</div>
            
            ${spikeWarning}
            ${retroWarning}

            <div style="margin-top:6px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.08); font-size:10px;">
              <div>🖥️ <span style="color:#a6e22e;">백엔드 시가 (json)</span>: <span style="color:#fff; font-weight:bold;">${f(beOpenPrice)}</span> | 📱 <span style="color:#ae81ff;">프론트 시가 (store)</span>: <span style="color:#fff; font-weight:bold;">${f(feOpenPrice)}</span></div>
            </div>
            
            <div style="margin-top:6px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.05); font-size:10px; color:#38bdf8;">
              <strong>🔍 추적 데이터 필드 상태:</strong>
              <div style="padding-left:6px; color:#ccc;">
                • Exact_Spot: <span style="color:#f43f5e;">"${row.Exact_Spot || '없음'}"</span><br/>
                • Exact_Futures: <span style="color:#f43f5e;">"${row.Exact_Futures || '없음'}"</span><br/>
                • Symbol: <span style="color:#f43f5e;">"${row.Symbol || '없음'}"</span><br/>
                • Inflow_Path: <span style="color:#34d399;">"${row.Inflow_Path || '없음'}"</span><br/>
                • Price_Raw 갱신원: <span style="color:#eab308; font-weight:bold;">"${row._lastPriceRawCaller || '대입없음'}"</span><br/>
                • Change_Today_Raw 갱신원: <span style="color:#eab308; font-weight:bold;">"${row._lastTodayRawCaller || '대입없음'}"</span><br/>
                • Kimchi_Raw 갱신원: <span style="color:#eab308; font-weight:bold;">"${row._lastKimchiRawCaller || '대입없음'}"</span>
                ${row._lastKimchiRawCaller ? `<br/>&nbsp;&nbsp;<span style="color:#f43f5e;">ㄴ 급변: ${row._lastKimchiRawValBefore.toFixed(2)}% ➔ ${row._lastKimchiRawValAfter.toFixed(2)}%</span>` : ''}
              </div>
            </div>
            <div style="font-size:9px; color:#999; margin-top:4px;">📍 최종 업데이트 경로: ${state.Source || '-'}</div>
          </div>
        </div>
      `;
    }

    html += `
      <div id="debug-store-dump" style="margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 8px; font-size: 9px; color: #ffbc00; word-break: break-all;"></div>
    </div>`;
    debugContainer.innerHTML = html;

    document.getElementById("debug-copy-btn").onclick = () => {
      navigator.clipboard.writeText(textToCopy.trim()).then(() => {
        const btn = document.getElementById("debug-copy-btn");
        btn.innerText = "✓ 복사 완료";
        btn.style.background = "#089f65";
        setTimeout(() => {
          btn.innerText = "📋 복사하기";
          btn.style.background = "#0ecb81";
        }, 1000);
      });
    };
  };

  const detectAnomaly = (ticker, newPrice, rowEl, src) => {
    const prevState = traceMap.get(ticker) || {};
    const oldPrice = prevState._RawNumPrice || newPrice;
    const oldTime = prevState._LastPriceTime || Date.now();
    const oldSrc = prevState.Source || src;
    const now = Date.now();

    let isSpike = prevState.IsSpike || false;
    let isRetrograde = prevState.IsRetrograde || false;

    if (oldPrice > 0 && newPrice !== oldPrice) {
      const diffRatio = Math.abs(newPrice - oldPrice) / oldPrice;
      const timeDiff = now - oldTime;

      // 🚀 1초(1000ms) 내에 이전 가격 대비 5% 초과 차이가 나면 비정상(범인)으로 간주
      if (diffRatio > 0.05 && timeDiff <= 1000) {
        isSpike = true;
        console.warn(`🚨 [스파이크] ${ticker} 1초 내에 튀는 값 유입! (시간차:${timeDiff}ms | 전:${oldPrice} -> 후:${newPrice} | 차이:${(diffRatio * 100).toFixed(2)}%)`);
      }

      // 🚀 실시간 소켓이 3초 레이더 값으로 덮어씌워지는지 (과거 데이터 유입 역행) 체크
      if (oldSrc === '🔌 실시간소켓' && src === '⏱ 3초레이더') {
        isRetrograde = true;
        console.warn(`⚠️ [역행 오염] ${ticker} 최신 실시간 데이터가 낡은 3초 레이더 데이터로 덮어씌워짐! (전:${oldPrice} -> 후:${newPrice})`);
      }

      if (isSpike || isRetrograde) {
        // 🚀 범인 행 DOM에 반투명 효과 강제 적용
        if (rowEl) {
          const targetRow = rowEl.closest ? rowEl.closest('.coin-row') : rowEl;
          if (targetRow) {
            targetRow.style.opacity = '0.5';
            targetRow.style.transition = 'opacity 0.2s';
          }
        }
      }
    }
    return { isSpike, isRetrograde, oldPrice, newTime: now };
  };

  const _dynOrig = window.updateRowDynamicHTML;
  window.updateRowDynamicHTML = function (rowEl, row, lw) {
    if (row && getTop5().has(row.Ticker)) {
      // 🚀 [초강력 감지] Price_Raw 와 Change_Today_Raw 프로퍼티에 Setter 인터셉터 주입하여 실시간 덮어쓰기 오염원 색출
      if (!row._interceptorInstalled) {
        row._interceptorInstalled = true;
        let _priceRawVal = row.Price_Raw;
        let _todayRawVal = row.Change_Today_Raw;
        let _kimchiRawVal = row.Kimchi_Raw;

        Object.defineProperty(row, 'Price_Raw', {
          get() { return _priceRawVal; },
          set(newVal) {
            const stack = new Error().stack || '';
            let caller = 'unknown';
            if (stack.includes('stream.js')) caller = 'stream.js';
            else if (stack.includes('stream_table.js')) caller = 'stream_table.js';
            else if (stack.includes('feed_binance_spot.js')) caller = 'feed_binance_spot.js';
            else if (stack.includes('feed_upbit.js')) caller = 'feed_upbit.js';
            else if (stack.includes('table_api.js')) caller = 'table_api.js';
            else caller = stack.split('\n')[2]?.trim() || 'unknown';

            if (newVal !== _priceRawVal) {
              if (getTop5().has(row.Ticker)) {
                console.warn(`[PROPERTY INTERCEPT] 🚨 ${row.Ticker}.Price_Raw 오염 감지: ${_priceRawVal} ➔ ${newVal} | 호출자: ${caller}`);
                row._lastPriceRawCaller = caller;
              }
            }
            _priceRawVal = newVal;
          },
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(row, 'Change_Today_Raw', {
          get() { return _todayRawVal; },
          set(newVal) {
            const stack = new Error().stack || '';
            let caller = 'unknown';
            if (stack.includes('stream.js')) caller = 'stream.js';
            else if (stack.includes('stream_table.js')) caller = 'stream_table.js';
            else if (stack.includes('feed_binance_spot.js')) caller = 'feed_binance_spot.js';
            else if (stack.includes('feed_upbit.js')) caller = 'feed_upbit.js';
            else if (stack.includes('table_api.js')) caller = 'table_api.js';
            else caller = stack.split('\n')[2]?.trim() || 'unknown';

            if (newVal !== _todayRawVal) {
              if (getTop5().has(row.Ticker)) {
                console.warn(`[PROPERTY INTERCEPT] 🚨 ${row.Ticker}.Change_Today_Raw 오염 감지: ${_todayRawVal} ➔ ${newVal} | 호출자: ${caller}`);
                row._lastTodayRawCaller = caller;
              }
            }
            _todayRawVal = newVal;
          },
          configurable: true,
          enumerable: true
        });

        Object.defineProperty(row, 'Kimchi_Raw', {
          get() { return _kimchiRawVal; },
          set(newVal) {
            const stack = new Error().stack || '';
            let caller = 'unknown';
            if (stack.includes('stream.js')) caller = 'stream.js';
            else if (stack.includes('stream_table.js')) caller = 'stream_table.js';
            else if (stack.includes('feed_binance_spot.js')) caller = 'feed_binance_spot.js';
            else if (stack.includes('feed_upbit.js')) caller = 'feed_upbit.js';
            else if (stack.includes('table_api.js')) caller = 'table_api.js';
            else if (stack.includes('stream_korea.js')) caller = 'stream_korea.js';
            else caller = stack.split('\n')[2]?.trim() || 'unknown';

            if (_kimchiRawVal !== undefined && newVal !== null && _kimchiRawVal !== null) {
              const diff = Math.abs(newVal - _kimchiRawVal);
              if (diff >= 1.0) {
                if (getTop5().has(row.Ticker)) {
                  console.warn(`[KIMP INTERCEPT] 🚨 ${row.Ticker}.Kimchi_Raw 1%p 이상 급변/오염 감지: ${_kimchiRawVal.toFixed(2)}% ➔ ${newVal.toFixed(2)}% | 호출자: ${caller}`);
                  row._lastKimchiRawCaller = caller;
                  row._lastKimchiRawValBefore = _kimchiRawVal;
                  row._lastKimchiRawValAfter = newVal;
                }
              }
            }
            _kimchiRawVal = newVal;
          },
          configurable: true,
          enumerable: true
        });
      }

      const src = getSource(new Error().stack);
      const market = store.currentMarket || "ALL";

      let priceVal = row.Price_Raw ?? 0;
      let priceSrc = `Raw:${f(row.Price_Raw)}`;
      if (market === "UPBIT") {
        priceVal = row.Upbit_Price ?? priceVal;
        priceSrc = `Upbit_Price:${f(row.Upbit_Price)}`;
      } else if (market === "BITHUMB") {
        priceVal = row.Bithumb_Price ?? priceVal;
        priceSrc = `Bithumb_Price:${f(row.Bithumb_Price)}`;
      } else if (market === "FUTURES") {
        priceVal = row.Binance_Price_Futures ?? priceVal;
        priceSrc = `Bin_Fut:${f(row.Binance_Price_Futures)}`;
      } else if (market === "BYBIT_FUTURES") {
        priceVal = row.Bybit_Price_Futures ?? priceVal;
        priceSrc = `Bybit_Fut:${f(row.Bybit_Price_Futures)}`;
      }

      // 🚨 유입 값 검증 및 색출
      const anomalyInfo = detectAnomaly(row.Ticker, priceVal, rowEl, src);

      let chg24 = row.Change_24h_Raw ?? 0;
      let chgToday = row.Change_Today_Raw ?? 0;

      traceMap.set(row.Ticker, {
        Type: 'DYN (전체)',
        Price: f(priceVal),
        PriceFormula: priceSrc,
        Chg24h: `${f(chg24)}%`,
        ChgToday: `${f(chgToday)}%`,
        Source: src,
        _RawNumPrice: priceVal,
        _LastPriceTime: anomalyInfo.newTime,
        IsSpike: anomalyInfo.isSpike,
        IsRetrograde: anomalyInfo.isRetrograde
      });
      updateUIBoard();
    }
    return _dynOrig?.apply(this, arguments);
  };

  const _priceOrig = window.updateRowPriceDisplay;
  window.updateRowPriceDisplay = function (rowEl, row) {
    if (row && getTop5().has(row.Ticker)) {
      const src = getSource(new Error().stack);
      const prevState = traceMap.get(row.Ticker) || {};

      const market = store.currentMarket || "ALL";
      let priceVal = row.Price_Raw ?? 0;
      let priceSrc = `Raw:${f(row.Price_Raw)}`;
      if (market === "UPBIT") {
        priceVal = row.Upbit_Price ?? priceVal;
        priceSrc = `Upbit_Price:${f(row.Upbit_Price)}`;
      } else if (market === "BITHUMB") {
        priceVal = row.Bithumb_Price ?? priceVal;
        priceSrc = `Bithumb_Price:${f(row.Bithumb_Price)}`;
      } else if (market === "FUTURES") {
        priceVal = row.Binance_Price_Futures ?? priceVal;
        priceSrc = `Bin_Fut:${f(row.Binance_Price_Futures)}`;
      } else if (market === "BYBIT_FUTURES") {
        priceVal = row.Bybit_Price_Futures ?? priceVal;
        priceSrc = `Bybit_Fut:${f(row.Bybit_Price_Futures)}`;
      }

      const anomalyInfo = detectAnomaly(row.Ticker, priceVal, rowEl, src);

      let chg24 = row.Change_24h_Raw ?? 0;
      let chgToday = row.Change_Today_Raw ?? 0;

      traceMap.set(row.Ticker, {
        Type: 'PRC (가격만)',
        Price: f(priceVal),
        PriceFormula: priceSrc,
        Chg24h: `${f(chg24)}%`,
        ChgToday: `${f(chgToday)}%`,
        Source: src,
        _RawNumPrice: priceVal,
        _LastPriceTime: anomalyInfo.newTime,
        IsSpike: anomalyInfo.isSpike || prevState.IsSpike,
        IsRetrograde: anomalyInfo.isRetrograde || prevState.IsRetrograde
      });
      updateUIBoard();
    }
    return _priceOrig?.apply(this, arguments);
  };

  updateUIBoard();

  // 🚀 3초 레이더가 꺼지면서 '소켓 이벤트가 아예 없는(죽은) 짭코인들'은 렌더링 훅이 동작하지 않아 추적이 멈추는 현상 해결
  // 1초마다 능동적으로 store 에서 값을 긁어와서 디버그 패널을 강제 업데이트하는 폴링 루프 추가
  const activePollInterval = setInterval(() => {
    const targets = getTop5();
    let hasUpdates = false;

    // 1. 화면에서 사라진(hidden이 된) 티커는 디버그 이력에서 강제 청소
    for (let ticker of traceMap.keys()) {
      if (!targets.has(ticker)) {
        traceMap.delete(ticker);
        hasUpdates = true;
      }
    }

    for (let ticker of targets) {
      const row = store?.tickerRowMap?.get(ticker);
      if (!row) continue;

      const prevState = traceMap.get(ticker) || {};

      let chg24 = row.Change_24h_Raw ?? 0;
      let chgToday = row.Change_Today_Raw ?? 0;

      // 폴백 렌더링에만 의존하지 않도록, 값이 있든 없든 폴링 루프가 가장 최신 상태를 강제로 덮어씁니다.
      traceMap.set(ticker, {
        Type: prevState.Type || 'POLL (강제수집)',
        Price: f(row.Price_Raw ?? 0),
        PriceFormula: prevState.PriceFormula || 'Raw(Polled)',
        Chg24h: `${f(chg24)}%`,
        ChgToday: `${f(chgToday)}%`,
        Source: prevState.Source || '🔍 강제 추적 루프',
        _RawNumPrice: row.Price_Raw ?? 0,
        _LastPriceTime: prevState._LastPriceTime || Date.now(),
        IsSpike: prevState.IsSpike || false,
        IsRetrograde: prevState.IsRetrograde || false
      });
      hasUpdates = true;
    }

    if (hasUpdates) {
      updateUIBoard();
    }

    // 🚀 [추적 전용] PIVX 와 NOM 의 실제 store 내부 원본 JSON 덤프 주입
    const pivxRaw = store?.tickerRowMap?.get('PIVX') || store?.tickerRowMap?.get('PIVXUSDT');
    const nomRaw = store?.tickerRowMap?.get('NOM') || store?.tickerRowMap?.get('NOMUSDT');
    const dumpEl = document.getElementById("debug-store-dump");
    if (dumpEl) {
      dumpEl.innerHTML = `
        <b>[STORE RAW OBJECT DUMP]</b><br/>
        PIVX: ${pivxRaw ? JSON.stringify({
          Price_Raw: pivxRaw.Price_Raw,
          Price_KRW: pivxRaw.Price_KRW,
          Upbit_Price: pivxRaw.Upbit_Price,
          Binance_Price_Spot: pivxRaw.Binance_Price_Spot,
          Change_Today_Raw: pivxRaw.Change_Today_Raw,
          Change_Today_Binance: pivxRaw.Change_Today_Binance,
          Change_Today_Upbit: pivxRaw.Change_Today_Upbit,
          Exact_Spot: pivxRaw.Exact_Spot,
          Exact_Futures: pivxRaw.Exact_Futures,
          UID: pivxRaw.UID
        }) : 'NOT FOUND'}<br/>
        NOM: ${nomRaw ? JSON.stringify({
          Price_Raw: nomRaw.Price_Raw,
          Price_KRW: nomRaw.Price_KRW,
          Upbit_Price: nomRaw.Upbit_Price,
          Binance_Price_Spot: nomRaw.Binance_Price_Spot,
          Binance_Price_Futures: nomRaw.Binance_Price_Futures,
          Change_Today_Raw: nomRaw.Change_Today_Raw,
          Change_Today_Binance: nomRaw.Change_Today_Binance,
          Change_Today_Futures: nomRaw.Change_Today_Futures,
          Exact_Spot: nomRaw.Exact_Spot,
          Exact_Futures: nomRaw.Exact_Futures,
          UID: nomRaw.UID
        }) : 'NOT FOUND'}
      `;
    }
  }, 1000);

  window._stopTrace = () => {
    clearInterval(beSyncInterval);
    clearInterval(activePollInterval);
    window.updateRowDynamicHTML = _dynOrig;
    window.updateRowPriceDisplay = _priceOrig;
    const panel = document.getElementById("realtime-debug-panel");
    if (panel) panel.remove();
    console.log('🛑 디버거 종료 완료');
  };
})();

/**
 * ⚡ Sellnance 정밀 오염 추적 디버그 로그 (24h 정렬 시 Day 값 0% 고착 원인 분석)
 * 
 * [원인 분석]
 * 1. 3초 레이더가 꺼짐에 따라 실시간 거래(체결) 소켓이 들어오지 않는 마이너 코인들은 
 *    시가 대비 오늘 등락률(Change_Today_Raw)을 연산/갱신해 주는 통로가 차단되었습니다.
 * 2. 이 코인들은 백엔드 최초 데이터의 초기값(0%) 상태로 메모리에 유지됩니다.
 * 3. 이 상태에서 사용자가 "24h 정렬"을 수행하면, 24h 변동률은 채워져 있으나 Day 등락률은 0%인 
 *    이 마이너 코인들이 대거 상위 뷰포트(상위 30위) 안으로 치고 올라옵니다.
 * 4. 이때 테이블 렌더러인 `W` 함수가 이 코인들을 그릴 때, `Change_Today_Raw` 가 0인 상태 그대로 화면에 출력되므로 
 *    사용자는 "24h 정렬 시 Day 값이 0%로 강제 초기화되는 버그"가 생긴 것처럼 보이게 됩니다.
 * 5. 결정적으로, 백그라운드 무지연 사일런트 동기화(`loadTableDataSilent`) 함수에서 5분마다 백엔드의 최신 데이터를 가져올 때,
 *    `Change_24h_Raw`, `Change_Today_Raw` 변동률 데이터를 장부에 머징하는 로직이 완전히 누락되어 있었습니다.
 *    이 때문에 소켓이 없는 코인들은 5분이 지나도 0%에서 평생 탈출하지 못했습니다.
 * 6. 또한 `table_render.js` 의 `W` 함수가 24h와 Day 변동률을 렌더링할 때, `ALL` 모드에서 대표 지표(`_Raw`)를 바로 바라보지 않고 
 *    `hasFutures` / `hasSpot` 에 따라 서브 속성을 억지로 읽으려 하다가 우선순위 충돌로 0%가 덮어씌워지는 오류가 있었습니다.
 * 
 * [조치 사항]
 * 1. `table_render.js` 의 `W` 렌더러 함수가 ALL 모드에서 복잡한 거래소 분기 없이 
 *    대표 정량 지표인 `row.Change_24h_Raw` 와 `row.Change_Today_Raw` 를 즉시 직접 가져가 그리도록 단순화했습니다.
 * 2. `table_api.js` 의 사일런트 동기화 함수에 시세 및 24h/Day 변동률 데이터를 정상적으로 동기화 갱신(머징)하도록 항목을 보강했습니다.
 */
