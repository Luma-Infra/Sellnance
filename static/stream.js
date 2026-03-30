// --- 🌊 실시간 웹소켓 엔진 ---
// stream.js
function startRealtimeCandle(symbol, interval, isFutures, isSpot) {
    if (currentWs) { currentWs.close(); currentWs = null; }

    // binance
    if (isFutures || isSpot) {
        const binanceTicker = `${symbol}USDT`;
        const wsBase = isFutures ? 'wss://fstream.binance.com/ws/' : 'wss://stream.binance.com:9443/ws/';
        currentWs = new WebSocket(wsBase + `${binanceTicker.toLowerCase()}@kline_${interval}`);

        currentWs.onopen = () => {
            document.getElementById('status-dot').style.background = '#26a69a';
            document.getElementById('status-text').innerText = 'LIVE';
        };

        currentWs.onmessage = (e) => {
            const res = JSON.parse(e.data);
            const k = res.k;
            const liveData = { time: k.t / 1000, open: +k.o, high: +k.h, low: +k.l, close: +k.c };

            if (candleSeries) candleSeries.update(liveData);

            if (mainData.length > 0) {
                const lastIdx = mainData.length - 1;
                if (mainData[lastIdx].time === liveData.time) mainData[lastIdx] = liveData;
                else if (liveData.time > mainData[lastIdx].time) mainData.push(liveData);
            }
        };

        currentWs.onclose = () => {
            document.getElementById('status-dot').style.background = '#ef5350';
            document.getElementById('status-text').innerText = 'OFFLINE';
        };
    } else {

        // upbit
        const upbitTicker = `KRW-${symbol}`;
        currentWs = new WebSocket('wss://api.upbit.com/websocket/v1');

        currentWs.onopen = () => {
            const msg = [{ "ticket": "UNIQUE_TICKET" }, { "type": "ticker", "codes": [upbitTicker] }];
            currentWs.send(JSON.stringify(msg));
            document.getElementById('status-dot').style.background = '#26a69a';
            document.getElementById('status-text').innerText = 'LIVE';
        };

        // [ stream.js ] - 업비트 웹소켓 onmessage 부분 교체
        currentWs.onmessage = async (e) => {
            const text = await e.data.text();
            const res = JSON.parse(text);

            if (candleSeries && mainData.length > 0) {
                // 🚨 1. 업비트 체결 시간(ms)을 자바스크립트 Date 객체로 변환
                const d = new Date(res.timestamp);

                // 🚨 2. 현재 타임프레임(currentTF)에 맞춰서 "캔들의 진짜 시작 시간(정각)"을 완벽하게 계산
                if (currentTF === '1m') d.setUTCSeconds(0, 0);
                else if (currentTF === '15m') { d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0); }
                else if (currentTF === '1h') { d.setUTCMinutes(0, 0, 0); }
                else if (currentTF === '4h') { d.setUTCHours(Math.floor(d.getUTCHours() / 4) * 4, 0, 0, 0); }
                else if (currentTF === '1d') { d.setUTCHours(0, 0, 0, 0); }

                const candleStartTime = Math.floor(d.getTime() / 1000); // 완벽하게 정렬된 캔들 시작 시간(초)

                const liveData = {
                    time: candleStartTime,
                    open: +res.trade_price, high: +res.trade_price, low: +res.trade_price, close: +res.trade_price
                };

                const lastIdx = mainData.length - 1;

                // 🚨 3. 바이낸스와 완벽히 똑같은 '시간 비교' 업데이트 로직 (버그 0%)
                if (mainData[lastIdx].time === liveData.time) {
                    // 아직 같은 캔들 안에서 거래 중일 때 (갱신)
                    liveData.open = mainData[lastIdx].open;
                    liveData.high = Math.max(mainData[lastIdx].high, liveData.high);
                    liveData.low = Math.min(mainData[lastIdx].low, liveData.low);
                    mainData[lastIdx] = liveData;
                } else if (liveData.time > mainData[lastIdx].time) {
                    // 정각이 지나서 새로운 캔들이 탄생해야 할 때 (추가)
                    mainData.push(liveData);
                }

                // 차트 업데이트 (CPU 살인마였던 updateLegend(liveData)는 여기서 영구 삭제!)
                candleSeries.update(liveData);
            }
        };

        currentWs.onclose = () => {
            document.getElementById('status-dot').style.background = '#ef5350';
            document.getElementById('status-text').innerText = 'OFFLINE';
        };
    }
}

function startGlobalMarketRadar() {
    globalWs = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');

    globalWs.onopen = () => {
        const dot = document.getElementById('status-dot'), text = document.getElementById('status-text');
        if (dot) dot.style.background = '#26a69a';
        if (text) text.innerText = `MARKET LIVE (${UI_UPDATE_INTERVAL / 1000}s)`;
    };

    globalWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        data.forEach(ticker => {
            const pureSymbol = ticker.s.replace('USDT', '');
            tickerBuffer[pureSymbol] = ticker;
        });
    };

    if (radarIntervalId) clearInterval(radarIntervalId);
    radarIntervalId = setInterval(() => {
        Object.keys(tickerBuffer).forEach(pureSymbol => {
            if (typeof visibleSymbols !== 'undefined' && !visibleSymbols.has(pureSymbol)) return;

            const ticker = tickerBuffer[pureSymbol];
            const priceCell = document.getElementById(`price-${pureSymbol}`);
            const changeCell = document.getElementById(`change-${pureSymbol}`);
            const todayCell = document.getElementById(`today-${pureSymbol}`);

            if (priceCell) {
                const currentPrice = parseFloat(priceCell.innerText.replace(/[^0-9.-]+/g, ""));
                const newPrice = parseFloat(ticker.c);

                if (currentPrice !== newPrice) {
                    priceCell.innerText = `$ ${formatSmartPrice(newPrice)}`;
                    const flashClass = newPrice > currentPrice ? 'flash-up' : 'flash-down';
                    priceCell.classList.add(flashClass);
                    setTimeout(() => { priceCell.classList.remove(flashClass); }, 200);
                }
            }

            if (changeCell) {
                const newChange = parseFloat(ticker.P);
                const color = newChange > 0 ? "#26a69a" : newChange < 0 ? "#ef5350" : "gray";
                const weight = Math.abs(newChange) >= 5.0 ? "bold" : "normal";
                changeCell.innerHTML = `<span style="color:${color}; font-weight:${weight};">${newChange > 0 ? '+' : ''}${newChange.toFixed(2)} %</span>`;
            }

            if (todayCell && typeof originalTableData !== 'undefined') {
                const targetCoin = originalTableData.find(c => (c.Symbol || c.symbol) === pureSymbol);
                if (targetCoin && targetCoin.utc0_open) {
                    const openPrice = parseFloat(targetCoin.utc0_open), newPrice = parseFloat(ticker.c);
                    const todayChange = ((newPrice - openPrice) / openPrice) * 100;
                    const tColor = todayChange > 0 ? "#26a69a" : todayChange < 0 ? "#ef5350" : "gray";
                    const tWeight = Math.abs(todayChange) >= 5.0 ? "bold" : "normal";
                    todayCell.innerHTML = `<span style="color:${tColor}; font-weight:${tWeight};">${todayChange > 0 ? '+' : ''}${todayChange.toFixed(2)} %</span>`;
                }
            }
        });
        tickerBuffer = {};
    }, UI_UPDATE_INTERVAL);

    globalWs.onerror = () => {
        const dot = document.getElementById('status-dot'), text = document.getElementById('status-text');
        if (dot) dot.style.background = '#ef5350';
        if (text) text.innerText = 'ERROR/DISCONNECTED';
    };
}