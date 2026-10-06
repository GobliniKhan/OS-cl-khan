"""The reading: turn a birth chart, today's sky and the zodiac feeds into one hotspot within 100 miles.

The model, in the spirit of local-space astrology:

* Direction. Each natal body points somewhere on the horizon. Love travels along Venus's line (weight 0.35),
  the Descendant, the classical point of the partner (0.25), and the Moon, the point of feeling (0.10).
  The partner signs, those in harmony with your Venus, add their element's compass point (fire south,
  earth north, air east, water west), each pulled harder when the feeds give that sign strong love energy (0.30).
* Distance. Venus high in your birth sky keeps love close; low or below the horizon sends it further out.
  Your life path number sets the other half of the ring.
* Timing. Upcoming days score when transiting Venus makes a soft aspect to your Descendant and the Moon
  passes through a partner sign.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from truelove import astro, geo, numerology
from truelove.astro import SIGNS, Chart, element_of
from truelove.feeds import FeedReading

DIRECTION_WEIGHTS = {"Venus": 0.35, "Descendant": 0.25, "Moon": 0.10}
SIGN_WEIGHT = 0.30
ELEMENT_BEARING = {"earth": 0.0, "air": 90.0, "fire": 180.0, "water": 270.0}
COMPLEMENT = {"fire": "air", "air": "fire", "earth": "water", "water": "earth"}
ASPECTS = {0: 1.0, 60: 0.7, 120: 0.9, 90: -0.6, 180: -0.3}  # angle: harmony, for transits
ORB = 6.0


def angle_diff(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


def kernel(delta: float, sharpness: int = 4) -> float:
    """1 when pointing straight down a line, falling to 0 opposite it."""
    return ((1 + math.cos(math.radians(delta))) / 2) ** sharpness


def sign_bearing(sign: str) -> float:
    """Element compass point, fanned out by modality: cardinal -30, fixed 0, mutable +30."""
    i = SIGNS.index(sign)
    return (ELEMENT_BEARING[element_of(sign)] + (i // 4 - 1) * 30) % 360


def harmony(sign_a: str, sign_b: str) -> float:
    ea, eb = element_of(sign_a), element_of(sign_b)
    return 1.0 if ea == eb else 0.9 if COMPLEMENT[ea] == eb else 0.0


@dataclass
class PartnerSign:
    sign: str
    weight: float
    energy: float
    why: str


@dataclass
class Spot:
    latitude: float
    longitude: float
    bearing: float
    miles: float
    score: float

    @property
    def compass(self) -> str:
        return geo.compass(self.bearing)

    @property
    def map_url(self) -> str:
        return (f"https://www.openstreetmap.org/?mlat={self.latitude:.5f}&mlon={self.longitude:.5f}"
                f"#map=11/{self.latitude:.5f}/{self.longitude:.5f}")


@dataclass
class LuckyDay:
    day: date
    score: float
    reasons: List[str]


@dataclass
class Reading:
    chart: Chart
    life_path: int
    center: tuple
    radius: float
    days: int
    partner_signs: List[PartnerSign]
    hotspot: Spot
    alternates: List[Spot]
    alignment: float
    alignment_factors: Dict[str, float]
    lucky_days: List[LuckyDay]
    sky_today: Dict[str, str]
    feeds: FeedReading
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        def spot(s: Spot) -> dict:
            return {**asdict(s), "compass": s.compass, "map": s.map_url}
        return {
            "natal": {b: {"sign": p.sign, "degree": round(astro.degree_in_sign(p.longitude), 2),
                          "altitude": round(p.altitude, 2), "azimuth": round(p.azimuth, 2)}
                      for b, p in self.chart.placements.items()},
            "life_path": self.life_path,
            "center": {"latitude": self.center[0], "longitude": self.center[1]},
            "radius_miles": self.radius,
            "probability_within_radius": 1.0 if self.radius >= 100 else round(self.radius / 100, 3),
            "hotspot": spot(self.hotspot),
            "alignment": round(self.alignment, 3),
            "alignment_factors": {k: round(v, 3) for k, v in self.alignment_factors.items()},
            "alternates": [spot(s) for s in self.alternates],
            "partner_signs": [asdict(p) for p in self.partner_signs],
            "lucky_days": [{"day": d.day.isoformat(), "score": round(d.score, 3), "reasons": d.reasons}
                           for d in self.lucky_days],
            "sky_today": self.sky_today,
            "feeds": {"sources": self.feeds.sources, "failures": self.feeds.failures, "items": self.feeds.items,
                      "venus_retrograde": self.feeds.venus_retrograde,
                      "energy": {s: round(e.energy, 3) for s, e in self.feeds.signs.items() if e.mentions}},
            "notes": self.notes,
        }


def partner_signs(chart: Chart, feeds: FeedReading) -> List[PartnerSign]:
    """Signs in harmony with natal Venus, plus the Descendant's sign, ranked by harmony x feed energy."""
    venus, desc = chart["Venus"].sign, chart["Descendant"].sign
    out = []
    for sign in SIGNS:
        h = harmony(venus, sign)
        why = []
        if h == 1.0:
            why.append(f"shares your Venus's {element_of(sign)}")
        elif h:
            why.append(f"{element_of(sign)} feeds your {element_of(venus)} Venus")
        if sign == desc:
            h = max(h, 1.0) + 0.2
            why.append("sits on your Descendant")
        if not h:
            continue
        energy = feeds.energy(sign) if feeds.available else 0.0
        out.append(PartnerSign(sign, h * (1 + energy) / 2, energy, "; ".join(why)))
    return sorted(out, key=lambda p: -p.weight)


