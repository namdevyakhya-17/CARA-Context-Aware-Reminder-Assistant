const DEFAULT_API_BASE = "http://127.0.0.1:8000";

let apiBase = localStorage.getItem("caraApiBase") || DEFAULT_API_BASE;

export function getApiBase() {
  return apiBase;
}

export function setApiBase(value) {
  apiBase = (value || DEFAULT_API_BASE).replace(/\/$/, "");
  localStorage.setItem("caraApiBase", apiBase);
}

async function request(path, payload) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { message: "Backend returned a non-JSON response." };
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed with ${response.status}`;
    throw new Error(Array.isArray(message) ? JSON.stringify(message) : message);
  }

  return data;
}

async function deleteRequest(path) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "DELETE"
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = { message: "Backend returned a non-JSON response." };
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed with ${response.status}`;
    throw new Error(Array.isArray(message) ? JSON.stringify(message) : message);
  }

  return data;
}

export function extractReminder(text) {
  return request("/extract", { text });
}

export function updateUserLocation(latitude, longitude) {
  return request("/update-user-location", { latitude, longitude });
}

export function createLocationReminder(reminder) {
  return request("/create-location-reminder", {
    task: reminder.task,
    location: reminder.location
  });
}

export function decideNotification(reminder, context) {
  return request("/notification/decide", { reminder, context });
}

export function snoozeNotification(reminderId, snoozeMinutes = 10) {
  return request("/notification/snooze", {
    reminder_id: reminderId,
    snooze_minutes: snoozeMinutes
  });
}

export function deleteReminder(reminderId) {
  return deleteRequest(`/reminders/${encodeURIComponent(reminderId)}`);
}
