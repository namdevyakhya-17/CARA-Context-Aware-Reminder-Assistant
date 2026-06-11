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

## API Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | `GET` | Health/home endpoint returning a simple project message. |
| `/extract` | `POST` | Extracts reminder information from natural-language text and enriches it with context. |
| `/save-location-address` | `POST` | Geocodes an address and saves it as a named user location. |
| `/save-current-location` | `POST` | Saves a named location using latitude and longitude supplied by the client. |
| `/create-location-reminder` | `POST` | Resolves a location name/address and stores a location reminder. |
| `/update-user-location` | `POST` | Checks pending location reminders against the user's current coordinates. |
| `/notification/decide` | `POST` | Produces a notification action based on reminder and context. |
| `/notification/snooze` | `POST` | Logs and returns a snooze decision. |
| `/notification/advance` | `POST` | Logs and returns an advance decision. |

## File-by-File Guide

### Root Files

| File | What it does |
| --- | --- |
| `main.py` | Creates the FastAPI app, includes `api.routes.router`, and defines the root `/` endpoint. |
| `requirements.txt` | Lists Python dependencies used by the project: FastAPI, Uvicorn, Pydantic, Gemini SDK, dotenv, geopy, SQLAlchemy, dateparser, pandas, scikit-learn, and joblib. |
| `.env` | Local environment file expected to contain `GEMINI_API_KEY`. This should stay private and is ignored by git. |
| `.gitignore` | Ignores environment files and Python cache/build artifacts. |

### API Layer

| File | What it does |
| --- | --- |
| `api/routes.py` | Defines all FastAPI routes. It connects HTTP requests to NLP extraction, location saving, location-reminder creation, geofence checking, and notification decisions. It also defines the `InputText` request model for `/extract`. |

### NLP Understanding Agent

| File | What it does |
| --- | --- |
| `agents/nlp_understanding_agent/reminder_detector.py` | Configures Gemini with the API key and sends the extraction prompt to the `models/gemini-2.5-flash` model. Returns the model's raw text response. |
| `agents/nlp_understanding_agent/processor.py` | Converts Gemini output into usable reminder data. It removes markdown code fences, extracts JSON, normalizes dates and times, prints debug output, calls `ContextAgent`, and returns the enriched result. |

### Context Detection Agent

| File | What it does |
| --- | --- |
| `agents/context_detection_agent/context.py` | Enriches parsed reminder data by adding priority, trigger type, and missing fields. Currently flags missing time for time-based reminders. |
| `agents/context_detection_agent/priority_rules.py` | Contains keyword-based priority rules. Tasks containing words like `bill`, `doctor`, or `meeting` become high priority; words like `movie` or `game` become low priority; everything else defaults to medium. |
| `agents/context_detection_agent/trigger_rules.py` | Determines whether a reminder is location-based, time-based, or unknown based on the presence of `location`, `date`, or `time` fields. |

### Location Services Agent

| File | What it does |
| --- | --- |
| `agents/location_services_agent/geocoder.py` | Uses geopy's Nominatim geocoder to convert an address into latitude and longitude. Returns `None` if the address cannot be resolved. |
| `agents/location_services_agent/geofence.py` | Calculates distance in meters between two latitude/longitude points using the Haversine formula. |
| `agents/location_services_agent/location_store.py` | Loads and saves named user locations in `database/user_locations.json`. Supports saving by address/geocoded coordinates or by current coordinates. |
| `agents/location_services_agent/reminder_store.py` | Loads and saves location reminders in `database/reminders.json`. Creates UUID-based reminder IDs, stores coordinates, sets a default radius of 100 meters, and marks new reminders as pending. |
| `agents/location_services_agent/resolver.py` | Resolves a location by first checking saved named locations, then falling back to geocoding the location text. |
| `agents/location_services_agent/checker.py` | Checks pending reminders against the user's current coordinates. If the user is within the reminder radius, it marks the reminder as triggered and writes the updated reminder list back to JSON. |

### Notification Decision Agent

