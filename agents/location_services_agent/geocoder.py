from geopy.geocoders import Nominatim
geolocator = Nominatim(user_agent="cara_location_agent")
def get_coordinates(address):
    print(f"\n[GEOCODER] Searching for: {address}")
    try:
        location = geolocator.geocode(
            address,
            exactly_one=True,
            timeout=10
        )
        print("[GEOCODER] Raw Result:", location)
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
        print("[GEOCODER ERROR]", e)
        return None