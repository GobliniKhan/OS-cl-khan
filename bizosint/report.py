"""Render a scan Report as JSON, Markdown or a self-contained HTML page."""

from __future__ import annotations

import html
import json
import re
from dataclasses import asdict
from typing import Any, List

from bizosint.core import SEVERITIES
from bizosint.runner import Report

LIST_LIMIT = 40


def to_dict(report: Report) -> dict:
    return {
        "tool": "bizosint",
        "version": report.tool_version,
        "target": asdict(report.target),
        "started_at": report.started_at,
        "finished_at": report.finished_at,
        "summary": report.severity_counts,
        "findings": [{"module": m, **asdict(f)} for m, f in report.findings],
        "modules": [asdict(r) for r in report.results],
    }


def render_json(report: Report) -> str:
    return json.dumps(to_dict(report), indent=2, ensure_ascii=False)


def is_url(value: Any) -> bool:
    return isinstance(value, str) and bool(re.match(r"https?://", value))


def humanize(key: str) -> str:
    return key if key.isupper() else key.replace("_", " ").capitalize()


# ---------------------------------------------------------------- Markdown

def md_value(value: Any, depth: int = 0) -> List[str]:
    pad = "  " * depth
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            if item in (None, "", [], {}):
                continue
            if isinstance(item, (dict, list)):
                lines.append(f"{pad}- **{humanize(str(key))}**")
                lines += md_value(item, depth + 1)
            else:
                lines.append(f"{pad}- **{humanize(str(key))}:** {md_scalar(item)}")
        return lines
    if isinstance(value, list):
        lines = []
        for item in value[:LIST_LIMIT]:
            if isinstance(item, dict):
                sub = md_value(item, depth + 1)
                if sub:
                    lines.append(f"{pad}- " + sub[0].strip()[2:])
                    lines += sub[1:]
            else:
                lines.append(f"{pad}- {md_scalar(item)}")
        if len(value) > LIST_LIMIT:
            lines.append(f"{pad}- … {len(value) - LIST_LIMIT} more (see JSON report)")
        return lines
    return [f"{pad}- {md_scalar(value)}"]


def md_scalar(value: Any) -> str:
    if is_url(value):
        return f"<{value}>"
    text = str(value).replace("|", "\\|").replace("\n", " ")
    return f"`{text}`" if len(text) < 90 and any(c in text for c in "=:;*_") else text


def render_markdown(report: Report) -> str:
    t = report.target
    counts = report.severity_counts
    out = [
        f"# OSINT report: {t.label}",
        "",
        f"- **Domain:** {t.domain or '—'}",
        f"- **Company:** {t.company or '—'}",
        f"- **Generated:** {report.finished_at} (bizosint {report.tool_version})",
        f"- **Findings:** " + ", ".join(f"{counts[s]} {s}" for s in SEVERITIES),
        "",
        "## Findings",
        "",
    ]
    if report.findings:
        out += ["| Severity | Module | Finding | Detail |", "|---|---|---|---|"]
        for module, f in report.findings:
            out.append(f"| {f.severity.upper()} | {module} | {md_scalar(f.title)} | {md_scalar(f.detail)} |")
    else:
        out.append("_No findings._")
    out += ["", "## Module status", "", "| Module | Category | Status | Time (s) | Note |", "|---|---|---|---|---|"]
    for r in report.results:
        out.append(f"| {r.module} | {r.category} | {r.status} | {r.duration} | {md_scalar(r.message)} |")
    for r in report.results:
        if r.status != "ok":
            continue
        out += ["", f"## {r.module}", ""]
        out += md_value(r.data) or ["_No data._"]
    out.append("")
    return "\n".join(out)


# ---------------------------------------------------------------- HTML

def html_value(value: Any) -> str:
    if isinstance(value, dict):
        rows = "".join(
            f"<tr><th>{html.escape(humanize(str(k)))}</th><td>{html_value(v)}</td></tr>"
            for k, v in value.items() if v not in (None, "", [], {})
        )
        return f"<table class='kv'>{rows}</table>" if rows else "<span class='muted'>—</span>"
    if isinstance(value, list):
        if not value:
            return "<span class='muted'>—</span>"
        items = "".join(f"<li>{html_value(v)}</li>" for v in value[:LIST_LIMIT])
        more = f"<li class='muted'>… {len(value) - LIST_LIMIT} more (see JSON)</li>" if len(value) > LIST_LIMIT else ""
        return f"<ul>{items}{more}</ul>"
    if is_url(value):
        safe = html.escape(value, quote=True)
        return f"<a href='{safe}' target='_blank' rel='noopener noreferrer'>{safe}</a>"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return html.escape(str(value))


