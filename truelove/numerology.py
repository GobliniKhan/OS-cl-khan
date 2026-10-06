"""Pythagorean numerology."""

from __future__ import annotations

from datetime import date

MASTER_NUMBERS = (11, 22, 33)


def reduce(n: int, keep_master: bool = True) -> int:
    while n > 9 and not (keep_master and n in MASTER_NUMBERS):
        n = sum(int(c) for c in str(n))
    return n


def life_path(born: date) -> int:
    """Reduce month, day and year separately, then their sum (the method that preserves master numbers)."""
    return reduce(reduce(born.month) + reduce(born.day) + reduce(born.year))
