"""Select modules and run them concurrently against a target."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Dict, Iterable, List, Optional

import bizosint.modules  # noqa: F401  (registers modules)
from bizosint import __version__
from bizosint.core import API_KEY_ENV, REGISTRY, SEVERITIES, Context, Module, ModuleResult, SkipModule, Target

ProgressFn = Callable[[ModuleResult], None]


@dataclass
class Report:
    target: Target
    started_at: str
    finished_at: str = ""
    tool_version: str = __version__
    results: List[ModuleResult] = field(default_factory=list)

    @property
    def findings(self):
        order = {s: i for i, s in enumerate(SEVERITIES)}
        pairs = [(r.module, f) for r in self.results for f in r.findings]
        return sorted(pairs, key=lambda p: order[p[1].severity])

    @property
    def severity_counts(self) -> Dict[str, int]:
        counts = {s: 0 for s in SEVERITIES}
        for _, finding in self.findings:
            counts[finding.severity] += 1
        return counts


def select_modules(only: Optional[Iterable[str]] = None, skip: Iterable[str] = ()) -> List[Module]:
    names = list(only) if only else list(REGISTRY)
    unknown = [n for n in list(names) + list(skip) if n not in REGISTRY]
    if unknown:
        raise ValueError(f"unknown module(s): {', '.join(unknown)} (see `bizosint modules`)")
    skip = set(skip)
    return sorted((REGISTRY[n] for n in names if n not in skip), key=lambda m: m.order)


def run_module(mod: Module, target: Target, ctx: Context) -> ModuleResult:
    result = ModuleResult(module=mod.name, category=mod.category, status="ok")
    missing = [field_ for field_ in mod.requires if not getattr(target, field_)]
    start = time.monotonic()
    try:
        if missing:
            raise SkipModule(f"requires --{' --'.join(missing)}")
        if mod.api_key and not ctx.config.api_keys.get(mod.api_key):
            raise SkipModule(f"set {API_KEY_ENV[mod.api_key]} to enable")
        output = mod.func(target, ctx)
        result.data, result.findings = output.data, output.findings
    except SkipModule as exc:
        result.status, result.message = "skipped", str(exc)
    except Exception as exc:  # one failing source must not abort the scan
        result.status, result.message = "error", f"{type(exc).__name__}: {exc}"
    result.duration = round(time.monotonic() - start, 2)
    return result


def scan(
    target: Target,
    ctx: Context,
    modules: Optional[List[Module]] = None,
    workers: int = 6,
    progress: Optional[ProgressFn] = None,
) -> Report:
    modules = modules if modules is not None else select_modules()
    report = Report(target=target, started_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(run_module, mod, target, ctx) for mod in modules]
        if progress:
            for future in as_completed(futures):
                progress(future.result())
        report.results = [future.result() for future in futures]
    report.finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return report
