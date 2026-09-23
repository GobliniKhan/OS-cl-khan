"""DNS resolution over HTTPS (DoH JSON API), so no resolver library is needed."""

from __future__ import annotations

import re
from typing import List

from bizosint.core import Context
from bizosint.http import HttpError

DOH_ENDPOINTS = ("https://cloudflare-dns.com/dns-query", "https://dns.google/resolve")
RECORD_TYPES = {1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 257: "CAA"}
_TXT_SEGMENT = re.compile(r'"((?:[^"\\]|\\.)*)"')


def unquote_txt(data: str) -> str:
    """Join the quoted character-strings of a TXT record into a single value."""
    segments = _TXT_SEGMENT.findall(data)
    return "".join(segments).replace('\\"', '"') if segments else data


def resolve(ctx: Context, name: str, rtype: str) -> List[str]:
    """Return the record data for `name`/`rtype`; empty list for NXDOMAIN or no answer."""
    return ctx.memo(("dns", name.lower(), rtype), lambda: _query(ctx, name, rtype))


def _query(ctx: Context, name: str, rtype: str) -> List[str]:
    errors = []
    for endpoint in DOH_ENDPOINTS:
        try:
            payload = ctx.http.get_json(
                endpoint,
                params={"name": name, "type": rtype},
                headers={"Accept": "application/dns-json"},
            )
        except HttpError as exc:
            errors.append(str(exc))
            continue
        if payload.get("Status") not in (0, 3):  # NOERROR / NXDOMAIN
            errors.append(f"{endpoint}: DNS status {payload.get('Status')}")
            continue
        answers = []
        for answer in payload.get("Answer") or []:
            if RECORD_TYPES.get(answer.get("type")) != rtype:
                continue
            data = str(answer.get("data", "")).strip()
            answers.append(unquote_txt(data) if rtype == "TXT" else data.rstrip("."))
        return sorted(set(answers))
    raise HttpError(f"DNS lookup {name}/{rtype} failed: {'; '.join(errors)}")
