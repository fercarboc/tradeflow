const CACHE = 'tradeflow-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tradeflow_192.png',
  '/tradeflow_512.png',
  '/favicon.ico',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  self.clients.claim();
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  // No cachear llamadas a Supabase ni a otras APIs externas
  if (
    e.request.url.includes('supabase.co') ||
    e.request.url.includes('api.') ||
    e.request.method !== 'GET'
  ) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});
