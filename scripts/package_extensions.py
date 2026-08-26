from __future__ import annotations

import os
import stat
import zipfile
from pathlib import Path


_TARGET_ARCHIVES = {
    "chrome": "wabbajack-nexus-index-chrome-dev.zip",
    "firefox": "wabbajack-nexus-index-firefox-dev.xpi",
}
_ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
_REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)


def _is_link_or_reparse_point(path: Path) -> bool:
    info = path.lstat()
    attributes = getattr(info, "st_file_attributes", 0)
    return stat.S_ISLNK(info.st_mode) or bool(attributes & _REPARSE_POINT)


def _target_files(target_root: Path) -> list[Path]:
    try:
        linked_root = _is_link_or_reparse_point(target_root)
    except FileNotFoundError:
        raise FileNotFoundError(f"Built extension directory is missing: {target_root}")
    if linked_root:
        raise ValueError(
            f"Built extension contains a symbolic link or reparse point: {target_root.name}"
        )
    if not target_root.is_dir():
        raise FileNotFoundError(f"Built extension directory is missing: {target_root}")

    files: list[Path] = []

    def visit(directory: Path) -> None:
        for path in sorted(directory.iterdir(), key=lambda item: item.name):
            if _is_link_or_reparse_point(path):
                relative_path = path.relative_to(target_root).as_posix()
                raise ValueError(
                    f"Built extension contains a symbolic link or reparse point: {relative_path}"
                )
            if path.is_dir():
                visit(path)
            elif path.is_file():
                files.append(path)

    visit(target_root)
    if not files:
        raise ValueError(f"Built extension directory is empty: {target_root}")
    return files


def _write_archive(target_root: Path, archive_path: Path) -> None:
    temporary_path = archive_path.with_suffix(f"{archive_path.suffix}.tmp")
    temporary_path.unlink(missing_ok=True)
    try:
        with zipfile.ZipFile(
            temporary_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as archive:
            for source_path in _target_files(target_root):
                relative_path = source_path.relative_to(target_root).as_posix()
                entry = zipfile.ZipInfo(relative_path, date_time=_ZIP_TIMESTAMP)
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, source_path.read_bytes(), compresslevel=9)
        os.replace(temporary_path, archive_path)
    finally:
        temporary_path.unlink(missing_ok=True)


def package_extensions(dist_root: Path, artifacts_root: Path) -> dict[str, Path]:
    dist_root = Path(dist_root).resolve()
    artifacts_root = Path(artifacts_root).resolve()
    artifacts_root.mkdir(parents=True, exist_ok=True)

    archives = {
        target: artifacts_root / archive_name
        for target, archive_name in _TARGET_ARCHIVES.items()
    }
    for target, archive_path in archives.items():
        _write_archive(dist_root / target, archive_path)
    return archives


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    archives = package_extensions(project_root / "dist", project_root / "artifacts")
    for target, archive_path in archives.items():
        print(f"Packaged {target}: {archive_path}")


if __name__ == "__main__":
    main()
