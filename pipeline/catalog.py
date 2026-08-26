from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any


@dataclass(frozen=True)
class CatalogRecord:
    repository_name: str
    repository_url: str
    title: str
    machine_url: str
    game: str
    version: str
    nsfw: bool | None
    official: bool | None
    force_down: bool
    download_url: str
    readme_url: str
    download_hash: str
    declared_archive_count: int | None
    raw: dict[str, Any]

    @property
    def snapshot_key(self) -> tuple[str, str, str, str]:
        return (
            self.repository_name,
            self.machine_url,
            self.version,
            self.download_hash,
        )

    @property
    def stable_id(self) -> str:
        return f"{self.repository_name}/{self.machine_url}"


@dataclass(frozen=True)
class CatalogSourceResult:
    repository_url: str
    status: str
    error: str = ""


@dataclass(frozen=True)
class CatalogDiscovery:
    repository_count: int
    records: tuple[CatalogRecord, ...]
    sources: dict[str, CatalogSourceResult]


def discover_catalog(registry_url: str, *, fetch_json) -> CatalogDiscovery:
    registry = fetch_json(registry_url)
    if not isinstance(registry, dict):
        raise ValueError("repository registry must be an object")
    records: list[CatalogRecord] = []
    sources: dict[str, CatalogSourceResult] = {}
    for repository_name, repository_url_value in registry.items():
        repository_url = str(repository_url_value)
        try:
            payload = fetch_json(repository_url)
            records.extend(
                normalize_repository_payload(
                    repository_name=str(repository_name),
                    repository_url=repository_url,
                    payload=payload,
                )
            )
            sources[str(repository_name)] = CatalogSourceResult(
                repository_url=repository_url, status="fetched"
            )
        except Exception as exc:
            sources[str(repository_name)] = CatalogSourceResult(
                repository_url=repository_url,
                status="fetch_error",
                error=f"{type(exc).__name__}: {exc}",
            )
    return CatalogDiscovery(
        repository_count=len(registry),
        records=tuple(records),
        sources=sources,
    )


def normalize_repository_payload(
    *, repository_name: str, repository_url: str, payload: object
) -> list[CatalogRecord]:
    entries = payload if isinstance(payload, list) else [payload]
    records: list[CatalogRecord] = []
    snapshot_indices: dict[tuple[str, str, str, str], int] = {}
    for entry_index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"catalog entry {entry_index} must be an object")
        links = entry.get("links") if isinstance(entry.get("links"), dict) else {}
        metadata = (
            entry.get("download_metadata")
            if isinstance(entry.get("download_metadata"), dict)
            else {}
        )
        machine_url = str(links.get("machineURL") or "").strip()
        version = str(entry.get("version") or "").strip()
        download_hash = str(metadata.get("Hash") or "").strip()
        for field_name, field_value in (
            ("machineURL", machine_url),
            ("version", version),
            ("download hash", download_hash),
        ):
            if not field_value:
                raise ValueError(
                    f"catalog entry {entry_index} {field_name} must be non-empty"
                )
        source_provenance = {
            "repositoryName": repository_name,
            "repositoryUrl": repository_url,
            "entry": dict(entry),
        }
        raw = dict(entry)
        raw["_source_provenance"] = [source_provenance]
        record = CatalogRecord(
            repository_name=repository_name,
            repository_url=repository_url,
            title=str(entry.get("title") or ""),
            machine_url=machine_url,
            game=str(entry.get("game") or "").lower(),
            version=version,
            nsfw=entry.get("nsfw") if isinstance(entry.get("nsfw"), bool) else None,
            official=(
                entry.get("official")
                if isinstance(entry.get("official"), bool)
                else None
            ),
            force_down=bool(entry.get("force_down", False)),
            download_url=str(links.get("download") or ""),
            readme_url=str(links.get("readme") or ""),
            download_hash=download_hash,
            declared_archive_count=(
                metadata.get("NumberOfArchives")
                if isinstance(metadata.get("NumberOfArchives"), int)
                and not isinstance(metadata.get("NumberOfArchives"), bool)
                else None
            ),
            raw=raw,
        )
        snapshot_key = record.snapshot_key
        if snapshot_key in snapshot_indices:
            index = snapshot_indices[snapshot_key]
            existing = records[index]
            merged_raw = dict(existing.raw)
            merged_raw["_source_provenance"] = [
                *existing.raw["_source_provenance"],
                source_provenance,
            ]
            records[index] = replace(existing, raw=merged_raw)
            continue
        snapshot_indices[snapshot_key] = len(records)
        records.append(record)
    return records
