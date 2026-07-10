export function LocationResolutionForm(root, {
  getRequest,
  getLocationState,
  onSaveAddress,
  onSuggestAddress,
  onSelectSuggestion,
  onUseCurrentLocation,
  onCancel
}) {
  let suggestionTimer = null;

  function render() {
    const request = getRequest();

    if (!request) {
      root.hidden = true;
      root.innerHTML = "";
      return;
    }

    root.hidden = false;
    const locationName = request.locationName || "this place";
    const query = request.query || "";
    const suggestions = request.suggestions || [];
    const selectedSuggestion = request.selectedSuggestion;
    const locationState = getLocationState();
    const hasCurrentLocation = locationState.latitude !== null && locationState.longitude !== null;
    const shouldRestoreAddressFocus = document.activeElement?.id === "locationAddress";

    root.innerHTML = `
      <form id="locationResolutionForm">
        <h2>Location Details Needed</h2>
        <p class="empty-state">CARA needs an address for ${escapeHtml(locationName)} before this reminder can be saved.</p>
        <div class="field-grid">
          <label class="field full">
            <span>${escapeHtml(locationName)} address</span>
            <input id="locationAddress" name="address" autocomplete="street-address" placeholder="Enter full address" value="${escapeHtml(query)}">
          </label>
        </div>
        ${selectedSuggestion ? `
          <p class="selected-suggestion">Selected: ${escapeHtml(selectedSuggestion.address)}</p>
        ` : ""}
        <div class="actions">
          <button class="primary" type="submit">Save Address and Reminder</button>
          <button id="useCurrentLocation" type="button" ${hasCurrentLocation ? "" : "disabled"}>Use Current Location</button>
          <button id="cancelLocationResolution" type="button">Cancel</button>
        </div>
        ${suggestions.length ? `
          <ul class="suggestion-list">
            ${suggestions.map((suggestion, index) => `
              <li>
                <button type="button" data-suggestion-index="${index}">
                  ${escapeHtml(suggestion.address)}
                </button>
              </li>
            `).join("")}
          </ul>
        ` : ""}
      </form>
    `;

    root.querySelector("#locationResolutionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const address = new FormData(event.currentTarget).get("address")?.trim();
      onSaveAddress(address);
    });

    root.querySelector("#locationAddress").addEventListener("input", (event) => {
      const address = event.target.value.trim();
      window.clearTimeout(suggestionTimer);
      suggestionTimer = window.setTimeout(() => {
        onSuggestAddress(address);
      }, 450);
    });

    root.querySelectorAll("[data-suggestion-index]").forEach((button) => {
      button.addEventListener("click", () => {
        onSelectSuggestion(suggestions[Number(button.dataset.suggestionIndex)]);
      });
    });

    root.querySelector("#useCurrentLocation").addEventListener("click", onUseCurrentLocation);
    root.querySelector("#cancelLocationResolution").addEventListener("click", onCancel);

    if (shouldRestoreAddressFocus) {
      const addressInput = root.querySelector("#locationAddress");
      addressInput.focus();
      addressInput.setSelectionRange(addressInput.value.length, addressInput.value.length);
    }
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
