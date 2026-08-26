from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from pipeline.http import CachedHttpClient


class CachedHttpClientTests(unittest.TestCase):
    def test_persists_successful_response_by_url_across_client_instances(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            calls: list[str] = []

            def opener(url: str, timeout: float) -> bytes:
                calls.append(url)
                self.assertEqual(timeout, 12.0)
                return b'{"ok": true}'

            first = CachedHttpClient(Path(directory), opener=opener, timeout=12.0)
            self.assertEqual(first.get_bytes("https://example.test/feed.json"), b'{"ok": true}')
            self.assertEqual(first.network_bytes, 12)
            self.assertEqual(first.cache_hits, 0)

            second = CachedHttpClient(Path(directory), opener=opener, timeout=12.0)
            self.assertEqual(second.get_json("https://example.test/feed.json"), {"ok": True})
            self.assertEqual(second.network_bytes, 0)
            self.assertEqual(second.cache_hits, 1)
            self.assertEqual(calls, ["https://example.test/feed.json"])

    def test_percent_encodes_spaces_before_opening_or_caching(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            opened: list[str] = []

            def opener(url: str, timeout: float) -> bytes:
                opened.append(url)
                return b"ok"

            client = CachedHttpClient(Path(directory), opener=opener)
            raw = "https://example.test/A List.wabbajack/definition.json.gz"
            self.assertEqual(b"ok", client.get_bytes(raw))
            self.assertEqual(
                ["https://example.test/A%20List.wabbajack/definition.json.gz"], opened
            )
            self.assertEqual(b"ok", client.get_bytes(raw))
            self.assertEqual(1, client.cache_hits)

    def test_does_not_cache_failed_or_oversized_responses(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            responses = iter((RuntimeError("network failure"), b"12345", b"ok"))

            def opener(url: str, timeout: float) -> bytes:
                response = next(responses)
                if isinstance(response, Exception):
                    raise response
                return response

            client = CachedHttpClient(Path(directory), opener=opener, max_bytes=4)
            with self.assertRaisesRegex(RuntimeError, "network failure"):
                client.get_bytes("https://example.test/item")
            with self.assertRaisesRegex(ValueError, "exceeds 4 bytes"):
                client.get_bytes("https://example.test/item")
            self.assertEqual(client.get_bytes("https://example.test/item"), b"ok")


if __name__ == "__main__":
    unittest.main()
