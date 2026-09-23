"""Command-line interface: `bizosint scan`, `bizosint batch`, `bizosint modules`."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path
from typing import List, Optional

from bizosint import __version__
from bizosint.core import API_KEY_ENV, REGISTRY, Config, Context, ModuleResult, Target
from bizosint.report import RENDERERS
from bizosint.runner import Report, scan, select_modules

STATUS_MARK = {"ok": "+", "skipped": "-", "error": "!"}

DISCLAIMER = (
    "Passive reconnaissance using public sources. Use only for legitimate purposes such as due diligence,\n"
    "vendor risk assessment, or assessing your own organization, and respect each source's terms of service."
)


def csv_list(value: str) -> List[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "target"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bizosint", description="Automated, passive OSINT reconnaissance for businesses.", epilog=DISCLAIMER,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"bizosint {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("-m", "--modules", type=csv_list, help="comma-separated modules to run (default: all)")
    common.add_argument("-x", "--skip", type=csv_list, default=[], help="comma-separated modules to skip")
    common.add_argument("-f", "--format", type=csv_list, default=["json", "md", "html"],
                        help="report formats: json,md,html (default: all)")
    common.add_argument("-o", "--out", type=Path, default=Path("reports"), help="output directory (default: reports)")
    common.add_argument("-w", "--workers", type=int, default=6, help="concurrent modules (default: 6)")
    common.add_argument("-t", "--timeout", type=float, help="per-request timeout in seconds (default: 20)")
    common.add_argument("--contact", help="contact email sent in the User-Agent (SEC EDGAR asks for one); "
                                          "or set BIZOSINT_CONTACT")
    common.add_argument("--max-subdomains", type=int, help="cap on subdomains stored in the report (default: 500)")
    common.add_argument("-q", "--quiet", action="store_true", help="suppress progress output")

    p_scan = sub.add_parser("scan", parents=[common], help="scan a single business")
    p_scan.add_argument("-d", "--domain", help="primary domain, e.g. example.com")
    p_scan.add_argument("-c", "--company", help='legal or trading name, e.g. "Example Corp"')

    p_batch = sub.add_parser("batch", parents=[common], help="scan every row of a CSV (columns: domain, company)")
    p_batch.add_argument("csv", type=Path, help="CSV file with a header row containing domain and/or company")

    sub.add_parser("modules", help="list available modules")
    return parser


def print_modules(config: Config) -> None:
    print(f"{'MODULE':<16} {'CATEGORY':<15} {'NEEDS':<16} DESCRIPTION")
    for mod in sorted(REGISTRY.values(), key=lambda m: m.order):
        needs = ",".join(mod.requires) or "domain|company"
        if mod.api_key:
            state = "set" if config.api_keys.get(mod.api_key) else "missing"
            needs += f" +{API_KEY_ENV[mod.api_key]}({state})"
        print(f"{mod.name:<16} {mod.category:<15} {needs:<16} {mod.description}")


def progress_printer(quiet: bool):
    def show(result: ModuleResult) -> None:
        if quiet:
            return
        extra = f" — {result.message}" if result.message else ""
        found = f" [{len(result.findings)} findings]" if result.findings else ""
        print(f"  [{STATUS_MARK[result.status]}] {result.module:<16} {result.duration:>6.1f}s{found}{extra}",
              file=sys.stderr)
    return show


def write_reports(report: Report, out_dir: Path, formats: List[str]) -> List[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = report.started_at[:19].replace(":", "").replace("-", "")
    base = f"{slug(report.target.domain or report.target.company)}-{stamp}"
    paths = []
    for fmt in formats:
        path = out_dir / f"{base}.{fmt}"
        path.write_text(RENDERERS[fmt](report), encoding="utf-8")
        paths.append(path)
    return paths


def print_summary(report: Report, paths: List[Path]) -> None:
    counts = report.severity_counts
    print(f"\n{report.target.label}: " + ", ".join(f"{n} {s}" for s, n in counts.items()), file=sys.stderr)
    for module, finding in report.findings:
        if finding.severity in ("high", "medium"):
            print(f"  {finding.severity.upper():<6} [{module}] {finding.title}", file=sys.stderr)
    for path in paths:
        print(path)


def run_target(target: Target, args: argparse.Namespace, ctx: Context) -> Report:
    if not args.quiet:
        print(f"Scanning {target.label} ({target.domain or 'no domain'})", file=sys.stderr)
    modules = select_modules(args.modules, args.skip)
    report = scan(target, ctx, modules, workers=args.workers, progress=progress_printer(args.quiet))
    print_summary(report, write_reports(report, args.out, args.format))
    return report


def read_targets(path: Path) -> List[Target]:
    targets = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = {f.strip().lower(): f for f in reader.fieldnames or []}
        if not fields.keys() & {"domain", "company"}:
            raise ValueError("CSV needs a header row with a 'domain' and/or 'company' column")
        for line, row in enumerate(reader, start=2):
            domain = (row.get(fields.get("domain", ""), "") or "").strip()
            company = (row.get(fields.get("company", ""), "") or "").strip()
            if not (domain or company):
                continue
            try:
                targets.append(Target(domain=domain or None, company=company or None))
            except ValueError as exc:
                raise ValueError(f"{path}:{line}: {exc}") from exc
    return targets


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = Config.from_env(timeout=getattr(args, "timeout", None), contact=getattr(args, "contact", None),
                             max_subdomains=getattr(args, "max_subdomains", None))
    if args.command == "modules":
        print_modules(config)
        return 0

    bad_formats = [f for f in args.format if f not in RENDERERS]
    if bad_formats:
        parser.error(f"unknown format(s): {', '.join(bad_formats)}")
    try:
        select_modules(args.modules, args.skip)
        if args.command == "scan":
            targets = [Target(domain=args.domain, company=args.company)]
        else:
            targets = read_targets(args.csv)
    except (ValueError, OSError) as exc:
        parser.error(str(exc))

    reports = []
    for target in targets:
        reports.append(run_target(target, args, Context(config)))

    if args.command == "batch":
        summary = args.out / "batch-summary.csv"
        with summary.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["domain", "company", "high", "medium", "low", "info", "errors"])
            for report in reports:
                counts = report.severity_counts
                errors = sum(r.status == "error" for r in report.results)
                writer.writerow([report.target.domain or "", report.target.company or "",
                                 counts["high"], counts["medium"], counts["low"], counts["info"], errors])
        print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
