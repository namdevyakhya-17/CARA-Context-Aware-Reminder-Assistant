export function LocationTracker(root, { onStart, onStop, getLocationState }) {
  function render() {
    const state = getLocationState();
    const coordinates = state.latitude && state.longitude
      ? `${state.latitude.toFixed(5)}, ${state.longitude.toFixed(5)}`
      : "Not shared";

    root.innerHTML = `
      <h2>Location Tracker</h2>
      <p class="empty-state">${state.message || "Use browser permission to support location-based reminders."}</p>
      <div class="pill-row" aria-label="Location status">
        <span class="pill">${state.active ? "Tracking on" : "Tracking off"}</span>
        <span class="pill">${coordinates}</span>
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
