const CACHE = 'sabo-cale-v1';

// インストール時にシェルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/']))
  );
  self.skipWaiting();
});

// 古いキャッシュを掃除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-While-Revalidate 戦略
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // GET 以外、外部オリジン、Google API はスルー
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached); // オフライン時はキャッシュを返す

      return cached || fetchPromise;
    })
  );
});
