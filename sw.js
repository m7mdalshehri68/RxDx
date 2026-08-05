/* RxDx service worker.
   Scope is derived from where this file is served, so the same file works at a
   user site (user.github.io) and at a project site (user.github.io/rxdx/). */
const CACHE = 'rxdx-v11';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  /* the connectivity probe must reach the network or it proves nothing */
  if (url.searchParams.has('rxnet')) return;
  /* model weights are large and immutable — cache first, forever */
  const isModel = /\.(onnx|onnx_data)$|tokenizer\.json$/.test(url.pathname);
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(e.request).then((hit) => {
        if (hit && (isModel || url.origin !== location.origin)) return hit;
        const net = fetch(e.request).then((resp) => {
          if (resp && resp.ok && resp.type !== 'opaque') { try { c.put(e.request, resp.clone()); } catch (_) {} }
          return resp;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
