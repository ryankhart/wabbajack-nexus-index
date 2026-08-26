from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from pipeline.runner import IncompleteCatalogError, run_update


class FakeClient:
    def __init__(self) -> None:
        self.network_bytes = 321
        self.cache_hits = 4

    def get_json(self, url: str):
        if url == "https://example.test/repositories.json":
            return {"working": "https://example.test/working.json"}
        if url == "https://example.test/broken.json":
            raise OSError("feed unavailable")
        if url == "https://example.test/working.json":
            return [
                self._record("Indexed", "https://authored-files.wabbajack.org/Indexed"),
                self._record(
                    "Unavailable", "https://authored-files.wabbajack.org/Unavailable"
                ),
                self._record(
                    "Malformed", "https://authored-files.wabbajack.org/Malformed"
                ),
                self._record("Unsupported", "https://github.com/example/list.wabbajack"),
                self._record(
                    "Retired",
                    "https://authored-files.wabbajack.org/Retired",
                    force_down=True,
                ),
                {
                    **self._record(
                        "Other Game", "https://authored-files.wabbajack.org/Other"
                    ),
                    "game": "fallout4",
                },
            ]
        raise AssertionError(f"unexpected URL: {url}")

    @staticmethod
    def _record(title: str, download: str, *, force_down: bool = False):
        return {
            "title": title,
            "game": "skyrimspecialedition",
            "version": "1.0.0",
            "force_down": force_down,
            "links": {
                "machineURL": title.replace(" ", ""),
                "download": download,
                "readme": f"https://example.test/{title.replace(' ', '')}",
            },
            "download_metadata": {"Hash": f"{title}-hash="},
        }


