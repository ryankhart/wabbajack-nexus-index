from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

from .catalog import CatalogDiscovery, discover_catalog
from .cdn import read_manifest_from_cdn
from .indexer import IndexRun, UnsupportedDownloadError, index_catalog_records
from .publish import publish_dataset
from .storage import (
    load_latest_verified_memberships,
    load_verified_snapshots,
    write_index_run,
)

SUPPORTED_CDN_HOSTS = frozenset(
    {
        "authored-files.wabbajack.org",
        "wabbajack.b-cdn.net",
        "wabbajack-primary.b-cdn.net",
    }
)


class IncompleteCatalogError(RuntimeError):
    """The configured repository frontier could not be fetched completely."""


@dataclass(frozen=True)
class UpdateResult:
    discovery: CatalogDiscovery
    run: IndexRun
    generated_at: str
    network_bytes: int
    cache_hits: int


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _require_supported_cdn(download_url: str) -> None:
    parsed = urlparse(download_url)
    if parsed.scheme != "https" or parsed.hostname not in SUPPORTED_CDN_HOSTS:
        host = parsed.hostname or "missing host"
        raise UnsupportedDownloadError(
            f"{host} is not a supported selective Wabbajack CDN host"
        )


def run_update(
    *,
    registry_url: str,
    client,
    database_path: str | Path,
    output_path: str | Path,
    generated_at: str | None = None,
    read_manifest: Callable[[str], object] | None = None,
    max_workers: int = 1,
    progress=None,
) -> UpdateResult:
    timestamp = generated_at or _utc_timestamp()
    discovery = discover_catalog(registry_url, fetch_json=client.get_json)
    source_failures = {
        name: source
        for name, source in discovery.sources.items()
        if source.status != "fetched"
    }
    if source_failures:
        details = "; ".join(
            f"{name}: {source.error or source.status}"
            for name, source in sorted(source_failures.items())
        )
        raise IncompleteCatalogError(f"catalog discovery incomplete: {details}")
    records = discovery.records
    verified_snapshots = load_verified_snapshots(database_path)
    stale_snapshots = load_latest_verified_memberships(database_path)
    manifest_reader = read_manifest or (
        lambda url: read_manifest_from_cdn(url, fetch_bytes=client.get_bytes)
    )

    def read_supported_manifest(download_url: str) -> object:
        _require_supported_cdn(download_url)
        return manifest_reader(download_url)

    run = index_catalog_records(
        records,
        read_manifest=read_supported_manifest,
        max_workers=max_workers,
        progress=progress,
        verified_snapshots=verified_snapshots,
        stale_snapshots=stale_snapshots,
    )
    write_index_run(
        database_path,
        run,
        generated_at=timestamp,
        catalog_sources=discovery.sources,
    )
    publish_dataset(database_path, output_path, generated_at=timestamp)
    return UpdateResult(
        discovery=discovery,
        run=run,
        generated_at=timestamp,
        network_bytes=int(getattr(client, "network_bytes", 0)),
        cache_hits=int(getattr(client, "cache_hits", 0)),
    )
