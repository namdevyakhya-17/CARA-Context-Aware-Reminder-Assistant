# geofence calcultion
from math import radians
from math import sin
from math import cos
from math import sqrt
from math import atan2

def distance(lat1, lon1, lat2, lon2):
    R=6371000
    dLat = radians(lat2-lat1)
    dLon = radians(lon2 - lon1)
    a = (sin(dLat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2)**2)
    c = 2*atan2(sqrt(a), sqrt(1-a))
    return R*c