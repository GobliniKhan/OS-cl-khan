"""Web history from the Internet Archive's Wayback Machine."""

from typing import Any, List, Optional

from bizosint.core import Context, Output, Target, module

CDX_URL = "https://web.archive.org/cdx/search/cdx"


def snapshot(ctx: Context, domain: str, limit: int) -> Optional[dict]:
    rows: List[List[Any]] = ctx.http.get_json(CDX_URL, params={
        "url": domain, "output": "json", "fl": "timestamp,original,statuscode", "limit": limit,
    }, timeout=max(ctx.config.timeout, 45))
    if len(rows) < 2:  # first row is the header
        return None
    timestamp, original, status = rows[1][:3]
    return {
        "date": f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}",
        "url": original,
        "status": status,
        "archive_url": f"https://web.archive.org/web/{timestamp}/{original}",
    }


@module("wayback", "First/last archived snapshots from the Wayback Machine", "history")
def run(target: Target, ctx: Context) -> Output:
    first = snapshot(ctx, target.domain, 1)
    last = snapshot(ctx, target.domain, -1) if first else None
    return Output({
        "archived": first is not None,
        "first_snapshot": first,
        "last_snapshot": last,
        "all_urls": f"https://web.archive.org/web/*/{target.domain}/*",
    })
