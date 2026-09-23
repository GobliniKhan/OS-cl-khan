from datetime import datetime, timezone

from bizosint.core import Config, Context, Target
from bizosint.modules import company, github, hosting, keyed, pivots, subdomains, wayback, website, whois
from tests.conftest import html_response, query, text_response

RDAP = {
    "ldhName": "ACME.COM",
    "status": ["client delete prohibited"],
    "events": [
        {"eventAction": "registration", "eventDate": "1999-01-01T00:00:00Z"},
        {"eventAction": "expiration", "eventDate": "2026-10-10T00:00:00Z"},
    ],
    "nameservers": [{"ldhName": "NS2.ACME.COM"}, {"ldhName": "NS1.ACME.COM"}],
    "secureDNS": {"delegationSigned": False},
    "entities": [
        {"roles": ["registrar"], "vcardArray": ["vcard", [["fn", {}, "text", "Example Registrar, Inc."]]]},
        {"roles": ["registrant"], "vcardArray": ["vcard", [["org", {}, "text", "Acme Corp"]]]},
    ],
}


def titles(findings):
    return {f.title for f in findings}


def test_whois_parses_rdap_and_flags_expiry(ctx, fake_http):
    fake_http.route("https://rdap.org/domain/", RDAP)
    out = whois.run(Target(domain="acme.com"), ctx)
    assert out.data["registrar"] == "Example Registrar, Inc."
    assert out.data["registrant"] == {"organization": "Acme Corp"}
    assert out.data["nameservers"] == ["ns1.acme.com", "ns2.acme.com"]
    found = whois.registration_findings(out.data, now=datetime(2026, 9, 23, tzinfo=timezone.utc))
    assert {"Domain expires within 30 days", "No transfer lock on domain", "DNSSEC not enabled"} <= titles(found)


def test_subdomains(ctx, fake_http):
    fake_http.route("https://crt.sh/", [
        {"name_value": "*.acme.com\nacme.com", "issuer_name": 'C=US, O="Let\'s Encrypt", CN=R3'},
        {"name_value": "vpn.acme.com\ndev-api.acme.com", "issuer_name": "C=US, O=DigiCert Inc, CN=DigiCert"},
        {"name_value": "evil-acme.com", "issuer_name": "CN=Self"},
    ])
    out = subdomains.run(Target(domain="acme.com"), ctx)
    assert out.data["subdomains"] == ["acme.com", "dev-api.acme.com", "vpn.acme.com"]
    assert out.data["issuers"] == {"Let's Encrypt": 1, "DigiCert Inc": 1, "Self": 1}
    assert out.data["notable"]["remote access"] == ["vpn.acme.com"]
    assert set(out.data["notable"]) == {"remote access", "non-production", "api"}


def test_hosting(ctx, fake_http):
    fake_http.add_dns("acme.com", "NS", "lara.ns.cloudflare.com.")
    fake_http.add_dns("www.acme.com", "CNAME", "d111.cloudfront.net.")
    fake_http.add_dns("acme.com", "A", "1.2.3.4")
    fake_http.route("https://rdap.org/ip/", {
        "name": "ACME-NET", "country": "US", "startAddress": "1.2.3.0", "endAddress": "1.2.3.255",
        "entities": [{"vcardArray": ["vcard", [["fn", {}, "text", "Amazon.com, Inc."]]]}],
    })
    out = hosting.run(Target(domain="acme.com"), ctx)
    assert out.data["dns_providers"] == ["Cloudflare"]
    assert out.data["web_providers"] == ["Amazon CloudFront"]
    assert out.data["ip_owners"][0]["organization"] == "Amazon.com, Inc."


