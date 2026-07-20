const API_BASE = window.location.protocol.startsWith("http")
  ? window.location.origin
  : "http://127.0.0.1:8000";

const reminders = [];
let activeFilter = "all";
let timeReminderCheckInProgress = false;
let selectedLocationSuggestion = null;
let suggestionRequestId = 0;
let suggestionTimer = null;
let locationWatchId = null;
let lastLocationCheckAt = 0;

const elements = {
  statusActive: document.querySelector(".status-active"),
  remindersCount: document.querySelector(".reminders-count"),
  reminderList: document.querySelector(".empty-state"),
  radius: document.querySelector("#locationRadius"),
  radiusCurrent: document.querySelector(".radius-current"),
  radiusValue: document.querySelector(".slider-value"),
  timePriority: document.querySelector("#timePriorityToggle"),
  locationPriority: document.querySelector("#locationPriorityToggle"),
  timeText: document.querySelector("#timeReminderText"),
  locationText: document.querySelector("#locationReminderText"),
  locationPlace: document.querySelector("#locationReminderPlace"),
  locationSuggestions: document.querySelector("#locationSuggestions"),
  saveTime: document.querySelector("#saveTimeReminder"),
  saveLocation: document.querySelector("#saveLocationReminder"),
  getStarted: document.querySelector(".status-get-started")
};

start();

function start() {
  bindEvents();
  refreshReminders();
  startLocationTracking();
  window.setTimeout(checkTimeReminders, 1000);
  window.setInterval(checkTimeReminders, 10000);
}

function bindEvents() {
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-radius]").forEach((button) => {
    button.addEventListener("click", () => setRadius(button.dataset.radius));
  });

  document.querySelectorAll(".filter-tabs span").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter || "all";
      document.querySelectorAll(".filter-tabs span").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      renderReminders();
    });
  });

  elements.radius?.addEventListener("input", () => setRadius(elements.radius.value));
  elements.timePriority?.addEventListener("click", () => togglePriority(elements.timePriority));
  elements.locationPriority?.addEventListener("click", () => togglePriority(elements.locationPriority));
  elements.saveTime?.addEventListener("click", saveTimeReminder);
  elements.saveLocation?.addEventListener("click", saveLocationReminder);
  elements.locationPlace?.addEventListener("input", handleLocationPlaceInput);
  elements.getStarted?.addEventListener("click", () => {
    requestNotificationPermission();
    startLocationTracking();
  });
}

async function refreshReminders() {
  try {
    const data = await request("/reminders");
    reminders.splice(0, reminders.length, ...(data.reminders || []));
    renderAll();
  } catch (error) {
    showListMessage(`Could not load reminders: ${error.message}`);
  }
}

async function saveTimeReminder() {
  const task = elements.timeText.value.trim();

  if (!task) {
    alert("Add reminder text first.");
    return;
  }

  try {
    requestNotificationPermission();
    setButtonBusy(elements.saveTime, "Extracting...");
    const extracted = await request("/extract", {
      method: "POST",
      body: { text: task }
    });

    if (extracted.error) {
      throw new Error(extracted.error);
    }

    const reminder = {
      ...extracted,
      task: extracted.task || task,
      title: extracted.title || extracted.task || task,
      type: "time",
      trigger_type: "time",
      priority: priorityValue(elements.timePriority) === "high" ? "high" : extracted.priority || "medium",
      status: "pending"
    };

    if (Array.isArray(reminder.missing_fields) && reminder.missing_fields.length) {
      throw new Error(`Missing details: ${reminder.missing_fields.join(", ")}. Please include them in the prompt.`);
    }

    await saveReminder(reminder, elements.saveTime, "Save time reminder");
    elements.timeText.value = "";
  } catch (error) {
    alert(`Reminder save failed: ${error.message}`);
    setButtonBusy(elements.saveTime, "+ Save time reminder");
  }
}