CSS = """
:root{--bg:#f7f7f5;--card:#fff;--fg:#1d1d1b;--muted:#6b6b66;--line:#e3e2dd;--accent:#2f5d8a;
--high:#b3261e;--medium:#c26a00;--low:#6b7a00;--info:#44546a}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#1f1f1d;--fg:#ecebe6;--muted:#9b9a93;
--line:#34332f;--accent:#8db4dc;--high:#ff8a80;--medium:#ffb74d;--low:#c5d86d;--info:#a7b6c9}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{margin:0 0 4px;font-size:1.6rem}
h2{font-size:1.15rem;margin:0}.muted{color:var(--muted)}a{color:var(--accent);word-break:break-all}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:16px 0}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.stat{flex:1;min-width:110px;
background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.stat b{display:block;font-size:1.6rem}.sev{font-weight:600;text-transform:uppercase;font-size:.75rem}
.sev.high{color:var(--high)}.sev.medium{color:var(--medium)}.sev.low{color:var(--low)}.sev.info{color:var(--info)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:6px 8px;
border-bottom:1px solid var(--line)}.kv th{width:190px;color:var(--muted);font-weight:500}
.kv .kv th{width:150px}ul{margin:0;padding-left:18px}details summary{cursor:pointer;display:flex;
justify-content:space-between;gap:12px;align-items:baseline;list-style:none}
details summary::-webkit-details-marker{display:none}details[open] summary{margin-bottom:10px}
.scroll{overflow-x:auto}td,p{overflow-wrap:anywhere}
@media (max-width:640px){.kv th{width:auto}.findings tr:first-child{display:none}
.findings tr{display:grid;grid-template-columns:auto 1fr;gap:0 10px;padding:8px 0;border-bottom:1px solid var(--line)}
.findings td{border:0;padding:2px 0}.findings td:nth-child(n+3){grid-column:1/-1}
.findings td:nth-child(3){font-weight:600}.findings td:nth-child(2){color:var(--muted)}}
"""


def render_html(report: Report) -> str:
    t = report.target
    counts = report.severity_counts
    esc = html.escape
    stats = "".join(
        f"<div class='stat'><span class='sev {s}'>{s}</span><b>{counts[s]}</b></div>" for s in SEVERITIES
    )
    finding_rows = "".join(
        f"<tr><td><span class='sev {f.severity}'>{f.severity}</span></td><td>{esc(m)}</td>"
        f"<td>{esc(f.title)}</td><td>{esc(f.detail)}</td></tr>"
        for m, f in report.findings
    ) or "<tr><td colspan='4' class='muted'>No findings.</td></tr>"
    sections = []
    for r in report.results:
        note = f"{r.status} · {r.duration}s"
        body = html_value(r.data) if r.status == "ok" else f"<p class='muted'>{esc(r.message)}</p>"
        sections.append(
            f"<details class='card' {'open' if r.status == 'ok' and r.module != 'pivots' else ''}>"
            f"<summary><h2>{esc(r.module)} <span class='muted'>· {esc(r.category)}</span></h2>"
            f"<span class='muted'>{note}</span></summary><div class='scroll'>{body}</div></details>"
        )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OSINT report: {esc(t.label)}</title><style>{CSS}</style></head>
<body><main>
<h1>OSINT report: {esc(t.label)}</h1>
<div class="muted">Domain: {esc(t.domain or '—')} · Company: {esc(t.company or '—')} ·
Generated {esc(report.finished_at)} by bizosint {esc(report.tool_version)}</div>
<div class="stats">{stats}</div>
<section class="card"><h2>Findings</h2><div class="scroll"><table class="findings">
<tr><th>Severity</th><th>Module</th><th>Finding</th><th>Detail</th></tr>{finding_rows}</table></div></section>
{''.join(sections)}
<p class="muted">Collected passively from public sources. Verify before acting on any finding.</p>
</main></body></html>
"""


RENDERERS = {"json": render_json, "md": render_markdown, "html": render_html}
