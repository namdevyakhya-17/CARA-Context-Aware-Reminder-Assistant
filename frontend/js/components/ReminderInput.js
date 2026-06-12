export function ReminderInput(root, { onSubmit }) {
  root.innerHTML = `
    <form id="reminderForm">
      <h2>New Reminder</h2>
      <label class="field full">
        <span>Reminder text</span>
        <textarea id="reminderText" placeholder="Remind me to buy vegetables tomorrow evening" required></textarea>
      </label>
      <div class="actions">
        <button class="primary" type="submit">Extract Reminder</button>
        <button type="button" id="sampleButton">Use Sample</button>
      </div>
    </form>
  `;

  const form = root.querySelector("#reminderForm");
  const textInput = root.querySelector("#reminderText");
  const sampleButton = root.querySelector("#sampleButton");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(textInput.value.trim());
  });

  sampleButton.addEventListener("click", () => {
    textInput.value = "Remind me to buy vegetables tomorrow evening";
    textInput.focus();
  });
}
