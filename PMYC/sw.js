/* PMYC pre-session check — service worker (offline app shell) */
var CACHE = 'pmyc-presession-v3';
var SHELL = ['./PMYC-Powerboat-Check.html', './PMYC-Refuelling.html', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // Never intercept the sync endpoint — it must always go to the network (and may fail offline).
  if (e.request.method !== 'GET' || url.hostname.indexOf('script.google') !== -1) return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () { return caches.match('./PMYC-Powerboat-Check.html'); });
    })
  );
});
