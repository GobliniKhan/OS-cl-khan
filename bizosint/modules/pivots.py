"""Search dorks and OSINT-framework pivot links for manual follow-up (no network requests)."""

from typing import Dict, List, Optional
from urllib.parse import quote, quote_plus

from bizosint.core import Context, Output, Target, module


def google(query: str) -> str:
    return f"https://www.google.com/search?q={quote_plus(query)}"


def dorks(domain: Optional[str], company: Optional[str]) -> Dict[str, List[Dict[str, str]]]:
    site = f"site:{domain}" if domain else ""
    name = f'"{company}"' if company else f'"{domain}"'
    groups: Dict[str, List[str]] = {
        "documents": [
            f"{site} (filetype:pdf OR filetype:docx OR filetype:xlsx OR filetype:pptx)",
            f"{site} (filetype:pdf OR filetype:docx) (confidential OR internal OR \"not for distribution\")",
            f"{name} (filetype:pdf) (\"annual report\" OR \"org chart\" OR \"employee handbook\")",
        ] if domain else [f"{name} filetype:pdf (\"annual report\" OR \"org chart\")"],
        "exposed_files": [
            f"{site} (ext:sql OR ext:bak OR ext:log OR ext:env OR ext:cfg OR ext:ini OR ext:conf)",
            f"{site} intitle:\"index of\"",
            f"{site} (inurl:phpinfo OR inurl:.git OR inurl:wp-config OR inurl:debug)",
        ] if domain else [],
        "login_portals": [
            f"{site} (inurl:login OR inurl:signin OR inurl:admin OR inurl:portal OR intitle:login)",
            f"site:{domain} -site:www.{domain} (inurl:vpn OR inurl:remote OR inurl:owa OR inurl:citrix)",
        ] if domain else [],
        "people": [
            f"site:linkedin.com/in {name}",
            f"site:linkedin.com/company {name}",
            f"{name} (\"chief executive\" OR CEO OR CFO OR CTO OR CISO OR \"head of\")",
        ] + ([f"\"@{domain}\" -site:{domain} (email OR contact)"] if domain else []),
        "hiring_and_tech": [
            f"{name} (site:greenhouse.io OR site:lever.co OR site:workable.com OR site:myworkdayjobs.com)",
            f"{name} jobs (AWS OR Azure OR GCP OR Kubernetes OR Salesforce OR SAP)",
        ],
        "code_and_pastes": [
            f"(site:github.com OR site:gitlab.com OR site:bitbucket.org) \"{domain or company}\"",
            f"(site:pastebin.com OR site:ghostbin.site OR site:rentry.co) \"{domain or company}\"",
            f"site:trello.com \"{domain or company}\"",
        ],
        "cloud_storage": [
            f"(site:s3.amazonaws.com OR site:blob.core.windows.net OR site:storage.googleapis.com) "
            f"\"{domain or company}\"",
            f"(site:docs.google.com OR site:drive.google.com OR site:sharepoint.com) \"{domain or company}\"",
        ],
        "reputation": [
            f"{name} (lawsuit OR settlement OR fine OR investigation OR \"class action\")",
            f"{name} (breach OR hacked OR ransomware OR \"data leak\")",
            f"{name} (site:glassdoor.com OR site:indeed.com OR site:trustpilot.com OR site:bbb.org)",
        ],
    }
    return {
        group: [{"query": q.strip(), "url": google(q.strip())} for q in queries]
        for group, queries in groups.items() if queries
    }


def links(domain: Optional[str], company: Optional[str]) -> Dict[str, Dict[str, str]]:
    d, c = domain or "", quote_plus(company or "")
    out: Dict[str, Dict[str, str]] = {}
    if domain:
        out["infrastructure"] = {
            "Shodan": f"https://www.shodan.io/search?query=hostname%3A{d}",
            "Censys": f"https://search.censys.io/search?resource=hosts&q={d}",
            "SecurityTrails": f"https://securitytrails.com/domain/{d}/dns",
            "DNSDumpster": "https://dnsdumpster.com/",
            "ViewDNS reverse IP": f"https://viewdns.info/reverseip/?host={d}&t=1",
            "BuiltWith": f"https://builtwith.com/{d}",
            "crt.sh": f"https://crt.sh/?q=%25.{d}",
            "urlscan.io": f"https://urlscan.io/search/#domain%3A{d}",
            "VirusTotal": f"https://www.virustotal.com/gui/domain/{d}",
            "SSL Labs": f"https://www.ssllabs.com/ssltest/analyze.html?d={d}",
            "Security Headers": f"https://securityheaders.com/?q={d}&followRedirects=on",
            "MXToolbox": f"https://mxtoolbox.com/SuperTool.aspx?action=mx%3a{d}",
        }
        out["breaches_and_leaks"] = {
            "Have I Been Pwned (domain)": "https://haveibeenpwned.com/DomainSearch",
            "IntelX": f"https://intelx.io/?s={d}",
            "GitHub code search": f"https://github.com/search?type=code&q=%22{d}%22",
            "Grep.app": f"https://grep.app/search?q={d}",
            "Postman public workspaces": f"https://www.postman.com/search?q={d}",
        }
        out["people"] = {
            "Hunter.io": f"https://hunter.io/search/{d}",
            "Phonebook.cz": "https://phonebook.cz/",
        }
    if company:
        out["corporate_registries"] = {
            "OpenCorporates": f"https://opencorporates.com/companies?q={c}",
            "GLEIF LEI search": f"https://search.gleif.org/#/search/simpleSearch={quote(company)}",
            "SEC EDGAR full-text": f"https://www.sec.gov/edgar/search/#/q=%22{c}%22",
            "SEC EDGAR company": f"https://www.sec.gov/cgi-bin/browse-edgar?company={c}&type=&dateb=&owner=include",
            "UK Companies House": f"https://find-and-update.company-information.service.gov.uk/search/companies?q={c}",
            "OpenSanctions": f"https://www.opensanctions.org/search/?q={c}",
            "ICIJ Offshore Leaks": f"https://offshoreleaks.icij.org/search?q={c}",
            "USAspending (contracts)": f"https://www.usaspending.gov/search/?hash=&keyword={c}",
            "SAM.gov entities": f"https://sam.gov/search/?keywords={c}&index=ei",
            "USPTO trademarks": f"https://tmsearch.uspto.gov/search/search-results?query={c}",
        }
        out["business_profile"] = {
            "LinkedIn": f"https://www.linkedin.com/search/results/companies/?keywords={c}",
            "Crunchbase": f"https://www.crunchbase.com/textsearch?q={c}",
            "Glassdoor": f"https://www.glassdoor.com/Search/results.htm?keyword={c}",
            "Better Business Bureau": f"https://www.bbb.org/search?find_text={c}",
            "Trustpilot": f"https://www.trustpilot.com/search?query={c}",
            "Google News": f"https://news.google.com/search?q=%22{c}%22",
            "Justia dockets": f"https://dockets.justia.com/search?parties={c}",
            "CourtListener": f"https://www.courtlistener.com/?q=%22{c}%22",
        }
    return out


@module("pivots", "Search-engine dorks and OSINT Framework pivot links for manual follow-up",
        "pivots", requires=())
def run(target: Target, ctx: Context) -> Output:
    return Output({"dorks": dorks(target.domain, target.company), "links": links(target.domain, target.company)})
