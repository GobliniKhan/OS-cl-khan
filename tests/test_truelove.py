import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from truelove import astro, cli, feeds, geo, numerology, oracle, places

SAMPLE_FEED = Path(__file__).resolve().parent.parent / "examples" / "zodiac-feed.xml"


def wrap(delta: float) -> float:
    return abs((delta + 180) % 360 - 180)


# Reference values from PyEphem (VSOP87 / ELP), geocentric, equinox of date.
@pytest.mark.parametrize("when, body, longitude, tolerance", [
    (datetime(2000, 1, 1, 12, tzinfo=timezone.utc), "Sun", 280.37, 0.05),
    (datetime(2000, 1, 1, 12, tzinfo=timezone.utc), "Moon", 223.32, 0.3),
    (datetime(2000, 1, 1, 12, tzinfo=timezone.utc), "Venus", 241.57, 0.1),
    (datetime(1990, 4, 19, 0, tzinfo=timezone.utc), "Sun", 28.68, 0.05),
    (datetime(1990, 4, 19, 0, tzinfo=timezone.utc), "Moon", 306.95, 0.3),
    (datetime(1990, 4, 19, 0, tzinfo=timezone.utc), "Venus", 343.31, 0.1),
])
def test_ecliptic_longitudes(when, body, longitude, tolerance):
    pos = astro.ecliptic_positions(astro.julian_day(when))
    assert wrap(pos[body][0] - longitude) < tolerance


def test_sun_signs_on_known_birthdays():
    for (y, m, d), sign in [((1990, 7, 15), "Cancer"), ((1994, 3, 25), "Aries"), ((1985, 12, 1), "Sagittarius")]:
        chart = astro.cast_chart(datetime(y, m, d, 12, tzinfo=timezone.utc), 0, 0)
        assert chart["Sun"].sign == sign


@pytest.mark.parametrize("lat", [-55, -20, 0, 35, 60])
def test_ascendant_rises_in_the_east_and_descendant_sets_in_the_west(lat):
    for hour in range(0, 24, 3):
        chart = astro.cast_chart(datetime(2001, 5, 5, hour, tzinfo=timezone.utc), lat, 10)
        asc, dsc = chart["Ascendant"], chart["Descendant"]
        assert abs(asc.altitude) < 1e-6 and abs(dsc.altitude) < 1e-6
        assert 0 < asc.azimuth < 180 < dsc.azimuth < 360


def test_moon_phase_names():
    assert astro.phase_name(0) == "New Moon"
    assert astro.phase_name(180) == "Full Moon"
    assert astro.phase_name(95) == "First Quarter"


def test_life_path_keeps_master_numbers():
    assert numerology.life_path(date(1990, 7, 15)) == 5
    assert numerology.life_path(date(1985, 11, 29)) == 9
    assert numerology.life_path(date(1990, 2, 8)) == 11  # 2 + 8 + (1990 -> 19 -> 1)
    assert numerology.reduce(11, keep_master=False) == 2


def test_geo_round_trip():
    lat, lon = geo.destination(40.7128, -74.0060, 225, 60)
    assert geo.distance(40.7128, -74.0060, lat, lon) == pytest.approx(60, abs=0.01)
    assert geo.bearing(40.7128, -74.0060, lat, lon) == pytest.approx(225, abs=0.5)
    assert geo.compass(225) == "SW" and geo.compass(359) == "N"


def test_places_resolve_offline():
    assert places.resolve("paris", online=False).tz == "Europe/Paris"
    assert places.resolve("NYC", online=False).name == "New York, US"
    assert places.resolve("Portland, US", online=False).latitude == pytest.approx(45.5152)
    coords = places.resolve("-33.9, 18.4", tz="Africa/Johannesburg", online=False)
    assert (coords.latitude, coords.longitude, coords.tz) == (-33.9, 18.4, "Africa/Johannesburg")
    with pytest.raises(places.PlaceError):
        places.resolve("Atlantis", online=False)
    with pytest.raises(places.PlaceError):
        places.resolve("95, 10", online=False)