class RunUpdateTests(unittest.TestCase):
    def test_source_failure_preserves_last_known_good_database_and_publication(self):
        class FailingSourceClient(FakeClient):
            def get_json(self, url: str):
                if url == "https://example.test/repositories.json":
                    return {
                        "working": "https://example.test/working.json",
                        "broken": "https://example.test/broken.json",
                    }
                return super().get_json(url)

        def valid_manifest(_):
            return {
                "Archives": [
                    {
                        "State": {
                            "$type": "Nexus",
                            "Game": "SkyrimSpecialEdition",
                            "ModID": 42,
                            "FileID": 100,
                        }
                    }
                ]
            }

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "database.sqlite"
            published = root / "published"
            run_update(
                registry_url="https://example.test/repositories.json",
                client=FakeClient(),
                database_path=database,
                output_path=published,
                generated_at="2026-08-25T20:00:00Z",
                read_manifest=valid_manifest,
            )
            database_before = database.read_bytes()
            publication_before = {
                path.relative_to(published).as_posix(): path.read_bytes()
                for path in published.rglob("*")
                if path.is_file()
            }

            with self.assertRaisesRegex(IncompleteCatalogError, "broken"):
                run_update(
                    registry_url="https://example.test/repositories.json",
                    client=FailingSourceClient(),
                    database_path=database,
                    output_path=published,
                    generated_at="2026-08-26T00:00:00Z",
                    read_manifest=lambda _: (_ for _ in ()).throw(
                        AssertionError("manifest reads must not start after a source failure")
                    ),
                )

            publication_after = {
                path.relative_to(published).as_posix(): path.read_bytes()
                for path in published.rglob("*")
                if path.is_file()
            }

            self.assertEqual(database_before, database.read_bytes())
            self.assertEqual(publication_before, publication_after)

    def test_materializes_reconciled_database_and_static_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls: list[str] = []

            def read_manifest(url: str):
                calls.append(url)
                if url.endswith("/Unavailable"):
                    raise OSError("installer unavailable")
                if url.endswith("/Malformed"):
                    raise ValueError("manifest is not a JSON object")
                if url.endswith("/Other"):
                    return {
                        "Archives": [
                            {
                                "State": {
                                    "$type": "Nexus",
                                    "Game": "Fallout4",
                                    "ModID": 99,
                                    "FileID": 200,
                                }
                            }
                        ]
                    }
                return {
                    "Archives": [
                        {
                            "State": {
                                "$type": "NexusDownloader, Wabbajack.Lib",
                                "Game": "SkyrimSpecialEdition",
                                "ModID": 42,
                                "FileID": 100,
                            }
                        }
                    ]
                }

            result = run_update(
                registry_url="https://example.test/repositories.json",
                client=FakeClient(),
                database_path=root / "database.sqlite",
                output_path=root / "published",
                generated_at="2026-08-25T20:00:00Z",
                read_manifest=read_manifest,
            )

            self.assertEqual(6, result.run.discovered)
            self.assertEqual(6, len(result.discovery.records))
            self.assertEqual(
                {
                    "excluded": 1,
                    "indexed": 2,
                    "malformed": 1,
                    "unavailable": 1,
                    "unsupported": 1,
                },
                result.run.counts,
            )
            self.assertEqual(
                [
                    "https://authored-files.wabbajack.org/Indexed",
                    "https://authored-files.wabbajack.org/Unavailable",
                    "https://authored-files.wabbajack.org/Malformed",
                    "https://authored-files.wabbajack.org/Other",
                ],
                calls,
            )
            self.assertEqual(321, result.network_bytes)
            self.assertEqual(4, result.cache_hits)

            with closing(sqlite3.connect(root / "database.sqlite")) as connection:
                statuses = dict(
                    connection.execute("SELECT title, status FROM modlists")
                )
                sources = dict(
                    connection.execute(
                        "SELECT repository_name, status FROM catalog_sources"
                    )
                )
            self.assertEqual(
                {
                    "Indexed": "indexed",
                    "Malformed": "malformed",
                    "Other Game": "indexed",
                    "Retired": "excluded",
                    "Unavailable": "unavailable",
                    "Unsupported": "unsupported",
                },
                statuses,
            )
            self.assertEqual(
                {"working": "fetched"}, sources
            )

            coverage = json.loads((root / "published" / "coverage.json").read_text())
            index_metadata = json.loads(
                (root / "published" / "index-meta.json").read_text()
            )
            fallout_bucket = json.loads(
                (root / "published" / "games" / "fallout4" / "0.json").read_text()
            )
            self.assertEqual(1, coverage["sourceCounts"]["total"])
            self.assertEqual(0, coverage["sourceCounts"].get("fetch_error", 0))
            self.assertEqual("2026-08-25T20:00:00Z", coverage["generatedAt"])
            self.assertEqual(
                {"fallout4": [0], "skyrimspecialedition": [0]},
                index_metadata["buckets"],
            )
            coverage_items = {item["title"]: item for item in coverage["items"]}
            for title in ("Malformed", "Retired", "Unavailable", "Unsupported"):
                item = coverage_items[title]
                self.assertEqual(f"working/{title.replace(' ', '')}", item["stableId"])
                self.assertEqual("https://example.test/working.json", item["repositoryUrl"])
                self.assertTrue(item["downloadUrl"])
                self.assertTrue(item["status"])
                self.assertTrue(item["error"])
            self.assertEqual(["working/OtherGame"], fallout_bucket["mods"]["99"])

    def test_reuses_unchanged_verified_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def first_reader(url: str):
                if url.endswith("/Unavailable"):
                    raise OSError("installer unavailable")
                if url.endswith("/Malformed"):
                    raise ValueError("manifest is not a JSON object")
                return {
                    "Archives": [
                        {
                            "State": {
                                "$type": "NexusDownloader, Wabbajack.Lib",
                                "Game": "SkyrimSpecialEdition",
                                "ModID": 42,
                                "FileID": 100,
                            }
                        }
                    ]
                }

            run_update(
                registry_url="https://example.test/repositories.json",
                client=FakeClient(),
                database_path=root / "database.sqlite",
                output_path=root / "published",
                generated_at="2026-08-25T20:00:00Z",
                read_manifest=first_reader,
            )

            second_calls: list[str] = []

            def second_reader(url: str):
                second_calls.append(url)
                if url.endswith("/Indexed"):
                    raise AssertionError("unchanged verified snapshot was reread")
                if url.endswith("/Malformed"):
                    raise ValueError("manifest is not a JSON object")
                raise OSError("installer unavailable")

            result = run_update(
                registry_url="https://example.test/repositories.json",
                client=FakeClient(),
                database_path=root / "database.sqlite",
                output_path=root / "published",
                generated_at="2026-08-26T00:00:00Z",
                read_manifest=second_reader,
            )

            indexed = next(item for item in result.run.items if item.record.title == "Indexed")
            self.assertEqual("indexed", indexed.status)
            self.assertEqual([(42, (100,))], [(item.mod_id, item.file_ids) for item in indexed.memberships])
            self.assertNotIn(
                "https://authored-files.wabbajack.org/Indexed", second_calls
            )

    def test_retains_prior_memberships_as_stale_when_changed_manifest_fails(self):
        class ChangingClient(FakeClient):
            def __init__(self):
                super().__init__()
                self.version = "1.0.0"

            def get_json(self, url: str):
                if url == "https://example.test/repositories.json":
                    return {"working": "https://example.test/working.json"}
                if url == "https://example.test/working.json":
                    item = self._record(
                        "Indexed", "https://authored-files.wabbajack.org/Indexed"
                    )
                    item["version"] = self.version
                    item["download_metadata"]["Hash"] = f"hash-{self.version}="
                    return [item]
                raise AssertionError(f"unexpected URL: {url}")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            client = ChangingClient()
            run_update(
                registry_url="https://example.test/repositories.json",
                client=client,
                database_path=root / "database.sqlite",
                output_path=root / "published",
                generated_at="2026-08-25T20:00:00Z",
                read_manifest=lambda _: {
                    "Archives": [
                        {
                            "State": {
                                "$type": "NexusDownloader, Wabbajack.Lib",
                                "Game": "SkyrimSpecialEdition",
                                "ModID": 42,
                                "FileID": 100,
                            }
                        }
                    ]
                },
            )

            client.version = "2.0.0"
            result = run_update(
                registry_url="https://example.test/repositories.json",
                client=client,
                database_path=root / "database.sqlite",
                output_path=root / "published",
                generated_at="2026-08-26T00:00:00Z",
                read_manifest=lambda _: (_ for _ in ()).throw(
                    OSError("new installer unavailable")
                ),
            )

            item = result.run.items[0]
            published = json.loads(
                (root / "published" / "modlists.json").read_text("utf-8")
            )["working/Indexed"]

        self.assertEqual("stale", item.status)
        self.assertEqual([(42, (100,))], [(edge.mod_id, edge.file_ids) for edge in item.memberships])
        self.assertIn("new installer unavailable", item.error)
        self.assertEqual("stale", published["status"])


if __name__ == "__main__":
    unittest.main()
