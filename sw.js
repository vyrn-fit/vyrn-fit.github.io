const CACHE = 'vyrn-v49';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/site.js',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/icon.png',
  '/assets/icon-192.png',
  '/assets/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Workout-guide images: network-first, cache OK responses only (avoid sticky broken cache)
  if (
    (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fastly.jsdelivr.net' || url.hostname === 'unpkg.com') &&
    url.pathname.includes('workout-guide')
  ) {
    e.respondWith(
      fetch(e.request, { mode: 'cors', credentials: 'omit' })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.open(CACHE).then((c) =>
            c.match(e.request).then((hit) => hit || Response.error())
          )
        )
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/app.js' ||
    url.pathname === '/site.js' ||
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json'
  ) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  if (url.pathname.match(/\.(mp4|webm|mov|mp3|wav|glb|gltf|png|jpg|jpeg|svg|webp|woff2?)(\?|$)/i)) {
    e.respondWith(
      caches.match(e.request).then((c) => c || fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
        }
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
