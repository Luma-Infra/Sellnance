// --- 🌐 전역 변수 (Global State) ---
// _main.js
let chart, candleSeries, previewSeries;
let mainData = [];
let curDir = 'bull', currentTheme = 'binance';
let currentWs = null, currentMarket = 'SPOT', currentTF = '1d';
let isCollapsed = false, allSymbols = [], isHover = false, isLogMode = false;
let marketDataMap = {};
let globalWs = null, tickerBuffer = {}, radarIntervalId = null;
const UI_UPDATE_INTERVAL = 3000;
const tfSec = { '1m': 60, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800, '1M': 2592000 };
let currentAsset = 'BTC';
let bullBody = 10, bearBody = 5;

// --- 🚀 초기화 (Init) ---
window.onload = () => {
    initChart();
    if (typeof startGlobalMarketRadar === 'function') startGlobalMarketRadar();
    if (typeof loadSymbols === 'function') loadSymbols();
    if (typeof selectSymbol === 'function') selectSymbol('BTC');

    // 슬라이더 이벤트 바인딩
    ['body', 'top', 'bottom'].forEach(id => {
        const inputEl = document.getElementById('input-' + id);
        if (inputEl) {
            inputEl.oninput = () => {
                const val = inputEl.value;
                document.getElementById('val-' + id).innerText = val + '%';
                if (id === 'body') {
                    if (curDir === 'bull') bullBody = val;
                    else bearBody = val;
                }
                updateStatus();
                if (isHover && typeof updatePreview === 'function') updatePreview();
            };
        }
    });

    const genBtn = document.getElementById('btn-generate');
    if (genBtn) {
        genBtn.onmouseenter = () => { isHover = true; if (typeof updatePreview === 'function') updatePreview(); };
        genBtn.onmouseleave = () => { isHover = false; previewSeries.setData([]); };
    }
};

// --- 🎨 차트 렌더링 및 UI ---
function initChart() {
    const container = document.getElementById('chart-container');
    if (chart) chart.remove();

    const isDark = currentTheme === 'binance' || currentTheme === 'upbit-dark';
    const upColor = currentTheme === 'binance' ? '#26a69a' : '#c84a31';
    const downColor = currentTheme === 'binance' ? '#ef5350' : '#1261c4';

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: container.clientHeight,
        layout: { background: { color: getComputedStyle(document.body).getPropertyValue('--bg').trim() }, textColor: getComputedStyle(document.body).getPropertyValue('--text').trim() },
        grid: { vertLines: { color: isDark ? '#2a2e39' : '#f1f1f4' }, horzLines: { color: isDark ? '#2a2e39' : '#f1f1f4' } },
        timeScale: { borderColor: isDark ? '#2a2e39' : '#d5d6dc', timeVisible: true },
        rightPriceScale: { visible: true, borderColor: isDark ? '#2a2e39' : '#d5d6dc', mode: isLogMode ? 1 : 0 },
        localization: {
            locale: navigator.language,
            timeFormatter: (tick) => {
                const date = new Date(tick * 1000);
                return date.toLocaleString(navigator.language, { hour: '2-digit', minute: '2-digit', hour12: false });
            },
        },
    });

    candleSeries = chart.addCandlestickSeries({ upColor, downColor, borderUpColor: upColor, borderDownColor: downColor, wickUpColor: upColor, wickDownColor: downColor });
    previewSeries = chart.addCandlestickSeries({ upColor: upColor + '4D', downColor: downColor + '4D', borderVisible: false, wickVisible: false });

    chart.subscribeCrosshairMove(p => {
        if (p.time) { const d = p.seriesData.get(candleSeries); if (d) updateLegend(d); }
        else if (mainData.length) updateLegend(mainData[mainData.length - 1]);
    });

    if (mainData.length) candleSeries.setData(mainData);
    autoFit(); updateStatus();

    // 🚨 진정제(Debounce)가 투여된 ResizeObserver
    if (window.chartResizeObserver) window.chartResizeObserver.disconnect();

    let resizeTimeout = null;
    window.chartResizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0) return;
        const { width, height } = entries[0].contentRect;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (chart && width > 0 && height > 0) chart.resize(width, height);
        }, 10);
    });
    window.chartResizeObserver.observe(container);
}

