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
  saveCurrentLocation,
  saveLocationAddress,
  setApiBase,
  snoozeNotification,
  suggestLocationAddresses,
  updateUserLocation
} from "./api.js";
import { ReminderInput } from "./components/ReminderInput.js";
import { ReminderPreview } from "./components/ReminderPreview.js?v=20260628-1";
import { MissingFieldsForm } from "./components/MissingFieldsForm.js";
import { LocationTracker } from "./components/LocationTracker.js";
import { LocationResolutionForm } from "./components/LocationResolutionForm.js?v=20260628-6";
import { NotificationCard } from "./components/NotificationCard.js";
import { ReminderList } from "./components/ReminderList.js?v=20260628-1";
import { DashboardSummary } from "./components/DashboardSummary.js";

const ACTIVE_NOTIFICATION_KEY = "caraActiveNotification";

const state = {
  currentReminder: null,
  locationResolution: null,
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

let timeReminderPollInProgress = false;

const roots = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  statusBanner: document.querySelector("#statusBanner"),
  dashboardSummary: document.querySelector("#dashboardSummary"),
  reminderInput: document.querySelector("#reminderInput"),
  reminderPreview: document.querySelector("#reminderPreview"),
  missingFieldsForm: document.querySelector("#missingFieldsForm"),
  locationResolution: document.querySelector("#locationResolution"),
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

components.locationResolution = LocationResolutionForm(roots.locationResolution, {
  getRequest: () => state.locationResolution,
  getLocationState: () => state.location,
  onSaveAddress: handleSaveLocationAddress,
  onSuggestAddress: handleSuggestLocationAddress,
  onSelectSuggestion: handleSelectLocationSuggestion,
  onUseCurrentLocation: handleUseCurrentLocationForPlace,
  onCancel: clearLocationResolution
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
    persistNotification();
  }
});

components.reminderList = ReminderList(roots.reminderList, {
  getReminders: () => state.reminders,
  onDelete: handleDeleteReminder
});

startApp();