| File | What it does |
| --- | --- |
| `agents/notification_decision_agent/decision_service.py` | Intended orchestration class for notification decisions, history logging, snoozing, and advancing reminders. See current limitations for naming issues that need cleanup. |
| `agents/notification_decision_agent/rule_engine.py` | Contains rule-based decision logic. High-priority reminders notify immediately. Driving, meeting, sleeping, or very low battery can delay notifications. |
| `agents/notification_decision_agent/snooze_manager.py` | Provides snooze duration logic. Uses a default of 10 minutes when no custom snooze time is supplied. |
| `agents/notification_decision_agent/notification_history.py` | Appends notification actions to `database/notification_history.json` with reminder ID, action, and timestamp. |
| `agents/notification_decision_agent/user_behaviour.py` | Tracks per-user notification behavior counts for opened, ignored, and snoozed actions. Intended to store behavior data in a JSON file. |
| `agents/notification_decision_agent/ml_predictor.py` | Placeholder for future machine-learning prediction work. It currently imports pandas, RandomForestClassifier, and joblib, then attempts to read `training_data.csv`. |
| `agents/notification_decision_agent/notifier.py` | Simple notifier class that prints the reminder task and chosen action, then returns a sent status. |

### Shared Models

| File | What it does |
| --- | --- |
| `models/reminder.py` | Defines a Pydantic `Reminder` schema for extracted reminder data, including task, intent, datetime, location, normalized time, trigger type, priority, and missing fields. |
| `models/notification.py` | Defines Pydantic schemas for notification decisions, context data, and reminder data used by the notification layer. |
| `models/schemas.py` | Empty placeholder file reserved for future shared schemas. |

### Database Layer and JSON Stores

| File | What it does |
| --- | --- |
| `database/db.py` | Configures a SQLAlchemy SQLite engine pointing at `sqlite:///reminders.db` and creates a `SessionLocal` factory. |
| `database/models.py` | Defines a SQLAlchemy `Reminder` table model with `id`, `task`, `date`, `time`, and `priority` columns. This SQLAlchemy model is not currently wired into the active JSON reminder flow. |
| `database/user_locations.json` | Runtime JSON store for named user locations such as `home` or `office`. |
| `database/reminders.json` | Runtime JSON store for location reminders, including reminder ID, task, target coordinates, radius, and status. |
| `database/notification_history.json` | Runtime JSON store for notification actions and timestamps. |
| `database/user_behaviour.json` | Runtime JSON store intended for user behavior data. It is currently empty. |

### Utilities

| File | What it does |
| --- | --- |
| `utils/config.py` | Loads environment variables with `python-dotenv` and exposes `API_KEY` from `GEMINI_API_KEY`. |
| `utils/datetime_parser.py` | Provides `normalize_datetime(text)`, which uses `dateparser` to convert natural-language date/time text into ISO format. |
| `utils/prompts.py` | Stores the Gemini extraction prompt. The prompt instructs the model to return only JSON with task, intent, entities, trigger type, date, raw time, and location. |

### Tests and Generated Files

| Path | What it does |
| --- | --- |
| `tests/` | Test directory exists but currently contains no test files. |
| `__pycache__/` and nested `__pycache__/` folders | Generated Python bytecode caches. These are not source files and can be safely regenerated. |

## Current Limitations and Review Notes

- `agents/notification_decision_agent/decision_service.py` imports `RuleEnginer`, but `rule_engine.py` defines only `evaluate_rules`; this endpoint will need correction before notification decisions run successfully.
- `NotificationDecisionAgent.__init__` assigns `self.rule_engine`, but `decide()` calls `self.rule_enginer`, which is a typo.
- `NotificationHistory` is imported as a class in `decision_service.py`, but `notification_history.py` currently exposes a `save_action()` function instead of a `NotificationHistory` class.
- `SnoozeManager.get_snooze_time()` is missing `self` in its method signature, so calling it as an instance method will fail.
- `user_behaviour.py` writes to `database/user_behavior.json`, while the project currently contains `database/user_behaviour.json`. The spelling mismatch means it may create or expect a different file.
- `ml_predictor.py` expects `training_data.csv`, but that file is not present in the project.
- The active storage flow uses JSON files. SQLAlchemy setup exists, but database table creation and SQL-backed CRUD are not currently connected to the API routes.
- Some field names differ across files, such as `missing_feilds` in `models/reminder.py` and `missing_fields` in `context.py`.

## Suggested Reviewer Path

For a quick review, start with `main.py`, then `api/routes.py`, then follow each endpoint into the corresponding agent folder. The most complete flow today is:

```text
/extract
api/routes.py
agents/nlp_understanding_agent/processor.py
agents/nlp_understanding_agent/reminder_detector.py
utils/prompts.py
agents/context_detection_agent/context.py
```

For location reminders, review:

```text
api/routes.py
agents/location_services_agent/resolver.py
agents/location_services_agent/location_store.py
agents/location_services_agent/reminder_store.py
agents/location_services_agent/checker.py
agents/location_services_agent/geofence.py
agents/location_services_agent/geocoder.py
database/*.json
```
