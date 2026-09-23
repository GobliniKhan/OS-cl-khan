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
