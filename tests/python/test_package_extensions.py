import json
import os
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts.package_extensions import package_extensions


class PackageExtensionsTests(unittest.TestCase):
    def test_emits_reproducible_archives_matching_both_target_directories(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root / "dist"
            artifacts = root / "artifacts"
            expected = {}
            for target in ("chrome", "firefox"):
                target_root = dist / target
                (target_root / "assets").mkdir(parents=True)
                manifest = {
                    "manifest_version": 3,
                    "name": "Fixture",
                    "target": target,
                }
                files = {
                    "manifest.json": (json.dumps(manifest) + "\n").encode(),
                    "content.js": b"globalThis.fixture = true;\n",
                    "assets/icon.png": b"fixture-png-bytes",
                }
                for relative_path, contents in files.items():
                    path = target_root / relative_path
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(contents)
                expected[target] = files

            first = package_extensions(dist, artifacts)
            first_bytes = {target: path.read_bytes() for target, path in first.items()}
            second = package_extensions(dist, artifacts)

            self.assertEqual(
                {
                    "chrome": artifacts / "wabbajack-nexus-index-chrome-dev.zip",
                    "firefox": artifacts / "wabbajack-nexus-index-firefox-dev.xpi",
                },
                second,
            )
            for target, archive_path in second.items():
                self.assertEqual(first_bytes[target], archive_path.read_bytes())
                with zipfile.ZipFile(archive_path) as archive:
                    archived = {
                        name: archive.read(name)
                        for name in archive.namelist()
                        if not name.endswith("/")
                    }
                self.assertEqual(expected[target], archived)

    def test_rejects_links_that_escape_the_built_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root / "dist"
            artifacts = root / "artifacts"
            for target in ("chrome", "firefox"):
                target_root = dist / target
                target_root.mkdir(parents=True)
                (target_root / "manifest.json").write_text(
                    json.dumps({"manifest_version": 3, "name": "Fixture"}),
                    encoding="utf-8",
                )

            outside = root / "outside-private"
            outside.mkdir()
            (outside / "private.txt").write_text("must not be archived", encoding="utf-8")
            escaped = dist / "chrome" / "escaped"
            if os.name == "nt":
                subprocess.run(
                    ["cmd.exe", "/c", "mklink", "/J", str(escaped), str(outside)],
                    check=True,
                    capture_output=True,
                )
            else:
                escaped.symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "symbolic link or reparse point"):
                package_extensions(dist, artifacts)

            self.assertFalse(
                (artifacts / "wabbajack-nexus-index-chrome-dev.zip").exists()
            )

    def test_rejects_a_linked_built_target_root(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dist = root / "dist"
            artifacts = root / "artifacts"
            outside_chrome = root / "outside-chrome"
            outside_chrome.mkdir()
            (outside_chrome / "manifest.json").write_text(
                json.dumps({"manifest_version": 3, "name": "Outside fixture"}),
                encoding="utf-8",
            )
            (dist / "firefox").mkdir(parents=True)
            (dist / "firefox" / "manifest.json").write_text(
                json.dumps({"manifest_version": 3, "name": "Firefox fixture"}),
                encoding="utf-8",
            )

            linked_chrome = dist / "chrome"
            if os.name == "nt":
                subprocess.run(
                    [
                        "cmd.exe",
                        "/c",
                        "mklink",
                        "/J",
                        str(linked_chrome),
                        str(outside_chrome),
                    ],
                    check=True,
                    capture_output=True,
                )
            else:
                linked_chrome.symlink_to(outside_chrome, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "symbolic link or reparse point"):
                package_extensions(dist, artifacts)

            self.assertFalse(
                (artifacts / "wabbajack-nexus-index-chrome-dev.zip").exists()
            )


if __name__ == "__main__":
    unittest.main()
