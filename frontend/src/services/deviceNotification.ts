/**
 * Native Browser & Mobile Web Device Push Notifications Service
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

export function sendDeviceNotification(title: string, body: string, icon = "/favicon.ico") {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
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
    } catch (e) {
      console.warn("Could not dispatch device notification:", e);
    }
  }
}