function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    const isCurrentlyDark = body.classList.contains('theme-binance');

    if (isCurrentlyDark) {
        body.classList.remove('theme-binance');
        currentTheme = 'upbit-light';
        if (btn) btn.innerHTML = '🌙 다크';
    } else {
        body.classList.add('theme-binance');
        currentTheme = 'binance';
        if (btn) btn.innerHTML = '☀️ 라이트';
    }
    setTimeout(() => { initChart(); }, 0);
}

function switchChartTab(mode) {
    const btnSim = document.getElementById('tab-btn-sim');
    if (mode === 'chart' && btnSim.classList.contains('active')) {
        Swal.fire({
            title: '시뮬레이션 종료 🚨', text: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아갑니다. 종료하시겠습니까?", icon: 'warning',
            showCancelButton: true, background: 'var(--panel)', color: 'var(--text)', confirmButtonColor: 'var(--down)', cancelButtonColor: 'var(--border)',
            confirmButtonText: '네, 초기화할게요 🗑️', cancelButtonText: '아니요, 계속할게요'
        }).then((result) => { if (result.isConfirmed) executeTabSwitch(mode); });
    } else {
        executeTabSwitch(mode);
    }
}

function executeTabSwitch(mode) {
    const btnChart = document.getElementById('tab-btn-chart'), btnSim = document.getElementById('tab-btn-sim'), controls = document.getElementById('sim-controls');
    if (mode === 'chart') {
        btnChart.classList.add('active'); btnSim.classList.remove('active'); controls.style.display = 'none';
        if (typeof fetchHistory === 'function') fetchHistory();
    } else {
        btnSim.classList.add('active'); btnChart.classList.remove('active'); controls.style.display = 'flex';
        if (currentWs) { currentWs.close(); currentWs = null; document.getElementById('status-dot').style.background = 'gray'; document.getElementById('status-text').innerText = 'SIMULATION MODE'; }
    }
    if (window.chart) {
        setTimeout(() => {
            const container = document.getElementById('chart-container');
            if (container.clientWidth > 0 && container.clientHeight > 0) window.chart.resize(container.clientWidth, container.clientHeight);
        }, 50);
    }
}

function setTF(tf) {
    const isSimMode = document.getElementById('tab-btn-sim').classList.contains('active');
    if (isSimMode) {
        Swal.fire({
            title: '초기화 경고!', text: "타임프레임을 변경하면 현재 그려둔 가상 차트가 모두 날아갑니다. 바꿀까요?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: 'var(--up)', cancelButtonColor: 'var(--border)', confirmButtonText: '네, 변경할게요 🚀', cancelButtonText: '아니요, 취소',
            background: 'var(--panel)', color: 'var(--text)'
        }).then((result) => { if (result.isConfirmed) executeSetTF(tf); });
    } else { executeSetTF(tf); }
}

function executeSetTF(tf) {
    currentTF = tf;
    document.querySelectorAll('.tf-btn').forEach(b => {
        const onClickAttr = b.getAttribute('onclick') || "";
        b.classList.toggle('active', onClickAttr.includes(`'${tf}'`));
    });
    if (typeof fetchHistory === 'function') fetchHistory();
}

function resetChartScale() {
    if (!chart || !candleSeries) return;
    chart.timeScale().fitContent();
    chart.priceScale('right').applyOptions({ autoScale: true });
}

function toggleLogScale() {
    isLogMode = !isLogMode;
    const btn = document.getElementById('log-btn');
    if (btn) { btn.innerText = isLogMode ? "Log ON" : "Log Off"; btn.classList.toggle('active', isLogMode); }
    chart.priceScale('right').applyOptions({ mode: isLogMode ? 1 : 0 });
}

