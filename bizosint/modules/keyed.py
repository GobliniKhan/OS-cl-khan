"""Modules that need a (free-tier) API key; each is skipped when its key is not configured."""

import base64
from typing import List

from bizosint.core import Context, Finding, Output, Target, module
from bizosint.dns import resolve
from bizosint.http import HttpError

RISKY_PORTS = {
    21: "FTP", 23: "Telnet", 445: "SMB", 1433: "MSSQL", 1521: "Oracle DB", 2375: "Docker API",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 5984: "CouchDB", 6379: "Redis",
    9200: "Elasticsearch", 11211: "Memcached", 27017: "MongoDB",
}


@module("shodan", "Open ports, services and known CVEs for the domain's IPs (Shodan)",
        "attack-surface", api_key="shodan")
def shodan(target: Target, ctx: Context) -> Output:
    key = ctx.config.api_keys["shodan"]
    ips = sorted(set(resolve(ctx, target.domain, "A") + resolve(ctx, f"www.{target.domain}", "A")))
    hosts, findings = [], []
    for ip in ips[:10]:
        try:
            data = ctx.http.get_json(f"https://api.shodan.io/shodan/host/{ip}", params={"key": key})
        except HttpError as exc:
            if exc.status == 404:
                hosts.append({"ip": ip, "indexed": False})
                continue
            raise
        ports: List[int] = sorted(data.get("ports", []))
        vulns = sorted(data.get("vulns", []))
        hosts.append({
            "ip": ip, "indexed": True, "org": data.get("org"), "isp": data.get("isp"), "asn": data.get("asn"),
            "country": data.get("country_name"), "hostnames": data.get("hostnames", []),
            "ports": ports, "vulns": vulns, "last_update": data.get("last_update"),
            "services": sorted({f"{s.get('port')}/{s.get('product') or s.get('_shodan', {}).get('module', '?')}"
                                for s in data.get("data", [])}),
        })
        if vulns:
            findings.append(Finding("high", f"Known vulnerabilities reported on {ip}", ", ".join(vulns[:20])))
        exposed = [f"{p} ({RISKY_PORTS[p]})" for p in ports if p in RISKY_PORTS]
        if exposed:
            findings.append(Finding("medium", f"Sensitive services exposed on {ip}", ", ".join(exposed)))
    return Output({"hosts": hosts}, findings)


@module("hunter", "Email address format and publicly listed staff emails (Hunter.io)",
        "people", api_key="hunter")
def hunter(target: Target, ctx: Context) -> Output:
    data = ctx.http.get_json("https://api.hunter.io/v2/domain-search", params={
        "domain": target.domain, "api_key": ctx.config.api_keys["hunter"], "limit": 10,
    }).get("data", {})
    return Output({
        "organization": data.get("organization"),
        "email_pattern": data.get("pattern"),
        "accept_all": data.get("accept_all"),
        "emails": [
            {k: e.get(k) for k in ("value", "first_name", "last_name", "position", "department", "confidence")}
            for e in data.get("emails", [])
        ],
    })


@module("companies_house", "UK company register search (Companies House)",
        "business", requires=("company",), api_key="companies_house")
def companies_house(target: Target, ctx: Context) -> Output:
    token = base64.b64encode(f"{ctx.config.api_keys['companies_house']}:".encode()).decode()
    data = ctx.http.get_json("https://api.company-information.service.gov.uk/search/companies",
                             params={"q": target.company, "items_per_page": 10},
                             headers={"Authorization": f"Basic {token}"})
    companies = [{
        "name": item.get("title"),
        "number": item.get("company_number"),
        "status": item.get("company_status"),
        "type": item.get("company_type"),
        "incorporated": item.get("date_of_creation"),
        "address": item.get("address_snippet"),
        "url": f"https://find-and-update.company-information.service.gov.uk/company/{item.get('company_number')}",
    } for item in data.get("items", [])]
    return Output({"companies": companies})
