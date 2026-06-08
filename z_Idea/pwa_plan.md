# 📱 Sellnance PWA 구현 계획

## 개요
APK 없이 모바일에서 앱처럼 사용 가능하도록 PWA(Progressive Web App) 적용.
배포 후 HTTPS 환경에서 완전체 동작.

---

## 필요 파일

### 1. `static/manifest.json` [NEW]
```json
{
  "name": "Sellnance",
  "short_name": "Sellnance",
  "description": "실시간 암호화폐 스나이퍼",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#131313",
  "theme_color": "#131313",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/static/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/static/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2. `static/sw.js` [NEW] - Service Worker (선택)
```js
// 캐시 버전
const CACHE_NAME = 'sellnance-v1';
const STATIC_ASSETS = [
  '/',
  '/static/z_style.min.css',
  '/static/_main.js',
  '/static/PretendardVariable.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
```

### 3. `templates/index.html` `<head>` 추가 [MODIFY]
```html
<!-- PWA -->
<link rel="manifest" href="/static/manifest.json" />
<meta name="theme-color" content="#131313" />
<!-- iOS 지원 -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Sellnance" />
<link rel="apple-touch-icon" href="/static/icon-192.png" />
```

### 4. `static/_main.js` 하단 추가 [MODIFY]
```js
// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js')
      .then(reg => console.log('✅ SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}
```

---

## 아이콘 필요
- `static/icon-192.png` (192×192)
- `static/icon-512.png` (512×512)
- 현재 있는 SVG 파일(`_gemini-svg-dark.svg`)을 PNG로 변환하거나 별도 제작

---

## 배포 시 주의사항
- **HTTPS 필수**: PWA는 HTTPS 환경에서만 완전 동작 (로컬 localhost는 예외)
- service-worker가 없어도 홈화면 추가 + 풀스크린은 가능 (manifest.json만으로 충분)
- 배포 플랫폼: Render, Railway, Fly.io 등 자동 HTTPS 제공

---

## 구현 순서 (추후 개발 시)
1. 아이콘 PNG 2종 제작
2. `manifest.json` 생성 및 서버에서 `/static/manifest.json` 라우트 확인
3. `index.html` 메타태그 추가
4. (선택) `sw.js` 추가 및 등록
5. 배포 후 크롬 → 주소창 오른쪽 설치 아이콘 확인
