import re

from geopy.geocoders import Nominatim
from utils.config import GEOCODER_TIMEOUT_SECONDS
from utils.config import GEOCODER_USER_AGENT

geolocator = Nominatim(user_agent=GEOCODER_USER_AGENT)

KNOWN_LOCATIONS = {
    "sector 22a, gurugram": {
        "address": "Sector 22A, Gurugram, Haryana, India",
        "latitude": 28.5107,
        "longitude": 77.0646,
    },
    "sector 22a, gurgaon": {
        "address": "Sector 22A, Gurugram, Haryana, India",
        "latitude": 28.5107,
        "longitude": 77.0646,
    },
}


def get_coordinates(address):
    print(f"\n[GEOCODER] Searching for: {address}")
    try:
        location = None
        for search_query in query_variants(address):
            location = geolocator.geocode(
                search_query,
                exactly_one=True,
                timeout=GEOCODER_TIMEOUT_SECONDS
            )
            print(
                "[GEOCODER] Raw Result:",
                safe_log_text(location.address if location else f"not found for {search_query}")
            )
            if location and result_matches_query(address, location.address):
                break
            location = None

        if not location:
            return known_location_coordinates(address)

        print(f"[GEOCODER] LAT={location.latitude}, LON={location.longitude}")

        return {
            "address": location.address,
            "latitude": location.latitude,
            "longitude": location.longitude
        }

    except Exception as e:
        print("[GEOCODER ERROR]", safe_log_text(e))
        return None


def suggest_addresses(query, limit=5):
    print(f"\n[GEOCODER] Suggestions for: {query}")
    try:
        suggestions = []
        seen = set()
        known_location = known_location_coordinates(query)
        if known_location:
            suggestions.append(
                {
                    "address": known_location["address"],
                    "name": known_location["address"].split(",")[0],
                    "latitude": known_location["latitude"],
                    "longitude": known_location["longitude"],
                }
            )

        for search_query in query_variants(query):
            locations = geolocator.geocode(
                search_query,
                exactly_one=False,
                limit=limit,
                timeout=GEOCODER_TIMEOUT_SECONDS
            ) or []

            for location in locations:
                if not result_matches_query(query, location.address):
                    continue

                key = (round(location.latitude, 6), round(location.longitude, 6), location.address)
                if key in seen:
                    continue

                seen.add(key)
                suggestions.append(
                    {
                        "address": location.address,
                        "name": location.raw.get("name") or location.address.split(",")[0],
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                    }
                )

                if len(suggestions) >= limit:
                    return suggestions

        return suggestions

    except Exception as e:
        print("[GEOCODER SUGGEST ERROR]", safe_log_text(e))
        return []


def query_variants(query):
    normalized = " ".join(str(query or "").split())
    if not normalized:
        return []

    variants = []

    def add_variant(value):
        value = str(value or "").replace(" ,", ",")
        value = " ".join(value.split())
        if value and value not in variants:
            variants.append(value)

    add_variant(normalized)
    without_near = normalized.replace("near ", "")
    add_variant(without_near)

    spaced_sector = re.sub(r"\bsector\s*(\d+[a-z]?)\b", r"Sector \1", normalized, flags=re.IGNORECASE)
    add_variant(spaced_sector)

    city_aliases = {
        "gurugram": "Gurgaon",
        "gurgaon": "Gurugram",
    }
    for city, alias in city_aliases.items():
        if re.search(rf"\b{city}\b", normalized, flags=re.IGNORECASE):
            add_variant(re.sub(rf"\b{city}\b", alias, normalized, flags=re.IGNORECASE))
            add_variant(re.sub(rf"\b{city}\b", alias, spaced_sector, flags=re.IGNORECASE))
            add_variant(re.sub(rf"\b{city}\b", f"{alias}, Haryana, India", spaced_sector, flags=re.IGNORECASE))

    if spaced_sector != normalized:
        add_variant(f"{spaced_sector}, Haryana, India")

    parts = [part.strip() for part in normalized.split(",") if part.strip()]
    for index in range(len(parts)):
        variant = ", ".join(parts[index:])
        add_variant(variant)
        spaced_variant = re.sub(r"\bsector\s*(\d+[a-z]?)\b", r"Sector \1", variant, flags=re.IGNORECASE)
        add_variant(spaced_variant)

    return variants


def known_location_coordinates(query):
    normalized = normalize_location_key(query)
    location = KNOWN_LOCATIONS.get(normalized)
    if location:
        print("[GEOCODER] Local fallback:", safe_log_text(location["address"]))
        return dict(location)

    return None


def normalize_location_key(value):
    normalized = " ".join(str(value or "").lower().replace(" ,", ",").split())
    normalized = re.sub(r"\bsector\s*(\d+[a-z]?)\b", r"sector \1", normalized)
    return normalized


def result_matches_query(query, result_address):
    sector = extract_sector(query)
    if not sector:
        return True

    return sector == extract_sector(result_address)


def extract_sector(value):
    match = re.search(r"\bsector\s*(\d+[a-z]?)\b", str(value or ""), flags=re.IGNORECASE)
    return match.group(1).lower() if match else ""


def safe_log_text(value):
    return str(value).encode("ascii", errors="ignore").decode("ascii")
