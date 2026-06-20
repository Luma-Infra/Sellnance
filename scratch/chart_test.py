import http.server, socketserver, webbrowser, os

PORT = 8200
HTML_CONTENT = """<!DOCTYPE html>
<html>
<head>
    <title>Lightweight Charts Live BTC</title>
    <script src="/static/lightweight-charts.standalone.production.js"></script>
    <style>
        body { margin: 0; background: #131722; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden; }
        #chart { width: 50vw; height: 50vh; border: 2px solid #3b82f6; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); }
    </style>
</head>
<body>
    <div id="chart"></div>
    <script>
        const chart = LightweightCharts.createChart(document.getElementById('chart'), {
            width: Math.floor(window.innerWidth * 0.5),
            height: Math.floor(window.innerHeight * 0.5),
            layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#2b2b43' }, horzLines: { color: '#2b2b43' } },
            timeScale: { timeVisible: true, secondsVisible: false }
        });
        const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries);

        // 1. 바이낸스 REST API로 최근 100개 1분봉 가져오기
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100')
            .then(res => res.json())
            .then(klines => {
                const data = klines.map(k => ({
                    time: Math.floor(k[0] / 1000),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4])
                }));
                candleSeries.setData(data);

                // 2. 바이낸스 웹소켓으로 실시간 1분봉 구독
                const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
                ws.onmessage = (event) => {
                    const msg = JSON.parse(event.data);
                    const k = msg.k;
                    candleSeries.update({
                        time: Math.floor(k.t / 1000),
                        open: parseFloat(k.o),
                        high: parseFloat(k.h),
                        low: parseFloat(k.l),
                        close: parseFloat(k.c)
                    });
                };
            })
            .catch(err => console.error("데이터 로드 실패:", err));
    </script>
</body>
</html>
"""

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/static/"):
            filename = os.path.basename(self.path)
            local_path = os.path.join(r"C:\Users\kmj\Sellnance\static", filename)
            if os.path.exists(local_path):
                self.send_response(200)
                self.send_header("Content-type", "application/javascript")
                self.end_headers()
                with open(local_path, "rb") as f:
                    self.wfile.write(f.read())
                return
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML_CONTENT.encode("utf-8"))

print(f"Serving Lightweight Charts Test at http://localhost:{PORT}")
webbrowser.open(f"http://localhost:{PORT}")
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    httpd.serve_forever()
