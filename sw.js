// DS Wealth Tracker - Service Worker v3
const CACHE_NAME = 'ds-wealth-v3';

// Install - skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, no caching for JS/CSS
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Always fetch fresh for JS, CSS files
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // For external requests, network only
  if (url.origin !== location.origin) {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }
  
  // For HTML, network first
  event.respondWith(
    fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});