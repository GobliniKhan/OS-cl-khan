# bizosint

Automated, **passive** OSINT reconnaissance for businesses. Give it a company's domain and/or name. It queries
the public sources from the [OSINT Framework](https://osintframework.com/) that are useful for company research,
turns the raw data into ranked **findings**, and writes reports in JSON, Markdown and a self-contained HTML page.

Typical uses:

- **Vendor / third-party risk:** check a supplier's email security, exposed services and registration hygiene
- **Due diligence / KYB:** legal entities, LEIs, SEC filings, HQ, parent and subsidiary companies
- **Attack-surface review of your own org:** subdomains in CT logs, forgotten dev/VPN hosts, missing headers
- **Sales / market intel:** the SaaS stack a company runs, inferred from DNS verification records

Pure Python standard library. No dependencies. Python 3.9+.

## Install

```bash
pip install .          # installs the `bizosint` command
# or run without installing:
python -m bizosint --help
```

## Usage

```bash
# Scan one business (domain and company name both optional, but give at least one)
bizosint scan --domain acme.com --company "Acme Corporation"

# Only some modules, Markdown + HTML only, custom output dir
bizosint scan -d acme.com -m dns,email,saas,website -f md,html -o out/

# Scan a portfolio of vendors from a CSV (header: domain,company); also writes batch-summary.csv
bizosint batch examples/targets.csv

# See every module, what it needs, and which API keys are configured
bizosint modules
```

Progress is printed to stderr and report paths to stdout, so `bizosint scan ... | xargs open` works.
Reports are written to `reports/<domain>-<timestamp>.{json,md,html}`.

## Modules

| Module | Source | Needs | What you get |
|---|---|---|---|
| `dns` | DNS-over-HTTPS (Cloudflare, Google) | domain | A/AAAA/MX/NS/TXT/SOA/CAA records |
| `email` | DNS | domain | SPF (with lookup count), DMARC, DKIM selectors, MTA-STS, TLS-RPT, BIMI, mail provider |
| `saas` | DNS TXT + SPF | domain | Vendors the company has verified (Microsoft 365, Atlassian, Salesforce, Okta...) and who sends mail for it |
| `whois` | RDAP | domain | Registrar, registrant, created/expiry dates, transfer lock, DNSSEC |
| `subdomains` | crt.sh (Certificate Transparency) | domain | Subdomains grouped by risk (VPN, SSO, dev/staging, admin, DevOps), certificate issuers |
| `hosting` | DNS + RDAP (IP) | domain | DNS provider, CDN/hosting, IP owner and network |
| `website` | The site itself | domain | Tech stack, security headers, emails, phones, social accounts, robots.txt, security.txt |
| `wayback` | Internet Archive | domain | First and last archived snapshots |
| `wikidata` | Wikidata | company | HQ, industry, founding date, employees, CEO, parent, subsidiaries, ticker |
| `lei` | GLEIF | company | Legal entities, LEIs, jurisdictions, registered and HQ addresses |
| `sec` | SEC EDGAR | company | CIK, SIC industry, incorporation state, former names, recent filings |
| `github` | GitHub API | either | GitHub orgs, ranked by whether their profile links to the domain |
| `shodan` | Shodan | domain + `SHODAN_API_KEY` | Open ports, services, known CVEs per IP |
| `hunter` | Hunter.io | domain + `HUNTER_API_KEY` | Email address format and publicly listed staff emails |
| `companies_house` | UK Companies House | company + `COMPANIES_HOUSE_API_KEY` | UK registered companies, status, addresses |
| `pivots` | none (generated offline) | either | Google dorks (documents, exposed files, login portals, people, code leaks, cloud storage, reputation) and links to 35+ OSINT Framework resources for manual follow-up |

Modules run concurrently. A module that fails (rate limit, outage) is reported as `error` and the rest of
the scan still completes. A module missing its input or API key is reported as `skipped`.

### Findings

Each module can raise findings rated `high`, `medium`, `low` or `info`. Some examples:
an SPF record with `+all`, DMARC set to `p=none`, a domain that expires within 30 days, known CVEs on an
exposed host, RDP or databases exposed to the internet, missing HSTS/CSP, and VPN or staging hosts visible in
CT logs. The scan prints high and medium findings to the terminal, and every report opens with the full
findings table.

## Configuration

| Environment variable | Purpose |
|---|---|
| `BIZOSINT_CONTACT` | Contact email added to the User-Agent. **Recommended.** SEC EDGAR's fair-access policy asks for one (same as `--contact`) |
| `SHODAN_API_KEY` | Enables `shodan` |
| `HUNTER_API_KEY` | Enables `hunter` |
| `COMPANIES_HOUSE_API_KEY` | Enables `companies_house` (free key) |
| `GITHUB_TOKEN` | Raises GitHub API rate limits for `github` |

Other flags: `--timeout`, `--workers`, `--skip`, `--max-subdomains`, `--quiet`. See `bizosint scan --help`.

## Adding a module

Drop a file in `bizosint/modules/`, import it in `bizosint/modules/__init__.py`, and decorate a function:

```python
from bizosint.core import Context, Finding, Output, Target, module

@module("mymodule", "One-line description", "category", requires=("domain",), api_key=None)
def run(target: Target, ctx: Context) -> Output:
    data = ctx.http.get_json("https://api.example.org/lookup", params={"q": target.domain})
    findings = [Finding("medium", "Something notable", "details")] if data.get("bad") else []
    return Output(data, findings)
```

Use `bizosint.dns.resolve(ctx, name, "TXT")` for cached DNS lookups. Raise `bizosint.core.SkipModule`
when the module has nothing to do for this target.

## Development

```bash
pip install -e '.[dev]'
pytest
```

Tests use a fake HTTP client with recorded-style payloads, so they run offline.

## Responsible use

bizosint only collects information that is already public: DNS, registries, certificate logs, archives,
public APIs, and the organization's own public website. It never logs in, brute-forces, or port-scans.
It sends ordinary GET requests to the target's website and nothing else to the target.
You are still responsible for how you use it. Use it for legitimate purposes such as due diligence,
vendor risk, or assessing organizations you are authorized to assess. Respect each data source's terms of
service and rate limits, and follow privacy law (e.g. GDPR) when you process personal data such as staff emails.

---

# truelove

> *"Your true love is always within 100 miles of you."*

A second tool in this repo, built on the old adage. Give your date, time and place of birth. `truelove` casts
your chart, reads today's sky and the latest zodiac feeds, and names the spot within 100 miles where the stars
point your love. It also suggests signs to look for and the best days in the coming month.

Pure Python standard library, Python 3.9+, installed alongside `bizosint` by `pip install .`.

```bash
truelove --born 1990-07-15 --time 2:30pm --place Paris
truelove -b 1994-03-21 -t 06:45 -p "Austin, US" --near "Dallas"   # you were born in Austin, live in Dallas
truelove -b 1988-11-02 -t unknown -p "34.05,-118.24" --tz America/Los_Angeles
truelove -b 1990-07-15 -t 14:30 -p Paris --json                   # the whole reading as JSON
truelove -b 1990-07-15 -t 14:30 -p Paris --offline --feed examples/zodiac-feed.xml
```

```
  Chance your true love is within 100 miles of London, GB:  100%  (the adage)
  Cosmic alignment of the hotspot below:  74%  ██████████████████░░░░░░

  ✦ HOTSPOT
    39 miles W (262°) of London, GB
    51.4253, -1.0253
    https://www.openstreetmap.org/?mlat=51.42532&mlon=-1.02531#map=11/51.42532/-1.02531

  ♡ LOOK FOR
    Aries        fire feeds your air Venus; sits on your Descendant  [feeds +0.57]
    Gemini       shares your Venus's air  [feeds +0.50]

  ☾ BEST DAYS (next 30 days)
    Thu 29 Oct   Venus trines your natal Venus; Moon in Gemini, a partner sign
```

### How the reading is made

1. **Chart.** The Sun, Moon and Venus are computed with Paul Schlyter's low-precision ephemeris, along with
   the Ascendant and Descendant for your birth time and place. Positions match PyEphem to within 0.1°.
   You get the sign of each, and where each one stood on the horizon at your birth.
2. **Direction (local-space astrology).** Love travels along the compass line of your natal Venus (35%), your
   Descendant, the classical partner point (25%), and the Moon (10%). The *partner signs*, those in harmony
   with your Venus plus your Descendant's sign, add their element's compass point (fire S, earth N, air E,
   water W) (30%). Each one pulls harder when the feeds currently give it strong love energy.
3. **Distance.** Venus high in your birth sky keeps love close; Venus low or below the horizon sends it further
   out. Your life path number sets the other half of the ring.
4. **Feeds.** RSS/Atom feeds from astrology sites are fetched in parallel. Every sentence that names a sign
   counts toward that sign: romantic words ("attraction", "chemistry", "soulmate") against blocking ones
   ("delay", "breakup", "retrograde"). A "Venus retrograde" mention lowers the alignment. Unreachable feeds
   are skipped and listed in `--json`. Add your own feeds with `--feed URL` (repeatable) or use only those with
   `--only-feeds`. The default feed list is in `truelove/feeds.py`.
5. **Alignment** combines how cleanly the lines converge, today's Venus sign versus your natal Venus, the
   Moon phase (waxing helps) and the feeds' energy. The adage sets the chance within 100 miles at 100%;
   alignment is how strongly the stars back *this particular spot*.
6. **Best days** are those when transiting Venus conjoins, sextiles or trines your Descendant or natal Venus,
   or the Moon passes through a partner sign.

Places: about 100 major cities are built in and work offline. Other names are looked up with the free Open-Meteo
geocoder; or pass `"lat,lon"` with `--tz`. Without a birth time, noon is used, which makes the Rising sign,
Descendant and directions approximate.

truelove is for fun and reflection. Astrology has no demonstrated power to predict where a person is, so
treat the hotspot as an excuse for a day trip, not a forecast.
