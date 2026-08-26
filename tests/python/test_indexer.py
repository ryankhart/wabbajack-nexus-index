import threading
import unittest

from pipeline.catalog import normalize_repository_payload
from pipeline.indexer import UnsupportedDownloadError, index_catalog_records


class IndexCatalogRecordsTests(unittest.TestCase):
    def test_terminalizes_a_manifest_when_every_exact_nexus_state_is_malformed(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Malformed Nexus IDs",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "MalformedNexusIds",
                    "download": "https://cdn.example/malformed-ids",
                },
                "download_metadata": {"Hash": "malformed-ids="},
            },
        )[0]

        result = index_catalog_records(
            [record],
            read_manifest=lambda _: {
                "Archives": [
                    {
                        "State": {
                            "$type": "Nexus",
                            "Game": "UnknownGame",
                            "ModID": 1,
                            "FileID": 10,
                        }
                    }
                ]
            },
        )

        self.assertEqual("malformed", result.items[0].status)
        self.assertIn("unknown Nexus game", result.items[0].error)

    def test_retains_valid_memberships_and_reports_mixed_rejections(self):
        record = normalize_repository_payload(
            repository_name="fixture",
            repository_url="https://example.invalid/modlists.json",
            payload={
                "title": "Mixed Nexus IDs",
                "game": "skyrimspecialedition",
                "version": "1.0.0",
                "links": {
                    "machineURL": "MixedNexusIds",
                    "download": "https://cdn.example/mixed-ids",
                },
                "download_metadata": {"Hash": "mixed-ids="},
            },
        )[0]

        result = index_catalog_records(
            [record],
            read_manifest=lambda _: {
                "Archives": [
                    {
                        "State": {
                            "$type": "Nexus",
                            "Game": "SkyrimSpecialEdition",
                            "ModID": 42,
                            "FileID": 100,
                        }
                    },
                    {
                        "State": {
                            "$type": "Nexus",
                            "Game": "SkyrimSpecialEdition",
                            "ModID": 0,
                            "FileID": 101,
                        }
                    },
                ]
            },
        )

        item = result.items[0]
        self.assertEqual("indexed", item.status)
        self.assertEqual([(42, (100,))], [(edge.mod_id, edge.file_ids) for edge in item.memberships])
        self.assertIn("ModID must be a positive integer", item.error)

    def test_reconciles_every_record_to_one_terminal_status(self):
        records = []
        for title, machine_url, game, download in (
            ("Good", "Good", "skyrimspecialedition", "https://cdn.example/good"),
            ("Broken", "Broken", "skyrim", "https://cdn.example/broken"),
            ("Other Game", "Other", "fallout4", "https://cdn.example/other"),
        ):
            records.extend(
                normalize_repository_payload(
                    repository_name="fixture",
                    repository_url="https://example.invalid/modlists.json",
                    payload={
                        "title": title,
                        "game": game,
                        "version": "1.0.0",
                        "links": {"machineURL": machine_url, "download": download},
                        "download_metadata": {"Hash": machine_url + "="},
                    },
                )
            )

        def read_manifest(download_url):
            if download_url.endswith("/broken"):
                raise OSError("CDN unavailable")
            if download_url.endswith("/other"):
                return {"Archives": []}
            return {
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
            }

        result = index_catalog_records(records, read_manifest=read_manifest)

        self.assertEqual(3, result.discovered)
        self.assertEqual(2, result.counts["indexed"])
        self.assertEqual(1, result.counts["unavailable"])
        self.assertNotIn("excluded", result.counts)
        self.assertEqual(3, sum(result.counts.values()))
        self.assertEqual(1, result.items[0].nexus_mod_count)
        self.assertIn("CDN unavailable", result.items[1].error)
        self.assertEqual("indexed", result.items[2].status)

    def test_force_down_and_unsupported_downloads_are_explicit(self):
        records = []
        for title, force_down in (("Retired", True), ("Unknown Host", False)):
            records.extend(
                normalize_repository_payload(
                    repository_name="fixture",
                    repository_url="https://example.invalid/modlists.json",
                    payload={
                        "title": title,
                        "game": "skyrimspecialedition",
                        "version": "1.0.0",
                        "force_down": force_down,
                        "links": {
                            "machineURL": title.replace(" ", ""),
                            "download": "https://unknown.example/list.wabbajack",
                        },
                        "download_metadata": {"Hash": title.replace(" ", "") + "="},
                    },
                )
            )

        def read_manifest(download_url):
            raise UnsupportedDownloadError("not a supported Wabbajack CDN URL")

        result = index_catalog_records(records, read_manifest=read_manifest)

        self.assertEqual(["excluded", "unsupported"], [item.status for item in result.items])
        self.assertIn("force_down", result.items[0].error)
        self.assertIn("supported Wabbajack CDN", result.items[1].error)
        self.assertEqual(2, sum(result.counts.values()))

    def test_parallel_manifest_reads_preserve_catalog_order(self):
        records = []
        for title in ("First", "Second"):
            records.extend(
                normalize_repository_payload(
                    repository_name="fixture",
                    repository_url="https://example.invalid/modlists.json",
                    payload={
                        "title": title,
                        "game": "skyrimspecialedition",
                        "version": "1.0.0",
                        "links": {
                            "machineURL": title,
                            "download": f"https://cdn.example/{title.lower()}",
                        },
                        "download_metadata": {"Hash": title + "="},
                    },
                )
            )
        barrier = threading.Barrier(2)

        def read_manifest(download_url):
            barrier.wait(timeout=2)
            return {"Archives": []}

        result = index_catalog_records(
            records, read_manifest=read_manifest, max_workers=2
        )

        self.assertEqual(["First", "Second"], [item.record.title for item in result.items])
        self.assertEqual({"indexed": 2}, result.counts)


if __name__ == "__main__":
    unittest.main()
