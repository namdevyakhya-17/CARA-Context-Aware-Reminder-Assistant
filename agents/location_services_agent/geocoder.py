from geopy.geocoders import Nominatim
from utils.config import GEOCODER_TIMEOUT_SECONDS
from utils.config import GEOCODER_USER_AGENT

geolocator = Nominatim(user_agent=GEOCODER_USER_AGENT)

def get_coordinates(address):
    print(f"\n[GEOCODER] Searching for: {address}")
    try:
        location = geolocator.geocode(
            address,
            exactly_one=True,
            timeout=GEOCODER_TIMEOUT_SECONDS
        )
        print("[GEOCODER] Raw Result:", safe_log_text(location.address if location else "not found"))
        if not location:
            return None
        print(
            f"[GEOCODER] LAT={location.latitude}, "
            f"LON={location.longitude}"
        )

        return {
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

        for search_query in query_variants(query):
            locations = geolocator.geocode(
                search_query,
                exactly_one=False,
                limit=limit,
                timeout=GEOCODER_TIMEOUT_SECONDS
            ) or []

            for location in locations:
                key = (round(location.latitude, 6), round(location.longitude, 6), location.address)
                if key in seen:
                    continue

                seen.add(key)
                suggestions.append(
                    {
                        "address": location.address,
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

    variants = [normalized]
    without_near = normalized.replace("near ", "")
    if without_near != normalized:
        variants.append(without_near)

    parts = [part.strip() for part in normalized.split(",") if part.strip()]
    for index in range(len(parts)):
        variant = ", ".join(parts[index:])
        if variant and variant not in variants:
            variants.append(variant)

    return variants


def safe_log_text(value):
    return str(value).encode("ascii", errors="ignore").decode("ascii")
