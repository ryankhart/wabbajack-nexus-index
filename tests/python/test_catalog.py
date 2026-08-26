import unittest

from pipeline.catalog import discover_catalog, normalize_repository_payload


class NormalizeRepositoryPayloadTests(unittest.TestCase):
    def test_rejects_non_object_entries_instead_of_silently_dropping_them(self):
        with self.assertRaisesRegex(ValueError, "catalog entry 1 must be an object"):
            normalize_repository_payload(
                repository_name="example-repo",
                repository_url="https://example.invalid/modlists.json",
                payload=[
                    {
                        "title": "Valid",
                        "game": "skyrimspecialedition",
                        "version": "1.0.0",
                        "links": {"machineURL": "Valid"},
                        "download_metadata": {"Hash": "valid="},
                    },
                    "malformed entry",
                ],
            )

    def test_rejects_empty_snapshot_identity_fields(self):
        valid = {
            "title": "Identity Fixture",
            "game": "skyrimspecialedition",
            "version": "1.0.0",
            "links": {"machineURL": "IdentityFixture"},
            "download_metadata": {"Hash": "identity="},
        }
        cases = {
            "machineURL": {**valid, "links": {"machineURL": ""}},
            "version": {**valid, "version": ""},
            "download hash": {**valid, "download_metadata": {"Hash": ""}},
        }
        for field, payload in cases.items():
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, field):
                    normalize_repository_payload(
                        repository_name="example-repo",
                        repository_url="https://example.invalid/modlists.json",
                        payload=payload,
                    )

    def test_accepts_a_single_object_and_attaches_source_identity(self):
        payload = {
            "title": "Example Skyrim List",
            "game": "skyrimspecialedition",
            "version": "1.2.3",
            "nsfw": False,
            "links": {
                "machineURL": "ExampleList",
                "download": "https://authored-files.wabbajack.org/example.wabbajack_123",
            },
            "download_metadata": {"Hash": "abc=", "NumberOfArchives": 12},
        }

        records = normalize_repository_payload(
            repository_name="example-repo",
            repository_url="https://example.invalid/modlists.json",
            payload=payload,
        )

        self.assertEqual(1, len(records))
        record = records[0]
        self.assertEqual("example-repo", record.repository_name)
        self.assertEqual("https://example.invalid/modlists.json", record.repository_url)
        self.assertEqual("ExampleList", record.machine_url)
        self.assertEqual("skyrimspecialedition", record.game)
        self.assertEqual("abc=", record.download_hash)
        self.assertTrue(record.in_skyrim_family)

    def test_collapses_exact_duplicate_list_snapshots(self):
        entry = {
            "title": "Duplicate",
            "game": "skyrimspecialedition",
            "version": "1.2.3",
            "links": {
                "machineURL": "Duplicate",
                "download": "https://authored-files.wabbajack.org/Duplicate",
            },
            "download_metadata": {"Hash": "same="},
        }
        records = normalize_repository_payload(
            repository_name="example-repo",
            repository_url="https://example.invalid/modlists.json",
            payload=[entry, dict(entry)],
        )
        self.assertEqual(1, len(records))

    def test_duplicate_snapshots_retain_each_source_entry(self):
        first = {
            "title": "Duplicate",
            "game": "skyrimspecialedition",
            "version": "1.2.3",
            "source_note": "first occurrence",
            "links": {"machineURL": "Duplicate"},
            "download_metadata": {"Hash": "same="},
        }
        second = {
            **first,
            "source_note": "second occurrence",
        }

        records = normalize_repository_payload(
            repository_name="example-repo",
            repository_url="https://example.invalid/modlists.json",
            payload=[first, second],
        )

        self.assertEqual(1, len(records))
        provenance = records[0].raw["_source_provenance"]
        self.assertEqual(2, len(provenance))
        self.assertEqual(
            ["first occurrence", "second occurrence"],
            [item["entry"]["source_note"] for item in provenance],
        )
        self.assertTrue(
            all(
                item["repositoryUrl"]
                == "https://example.invalid/modlists.json"
                for item in provenance
            )
        )


class DiscoverCatalogTests(unittest.TestCase):
    def test_records_malformed_repository_payload_as_a_source_error(self):
        responses = {
            "registry": {"malformed": "https://example.invalid/malformed.json"},
            "https://example.invalid/malformed.json": ["not a catalog object"],
        }

        result = discover_catalog("registry", fetch_json=responses.__getitem__)

        self.assertEqual((), result.records)
        self.assertEqual("fetch_error", result.sources["malformed"].status)
        self.assertIn("catalog entry 0 must be an object", result.sources["malformed"].error)

    def test_records_repository_failures_without_hiding_successes(self):
        responses = {
            "registry": {
                "good": "https://example.invalid/good.json",
                "broken": "https://example.invalid/broken.json",
            },
            "https://example.invalid/good.json": [
                {
                    "title": "Good List",
                    "game": "skyrimspecialedition",
                    "version": "1.0.0",
                    "links": {"machineURL": "Good", "download": "https://example.invalid/good.wabbajack"},
                    "download_metadata": {"Hash": "hash="},
                }
            ],
        }

        calls = []

        def fetch_json(url):
            calls.append(url)
            if url == "https://example.invalid/broken.json":
                raise OSError("feed unavailable")
            return responses[url]

        result = discover_catalog("registry", fetch_json=fetch_json)

        self.assertEqual(2, result.repository_count)
        self.assertEqual(["Good"], [record.machine_url for record in result.records])
        self.assertEqual("fetch_error", result.sources["broken"].status)
        self.assertIn("feed unavailable", result.sources["broken"].error)
        self.assertEqual(
            {
                "registry": 1,
                "https://example.invalid/good.json": 1,
                "https://example.invalid/broken.json": 1,
            },
            {url: calls.count(url) for url in calls},
        )


if __name__ == "__main__":
    unittest.main()
