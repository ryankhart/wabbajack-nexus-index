from __future__ import annotations

import bisect
import gzip
import io
import json
import zipfile
from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class ManifestRead:
    manifest: dict[str, Any]
    fetched_parts: tuple[int, ...]
    bytes_downloaded: int
    archive_size: int


@dataclass(frozen=True)
class Part:
    index: int
    offset: int
    size: int


class ChunkedCdnStream(io.RawIOBase):
    def __init__(
        self,
        *,
        base_url: str,
        archive_size: int,
        parts: list[Part],
        fetch_bytes: Callable[[str], bytes],
    ) -> None:
        super().__init__()
        self._base_url = base_url.rstrip("/")
        self._archive_size = archive_size
        self._parts = sorted(parts, key=lambda part: part.offset)
        self._offsets = [part.offset for part in self._parts]
        self._fetch_bytes = fetch_bytes
        self._cache: dict[int, bytes] = {}
        self._position = 0
        self._validate_definition()

    @property
    def fetched_parts(self) -> tuple[int, ...]:
        return tuple(sorted(self._cache))

    @property
    def bytes_downloaded(self) -> int:
        return sum(len(value) for value in self._cache.values())

    def _validate_definition(self) -> None:
        if self._archive_size <= 0:
            raise ValueError("archive size must be positive")
        expected_offset = 0
        indexes: set[int] = set()
        for part in self._parts:
            if part.index in indexes:
                raise ValueError(f"duplicate part index {part.index}")
            if part.offset != expected_offset or part.size <= 0:
                raise ValueError("parts must be positive, contiguous, and ordered")
            indexes.add(part.index)
            expected_offset += part.size
        if expected_offset != self._archive_size:
            raise ValueError("part sizes do not match archive size")

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self._position

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            position = offset
        elif whence == io.SEEK_CUR:
            position = self._position + offset
        elif whence == io.SEEK_END:
            position = self._archive_size + offset
        else:
            raise ValueError(f"unsupported whence {whence}")
        if position < 0:
            raise ValueError("negative seek position")
        self._position = position
        return position

    def _part_for_position(self, position: int) -> Part:
        part_position = bisect.bisect_right(self._offsets, position) - 1
        if part_position < 0 or part_position >= len(self._parts):
            raise EOFError(f"position {position} is outside the archive")
        part = self._parts[part_position]
        if position >= part.offset + part.size:
            raise EOFError(f"position {position} falls between parts")
        return part

    def _load_part(self, part: Part) -> bytes:
        if part.index not in self._cache:
            data = self._fetch_bytes(f"{self._base_url}/parts/{part.index}")
            if len(data) != part.size:
                raise IOError(
                    f"part {part.index} length mismatch: expected {part.size}, got {len(data)}"
                )
            self._cache[part.index] = data
        return self._cache[part.index]

    def read(self, size: int = -1) -> bytes:
        if self._position >= self._archive_size:
            return b""
        if size is None or size < 0:
            remaining = self._archive_size - self._position
        else:
            remaining = min(size, self._archive_size - self._position)
        output = bytearray()
        while remaining > 0:
            part = self._part_for_position(self._position)
            data = self._load_part(part)
            inner_offset = self._position - part.offset
            take = min(remaining, part.size - inner_offset)
            output.extend(data[inner_offset : inner_offset + take])
            self._position += take
            remaining -= take
        return bytes(output)


def _parse_definition(definition_bytes: bytes) -> tuple[int, list[Part]]:
    raw = json.loads(gzip.decompress(definition_bytes).decode("utf-8-sig"))
    if not isinstance(raw, dict) or not isinstance(raw.get("Parts"), list):
        raise ValueError("invalid CDN definition")
    archive_size = raw.get("Size")
    if not isinstance(archive_size, int) or isinstance(archive_size, bool):
        raise ValueError("invalid archive size")
    parts: list[Part] = []
    for item in raw["Parts"]:
        if not isinstance(item, dict):
            raise ValueError("invalid part definition")
        values = (item.get("Index"), item.get("Offset"), item.get("Size"))
        if any(not isinstance(value, int) or isinstance(value, bool) for value in values):
            raise ValueError("invalid part fields")
        parts.append(Part(index=values[0], offset=values[1], size=values[2]))
    return archive_size, parts


def read_manifest_from_cdn(
    base_url: str, *, fetch_bytes: Callable[[str], bytes]
) -> ManifestRead:
    definition_bytes = fetch_bytes(f"{base_url.rstrip('/')}/definition.json.gz")
    archive_size, parts = _parse_definition(definition_bytes)
    stream = ChunkedCdnStream(
        base_url=base_url,
        archive_size=archive_size,
        parts=parts,
        fetch_bytes=fetch_bytes,
    )
    with zipfile.ZipFile(stream) as archive:
        manifest_name = next(
            (
                name
                for name in archive.namelist()
                if name.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1].casefold()
                == "modlist"
            ),
            None,
        )
        if manifest_name is None:
            raise ValueError("archive does not contain a modlist member")
        manifest = json.loads(archive.read(manifest_name).decode("utf-8-sig"))
    if not isinstance(manifest, dict):
        raise ValueError("modlist member must contain a JSON object")
    return ManifestRead(
        manifest=manifest,
        fetched_parts=stream.fetched_parts,
        bytes_downloaded=stream.bytes_downloaded,
        archive_size=archive_size,
    )