function formatSmartPrice(price) {
    if (price === 0) return "0";
    const absPrice = Math.abs(price);
    if (absPrice >= 100) return price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const firstSigDigit = Math.floor(Math.log10(absPrice));
    const precision = Math.min(8, Math.max(2, Math.abs(firstSigDigit) + 3));
    return price.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

function updateLegend(d) {
    const leg = document.getElementById('ohlc-legend');
    if (!leg) return;
    const cls = d.close >= d.open ? 'text-theme-up' : 'text-theme-down'; // Tailwind 대응
    const chg = ((d.close - d.open) / d.open * 100).toFixed(2);
    const sign = chg > 0 ? '+' : '';
    leg.innerHTML = `
        <span class="opacity-50 text-[11px]">O</span> <span class="${cls} font-bold mr-2">${formatSmartPrice(d.open)}</span> 
        <span class="opacity-50 text-[11px]">H</span> <span class="${cls} font-bold mr-2">${formatSmartPrice(d.high)}</span> 
        <span class="opacity-50 text-[11px]">L</span> <span class="${cls} font-bold mr-2">${formatSmartPrice(d.low)}</span> 
        <span class="opacity-50 text-[11px]">C</span> <span class="${cls} font-bold">${formatSmartPrice(d.close)}</span> 
        <span class="${cls} font-black ml-2 bg-black/5 px-1.5 py-0.5 rounded">${sign}${chg}%</span>
    `;
}

function updateStatus() {
    if (!mainData.length) return;
    document.getElementById('head-price').innerText = mainData[mainData.length - 1].close.toLocaleString();
    if (typeof getNext === 'function') {
        document.getElementById('head-target').innerText = getNext().close.toLocaleString();
        document.getElementById('head-target').style.color = curDir === 'bull' ? 'var(--up)' : 'var(--down)';
    }
}

function autoFit() {
    if (chart && mainData.length) {
        const len = mainData.length;

        // 🚨 핵심 패치: 캔들을 화면 중간쯤에 오도록 '보이는 범위'를 강제 조절합니다.
        // from: 과거 100개 캔들 전부터 보여줌 (줌 레벨 조절)
        // to: 현재 캔들 이후로 '50개' 분량의 빈 도화지(우측 여백)를 미리 깔아둠
        chart.timeScale().setVisibleLogicalRange({
            from: len - 100,
            to: len + 50     // 👈 이 숫자를 키우면 캔들이 더 왼쪽(가운데)으로 밀려납니다.
        });

        chart.priceScale('right').applyOptions({ autoScale: true });
    }
}

function updatePreview() { if (mainData.length && isHover && typeof getNext === 'function') previewSeries.setData([getNext()]); }

// --- 📏 Measure Tool ---
let isMeasuring = false;
let measureStart = null;
const measureOverlay = document.createElement('div');
Object.assign(measureOverlay.style, { position: 'absolute', border: '1px solid var(--accent)', backgroundColor: 'rgba(41, 98, 255, 0.1)', pointerEvents: 'none', display: 'none', zIndex: '20', color: 'white', fontSize: '12px', padding: '5px', borderRadius: '4px', whiteSpace: 'pre' });
setTimeout(() => { // DOM 렌더링 후 부착
    const container = document.getElementById('chart-container');
    if (container) {
        container.appendChild(measureOverlay);
        container.addEventListener('mousedown', (e) => {
            if (e.shiftKey && e.button === 0) {
                isMeasuring = true; const rect = container.getBoundingClientRect();
                measureStart = { x: e.clientX - rect.left, y: e.clientY - rect.top, price: candleSeries.coordinateToPrice(e.clientY - rect.top), time: chart.timeScale().coordinateToTime(e.clientX - rect.left) };
                measureOverlay.style.display = 'block'; measureOverlay.style.width = '0px'; measureOverlay.style.height = '0px';
            }
        });
        container.addEventListener('mousemove', (e) => {
            if (!isMeasuring || !measureStart) return;
            const rect = container.getBoundingClientRect(), curX = e.clientX - rect.left, curY = e.clientY - rect.top, curPrice = candleSeries.coordinateToPrice(curY);
            if (curPrice === null) return;
            measureOverlay.style.left = `${Math.min(measureStart.x, curX)}px`; measureOverlay.style.top = `${Math.min(measureStart.y, curY)}px`;
            measureOverlay.style.width = `${Math.abs(curX - measureStart.x)}px`; measureOverlay.style.height = `${Math.abs(curY - measureStart.y)}px`;
            const priceDiff = curPrice - measureStart.price, percentDiff = (priceDiff / measureStart.price) * 100, sign = priceDiff > 0 ? '+' : '';
            measureOverlay.innerText = `Change: ${sign}${priceDiff.toLocaleString()}\n(${sign}${percentDiff.toFixed(2)}%)`;
        });
        container.addEventListener('contextmenu', (e) => { if (isMeasuring) { e.preventDefault(); isMeasuring = false; measureStart = null; measureOverlay.style.display = 'none'; } });
        container.addEventListener('mouseup', (e) => { if (e.button === 0) { isMeasuring = false; measureStart = null; measureOverlay.style.display = 'none'; } });
    }
}, 500);