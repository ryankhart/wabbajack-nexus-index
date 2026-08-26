import hashlib
import json
import shutil
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from pipeline.catalog import CatalogSourceResult, normalize_repository_payload
from pipeline.indexer import index_catalog_records
from pipeline.publish import publish_dataset
from pipeline.storage import write_index_run


class PublishDatasetTests(unittest.TestCase):
    def test_emits_lookup_list_metadata_and_reconciled_coverage(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Published List",
                "game": "skyrimspecialedition",
                "version": "3.0.0",
                "nsfw": True,
                "official": False,
                "links": {
                    "machineURL": "Published",
                    "download": "https://cdn.example/published",
                    "readme": "https://example.invalid/readme",
                },
                "download_metadata": {"Hash": "published=", "NumberOfArchives": 1},
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
            root = Path(temp_dir)
            database_path = root / "index.sqlite"
            output_path = root / "published"
            write_index_run(
                database_path,
                run,
                generated_at="2026-08-25T00:00:00Z",
                catalog_sources={
                    "fixture": CatalogSourceResult(
                        repository_url="https://example.invalid/modlists.json",
                        status="fetched",
                        error="",
                    )
                },
            )
            publish_dataset(
                database_path,
                output_path,
                generated_at="2026-08-25T00:00:00Z",
            )
            bucket = json.loads(
                (output_path / "games" / "skyrimspecialedition" / "0.json").read_text("utf-8")
            )
            modlists = json.loads((output_path / "modlists.json").read_text("utf-8"))
            coverage = json.loads((output_path / "coverage.json").read_text("utf-8"))
            metadata = json.loads((output_path / "index-meta.json").read_text("utf-8"))

        self.assertEqual({"42": ["fixture/Published"]}, bucket["mods"])
        self.assertEqual(1, modlists["fixture/Published"]["nexusModCount"])
        self.assertEqual("NSFW", modlists["fixture/Published"]["classification"])
        self.assertEqual(
            "https://www.wabbajack.org/modlist/fixture/Published",
            modlists["fixture/Published"]["wabbajackUrl"],
        )
        self.assertEqual("https://www.wabbajack.org/#/modlists/gallery", modlists["fixture/Published"]["galleryUrl"])
        self.assertEqual(1, coverage["counts"]["indexed"])
        self.assertEqual(1, metadata["discovered"])
        self.assertEqual(1, metadata["indexed"])
        self.assertEqual({"skyrimspecialedition": [0]}, metadata["buckets"])
        expected_source_set = (
            json.dumps(
                [
                    {
                        "repositoryName": "fixture",
                        "repositoryUrl": "https://example.invalid/modlists.json",
                    }
                ],
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n"
        ).encode("utf-8")
        self.assertEqual(
            hashlib.sha256(expected_source_set).hexdigest(),
            metadata["sourceSetHash"],
        )
        shard_hash = metadata["artifacts"]["games/skyrimspecialedition/0.json"]
        self.assertEqual(64, len(shard_hash))

    def test_rejects_unreconciled_candidate_and_preserves_last_known_good(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Safe Publication",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "Safe",
                    "download": "https://cdn.example/safe",
                },
                "download_metadata": {"Hash": "safe="},
            },
        )[0]
        run = index_catalog_records(
            [record], read_manifest=lambda _: {"Archives": []}
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            database_path = root / "index.sqlite"
            output_path = root / "published"
            write_index_run(
                database_path, run, generated_at="2026-08-25T00:00:00Z"
            )
            publish_dataset(
                database_path,
                output_path,
                generated_at="2026-08-25T00:00:00Z",
            )
            known_good = {
                path.relative_to(output_path).as_posix(): path.read_bytes()
                for path in output_path.rglob("*")
                if path.is_file()
            }
            with closing(sqlite3.connect(database_path)) as connection:
                connection.execute(
                    "UPDATE metadata SET value = '2' WHERE key = 'discovered'"
                )
                connection.commit()

            with self.assertRaisesRegex(ValueError, "reconciliation"):
                publish_dataset(
                    database_path,
                    output_path,
                    generated_at="2026-08-26T00:00:00Z",
                )

            after_failure = {
                path.relative_to(output_path).as_posix(): path.read_bytes()
                for path in output_path.rglob("*")
                if path.is_file()
            }
            failed_candidates = list(root.glob("published.failed.*"))

        self.assertEqual(known_good, after_failure)
        self.assertEqual(1, len(failed_candidates))

    def test_backup_cleanup_failure_does_not_fail_valid_atomic_publication(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Cleanup Fixture",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "CleanupFixture",
                    "download": "https://cdn.example/cleanup",
                },
                "download_metadata": {"Hash": "cleanup="},
            },
        )[0]
        run = index_catalog_records(
            [record], read_manifest=lambda _: {"Archives": []}
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            database_path = root / "index.sqlite"
            output_path = root / "published"
            write_index_run(
                database_path, run, generated_at="2026-08-25T00:00:00Z"
            )
            publish_dataset(
                database_path,
                output_path,
                generated_at="2026-08-25T00:00:00Z",
            )

            real_rmtree = shutil.rmtree

            def fail_backup_cleanup(path, *args, **kwargs):
                if Path(path) == output_path.with_name("published.previous"):
                    raise OSError("backup directory is temporarily locked")
                return real_rmtree(path, *args, **kwargs)

            with patch("pipeline.publish.shutil.rmtree", side_effect=fail_backup_cleanup):
                publish_dataset(
                    database_path,
                    output_path,
                    generated_at="2026-08-26T00:00:00Z",
                )
                publish_dataset(
                    database_path,
                    output_path,
                    generated_at="2026-08-27T00:00:00Z",
                )

            metadata = json.loads(
                (output_path / "index-meta.json").read_text("utf-8")
            )
            backup_exists = output_path.with_name("published.previous").exists()

        self.assertEqual("2026-08-27T00:00:00Z", metadata["generatedAt"])
        self.assertTrue(backup_exists)


if __name__ == "__main__":
    unittest.main()
