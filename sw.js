//name for Cache
const CACHE = 'saldotarjeta-v5';
// files temporaily stored in the device to make the app work offline
const ARCHIVOS = ['./index.html','./style.css','./script.js','./manifest.json'];

// event executed a once when the service worker is installed, used to cache files
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});
// event executed when the service worker is alredy installed.
//-Select recent upgrade and delete old versións for CACHE
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
// Cada vez que el navegador solicta un recurso,  se proporciona el recurso :
//  primero se busca en la CACHE, si está lo proporciona, en otro caso
// lo solicita al servidor (github).
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
