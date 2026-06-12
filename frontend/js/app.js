import {
  createLocationReminder,
  deleteReminder,
  decideNotification,
  extractReminder,
  getApiBase,
  setApiBase,
  snoozeNotification,
  updateUserLocation
} from "./api.js";
import { ReminderInput } from "./components/ReminderInput.js";
import { ReminderPreview } from "./components/ReminderPreview.js";
import { MissingFieldsForm } from "./components/MissingFieldsForm.js";
import { LocationTracker } from "./components/LocationTracker.js";
import { NotificationCard } from "./components/NotificationCard.js";
import { ReminderList } from "./components/ReminderList.js";

const state = {
  currentReminder: null,
  reminders: loadReminders(),
  notification: loadNotification(),
  snoozeMinutes: 10,
  location: {
    active: false,
    watchId: null,
    latitude: null,
    longitude: null,
    message: ""
  },
  context: {
    activity: "unknown",
    battery_level: 100
  }
};

const roots = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  statusBanner: document.querySelector("#statusBanner"),
  reminderInput: document.querySelector("#reminderInput"),
  reminderPreview: document.querySelector("#reminderPreview"),
  missingFieldsForm: document.querySelector("#missingFieldsForm"),
  locationTracker: document.querySelector("#locationTracker"),
  notificationCard: document.querySelector("#notificationCard"),
  reminderList: document.querySelector("#reminderList")
};

roots.apiBaseInput.value = getApiBase();
roots.apiBaseInput.addEventListener("change", () => {
  setApiBase(roots.apiBaseInput.value);
  showStatus("API base URL updated.", "success");
});

const components = {};

components.reminderInput = ReminderInput(roots.reminderInput, {
  onSubmit: handleExtract
});

components.reminderPreview = ReminderPreview(roots.reminderPreview, {
  getReminder: () => state.currentReminder,
  onChange: setCurrentReminder,
  onConfirm: handleConfirmReminder
});

components.missingFieldsForm = MissingFieldsForm(roots.missingFieldsForm, {
  getReminder: () => state.currentReminder,
  onUpdate: setCurrentReminder
});

components.locationTracker = LocationTracker(roots.locationTracker, {
  onStart: startLocationTracking,
  onStop: stopLocationTracking,
  getLocationState: () => state.location
});

components.notificationCard = NotificationCard(roots.notificationCard, {
  getNotification: () => state.notification,
  getSnoozeMinutes: () => state.snoozeMinutes,
  onDone: handleDone,
  onSnooze: handleSnooze,
  onEditSnooze: handleEditSnooze,
  onCancel: handleCancel,
  onSnoozeChange: (minutes) => {
    state.snoozeMinutes = minutes;
  }
});

components.reminderList = ReminderList(roots.reminderList, {
  getReminders: getSortedReminders,
  onDelete: handleDeleteReminder
});

setInterval(checkTimeReminders, 30000);
setTimeout(checkTimeReminders, 1000);

async function handleExtract(text) {
  if (!text) {
    showStatus("Type a reminder before extracting.", "error");
    return;
  }

  showStatus("Extracting reminder details...");
  try {
    const reminder = await extractReminder(text);
    if (reminder.error) {
      throw new Error(reminder.error);
    }
    setCurrentReminder(withClientId(reminder));
    showStatus("Reminder extracted. Review the details before confirming.", "success");
  } catch (error) {
    showStatus(`Extraction failed: ${error.message}`, "error");
  }
}

async function handleConfirmReminder() {
  const reminder = state.currentReminder;
  if (!reminder) return;

  const missingFields = reminder.missing_fields || [];
  if (missingFields.length) {
    showStatus("Please answer the follow-up fields before saving.", "error");
    return;
  }

  let savedReminder = {
    ...reminder,
    status: "pending",
    notification_time: resolveClientNotificationTime(reminder.raw_time || reminder.time) || reminder.notification_time
  };

  try {
    if (savedReminder.trigger_type === "location" && savedReminder.location) {
      const result = await createLocationReminder(savedReminder);
      if (result?.reminder) {
        savedReminder = { ...savedReminder, ...result.reminder };
      }
    }

    upsertReminder(savedReminder);
    clearCurrentReminder();
    showStatus("Reminder saved as pending. CARA will notify you when it is triggered.", "success");
    alert("Your reminder has been set.");
  } catch (error) {
    upsertReminder(savedReminder);
    clearCurrentReminder();
    showStatus(`Saved locally, but backend save failed: ${error.message}`, "error");
    alert("Your reminder has been set locally, but backend save failed.");
  }
}

