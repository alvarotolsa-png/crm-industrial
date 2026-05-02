// CRM Industrial — Service Worker
// Versión del caché — actualiza este número cuando cambies archivos
const CACHE_NAME = 'crm-industrial-v1';

// Archivos a cachear para uso offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Librerías CDN
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// Instalación: pre-cachear todos los assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-cacheando assets...');
      // Cachear assets locales primero
      const localAssets = ASSETS.filter(url => !url.startsWith('http'));
      return cache.addAll(localAssets).then(() => {
        // Intentar cachear CDN (no falla si no hay red)
        const cdnAssets = ASSETS.filter(url => url.startsWith('http'));
        return Promise.allSettled(cdnAssets.map(url => cache.add(url)));
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: estrategia Cache-First con fallback a red
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Servir desde caché y actualizar en segundo plano
        const fetchUpdate = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => {});
        return cached;
      }
      // No está en caché, ir a la red
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return response;
      }).catch(() => {
        // Sin red y sin caché: mostrar página offline si hay
        return caches.match('./index.html');
      });
    })
  );
});
