/**
 * Service Worker — Natassha AI Health Coach
 * -----------------------------------------------------------------------
 * Strategy:
 *  - App shell (the pages themselves) + static assets: network-first with
 *    cache fallback, so users always get the latest build when online but
 *    the app still opens when offline.
 *  - Firestore/Firebase network calls are NEVER intercepted here — the
 *    Firestore SDK's own persistentLocalCache (see src/lib/firebase/config.ts)
 *    already handles offline reads/writes and sync far better than a
 *    service worker cache could for a live database.
 *  - Navigation requests that fail offline fall back to the cached
 *    dashboard shell so the app still boots into something usable.
 *
 * Bump CACHE_VERSION whenever this file or the precache list changes so
 * old caches get cleaned up on activate.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `natassha-shell-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("natassha-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isFirebaseRequest(url) {
  return (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasestorage.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("fcm.googleapis.com")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin API/Firebase traffic — let the Firebase
  // SDK's own offline queue own that entirely.
  if (url.origin !== self.location.origin || isFirebaseRequest(url)) {
    return;
  }

  // Only handle GET requests; mutations always go straight to network.
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("/dashboard");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    }),
  );
});

// Foreground/background push notifications (meal reminders, weigh-in
// nudges, etc.) are delivered via Firebase Cloud Messaging — see
// src/lib/firebase/messaging.ts for the client-side registration.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = payload.notification?.title || "Natassha AI Health Coach";
  const options = {
    body: payload.notification?.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
