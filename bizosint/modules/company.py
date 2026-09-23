"""Corporate identity from open registries: Wikidata, GLEIF (LEI) and SEC EDGAR."""

import re
from typing import Any, Dict, List, Optional

from bizosint.core import Context, Finding, Output, SkipModule, Target, module

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
GLEIF_API = "https://api.gleif.org/api/v1/lei-records"
SEC_TICKERS = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"

WIKIDATA_PROPERTIES = {
    "P856": "official_website",
    "P571": "founded",
    "P159": "headquarters",
    "P17": "country",
    "P452": "industry",
    "P1128": "employees",
    "P2139": "revenue",
    "P169": "ceo",
    "P112": "founders",
    "P749": "parent_organization",
    "P355": "subsidiaries",
    "P414": "stock_exchange",
    "P249": "ticker",
    "P1278": "lei",
    "P2002": "twitter",
    "P4264": "linkedin_company_id",
    "P2003": "instagram",
}

LEGAL_SUFFIXES = (
    r"incorporated|inc|corporation|corp|company|co|limited|ltd|llc|plc|gmbh|ag|sa|nv|bv|"
    r"holdings?|group|lp|llp|pty|pte|srl|spa|ab|as|oy|kk"
)


def normalize_name(name: str) -> str:
    name = re.sub(r"[^a-z0-9 ]", " ", name.lower().replace("&", " and "))
    name = re.sub(rf"\b({LEGAL_SUFFIXES})\b", " ", name)
    return re.sub(r"\s+", " ", name).strip()


# ---------------------------------------------------------------- Wikidata

def wikidata_value(snak: Dict[str, Any]) -> Optional[Any]:
    value = (snak.get("datavalue") or {}).get("value")
    if isinstance(value, dict):
        if "id" in value:
            return {"qid": value["id"]}
        if "time" in value:
            return value["time"].lstrip("+")[:10].replace("-00", "")
        if "amount" in value:
            return value["amount"].lstrip("+")
        if "text" in value:
            return value["text"]
    return value


@module("wikidata", "Company profile from Wikidata (HQ, industry, execs, parent, subsidiaries, ticker)",
        "business", requires=("company",))
def wikidata(target: Target, ctx: Context) -> Output:
    search = ctx.http.get_json(WIKIDATA_API, params={
        "action": "wbsearchentities", "search": target.company, "language": "en",
        "type": "item", "limit": 5, "format": "json",
    })
    candidates = search.get("search", [])
    if not candidates:
        return Output({"match": None})
    entities = ctx.http.get_json(WIKIDATA_API, params={
        "action": "wbgetentities", "ids": "|".join(c["id"] for c in candidates),
        "props": "claims|labels|descriptions|sitelinks/urls", "languages": "en", "format": "json",
    }).get("entities", {})

    def is_org(qid: str) -> bool:
        return bool(entities.get(qid, {}).get("claims", {}).keys() & {"P452", "P159", "P1128", "P414", "P112"})

    def site_matches(qid: str) -> bool:
        return bool(target.domain) and any(
            target.domain in str(wikidata_value(c.get("mainsnak", {})) or "")
            for c in entities.get(qid, {}).get("claims", {}).get("P856", [])
        )

    ranked = sorted(candidates, key=lambda c: (not site_matches(c["id"]), not is_org(c["id"])))
    best = entities.get(ranked[0]["id"], {})
    profile: Dict[str, Any] = {}
    for prop, key in WIKIDATA_PROPERTIES.items():
        values = [wikidata_value(c.get("mainsnak", {})) for c in best.get("claims", {}).get(prop, [])]
        values = [v for v in values if v is not None]
        if values:
            profile[key] = values if len(values) > 1 else values[0]

    qids = {v["qid"] for vals in profile.values() for v in (vals if isinstance(vals, list) else [vals])
            if isinstance(v, dict)}
    if qids:
        labels = ctx.http.get_json(WIKIDATA_API, params={
            "action": "wbgetentities", "ids": "|".join(sorted(qids)[:50]), "props": "labels",
            "languages": "en", "format": "json",
        }).get("entities", {})

        def label(v: Any) -> Any:
            if isinstance(v, dict):
                return labels.get(v["qid"], {}).get("labels", {}).get("en", {}).get("value", v["qid"])
            return v

        profile = {k: [label(x) for x in v] if isinstance(v, list) else label(v) for k, v in profile.items()}

    qid = best.get("id", ranked[0]["id"])
    return Output({
        "match": {
            "qid": qid,
            "label": best.get("labels", {}).get("en", {}).get("value"),
            "description": best.get("descriptions", {}).get("en", {}).get("value"),
            "url": f"https://www.wikidata.org/wiki/{qid}",
            "wikipedia": best.get("sitelinks", {}).get("enwiki", {}).get("url"),
            "website_matches_domain": site_matches(qid),
        },
        "profile": profile,
        "other_candidates": [
            {"qid": c["id"], "label": c.get("label"), "description": c.get("description")} for c in ranked[1:]
        ],
    })


