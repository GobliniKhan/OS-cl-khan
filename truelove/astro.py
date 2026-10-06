"""Low-precision ephemeris (Paul Schlyter's method): Sun, Moon and Venus to well under a degree, 1900-2100.

Enough for astrology, where a sign is 30 degrees wide. Angles are in degrees unless a name says otherwise.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone

SIGNS = ("Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces")
ELEMENTS = ("fire", "earth", "air", "water")
SIGN_SYMBOLS = "♈♉♊♋♌♍♎♏♐♑♒♓"


def sin(x: float) -> float:
    return math.sin(math.radians(x))


def cos(x: float) -> float:
    return math.cos(math.radians(x))


def atan2(y: float, x: float) -> float:
    return math.degrees(math.atan2(y, x))


def norm(angle: float) -> float:
    return angle % 360.0


def sign_of(longitude: float) -> str:
    return SIGNS[int(norm(longitude) // 30)]


def element_of(sign: str) -> str:
    return ELEMENTS[SIGNS.index(sign) % 4]


def degree_in_sign(longitude: float) -> float:
    return norm(longitude) % 30


def julian_day(when: datetime) -> float:
    when = when.astimezone(timezone.utc)
    return (when - datetime(2000, 1, 1, 12, tzinfo=timezone.utc)).total_seconds() / 86400.0 + 2451545.0


def _day_number(jd: float) -> float:
    return jd - 2451543.5


def obliquity(jd: float) -> float:
    return 23.4393 - 3.563e-7 * _day_number(jd)


def _kepler(mean_anomaly: float, e: float) -> float:
    E = mean_anomaly + math.degrees(e * sin(mean_anomaly) * (1 + e * cos(mean_anomaly)))
    for _ in range(10):
        delta = (E - math.degrees(e * sin(E)) - mean_anomaly) / (1 - e * cos(E))
        E -= delta
        if abs(delta) < 1e-7:
            break
    return E


def _orbit_xyz(N: float, i: float, w: float, a: float, e: float, M: float):
    E = _kepler(norm(M), e)
    xv, yv = a * (cos(E) - e), a * math.sqrt(1 - e * e) * sin(E)
    v, r = atan2(yv, xv), math.hypot(xv, yv)
    vw = v + w
    return (r * (cos(N) * cos(vw) - sin(N) * sin(vw) * cos(i)),
            r * (sin(N) * cos(vw) + cos(N) * sin(vw) * cos(i)),
            r * sin(vw) * sin(i))


def _sun(d: float):
    """Returns (ecliptic longitude, distance in AU, mean longitude, mean anomaly)."""
    w, e, M = 282.9404 + 4.70935e-5 * d, 0.016709 - 1.151e-9 * d, norm(356.0470 + 0.9856002585 * d)
    x, y, _ = _orbit_xyz(0.0, 0.0, w, 1.0, e, M)
    return norm(atan2(y, x)), math.hypot(x, y), norm(w + M), M


def _moon(d: float):
    N = 125.1228 - 0.0529538083 * d
    w = 318.0634 + 0.1643573223 * d
    M = norm(115.3654 + 13.0649929509 * d)
    x, y, z = _orbit_xyz(N, 5.1454, w, 60.2666, 0.054900, M)
    lon, lat = atan2(y, x), atan2(z, math.hypot(x, y))
    _, _, Ls, Ms = _sun(d)
    Lm = N + w + M
    D, F = Lm - Ls, Lm - N
    lon += (-1.274 * sin(M - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms) - 0.059 * sin(2 * M - 2 * D)
            - 0.057 * sin(M - 2 * D + Ms) + 0.053 * sin(M + 2 * D) + 0.046 * sin(2 * D - Ms)
            + 0.041 * sin(M - Ms) - 0.035 * sin(D) - 0.031 * sin(M + Ms) - 0.015 * sin(2 * F - 2 * D)
            + 0.011 * sin(M - 4 * D))
    lat += (-0.173 * sin(F - 2 * D) - 0.055 * sin(M - F - 2 * D) - 0.046 * sin(M + F - 2 * D)
            + 0.033 * sin(F + 2 * D) + 0.017 * sin(2 * M + F))
    return norm(lon), lat


def _venus(d: float):
    hx, hy, hz = _orbit_xyz(76.6799 + 2.46590e-5 * d, 3.3946 + 2.75e-8 * d, 54.8910 + 1.38374e-5 * d,
                            0.723330, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d)
    slon, sr, _, _ = _sun(d)
    gx, gy, gz = hx + sr * cos(slon), hy + sr * sin(slon), hz
    return norm(atan2(gy, gx)), atan2(gz, math.hypot(gx, gy))


def ecliptic_positions(jd: float) -> dict:
    """Geocentric ecliptic (longitude, latitude) of the bodies truelove reads."""
    d = _day_number(jd)
    return {"Sun": (_sun(d)[0], 0.0), "Moon": _moon(d), "Venus": _venus(d)}


def ecliptic_to_equatorial(lon: float, lat: float, eps: float):
    x = cos(lon) * cos(lat)
    y = sin(lon) * cos(lat) * cos(eps) - sin(lat) * sin(eps)
    z = sin(lon) * cos(lat) * sin(eps) + sin(lat) * cos(eps)
    return norm(atan2(y, x)), atan2(z, math.hypot(x, y))


def local_sidereal_time(jd: float, east_longitude: float) -> float:
    t = (jd - 2451545.0) / 36525
    gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t
    return norm(gmst + east_longitude)


def horizontal(ra: float, dec: float, lst: float, latitude: float):
    """(altitude, azimuth measured from true north through east)."""
    ha = lst - ra
    alt = math.degrees(math.asin(sin(dec) * sin(latitude) + cos(dec) * cos(latitude) * cos(ha)))
    az = norm(atan2(sin(ha), cos(ha) * sin(latitude) - math.tan(math.radians(dec)) * cos(latitude)) + 180)
    return alt, az


def ascendant(lst: float, latitude: float, eps: float) -> float:
    return norm(atan2(cos(lst), -(sin(lst) * cos(eps) + math.tan(math.radians(latitude)) * sin(eps))))


def moon_phase(jd: float) -> float:
    """Elongation of the Moon from the Sun: 0 new, 90 first quarter, 180 full, 270 last quarter."""
    pos = ecliptic_positions(jd)
    return norm(pos["Moon"][0] - pos["Sun"][0])


def phase_name(elongation: float) -> str:
    names = ("New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
             "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent")
    return names[int(norm(elongation + 22.5) // 45) % 8]


@dataclass
class Placement:
    body: str
    longitude: float
    altitude: float
    azimuth: float

    @property
    def sign(self) -> str:
        return sign_of(self.longitude)

    @property
    def element(self) -> str:
        return element_of(self.sign)

    def describe(self) -> str:
        return f"{self.body} {degree_in_sign(self.longitude):.0f}° {self.sign}"


@dataclass
class Chart:
    when: datetime
    latitude: float
    longitude: float
    placements: dict

    def __getitem__(self, body: str) -> Placement:
        return self.placements[body]


def cast_chart(when: datetime, latitude: float, longitude: float) -> Chart:
    """Natal placements, plus where each body (and the Descendant, the partner point) sat on the horizon."""
    jd = julian_day(when)
    eps = obliquity(jd)
    lst = local_sidereal_time(jd, longitude)
    placements = {}
    for body, (lon, lat) in ecliptic_positions(jd).items():
        alt, az = horizontal(*ecliptic_to_equatorial(lon, lat, eps), lst, latitude)
        placements[body] = Placement(body, lon, alt, az)
    asc = ascendant(lst, latitude, eps)
    for body, lon in (("Ascendant", asc), ("Descendant", norm(asc + 180))):
        alt, az = horizontal(*ecliptic_to_equatorial(lon, 0.0, eps), lst, latitude)
        placements[body] = Placement(body, lon, alt, az)
    return Chart(when, latitude, longitude, placements)
