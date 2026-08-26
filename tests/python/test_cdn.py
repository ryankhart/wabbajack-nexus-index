import gzip
import io
import json
import unittest
import zipfile

from pipeline.cdn import ChunkedCdnStream, Part, read_manifest_from_cdn


class ChunkedManifestReaderTests(unittest.TestCase):
    def test_reads_modlist_without_fetching_unrelated_middle_chunks(self):
        archive_buffer = io.BytesIO()
        with zipfile.ZipFile(archive_buffer, "w", allowZip64=True) as archive:
            archive.writestr(
                "modlist",
                json.dumps({"Name": "Fixture List", "Archives": []}),
                compress_type=zipfile.ZIP_DEFLATED,
            )
            archive.writestr(
                "unrelated-inline-payload",
                bytes(range(256)) * 32,
                compress_type=zipfile.ZIP_STORED,
            )
        archive_bytes = archive_buffer.getvalue()
        part_size = 512
        chunks = [
            archive_bytes[offset : offset + part_size]
            for offset in range(0, len(archive_bytes), part_size)
        ]
        definition = {
            "Size": len(archive_bytes),
            "Parts": [
                {"Index": index, "Offset": index * part_size, "Size": len(chunk)}
                for index, chunk in enumerate(chunks)
            ],
        }
        fetched_urls = []

        def fetch_bytes(url):
            fetched_urls.append(url)
            if url.endswith("/definition.json.gz"):
                return gzip.compress(json.dumps(definition).encode("utf-8"))
            index = int(url.rsplit("/", 1)[1])
            return chunks[index]

        result = read_manifest_from_cdn(
            "https://cdn.example/fixture.wabbajack_123",
            fetch_bytes=fetch_bytes,
        )

        self.assertEqual("Fixture List", result.manifest["Name"])
        self.assertEqual((0, len(chunks) - 1), result.fetched_parts)
        self.assertEqual(len(chunks[0]) + len(chunks[-1]), result.bytes_downloaded)
        self.assertEqual(
            {
                "https://cdn.example/fixture.wabbajack_123/definition.json.gz",
                "https://cdn.example/fixture.wabbajack_123/parts/0",
                f"https://cdn.example/fixture.wabbajack_123/parts/{len(chunks) - 1}",
            },
            set(fetched_urls),
        )
        self.assertEqual(3, len(fetched_urls))

    def test_rejects_a_part_response_with_the_wrong_length(self):
        stream = ChunkedCdnStream(
            base_url="https://cdn.example/fixture",
            archive_size=4,
            parts=[Part(index=0, offset=0, size=4)],
            fetch_bytes=lambda _: b"bad",
        )

        with self.assertRaisesRegex(IOError, "length mismatch"):
            stream.read()

    def test_rejects_a_malformed_definition_before_requesting_parts(self):
        fetched_urls = []

        def fetch_bytes(url):
            fetched_urls.append(url)
            return gzip.compress(json.dumps({"Size": 10}).encode("utf-8"))

        with self.assertRaisesRegex(ValueError, "invalid CDN definition"):
            read_manifest_from_cdn(
                "https://cdn.example/fixture",
                fetch_bytes=fetch_bytes,
            )

        self.assertEqual(
            ["https://cdn.example/fixture/definition.json.gz"], fetched_urls
        )


if __name__ == "__main__":
    unittest.main()
