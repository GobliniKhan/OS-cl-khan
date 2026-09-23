"""Public website profile: tech stack, security headers, contacts, social accounts, robots/security.txt."""

import re
from html.parser import HTMLParser
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bizosint.core import Context, Finding, Output, Target, module
from bizosint.http import HttpError

SECURITY_HEADERS = {
    "strict-transport-security": "low",
    "content-security-policy": "low",
    "x-frame-options": "info",
    "x-content-type-options": "info",
    "referrer-policy": "info",
    "permissions-policy": "info",
}

# name -> (where, regex). `where` is "header:<name>", "headers" (any header name/value) or "html".
TECH_SIGNATURES = {
    "Cloudflare": ("headers", r"cf-ray|cloudflare"),
    "Akamai": ("headers", r"akamai"),
    "Fastly": ("headers", r"fastly|x-served-by: cache-"),
    "Amazon CloudFront": ("headers", r"cloudfront"),
    "Vercel": ("headers", r"x-vercel|server: vercel"),
    "Netlify": ("headers", r"netlify"),
    "nginx": ("header:server", r"nginx"),
    "Apache": ("header:server", r"apache"),
    "Microsoft IIS": ("header:server", r"iis"),
    "LiteSpeed": ("header:server", r"litespeed"),
    "PHP": ("header:x-powered-by", r"php"),
    "ASP.NET": ("headers", r"asp\.net"),
    "Express": ("header:x-powered-by", r"express"),
    "WordPress": ("html", r"wp-content|wp-includes"),
    "Drupal": ("html", r"drupal-settings-json|/sites/default/files"),
    "Joomla": ("html", r"/media/jui/|joomla"),
    "Shopify": ("html", r"cdn\.shopify\.com|shopify\.theme"),
    "Magento": ("html", r"mage/cookies|magento"),
    "Wix": ("html", r"static\.wixstatic\.com|wix\.com website builder"),
    "Squarespace": ("html", r"static1\.squarespace\.com"),
    "Webflow": ("html", r"webflow\.js|data-wf-site"),
    "HubSpot": ("html", r"js\.hs-scripts\.com|hs-analytics|hubspot"),
    "Next.js": ("html", r"__next_data__|/_next/static"),
    "Nuxt": ("html", r"__nuxt|/_nuxt/"),
    "React": ("html", r"data-reactroot|react-dom"),
    "Angular": ("html", r"ng-version="),
    "Vue.js": ("html", r"data-v-[0-9a-f]{6,}|vue(\.min)?\.js"),
    "jQuery": ("html", r"jquery[.-]"),
    "Bootstrap": ("html", r"bootstrap(\.min)?\.(css|js)"),
    "Google Tag Manager": ("html", r"googletagmanager\.com/gtm|gtm\.js"),
    "Google Analytics": ("html", r"google-analytics\.com|gtag\(|googletagmanager\.com/gtag"),
    "Meta Pixel": ("html", r"connect\.facebook\.net/.+/fbevents\.js"),
    "LinkedIn Insight": ("html", r"snap\.licdn\.com"),
    "Hotjar": ("html", r"static\.hotjar\.com"),
    "Segment": ("html", r"cdn\.segment\.com"),
    "Intercom": ("html", r"widget\.intercom\.io"),
    "Drift": ("html", r"js\.driftt\.com"),
    "Zendesk": ("html", r"static\.zdassets\.com"),
    "Salesforce": ("html", r"force\.com|salesforce"),
    "Marketo": ("html", r"munchkin\.marketo\.net"),
    "Pardot": ("html", r"pi\.pardot\.com"),
    "OneTrust": ("html", r"cdn\.cookielaw\.org|onetrust"),
    "Cookiebot": ("html", r"consent\.cookiebot\.com"),
    "reCAPTCHA": ("html", r"google\.com/recaptcha"),
    "Stripe": ("html", r"js\.stripe\.com"),
    "Optimizely": ("html", r"cdn\.optimizely\.com"),
}

