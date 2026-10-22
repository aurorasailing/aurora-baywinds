/* PMYC hub — service worker  (hub + power-boat pre-session check)
 * ----------------------------------------------------------------------------
 * Caches the two app shells so they open and work with no signal:
 *   • the hub landing page   index.html
 *   • the power-boat check   PMYC-Powerboat-Check.html
 *   • the session review    PMYC-Session-Review.html
 * plus each one's web-app manifest. It is deliberately narrow: it only ever
 * serves those shells (and the manifests) from cache. Every other request — the
 * briefing / Quest / refuelling pages, the live data feeds, the fonts, and the
 * check-in POST — is left to the network untouched, so this worker is safe even
 * though its scope is the whole /PMYC/ folder. Both pages register this one
 * worker.
 *
 * Strategy: network-first for the shells, so a fresh deploy is picked up as soon
 * as there's signal; the cache is the offline fallback.
 *
 * WHEN YOU CHANGE EITHER APP: bump CACHE (e.g. v1.20 -> v1.21). On the next visit
 * with signal, the new worker installs, drops the old cache, and phones get the
 * fresh copy. Without a bump, installed phones keep serving the old one.
 */

var CACHE = 'pmyc-v1.20';

var HUB_URL   = new URL('./index.html', self.location).href;
var HUB_PATH  = new URL(HUB_URL).pathname;
var DIR_PATH  = new URL('./', self.location).pathname;          // /PMYC/  (opened as a bare folder)
var APP_URL   = new URL('./PMYC-Powerboat-Check.html', self.location).href;
var APP_PATH  = new URL(APP_URL).pathname;
var REV_URL   = new URL('./PMYC-Session-Review.html', self.location).href;
var REV_PATH  = new URL(REV_URL).pathname;
var HMAN_URL  = new URL('./manifest-hub.json', self.location).href;
var HMAN_PATH = new URL(HMAN_URL).pathname;
var MAN_URL   = new URL('./manifest.json', self.location).href;
var MAN_PATH  = new URL(MAN_URL).pathname;

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Manifests are nice-to-have; never let them fail the install.
      return c.addAll([HUB_URL, APP_URL, REV_URL, HMAN_URL, MAN_URL])
              .catch(function () { return c.addAll([HUB_URL, APP_URL, REV_URL]); });
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
  if      (url.pathname === APP_PATH)  key = APP_URL;                            // power-boat check
  else if (url.pathname === HUB_PATH)  key = HUB_URL;                            // hub (explicit index.html)
  else if (req.mode === 'navigate' && url.pathname === DIR_PATH) key = HUB_URL;  // hub (bare /PMYC/)
  else if (url.pathname === REV_PATH)  key = REV_URL;                            // session review
  else if (url.pathname === HMAN_PATH) key = HMAN_URL;                           // hub manifest
  else if (url.pathname === MAN_PATH)  key = MAN_URL;                            // power-boat manifest
  if (!key) return;                                     // everything else: straight to network

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key);
    })
  );
});
