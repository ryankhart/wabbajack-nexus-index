# Developer documentation

This document contains the maintainer details for the Unofficial Wabbajack-Nexus Index. The main [README](../README.md) stays focused on what the browser extension does.

## Repository layout

- `pipeline/`: Python 3.11 ingestion and dataset generation.
- `extension/`: shared WebExtension source for Chrome and Firefox.
- `data/`: generated lookup data and coverage reports. It does not contain mod files.
- `tests/`: Python and Node behavior tests.
- `docs/`: architecture, research, project brief, and license information.
- `.hermes/`: specifications, plans, and durable engineering state.

## Development commands

```text
Python tests: python -m unittest discover -s tests/python -v
Node tests:   npm run test:js
Build:        npm run build
Full verify:  npm run verify
Index:        python -m pipeline build --workers 6
```

## Data and privacy boundaries

The pipeline matches Nexus mods by normalized game domain and integer mod ID. It never guesses from mod titles or filenames. The public data records which Wabbajack lists contain which Nexus mod pages, along with the source identifiers needed to verify those matches.

The project does not:

- require or collect Nexus API keys;
- store or redistribute mod archives;
- collect browsing history or analytics;
- load or run remote extension code.

Chrome and Firefox packages use the same source and generated data. Every feature and bug fix must keep both versions in behavior parity.

## Dataset hosting

The extension includes a verified data snapshot and prefers a newer validated snapshot from `https://ryankhart.github.io/wabbajack-nexus-index/` when one is available. The background context fetches remote JSON, validates it, and falls back to the included snapshot if the remote data is unavailable, malformed, incompatible, or inconsistent. It never loads remote executable code.

A valid publication contains root JSON for package compatibility, `latest.json`, and immutable `snapshots/<sha256>/` directories for the current and immediately previous public snapshots. The scheduled workflow builds and verifies every candidate. It uploads and deploys Pages only when the repository variable `ENABLE_PAGES_DEPLOYMENT` is exactly `true`.

The Pages artifact contains only `data/generated/public`. SQLite and acquisition caches remain local. The large database and package diagnostic archive is limited to manual workflow runs with seven-day retention. A future SQLite research download belongs in a GitHub Release rather than Pages or Git history.

## Further documentation

- [Project brief](PROJECT_BRIEF.md)
- [Architecture](ARCHITECTURE.md)
- [License choices](LICENSE_OPTIONS.md)
