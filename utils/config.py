from pathlib import Path
import os

from dotenv import load_dotenv


load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

DATABASE_DIR = Path(os.getenv("DATABASE_DIR", "database"))
REMINDERS_FILE = Path(os.getenv("REMINDERS_FILE", DATABASE_DIR / "reminders.json"))
USER_LOCATIONS_FILE = Path(os.getenv("USER_LOCATIONS_FILE", DATABASE_DIR / "user_locations.json"))
NOTIFICATION_HISTORY_FILE = Path(
    os.getenv("NOTIFICATION_HISTORY_FILE", DATABASE_DIR / "notification_history.json")
)

DEFAULT_LOCATION_RADIUS_METERS = int(os.getenv("DEFAULT_LOCATION_RADIUS_METERS", "100"))
GEOCODER_USER_AGENT = os.getenv("GEOCODER_USER_AGENT", "cara_location_agent")
GEOCODER_TIMEOUT_SECONDS = int(os.getenv("GEOCODER_TIMEOUT_SECONDS", "10"))
PERSONAL_LOCATION_NAMES = {
    name.strip().lower()
    for name in os.getenv(
        "PERSONAL_LOCATION_NAMES",
        "home,office,college,school,hostel,work,gym",
    ).split(",")
    if name.strip()
}
