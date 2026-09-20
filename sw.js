/* Cache only this application's public static assets, never API responses. */
const CACHE = 'rxdx-public-v12';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg',
  './upgrade.css', './upgrade-ui.js', './data/icd-1.js', './data/idf-1.js', './data/idf-2.js'];
const scope = new URL(self.registration.scope);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('rxdx-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scope.origin ||
      !url.pathname.startsWith(scope.pathname) || url.search) return;
  const relative = './' + url.pathname.slice(scope.pathname.length);
  if (!SHELL.includes(relative)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque') await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      return cached || new Response('Offline asset unavailable. Reconnect and reload.', { status: 503 });
    }
  }));
});