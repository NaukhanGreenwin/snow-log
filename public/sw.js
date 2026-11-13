/* Offline shell for Snow Log: the app opens with no signal (parking lots, back lanes).
   Pages: network first, cache fallback. Hashed _next/static assets and brand files: cache first.
   Query strings (?c=<company>) all map to the one cached shell. */
// Shares the itrapidsupport.github.io origin with the inspection apps: only ever touch caches named "snowlog-*".
const CACHE = "snowlog-v2";
const BASE = "/snow-log";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([`${BASE}/`, `${BASE}/brand/icon.png`, `${BASE}/manifest.webmanifest`])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("snowlog-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(`${BASE}/`, copy)); } return res; })
        .catch(() => caches.match(`${BASE}/`)),
    );
    return;
  }
  if (url.pathname.startsWith(`${BASE}/_next/`) || url.pathname.startsWith(`${BASE}/brand/`)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })));
  }
});
