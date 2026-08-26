# Wabbajack Nexus Index

A local-first Chrome and Firefox extension plus reproducible data pipeline that shows which indexed Wabbajack modlists include the Nexus Mods page currently being viewed.

## Status

**Local verified development build available.** The current Skyrim-family catalog is reconciled, recurring runs reuse unchanged verified manifests, and Chrome/Firefox packages build from the same generated dataset. Browser-store release and public hosting remain intentionally deferred.

## Product contract

On a supported Nexus Mods mod page, the extension inserts a Wabbajack panel containing one artwork card per matching list:

- canonical 16:9 Wabbajack gallery artwork with the linked modlist title overlaid at bottom-left;
- unique Nexus mod-page count in blue text below the artwork;
- an `Adult` label in red text only when Wabbajack classifies the list as NSFW;
- generated-index timestamp for data freshness.

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

```text
Python tests: python -m unittest discover -s tests/python -v
Node tests:   npm run test:js
Build:        npm run build
Full verify:  npm run verify
Index:        python -m pipeline build --workers 6
```

## Local Firefox testing

The ignored local development package is written to `artifacts/wabbajack-nexus-index-firefox-dev.xpi`. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select that file. Temporary add-ons are removed when Firefox exits; a normal persistent install requires Mozilla signing.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

No project license has been granted yet. See [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md).
