export function ReminderList(root, { getReminders, onDelete }) {
  function render() {
    const reminders = getReminders();

    root.innerHTML = `
      <h2>Saved Reminders</h2>
      ${reminders.length ? `
        <ul class="reminder-items">
          ${reminders.map((reminder) => `
            <li class="reminder-item">
              <button class="remove-reminder" type="button" data-delete-id="${reminder.id}" aria-label="Remove reminder">x</button>
              <p class="reminder-title">${escapeHtml(reminder.task || "Untitled reminder")}</p>
              <div class="reminder-meta">
                <span class="status ${escapeHtml(normalizeStatus(reminder.status))}">${escapeHtml(formatStatus(reminder.status))}</span>
                <span class="priority ${escapeHtml(normalizePriority(reminder.priority))}">${escapeHtml(formatPriority(reminder.priority))}</span>
                <span>${escapeHtml(reminder.trigger_type || "unknown")}</span>
                <span>${escapeHtml(reminder.date || "no date")}</span>
                <span>${escapeHtml(formatReminderTime(reminder))}</span>
                <span>${escapeHtml(reminder.location || "no location")}</span>
              </div>
            </li>
          `).join("")}
        </ul>
      ` : `<p class="empty-state">Confirmed reminders will be listed here.</p>`}
    `;

    root.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", () => {
        onDelete(button.dataset.deleteId);
      });
    });
  }

  render();
  return { render };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPriority(priority = "medium") {
  return `Priority: ${priority}`;
}

function formatStatus(status = "pending") {
  if (status === "done") return "Status: completed";
  if (status === "action_required" || status === "triggered") return "Status: action required";
  return `Status: ${status || "pending"}`;
}

function formatReminderTime(reminder) {
  const notificationTime = reminder.notification_time;
  const rawTime = reminder.raw_time;

  if (notificationTime && rawTime && notificationTime !== rawTime) {
    return `${notificationTime} (${rawTime})`;
  }

  return notificationTime || rawTime || "no time";
}

function normalizeStatus(status = "pending") {
  if (status === "done") return "completed";
  if (status === "triggered") return "action_required";
  return status || "pending";
}

function normalizePriority(priority = "medium") {
  return String(priority || "medium").toLowerCase();
}
