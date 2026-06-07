const CACHE = 'saldotarjeta-v6';
const ARCHIVOS = [
  './index.html',
  './style.css',
  './manifest.json',
  './js/main.js',
  './js/state.js',
  './js/calculos.js',
  './js/automaticos.js',
  './js/render.js',
  './js/acciones.js',
  './js/modales.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
