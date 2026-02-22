// ─── SkyCast Service Worker ────────────────────────────────────────────────────
const CACHE_NAME = 'skycast-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/api.js',
    './js/utils.js',
    './js/charts.js',
    './js/maps.js',
    './js/app.js',
];

// Install — cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network-first for API, cache-first for assets
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // External CDN / APIs: network first, no cache fallback
    if (url.includes('open-meteo.com') || url.includes('nominatim') || url.includes('rainviewer')) {
        event.respondWith(
            fetch(event.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
        );
        return;
    }

    // Static assets: cache first
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