async function triggerReminder(reminder) {
  if (!reminder) {
    return;
  }

  const triggeredReminder = {
    ...reminder,
    status: "triggered"
  };
  upsertReminder(triggeredReminder);
  const context = await readContext();

  try {
    const decision = await decideNotification(triggeredReminder, context);
    setNotification({
      ...decision,
      reminder: triggeredReminder,
      editingSnooze: false,
      decidedAt: new Date().toLocaleString()
    });
    showStatus("Reminder triggered. Agent 4 decision is shown in the popup.", "success");
  } catch (error) {
    setNotification({
      ...fallbackDecision(triggeredReminder, context),
      reminder: triggeredReminder,
      editingSnooze: false,
      decidedAt: new Date().toLocaleString(),
      message: `Local fallback shown because Agent 4 endpoint failed: ${error.message}`
    });
    showStatus("Agent 4 endpoint failed, so a local fallback decision is displayed.", "error");
  }

  renderAll();
}

async function startLocationTracking() {
  if (!navigator.geolocation) {
    state.location.message = "Geolocation is not supported by this browser.";
    renderAll();
    return;
  }

  state.location.message = "Waiting for location permission...";
  renderAll();

  state.location.watchId = navigator.geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      state.location = {
        ...state.location,
        active: true,
        latitude,
        longitude,
        message: "Live location is being sent to the backend."
      };
      renderAll();

      try {
        const result = await updateUserLocation(latitude, longitude);
        if (Array.isArray(result.triggered) && result.triggered.length) {
          const triggeredReminder = normalizeLocationReminder(result.triggered[0]);
          await triggerReminder(triggeredReminder);
        }
      } catch (error) {
        showStatus(`Location update failed: ${error.message}`, "error");
      }
    },
    (error) => {
      state.location.active = false;
      state.location.message = error.message;
      renderAll();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000
    }
  );
}

function stopLocationTracking() {
  if (state.location.watchId !== null) {
    navigator.geolocation.clearWatch(state.location.watchId);
  }

  state.location = {
    active: false,
    watchId: null,
    latitude: state.location.latitude,
    longitude: state.location.longitude,
    message: "Location tracking stopped."
  };
  renderAll();
}

function handleDone() {
  updateReminderStatus("completed");
  clearNotification();
  showStatus("Reminder marked done.", "success");
  renderAll();
}

async function handleSnooze() {
  const reminderId = state.notification?.reminder?.id;
  const minutes = state.snoozeMinutes || 10;

  if (!reminderId) {
    showStatus("This reminder has no ID for snoozing.", "error");
    return;
  }

  try {
    const result = await snoozeNotification(reminderId, minutes);
    setNotification({
      ...state.notification,
      ...result,
      action: result.action || "snooze",
      editingSnooze: false
    });
    snoozeCurrentReminder(minutes);
    clearNotification();
    showStatus(`Reminder snoozed for ${minutes} minutes.`, "success");
  } catch (error) {
    showStatus(`Snooze failed: ${error.message}`, "error");
  }

  renderAll();
}

function handleEditSnooze() {
  if (!state.notification) return;
  state.notification.editingSnooze = !state.notification.editingSnooze;
  saveNotification();
  renderAll();
}

function handleCancel() {
  updateReminderStatus("cancelled");
  clearNotification();
  showStatus("Reminder cancelled.", "success");
  renderAll();
}

function setCurrentReminder(reminder) {
  state.currentReminder = withClientId(reminder);
  renderAll();
}

function clearCurrentReminder() {
  state.currentReminder = null;
  renderAll();
}

function withClientId(reminder) {
  return {
    id: reminder.id || reminder.reminder_id || crypto.randomUUID(),
    intent: "reminder",
    entities: [],
    ...reminder
  };
}

function upsertReminder(reminder) {
  const index = state.reminders.findIndex((item) => item.id === reminder.id);
  if (index >= 0) {
    state.reminders[index] = reminder;
  } else {
    state.reminders.unshift(reminder);
  }
  saveReminders();
  renderAll();
}

function updateReminderStatus(status) {
  const reminder = state.notification?.reminder;
  if (!reminder) return;

  const updated = { ...reminder, status };
  state.notification.reminder = updated;
  saveNotification();
  upsertReminder(updated);
}

function snoozeCurrentReminder(minutes) {
  const reminder = state.notification?.reminder;
  if (!reminder) return;

  const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
  const updated = {
    ...reminder,
    status: "pending",
    snooze_until: snoozeUntil
  };
  upsertReminder(updated);
}

function setNotification(notification) {
  state.notification = notification;
  saveNotification();
}

