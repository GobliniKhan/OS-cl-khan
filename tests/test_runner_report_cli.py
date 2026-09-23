import json

import pytest

from bizosint import cli
from bizosint.core import REGISTRY, Config, Context, Finding, ModuleResult, Output, Target
from bizosint.report import render_html, render_json, render_markdown
from bizosint.runner import Report, run_module, scan, select_modules


def test_select_modules():
    assert [m.name for m in select_modules(["pivots", "dns"])] == ["dns", "pivots"]
    assert "dns" not in [m.name for m in select_modules(skip=["dns"])]
    with pytest.raises(ValueError, match="unknown module"):
        select_modules(["nope"])


def test_run_module_skips_and_isolates_errors(ctx):
    company_only = Target(company="Acme")
    assert run_module(REGISTRY["dns"], company_only, ctx).status == "skipped"
    assert "SHODAN_API_KEY" in run_module(REGISTRY["shodan"], Target(domain="acme.com"), ctx).message
    # FakeHttp has no crt.sh route, so the module raises; the runner must contain it.
    result = run_module(REGISTRY["subdomains"], Target(domain="acme.com"), ctx)
    assert result.status == "error" and "HttpError" in result.message


def test_scan_keeps_module_order(ctx):
    seen = []
    report = scan(Target(domain="acme.com", company="Acme"), ctx, select_modules(["dns", "pivots", "lei"]),
                  progress=seen.append)
    assert [r.module for r in report.results] == ["dns", "lei", "pivots"]
    assert len(seen) == 3


def sample_report():
    report = Report(target=Target(domain="acme.com", company="Acme <Corp>"), started_at="2026-09-23T00:00:00+00:00",
                    finished_at="2026-09-23T00:00:05+00:00")
    report.results = [
        ModuleResult("email", "email", "ok", {"spf": {"record": "v=spf1 -all"}, "links": ["https://acme.com/x"]},
                     [Finding("info", "Info thing"), Finding("high", "<script>alert(1)</script>", "d|e")]),
        ModuleResult("sec", "business", "skipped", message="no match"),
    ]
    return report


def test_findings_sorted_by_severity():
    report = sample_report()
    assert [f.severity for _, f in report.findings] == ["high", "info"]
    assert report.severity_counts == {"high": 1, "medium": 0, "low": 0, "info": 1}


def test_renderers():
    report = sample_report()
    data = json.loads(render_json(report))
    assert data["summary"]["high"] == 1 and data["modules"][1]["status"] == "skipped"
    md = render_markdown(report)
    assert "| HIGH | email |" in md and "d\\|e" in md and "<https://acme.com/x>" in md
    page = render_html(report)
    assert "<script>alert(1)</script>" not in page
    assert "&lt;script&gt;" in page and "Acme &lt;Corp&gt;" in page
    assert "href='https://acme.com/x'" in page


def test_read_targets(tmp_path):
    path = tmp_path / "t.csv"
    path.write_text("Company,Domain\nAcme,https://www.acme.com\n,\nGlobex,\n", encoding="utf-8")
    targets = cli.read_targets(path)
    assert [(t.company, t.domain) for t in targets] == [("Acme", "acme.com"), ("Globex", None)]
    path.write_text("name\nAcme\n", encoding="utf-8")
    with pytest.raises(ValueError):
        cli.read_targets(path)


def test_cli_scan_writes_reports(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(REGISTRY["pivots"], "func", lambda t, c: Output({"ok": True}, [Finding("medium", "M")]))
    rc = cli.main(["scan", "-d", "acme.com", "-m", "pivots", "-o", str(tmp_path), "-q"])
    assert rc == 0
    written = sorted(p.suffix for p in tmp_path.iterdir())
    assert written == [".html", ".json", ".md"]
    assert "MEDIUM [pivots] M" in capsys.readouterr().err


def test_cli_batch(tmp_path, monkeypatch):
    targets = tmp_path / "targets.csv"
    targets.write_text("domain,company\nacme.com,Acme\nglobex.com,\n", encoding="utf-8")
    rc = cli.main(["batch", str(targets), "-m", "pivots", "-f", "json", "-o", str(tmp_path / "out"), "-q"])
    assert rc == 0
    summary = (tmp_path / "out" / "batch-summary.csv").read_text().splitlines()
    assert summary[0].startswith("domain,company,high") and len(summary) == 3


def test_cli_rejects_bad_input(capsys):
    with pytest.raises(SystemExit):
        cli.main(["scan"])
    with pytest.raises(SystemExit):
        cli.main(["scan", "-d", "acme.com", "-f", "pdf"])
    assert "unknown format" in capsys.readouterr().err