async function checkTimeReminders() {
  if (timeReminderCheckInProgress) {
    return;
  }

  timeReminderCheckInProgress = true;
  try {
    const data = await request("/check-time-reminders", {
      method: "POST",
      body: {}
    });

    const triggered = Array.isArray(data.triggered) ? data.triggered : [];
    if (!triggered.length) {
      return;
    }

    await refreshReminders();
    triggered.forEach(showReminderNotification);
  } catch (error) {
    console.warn("Time reminder check failed:", error);
  } finally {
    timeReminderCheckInProgress = false;
  }
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") {
    return;
  }

  Notification.requestPermission().catch(() => {});
}

function startLocationTracking() {
  if (locationWatchId !== null || !navigator.geolocation) {
    return;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      checkLocationReminders(position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      console.warn("Location tracking failed:", error.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 15000
    }
  );
}

async function checkLocationReminders(latitude, longitude) {
  const now = Date.now();
  if (now - lastLocationCheckAt < 10000) {
    return;
  }
  lastLocationCheckAt = now;

  try {
    const data = await request("/update-user-location", {
      method: "POST",
      body: { latitude, longitude }
    });
    const triggered = Array.isArray(data.triggered) ? data.triggered : [];
    if (!triggered.length) {
      return;
    }

    await refreshReminders();
    triggered.forEach(showReminderNotification);
  } catch (error) {
    console.warn("Location reminder check failed:", error);
  }
}

function showReminderNotification(reminder) {
  const message = reminder.task || reminder.title || "Reminder is due.";

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("CARA reminder", {
      body: message,
      tag: reminder.id || message,
      requireInteraction: true
    });
  }

  showReminderPopup(reminder);
}

function showReminderPopup(reminder) {
  const message = reminder.task || reminder.title || "Reminder is due.";
  const popupKey = reminder.id || message;
  const existing = Array.from(document.querySelectorAll("[data-reminder-popup]"))
    .some((popup) => popup.dataset.reminderPopup === popupKey);

  if (existing) {
    return;
  }

  let host = document.querySelector(".notification-stack");
  if (!host) {
    host = document.createElement("div");
    host.className = "notification-stack";
    document.body.append(host);
  }

  const popup = document.createElement("section");
  popup.className = "reminder-popup";
  popup.dataset.reminderPopup = popupKey;
  popup.innerHTML = `
    <div>
      <p class="popup-label">CARA reminder</p>
      <strong>${escapeHtml(message)}</strong>
      <span>${escapeHtml(formatReminderMeta(reminder))}</span>
    </div>
    <div class="popup-actions">
      <button type="button" data-popup-action="complete">Done</button>
      <button type="button" data-popup-action="cancel">Cancel</button>
    </div>
  `;

  popup.querySelectorAll("[data-popup-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateReminderStatus(reminder.id, button.dataset.popupAction);
      popup.remove();
    });
  });
  host.append(popup);
}

async function saveLocationReminder() {
  const task = elements.locationText.value.trim();
  const place = elements.locationPlace.value.trim();

  if (!task || !place) {
    alert("Add reminder text and place first.");
    return;
  }

  const reminder = {
    task,
    title: task,
    type: "location",
    trigger_type: "location",
    location: place,
    location_name: place,
    placeName: place,
    ...(selectedLocationSuggestion ? {
      address: selectedLocationSuggestion.address,
      latitude: selectedLocationSuggestion.latitude,
      longitude: selectedLocationSuggestion.longitude
    } : {}),
    radius: Number(elements.radius.value || 150),
    priority: priorityValue(elements.locationPriority),
    status: "pending",
    enabled: true,
    triggered: false
  };

  try {
    await saveReminder(reminder, elements.saveLocation, "Save location reminder");
    elements.locationText.value = "";
    elements.locationPlace.value = "";
    selectedLocationSuggestion = null;
    renderLocationSuggestions([]);
  } catch (error) {
    alert(`Reminder save failed: ${error.message}`);
  }
}

