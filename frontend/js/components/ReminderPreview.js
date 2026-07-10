const EDITABLE_FIELDS = [
  "task",
  "intent",
  "entities",
  "trigger_type",
  "date",
  "raw_time",
  "notification_time",
  "location",
  "priority"
];

export function ReminderPreview(root, { getReminder, onChange, onConfirm }) {
  function render() {
    const reminder = getReminder();

    if (!reminder) {
      root.innerHTML = `
        <h2>Extracted Details</h2>
        <p class="empty-state">Extract a reminder to review and edit Agent 1 and Agent 2 output.</p>
      `;
      return;
    }

    root.innerHTML = `
      <h2>Extracted Details</h2>
      <div class="field-grid">
        ${EDITABLE_FIELDS.map((field) => fieldMarkup(field, reminder[field])).join("")}
      </div>
      <div class="actions">
        <button class="primary" id="confirmReminder" type="button">Confirm Reminder</button>
      </div>
    `;

    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.field;
        const value = field === "entities"
          ? input.value.split(",").map((item) => item.trim()).filter(Boolean)
          : input.value;
        onChange({ ...getReminder(), [field]: value });
      });
    });

    root.querySelector("#confirmReminder").addEventListener("click", onConfirm);
  }

  render();
  return { render };
}

function fieldMarkup(field, value = "") {
  const label = field.replaceAll("_", " ");
  const displayValue = Array.isArray(value) ? value.join(", ") : value;
  const type = field === "date" ? "date" : "text";

  if (field === "task") {
    return `
      <label class="field full">
        <span>${label}</span>
        <textarea data-field="${field}">${displayValue || ""}</textarea>
      </label>
    `;
  }

  return `
    <label class="field">
      <span>${label}</span>
      <input data-field="${field}" type="${type}" value="${displayValue || ""}">
    </label>
  `;
}