async function startApp() {
  await initializeApp();
  setInterval(pollTimeReminders, 30000);
  setTimeout(pollTimeReminders, 1000);
}

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
    if (result?.needs_location) {
      requestLocationDetails(savedReminder, result.location);
      showStatus(`Add location details for ${result.location} to finish saving this reminder.`, "error");
      return;
    }

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

  const actionRequiredReminder = {
    ...reminder,
    status: "action_required"
  };
  upsertReminder(actionRequiredReminder);

  // Show an actionable popup immediately. The decision service enriches it,
  // but a slow or failed decision must not make the reminder disappear.
  state.notification = {
    action: "notify_now",
    message: "Choose Done, Snooze, or Cancel.",
    reminder: actionRequiredReminder,
    editingSnooze: false,
    decidedAt: new Date().toLocaleString()
  };
  persistNotification();
  renderAll();

  const context = await readContext();

  try {
    const decision = await decideNotification(actionRequiredReminder, context);
    state.notification = {
      ...state.notification,
      ...decision,
      reminder: actionRequiredReminder
    };
    persistNotification();
    showStatus("Reminder needs your action. The popup will stay open until you respond.", "success");
  } catch (error) {
    showStatus(`Reminder needs your action. Decision details were unavailable: ${error.message}`, "error");
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
        if (!state.notification && Array.isArray(result.triggered) && result.triggered.length) {
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
  persistNotification();
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

function requestLocationDetails(reminder, locationName) {
  state.locationResolution = {
    reminder,
    locationName: locationName || reminder.location || "this place",
    query: "",
    suggestions: []
  };
  renderAll();
}

function clearLocationResolution() {
  state.locationResolution = null;
  renderAll();
}

async function handleSaveLocationAddress(address) {
  const request = state.locationResolution;
  if (!request) return;

  address = address || request.query || "";

  if (!address) {
    showStatus("Enter the address before saving this location.", "error");
    return;
  }

  try {
    const selected = request.selectedSuggestion;
    const savedLocation = await saveLocationAddress(
      request.locationName,
      selected?.address || address,
      selected
        ? {
            latitude: selected.latitude,
            longitude: selected.longitude
          }
        : null
    );
    if (!savedLocation?.success) {
      throw new Error(savedLocation?.message || "Address could not be resolved.");
    }

    await retryLocationReminder(request.reminder);
  } catch (error) {
    showStatus(`Location save failed: ${error.message}`, "error");
  }
}

async function handleSuggestLocationAddress(address) {
  const request = state.locationResolution;
  if (!request) return;

  state.locationResolution = {
    ...request,
    query: address,
    selectedSuggestion: null
  };

  if (!address) {
    state.locationResolution = {
      ...state.locationResolution,
      suggestions: []
    };
    renderAll();
    return;
  }

  if (address.length < 4) {
    state.locationResolution = {
      ...state.locationResolution,
      suggestions: []
    };
    renderAll();
    return;
  }

  try {
    const result = await suggestLocationAddresses(address);
    state.locationResolution = {
      ...state.locationResolution,
      suggestions: result.suggestions || []
    };
    renderAll();
  } catch (error) {
    showStatus(`Address search failed: ${error.message}`, "error");
  }
}

async function handleSelectLocationSuggestion(suggestion) {
  const request = state.locationResolution;
  if (!request || !suggestion) return;

  state.locationResolution = {
    ...request,
    query: suggestion.address,
    selectedSuggestion: suggestion
  };
  renderAll();
  showStatus("Address selected. Click Save Address and Reminder to continue.", "success");
}

async function handleUseCurrentLocationForPlace() {
  const request = state.locationResolution;
  if (!request) return;

  if (state.location.latitude === null || state.location.longitude === null) {
    showStatus("Enable location tracking before using your current location.", "error");
    return;
  }

  try {
    await saveCurrentLocation(request.locationName, state.location.latitude, state.location.longitude);
    await retryLocationReminder(request.reminder);
  } catch (error) {
    showStatus(`Current location save failed: ${error.message}`, "error");
  }
}

async function retryLocationReminder(reminder) {
  const result = await saveReminderToBackend(reminder);
  if (result?.needs_location) {
    requestLocationDetails(reminder, result.location);
    showStatus(`CARA still needs location details for ${result.location}.`, "error");
    return;
  }

  if (result?.reminder) {
    upsertReminder(result.reminder);
  }

  await refreshReminders();
  clearCurrentReminder();
  clearLocationResolution();
  showStatus("Location saved and reminder set.", "success");
  alert("Your location reminder has been set.");
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

async function initializeApp() {
  await refreshReminders();
  restoreActiveNotification();
  renderAll();
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
  localStorage.removeItem(ACTIVE_NOTIFICATION_KEY);
}

function persistNotification() {
  if (!state.notification) {
    localStorage.removeItem(ACTIVE_NOTIFICATION_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_NOTIFICATION_KEY, JSON.stringify({
    notification: state.notification,
    snoozeMinutes: state.snoozeMinutes
  }));
}

function restoreActiveNotification() {
  const stored = localStorage.getItem(ACTIVE_NOTIFICATION_KEY);
  if (!stored) return;

  try {
    const saved = JSON.parse(stored);
    const reminderId = saved?.notification?.reminder?.id;
    const currentReminder = state.reminders.find((reminder) => reminder.id === reminderId);

    if (!currentReminder || !["action_required", "triggered"].includes(currentReminder.status)) {
      localStorage.removeItem(ACTIVE_NOTIFICATION_KEY);
      return;
    }

    state.notification = {
      ...saved.notification,
      reminder: {
        ...saved.notification.reminder,
        ...currentReminder,
        status: "action_required"
      }
    };
    state.snoozeMinutes = Number(saved.snoozeMinutes) || 10;
  } catch {
    localStorage.removeItem(ACTIVE_NOTIFICATION_KEY);
  }
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
  if (state.notification || timeReminderPollInProgress) return;

  timeReminderPollInProgress = true;
  try {
    const result = await checkDueTimeReminders();
    if (Array.isArray(result.triggered) && result.triggered.length) {
      await refreshReminders();
      await triggerReminder(result.triggered[0]);
    }
  } catch (error) {
    showStatus(`Time reminder check failed: ${error.message}`, "error");
  } finally {
    timeReminderPollInProgress = false;
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
    status: "action_required"
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
  components.locationResolution.render();
  components.locationTracker.render();
  components.notificationCard.render();
  components.reminderList.render();
}
