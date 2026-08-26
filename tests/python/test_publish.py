import hashlib
import json
import os
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
                    "image": "https://example.invalid/published.webp",
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
            latest = json.loads((output_path / "latest.json").read_text("utf-8"))
            root_artifacts = {
                relative_path: (output_path / relative_path).read_bytes()
                for relative_path in ["index-meta.json", *metadata["artifacts"]]
            }
            snapshot_root = output_path / "snapshots" / latest["snapshotId"]
            snapshot_artifacts = {
                relative_path: (snapshot_root / relative_path).read_bytes()
                for relative_path in root_artifacts
            }

        self.assertEqual({"42": ["fixture/Published"]}, bucket["mods"])
        self.assertEqual(1, modlists["fixture/Published"]["nexusModCount"])
        self.assertEqual("NSFW", modlists["fixture/Published"]["classification"])
        self.assertEqual(
            "https://example.invalid/published.webp",
            modlists["fixture/Published"]["imageUrl"],
        )
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
        self.assertEqual(1, latest["schemaVersion"])
        self.assertEqual("2026-08-25T00:00:00Z", latest["generatedAt"])
        self.assertEqual(
            hashlib.sha256(root_artifacts["index-meta.json"]).hexdigest(),
            latest["snapshotId"],
        )
        self.assertEqual(root_artifacts, snapshot_artifacts)

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
            first_snapshot_id = json.loads(
                (output_path / "latest.json").read_text("utf-8")
            )["snapshotId"]

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
                second_snapshot_id = json.loads(
                    (output_path / "latest.json").read_text("utf-8")
                )["snapshotId"]
                publish_dataset(
                    database_path,
                    output_path,
                    generated_at="2026-08-27T00:00:00Z",
                )

            metadata = json.loads(
                (output_path / "index-meta.json").read_text("utf-8")
            )
            backup_exists = output_path.with_name("published.previous").exists()
            retained_snapshot_ids = {
                path.name
                for path in (output_path / "snapshots").iterdir()
                if path.is_dir()
            }
            current_snapshot_id = json.loads(
                (output_path / "latest.json").read_text("utf-8")
            )["snapshotId"]

        self.assertEqual("2026-08-27T00:00:00Z", metadata["generatedAt"])
        self.assertTrue(backup_exists)
        self.assertNotIn(first_snapshot_id, retained_snapshot_ids)
        self.assertEqual(
            {second_snapshot_id, current_snapshot_id},
            retained_snapshot_ids,
        )

    def test_retries_a_transient_windows_directory_replace_failure(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Replace Fixture",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "ReplaceFixture",
                    "download": "https://cdn.example/replace",
                },
                "download_metadata": {"Hash": "replace="},
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
            real_replace = os.replace
            candidate_attempts = 0

            def fail_candidate_replace_once(source, destination):
                nonlocal candidate_attempts
                if (
                    Path(source).name.startswith("published.candidate.")
                    and Path(destination) == output_path
                ):
                    candidate_attempts += 1
                    if candidate_attempts == 1:
                        raise PermissionError("candidate directory is temporarily locked")
                return real_replace(source, destination)

            with patch("pipeline.publish.os.replace", side_effect=fail_candidate_replace_once):
                publish_dataset(
                    database_path,
                    output_path,
                    generated_at="2026-08-26T00:00:00Z",
                )

            metadata = json.loads(
                (output_path / "index-meta.json").read_text("utf-8")
            )

        self.assertEqual(2, candidate_attempts)
        self.assertEqual("2026-08-26T00:00:00Z", metadata["generatedAt"])


if __name__ == "__main__":
    unittest.main()
