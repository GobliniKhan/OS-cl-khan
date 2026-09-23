"""Minimal stdlib HTTP client with retries, used by every module."""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional

MAX_BODY_BYTES = 5 * 1024 * 1024
RETRY_STATUSES = {429, 500, 502, 503, 504}


class HttpError(Exception):
    """Raised when a request fails or returns an unusable response."""

    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


@dataclass
class Response:
    url: str
    status: int
    headers: dict = field(default_factory=dict)
    body: bytes = b""

    @property
    def text(self) -> str:
        match = re.search(r"charset=([\w-]+)", self.headers.get("content-type", ""))
        encoding = match.group(1) if match else "utf-8"
        try:
            return self.body.decode(encoding, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")

    def json(self) -> Any:
        try:
            return json.loads(self.body.decode("utf-8", errors="replace"))
        except ValueError as exc:
            raise HttpError(f"invalid JSON from {self.url}: {exc}", self.status) from exc


class HttpClient:
    def __init__(self, user_agent: str, timeout: float = 20.0, retries: int = 2):
        self.user_agent = user_agent
        self.timeout = timeout
        self.retries = retries

    def get(
        self,
        url: str,
        params: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Response:
        """GET a URL. HTTP error statuses are returned, not raised; network errors raise HttpError."""
        if params:
            url = f"{url}{'&' if '?' in url else '?'}{urllib.parse.urlencode(params)}"
        req_headers = {"User-Agent": self.user_agent, "Accept": "*/*"}
        req_headers.update(headers or {})
        last_error: Optional[Exception] = None
        for attempt in range(self.retries + 1):
            if attempt:
                time.sleep(2 ** (attempt - 1))
            try:
                resp = self._fetch(url, req_headers, timeout or self.timeout)
            except (urllib.error.URLError, OSError, ValueError) as exc:
                last_error = exc
                continue
            if resp.status in RETRY_STATUSES and attempt < self.retries:
                continue
            return resp
        raise HttpError(f"request to {url} failed: {last_error}")

    def get_json(self, url: str, **kwargs: Any) -> Any:
        headers = {"Accept": "application/json", **(kwargs.pop("headers", None) or {})}
        resp = self.get(url, headers=headers, **kwargs)
        if resp.status >= 400:
            raise HttpError(f"HTTP {resp.status} from {url}", resp.status)
        return resp.json()

    @staticmethod
    def _fetch(url: str, headers: Mapping[str, str], timeout: float) -> Response:
        req = urllib.request.Request(url, headers=dict(headers))
        try:
            with urllib.request.urlopen(req, timeout=timeout) as raw:
                return Response(
                    url=raw.geturl(),
                    status=raw.status,
                    headers={k.lower(): v for k, v in raw.headers.items()},
                    body=raw.read(MAX_BODY_BYTES),
                )
        except urllib.error.HTTPError as err:
            return Response(
                url=err.geturl() or url,
                status=err.code,
                headers={k.lower(): v for k, v in (err.headers or {}).items()},
                body=err.read(MAX_BODY_BYTES) if err.fp else b"",
            )
