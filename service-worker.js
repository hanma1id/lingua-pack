/* ============================================================
 * service-worker.js — Lingua Pack 오프라인 캐시 (network-first)
 * ------------------------------------------------------------
 *  vocab-roots 교훈 반영
 *   - cache-first면 CSS·JS 변경 즉시 반영 안 되는 문제 잦음
 *   - network-first면 최신 코드 항상 받고, 오프라인일 때만 캐시
 *  CACHE_VERSION을 변경할 때마다 sync_index.py가 자동 갱신
 * ============================================================ */

const CACHE_VERSION = "lingua-pack-v17-2026-06-21";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./home.html",
  "./category.html",
  "./travel.html",
  "./manifest.json",
  "./css/style.css",
  "./js/lang-select.js",
  "./js/home.js",
  "./js/category.js",
  "./js/travel.js",
  "./js/data-loader.js",
  "./js/tts.js",
  "./js/flashcard.js",
  "./js/practice.js",
  "./js/pron-render.js",
  "./data/languages.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(CORE_ASSETS.map((u) =>
        cache.add(u).catch((err) => console.warn("[SW] cache miss", u, err))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, cloned));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || new Response("", { status: 504, statusText: "오프라인" })
        )
      )
  );
});
