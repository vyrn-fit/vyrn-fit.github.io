const CACHE = 'vyrn-v46';
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

  // Workout-guide CDN — cache-first (immutable versioned assets)
  if (
    url.hostname === 'cdn.jsdelivr.net' &&
    url.pathname.includes('@bryllim/workout-guide')
  ) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((hit) => {
          if (hit) return hit;
          return fetch(e.request, { mode: 'cors' }).then((res) => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(() => hit || Response.error());
        })
      )
    );
    return;
  }

  // Supabase & other third-party — network only (auth/API)
  if (url.origin !== self.location.origin) {
    return; // default browser fetch
  }

  // App shell — network-first so deploys show up quickly
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
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Local media — cache-first
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
