from bizosint.core import Target
from bizosint.dns import resolve, unquote_txt
from bizosint.modules import dns_records, email_security, saas
from bizosint.modules.email_security import dmarc_findings, parse_spf, parse_tags, spf_findings


def titles(findings):
    return {f.title for f in findings}


def test_unquote_txt_joins_segments():
    assert unquote_txt('"v=spf1 include:a.com " "-all"') == "v=spf1 include:a.com -all"
    assert unquote_txt("plain") == "plain"


def test_resolve_strips_trailing_dot_and_caches(ctx, fake_http):
    fake_http.add_dns("acme.com", "NS", "ns1.acme.com.", "ns2.acme.com.")
    assert resolve(ctx, "acme.com", "NS") == ["ns1.acme.com", "ns2.acme.com"]
    resolve(ctx, "ACME.com", "NS")
    assert len(fake_http.calls) == 1


def test_parse_spf_counts_lookups():
    spf = parse_spf("v=spf1 include:_spf.google.com include:sendgrid.net a mx ip4:1.2.3.0/24 ~all")
    assert spf["includes"] == ["_spf.google.com", "sendgrid.net"]
    assert spf["ip_ranges"] == ["1.2.3.0/24"]
    assert spf["all"] == "~all"
    assert spf["direct_dns_lookups"] == 4


def test_spf_findings():
    assert "SPF allows all senders (+all)" in titles(spf_findings(["x"], parse_spf("v=spf1 +all")))
    assert "SPF neutral policy (?all)" in titles(spf_findings(["x"], parse_spf("v=spf1 ?all")))
    assert "Multiple SPF records" in titles(spf_findings(["a", "b"], parse_spf("v=spf1 -all")))
    many = "v=spf1 " + " ".join(f"include:s{i}.example" for i in range(11)) + " -all"
    assert "SPF exceeds 10 DNS lookups" in titles(spf_findings(["x"], parse_spf(many)))
    assert spf_findings(["x"], parse_spf("v=spf1 include:_spf.google.com -all")) == []


def test_dmarc_findings():
    assert "No DMARC record" in titles(dmarc_findings(None))
    assert "DMARC policy is p=none" in titles(dmarc_findings(parse_tags("v=DMARC1; p=none; rua=mailto:x@y")))
    partial = dmarc_findings(parse_tags("v=DMARC1; p=reject; pct=50; rua=mailto:x@y"))
    assert titles(partial) == {"DMARC applies to a subset of mail"}
    assert dmarc_findings(parse_tags("v=DMARC1; p=reject; rua=mailto:x@y")) == []


def test_email_module(ctx, fake_http):
    fake_http.add_dns("acme.com", "MX", "1 aspmx.l.google.com.", "10 mx.acme-com.mail.protection.outlook.com.")
    fake_http.add_dns("acme.com", "TXT", '"v=spf1 include:_spf.google.com ~all"')
    fake_http.add_dns("_dmarc.acme.com", "TXT", '"v=DMARC1; p=none"')
    fake_http.add_dns("google._domainkey.acme.com", "TXT", '"v=DKIM1; k=rsa; p=MIGf"')
    out = email_security.run(Target(domain="acme.com"), ctx)
    assert out.data["mail_providers"] == ["Google Workspace", "Microsoft 365"]
    assert out.data["dkim_selectors_found"] == ["google"]
    assert out.data["dmarc"]["p"] == "none"
    assert "DMARC policy is p=none" in titles(out.findings)


def test_email_module_non_mail_domain(ctx):
    out = email_security.run(Target(domain="parked.com"), ctx)
    assert {"Non-mail domain without SPF", "No DMARC record"} <= titles(out.findings)


def test_saas_detection(ctx, fake_http):
    fake_http.add_dns("acme.com", "TXT",
                      '"google-site-verification=abc"', '"MS=ms123456"', '"atlassian-domain-verification=x"',
                      '"v=spf1 include:_spf.salesforce.com include:sendgrid.net -all"', '"mystery-token=1"')
    out = saas.run(Target(domain="acme.com"), ctx)
    vendors = {v["vendor"] for v in out.data["verified_services"]}
    assert {"Microsoft 365", "Atlassian (Jira / Confluence)", "Google (Search Console / Workspace)"} <= vendors
    assert {v["vendor"] for v in out.data["email_senders"]} == {"Salesforce", "SendGrid"}
    assert out.data["unrecognized_txt"] == ["mystery-token=1"]


def test_dns_module_flags_missing_caa(ctx, fake_http):
    fake_http.add_dns("acme.com", "A", "93.184.216.34")
    fake_http.add_dns("acme.com", "NS", "ns1.acme.com.")
    out = dns_records.run(Target(domain="acme.com"), ctx)
    assert out.data["A"] == ["93.184.216.34"]
    assert "No CAA record" in titles(out.findings)
