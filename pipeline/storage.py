from __future__ import annotations

import json
import hashlib
import os
import shutil
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from .catalog import CatalogSourceResult
from .indexer import IndexRun
from .manifest import NexusMembership

PARSER_VERSION = "4"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_sources (
    repository_name TEXT PRIMARY KEY,
    repository_url TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS modlists (
    stable_id TEXT PRIMARY KEY,
    repository_name TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    machine_url TEXT NOT NULL,
    title TEXT NOT NULL,
    game TEXT NOT NULL,
    version TEXT NOT NULL,
    nsfw INTEGER,
    official INTEGER,
    force_down INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT NOT NULL,
    download_url TEXT NOT NULL,
    readme_url TEXT NOT NULL,
    download_hash TEXT NOT NULL,
    declared_archive_count INTEGER,
    nexus_mod_count INTEGER NOT NULL,
    raw_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
    stable_id TEXT NOT NULL REFERENCES modlists(stable_id),
    game_domain TEXT NOT NULL,
    mod_id INTEGER NOT NULL,
    file_ids_json TEXT NOT NULL,
    PRIMARY KEY (stable_id, game_domain, mod_id)
);
CREATE INDEX IF NOT EXISTS memberships_by_mod ON memberships(game_domain, mod_id);
CREATE TABLE IF NOT EXISTS modlist_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    stable_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    version TEXT NOT NULL,
    download_hash TEXT NOT NULL,
    download_url TEXT NOT NULL,
    readme_url TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    nsfw INTEGER,
    official INTEGER,
    force_down INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT NOT NULL,
    raw_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_by_list
ON modlist_snapshots(stable_id, captured_at);
CREATE TABLE IF NOT EXISTS membership_snapshots (
    snapshot_id TEXT NOT NULL REFERENCES modlist_snapshots(snapshot_id),
    game_domain TEXT NOT NULL,
    mod_id INTEGER NOT NULL,
    file_ids_json TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, game_domain, mod_id)
);
CREATE TABLE IF NOT EXISTS tombstones (
    stable_id TEXT PRIMARY KEY,
    absent_since TEXT NOT NULL,
    last_version TEXT NOT NULL,
    last_download_hash TEXT NOT NULL
);
"""


def _optional_bool(value: bool | None) -> int | None:
    return None if value is None else int(value)


def load_verified_snapshots(
    database_path: str | Path,
) -> dict[tuple[str, str, str, str], tuple[NexusMembership, ...]]:
    source = Path(database_path)
    if not source.exists():
        return {}
    try:
        with closing(sqlite3.connect(source)) as connection:
            connection.row_factory = sqlite3.Row
            parser_row = connection.execute(
                "SELECT value FROM metadata WHERE key = 'parser_version'"
            ).fetchone()
            if parser_row is None or str(parser_row["value"]) != PARSER_VERSION:
                return {}
            rows = connection.execute(
                """
                SELECT repository_name, machine_url, version, download_hash,
                       game_domain, mod_id, file_ids_json
                FROM modlists
                LEFT JOIN memberships USING (stable_id)
                WHERE status = 'indexed' AND version != '' AND download_hash != ''
                ORDER BY repository_name, machine_url, version, download_hash,
                         game_domain, mod_id
                """
            ).fetchall()
    except sqlite3.Error:
        return {}

    snapshots: dict[
        tuple[str, str, str, str], list[NexusMembership]
    ] = {}
    for row in rows:
        key = (
            row["repository_name"],
            row["machine_url"],
            row["version"],
            row["download_hash"],
        )
        snapshots.setdefault(key, [])
        if row["game_domain"] is None:
            continue
        try:
            file_ids = tuple(json.loads(row["file_ids_json"]))
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        snapshots[key].append(
            NexusMembership(
                game_domain=row["game_domain"],
                mod_id=row["mod_id"],
                file_ids=file_ids,
            )
        )
    return {key: tuple(memberships) for key, memberships in snapshots.items()}


def load_latest_verified_memberships(
    database_path: str | Path,
) -> dict[str, tuple[NexusMembership, ...]]:
    source = Path(database_path)
    if not source.exists():
        return {}
    try:
        with closing(sqlite3.connect(source)) as connection:
            connection.row_factory = sqlite3.Row
            if _metadata_value(connection, "parser_version", "") != PARSER_VERSION:
                return {}
            rows = connection.execute(
                """
                SELECT stable_id, game_domain, mod_id, file_ids_json
                FROM modlists
                LEFT JOIN memberships USING (stable_id)
                WHERE status IN ('indexed', 'stale')
                ORDER BY stable_id, game_domain, mod_id
                """
            ).fetchall()
    except sqlite3.Error:
        return {}

    snapshots: dict[str, list[NexusMembership]] = {}
    for row in rows:
        snapshots.setdefault(row["stable_id"], [])
        if row["game_domain"] is None:
            continue
        try:
            file_ids = tuple(json.loads(row["file_ids_json"]))
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        snapshots[row["stable_id"]].append(
            NexusMembership(
                game_domain=row["game_domain"],
                mod_id=row["mod_id"],
                file_ids=file_ids,
            )
        )
    return {stable_id: tuple(edges) for stable_id, edges in snapshots.items()}


def _metadata_value(connection: sqlite3.Connection, key: str, default: str) -> str:
    row = connection.execute(
        "SELECT value FROM metadata WHERE key = ?", (key,)
    ).fetchone()
    return default if row is None else str(row[0])


def _snapshot_current_rows(
    connection: sqlite3.Connection, *, captured_at: str, parser_version: str
) -> None:
    connection.row_factory = sqlite3.Row
    rows = connection.execute("SELECT * FROM modlists ORDER BY stable_id").fetchall()
    for row in rows:
        memberships = connection.execute(
            """
            SELECT game_domain, mod_id, file_ids_json
            FROM memberships
            WHERE stable_id = ?
            ORDER BY game_domain, mod_id
            """,
            (row["stable_id"],),
        ).fetchall()
        identity = {
            "stable_id": row["stable_id"],
            "repository_url": row["repository_url"],
            "version": row["version"],
            "download_hash": row["download_hash"],
            "download_url": row["download_url"],
            "readme_url": row["readme_url"],
            "parser_version": parser_version,
            "nsfw": row["nsfw"],
            "official": row["official"],
            "force_down": row["force_down"],
            "status": row["status"],
            "error": row["error"],
            "raw_json": row["raw_json"],
            "memberships": [tuple(membership) for membership in memberships],
        }
        snapshot_id = hashlib.sha256(
            json.dumps(identity, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        connection.execute(
            """
            INSERT OR IGNORE INTO modlist_snapshots(
                snapshot_id, stable_id, captured_at, repository_url, version,
                download_hash, download_url, readme_url, parser_version, nsfw,
                official, force_down, status, error, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_id,
                row["stable_id"],
                captured_at,
                row["repository_url"],
                row["version"],
                row["download_hash"],
                row["download_url"],
                row["readme_url"],
                parser_version,
                row["nsfw"],
                row["official"],
                row["force_down"],
                row["status"],
                row["error"],
                row["raw_json"],
            ),
        )
        connection.executemany(
            """
            INSERT OR IGNORE INTO membership_snapshots(
                snapshot_id, game_domain, mod_id, file_ids_json
            ) VALUES (?, ?, ?, ?)
            """,
            (
                (
                    snapshot_id,
                    membership["game_domain"],
                    membership["mod_id"],
                    membership["file_ids_json"],
                )
                for membership in memberships
            ),
        )


