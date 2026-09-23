"""Hosting, CDN and DNS provider identification, plus IP ownership via RDAP."""

from typing import Any, Dict, List

from bizosint.core import Context, Output, Target, module
from bizosint.dns import resolve
from bizosint.http import HttpError

RDAP_IP = "https://rdap.org/ip/"

DNS_PROVIDERS = {
    "cloudflare.com": "Cloudflare",
    "awsdns": "Amazon Route 53",
    "azure-dns": "Azure DNS",
    "googledomains.com": "Google Domains",
    "google.com": "Google Cloud DNS",
    "domaincontrol.com": "GoDaddy",
    "nsone.net": "NS1",
    "ultradns": "UltraDNS",
    "dynect.net": "Oracle Dyn",
    "akam.net": "Akamai",
    "registrar-servers.com": "Namecheap",
    "wixdns.net": "Wix",
    "squarespacedns.com": "Squarespace",
    "dnsimple.com": "DNSimple",
    "digitalocean.com": "DigitalOcean",
    "linode.com": "Linode",
    "hostgator.com": "HostGator",
    "bluehost.com": "Bluehost",
    "ovh.net": "OVHcloud",
    "gandi.net": "Gandi",
    "vercel-dns.com": "Vercel",
    "netlify.com": "Netlify",
}

CNAME_PROVIDERS = {
    "cloudfront.net": "Amazon CloudFront",
    "elb.amazonaws.com": "AWS Elastic Load Balancing",
    "s3.amazonaws.com": "Amazon S3",
    "azurewebsites.net": "Azure App Service",
    "azureedge.net": "Azure CDN",
    "azurefd.net": "Azure Front Door",
    "trafficmanager.net": "Azure Traffic Manager",
    "akamaiedge.net": "Akamai",
    "edgekey.net": "Akamai",
    "edgesuite.net": "Akamai",
    "fastly.net": "Fastly",
    "cdn.cloudflare.net": "Cloudflare",
    "herokuapp.com": "Heroku",
    "herokudns.com": "Heroku",
    "github.io": "GitHub Pages",
    "netlify.app": "Netlify",
    "vercel-dns.com": "Vercel",
    "myshopify.com": "Shopify",
    "shops.myshopify.com": "Shopify",
    "wpengine.com": "WP Engine",
    "squarespace.com": "Squarespace",
    "wixdns.net": "Wix",
    "ghs.googlehosted.com": "Google Hosted",
    "hubspot.net": "HubSpot CMS",
    "zendesk.com": "Zendesk",
    "webflow.io": "Webflow",
    "incapdns.net": "Imperva",
}


def match_provider(hosts: List[str], table: Dict[str, str]) -> List[str]:
    return sorted({name for host in hosts for key, name in table.items() if key in host.lower()})


def ip_owner(ctx: Context, ip: str) -> Dict[str, Any]:
    try:
        data = ctx.http.get_json(RDAP_IP + ip, headers={"Accept": "application/rdap+json"})
    except HttpError as exc:
        return {"ip": ip, "error": str(exc)}
    org = None
    for entity in data.get("entities", []):
        for item in (entity.get("vcardArray") or [None, []])[1]:
            if item and item[0] == "fn":
                org = item[3]
                break
        if org:
            break
    return {
        "ip": ip,
        "network": data.get("name"),
        "organization": org,
        "country": data.get("country"),
        "range": f"{data.get('startAddress')} - {data.get('endAddress')}",
        "handle": data.get("handle"),
    }


@module("hosting", "Hosting/CDN/DNS providers and IP ownership (RDAP)", "infrastructure")
def run(target: Target, ctx: Context) -> Output:
    domain = target.domain
    ns = resolve(ctx, domain, "NS")
    cnames = resolve(ctx, f"www.{domain}", "CNAME") + resolve(ctx, domain, "CNAME")
    ips = sorted(set(resolve(ctx, domain, "A") + resolve(ctx, f"www.{domain}", "A")))
    owners = [ip_owner(ctx, ip) for ip in ips[:8]]
    return Output({
        "dns_providers": match_provider(ns, DNS_PROVIDERS),
        "web_providers": match_provider(cnames, CNAME_PROVIDERS),
        "cnames": cnames,
        "ip_addresses": ips,
        "ip_owners": owners,
    })
