from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .http import CachedHttpClient
from .runner import run_update

DEFAULT_REGISTRY_URL = (
    "https://raw.githubusercontent.com/wabbajack-tools/mod-lists/master/repositories.json"
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m pipeline",
        description=(
            "Build the Nexus membership index for all registered Wabbajack modlists."
        ),
    )
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="discover, index, store, and publish")
    build.add_argument("--registry-url", default=DEFAULT_REGISTRY_URL)
    build.add_argument("--cache", type=Path, default=Path("data/cache/http"))
    build.add_argument(
        "--database", type=Path, default=Path("data/generated/database.sqlite")
    )
    build.add_argument("--output", type=Path, default=Path("data/generated/public"))
    build.add_argument("--workers", type=int, default=6)
    build.add_argument("--cache-max-age", type=float, default=4 * 60 * 60)
    build.add_argument("--generated-at")
    return parser


def main(argv=None, *, client=None, read_manifest=None) -> int:
    arguments = _parser().parse_args(argv)
    if arguments.command != "build":
        raise AssertionError("unreachable command")
    if arguments.workers < 1:
        raise SystemExit("--workers must be at least 1")
    http_client = client or CachedHttpClient(
        arguments.cache, max_age_seconds=arguments.cache_max_age
    )

    def progress(item, position: int, total: int) -> None:
        print(
            f"[{position}/{total}] {item.status} {item.record.title}",
            file=sys.stderr,
            flush=True,
        )

    result = run_update(
        registry_url=arguments.registry_url,
        client=http_client,
        database_path=arguments.database,
        output_path=arguments.output,
        generated_at=arguments.generated_at,
        read_manifest=read_manifest,
        max_workers=arguments.workers,
        progress=progress,
    )
    summary = {
        "generatedAt": result.generated_at,
        "repositories": result.discovery.repository_count,
        "repositoryFetchErrors": sum(
            source.status == "fetch_error" for source in result.discovery.sources.values()
        ),
        "discovered": result.run.discovered,
        "statusCounts": result.run.counts,
        "networkBytes": result.network_bytes,
        "cacheHits": result.cache_hits,
        "database": str(arguments.database),
        "output": str(arguments.output),
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0