SOCIAL_PATTERNS = {
    "linkedin": r"linkedin\.com/(company|school|showcase)/[^/?#\"']+",
    "twitter": r"(twitter|x)\.com/(?!intent|share|home)[A-Za-z0-9_]{1,15}",
    "facebook": r"facebook\.com/(?!sharer|share|dialog|tr\b)[A-Za-z0-9.\-]+",
    "instagram": r"instagram\.com/[A-Za-z0-9_.]+",
    "youtube": r"youtube\.com/(channel/|c/|user/|@)[A-Za-z0-9_\-]+",
    "github": r"github\.com/[A-Za-z0-9\-]+",
    "tiktok": r"tiktok\.com/@[A-Za-z0-9_.]+",
    "glassdoor": r"glassdoor\.[a-z.]+/[^\"'\s]+",
    "crunchbase": r"crunchbase\.com/organization/[a-z0-9\-]+",
}

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:tel:|\+)[\d\s().\-]{7,20}\d")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta: Dict[str, str] = {}
        self.links: List[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: List) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (attr.get("name") or attr.get("property") or "").lower()
            if key and attr.get("content"):
                self.meta[key] = attr["content"].strip()
        elif tag in ("a", "link") and attr.get("href"):
            self.links.append(attr["href"])
        elif tag == "script" and attr.get("src"):
            self.links.append(attr["src"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def detect_technologies(headers: Dict[str, str], html: str) -> List[str]:
    header_blob = "\n".join(f"{k}: {v}" for k, v in headers.items()).lower()
    html_lower = html.lower()
    found = []
    for name, (where, pattern) in TECH_SIGNATURES.items():
        if where == "html":
            haystack = html_lower
        elif where == "headers":
            haystack = header_blob
        else:
            haystack = headers.get(where.split(":", 1)[1], "").lower()
        if re.search(pattern, haystack):
            found.append(name)
    generator = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', html, re.IGNORECASE)
    if generator:
        found.append(f"Generator: {generator.group(1)}")
    return sorted(found)


def extract_social(links: List[str], html: str) -> Dict[str, List[str]]:
    blob = "\n".join(links) + "\n" + html
    social = {}
    for network, pattern in SOCIAL_PATTERNS.items():
        matches = {m.group(0).rstrip("/.").lower() for m in re.finditer(pattern, blob, re.IGNORECASE)}
        if matches:
            social[network] = sorted(f"https://{m}" for m in matches)[:5]
    return social


def extract_emails(html: str, domain: str) -> Dict[str, List[str]]:
    emails = {e.lower() for e in EMAIL_RE.findall(html)}
    emails = {e for e in emails if not re.search(r"\.(png|jpe?g|gif|svg|webp|css|js)$", e) and "example" not in e}
    own = sorted(e for e in emails if re.fullmatch(rf"(.+\.)?{re.escape(domain)}", e.split("@", 1)[1]))
    return {"on_domain": own, "other": sorted(emails - set(own))[:20]}


def parse_robots(text: str) -> Dict[str, List[str]]:
    disallow, sitemaps = set(), set()
    for line in text.splitlines():
        key, _, value = line.partition(":")
        key, value = key.strip().lower(), value.split("#", 1)[0].strip()
        if key == "disallow" and value:
            disallow.add(value)
        elif key == "sitemap" and value:
            sitemaps.add(line.split(":", 1)[1].strip())
    return {"disallow": sorted(disallow)[:50], "sitemaps": sorted(sitemaps)}


def fetch_text(ctx: Context, url: str) -> Optional[str]:
    try:
        resp = ctx.http.get(url)
    except HttpError:
        return None
    if resp.status != 200 or "html" in resp.headers.get("content-type", ""):
        return None
    return resp.text


@module("website", "Website profile: tech stack, security headers, contacts, social links, robots.txt", "web")
def run(target: Target, ctx: Context) -> Output:
    resp = None
    errors = []
    for url in (f"https://{target.domain}/", f"https://www.{target.domain}/", f"http://{target.domain}/"):
        try:
            resp = ctx.http.get(url, headers={"Accept": "text/html,*/*"})
            break
        except HttpError as exc:
            errors.append(str(exc))
    if resp is None:
        return Output({"reachable": False, "errors": errors},
                      [Finding("info", "Website not reachable", "; ".join(errors)[:300])])

    html = resp.text
    page = PageParser()
    try:
        page.feed(html)
    except Exception:  # malformed markup should not sink the module
        pass
    base = resp.url
    hosts = sorted({urlparse(urljoin(base, link)).hostname or "" for link in page.links} - {""})
    headers = resp.headers
    findings = []

    if urlparse(resp.url).scheme != "https":
        findings.append(Finding("medium", "Website served without HTTPS", resp.url))
    missing = [h for h in SECURITY_HEADERS if h not in headers]
    for header in missing:
        if SECURITY_HEADERS[header] != "info":
            findings.append(Finding(SECURITY_HEADERS[header], f"Missing {header} header", resp.url))
    if [h for h in missing if SECURITY_HEADERS[h] == "info"]:
        findings.append(Finding("info", "Missing hardening headers",
                                ", ".join(h for h in missing if SECURITY_HEADERS[h] == "info")))
    for header in ("server", "x-powered-by", "x-aspnet-version", "x-generator"):
        if re.search(r"\d", headers.get(header, "")):
            findings.append(Finding("low", "Software version disclosed in headers", f"{header}: {headers[header]}"))

    robots_text = fetch_text(ctx, urljoin(base, "/robots.txt"))
    security_txt = fetch_text(ctx, urljoin(base, "/.well-known/security.txt"))
    if security_txt is None:
        findings.append(Finding("info", "No security.txt published", "RFC 9116 vulnerability disclosure contact."))

    return Output({
        "reachable": True,
        "final_url": resp.url,
        "status": resp.status,
        "title": re.sub(r"\s+", " ", page.title).strip(),
        "description": page.meta.get("description") or page.meta.get("og:description"),
        "site_name": page.meta.get("og:site_name"),
        "technologies": detect_technologies(headers, html),
        "security_headers": {h: headers.get(h) for h in SECURITY_HEADERS},
        "server": headers.get("server"),
        "emails": extract_emails(html, target.domain),
        "phones": sorted({p.replace("tel:", "").strip() for p in PHONE_RE.findall(html)})[:10],
        "social": extract_social(page.links, html),
        "linked_hosts": hosts[:100],
        "robots": parse_robots(robots_text) if robots_text else None,
        "security_txt": security_txt[:2000] if security_txt else None,
    }, findings)
