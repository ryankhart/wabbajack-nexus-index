from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
import time
from collections import Counter, defaultdict
from contextlib import closing
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

_GALLERY_URL = "https://www.wabbajack.org/#/modlists/gallery"
_BUCKET_SIZE = 1000


def _json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _write_json(root: Path, relative_path: str | Path, value: object) -> str:
    destination = root / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = _json_bytes(value)
    destination.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def _classification(value: int | None) -> str:
    if value is None:
        return "UNKNOWN"
    return "NSFW" if value else "SFW"


def _image_url(raw_json: str) -> str:
    try:
        payload = json.loads(raw_json)
    except (TypeError, json.JSONDecodeError):
        return ""
    links = payload.get("links") if isinstance(payload, dict) else None
    value = links.get("image") if isinstance(links, dict) else None
    if not isinstance(value, str):
        return ""
    value = value.strip()
    try:
        parsed = urlparse(value)
    except ValueError:
        return ""
    return value if parsed.scheme == "https" and parsed.netloc else ""


def _failed_candidate_path(output: Path, generated_at: str) -> Path:
    safe_timestamp = "".join(
        character if character.isalnum() else "-" for character in generated_at
    ).strip("-")
    candidate = output.with_name(f"{output.name}.failed.{safe_timestamp}")
    suffix = 1
    while candidate.exists():
        candidate = output.with_name(
            f"{output.name}.failed.{safe_timestamp}.{suffix}"
        )
        suffix += 1
    return candidate


def _available_backup_path(output: Path) -> Path:
    base = output.with_name(output.name + ".previous")
    candidate = base
    suffix = 1
    while candidate.exists():
        candidate = output.with_name(f"{base.name}.{suffix}")
        suffix += 1
    return candidate