function clearNotification() {
  state.notification = null;
  localStorage.removeItem("caraNotification");
}

async function readContext() {
  let batteryLevel = 100;
  if (navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      batteryLevel = Math.round(battery.level * 100);
    } catch {
      batteryLevel = 100;
    }
  }

  return {
    ...state.context,
    battery_level: batteryLevel,
    location: {
      latitude: state.location.latitude,
      longitude: state.location.longitude
    }
  };
}

function fallbackDecision(reminder, context) {
  const priority = String(reminder.priority || "medium").toLowerCase();
  const activity = String(context.activity || "unknown").toLowerCase();

  if (priority === "high") return { action: "notify_now" };
  if (activity === "driving") return { action: "delay", delay_minutes: 15 };
  if (activity === "meeting") return { action: "delay", delay_minutes: 30 };
  if (activity === "sleeping") return { action: "delay", delay_minutes: 60 };
  if ((context.battery_level || 100) < 5) return { action: "delay", delay_minutes: 20 };
  return { action: "notify_now" };
}

function checkTimeReminders() {
  if (state.notification) return;

  const now = new Date();
  const dueReminder = state.reminders.find((reminder) => {
    if ((reminder.status || "pending") !== "pending") return false;
    if (reminder.trigger_type !== "time") return false;

    if (reminder.snooze_until) {
      return new Date(reminder.snooze_until) <= now;
    }

    const dueAt = getReminderDueDate(reminder);
    return dueAt ? dueAt <= now : false;
  });

  if (dueReminder) {
    triggerReminder(dueReminder);
  }
}

function getReminderDueDate(reminder) {
  if (!reminder.date) return null;

  const time = reminder.notification_time || resolveClientNotificationTime(reminder.raw_time || reminder.time);
  if (!time) return null;

  const dueAt = new Date(`${reminder.date}T${time}:00`);
  return Number.isNaN(dueAt.getTime()) ? null : dueAt;
}

function resolveClientNotificationTime(rawTime = "") {
  const normalized = String(rawTime).toLowerCase().trim();
  const defaultTimes = {
    morning: "09:00",
    afternoon: "13:00",
    "after noon": "13:00",
    evening: "18:00",
    night: "21:00",
    tonight: "21:00",
    noon: "12:00"
  };

  if (defaultTimes[normalized]) return defaultTimes[normalized];

  const parsed = new Date(`1970-01-01 ${rawTime}`);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

async function handleDeleteReminder(reminderId) {
  state.reminders = state.reminders.filter((reminder) => reminder.id !== reminderId);
  saveReminders();

  if (state.notification?.reminder?.id === reminderId) {
    clearNotification();
  }

  renderAll();

  try {
    await deleteReminder(reminderId);
    showStatus("Reminder removed from the list and backend store.", "success");
  } catch (error) {
    showStatus(`Reminder removed locally. Backend delete did not find it: ${error.message}`, "error");
  }
}

function getSortedReminders() {
  const priorityOrder = {
    high: 0,
    medium: 1,
    low: 2
  };

  return [...state.reminders].sort((a, b) => {
    const aPriority = priorityOrder[String(a.priority || "medium").toLowerCase()] ?? 1;
    const bPriority = priorityOrder[String(b.priority || "medium").toLowerCase()] ?? 1;
    return aPriority - bPriority;
  });
}

function normalizeLocationReminder(reminder) {
  const existing = state.reminders.find((item) => item.id === reminder.id);
  return {
    ...existing,
    ...reminder,
    location: reminder.location || reminder.location_name || existing?.location || "",
    trigger_type: "location",
    status: "triggered"
  };
}

function showStatus(message, type = "") {
  roots.statusBanner.hidden = false;
  roots.statusBanner.textContent = message;
  roots.statusBanner.className = `status-banner ${type}`.trim();
}

function renderAll() {
  components.reminderPreview.render();
  components.missingFieldsForm.render();
  components.locationTracker.render();
  components.notificationCard.render();
  components.reminderList.render();
}

function loadReminders() {
  try {
    return JSON.parse(localStorage.getItem("caraReminders") || "[]");
  } catch {
    return [];
  }
}

function saveReminders() {
  localStorage.setItem("caraReminders", JSON.stringify(state.reminders));
}

function loadNotification() {
  try {
    return JSON.parse(localStorage.getItem("caraNotification") || "null");
  } catch {
    return null;
  }
}

function saveNotification() {
  if (!state.notification) {
    localStorage.removeItem("caraNotification");
    return;
  }

  localStorage.setItem("caraNotification", JSON.stringify(state.notification));
}
