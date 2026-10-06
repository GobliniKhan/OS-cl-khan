"""Turn "Paris" or "48.85,2.35" into coordinates and a time zone.

A built-in gazetteer covers major cities offline. Anything else is looked up with the Open-Meteo geocoder
(free, no key), or can be given as "lat,lon" together with --tz.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional

from truelove.geo import distance

GEOCODER = "https://geocoding-api.open-meteo.com/v1/search"


@dataclass
class Place:
    name: str
    latitude: float
    longitude: float
    tz: Optional[str] = None


class PlaceError(ValueError):
    pass


# name, country, lat, lon, tz
_CITIES = """
New York|US|40.7128|-74.0060|America/New_York
Los Angeles|US|34.0522|-118.2437|America/Los_Angeles
Chicago|US|41.8781|-87.6298|America/Chicago
Houston|US|29.7604|-95.3698|America/Chicago
Phoenix|US|33.4484|-112.0740|America/Phoenix
Philadelphia|US|39.9526|-75.1652|America/New_York
San Antonio|US|29.4241|-98.4936|America/Chicago
San Diego|US|32.7157|-117.1611|America/Los_Angeles
Dallas|US|32.7767|-96.7970|America/Chicago
Austin|US|30.2672|-97.7431|America/Chicago
San Francisco|US|37.7749|-122.4194|America/Los_Angeles
Seattle|US|47.6062|-122.3321|America/Los_Angeles
Denver|US|39.7392|-104.9903|America/Denver
Washington|US|38.9072|-77.0369|America/New_York
Boston|US|42.3601|-71.0589|America/New_York
Nashville|US|36.1627|-86.7816|America/Chicago
Detroit|US|42.3314|-83.0458|America/Detroit
Portland|US|45.5152|-122.6784|America/Los_Angeles
Las Vegas|US|36.1699|-115.1398|America/Los_Angeles
Atlanta|US|33.7490|-84.3880|America/New_York
Miami|US|25.7617|-80.1918|America/New_York
Minneapolis|US|44.9778|-93.2650|America/Chicago
New Orleans|US|29.9511|-90.0715|America/Chicago
Salt Lake City|US|40.7608|-111.8910|America/Denver
Honolulu|US|21.3069|-157.8583|Pacific/Honolulu
Anchorage|US|61.2181|-149.9003|America/Anchorage
Toronto|CA|43.6532|-79.3832|America/Toronto
Montreal|CA|45.5017|-73.5673|America/Toronto
Vancouver|CA|49.2827|-123.1207|America/Vancouver
Calgary|CA|51.0447|-114.0719|America/Edmonton
Mexico City|MX|19.4326|-99.1332|America/Mexico_City
Havana|CU|23.1136|-82.3666|America/Havana
Bogota|CO|4.7110|-74.0721|America/Bogota
Lima|PE|-12.0464|-77.0428|America/Lima
Santiago|CL|-33.4489|-70.6693|America/Santiago
Buenos Aires|AR|-34.6037|-58.3816|America/Argentina/Buenos_Aires
Sao Paulo|BR|-23.5505|-46.6333|America/Sao_Paulo
Rio de Janeiro|BR|-22.9068|-43.1729|America/Sao_Paulo
London|GB|51.5074|-0.1278|Europe/London
Manchester|GB|53.4808|-2.2426|Europe/London
Edinburgh|GB|55.9533|-3.1883|Europe/London
Dublin|IE|53.3498|-6.2603|Europe/Dublin
Paris|FR|48.8566|2.3522|Europe/Paris
Marseille|FR|43.2965|5.3698|Europe/Paris
Madrid|ES|40.4168|-3.7038|Europe/Madrid
Barcelona|ES|41.3874|2.1686|Europe/Madrid
Lisbon|PT|38.7223|-9.1393|Europe/Lisbon
Rome|IT|41.9028|12.4964|Europe/Rome
Milan|IT|45.4642|9.1900|Europe/Rome
Berlin|DE|52.5200|13.4050|Europe/Berlin
Munich|DE|48.1351|11.5820|Europe/Berlin
Hamburg|DE|53.5511|9.9937|Europe/Berlin
Amsterdam|NL|52.3676|4.9041|Europe/Amsterdam
Brussels|BE|50.8503|4.3517|Europe/Brussels
Zurich|CH|47.3769|8.5417|Europe/Zurich
Vienna|AT|48.2082|16.3738|Europe/Vienna
Prague|CZ|50.0755|14.4378|Europe/Prague
Warsaw|PL|52.2297|21.0122|Europe/Warsaw
Budapest|HU|47.4979|19.0402|Europe/Budapest
Copenhagen|DK|55.6761|12.5683|Europe/Copenhagen
Stockholm|SE|59.3293|18.0686|Europe/Stockholm
Oslo|NO|59.9139|10.7522|Europe/Oslo
Helsinki|FI|60.1699|24.9384|Europe/Helsinki
Athens|GR|37.9838|23.7275|Europe/Athens
Istanbul|TR|41.0082|28.9784|Europe/Istanbul
Kyiv|UA|50.4501|30.5234|Europe/Kyiv
Moscow|RU|55.7558|37.6173|Europe/Moscow
Cairo|EG|30.0444|31.2357|Africa/Cairo
Lagos|NG|6.5244|3.3792|Africa/Lagos
Nairobi|KE|-1.2921|36.8219|Africa/Nairobi
Johannesburg|ZA|-26.2041|28.0473|Africa/Johannesburg
Cape Town|ZA|-33.9249|18.4241|Africa/Johannesburg
Casablanca|MA|33.5731|-7.5898|Africa/Casablanca
Dubai|AE|25.2048|55.2708|Asia/Dubai
Tehran|IR|35.6892|51.3890|Asia/Tehran
Karachi|PK|24.8607|67.0011|Asia/Karachi
Lahore|PK|31.5204|74.3587|Asia/Karachi
Delhi|IN|28.7041|77.1025|Asia/Kolkata
Mumbai|IN|19.0760|72.8777|Asia/Kolkata
Bangalore|IN|12.9716|77.5946|Asia/Kolkata
Kolkata|IN|22.5726|88.3639|Asia/Kolkata
Dhaka|BD|23.8103|90.4125|Asia/Dhaka
Bangkok|TH|13.7563|100.5018|Asia/Bangkok
Singapore|SG|1.3521|103.8198|Asia/Singapore
Kuala Lumpur|MY|3.1390|101.6869|Asia/Kuala_Lumpur
Jakarta|ID|-6.2088|106.8456|Asia/Jakarta
Manila|PH|14.5995|120.9842|Asia/Manila
Hong Kong|HK|22.3193|114.1694|Asia/Hong_Kong
Shanghai|CN|31.2304|121.4737|Asia/Shanghai
Beijing|CN|39.9042|116.4074|Asia/Shanghai
Taipei|TW|25.0330|121.5654|Asia/Taipei
Seoul|KR|37.5665|126.9780|Asia/Seoul
Tokyo|JP|35.6762|139.6503|Asia/Tokyo
Osaka|JP|34.6937|135.5023|Asia/Tokyo
Sydney|AU|-33.8688|151.2093|Australia/Sydney
Melbourne|AU|-37.8136|144.9631|Australia/Melbourne
Brisbane|AU|-27.4698|153.0251|Australia/Brisbane
Perth|AU|-31.9505|115.8605|Australia/Perth
Auckland|NZ|-36.8485|174.7633|Pacific/Auckland
"""

GAZETTEER = [Place(f"{n}, {c}", float(la), float(lo), tz)
             for n, c, la, lo, tz in (line.split("|") for line in _CITIES.strip().splitlines())]
_ALIASES = {"nyc": "New York", "la": "Los Angeles", "sf": "San Francisco", "dc": "Washington",
            "new delhi": "Delhi", "bombay": "Mumbai", "calcutta": "Kolkata", "bengaluru": "Bangalore",
            "kiev": "Kyiv", "são paulo": "Sao Paulo", "bogotá": "Bogota", "méxico city": "Mexico City"}

_COORDS = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$")


def _key(text: str) -> str:
    return re.sub(r"\s+", " ", text.split(",")[0].strip().lower())


def lookup_offline(query: str) -> Optional[Place]:
    key = _key(query)
    key = _key(_ALIASES.get(key, key))
    country = query.split(",")[1].strip().upper() if "," in query else ""
    for place in GAZETTEER:
        name, code = place.name.rsplit(", ", 1)
        if name.lower() == key and (not country or len(country) != 2 or country == code):
            return place
    return None


def lookup_online(query: str, timeout: float = 10) -> Optional[Place]:
    url = GEOCODER + "?" + urllib.parse.urlencode({"name": query.split(",")[0].strip(), "count": 5, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": "truelove/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        results = json.load(resp).get("results") or []
    hint = query.split(",", 1)[1].strip().lower() if "," in query else ""
    for r in results:
        labels = {str(r.get(k, "")).lower() for k in ("country", "country_code", "admin1")}
        if not hint or hint in labels:
            name = ", ".join(str(r[k]) for k in ("name", "admin1", "country_code") if r.get(k))
            return Place(name, float(r["latitude"]), float(r["longitude"]), r.get("timezone"))
    return None


def resolve(query: str, tz: Optional[str] = None, online: bool = True) -> Place:
    """Coordinates ("lat,lon"), then the built-in gazetteer, then the online geocoder."""
    match = _COORDS.match(query)
    if match:
        lat, lon = float(match.group(1)), float(match.group(2))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise PlaceError(f"coordinates out of range: {query}")
        return Place(f"{lat:.4f}, {lon:.4f}", lat, lon, tz)
    place = lookup_offline(query)
    if place is None and online:
        try:
            place = lookup_online(query)
        except Exception as exc:  # network down, blocked, bad JSON: fall through to a clear error
            raise PlaceError(f"could not look up {query!r} online ({exc}); "
                             "pass coordinates instead, e.g. \"40.71,-74.01\" with --tz America/New_York") from exc
    if place is None:
        raise PlaceError(f"unknown place {query!r}; pass coordinates instead, e.g. \"40.71,-74.01\" "
                         "with --tz America/New_York")
    if tz:
        place.tz = tz
    return place


def nearest_city(lat: float, lon: float):
    """(Place, miles) for the closest gazetteer city."""
    return min(((p, distance(lat, lon, p.latitude, p.longitude)) for p in GAZETTEER), key=lambda t: t[1])