def _previous_snapshot(output: Path) -> tuple[str, Path] | None:
    try:
        pointer = json.loads((output / "latest.json").read_text("utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    snapshot_id = pointer.get("snapshotId") if isinstance(pointer, dict) else None
    if not (
        isinstance(snapshot_id, str)
        and len(snapshot_id) == 64
        and all(character in "0123456789abcdef" for character in snapshot_id)
    ):
        return None
    snapshot_root = output / "snapshots" / snapshot_id
    return (snapshot_id, snapshot_root) if snapshot_root.is_dir() else None


def _replace_with_retry(source: Path, destination: Path) -> None:
    for attempt in range(5):
        try:
            os.replace(source, destination)
            return
        except PermissionError:
            if attempt == 4:
                raise
            time.sleep(0.05 * (attempt + 1))


def publish_dataset(
    database_path: str | Path,
    output_path: str | Path,
    *,
    generated_at: str,
) -> None:
    database = Path(database_path)
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(prefix=output.name + ".candidate.", dir=output.parent)
    )
    backup = output.with_name(output.name + ".previous")
    preserve_temporary = False
    try:
        with closing(sqlite3.connect(database)) as connection:
            connection.row_factory = sqlite3.Row
            list_rows = connection.execute(
                "SELECT * FROM modlists ORDER BY stable_id"
            ).fetchall()
            membership_rows = connection.execute(
                "SELECT stable_id, game_domain, mod_id FROM memberships "
                "ORDER BY game_domain, mod_id, stable_id"
            ).fetchall()
            metadata_rows = connection.execute(
                "SELECT key, value FROM metadata ORDER BY key"
            ).fetchall()
            source_rows = connection.execute(
                "SELECT repository_name, repository_url, status, error "
                "FROM catalog_sources ORDER BY repository_name"
            ).fetchall()

        metadata_values = {row["key"]: row["value"] for row in metadata_rows}
        status_counts = json.loads(metadata_values.get("status_counts", "{}"))
        sources = {
            row["repository_name"]: {
                "repositoryUrl": row["repository_url"],
                "status": row["status"],
                "error": row["error"],
            }
            for row in source_rows
        }
        source_statuses = Counter(row["status"] for row in source_rows)
        source_counts = {"total": len(source_rows), **dict(sorted(source_statuses.items()))}
        source_set = [
            {
                "repositoryName": row["repository_name"],
                "repositoryUrl": row["repository_url"],
            }
            for row in source_rows
        ]
        source_set_hash = hashlib.sha256(_json_bytes(source_set)).hexdigest()
        modlists: dict[str, dict[str, Any]] = {}
        coverage_items: list[dict[str, Any]] = []
        for row in list_rows:
            stable_id = row["stable_id"]
            modlists[stable_id] = {
                "title": row["title"],
                "version": row["version"],
                "game": row["game"],
                "official": None if row["official"] is None else bool(row["official"]),
                "classification": _classification(row["nsfw"]),
                "maintenance": bool(row["force_down"]),
                "nexusModCount": row["nexus_mod_count"],
                "imageUrl": _image_url(row["raw_json"]),
                "wabbajackUrl": (
                    "https://www.wabbajack.org/modlist/"
                    f"{quote(row['repository_name'], safe='')}/"
                    f"{quote(row['machine_url'], safe='')}"
                ),
                "galleryUrl": _GALLERY_URL,
                "readmeUrl": row["readme_url"],
                "status": row["status"],
            }
            coverage_items.append(
                {
                    "stableId": stable_id,
                    "title": row["title"],
                    "status": row["status"],
                    "error": row["error"],
                    "repositoryUrl": row["repository_url"],
                    "downloadUrl": row["download_url"],
                    "version": row["version"],
                    "downloadHash": row["download_hash"],
                }
            )

        buckets: dict[tuple[str, int], dict[str, list[str]]] = defaultdict(dict)
        grouped_ids: dict[tuple[str, int, int], list[str]] = defaultdict(list)
        for row in membership_rows:
            bucket_number = row["mod_id"] // _BUCKET_SIZE
            grouped_ids[(row["game_domain"], bucket_number, row["mod_id"])].append(
                row["stable_id"]
            )
        for (game_domain, bucket_number, mod_id), stable_ids in grouped_ids.items():
            buckets[(game_domain, bucket_number)][str(mod_id)] = sorted(stable_ids)

        artifact_hashes = {
            "modlists.json": _write_json(temporary, "modlists.json", modlists)
        }
        coverage = {
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "discovered": len(list_rows),
            "counts": status_counts,
            "sourceCounts": source_counts,
            "sources": sources,
            "items": coverage_items,
        }
        artifact_hashes["coverage.json"] = _write_json(
            temporary, "coverage.json", coverage
        )
        bucket_manifest: dict[str, set[int]] = defaultdict(set)
        for (game_domain, bucket_number), mods in sorted(buckets.items()):
            relative_path = Path("games") / game_domain / f"{bucket_number}.json"
            artifact_hashes[relative_path.as_posix()] = _write_json(
                temporary,
                relative_path,
                {
                    "schemaVersion": 1,
                    "gameDomain": game_domain,
                    "bucket": bucket_number,
                    "bucketSize": _BUCKET_SIZE,
                    "mods": mods,
                },
            )
            bucket_manifest[game_domain].add(bucket_number)

        published_buckets = {
            game_domain: sorted(bucket_numbers)
            for game_domain, bucket_numbers in sorted(bucket_manifest.items())
        }
        index_metadata = {
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "bucketSize": _BUCKET_SIZE,
            "discovered": len(list_rows),
            "indexed": int(status_counts.get("indexed", 0)),
            "sourceSetHash": source_set_hash,
            "statusCounts": status_counts,
            "buckets": published_buckets,
            "artifacts": dict(sorted(artifact_hashes.items())),
        }
        _write_json(temporary, "index-meta.json", index_metadata)

        try:
            declared_discovered = int(metadata_values["discovered"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("publication reconciliation metadata is invalid") from exc
        actual_status_counts = dict(
            sorted(Counter(row["status"] for row in list_rows).items())
        )
        if (
            declared_discovered != len(list_rows)
            or sum(status_counts.values()) != len(list_rows)
            or dict(sorted(status_counts.items())) != actual_status_counts
        ):
            raise ValueError("publication reconciliation does not match current rows")
        stable_ids = set(modlists)
        if any(row["stable_id"] not in stable_ids for row in membership_rows):
            raise ValueError("publication membership references an unknown list")

        index_metadata_bytes = (temporary / "index-meta.json").read_bytes()
        snapshot_id = hashlib.sha256(index_metadata_bytes).hexdigest()
        snapshot_root = temporary / "snapshots" / snapshot_id
        for relative_path in ["index-meta.json", *artifact_hashes]:
            source = temporary / relative_path
            destination = snapshot_root / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        previous_snapshot = _previous_snapshot(output)
        if previous_snapshot is not None and previous_snapshot[0] != snapshot_id:
            shutil.copytree(
                previous_snapshot[1],
                temporary / "snapshots" / previous_snapshot[0],
            )
        _write_json(
            temporary,
            "latest.json",
            {
                "schemaVersion": 1,
                "snapshotId": snapshot_id,
                "generatedAt": generated_at,
            },
        )

        if backup.exists():
            try:
                shutil.rmtree(backup)
            except OSError:
                backup = _available_backup_path(output)
        if output.exists():
            _replace_with_retry(output, backup)
        try:
            _replace_with_retry(temporary, output)
        except Exception:
            if backup.exists() and not output.exists():
                _replace_with_retry(backup, output)
            raise
        if backup.exists():
            try:
                shutil.rmtree(backup)
            except OSError:
                # The reconciled candidate is already live. A Windows process may
                # temporarily retain a handle to the old tree, so leave it for a
                # later run instead of reporting a false publication failure.
                pass
    except Exception as publication_error:
        if temporary.exists():
            try:
                _replace_with_retry(
                    temporary, _failed_candidate_path(output, generated_at)
                )
            except OSError as retention_error:
                preserve_temporary = True
                publication_error.add_note(
                    "failed publication candidate remains at "
                    f"{temporary}: {type(retention_error).__name__}: {retention_error}"
                )
        raise
    finally:
        if temporary.exists() and not preserve_temporary:
            shutil.rmtree(temporary)
