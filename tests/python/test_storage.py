import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from pipeline import storage
from pipeline.catalog import normalize_repository_payload
from pipeline.indexer import index_catalog_records
from pipeline.storage import (
    load_latest_verified_memberships,
    load_verified_snapshots,
    write_index_run,
)


class StorageTests(unittest.TestCase):
    def test_persists_list_snapshot_and_exact_memberships(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Stored List",
                "game": "skyrimspecialedition",
                "version": "2.0.0",
                "nsfw": True,
                "official": False,
                "links": {
                    "machineURL": "Stored",
                    "download": "https://cdn.example/stored",
                    "readme": "https://example.invalid/readme",
                },
                "download_metadata": {"Hash": "stored-hash=", "NumberOfArchives": 2},
            },
        )[0]
        run = index_catalog_records(
            [record],
            read_manifest=lambda _: {
                "Archives": [
                    {
                        "State": {
                            "$type": "NexusDownloader, Wabbajack.Lib",
                            "Game": "SkyrimSpecialEdition",
                            "ModID": 42,
                            "FileID": 1001,
                        }
                    }
                ]
            },
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "index.sqlite"
            write_index_run(database_path, run, generated_at="2026-08-25T00:00:00Z")
            with closing(sqlite3.connect(database_path)) as connection:
                list_row = connection.execute(
                    "SELECT stable_id, title, nexus_mod_count, nsfw, status FROM modlists"
                ).fetchone()
                membership_row = connection.execute(
                    "SELECT game_domain, mod_id, file_ids_json FROM memberships"
                ).fetchone()

        self.assertEqual(("fixture/Stored", "Stored List", 1, 1, "indexed"), list_row)
        self.assertEqual(("skyrimspecialedition", 42, "[1001]"), membership_row)

    def test_preserves_changed_snapshots_and_tombstones_removed_lists(self):
        def record(machine_url: str, version: str, *, nsfw: bool):
            return normalize_repository_payload(
                repository_name="fixture",
                repository_url="https://example.invalid/modlists.json",
                payload={
                    "title": machine_url,
                    "game": "skyrimspecialedition",
                    "version": version,
                    "nsfw": nsfw,
                    "links": {
                        "machineURL": machine_url,
                        "download": f"https://cdn.example/{machine_url}/{version}",
                    },
                    "download_metadata": {"Hash": f"{machine_url}-{version}="},
                },
            )[0]

        first_run = index_catalog_records(
            [record("Retained", "1.0.0", nsfw=False), record("Removed", "1.0.0", nsfw=False)],
            read_manifest=lambda _: {"Archives": []},
        )
        second_run = index_catalog_records(
            [record("Retained", "2.0.0", nsfw=True)],
            read_manifest=lambda _: {"Archives": []},
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "index.sqlite"
            write_index_run(database_path, first_run, generated_at="2026-08-25T00:00:00Z")
            write_index_run(database_path, second_run, generated_at="2026-08-26T00:00:00Z")
            with closing(sqlite3.connect(database_path)) as connection:
                current = connection.execute(
                    "SELECT stable_id, version, nsfw FROM modlists ORDER BY stable_id"
                ).fetchall()
                history = connection.execute(
                    """
                    SELECT stable_id, version, nsfw
                    FROM modlist_snapshots
                    ORDER BY stable_id, version
                    """
                ).fetchall()
                tombstones = connection.execute(
                    """
                    SELECT stable_id, absent_since, last_version
                    FROM tombstones
                    ORDER BY stable_id
                    """
                ).fetchall()

        self.assertEqual([("fixture/Retained", "2.0.0", 1)], current)
        self.assertEqual(
            [
                ("fixture/Removed", "1.0.0", 0),
                ("fixture/Retained", "1.0.0", 0),
                ("fixture/Retained", "2.0.0", 1),
            ],
            history,
        )
        self.assertEqual(
            [("fixture/Removed", "2026-08-26T00:00:00Z", "1.0.0")],
            tombstones,
        )

    def test_parser_upgrades_invalidate_reuse_and_preserve_distinct_snapshots(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Parser Fixture",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "ParserFixture",
                    "download": "https://cdn.example/ParserFixture/1.0.0",
                },
                "download_metadata": {"Hash": "parser-fixture="},
            },
        )[0]
        run = index_catalog_records(
            [record],
            read_manifest=lambda _: {"Archives": []},
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "index.sqlite"
            write_index_run(database_path, run, generated_at="2026-08-25T00:00:00Z")

            current_parser_version = storage.PARSER_VERSION
            next_parser_version = str(int(current_parser_version) + 1)
            with patch("pipeline.storage.PARSER_VERSION", next_parser_version):
                self.assertEqual({}, load_verified_snapshots(database_path))
                write_index_run(database_path, run, generated_at="2026-08-26T00:00:00Z")

            with closing(sqlite3.connect(database_path)) as connection:
                parser_versions = connection.execute(
                    "SELECT parser_version FROM modlist_snapshots ORDER BY parser_version"
                ).fetchall()

        self.assertEqual(
            [(current_parser_version,), (next_parser_version,)], parser_versions
        )

    def test_all_game_parser_invalidates_skyrim_only_version_three_cache(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "All Game Parser Fixture",
                "game": "falloutnewvegas",
                "version": "1.0.0",
                "links": {
                    "machineURL": "AllGameParserFixture",
                    "download": "https://cdn.example/AllGameParserFixture",
                },
                "download_metadata": {"Hash": "all-game-parser="},
            },
        )[0]
        run = index_catalog_records(
            [record],
            read_manifest=lambda _: {"Archives": []},
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "index.sqlite"
            with patch("pipeline.storage.PARSER_VERSION", "3"):
                write_index_run(
                    database_path,
                    run,
                    generated_at="2026-08-25T00:00:00Z",
                )

            self.assertEqual({}, load_verified_snapshots(database_path))
            self.assertEqual({}, load_latest_verified_memberships(database_path))


if __name__ == "__main__":
    unittest.main()