def test_feed_scoring_reads_rss_and_atom():
    rss = feeds.read_feeds([str(SAMPLE_FEED)])
    assert rss.available and not rss.failures
    assert rss.energy("Aries") > 0.3
    assert rss.energy("Scorpio") < 0
    assert rss.energy("Taurus") == 0
    assert rss.signs["Aries"].whispers

    atom = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Venus retrograde</title>
      <summary>Venus stations retrograde. Taurus, love asks for patience and caution.</summary></entry></feed>"""
    reading = feeds.score_items(feeds.parse_feed(atom))
    assert reading.venus_retrograde
    assert reading.energy("Taurus") < 0.2


def test_unreachable_feed_is_recorded_not_fatal(tmp_path):
    reading = feeds.read_feeds([str(tmp_path / "missing.xml"), str(SAMPLE_FEED)])
    assert len(reading.failures) == 1 and reading.sources == [str(SAMPLE_FEED)]


def chart_for(when="1990-07-15T14:30", tz="Europe/Paris", lat=48.8566, lon=2.3522):
    return astro.cast_chart(datetime.fromisoformat(when).replace(tzinfo=ZoneInfo(tz)), lat, lon)


def test_reading_hotspot_is_within_radius_and_follows_venus():
    chart = chart_for()
    reading = oracle.read(chart, date(1990, 7, 15), (51.5074, -0.1278), feeds.FeedReading(),
                          today=date(2026, 10, 6))
    for spot in [reading.hotspot] + reading.alternates:
        assert 1 <= spot.miles <= 100
        assert geo.distance(51.5074, -0.1278, spot.latitude, spot.longitude) == pytest.approx(spot.miles, abs=0.01)
    assert oracle.angle_diff(reading.hotspot.bearing, chart["Venus"].azimuth) < 45
    assert 0.05 <= reading.alignment <= 0.99
    assert all(date(2026, 10, 6) <= d.day < date(2026, 11, 5) for d in reading.lucky_days)
    assert reading.partner_signs[0].sign == chart["Descendant"].sign
    assert "No zodiac feed" in reading.notes[0]


def test_feeds_move_the_reading():
    chart = chart_for()
    quiet = oracle.read(chart, date(1990, 7, 15), (48.85, 2.35), feeds.FeedReading(), today=date(2026, 10, 6))
    loud = oracle.read(chart, date(1990, 7, 15), (48.85, 2.35), feeds.read_feeds([str(SAMPLE_FEED)]),
                       today=date(2026, 10, 6))
    assert loud.alignment > quiet.alignment
    assert loud.alignment_factors["feeds"] > 0


def test_radius_narrows_the_ring():
    chart = chart_for()
    reading = oracle.read(chart, date(1990, 7, 15), (48.85, 2.35), feeds.FeedReading(), radius=10,
                          today=date(2026, 10, 6))
    assert reading.hotspot.miles <= 10
    assert reading.to_dict()["probability_within_radius"] == 0.1


def test_cli_text_and_json(capsys):
    args = ["--born", "1990-07-15", "--time", "2:30pm", "--place", "Paris", "--near", "London",
            "--no-feeds", "--today", "2026-10-06"]
    assert cli.main(args) == 0
    text = capsys.readouterr().out
    assert "HOTSPOT" in text and "100%" in text and "Cancer" in text

    assert cli.main(args + ["--json", "--feed", str(SAMPLE_FEED)]) == 0
    data = json.loads(capsys.readouterr().out)
    assert data["near"] == "London, GB"
    assert data["natal"]["Sun"]["sign"] == "Cancer"
    assert data["birth"]["when"] == "1990-07-15T14:30:00+02:00"
    assert data["feeds"]["sources"] == [str(SAMPLE_FEED)]


def test_cli_inputs(capsys):
    assert cli.parse_time("2:30pm").hour == 14
    assert cli.parse_time("12am").hour == 0
    assert cli.parse_time("unknown") is None
    assert cli.main(["--born", "1990-07-15", "--place", "10,10", "--no-feeds"]) == 2
    assert "--tz" in capsys.readouterr().err
    assert cli.main(["--born", "1990-07-15", "--place", "Paris", "--radius", "500", "--no-feeds"]) == 2
    assert cli.main(["--born", "1990-07-15", "--place", "10,10", "--tz", "Africa/Lagos", "--no-feeds"]) == 0
    assert "approximate" in capsys.readouterr().out