function handleLocationPlaceInput() {
  selectedLocationSuggestion = null;
  window.clearTimeout(suggestionTimer);

  const query = elements.locationPlace.value.trim();
  if (query.length < 3) {
    renderLocationSuggestions([]);
    return;
  }

  suggestionTimer = window.setTimeout(() => loadLocationSuggestions(query), 300);
}

async function loadLocationSuggestions(query) {
  const requestId = ++suggestionRequestId;
  try {
    const data = await request("/location-suggestions", {
      method: "POST",
      body: { query }
    });

    if (requestId !== suggestionRequestId) {
      return;
    }

    renderLocationSuggestions(data.suggestions || []);
  } catch (error) {
    console.warn("Location suggestions failed:", error);
    renderLocationSuggestions([]);
  }
}

function renderLocationSuggestions(suggestions) {
  if (!elements.locationSuggestions) {
    return;
  }

  if (!suggestions.length) {
    elements.locationSuggestions.hidden = true;
    elements.locationSuggestions.innerHTML = "";
    return;
  }

  elements.locationSuggestions.hidden = false;
  elements.locationSuggestions.innerHTML = suggestions.map((suggestion, index) => `
    <button type="button" data-suggestion-index="${index}">
      <strong>${escapeHtml(suggestion.name || suggestion.address)}</strong>
      <span>${escapeHtml(suggestion.address)}</span>
    </button>
  `).join("");

  elements.locationSuggestions.querySelectorAll("[data-suggestion-index]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLocationSuggestion = suggestions[Number(button.dataset.suggestionIndex)];
      elements.locationPlace.value = selectedLocationSuggestion.address;
      renderLocationSuggestions([]);
    });
  });
}

async function saveReminder(reminder, button, label) {
  try {
    if (!button.disabled) {
      setButtonBusy(button, "Saving...");
    }
    const data = await request("/reminders", {
      method: "POST",
      body: reminder
    });

    if (!data.success) {
      throw new Error(data.message || "Reminder was not saved.");
    }

    await refreshReminders();
  } finally {
    setButtonBusy(button, `+ ${label}`);
  }
}

function renderAll() {
  renderStats();
  renderReminders();
}

function renderStats() {
  const counts = reminders.reduce(
    (summary, reminder) => {
      const status = reminder.status || "pending";
      summary.total += 1;
      if (status === "pending") summary.pending += 1;
      if (status === "triggered" || status === "action_required") summary.triggered += 1;
      if (status === "completed" || status === "done") summary.completed += 1;
      if (String(reminder.priority || "").toLowerCase() === "high") summary.high += 1;
      return summary;
    },
    { total: 0, pending: 0, triggered: 0, completed: 0, high: 0 }
  );

  Object.entries(counts).forEach(([key, value]) => {
    const node = document.querySelector(`[data-stat="${key}"]`);
    if (node) node.textContent = value;
  });

  const active = counts.pending + counts.triggered;
  elements.statusActive.textContent = `${active} active`;
  elements.remindersCount.textContent = `${counts.total} total · ${active} active`;
}

function renderReminders() {
  const visible = reminders.filter((reminder) => {
    if (activeFilter === "all") return true;
    return String(reminder.trigger_type || reminder.type || "").toLowerCase().includes(activeFilter);
  });

  if (!visible.length) {
    showListMessage("No reminders yet. Create one above — it lives on your device.");
    return;
  }

  elements.reminderList.innerHTML = visible.map((reminder) => `
    <article class="saved-reminder ${escapeHtml(statusClass(reminder.status))}">
      <div class="saved-reminder-main">
        <strong>${escapeHtml(reminder.task || reminder.title || "Untitled reminder")}</strong>
        <div class="reminder-chips">
          <span>${escapeHtml(formatType(reminder))}</span>
          <span class="status-chip">${escapeHtml(formatStatus(reminder.status))}</span>
          <span>${escapeHtml(formatPriority(reminder.priority))}</span>
        </div>
      </div>
      <div class="saved-reminder-side">
        <span>${escapeHtml(formatReminderWhenWhere(reminder))}</span>
        ${isFinalStatus(reminder.status) ? "" : `
          <div class="reminder-actions">
            <button type="button" data-status-action="cancel" data-reminder-id="${escapeHtml(reminder.id)}">Cancel</button>
          </div>
        `}
      </div>
    </article>
  `).join("");

  elements.reminderList.querySelectorAll("[data-status-action]").forEach((button) => {
    button.addEventListener("click", () => {
      updateReminderStatus(button.dataset.reminderId, button.dataset.statusAction);
    });
  });
}

