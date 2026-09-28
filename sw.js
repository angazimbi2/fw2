// FW2 Tank Ledger service worker.
// - App shell (index.html etc.): network-first, so a new version is picked up as soon
//   as the phone is online; falls back to the cached copy when offline.
// - Firebase / Leaflet scripts: stale-while-revalidate, so the app still opens offline.
// - Firestore, Auth and map tile requests are never touched.
// Bump CACHE_VERSION whenever you want to force every phone to drop old caches.
var CACHE_VERSION = 'v1';
var SHELL_CACHE = 'fw2-shell-' + CACHE_VERSION;
var LIB_CACHE = 'fw2-libs-' + CACHE_VERSION;
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(SHELL_CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== SHELL_CACHE && k !== LIB_CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isLib(url){
  return url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0 ||
         url.hostname === 'unpkg.com' && url.pathname.indexOf('/leaflet@') === 0;
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (isLib(url)) {
    e.respondWith(caches.open(LIB_CACHE).then(function(cache){
      return cache.match(req).then(function(hit){
        var fresh = fetch(req).then(function(res){ if (res && res.status === 200) cache.put(req, res.clone()); return res; }).catch(function(){ return hit; });
        return hit || fresh;
      });
    }));
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(function(res){
        if (res && res.status === 200) { var copy = res.clone(); caches.open(SHELL_CACHE).then(function(c){ c.put(req, copy); }); }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){ return hit || caches.match('./index.html'); });
      })
    );
  }
});
