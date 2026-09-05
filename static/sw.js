const CACHE_NAME = "sellnance-v2";
const STATIC_ASSETS = [
  "/static/PretendardVariable.woff2",
];

// 서비스 워커 설치 즉시 활성화
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 구버전 캐시 즉시 소각
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// fetch 이벤트
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // 1. HTML 페이지 접속 및 API/웹소켓은 SW 캐싱 절대 금지 (항상 서버 최신 실시간 서빙)
  if (
    e.request.mode === "navigate" ||
    e.request.destination === "document" ||
    e.request.url.includes("/api/") ||
    e.request.url.includes("/ws")
  ) {
    return;
  }

  // 2. 정적 자산(폰트, 이미지 등)만 네트워크 우선 & 캐시 폴백
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
