export function DashboardSummary(root, { getReminders }) {
  function render() {
    const reminders = getReminders();
    const counts = reminders.reduce(
      (summary, reminder) => {
        const status = reminder.status || "pending";
        const priority = String(reminder.priority || "medium").toLowerCase();

        summary.total += 1;
        summary[status] = (summary[status] || 0) + 1;
        if (priority === "high") summary.high += 1;

        return summary;
      },
      {
        total: 0,
        pending: 0,
        triggered: 0,
        completed: 0,
        cancelled: 0,
        high: 0
      }
    );

    root.innerHTML = `
      <h2>Reminder Overview</h2>
      <div class="summary-grid">
        ${summaryTile("Total", counts.total)}
        ${summaryTile("Pending", counts.pending)}
        ${summaryTile("Triggered", counts.triggered)}
        ${summaryTile("Completed", counts.completed)}
        ${summaryTile("High Priority", counts.high)}
      </div>
    `;
  }

  render();
  return { render };
}

function summaryTile(label, value) {
  return `
    <div class="summary-tile">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
