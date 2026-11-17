/* Ma Habbit service worker.
   - Halaman: ambil yang terbaru kalau online, pakai cache kalau offline.
   - File statis lain: cache dulu, diperbarui di belakang layar.
   - Font Google: disimpan setelah kunjungan online pertama, jadi tetap muncul saat offline.
   Service worker ini TIDAK menyentuh data habit (localStorage / IndexedDB).
   Naikkan VERSION hanya kalau daftar file di bawah atau ikon berubah. */
const VERSION = 'v2';
const APP = 'mahabbit-app-' + VERSION;
const FONTS = 'mahabbit-fonts-v1';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== FONTS && k.indexOf('mahabbit-') === 0).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, cacheName, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'));
    const timer = setTimeout(() => {
      fromCache().then((r) => { if (r && !done) { done = true; resolve(r); } });
    }, timeoutMs);
    fetch(req).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(cacheName).then((c) => c.put(req, copy)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((r) => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, APP, 4000));
    return;
  }
  e.respondWith(staleWhileRevalidate(req, APP));
});
