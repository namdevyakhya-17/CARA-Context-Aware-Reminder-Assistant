import json
from agents.location_services_agent.geocoder import get_coordinates
from utils.config import USER_LOCATIONS_FILE

FILE = USER_LOCATIONS_FILE

# API 1: To save home/office location
def load_locations():
    try:
        with FILE.open("r") as f:
            return json.load(f)
    except:
        return {}

def save_locations(data):
    FILE.parent.mkdir(parents=True, exist_ok=True)
    with FILE.open("w") as f:
        json.dump(data, f, indent=4)

def save_location_by_address(name, address, coords):
    data = load_locations()
    data[name.lower()] = {
        "address": address,
        "latitude": coords["latitude"],
        "longitude": coords["longitude"]
    }

    save_locations(data)
    print(f"[LOCATION STORE] Saved {name}")
    return data[name.lower()]

def save_current_location(name, latitude, longitude):
    data = load_locations()
    data[name.lower()] = {
        "latitude": latitude,
        "longitude": longitude
    }

    save_locations(data)
    print(f"[LOCATION STORE] Saved {name}")
    return data[name.lower()]

# API 2: To get home/office location
def get_saved_location(name):
    data = load_locations()
    return data.get(name.lower())