PAGE = """<html><head><title> Acme  Corp </title>
<meta name="description" content="Rockets and anvils">
<meta name="generator" content="WordPress 6.4">
<link rel="stylesheet" href="/wp-content/themes/acme/style.css">
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-1"></script></head>
<body><a href="https://www.linkedin.com/company/acme-corp/">LinkedIn</a>
<a href="https://twitter.com/intent/tweet">share</a><a href="https://x.com/acmecorp">X</a>
<a href="mailto:sales@acme.com">sales@acme.com</a> hr@eu.acme.com partner@notacme.com
<a href="tel:+1 (555) 010-2000">call</a> logo@2x.png</body></html>"""


def test_website(ctx, fake_http):
    fake_http.route("https://acme.com/robots.txt", lambda u, p: text_response(
        u, "User-agent: *\nDisallow: /admin/ # private\nSitemap: https://acme.com/sitemap.xml"))
    fake_http.route("https://acme.com/.well-known/", lambda u, p: html_response(u, "not found", 404))
    fake_http.route("https://acme.com/", lambda u, p: html_response(
        u, PAGE, headers={"server": "Apache/2.4.1", "x-frame-options": "DENY"}))
    out = website.run(Target(domain="acme.com"), ctx)
    data = out.data
    assert data["title"] == "Acme Corp"
    assert data["description"] == "Rockets and anvils"
    assert {"WordPress", "Apache", "Google Tag Manager", "Generator: WordPress 6.4"} <= set(data["technologies"])
    assert data["emails"]["on_domain"] == ["hr@eu.acme.com", "sales@acme.com"]
    assert data["emails"]["other"] == ["partner@notacme.com"]
    assert data["social"]["linkedin"] == ["https://linkedin.com/company/acme-corp"]
    assert data["social"]["twitter"] == ["https://x.com/acmecorp"]
    assert data["robots"] == {"disallow": ["/admin/"], "sitemaps": ["https://acme.com/sitemap.xml"]}
    assert {"Missing strict-transport-security header", "Software version disclosed in headers",
            "No security.txt published"} <= titles(out.findings)


def test_website_unreachable(ctx):
    out = website.run(Target(domain="acme.com"), ctx)
    assert out.data["reachable"] is False


def test_wayback(ctx, fake_http):
    def cdx(url, params):
        ts = "19990101000000" if params["limit"] == 1 else "20260901120000"
        return [["timestamp", "original", "statuscode"], [ts, "http://acme.com/", "200"]]
    fake_http.route("https://web.archive.org/cdx/", cdx)
    out = wayback.run(Target(domain="acme.com"), ctx)
    assert out.data["first_snapshot"]["date"] == "1999-01-01"
    assert out.data["last_snapshot"]["archive_url"] == "https://web.archive.org/web/20260901120000/http://acme.com/"


def test_normalize_company_name():
    assert company.normalize_name("Acme Holdings, Inc.") == "acme"
    assert company.normalize_name("Procter & Gamble Co") == "procter and gamble"


def test_sec(ctx, fake_http):
    fake_http.route(company.SEC_TICKERS, {
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
        "1": {"cik_str": 1, "ticker": "APLE", "title": "Apple Hospitality REIT, Inc."},
    })
    fake_http.route("https://data.sec.gov/submissions/", {
        "name": "Apple Inc.", "tickers": ["AAPL"], "exchanges": ["Nasdaq"], "sic": "3571",
        "sicDescription": "Electronic Computers", "stateOfIncorporation": "CA",
        "addresses": {"business": {"street1": "One Apple Park Way", "city": "Cupertino", "stateOrCountry": "CA"}},
        "formerNames": [{"name": "APPLE COMPUTER INC"}],
        "filings": {"recent": {"form": ["8-K"], "filingDate": ["2026-09-01"], "accessionNumber": ["0000320193-26-000001"],
                               "primaryDocument": ["a8k.htm"]}},
    })
    out = company.sec(Target(company="Apple"), ctx)
    assert out.data["cik"] == 320193
    assert out.data["business_address"] == "One Apple Park Way, Cupertino, CA"
    assert out.data["recent_filings"][0]["url"].endswith("/320193/000032019326000001/a8k.htm")
    assert "Recent 8-K material event filings" in titles(out.findings)


