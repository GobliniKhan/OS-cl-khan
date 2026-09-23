import threading

import pytest

from bizosint.core import API_KEY_ENV, Config, Context, Finding, Target, normalize_domain


@pytest.mark.parametrize("raw, expected", [
    ("example.com", "example.com"),
    ("https://WWW.Example.com/about?x=1", "example.com"),
    ("http://user@shop.example.co.uk:8080/", "shop.example.co.uk"),
    ("example.com.", "example.com"),
])
def test_normalize_domain(raw, expected):
    assert normalize_domain(raw) == expected


@pytest.mark.parametrize("raw", ["not a domain", "localhost", "exa_mple.com", "-bad.com"])
def test_normalize_domain_rejects_invalid(raw):
    with pytest.raises(ValueError):
        normalize_domain(raw)


def test_target_requires_domain_or_company():
    with pytest.raises(ValueError):
        Target()
    assert Target(company="  Acme Corp ").company == "Acme Corp"
    assert Target(domain="acme.com").label == "acme.com"


def test_finding_validates_severity():
    with pytest.raises(ValueError):
        Finding("critical", "x")


def test_config_reads_api_keys_from_env(monkeypatch):
    for env in API_KEY_ENV.values():
        monkeypatch.delenv(env, raising=False)
    monkeypatch.setenv("SHODAN_API_KEY", "abc")
    monkeypatch.setenv("BIZOSINT_CONTACT", "me@corp.example")
    cfg = Config.from_env(timeout=5)
    assert cfg.api_keys == {"shodan": "abc"}
    assert cfg.timeout == 5
    assert "me@corp.example" in cfg.user_agent


def test_memo_computes_once_under_concurrency():
    ctx = Context(Config())
    calls = []

    def factory():
        calls.append(1)
        return 42

    threads = [threading.Thread(target=ctx.memo, args=("k", factory)) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert ctx.memo("k", factory) == 42
    assert len(calls) == 1