# ---------------------------------------------------------------- GLEIF

def parse_lei(record: Dict[str, Any]) -> Dict[str, Any]:
    attrs = record.get("attributes", {})
    entity = attrs.get("entity", {})

    def address(addr: Dict[str, Any]) -> str:
        parts = (addr.get("addressLines") or []) + [addr.get("city"), addr.get("region"),
                                                     addr.get("postalCode"), addr.get("country")]
        return ", ".join(p for p in parts if p)

    return {
        "lei": attrs.get("lei"),
        "legal_name": (entity.get("legalName") or {}).get("name"),
        "other_names": [n.get("name") for n in entity.get("otherNames") or []],
        "jurisdiction": entity.get("jurisdiction"),
        "legal_form": (entity.get("legalForm") or {}).get("id"),
        "registered_as": entity.get("registeredAs"),
        "status": entity.get("status"),
        "category": entity.get("category"),
        "legal_address": address(entity.get("legalAddress") or {}),
        "headquarters": address(entity.get("headquartersAddress") or {}),
        "registration_status": (attrs.get("registration") or {}).get("status"),
        "url": f"https://search.gleif.org/#/record/{attrs.get('lei')}",
    }


@module("lei", "Legal entities, jurisdictions and registered addresses from GLEIF (LEI)",
        "business", requires=("company",))
def lei(target: Target, ctx: Context) -> Output:
    payload = ctx.http.get_json(GLEIF_API, params={"filter[fulltext]": target.company, "page[size]": 10})
    records = [parse_lei(r) for r in payload.get("data", [])]
    wanted = normalize_name(target.company)
    records.sort(key=lambda r: normalize_name(r["legal_name"] or "") != wanted)
    return Output({"match_count": len(records), "entities": records})


# ---------------------------------------------------------------- SEC EDGAR

def match_cik(tickers: Dict[str, Dict[str, Any]], company: str) -> Optional[Dict[str, Any]]:
    wanted = normalize_name(company)
    rows = list(tickers.values())
    for row in rows:
        if normalize_name(row["title"]) == wanted or row["ticker"].lower() == company.lower():
            return row
    partial = [r for r in rows if wanted and re.search(rf"\b{re.escape(wanted)}\b", normalize_name(r["title"]))]
    return min(partial, key=lambda r: len(r["title"])) if partial else None


@module("sec", "SEC EDGAR filer profile and recent filings (US-listed companies)",
        "business", requires=("company",))
def sec(target: Target, ctx: Context) -> Output:
    headers = {"User-Agent": ctx.config.user_agent}
    tickers = ctx.memo("sec-tickers", lambda: ctx.http.get_json(SEC_TICKERS, headers=headers))
    row = match_cik(tickers, target.company)
    if row is None:
        raise SkipModule("no SEC-registered company with a ticker matches this name")
    sub = ctx.http.get_json(SEC_SUBMISSIONS.format(cik=int(row["cik_str"])), headers=headers)
    recent = sub.get("filings", {}).get("recent", {})
    descriptions = recent.get("primaryDocDescription") or []
    filings: List[Dict[str, str]] = []
    for i, form in enumerate(recent.get("form", [])[:15]):
        accession = recent["accessionNumber"][i]
        filings.append({
            "form": form,
            "date": recent["filingDate"][i],
            "description": descriptions[i] if i < len(descriptions) else "",
            "url": f"https://www.sec.gov/Archives/edgar/data/{int(row['cik_str'])}/"
                   f"{accession.replace('-', '')}/{recent['primaryDocument'][i]}",
        })
    business = (sub.get("addresses") or {}).get("business") or {}
    findings = []
    if any(f["form"] == "8-K" for f in filings):
        findings.append(Finding("info", "Recent 8-K material event filings", "Review for breaches, M&A, leadership changes."))
    return Output({
        "name": sub.get("name"),
        "cik": row["cik_str"],
        "tickers": sub.get("tickers"),
        "exchanges": sub.get("exchanges"),
        "sic": f"{sub.get('sic')} {sub.get('sicDescription')}",
        "ein": sub.get("ein"),
        "state_of_incorporation": sub.get("stateOfIncorporation"),
        "fiscal_year_end": sub.get("fiscalYearEnd"),
        "business_address": ", ".join(str(business.get(k)) for k in
                                      ("street1", "city", "stateOrCountry", "zipCode") if business.get(k)),
        "phone": sub.get("phone"),
        "website": sub.get("website") or None,
        "former_names": [f.get("name") for f in sub.get("formerNames", [])],
        "recent_filings": filings,
        "edgar_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={row['cik_str']}",
    }, findings)
