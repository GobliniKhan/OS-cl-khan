"""Subdomain discovery from Certificate Transparency logs (crt.sh)."""

import re
from collections import Counter
from typing import Dict, Iterable, List

from bizosint.core import Context, Finding, Output, Target, module

CRTSH_URL = "https://crt.sh/"

INTERESTING = {
    "remote access": ("vpn", "remote", "citrix", "rdp", "rdweb", "gateway", "sslvpn", "anyconnect", "ra"),
    "authentication": ("sso", "auth", "login", "adfs", "idp", "okta", "identity", "sts"),
    "email": ("mail", "webmail", "owa", "autodiscover", "exchange", "smtp", "imap"),
    "non-production": ("dev", "test", "qa", "uat", "stage", "staging", "sandbox", "demo", "beta", "preprod"),
    "administration": ("admin", "panel", "cpanel", "portal", "manage", "console", "dashboard"),
    "devops": ("jenkins", "gitlab", "git", "jira", "confluence", "ci", "build", "grafana", "kibana", "sonar"),
    "data": ("db", "sql", "mysql", "mongo", "elastic", "backup", "ftp", "files", "s3", "storage"),
    "api": ("api", "graphql", "ws", "rest"),
}


def extract_subdomains(entries: Iterable[Dict], domain: str) -> List[str]:
    names = set()
    for entry in entries:
        for name in str(entry.get("name_value", "")).splitlines():
            name = name.strip().lower().lstrip("*.")
            if name == domain or name.endswith("." + domain):
                names.add(name)
    return sorted(names)


def issuer_org(issuer_name: str) -> str:
    match = re.search(r"\bO=(\"[^\"]+\"|[^,]+)", issuer_name) or re.search(r"\bCN=([^,]+)", issuer_name)
    return match.group(1).strip('" ') if match else "unknown"


def categorize(subdomains: Iterable[str], domain: str) -> Dict[str, List[str]]:
    groups: Dict[str, List[str]] = {}
    for name in subdomains:
        labels = set(re.split(r"[.\-_\d]+", name[: -len(domain)].strip(".")))
        for group, keywords in INTERESTING.items():
            if labels & set(keywords):
                groups.setdefault(group, []).append(name)
    return groups


@module("subdomains", "Subdomains and certificate issuers from Certificate Transparency (crt.sh)", "attack-surface")
def run(target: Target, ctx: Context) -> Output:
    entries = ctx.http.get_json(
        CRTSH_URL, params={"q": f"%.{target.domain}", "output": "json"}, timeout=max(ctx.config.timeout, 60)
    )
    subdomains = extract_subdomains(entries, target.domain)
    issuers = Counter(issuer_org(e.get("issuer_name", "")) for e in entries)
    groups = categorize(subdomains, target.domain)
    findings = [
        Finding("info", f"{group.title()} hosts exposed in CT logs", ", ".join(names[:15]) + (
            f" (+{len(names) - 15} more)" if len(names) > 15 else ""))
        for group, names in sorted(groups.items())
    ]
    limit = ctx.config.max_subdomains
    return Output({
        "certificates_seen": len(entries),
        "subdomain_count": len(subdomains),
        "subdomains": subdomains[:limit],
        "truncated": len(subdomains) > limit,
        "notable": groups,
        "issuers": dict(issuers.most_common(10)),
    }, findings)
