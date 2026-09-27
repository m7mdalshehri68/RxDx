/* RxDx service worker.
   Scope is derived from where this file is served, so the same file works at a
   user site (user.github.io) and at a project site (user.github.io/rxdx/).

   The page and its reference tables come from the network whenever it answers,
   so a release reaches a returning visitor on their next load instead of the one
   after. The cache is what keeps the tool working when the network does not
   answer: offline, or slower than a few seconds. */
const CACHE = 'rxdx-v12';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];
const PATIENCE_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

function keep(c, req, resp) {
  if (resp && resp.ok && resp.type !== 'opaque') { try { c.put(req, resp.clone()); } catch (_) {} }
  return resp;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  /* the connectivity probe must reach the network or it proves nothing */
  if (url.searchParams.has('rxnet')) return;
  /* model weights are large and immutable, and other origins serve fixed
     library versions: cache first, forever */
  const isModel = /\.(onnx|onnx_data)$|tokenizer\.json$/.test(url.pathname);
  if (isModel || url.origin !== location.origin) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((hit) =>
      hit || fetch(e.request).then((resp) => keep(c, e.request, resp)))));
    return;
  }
  /* this site's own files: network first */
  e.respondWith(caches.open(CACHE).then((c) => {
    const cached = () => c.match(e.request).then((hit) =>
      hit || (e.request.mode === 'navigate' ? c.match('./') : undefined));
    const net = fetch(e.request).then((resp) => keep(c, e.request, resp));
    const slow = new Promise((r) => setTimeout(r, PATIENCE_MS))
      .then(cached).then((hit) => hit || net);
    return Promise.race([net.catch(cached), slow]);
  }));
});
