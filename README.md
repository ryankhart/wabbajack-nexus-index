# Wabbajack Nexus Index

A local-first Chrome and Firefox extension plus reproducible data pipeline that shows which indexed Wabbajack modlists include the Nexus Mods page currently being viewed.

## Status

**In active development.** The data path has been proven against a real Wabbajack CDN installer, but the extension and full catalog build are not yet release-ready.

## Product contract

On a supported Nexus Mods mod page, the extension will insert a Wabbajack panel containing one row per matching list:

- linked modlist title;
- unique Nexus mod-page count in blue text;
- `NSFW` or `SFW` classification in red text;
- source/coverage status and last-indexed time when data is incomplete or stale.

The first supported games are Skyrim, Skyrim Special Edition, and Skyrim VR. More games are intentionally deferred.

## Repository layout

- `pipeline/` — Python 3.11 standard-library ingestion and deterministic dataset generation.
- `extension/` — dependency-light WebExtension source and browser manifests.
- `data/` — generated lookup artifacts and coverage reports (not raw copyrighted mod files).
- `tests/` — Python and Node behavior tests.
- `docs/` — architecture, research, project brief, and license choices.
- `.hermes/` — specifications, plans, and durable engineering state.

## Safety and independence

This project is independent and is not affiliated with Nexus Mods or Wabbajack. It stores identifiers and list membership provenance, not mod archives. It does not require or collect Nexus API keys for normal browsing.

## Development commands

Commands will become canonical as the first vertical slices land:

```text
Python tests: python -m unittest discover -s tests/python -v
Node tests:   npm test
Build:        npm run build
Index:        python -m pipeline build --game skyrimspecialedition
```

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

No project license has been granted yet. See [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md).
