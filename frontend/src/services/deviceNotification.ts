/**
 * Native Lock-Screen & Mobile Web Device Push Notifications Service
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop/device notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function sendDeviceNotification(title: string, body: string, icon = "/favicon.svg") {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      // Use Service Worker for persistent lock-screen notifications if available
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            vibrate: [300, 100, 300, 100, 300],
            requireInteraction: true, // Keeps notification visible on lock screen
            tag: "sichai-pani-lockscreen-alert",
            renotify: true,
          } as any);
        });
      } else {
        const n = new Notification(title, {
          body,
          icon,
          badge: icon,
          tag: "sichai-pani-alert",
        });

        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    } catch (e) {
      console.warn("Could not dispatch device notification:", e);
    }
  }
}
