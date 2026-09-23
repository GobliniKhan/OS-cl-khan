"""Domain registration data via RDAP (the structured successor to WHOIS)."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bizosint.core import Context, Finding, Output, Target, module
from bizosint.http import HttpError

RDAP_BOOTSTRAP = "https://rdap.org/domain/"


def vcard_value(entity: Dict[str, Any], field: str) -> Optional[str]:
    for item in (entity.get("vcardArray") or [None, []])[1]:
        if item and item[0] == field:
            value = item[3]
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value if v)
            return str(value).strip() or None
    return None


def parse_entities(entities: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    parsed = {}
    for entity in entities or []:
        info = {
            "name": vcard_value(entity, "fn"),
            "organization": vcard_value(entity, "org"),
            "email": vcard_value(entity, "email"),
            "address": vcard_value(entity, "adr"),
            "handle": entity.get("handle"),
        }
        info = {k: v for k, v in info.items() if v}
        for role in entity.get("roles", []):
            parsed.setdefault(role, info)
        for key, value in parse_entities(entity.get("entities", [])).items():
            parsed.setdefault(key, value)
    return parsed


def parse_rdap(payload: Dict[str, Any]) -> Dict[str, Any]:
    events = {e.get("eventAction"): e.get("eventDate") for e in payload.get("events", [])}
    entities = parse_entities(payload.get("entities", []))
    return {
        "domain": payload.get("ldhName", "").lower(),
        "registrar": (entities.get("registrar") or {}).get("name"),
        "registrant": entities.get("registrant"),
        "created": events.get("registration"),
        "updated": events.get("last changed"),
        "expires": events.get("expiration"),
        "status": payload.get("status", []),
        "nameservers": sorted(ns.get("ldhName", "").lower() for ns in payload.get("nameservers", [])),
        "dnssec": (payload.get("secureDNS") or {}).get("delegationSigned"),
        "contacts": {k: v for k, v in entities.items() if k not in ("registrar", "registrant")},
    }


def parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def registration_findings(info: Dict[str, Any], now: Optional[datetime] = None) -> List[Finding]:
    now = now or datetime.now(timezone.utc)
    findings = []
    expires = parse_date(info.get("expires"))
    if expires:
        days = (expires - now).days
        if days < 0:
            findings.append(Finding("high", "Domain registration has expired", f"Expired {info['expires']}"))
        elif days < 30:
            findings.append(Finding("high", "Domain expires within 30 days", f"Expires {info['expires']}"))
        elif days < 90:
            findings.append(Finding("medium", "Domain expires within 90 days", f"Expires {info['expires']}"))
    statuses = " ".join(info.get("status", [])).lower()
    if "transfer prohibited" not in statuses and info.get("status"):
        findings.append(Finding("low", "No transfer lock on domain", "clientTransferProhibited is not set."))
    if info.get("dnssec") is False:
        findings.append(Finding("info", "DNSSEC not enabled", ""))
    created = parse_date(info.get("created"))
    if created and (now - created).days < 180:
        findings.append(Finding("info", "Recently registered domain", f"Created {info['created']}"))
    return findings


@module("whois", "Registrar, registrant, lifecycle dates and locks via RDAP", "registration")
def run(target: Target, ctx: Context) -> Output:
    try:
        payload = ctx.http.get_json(RDAP_BOOTSTRAP + target.domain, headers={"Accept": "application/rdap+json"})
    except HttpError as exc:
        if exc.status == 404:
            return Output({"registered": False}, [Finding("high", "Domain not found in RDAP", str(exc))])
        raise
    info = parse_rdap(payload)
    return Output(info, registration_findings(info))
