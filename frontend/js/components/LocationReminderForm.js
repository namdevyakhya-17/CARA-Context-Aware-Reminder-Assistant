const DEFAULT_RADIUS_METERS = 250;

export function LocationReminderForm(root, {
  getDraft,
  getSuggestions,
  getEditingReminder,
  onDraftChange,
  onSearchPlaces,
  onSelectPlace,
  onSave,
  onCancelEdit
}) {
  let searchTimer = null;

  function render() {
    const draft = getDraft();
    const suggestions = getSuggestions();
    const editingReminder = getEditingReminder();
    const selectedPlace = draft.selectedPlace;

    root.innerHTML = `
      <form id="locationReminderForm">
        <h2>${editingReminder ? "Edit Location Reminder" : "Location Reminder"}</h2>
        <div class="field-grid">
          <label class="field full">
            <span>Reminder text</span>
            <textarea name="title" placeholder="Buy vegetables" required>${escapeHtml(draft.title || "")}</textarea>
          </label>
          <label class="field full">
            <span>Place search</span>
            <input name="placeQuery" autocomplete="off" placeholder="Vegetable market near me" value="${escapeHtml(draft.placeQuery || "")}">
          </label>
          <label class="field">
            <span>Radius meters</span>
            <input name="radius" type="number" min="25" step="25" value="${escapeHtml(draft.radius || DEFAULT_RADIUS_METERS)}">
          </label>
          <label class="field">
            <span>Trigger mode</span>
            <select name="triggerMode">
              ${option("near", "Near", draft.triggerMode)}
              ${option("enter", "Enter", draft.triggerMode)}
              ${option("dwell", "Dwell", draft.triggerMode)}
            </select>
          </label>
        </div>
        ${selectedPlace ? `
          <p class="selected-suggestion">Selected: ${escapeHtml(selectedPlace.address)}</p>
        ` : ""}
        ${suggestions.length ? `
          <ul class="suggestion-list">
            ${suggestions.map((suggestion, index) => `
              <li>
                <button type="button" data-place-index="${index}">
                  ${escapeHtml(suggestion.address)}
                </button>
              </li>
            `).join("")}
          </ul>
        ` : ""}
        <div class="actions">
          <button class="primary" type="submit">${editingReminder ? "Save Changes" : "Save Location Reminder"}</button>
          ${editingReminder ? `<button type="button" id="cancelLocationEdit">Cancel Edit</button>` : ""}
        </div>
      </form>
    `;

    const form = root.querySelector("#locationReminderForm");

    form.addEventListener("input", (event) => {
      const field = event.target.name;
      if (!field) return;

      const value = field === "radius"
        ? Number(event.target.value || DEFAULT_RADIUS_METERS)
        : event.target.value;
      onDraftChange({ [field]: value });

      if (field === "placeQuery") {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          onSearchPlaces(event.target.value.trim());
        }, 650);
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onSave();
    });

    root.querySelectorAll("[data-place-index]").forEach((button) => {
      button.addEventListener("click", () => {
        onSelectPlace(suggestions[Number(button.dataset.placeIndex)]);
      });
    });

    const cancelButton = root.querySelector("#cancelLocationEdit");
    if (cancelButton) {
      cancelButton.addEventListener("click", onCancelEdit);
    }
  }

  render();
  return { render };
}

function option(value, label, selectedValue = "near") {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
