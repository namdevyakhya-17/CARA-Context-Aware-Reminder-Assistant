# CARA Project Documentation

CARA is an agent-based reminder backend built with FastAPI. It accepts natural-language reminder text, extracts reminder fields with Gemini, enriches the reminder with context such as priority and trigger type, stores location-based reminders in JSON files, checks geofence triggers, and contains an early notification-decision agent.

## How to Run

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Create a `.env` file with:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
3. Start the API:
   ```bash
   uvicorn main:app --reload
   ```
4. Open the FastAPI docs at:
   ```text
   http://127.0.0.1:8000/docs
   ```

## Main Flow

1. `POST /extract` receives natural-language text.
2. `agents/nlp_understanding_agent/reminder_detector.py` sends the text to Gemini using the prompt in `utils/prompts.py`.
3. `agents/nlp_understanding_agent/processor.py` cleans the model output, parses JSON, normalizes date/time values, and calls the context agent.
4. `agents/context_detection_agent/context.py` adds priority, trigger type, and missing-field information.
5. Location endpoints can save named places, create location reminders, and check whether a user's current coordinates trigger any pending reminders.
6. Notification endpoints call the notification-decision agent for notify, snooze, and advance decisions.



<!-- make the main heading font-weight 600 obly and chnge the website name to CARA- Context Aware Reminder Assistant. moreover on top of it, it shoould also show stats given in image, not necessary in same manner you can also use your own logic as well for hits.  morever, also add option to enter the radius on the users choice as well in location reminder and dont use ai related icons as you have used already.  -->