def write_index_run(
    database_path: str | Path,
    run: IndexRun,
    *,
    generated_at: str,
    catalog_sources: dict[str, CatalogSourceResult] | None = None,
) -> None:
    destination = Path(database_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=destination.name + ".", suffix=".tmp", dir=destination.parent
    )
    os.close(file_descriptor)
    temporary_path = Path(temporary_name)
    try:
        if destination.exists():
            shutil.copyfile(destination, temporary_path)
        with closing(sqlite3.connect(temporary_path)) as connection:
            connection.executescript(_SCHEMA)
            previous_generated_at = _metadata_value(
                connection, "generated_at", generated_at
            )
            previous_parser_version = _metadata_value(
                connection, "parser_version", PARSER_VERSION
            )
            _snapshot_current_rows(
                connection,
                captured_at=previous_generated_at,
                parser_version=previous_parser_version,
            )
            previous_rows = {
                row[0]: (row[1], row[2])
                for row in connection.execute(
                    "SELECT stable_id, version, download_hash FROM modlists"
                )
            }
            connection.execute("DELETE FROM memberships")
            connection.execute("DELETE FROM modlists")
            connection.execute("DELETE FROM catalog_sources")
            connection.execute("DELETE FROM metadata")
            connection.executemany(
                "INSERT INTO metadata(key, value) VALUES (?, ?)",
                (
                    ("schema_version", "1"),
                    ("parser_version", PARSER_VERSION),
                    ("generated_at", generated_at),
                    ("discovered", str(run.discovered)),
                    ("status_counts", json.dumps(run.counts, sort_keys=True)),
                ),
            )
            connection.executemany(
                """
                INSERT INTO catalog_sources(
                    repository_name, repository_url, status, error
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    (name, source.repository_url, source.status, source.error)
                    for name, source in sorted((catalog_sources or {}).items())
                ),
            )
            for item in run.items:
                record = item.record
                stable_id = record.stable_id
                connection.execute(
                    """
                    INSERT INTO modlists(
                        stable_id, repository_name, repository_url, machine_url,
                        title, game, version, nsfw, official, force_down, status,
                        error, download_url, readme_url, download_hash,
                        declared_archive_count, nexus_mod_count, raw_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        stable_id,
                        record.repository_name,
                        record.repository_url,
                        record.machine_url,
                        record.title,
                        record.game,
                        record.version,
                        _optional_bool(record.nsfw),
                        _optional_bool(record.official),
                        int(record.force_down),
                        item.status,
                        item.error,
                        record.download_url,
                        record.readme_url,
                        record.download_hash,
                        record.declared_archive_count,
                        item.nexus_mod_count,
                        json.dumps(record.raw, sort_keys=True, separators=(",", ":")),
                    ),
                )
                connection.executemany(
                    """
                    INSERT INTO memberships(stable_id, game_domain, mod_id, file_ids_json)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        (
                            stable_id,
                            membership.game_domain,
                            membership.mod_id,
                            json.dumps(membership.file_ids, separators=(",", ":")),
                        )
                        for membership in item.memberships
                    ),
                )
            current_ids = {
                row[0] for row in connection.execute("SELECT stable_id FROM modlists")
            }
            connection.executemany(
                """
                INSERT OR IGNORE INTO tombstones(
                    stable_id, absent_since, last_version, last_download_hash
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    (stable_id, generated_at, version, download_hash)
                    for stable_id, (version, download_hash) in previous_rows.items()
                    if stable_id not in current_ids
                ),
            )
            connection.executemany(
                "DELETE FROM tombstones WHERE stable_id = ?",
                ((stable_id,) for stable_id in current_ids),
            )
            _snapshot_current_rows(
                connection,
                captured_at=generated_at,
                parser_version=PARSER_VERSION,
            )
            connection.commit()
        os.replace(temporary_path, destination)
    finally:
        temporary_path.unlink(missing_ok=True)
