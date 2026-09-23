"""GitHub organization discovery (public code footprint)."""

from typing import Any, Dict

from bizosint.core import Context, Finding, Output, Target, module

API = "https://api.github.com"


@module("github", "Public GitHub organizations linked to the company", "code", requires=())
def run(target: Target, ctx: Context) -> Output:
    headers = {"Accept": "application/vnd.github+json"}
    if ctx.config.api_keys.get("github"):
        headers["Authorization"] = f"Bearer {ctx.config.api_keys['github']}"
    terms = [t for t in (target.company, target.domain and target.domain.split(".")[0]) if t]
    seen: Dict[str, Dict[str, Any]] = {}
    for term in terms:
        result = ctx.http.get_json(f"{API}/search/users", params={"q": f"{term} type:org", "per_page": 5},
                                   headers=headers)
        for item in result.get("items", []):
            seen.setdefault(item["login"], {"login": item["login"], "url": item["html_url"]})

    orgs = []
    for login, org in list(seen.items())[:6]:
        detail = ctx.http.get_json(f"{API}/orgs/{login}", headers=headers)
        blog, email = detail.get("blog") or "", detail.get("email") or ""
        org.update({
            "name": detail.get("name"),
            "blog": blog or None,
            "location": detail.get("location"),
            "public_repos": detail.get("public_repos"),
            "verified": detail.get("is_verified"),
            "created": detail.get("created_at"),
            "domain_match": bool(target.domain) and (target.domain in blog.lower() or target.domain in email.lower()),
        })
        orgs.append(org)
    orgs.sort(key=lambda o: (not o["domain_match"], not o["verified"], -(o["public_repos"] or 0)))
    findings = [
        Finding("info", "Public source code on GitHub",
                f"{o['url']} ({o['public_repos']} public repos) — review for leaked secrets or internal hostnames.")
        for o in orgs if o["domain_match"] and o["public_repos"]
    ]
    return Output({
        "organizations": orgs,
        "code_search": f"https://github.com/search?type=code&q=%22{target.domain or target.company}%22",
    }, findings)
