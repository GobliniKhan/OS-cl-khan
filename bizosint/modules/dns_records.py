from bizosint.core import Context, Finding, Output, Target, module
from bizosint.dns import resolve

TYPES = ("A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA")


@module("dns", "Core DNS records (A, AAAA, MX, NS, TXT, SOA, CAA) via DNS-over-HTTPS", "infrastructure")
def run(target: Target, ctx: Context) -> Output:
    records = {rtype: resolve(ctx, target.domain, rtype) for rtype in TYPES}
    records["www"] = resolve(ctx, f"www.{target.domain}", "CNAME") or resolve(ctx, f"www.{target.domain}", "A")
    findings = []
    if not any(records[t] for t in ("A", "AAAA", "MX", "NS")):
        findings.append(Finding("medium", "Domain does not resolve", "No A, AAAA, MX or NS records found."))
    if records["NS"] and not records["CAA"]:
        findings.append(Finding(
            "info", "No CAA record",
            "Any certificate authority may issue certificates for this domain.",
        ))
    return Output({k: v for k, v in records.items() if v}, findings)