def direction_scores(chart: Chart, partners: List[PartnerSign]) -> List[float]:
    total_partner = sum(p.weight for p in partners) or 1.0
    scores = []
    for b in range(360):
        s = sum(w * kernel(angle_diff(b, chart[body].azimuth)) for body, w in DIRECTION_WEIGHTS.items())
        s += SIGN_WEIGHT * sum(p.weight * kernel(angle_diff(b, sign_bearing(p.sign)), 6)
                               for p in partners) / total_partner
        scores.append(s)
    return scores


def heart_ring(chart: Chart, life_path: int, radius: float) -> float:
    """Miles from you: half from Venus's height at birth, half from your life path."""
    lp = numerology.reduce(life_path, keep_master=False)
    venus_low = (90 - chart["Venus"].altitude) / 180  # 0 overhead .. 1 underfoot
    fraction = 0.5 * venus_low + 0.5 * lp / 9
    return radius * min(0.95, max(0.08, fraction))


def peaks(scores: List[float], count: int, min_gap: int = 40) -> List[int]:
    order = sorted(range(len(scores)), key=lambda i: -scores[i])
    chosen: List[int] = []
    for i in order:
        if all(angle_diff(i, j) >= min_gap for j in chosen):
            chosen.append(i)
        if len(chosen) == count:
            break
    return chosen


def sky_on(day: date) -> Dict[str, float]:
    jd = astro.julian_day(datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc))
    pos = astro.ecliptic_positions(jd)
    return {"Sun": pos["Sun"][0], "Moon": pos["Moon"][0], "Venus": pos["Venus"][0],
            "phase": astro.moon_phase(jd)}


def lucky_days(chart: Chart, partners: List[PartnerSign], start: date, days: int = 30,
               count: int = 3) -> List[LuckyDay]:
    partner_set = {p.sign for p in partners}
    desc = chart["Descendant"].longitude
    natal_venus = chart["Venus"].longitude
    scored = []
    for n in range(days):
        day = start + timedelta(days=n)
        sky = sky_on(day)
        score, reasons = 0.0, []
        for target, label in ((desc, "your Descendant"), (natal_venus, "your natal Venus")):
            sep = angle_diff(sky["Venus"], target)
            for angle, h in ASPECTS.items():
                if abs(sep - angle) <= ORB:
                    strength = h * (1 - abs(sep - angle) / ORB)
                    score += strength
                    if h > 0:
                        name = {0: "conjoins", 60: "sextiles", 120: "trines"}[angle]
                        reasons.append(f"Venus {name} {label}")
        moon_sign = astro.sign_of(sky["Moon"])
        if moon_sign in partner_set:
            score += 0.5
            reasons.append(f"Moon in {moon_sign}, a partner sign")
        if sky["phase"] < 180:
            score += 0.15 * math.sin(math.radians(sky["phase"]))
            if 160 <= sky["phase"] < 200:
                reasons.append("near the Full Moon")
        elif 170 <= sky["phase"] <= 190:
            reasons.append("near the Full Moon")
        if reasons:
            scored.append(LuckyDay(day, score, reasons))
    best = sorted(scored, key=lambda d: -d.score)[:count]
    return sorted(best, key=lambda d: d.day)


def read(chart: Chart, born: date, center: tuple, feeds: FeedReading, today: Optional[date] = None,
         radius: float = 100.0, days: int = 30) -> Reading:
    today = today or datetime.now(timezone.utc).date()
    lp = numerology.life_path(born)
    partners = partner_signs(chart, feeds)
    scores = direction_scores(chart, partners)
    max_possible = sum(DIRECTION_WEIGHTS.values()) + SIGN_WEIGHT
    ring = heart_ring(chart, lp, radius)

    spots = []
    for rank, b in enumerate(peaks(scores, 3)):
        miles = ring if rank == 0 else min(radius, max(1.0, ring * (0.7 + 0.3 * rank)))
        lat, lon = geo.destination(center[0], center[1], b, miles)
        spots.append(Spot(lat, lon, float(b), miles, scores[b] / max_possible))

    sky = sky_on(today)
    venus_today = astro.sign_of(sky["Venus"])
    natal_venus = chart["Venus"].sign
    factors = {
        "line_strength": spots[0].score,
        "venus_transit": harmony(venus_today, natal_venus) or -0.3,
        "moon": math.sin(math.radians(sky["phase"])),  # waxing +, waning -
        "feeds": (sum(p.energy * p.weight for p in partners) / (sum(p.weight for p in partners) or 1)
                  if feeds.available else 0.0),
        "venus_retrograde": -1.0 if feeds.venus_retrograde else 0.0,
    }
    alignment = (0.55 + 0.30 * factors["line_strength"] + 0.06 * factors["venus_transit"]
                 + 0.03 * factors["moon"] + 0.12 * factors["feeds"] + 0.05 * factors["venus_retrograde"])
    alignment = min(0.99, max(0.05, alignment))

    notes = []
    if not feeds.available:
        notes.append("No zodiac feed could be read, so the reading uses your chart and today's sky only.")
    if feeds.venus_retrograde:
        notes.append("The feeds say Venus is retrograde: old flames may resurface; new ones take patience.")
    if radius < 100:
        notes.append(f"You narrowed the search to {radius:g} miles, inside the adage's 100.")

    return Reading(
        chart=chart, life_path=lp, center=center, radius=radius, days=days, partner_signs=partners,
        hotspot=spots[0], alternates=spots[1:], alignment=alignment, alignment_factors=factors,
        lucky_days=lucky_days(chart, partners, today, days),
        sky_today={"Sun": astro.sign_of(sky["Sun"]), "Moon": astro.sign_of(sky["Moon"]), "Venus": venus_today,
                   "phase": astro.phase_name(sky["phase"])},
        feeds=feeds, notes=notes,
    )
