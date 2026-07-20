export function LocationTracker(root, { onStart, onStop, getLocationState, getReminders, getDistanceToReminder }) {
  function render() {
    const state = getLocationState();
    const locationReminders = getReminders().filter(isLocationReminder);
    const nearestReminder = nearestLocationReminder(locationReminders, getDistanceToReminder);
    const hasCoordinates = state.latitude !== null && state.longitude !== null;
    const coordinates = hasCoordinates
      ? `${state.latitude.toFixed(5)}, ${state.longitude.toFixed(5)}`
      : "Not shared";
    const nearestText = nearestReminder
      ? `${nearestReminder.name}: ${formatDistance(nearestReminder.distance)} / ${nearestReminder.radius}m`
      : "No distance yet";

    root.innerHTML = `
      <h2>Location Tracker</h2>
      <p class="empty-state">${state.message || "Use browser permission to support location-based reminders."}</p>
      <div class="pill-row" aria-label="Location status">
        <span class="pill">${state.active ? "Tracking on" : "Tracking off"}</span>
        <span class="pill">${coordinates}</span>
        <span class="pill">${nearestText}</span>
      </div>
      <div class="actions">
        <button class="primary" id="startLocation" type="button">${state.active ? "Update Permission" : "Enable Location"}</button>
        <button id="stopLocation" type="button" ${state.active ? "" : "disabled"}>Stop Tracking</button>
      </div>
    `;

    root.querySelector("#startLocation").addEventListener("click", onStart);
    root.querySelector("#stopLocation").addEventListener("click", onStop);
  }

  render();
  return { render };
}

function nearestLocationReminder(reminders, getDistanceToReminder) {
  return reminders
    .map((reminder) => ({
      name: reminder.placeName || reminder.location_name || reminder.location || "Location reminder",
      radius: Number(reminder.radius || 100),
      distance: getDistanceToReminder(reminder)
    }))
    .filter((reminder) => reminder.distance !== null)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function formatDistance(distance) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)}km`;
  }
  return `${Math.round(distance)}m`;
}

function isLocationReminder(reminder) {
  return String(reminder.trigger_type || reminder.type || "").toLowerCase().includes("location");
}
