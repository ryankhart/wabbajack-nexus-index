from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from pipeline.cli import _parser, main


class FakeClient:
    network_bytes = 99
    cache_hits = 3

    def get_json(self, url: str):
        if url.endswith("repositories.json"):
            return {"fixture": "https://example.test/modlists.json"}
        return {
            "title": "Fixture List",
            "game": "skyrimspecialedition",
            "version": "1.0",
            "links": {
                "machineURL": "FixtureList",
                "download": "https://authored-files.wabbajack.org/FixtureList",
            },
            "download_metadata": {"Hash": "fixture-list="},
        }


class CliTests(unittest.TestCase):
    def test_help_describes_the_complete_registered_index(self) -> None:
        self.assertIn(
            "all registered Wabbajack modlists",
            _parser().format_help(),
        )

    def test_build_command_prints_progress_and_json_summary(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stdout = io.StringIO()
            stderr = io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                status = main(
                    [
                        "build",
                        "--registry-url",
                        "https://example.test/repositories.json",
                        "--database",
                        str(root / "index.sqlite"),
                        "--output",
                        str(root / "public"),
                        "--workers",
                        "2",
                    ],
                    client=FakeClient(),
                    read_manifest=lambda url: {"Archives": []},
                )

            self.assertEqual(0, status)
            summary = json.loads(stdout.getvalue())
            self.assertEqual({"indexed": 1}, summary["statusCounts"])
            self.assertEqual(1, summary["discovered"])
            self.assertEqual(99, summary["networkBytes"])
            self.assertIn("[1/1] indexed Fixture List", stderr.getvalue())
            self.assertTrue((root / "public" / "index-meta.json").is_file())


if __name__ == "__main__":
    unittest.main()
