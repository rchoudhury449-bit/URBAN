
/* Urban service worker.
   Pages: network first, cache as offline backup.
   Update CACHE version whenever needed to refresh cached files. */

var CACHE = "urban-v3";

var CORE = [
  "./",
  "index.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        return Promise.all(
          CORE.map(function (u) {
            return c.add(u).catch(function () {});
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  if (req.method !== "GET") return;

  var url = new URL(req.url);

  // External resources, including Google Sheets, go directly to the network.
  if (url.origin !== self.location.origin) return;

  // HTML pages: network first, cached page as offline fallback.
  if (
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") > -1
  ) {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (r) {
            return r || caches.match("index.html");
          });
        })
    );
    return;
  }

  // Other same-origin files: cache first, then network.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          });
        }
        return res;
      });
    })
  );
});
