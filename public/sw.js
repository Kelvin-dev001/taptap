/**
 * Hornbill TapTap service worker.
 *
 * Deliberately minimal. A service worker is the single easiest way to ship a
 * bug that survives a deploy — a stale cache can pin users to an old build
 * with no way to recover — so this one takes the most conservative shape that
 * still earns its place:
 *
 *   - NETWORK FIRST for page navigations. The network always wins when it is
 *     available, so a published change is never masked by a cached copy.
 *   - Cache is a FALLBACK ONLY, used when the network fails. That is the real
 *     case this serves: a customer tapping a card on a weak connection, which
 *     in Kenya is an ordinary Tuesday rather than an edge case.
 *   - NOTHING AUTHENTICATED OR MUTABLE is ever cached: no /api, no /dashboard,
 *     no /print, and only GET.
 *
 * Bumping CACHE_VERSION discards every previous cache on activate.
 */

const CACHE_VERSION = "taptap-v1";
const OFFLINE_URL = "/offline";

/** Paths whose responses must never be stored. */
const NEVER_CACHE = ["/api/", "/dashboard", "/login", "/print/", "/auth"];

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return !NEVER_CACHE.some((path) => url.pathname.startsWith(path));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      // A failed pre-cache must not block installation; the worker is still
      // useful without the offline page.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return;

  // Page navigations: network first, cache as a fallback, offline page last.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((res) => res || Response.error()),
        ),
    );
    return;
  }

  // Build assets are content-hashed, so serving them from cache is safe and
  // makes a repeat tap noticeably faster on a slow connection.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
