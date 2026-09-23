"""Importing this package registers every built-in module in bizosint.core.REGISTRY."""

from bizosint.modules import (  # noqa: F401
    dns_records,
    email_security,
    saas,
    whois,
    subdomains,
    hosting,
    website,
    wayback,
    company,
    github,
    keyed,
    pivots,
)
