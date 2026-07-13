const CACHE_NAME = "sellnance-v1";
const STATIC_ASSETS = [
  "/",
  "/static/z_style.min.css",
  "/static/PretendardVariable.woff2",
];

// 서비스 워커 설치 및 캐싱
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 자원 요청 시 캐시 우선 혹은 네트워크 폴백
self.addEventListener("fetch", (e) => {
  // POST 요청, WebSocket, API 요청 등은 캐싱하지 않음
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
