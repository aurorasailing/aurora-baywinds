/* 1st Victorian Sea Scouts hub — service worker
 * ----------------------------------------------------------------------------
 * Caches the hub's own shell so it opens with no signal:
 *   • the hub landing page   index.html
 *   • its web-app manifest   manifest-hub.json
 * Deliberately narrow: it only ever serves the hub shell (and its manifest)
 * from cache. Every other request — any tool page added later, live data feeds,
 * fonts — is left to the network untouched, so this worker is safe even though
 * its scope is the whole /1stVic/ folder.
 *
 * Strategy: network-first for the shell, so a fresh deploy is picked up as soon
 * as there's signal; the cache is the offline fallback.
 *
 * WHEN YOU CHANGE THE HUB: bump CACHE (e.g. v1.0 -> v1.1). On the next visit
 * with signal the new worker installs, drops the old cache, and phones get the
 * fresh copy. Without a bump, installed phones keep serving the old one.
 */

var CACHE = '1stvic-v1.0';

var HUB_URL   = new URL('./index.html', self.location).href;
var HUB_PATH  = new URL(HUB_URL).pathname;
var DIR_PATH  = new URL('./', self.location).pathname;          // /1stVic/  (opened as a bare folder)
var HMAN_URL  = new URL('./manifest-hub.json', self.location).href;
var HMAN_PATH = new URL(HMAN_URL).pathname;

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll([HUB_URL, HMAN_URL]).catch(function () { return c.addAll([HUB_URL]); });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                     // never touch any POST
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // leave data feeds / fonts alone

  var key = null;
  if      (url.pathname === HUB_PATH)  key = HUB_URL;                            // hub (explicit index.html)
  else if (req.mode === 'navigate' && url.pathname === DIR_PATH) key = HUB_URL;  // hub (bare /1stVic/)
  else if (url.pathname === HMAN_PATH) key = HMAN_URL;                           // hub manifest
  if (!key) return;                                     // everything else: straight to network

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }); }
      return res;
    }).catch(function () { return caches.match(key); })
  );
});
