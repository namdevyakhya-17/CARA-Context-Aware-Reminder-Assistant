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

async function getRequest(path) {
  const response = await fetch(`${apiBase}${path}`);

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

async function patchRequest(path, payload = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "PATCH",
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

export function createReminder(reminder) {
  return request("/reminders", reminder);
}

export function createCurrentLocationReminder(reminder, latitude, longitude) {
  return request("/reminders/use-current-location", {
    ...reminder,
    latitude,
    longitude
  });
}

export function saveLocationAddress(name, address, coords = null) {
  return request("/save-location-address", {
    name,
    address,
    ...(coords || {})
  });
}

export function suggestLocationAddresses(query) {
  return request("/location-suggestions", { query });
}

export function saveCurrentLocation(name, latitude, longitude) {
  return request("/save-current-location", {
    name,
    latitude,
    longitude
  });
}

export function fetchReminders() {
  return getRequest("/reminders");
}

export function checkTimeReminders() {
  return request("/check-time-reminders", {});
}

export function decideNotification(reminder, context) {
  return request("/notification/decide", { reminder, context });
}

export function snoozeNotification(reminderId, snoozeMinutes = 10) {
  return patchRequest(`/reminders/${encodeURIComponent(reminderId)}/snooze`, {
    snooze_minutes: snoozeMinutes
  });
}

export function deleteReminder(reminderId) {
  return deleteRequest(`/reminders/${encodeURIComponent(reminderId)}`);
}

export function completeReminder(reminderId) {
  return patchRequest(`/reminders/${encodeURIComponent(reminderId)}/complete`);
}

export function cancelReminder(reminderId) {
  return patchRequest(`/reminders/${encodeURIComponent(reminderId)}/cancel`);
}
