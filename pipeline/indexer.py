from __future__ import annotations

import json
import zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from collections.abc import Mapping
from typing import Any, Callable, Iterable

from .catalog import CatalogRecord
from .manifest import NexusMembership, extract_nexus_memberships_with_diagnostics


class UnsupportedDownloadError(Exception):
    """The installer URL cannot be handled without an unsafe full download."""


@dataclass(frozen=True)
class IndexItem:
    record: CatalogRecord
    status: str
    memberships: tuple[NexusMembership, ...] = ()
    error: str = ""

    @property
    def nexus_mod_count(self) -> int:
        return len(self.memberships)


@dataclass(frozen=True)
class IndexRun:
    items: tuple[IndexItem, ...]
    counts: dict[str, int]

    @property
    def discovered(self) -> int:
        return len(self.items)


def _failure_item(
    record: CatalogRecord,
    *,
    status: str,
    error: str,
    stale_snapshots: Mapping[str, tuple[NexusMembership, ...]],
) -> IndexItem:
    if record.stable_id in stale_snapshots:
        return IndexItem(
            record=record,
            status="stale",
            memberships=stale_snapshots[record.stable_id],
            error=f"{error}; retained prior verified memberships",
        )
    return IndexItem(record=record, status=status, error=error)


def _manifest_dict(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    manifest = getattr(value, "manifest", None)
    if isinstance(manifest, dict):
        return manifest
    raise ValueError("manifest reader did not return a JSON object")


def _rejection_error(rejections: tuple[str, ...]) -> str:
    preview = "; ".join(rejections[:5])
    if len(rejections) > 5:
        preview += f"; {len(rejections) - 5} additional rejection(s)"
    return f"rejected {len(rejections)} malformed Nexus archive state(s): {preview}"


def _index_record(
    record: CatalogRecord,
    read_manifest: Callable[[str], object],
    verified_snapshots: Mapping[
        tuple[str, str, str, str], tuple[NexusMembership, ...]
    ],
    stale_snapshots: Mapping[str, tuple[NexusMembership, ...]],
) -> IndexItem:
    if record.force_down:
        return IndexItem(
            record=record,
            status="excluded",
            error="catalog record is marked force_down",
        )
    if not record.download_url:
        return _failure_item(
            record,
            status="unsupported",
            error="catalog record has no installer download URL",
            stale_snapshots=stale_snapshots,
        )
    if (
        record.version
        and record.download_hash
        and record.snapshot_key in verified_snapshots
    ):
        return IndexItem(
            record=record,
            status="indexed",
            memberships=verified_snapshots[record.snapshot_key],
        )
    try:
        manifest = _manifest_dict(read_manifest(record.download_url))
        extraction = extract_nexus_memberships_with_diagnostics(manifest)
        memberships = extraction.memberships
        if extraction.rejections:
            error = _rejection_error(extraction.rejections)
            if not memberships:
                return _failure_item(
                    record,
                    status="malformed",
                    error=error,
                    stale_snapshots=stale_snapshots,
                )
            return IndexItem(
                record=record,
                status="indexed",
                memberships=memberships,
                error=error,
            )
        return IndexItem(
            record=record,
            status="indexed",
            memberships=memberships,
        )
    except UnsupportedDownloadError as exc:
        return _failure_item(
            record,
            status="unsupported",
            error=f"{type(exc).__name__}: {exc}",
            stale_snapshots=stale_snapshots,
        )
    except (ValueError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        return _failure_item(
            record,
            status="malformed",
            error=f"{type(exc).__name__}: {exc}",
            stale_snapshots=stale_snapshots,
        )
    except Exception as exc:
        return _failure_item(
            record,
            status="unavailable",
            error=f"{type(exc).__name__}: {exc}",
            stale_snapshots=stale_snapshots,
        )


def index_catalog_records(
    records: Iterable[CatalogRecord],
    *,
    read_manifest: Callable[[str], object],
    max_workers: int = 1,
    progress: Callable[[IndexItem, int, int], None] | None = None,
    verified_snapshots: Mapping[
        tuple[str, str, str, str], tuple[NexusMembership, ...]
    ]
    | None = None,
    stale_snapshots: Mapping[str, tuple[NexusMembership, ...]] | None = None,
) -> IndexRun:
    if max_workers < 1:
        raise ValueError("max_workers must be at least 1")
    ordered_records = tuple(records)
    snapshots = verified_snapshots or {}
    prior_by_list = stale_snapshots or {}
    total = len(ordered_records)
    if max_workers == 1:
        iterator = (
            _index_record(record, read_manifest, snapshots, prior_by_list)
            for record in ordered_records
        )
        items = []
        for position, item in enumerate(iterator, start=1):
            items.append(item)
            if progress is not None:
                progress(item, position, total)
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            iterator = executor.map(
                lambda record: _index_record(
                    record, read_manifest, snapshots, prior_by_list
                ),
                ordered_records,
            )
            items = []
            for position, item in enumerate(iterator, start=1):
                items.append(item)
                if progress is not None:
                    progress(item, position, total)

    counts = dict(Counter(item.status for item in items))
    if sum(counts.values()) != len(items):
        raise AssertionError("terminal status reconciliation failed")
    return IndexRun(items=tuple(items), counts=counts)
