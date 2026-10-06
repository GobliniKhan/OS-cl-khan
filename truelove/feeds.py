"""Read the latest zodiac feeds (RSS or Atom) and score each sign's current love energy.

Every item that names a sign counts toward that sign. Its love energy is the balance of romantic words
("attraction", "soulmate", "chemistry"...) against blocking words ("breakup", "delay", "retrograde"...).
"""

from __future__ import annotations

import html
import re
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from truelove.astro import SIGNS

# Public astrology blogs and horoscope feeds. Any RSS or Atom URL works; add more with --feed.
DEFAULT_FEEDS = (
    "https://astrostyle.com/feed/",
    "https://cafeastrology.com/feed",
    "https://chaninicholas.com/feed/",
    "https://www.astrobutterfly.com/feed/",
    "https://www.costarastrology.com/feed",
    "https://www.astrology.com/feed",
)

LOVE_WORDS = {
    "love", "loving", "romance", "romantic", "partner", "partnership", "attraction", "attract", "magnetic",
    "soulmate", "soul mate", "chemistry", "crush", "flirt", "flirty", "date", "dating", "heart", "passion",
    "passionate", "kiss", "desire", "sweet", "tender", "intimacy", "intimate", "connection", "commitment",
    "devotion", "harmony", "affection", "sparks", "spark", "meet", "encounter", "venus", "beloved", "union",
}
BLOCK_WORDS = {
    "breakup", "break up", "conflict", "argument", "tension", "jealous", "jealousy", "lonely", "loneliness",
    "delay", "delays", "caution", "careful", "withdraw", "distance", "cold", "heartbreak", "misunderstanding",
    "retrograde", "frustration", "setback", "ex", "drama", "ghost", "ghosting", "rejection",
}
_SIGN_RE = re.compile(r"\b(" + "|".join(SIGNS) + r")s?\b", re.I)
_WORD_RE = re.compile(r"[a-z]+(?: (?:mate|up))?")
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class SignEnergy:
    sign: str
    love: int = 0
    block: int = 0
    mentions: int = 0
    whispers: List[str] = field(default_factory=list)

    @property
    def energy(self) -> float:
        """-1 (stars say wait) .. +1 (stars say go), shrunk toward 0 when the feeds say little."""
        return (self.love - self.block) / (self.love + self.block + 3)


@dataclass
class FeedReading:
    sources: List[str] = field(default_factory=list)
    failures: Dict[str, str] = field(default_factory=dict)
    items: int = 0
    venus_retrograde: bool = False
    signs: Dict[str, SignEnergy] = field(default_factory=lambda: {s: SignEnergy(s) for s in SIGNS})

    @property
    def available(self) -> bool:
        return self.items > 0

    def energy(self, sign: str) -> float:
        return self.signs[sign].energy


def _text(node: Optional[ET.Element]) -> str:
    if node is None:
        return ""
    raw = "".join(node.itertext()) if len(node) else (node.text or "")
    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub(" ", html.unescape(raw)))).strip()


def parse_feed(xml_text: str) -> List[str]:
    """Title + summary of each RSS <item> or Atom <entry>."""
    root = ET.fromstring(xml_text.lstrip("﻿ \r\n\t"))
    items = []
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag not in ("item", "entry"):
            continue
        parts = []
        for child in el:
            ctag = child.tag.rsplit("}", 1)[-1]
            if ctag in ("title", "description", "summary", "content", "encoded"):
                parts.append(_text(child))
        text = " ".join(p if re.search(r"[.!?:]$", p) else p + "." for p in parts if p)
        if text:
            items.append(text)
    return items


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def score_items(items: List[str], reading: Optional[FeedReading] = None) -> FeedReading:
    reading = reading or FeedReading()
    for item in items:
        reading.items += 1
        if re.search(r"venus (?:stations |turns |goes )?retrograde|venus rx", item, re.I):
            reading.venus_retrograde = True
        for sentence in _sentences(item):
            named = {m.group(1).capitalize() for m in _SIGN_RE.finditer(sentence)}
            if not named:
                continue
            words = _WORD_RE.findall(sentence.lower())
            love = sum(w in LOVE_WORDS for w in words)
            block = sum(w in BLOCK_WORDS for w in words)
            for sign in named:
                energy = reading.signs[sign]
                energy.mentions += 1
                energy.love += love
                energy.block += block
                if love > block and len(energy.whispers) < 3 and 30 <= len(sentence) < 280:
                    energy.whispers.append(sentence)
    return reading


def fetch(url: str, timeout: float) -> str:
    if not re.match(r"https?://", url):
        return Path(url).read_text(encoding="utf-8", errors="replace")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (truelove/0.1; zodiac feed reader)",
                                               "Accept": "application/rss+xml, application/atom+xml, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(3 * 1024 * 1024).decode("utf-8", errors="replace")


def read_feeds(urls=DEFAULT_FEEDS, timeout: float = 8.0) -> FeedReading:
    """Fetch every feed concurrently. Feeds that fail are recorded and skipped."""
    reading = FeedReading()

    def grab(url: str):
        try:
            return url, parse_feed(fetch(url, timeout)), None
        except Exception as exc:
            return url, [], f"{type(exc).__name__}: {exc}"[:160]

    with ThreadPoolExecutor(max_workers=8) as pool:
        for url, items, error in pool.map(grab, list(urls)):
            if error:
                reading.failures[url] = error
            elif items:
                reading.sources.append(url)
                score_items(items, reading)
            else:
                reading.failures[url] = "no items"
    return reading
