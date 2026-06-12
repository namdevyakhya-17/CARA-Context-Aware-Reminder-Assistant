export function MissingFieldsForm(root, { getReminder, onUpdate }) {
  function render() {
    const reminder = getReminder();
    const missingFields = reminder?.missing_fields || reminder?.missing_feilds || [];

    if (!reminder) {
      root.innerHTML = `
        <h2>Follow-up Fields</h2>
        <p class="empty-state">Missing fields from Agent 2 will appear here.</p>
      `;
      return;
    }

    if (!missingFields.length) {
      root.innerHTML = `
        <h2>Follow-up Fields</h2>
        <p class="empty-state">No missing fields were returned by the backend.</p>
      `;
      return;
    }

    root.innerHTML = `
      <form id="missingForm">
        <h2>Follow-up Fields</h2>
        <div class="field-grid">
          ${missingFields.map((field) => `
            <label class="field">
              <span>${field.replaceAll("_", " ")}</span>
              <input name="${field}" value="${reminder[field] || ""}" required>
            </label>
          `).join("")}
        </div>
        <div class="actions">
          <button class="primary" type="submit">Apply Answers</button>
        </div>
      </form>
    `;

    root.querySelector("#missingForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const updatedReminder = { ...getReminder() };

      missingFields.forEach((field) => {
        updatedReminder[field] = formData.get(field);
      });

      updatedReminder.missing_fields = [];
      onUpdate(updatedReminder);
    });
  }

  render();
  return { render };
}
