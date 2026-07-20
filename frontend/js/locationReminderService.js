const NOTIFICATION_PERMISSION_KEY = "caraNotificationPermissionRequested";

let activeWatchId = null;

export function distanceMeters(fromLat, fromLon, toLat, toLon) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(Number(toLat) - Number(fromLat));
  const dLon = toRadians(Number(toLon) - Number(fromLon));
  const lat1 = toRadians(Number(fromLat));
  const lat2 = toRadians(Number(toLat));
  const a = (
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  );
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

export function startLocationWatcher({ onPosition, onError }) {
  if (!navigator.geolocation) {
    onError(new Error("Geolocation is not supported by this browser."));
    return null;
  }

  stopLocationWatcher();

  activeWatchId = navigator.geolocation.watchPosition(
    onPosition,
    onError,
    {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000
    }
  );

  return activeWatchId;
}

export function stopLocationWatcher() {
  if (activeWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(activeWatchId);
  }
  activeWatchId = null;
}

export function canTriggerLocationReminder(reminder, latitude, longitude) {
  if (triggerMode(reminder) === "dwell") return false;
  return isLocationReminderInRange(reminder, latitude, longitude);
}

export function isLocationReminderInRange(reminder, latitude, longitude) {
  const type = String(reminder.trigger_type || reminder.type || "").toLowerCase();
  if (!type.includes("location")) return false;
  if (reminder.enabled === false || reminder.triggered === true) return false;
  if ((reminder.status || "pending") !== "pending") return false;
  if (reminder.latitude === undefined || reminder.longitude === undefined) return false;
  if (isSnoozed(reminder)) return false;

  const distance = distanceMeters(latitude, longitude, reminder.latitude, reminder.longitude);
  const radius = Number(reminder.radius || 100);
  return distance <= radius;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "true");
  return Notification.requestPermission();
}

export async function showLocationNotification(reminder) {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return false;
  }

  const place = reminder.placeName || reminder.location_name || reminder.location || "selected place";
  new Notification(reminder.title || reminder.task || "Reminder triggered", {
    body: `You are near ${place}.`,
    tag: reminder.id,
    renotify: false
  });
  return true;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function isSnoozed(reminder) {
  if (!reminder.snooze_until) return false;
  const snoozeUntil = new Date(reminder.snooze_until);
  return !Number.isNaN(snoozeUntil.getTime()) && snoozeUntil > new Date();
}

function triggerMode(reminder) {
  return String(reminder.trigger_mode || reminder.triggerMode || "near").toLowerCase();
}
