const CACHE_NAME = "sichai-pani-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Lock-Screen & Native Device Notification Handler
self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : { title: "💧 Sichai Pani Alert", body: "New water request or system update received!" };

  const options = {
    body: data.body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [300, 100, 300, 100, 300],
    tag: "sichai-pani-lockscreen-alert",
    renotify: true,
    requireInteraction: true, // Remains on lock screen until dismissed
    timestamp: Date.now(),
    data: {
      url: "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow("/");
    })
  );
});
