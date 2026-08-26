from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlsplit, urlunsplit


DEFAULT_MAX_AGE_SECONDS = 4 * 60 * 60
DEFAULT_MAX_BYTES = 8 * 1024 * 1024
DEFAULT_USER_AGENT = "Wabbajack-Nexus-Index/0.1 (+local reproducible indexer)"


def _normalize_https_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise ValueError("only HTTPS URLs are accepted")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("credential-bearing URLs are not accepted")
    host = parsed.hostname.encode("idna").decode("ascii")
    if parsed.port is not None:
        host = f"{host}:{parsed.port}"
    path = quote(parsed.path, safe="/%:@!$&'()*+,;=-._~")
    query = quote(parsed.query, safe="=&?/:@!$'()*+,;%-._~")
    return urlunsplit(("https", host, path, query, ""))


class CachedHttpClient:
    """Small bounded HTTP client with an atomic, time-limited disk cache."""

    def __init__(
        self,
        cache_dir: Path,
        *,
        opener: Callable[[str, float], bytes] | None = None,
        timeout: float = 30.0,
        max_bytes: int = DEFAULT_MAX_BYTES,
        max_age_seconds: float = DEFAULT_MAX_AGE_SECONDS,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        if max_bytes <= 0:
            raise ValueError("max_bytes must be positive")
        if max_age_seconds < 0:
            raise ValueError("max_age_seconds cannot be negative")
        self.cache_dir = Path(cache_dir)
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.max_age_seconds = max_age_seconds
        self.user_agent = user_agent
        self._opener = opener or self._open_url
        self._locks_guard = threading.Lock()
        self._url_locks: dict[str, threading.Lock] = {}
        self._stats_lock = threading.Lock()
        self.network_bytes = 0
        self.cache_hits = 0

    def _cache_path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.cache_dir / digest[:2] / digest[2:]

    def _url_lock(self, url: str) -> threading.Lock:
        with self._locks_guard:
            return self._url_locks.setdefault(url, threading.Lock())

    def _fresh_cached_bytes(self, path: Path) -> bytes | None:
        try:
            stat = path.stat()
        except FileNotFoundError:
            return None
        if time.time() - stat.st_mtime > self.max_age_seconds:
            return None
        data = path.read_bytes()
        if len(data) > self.max_bytes:
            return None
        return data

    def _open_url(self, url: str, timeout: float) -> bytes:
        request = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            declared = response.headers.get("Content-Length")
            if declared is not None and int(declared) > self.max_bytes:
                raise ValueError(f"response exceeds {self.max_bytes} bytes")
            data = response.read(self.max_bytes + 1)
        return data

    def get_bytes(self, url: str) -> bytes:
        normalized_url = _normalize_https_url(url)
        path = self._cache_path(normalized_url)
        with self._url_lock(normalized_url):
            cached = self._fresh_cached_bytes(path)
            if cached is not None:
                with self._stats_lock:
                    self.cache_hits += 1
                return cached

            data = self._opener(normalized_url, self.timeout)
            if len(data) > self.max_bytes:
                raise ValueError(f"response exceeds {self.max_bytes} bytes")

            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
            try:
                temporary.write_bytes(data)
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)
            with self._stats_lock:
                self.network_bytes += len(data)
            return data

    def get_json(self, url: str) -> Any:
        return json.loads(self.get_bytes(url).decode("utf-8-sig"))
