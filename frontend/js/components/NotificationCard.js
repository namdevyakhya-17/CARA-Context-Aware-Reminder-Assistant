export function NotificationCard(root, {
  getNotification,
  getSnoozeMinutes,
  onDone,
  onSnooze,
  onEditSnooze,
  onCancel,
  onSnoozeChange
}) {
  function render() {
    const notification = getNotification();
    const snoozeMinutes = getSnoozeMinutes();

    if (!notification) {
      root.innerHTML = "";
      return;
    }

    const actionClass = normalizeAction(notification.action);
    const reminder = notification.reminder || {};

    root.innerHTML = `
      <div class="popup-backdrop" role="presentation"></div>
      <section class="notification-popup" role="dialog" aria-modal="true" aria-labelledby="notificationTitle">
        <div class="notification ${actionClass}">
          <h2 id="notificationTitle">Reminder Triggered</h2>
          <h3>${formatAction(notification.action)}</h3>
          <p>${reminder.task || notification.message || "Reminder is ready."}</p>
          ${notification.decidedAt ? `<p class="decision-time">Triggered: ${notification.decidedAt}</p>` : ""}
          <div class="pill-row">
            <span class="pill">Priority: ${reminder.priority || "medium"}</span>
            <span class="pill">Snooze: ${snoozeMinutes || 10} min</span>
            <span class="pill">${reminder.trigger_type || "time"}</span>
          </div>
        </div>
        <div id="snoozeEditor" class="split-row" ${notification.editingSnooze ? "" : "hidden"}>
          <label class="field">
            <span>Snooze minutes</span>
            <input id="snoozeMinutes" type="number" min="1" step="1" value="${snoozeMinutes || 10}">
          </label>
        </div>
        <div class="actions">
          <button class="primary" id="doneButton" type="button">Done</button>
          <button id="snoozeButton" type="button">Snooze</button>
          <button id="editSnoozeButton" type="button">Edit Snooze Time</button>
          <button class="danger" id="cancelButton" type="button">Cancel</button>
        </div>
      </section>
    `;

    root.querySelector("#doneButton").addEventListener("click", onDone);
    root.querySelector("#snoozeButton").addEventListener("click", onSnooze);
    root.querySelector("#editSnoozeButton").addEventListener("click", onEditSnooze);
    root.querySelector("#cancelButton").addEventListener("click", onCancel);

    const snoozeInput = root.querySelector("#snoozeMinutes");
    if (snoozeInput) {
      snoozeInput.addEventListener("input", () => onSnoozeChange(Number(snoozeInput.value) || 10));
    }
  }

  render();
  return { render };
}

function normalizeAction(action = "") {
  const normalized = String(action).toLowerCase();
  if (normalized.includes("delay") || normalized.includes("postpone")) return "delay";
  if (normalized.includes("snooze") || normalized.includes("retry")) return "snooze";
  if (normalized.includes("cancel")) return "cancel";
  return "notify";
}

function formatAction(action = "notify_now") {
  return String(action).replaceAll("_", " ").toUpperCase();
}
