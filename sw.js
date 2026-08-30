const CACHE = 'vyrn-v41';
const ASSETS = ['/', '/index.html', '/app.js', '/site.js', '/manifest.json', '/assets/logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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

  // External CDNs — network only
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell / JS — network-first so updates land quickly
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/app.js' ||
    url.pathname === '/site.js' ||
    url.pathname === '/sw.js'
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

  // Media — cache-first
  if (url.pathname.match(/\.(mp4|webm|mov|mp3|wav|glb|gltf|png|jpg|jpeg|svg|webp)(\?|$)/i)) {
    e.respondWith(
      caches.match(e.request).then((c) => c || fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copy));
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
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 504 });
      });
    })
  );
});
