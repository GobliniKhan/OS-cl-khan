"""Email authentication posture: SPF, DMARC, DKIM, MTA-STS, TLS-RPT, BIMI."""

import re
from typing import Dict, List, Optional

from bizosint.core import Context, Finding, Output, Target, module
from bizosint.dns import resolve

DKIM_SELECTORS = (
    "default", "google", "selector1", "selector2", "k1", "k2", "k3", "s1", "s2", "mail",
    "dkim", "smtp", "mandrill", "mxvault", "everlytickey1", "sendgrid", "zendesk1", "pm", "amazonses",
)
SPF_LOOKUP_MECHANISMS = {"include", "a", "mx", "ptr", "exists", "redirect"}

MAIL_PROVIDERS = {
    "google.com": "Google Workspace",
    "googlemail.com": "Google Workspace",
    "outlook.com": "Microsoft 365",
    "pphosted.com": "Proofpoint",
    "ppe-hosted.com": "Proofpoint Essentials",
    "mimecast.com": "Mimecast",
    "barracudanetworks.com": "Barracuda",
    "messagelabs.com": "Broadcom Email Security.cloud",
    "iphmx.com": "Cisco Secure Email",
    "zoho.com": "Zoho Mail",
    "zoho.eu": "Zoho Mail",
    "secureserver.net": "GoDaddy",
    "mailgun.org": "Mailgun",
    "amazonaws.com": "Amazon SES",
    "protonmail.ch": "Proton Mail",
    "icloud.com": "iCloud Mail",
    "yandex.net": "Yandex",
    "fastmail.com": "Fastmail",
    "hornetsecurity.com": "Hornetsecurity",
    "trendmicro.com": "Trend Micro Email Security",
    "sophos.com": "Sophos Email",
}


def mail_providers(mx_records: List[str]) -> List[str]:
    found = set()
    for record in mx_records:
        host = record.split()[-1].lower().rstrip(".")
        for suffix, provider in MAIL_PROVIDERS.items():
            if host == suffix or host.endswith("." + suffix):
                found.add(provider)
    return sorted(found)


def parse_spf(record: str) -> Dict:
    terms = record.split()[1:]
    lookups = sum(1 for t in terms if re.split(r"[:/=]", t.lstrip("+-~?"))[0] in SPF_LOOKUP_MECHANISMS)
    all_term = next((t for t in terms if t.lstrip("+-~?") == "all"), None)
    return {
        "record": record,
        "includes": [t.split(":", 1)[1] for t in terms if t.lstrip("+-~?").startswith("include:")],
        "ip_ranges": [t.split(":", 1)[1] for t in terms if t.lstrip("+-~?").startswith(("ip4:", "ip6:"))],
        "all": all_term,
        "redirect": next((t.split("=", 1)[1] for t in terms if t.startswith("redirect=")), None),
        "direct_dns_lookups": lookups,
    }


def parse_tags(record: str) -> Dict[str, str]:
    tags = {}
    for part in record.split(";"):
        if "=" in part:
            key, value = part.split("=", 1)
            tags[key.strip().lower()] = value.strip()
    return tags


def spf_findings(spf_records: List[str], spf: Optional[Dict]) -> List[Finding]:
    if not spf_records:
        return [Finding("medium", "No SPF record", "Anyone can send mail claiming to be from this domain.")]
    findings = []
    if len(spf_records) > 1:
        findings.append(Finding("medium", "Multiple SPF records", "More than one v=spf1 record causes a PermError."))
    qualifier = (spf["all"] or "")[:1]
    if spf["all"] in ("all", "+all"):
        findings.append(Finding("high", "SPF allows all senders (+all)", spf["record"]))
    elif qualifier == "?":
        findings.append(Finding("medium", "SPF neutral policy (?all)", "SPF provides no protection."))
    elif spf["all"] is None and not spf["redirect"]:
        findings.append(Finding("low", "SPF has no 'all' mechanism", "The default result is neutral."))
    if spf["direct_dns_lookups"] > 10:
        findings.append(Finding(
            "medium", "SPF exceeds 10 DNS lookups",
            f"{spf['direct_dns_lookups']} lookup mechanisms before nested includes.",
        ))
    return findings


def dmarc_findings(dmarc: Optional[Dict]) -> List[Finding]:
    if dmarc is None:
        return [Finding("medium", "No DMARC record", "Spoofed mail using this domain will not be rejected.")]
    policy = dmarc.get("p", "").lower()
    findings = []
    if policy == "none":
        findings.append(Finding("medium", "DMARC policy is p=none", "Monitoring only; spoofed mail is still delivered."))
    elif policy not in ("quarantine", "reject"):
        findings.append(Finding("medium", "DMARC policy missing or invalid", f"p={policy or '(unset)'}"))
    if policy in ("quarantine", "reject") and dmarc.get("pct", "100") != "100":
        findings.append(Finding("low", "DMARC applies to a subset of mail", f"pct={dmarc['pct']}"))
    if "rua" not in dmarc:
        findings.append(Finding("info", "DMARC has no aggregate reporting (rua)", ""))
    return findings


@module("email", "Email security posture: SPF, DMARC, DKIM selectors, MTA-STS, TLS-RPT, BIMI", "email")
def run(target: Target, ctx: Context) -> Output:
    domain = target.domain
    mx = resolve(ctx, domain, "MX")
    spf_records = [r for r in resolve(ctx, domain, "TXT") if r.lower().startswith("v=spf1")]
    spf = parse_spf(spf_records[0]) if spf_records else None
    dmarc_record = next((r for r in resolve(ctx, f"_dmarc.{domain}", "TXT") if r.lower().startswith("v=dmarc1")), None)
    dmarc = parse_tags(dmarc_record) if dmarc_record else None

    dkim = []
    for selector in DKIM_SELECTORS:
        name = f"{selector}._domainkey.{domain}"
        records = resolve(ctx, name, "TXT") or resolve(ctx, name, "CNAME")
        if any(re.search(r"(^|;)\s*(v=DKIM1|p=)", r) or ".domainkey" in r or "dkim" in r for r in records):
            dkim.append(selector)

    mta_sts = next((r for r in resolve(ctx, f"_mta-sts.{domain}", "TXT") if r.startswith("v=STSv1")), None)
    tls_rpt = next((r for r in resolve(ctx, f"_smtp._tls.{domain}", "TXT") if r.startswith("v=TLSRPTv1")), None)
    bimi = next((r for r in resolve(ctx, f"default._bimi.{domain}", "TXT") if r.startswith("v=BIMI1")), None)

    findings: List[Finding] = []
    if mx or spf_records:
        findings += spf_findings(spf_records, spf)
    else:
        findings.append(Finding(
            "low", "Non-mail domain without SPF",
            "Publish 'v=spf1 -all' to stop the domain being spoofed.",
        ))
    findings += dmarc_findings(dmarc)
    if mx and not dkim:
        findings.append(Finding("info", "No DKIM key found on common selectors", ", ".join(DKIM_SELECTORS)))

    return Output({
        "mx": mx,
        "mail_providers": mail_providers(mx),
        "spf": spf,
        "dmarc": dmarc,
        "dkim_selectors_found": dkim,
        "mta_sts": mta_sts,
        "tls_rpt": tls_rpt,
        "bimi": bimi,
    }, findings)
