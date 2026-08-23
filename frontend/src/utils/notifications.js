// Thin wrapper around the browser Notification API. Callers are expected to
// have already checked `notificationsEnabled` (user preference) — this just
// adds the permission/support guards and keeps click-to-focus behavior
// consistent between private and group chat.
export function showDesktopNotification(title, { body, icon, tag } = {}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  try {
    const notification = new Notification(title, { body, icon, tag });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers (mostly mobile) throw on `new Notification(...)` and
    // require a service worker instead — silently skip rather than crash
    // the message-receive path over a non-essential feature.
  }
}
