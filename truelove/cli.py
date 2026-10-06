"""truelove: your true love is always within 100 miles of you. The stars say where."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, time, timezone
from typing import List, Optional

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - Python < 3.9
    raise SystemExit("truelove needs Python 3.9+")

from truelove import __version__, astro, oracle, places
from truelove.feeds import DEFAULT_FEEDS, FeedReading, read_feeds
from truelove.geo import compass

FOOTER = "For fun and reflection; astrology does not predict where people are. Go say hello anyway."


def parse_date(text: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"date must be YYYY-MM-DD, got {text!r}")


def parse_time(text: str) -> Optional[time]:
    if text.lower() in ("unknown", "?"):
        return None
    m = re.fullmatch(r"\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*", text, re.I)
    if not m:
        raise argparse.ArgumentTypeError(f"time must look like 14:30 or 2:30pm, got {text!r}")
    hour, minute, ampm = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "").lower()
    if ampm:
        if not 1 <= hour <= 12:
            raise argparse.ArgumentTypeError(f"bad 12-hour time {text!r}")
        hour = hour % 12 + (12 if ampm.startswith("p") else 0)
    if hour > 23 or minute > 59:
        raise argparse.ArgumentTypeError(f"bad time {text!r}")
    return time(hour, minute)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="truelove", formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Your true love is always within 100 miles of you. Give your birth details and "
                    "truelove reads your chart, today's sky and the latest zodiac feeds to name the spot.",
        epilog='example:\n  truelove --born 1994-03-21 --time 6:45am --place "Austin, US"\n\n' + FOOTER)
    p.add_argument("--version", action="version", version=f"truelove {__version__}")
    p.add_argument("-b", "--born", type=parse_date, required=True, help="date of birth, YYYY-MM-DD")
    p.add_argument("-t", "--time", type=parse_time, default=None,
                   help='local time of birth, e.g. 14:30 or 2:30pm ("unknown" uses noon)')
    p.add_argument("-p", "--place", required=True,
                   help='place of birth: a city ("Paris", "Portland, US") or "lat,lon"')
    p.add_argument("--tz", help="IANA time zone of the birth place (needed with lat,lon), e.g. Europe/Paris")
    p.add_argument("-n", "--near", help="where you live now, if not your birth place (city or lat,lon)")
    p.add_argument("-r", "--radius", type=float, default=100.0, help="search radius in miles (default: 100)")
    p.add_argument("-d", "--days", type=int, default=30, help="how far ahead to look for lucky days (default: 30)")
    p.add_argument("--feed", action="append", default=[], metavar="URL",
                   help="extra RSS/Atom feed URL or local file (repeatable)")
    p.add_argument("--only-feeds", action="store_true", help="use only the --feed sources, not the defaults")
    p.add_argument("--no-feeds", "--offline", dest="no_feeds", action="store_true",
                   help="skip the default feeds and online place lookup (--feed sources are still read)")
    p.add_argument("--today", type=parse_date, help=argparse.SUPPRESS)
    p.add_argument("--json", action="store_true", help="print the full reading as JSON")
    return p


def birth_moment(born: date, at: Optional[time], tz: str) -> datetime:
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise SystemExit(f"truelove: unknown time zone {tz!r} (on Windows: pip install tzdata)")
    return datetime.combine(born, at or time(12, 0), tzinfo=zone)


def bar(fraction: float, width: int = 24) -> str:
    filled = round(max(0.0, min(1.0, fraction)) * width)
    return "█" * filled + "░" * (width - filled)


def render(reading: oracle.Reading, born_place: places.Place, near: places.Place, time_known: bool) -> str:
    c = reading.chart
    h = reading.hotspot
    lines: List[str] = []
    add = lines.append
    add("")
    add("  ♥  TRUE LOVE LOCATOR  ♥")
    add("  " + "─" * 46)
    add(f"  Born   {c.when:%d %b %Y, %H:%M} {c.when.tzname() or ''} in {born_place.name}"
        + ("" if time_known else "  (time unknown: noon used)"))
    add(f"  Sun {astro.SIGN_SYMBOLS[astro.SIGNS.index(c['Sun'].sign)]} {c['Sun'].sign}   "
        f"Moon {c['Moon'].sign}   Venus {c['Venus'].sign}   Rising {c['Ascendant'].sign}")
    add(f"  Descendant (partner point) {c['Descendant'].describe().split(' ', 1)[1]}   Life path {reading.life_path}")
    add("")
    within = 100 if reading.radius >= 100 else round(reading.radius)
    add(f"  Chance your true love is within {reading.radius:g} miles of {near.name}:  {within}%  (the adage)")
    add(f"  Cosmic alignment of the hotspot below:  {reading.alignment:.0%}  {bar(reading.alignment)}")
    add("")
    add("  ✦ HOTSPOT")
    add(f"    {h.miles:.0f} miles {h.compass} ({h.bearing:.0f}°) of {near.name}")
    city, gap = places.nearest_city(h.latitude, h.longitude)
    nearby = gap < 150 and city.name != near.name
    add(f"    {h.latitude:.4f}, {h.longitude:.4f}" + (f"  (about {gap:.0f} mi from {city.name})" if nearby else ""))
    add(f"    {h.map_url}")
    add(f"    At your birth Venus stood {astro_dir(c['Venus'])} and your Descendant set in the "
        f"{compass(c['Descendant'].azimuth)}.")
    if reading.alternates:
        add("")
        add("  ✧ ALSO WARM")
        for s in reading.alternates:
            add(f"    {s.miles:.0f} mi {s.compass:<3}  {s.latitude:.4f}, {s.longitude:.4f}   strength {s.score:.0%}")
    add("")
    add("  ♡ LOOK FOR")
    for ps in reading.partner_signs[:3]:
        energy = f"feeds {ps.energy:+.2f}" if reading.feeds.available else ""
        add(f"    {ps.sign:<12} {ps.why}" + (f"  [{energy}]" if energy else ""))
    if reading.lucky_days:
        add("")
        add(f"  ☾ BEST DAYS (next {reading.days} days)")
        for d in reading.lucky_days:
            add(f"    {d.day:%a %d %b}   " + "; ".join(d.reasons))
    add("")
    sky = reading.sky_today
    add(f"  Sky today: Sun in {sky['Sun']}, Moon in {sky['Moon']} ({sky['phase']}), Venus in {sky['Venus']}")
    f = reading.feeds
    if f.available:
        add(f"  Feeds: {f.items} posts from {len(f.sources)} source(s)"
            + (f", {len(f.failures)} unreachable" if f.failures else ""))
        whispers = [w for ps in reading.partner_signs[:3] for w in f.signs[ps.sign].whispers][:2]
        for w in whispers:
            add(f'    "{w}"')
    for note in reading.notes:
        add(f"  Note: {note}")
    add("")
    add("  " + FOOTER)
    add("")
    return "\n".join(lines)


def astro_dir(p: astro.Placement) -> str:
    where = "above the horizon" if p.altitude >= 0 else "below the horizon"
    return f"{where} in the {compass(p.azimuth)}"


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    online = not args.no_feeds
    if not 0 < args.radius <= 100:
        print("truelove: --radius must be between 0 and 100 miles (that's the adage)", file=sys.stderr)
        return 2
    try:
        born_place = places.resolve(args.place, args.tz, online=online)
        near = places.resolve(args.near, None, online=online) if args.near else born_place
    except places.PlaceError as exc:
        print(f"truelove: {exc}", file=sys.stderr)
        return 2
    if not born_place.tz:
        print("truelove: add --tz for the birth place, e.g. --tz America/Chicago", file=sys.stderr)
        return 2

    when = birth_moment(args.born, args.time, born_place.tz)
    chart = astro.cast_chart(when, born_place.latitude, born_place.longitude)

    if args.no_feeds and not args.feed:
        feeds = FeedReading()
    else:
        urls = list(args.feed) + ([] if args.only_feeds or args.no_feeds else list(DEFAULT_FEEDS))
        if not args.json:
            print(f"  Listening to {len(urls)} zodiac feeds...", file=sys.stderr)
        feeds = read_feeds(urls)

    reading = oracle.read(chart, args.born, (near.latitude, near.longitude), feeds,
                          today=args.today, radius=args.radius, days=max(1, args.days))
    if args.time is None:
        reading.notes.append("Without a birth time your Rising sign, Descendant and directions are approximate.")
    if args.json:
        out = reading.to_dict()
        out["birth"] = {"when": when.isoformat(), "place": born_place.name, "time_known": args.time is not None}
        out["near"] = near.name
        print(json.dumps(out, indent=2, default=str))
    else:
        print(render(reading, born_place, near, args.time is not None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
