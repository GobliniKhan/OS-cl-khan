"""Targets, configuration, results and the module registry."""

from __future__ import annotations

import os
import re
import threading
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from bizosint import __version__
from bizosint.http import HttpClient

SEVERITIES = ("high", "medium", "low", "info")

API_KEY_ENV = {
    "shodan": "SHODAN_API_KEY",
    "hunter": "HUNTER_API_KEY",
    "github": "GITHUB_TOKEN",
    "companies_house": "COMPANIES_HOUSE_API_KEY",
}


def normalize_domain(value: Optional[str]) -> Optional[str]:
    """Reduce a URL or hostname to a bare lowercase domain (no scheme, path, port or leading www)."""
    if not value:
        return None
    value = value.strip().lower()
    value = re.sub(r"^[a-z][a-z0-9+.-]*://", "", value)
    value = re.split(r"[/?#]", value, maxsplit=1)[0]
    value = value.rsplit("@", 1)[-1].split(":", 1)[0].strip(".")
    if value.startswith("www."):
        value = value[4:]
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}", value):
        raise ValueError(f"not a valid domain: {value!r}")
    return value


@dataclass
class Target:
    domain: Optional[str] = None
    company: Optional[str] = None

    def __post_init__(self) -> None:
        self.domain = normalize_domain(self.domain)
        self.company = (self.company or "").strip() or None
        if not (self.domain or self.company):
            raise ValueError("a target needs a domain, a company name, or both")

    @property
    def label(self) -> str:
        return self.company or self.domain or "target"


@dataclass
class Config:
    timeout: float = 20.0
    contact: Optional[str] = None
    max_subdomains: int = 500
    api_keys: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_env(cls, **overrides: Any) -> "Config":
        keys = {name: os.environ[env] for name, env in API_KEY_ENV.items() if os.environ.get(env)}
        cfg = cls(contact=os.environ.get("BIZOSINT_CONTACT"), api_keys=keys)
        for key, value in overrides.items():
            if value is not None:
                setattr(cfg, key, value)
        return cfg

    @property
    def user_agent(self) -> str:
        contact = f"; {self.contact}" if self.contact else ""
        return f"bizosint/{__version__} (passive OSINT research{contact})"


class Context:
    """Shared state for one scan: config, HTTP client and a thread-safe memo cache."""

    def __init__(self, config: Config, http: Optional[HttpClient] = None):
        self.config = config
        self.http = http or HttpClient(config.user_agent, timeout=config.timeout)
        self._cache: Dict[Any, Any] = {}
        self._locks: Dict[Any, threading.Lock] = {}
        self._guard = threading.Lock()

    def memo(self, key: Any, factory: Callable[[], Any]) -> Any:
        """Compute `factory()` once per key, even when several modules ask concurrently."""
        with self._guard:
            if key in self._cache:
                return self._cache[key]
            lock = self._locks.setdefault(key, threading.Lock())
        with lock:
            with self._guard:
                if key in self._cache:
                    return self._cache[key]
            value = factory()
            with self._guard:
                self._cache[key] = value
            return value


@dataclass
class Finding:
    severity: str
    title: str
    detail: str = ""

    def __post_init__(self) -> None:
        if self.severity not in SEVERITIES:
            raise ValueError(f"unknown severity {self.severity!r}")


@dataclass
class Output:
    """What a module function returns."""

    data: Dict[str, Any]
    findings: List[Finding] = field(default_factory=list)


@dataclass
class ModuleResult:
    module: str
    category: str
    status: str  # ok | skipped | error
    data: Dict[str, Any] = field(default_factory=dict)
    findings: List[Finding] = field(default_factory=list)
    message: str = ""
    duration: float = 0.0


class SkipModule(Exception):
    """Raised by a module that cannot run for this target (missing input, key, etc.)."""


ModuleFunc = Callable[[Target, Context], Output]


@dataclass
class Module:
    name: str
    description: str
    category: str
    func: ModuleFunc
    requires: Tuple[str, ...] = ("domain",)
    api_key: Optional[str] = None
    order: int = 0


REGISTRY: Dict[str, Module] = {}


def module(
    name: str,
    description: str,
    category: str,
    requires: Tuple[str, ...] = ("domain",),
    api_key: Optional[str] = None,
) -> Callable[[ModuleFunc], ModuleFunc]:
    """Register a module. `requires` lists target fields that must all be set."""

    def decorator(func: ModuleFunc) -> ModuleFunc:
        if name in REGISTRY:
            raise ValueError(f"duplicate module name {name!r}")
        REGISTRY[name] = Module(name, description, category, func, requires, api_key, len(REGISTRY))
        return func

    return decorator
