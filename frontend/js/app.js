import {
  cancelReminder,
  checkTimeReminders as checkDueTimeReminders,
  completeReminder,
  createCurrentLocationReminder,
  createReminder,
  deleteReminder,
  decideNotification,
  extractReminder,
  fetchReminders,
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
import { DashboardSummary } from "./components/DashboardSummary.js";

const state = {
  currentReminder: null,
  reminders: [],
  notification: null,
  snoozeMinutes: 10,
  location: {
    active: false,
    watchId: null,
    latitude: null,
    longitude: null,
    message: ""
  }
};

const roots = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  statusBanner: document.querySelector("#statusBanner"),
  dashboardSummary: document.querySelector("#dashboardSummary"),
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
  refreshReminders();
});

const components = {};

components.reminderInput = ReminderInput(roots.reminderInput, {
  onSubmit: handleExtract
});

components.dashboardSummary = DashboardSummary(roots.dashboardSummary, {
  getReminders: () => state.reminders
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
  getReminders: () => state.reminders,
  onDelete: handleDeleteReminder
});

refreshReminders();
setInterval(pollTimeReminders, 30000);
setTimeout(pollTimeReminders, 1000);

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
    setCurrentReminder(reminder);
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

  const savedReminder = {
    ...reminder,
    status: "pending"
  };

  try {
    const result = await saveReminderToBackend(savedReminder);
    if (result?.reminder) {
      upsertReminder(result.reminder);
    }
    await refreshReminders();
    clearCurrentReminder();
    showStatus("Reminder saved as pending. CARA will notify you when it is triggered.", "success");
    alert("Your reminder has been set.");
  } catch (error) {
    showStatus(`Reminder save failed: ${error.message}`, "error");
    alert("Reminder could not be saved. Please check the backend and try again.");
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
    state.notification = {
      ...decision,
      reminder: triggeredReminder,
      editingSnooze: false,
      decidedAt: new Date().toLocaleString()
    };
    showStatus("Reminder triggered. Agent 4 decision is shown in the popup.", "success");
  } catch (error) {
    showStatus(`Agent 4 decision failed: ${error.message}`, "error");
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
  updateActiveReminderStatus("completed");
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
    if (result?.reminder) {
      upsertReminder(result.reminder);
    }
    clearNotification();
    await refreshReminders();
    showStatus(`Reminder snoozed for ${minutes} minutes.`, "success");
  } catch (error) {
    showStatus(`Snooze failed: ${error.message}`, "error");
  }

  renderAll();
}

function handleEditSnooze() {
  if (!state.notification) return;
  state.notification.editingSnooze = !state.notification.editingSnooze;
  renderAll();
}

function handleCancel() {
  updateActiveReminderStatus("cancelled");
}

function setCurrentReminder(reminder) {
  state.currentReminder = reminder;
  renderAll();
}

function clearCurrentReminder() {
  state.currentReminder = null;
  renderAll();
}

function upsertReminder(reminder) {
  const index = state.reminders.findIndex((item) => item.id === reminder.id);
  if (index >= 0) {
    state.reminders[index] = reminder;
  } else {
    state.reminders.unshift(reminder);
  }
  renderAll();
}

async function saveReminderToBackend(reminder) {
  if (
    reminder.trigger_type === "location" &&
    state.location.latitude !== null &&
    state.location.longitude !== null &&
    !reminder.location
  ) {
    return createCurrentLocationReminder(
      {
        ...reminder,
        location: "current location"
      },
      state.location.latitude,
      state.location.longitude
    );
  }

  return createReminder(reminder);
}

async function refreshReminders() {
  try {
    const result = await fetchReminders();
    state.reminders = result.reminders || [];
    renderAll();
  } catch (error) {
    showStatus(`Could not load reminders: ${error.message}`, "error");
  }
}

async function updateActiveReminderStatus(status) {
  const reminder = state.notification?.reminder;
  if (!reminder) return;

  try {
    const result = status === "completed"
      ? await completeReminder(reminder.id)
      : await cancelReminder(reminder.id);

    if (result?.reminder) {
      upsertReminder(result.reminder);
    }
    clearNotification();
    await refreshReminders();
    showStatus(status === "completed" ? "Reminder marked done." : "Reminder cancelled.", "success");
  } catch (error) {
    showStatus(`Could not update reminder status: ${error.message}`, "error");
  }

  renderAll();
}

function clearNotification() {
  state.notification = null;
}

async function readContext() {
  return {
    activity: "unknown",
    battery_level: 100,
    location: {
      latitude: state.location.latitude,
      longitude: state.location.longitude
    }
  };
}

async function pollTimeReminders() {
  if (state.notification) return;

  try {
    const result = await checkDueTimeReminders();
    if (Array.isArray(result.triggered) && result.triggered.length) {
      await refreshReminders();
      triggerReminder(result.triggered[0]);
    }
  } catch (error) {
    showStatus(`Time reminder check failed: ${error.message}`, "error");
  }
}

async function handleDeleteReminder(reminderId) {
  if (state.notification?.reminder?.id === reminderId) {
    clearNotification();
  }

  try {
    await deleteReminder(reminderId);
    state.reminders = state.reminders.filter((reminder) => reminder.id !== reminderId);
    renderAll();
    showStatus("Reminder removed from the list and backend store.", "success");
  } catch (error) {
    showStatus(`Reminder delete failed: ${error.message}`, "error");
  }
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
  components.dashboardSummary.render();
  components.reminderPreview.render();
  components.missingFieldsForm.render();
  components.locationTracker.render();
  components.notificationCard.render();
  components.reminderList.render();
}