function formatReminderMeta(reminder) {
  return [
    formatType(reminder),
    formatStatus(reminder.status),
    formatPriority(reminder.priority),
    formatReminderWhenWhere(reminder)
  ].filter(Boolean).join(" · ");
}

function formatType(reminder) {
  const type = reminder.trigger_type || reminder.type || "time";
  return String(type).toLowerCase().includes("location") ? "Location" : "Time";
}

function formatStatus(status = "pending") {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "completed" || normalized === "done") return "Completed";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return "Pending";
}

function formatPriority(priority = "medium") {
  const normalized = String(priority || "medium").toLowerCase();
  return normalized === "high" ? "High priority" : "Medium priority";
}

function formatReminderWhenWhere(reminder) {
  const where = reminder.location_name || reminder.location || "";
  const when = [reminder.date, reminder.notification_time || reminder.raw_time].filter(Boolean).join(" ");
  const radius = where && reminder.radius ? ` (${reminder.radius} m)` : "";
  return where ? `${where}${radius}` : when || "No trigger details";
}

function statusClass(status = "pending") {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "completed" || normalized === "done") return "completed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return "pending";
}

function isFinalStatus(status = "pending") {
  const normalized = String(status || "").toLowerCase();
  return normalized === "completed" || normalized === "done" || normalized === "cancelled" || normalized === "canceled";
}

async function updateReminderStatus(reminderId, action) {
  if (!reminderId) {
    return;
  }

  const path = action === "complete"
    ? `/reminders/${encodeURIComponent(reminderId)}/complete`
    : `/reminders/${encodeURIComponent(reminderId)}/cancel`;

  try {
    const data = await request(path, {
      method: "PATCH",
      body: {}
    });

    if (!data.success) {
      throw new Error("Reminder status was not updated.");
    }

    await refreshReminders();
  } catch (error) {
    showReminderError(`Could not update reminder: ${error.message}`);
  }
}

function showReminderError(message) {
  let host = document.querySelector(".notification-stack");
  if (!host) {
    host = document.createElement("div");
    host.className = "notification-stack";
    document.body.append(host);
  }

  const popup = document.createElement("section");
  popup.className = "reminder-popup error";
  popup.innerHTML = `
    <div>
      <p class="popup-label">CARA</p>
      <strong>${escapeHtml(message)}</strong>
    </div>
    <div class="popup-actions">
      <button type="button">Close</button>
    </div>
  `;
  popup.querySelector("button").addEventListener("click", () => popup.remove());
  host.append(popup);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed with ${response.status}`);
  }
  return data;
}

function setRadius(value) {
  const radius = Number(value || 150);
  elements.radius.value = radius;
  elements.radiusCurrent.textContent = `${radius} m`;
  elements.radiusValue.textContent = `${radius} m`;
}

function togglePriority(button) {
  const pressed = button.getAttribute("aria-pressed") === "true";
  button.setAttribute("aria-pressed", String(!pressed));
}

function priorityValue(button) {
  return button?.getAttribute("aria-pressed") === "true" ? "high" : "medium";
}

function setButtonBusy(button, label) {
  if (!button) return;
  button.textContent = label;
  button.disabled = label === "Saving...";
}

function showListMessage(message) {
  elements.reminderList.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
