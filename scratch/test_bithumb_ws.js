const WebSocket = require('ws');
const ws = new WebSocket('wss://pubwss.bithumb.com/pub/ws');

ws.on('open', () => {
  console.log('Connected to Bithumb WS');
  ws.send(JSON.stringify({
    type: 'orderbook',
    symbols: ['BTC_KRW']
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});
