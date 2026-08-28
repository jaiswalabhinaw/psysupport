/* PsySupport service worker.
 *
 * Deliberately conservative: the site is a set of static pages that get
 * edited often, and a cache-first worker would pin visitors to a stale
 * copy for days. So every request goes to the network first and only
 * falls back to cache when the network fails. The cache exists to keep
 * the diary usable offline, not to make the site faster.
 *
 * Bump CACHE when the shell changes; old caches are dropped on activate.
 */
var CACHE = "psysupport-v1";

var SHELL = [
  "engagement.html",
  "style.css",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      // A failed precache must not block activation — the worker is still
      // useful, it just starts with an empty cache.
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  // Only ever handle our own GETs. Anything cross-origin (fonts, WhatsApp)
  // is left entirely to the browser.
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match("engagement.html");
      });
    })
  );
});
