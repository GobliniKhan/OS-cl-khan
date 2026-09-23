import json
from typing import Any, Callable, Dict, Optional, Union
from urllib.parse import parse_qs, urlparse

import pytest

from bizosint.core import Config, Context
from bizosint.http import HttpError, Response

Handler = Union[Any, Callable[[str, Dict[str, Any]], Any]]


class FakeHttp:
    """Routes requests by URL prefix to canned payloads; unmatched URLs raise like a network failure."""

    def __init__(self) -> None:
        self.routes: Dict[str, Handler] = {}
        self.dns: Dict[tuple, list] = {}
        self.calls: list = []

    def route(self, prefix: str, payload: Handler) -> None:
        self.routes[prefix] = payload

    def add_dns(self, name: str, rtype: str, *answers: str) -> None:
        self.dns[(name, rtype)] = list(answers)

    def get(self, url: str, params: Optional[dict] = None, headers: Optional[dict] = None,
            timeout: Optional[float] = None) -> Response:
        params = dict(params or {})
        self.calls.append((url, params))
        if "dns-query" in url or "dns.google" in url:
            return self._dns(params)
        for prefix in sorted(self.routes, key=len, reverse=True):
            if url.startswith(prefix):
                payload = self.routes[prefix]
                if callable(payload):
                    payload = payload(url, params)
                if isinstance(payload, Response):
                    return payload
                return Response(url=url, status=200, headers={"content-type": "application/json"},
                                body=json.dumps(payload).encode())
        raise HttpError(f"no route for {url}")

    def get_json(self, url: str, **kwargs: Any) -> Any:
        resp = self.get(url, **kwargs)
        if resp.status >= 400:
            raise HttpError(f"HTTP {resp.status} from {url}", resp.status)
        return resp.json()

    def _dns(self, params: dict) -> Response:
        codes = {"A": 1, "NS": 2, "CNAME": 5, "SOA": 6, "MX": 15, "TXT": 16, "AAAA": 28, "CAA": 257}
        answers = self.dns.get((params["name"], params["type"]), [])
        body = {"Status": 0, "Answer": [{"name": params["name"], "type": codes[params["type"]], "data": a}
                                        for a in answers]}
        return Response(url="doh", status=200, body=json.dumps(body).encode())


def html_response(url: str, body: str, status: int = 200, headers: Optional[dict] = None) -> Response:
    return Response(url=url, status=status, headers={"content-type": "text/html; charset=utf-8", **(headers or {})},
                    body=body.encode())


def text_response(url: str, body: str, status: int = 200) -> Response:
    return Response(url=url, status=status, headers={"content-type": "text/plain"}, body=body.encode())


def query(url: str, params: dict) -> dict:
    merged = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
    merged.update(params)
    return merged


@pytest.fixture
def fake_http() -> FakeHttp:
    return FakeHttp()


@pytest.fixture
def ctx(fake_http: FakeHttp) -> Context:
    return Context(Config(timeout=1, contact="test@example.org"), http=fake_http)
