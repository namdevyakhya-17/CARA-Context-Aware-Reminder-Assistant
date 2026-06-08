from agents.location_services_agent.location_store import get_saved_location
from agents.location_services_agent.geocoder import get_coordinates

def resolve_location(location_name):
    saved = get_saved_location(location_name)
    print(f"[RESOLVER] Resolving: {location_name}")
    if saved:
        print(f"[RESOLVER] Found saved location")
        return saved
    
    return get_coordinates(location_name)