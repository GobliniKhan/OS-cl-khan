"""Infer the SaaS vendors a business uses from DNS verification tokens and SPF includes."""

import re
from typing import Dict, List

from bizosint.core import Context, Finding, Output, Target, module
from bizosint.dns import resolve

# (regex matched against each TXT record, vendor, category)
TXT_SIGNATURES = [
    (r"^google-site-verification=", "Google (Search Console / Workspace)", "productivity"),
    (r"^MS=ms\d+", "Microsoft 365", "productivity"),
    (r"^atlassian-domain-verification=", "Atlassian (Jira / Confluence)", "engineering"),
    (r"^facebook-domain-verification=", "Meta Business", "marketing"),
    (r"^apple-domain-verification=", "Apple Business", "productivity"),
    (r"^adobe-idp-site-verification=", "Adobe", "design"),
    (r"^adobe-sign-verification=", "Adobe Sign", "legal"),
    (r"^docusign=", "DocuSign", "legal"),
    (r"^stripe-verification=", "Stripe", "payments"),
    (r"^zoom-domain-verification=|^ZOOM_verify_", "Zoom", "communication"),
    (r"^slack-domain-verification=", "Slack", "communication"),
    (r"^webexdomainverification", "Cisco Webex", "communication"),
    (r"^hubspot-developer-verification=|^hubspot-domain-verification=", "HubSpot", "marketing"),
    (r"^salesforce-domain-verification|^sfdc-verification", "Salesforce", "sales"),
    (r"^dropbox-domain-verification=", "Dropbox", "productivity"),
    (r"^box-domain-verification=", "Box", "productivity"),
    (r"^citrix-verification-code=", "Citrix", "it"),
    (r"^onetrust-domain-verification=", "OneTrust", "compliance"),
    (r"^knowbe4-site-verification=", "KnowBe4", "security"),
    (r"^okta-verification=|^okta-domain-verification=", "Okta", "identity"),
    (r"^duo_sso_verification=|^duo-verification", "Cisco Duo", "identity"),
    (r"^mongodb-site-verification=", "MongoDB Atlas", "engineering"),
    (r"^miro-verification=", "Miro", "productivity"),
    (r"^notion-domain-verification=", "Notion", "productivity"),
    (r"^figma-domain-verification=", "Figma", "design"),
    (r"^canva-site-verification=", "Canva", "design"),
    (r"^github-verification|^_github-challenge", "GitHub", "engineering"),
    (r"^gitlab-", "GitLab", "engineering"),
    (r"^twilio-domain-verification=", "Twilio", "communication"),
    (r"^mailchimp=|^mc-verify", "Mailchimp", "marketing"),
    (r"^mailru-verification", "Mail.ru", "productivity"),
    (r"^yandex-verification", "Yandex", "marketing"),
    (r"^pinterest-site-verification", "Pinterest", "marketing"),
    (r"^ahrefs-site-verification_", "Ahrefs", "marketing"),
    (r"^wrike-verification=", "Wrike", "productivity"),
    (r"^smartsheet-site-validation=", "Smartsheet", "productivity"),
    (r"^workplace-domain-verification=", "Meta Workplace", "communication"),
    (r"^teamviewer-sso-verification=", "TeamViewer", "it"),
    (r"^amazonses:|^amazonses-verification", "Amazon SES", "email"),
    (r"^brevo-code:|^Sendinblue-code:", "Brevo (Sendinblue)", "marketing"),
    (r"^cisco-ci-domain-verification=", "Cisco", "it"),
    (r"^openai-domain-verification=", "OpenAI", "ai"),
    (r"^anthropic-domain-verification", "Anthropic", "ai"),
    (r"^loaderio=", "Loader.io", "engineering"),
    (r"^globalsign-domain-verification=|^_globalsign-domain-verification", "GlobalSign", "certificates"),
    (r"^_?digicert", "DigiCert", "certificates"),
    (r"^sectigo", "Sectigo", "certificates"),
    (r"^keybase-site-verification=", "Keybase", "security"),
    (r"^intercom-domain-verification", "Intercom", "support"),
    (r"^zendesk", "Zendesk", "support"),
    (r"^freshdesk", "Freshdesk", "support"),
    (r"^klaviyo-site-verification", "Klaviyo", "marketing"),
    (r"^shopify-verification-code", "Shopify", "ecommerce"),
    (r"^yahoo-verification-key", "Yahoo", "marketing"),
    (r"^bugcrowd-verification", "Bugcrowd", "security"),
    (r"^h1-domain-verification", "HackerOne", "security"),
]

# SPF include suffix -> vendor (shows who sends mail on the company's behalf)
SPF_SENDERS = {
    "_spf.google.com": "Google Workspace",
    "spf.protection.outlook.com": "Microsoft 365",
    "sendgrid.net": "SendGrid",
    "mailgun.org": "Mailgun",
    "amazonses.com": "Amazon SES",
    "servers.mcsv.net": "Mailchimp",
    "spf.mandrillapp.com": "Mailchimp Transactional",
    "_spf.salesforce.com": "Salesforce",
    "mktomail.com": "Marketo",
    "hubspotemail.net": "HubSpot",
    "mail.zendesk.com": "Zendesk",
    "spf.brevo.com": "Brevo",
    "sendinblue.com": "Brevo (Sendinblue)",
    "_spf.intercom.io": "Intercom",
    "spf.freshdesk.com": "Freshdesk",
    "pphosted.com": "Proofpoint",
    "mimecast.com": "Mimecast",
    "zoho.com": "Zoho",
    "_spf.atlassian.net": "Atlassian",
    "spf.mtasv.net": "Postmark",
    "sparkpostmail.com": "SparkPost",
    "_spf.docusign.net": "DocuSign",
    "shopify.com": "Shopify",
    "klaviyo.com": "Klaviyo",
    "qualtrics.com": "Qualtrics",
    "helpscoutemail.com": "Help Scout",
}


def detect_txt(records: List[str]) -> List[Dict[str, str]]:
    found = {}
    for record in records:
        for pattern, vendor, category in TXT_SIGNATURES:
            if re.search(pattern, record, re.IGNORECASE):
                found[vendor] = {"vendor": vendor, "category": category, "evidence": record[:120]}
    return sorted(found.values(), key=lambda v: v["vendor"])


def detect_spf(records: List[str]) -> List[Dict[str, str]]:
    found = {}
    for record in records:
        if not record.lower().startswith("v=spf1"):
            continue
        for include in re.findall(r"include:(\S+)", record, re.IGNORECASE):
            for suffix, vendor in SPF_SENDERS.items():
                if include.lower() == suffix or include.lower().endswith("." + suffix):
                    found[vendor] = {"vendor": vendor, "category": "email-sender", "evidence": f"include:{include}"}
    return sorted(found.values(), key=lambda v: v["vendor"])


@module("saas", "SaaS/vendor stack inferred from DNS verification tokens and SPF senders", "business")
def run(target: Target, ctx: Context) -> Output:
    txt = resolve(ctx, target.domain, "TXT")
    verified = detect_txt(txt)
    senders = detect_spf(txt)
    unknown = [r for r in txt if not r.lower().startswith("v=") and not any(
        re.search(p, r, re.IGNORECASE) for p, _, _ in TXT_SIGNATURES)]
    findings = []
    if len(txt) > 15:
        findings.append(Finding(
            "info", f"{len(txt)} TXT records published",
            "Stale verification tokens reveal past vendors; consider pruning unused records.",
        ))
    return Output({
        "verified_services": verified,
        "email_senders": senders,
        "unrecognized_txt": unknown,
    }, findings)
