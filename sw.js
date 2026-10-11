'use strict';

/* Network-first, cache-as-you-go. Every successful same-origin GET
   refreshes the cache under its own exact URL; offline (or a failed
   fetch) falls back to whatever was last cached, or to index.html as
   a last resort so the app shell still loads. This needs no static
   precache list to keep in sync with deploy-time cache-busting
   (index.html, app.js, style.css, the data/*.js and hanja.json all
   get a ?v=<sha> query string on every deploy — see
   .github/workflows/deploy-pages.yml — so each deploy's files are
   already their own distinct cache keys; a stale old-URL entry just
   sits unused, cleared out whenever CACHE below is bumped).

   External requests (Google Fonts, the hanzi-writer CDN) are left
   alone — stroke order already falls back to a static glyph when
   that CDN is unreachable, same as offline. */

var CACHE = 'kbh-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(function(res) {
      var resClone = res.clone();
      caches.open(CACHE).then(function(cache) { cache.put(e.request, resClone); });
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