def test_lei_prefers_exact_name(ctx, fake_http):
    def rec(lei, name):
        return {"attributes": {"lei": lei, "entity": {"legalName": {"name": name}, "jurisdiction": "US",
                                                      "legalAddress": {"city": "Austin", "country": "US"}}}}
    fake_http.route(company.GLEIF_API, {"data": [rec("L1", "Acme Rockets LLC"), rec("L2", "ACME Corp.")]})
    out = company.lei(Target(company="Acme Corporation"), ctx)
    assert [e["lei"] for e in out.data["entities"]] == ["L2", "L1"]
    assert out.data["entities"][1]["legal_address"] == "Austin, US"


def test_wikidata_prefers_domain_match(ctx, fake_http):
    def api(url, params):
        params = query(url, params)
        if params["action"] == "wbsearchentities":
            return {"search": [{"id": "Q1", "label": "Acme (band)"}, {"id": "Q2", "label": "Acme Corp"}]}
        if params.get("props") == "labels":
            return {"entities": {"Q60": {"labels": {"en": {"value": "New York City"}}}}}
        return {"entities": {
            "Q1": {"id": "Q1", "claims": {}},
            "Q2": {"id": "Q2", "labels": {"en": {"value": "Acme Corp"}}, "claims": {
                "P856": [{"mainsnak": {"datavalue": {"value": "https://www.acme.com"}}}],
                "P159": [{"mainsnak": {"datavalue": {"value": {"id": "Q60"}}}}],
                "P571": [{"mainsnak": {"datavalue": {"value": {"time": "+1949-00-00T00:00:00Z"}}}}],
                "P1128": [{"mainsnak": {"datavalue": {"value": {"amount": "+1200"}}}}],
            }},
        }}
    fake_http.route(company.WIKIDATA_API, api)
    out = company.wikidata(Target(domain="acme.com", company="Acme"), ctx)
    assert out.data["match"]["qid"] == "Q2"
    assert out.data["match"]["website_matches_domain"] is True
    assert out.data["profile"] == {"official_website": "https://www.acme.com", "headquarters": "New York City",
                                   "founded": "1949", "employees": "1200"}


def test_github(ctx, fake_http):
    fake_http.route("https://api.github.com/search/users", {"items": [
        {"login": "acme-fans", "html_url": "https://github.com/acme-fans"},
        {"login": "acmecorp", "html_url": "https://github.com/acmecorp"},
    ]})
    fake_http.route("https://api.github.com/orgs/acme-fans", {"blog": "", "public_repos": 50})
    fake_http.route("https://api.github.com/orgs/acmecorp", {"blog": "https://acme.com", "public_repos": 3,
                                                             "is_verified": True})
    out = github.run(Target(domain="acme.com", company="Acme"), ctx)
    assert out.data["organizations"][0]["login"] == "acmecorp"
    assert len(out.findings) == 1


def test_shodan(fake_http):
    ctx = Context(Config(api_keys={"shodan": "k"}), http=fake_http)
    fake_http.add_dns("acme.com", "A", "1.2.3.4")
    fake_http.route("https://api.shodan.io/shodan/host/1.2.3.4",
                    {"ports": [443, 3389], "vulns": ["CVE-2024-0001"], "data": [{"port": 443, "product": "nginx"}]})
    out = keyed.shodan(Target(domain="acme.com"), ctx)
    assert out.data["hosts"][0]["services"] == ["443/nginx"]
    assert {f.severity for f in out.findings} == {"high", "medium"}


def test_pivots_domain_and_company():
    both = pivots.run(Target(domain="acme.com", company="Acme Corp"), None).data
    assert "exposed_files" in both["dorks"] and "corporate_registries" in both["links"]
    assert both["dorks"]["documents"][0]["url"].startswith("https://www.google.com/search?q=site%3Aacme.com")
    company_only = pivots.run(Target(company="Acme Corp"), None).data
    assert "exposed_files" not in company_only["dorks"]
    assert "infrastructure" not in company_only["links"]
