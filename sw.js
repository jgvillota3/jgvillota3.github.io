// Service worker: guarda la app para abrir rápido y sin conexión. Los datos siempre vienen de Google.
const CACHE = 'home-v1';
const ASSETS = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/config.js', 'js/google.js', 'js/data.js', 'js/demo.js', 'js/util.js', 'js/core.js', 'js/icons.js',
  'js/views/hoy.js', 'js/views/finanzas.js', 'js/views/agenda.js', 'js/views/wellness.js', 'js/views/pendientes.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
