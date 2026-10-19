/* PMYC Power Boat — Pre-Session Check · service worker
 * ----------------------------------------------------------------------------
 * Caches this one app so it opens and works with no signal. It is deliberately
 * narrow: it only ever serves its OWN page and manifest from cache. Every other
 * request — the other PMYC pages (hub, briefing, Quest, refuelling), the live
 * data feeds, and the check-in POST — is left to the network untouched, so this
 * worker is safe even though its scope is the whole /PMYC/ folder.
 *
 * Strategy: network-first for the app shell, so a fresh deploy is picked up as
 * soon as there's signal; the cache is the offline fallback.
 *
 * WHEN YOU CHANGE THE APP: bump CACHE (e.g. v1.4 -> v1.5). On the next visit
 * with signal, the new worker installs, drops the old cache, and phones get the
 * fresh copy. Without a bump, installed phones keep serving the old one.
 */

var CACHE = 'pmyc-powerboat-v1.4';

var APP_URL  = new URL('./PMYC-Powerboat-Check.html', self.location).href;
var APP_PATH = new URL(APP_URL).pathname;
var MAN_URL  = new URL('./manifest.json', self.location).href;
var MAN_PATH = new URL(MAN_URL).pathname;

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Manifest is a nice-to-have; never let it fail the install.
      return c.addAll([APP_URL, MAN_URL]).catch(function () { return c.add(APP_URL); });
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
  if (req.method !== 'GET') return;                     // never touch the check-in POST
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // leave data feeds / fonts alone

  var key = null;
  if (url.pathname === APP_PATH) key = APP_URL;         // the app page (with or without query)
  else if (req.mode === 'navigate' && url.pathname === APP_PATH) key = APP_URL;
  else if (url.pathname === MAN_PATH) key = MAN_URL;
  if (!key) return;                                     // everything else: straight to network

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) { return hit || caches.match(APP_URL); });
    })
  );
});
