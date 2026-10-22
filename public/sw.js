/* Talaqa service worker: app shell offline support.
 * - Navigations: network first, fall back to the cached shell.
 * - Same-origin assets (hashed by Vite): cache first.
 * - Google Fonts: stale-while-revalidate.
 */
const CACHE = 'talaqa-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './favicon.svg', './manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => {
          const network = fetch(req)
            .then((res) => {
              c.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || network;
        }),
      ),
    );
  }
});
