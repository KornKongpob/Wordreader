// WordReader Service Worker — cache only immutable/static assets.
const CACHE_NAME = "wordreader-static-v2";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function isCacheableStaticAsset(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (request.mode === "navigate" || request.destination === "document") {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    STATIC_ASSETS.includes(url.pathname) ||
    ["image", "script", "style", "font"].includes(request.destination)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isCacheableStaticAsset(event.request, url)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});
