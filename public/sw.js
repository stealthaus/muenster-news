// App shell cache-first, news.json network-first with the last copy as offline fallback.
// Bump VERSION to drop old caches after larger changes.
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const DATA = `data-${VERSION}`;
const IMAGES = `images-${VERSION}`;
const PRECACHE = ['./', './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png'];
const IMAGE_HOSTS = ['www.antennemuenster.de'];
const MAX_IMAGES = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Marks a cached answer so the app can show "Offline". */
async function markCached(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Served-From', 'cache');
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers });
}

async function networkFirst(request, cacheName, mark) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return mark ? markCached(hit) : hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') {
    await cache.put(request, res.clone());
    if (limit) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((k) => cache.delete(k)));
    }
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, false).catch(() => caches.match('./')));
  } else if (url.origin === self.location.origin && url.pathname.endsWith('/data/news.json')) {
    event.respondWith(networkFirst(request, DATA, true));
  } else if (url.origin === self.location.origin) {
    // Built assets have hashed names, so cache-first is safe.
    event.respondWith(cacheFirst(request, SHELL));
  } else if (IMAGE_HOSTS.includes(url.hostname) && request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
  }
});
