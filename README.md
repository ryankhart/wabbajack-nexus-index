# Unofficial Wabbajack-Nexus Index

See which Wabbajack modlists include a Nexus mod, right on its Nexus Mods page. The extension also adds direct Nexus Mods links to Wabbajack archive lists. Unofficial extensions for Chrome and Firefox.

## Status

**Public source release under Apache-2.0.** The complete current registered catalog is reconciled, recurring runs reuse unchanged verified manifests, and Chrome/Firefox packages build from the same generated dataset. GitHub Pages delivery is implemented but remains explicitly disabled until Pages deployment is separately approved and configured. Browser-store release remains deferred.

## Product contract

On a supported Nexus Mods mod page, the extension inserts a Wabbajack panel containing one artwork card per matching list:

- canonical 16:9 Wabbajack gallery artwork with the linked modlist title overlaid at bottom-left;
- unique Nexus mod-page count in blue text below the artwork;
- an `Adult` label in red text only when Wabbajack classifies the list as NSFW;
- generated-index timestamp and active data source for freshness/provenance.

On a Wabbajack archive search page, the extension turns exact Nexus archive entries into direct links. The displayed mod name opens the Nexus mod page, and the archive filename opens the matching Nexus file page. Non-Nexus and ambiguous entries remain unchanged.

The pipeline indexes every registered Wabbajack list and the extension supports every authoritative Nexus game domain published from those manifests.

## Repository layout

- `pipeline/` — Python 3.11 standard-library ingestion and deterministic dataset generation.
- `extension/` — dependency-light WebExtension source and browser manifests.
- `data/` — generated lookup artifacts and coverage reports (not raw copyrighted mod files).
- `tests/` — Python and Node behavior tests.
- `docs/` — architecture, research, project brief, and license choices.
- `.hermes/` — specifications, plans, and durable engineering state.

## Safety and independence

This project is independent and is not affiliated with Nexus Mods or Wabbajack. It stores identifiers and records of which lists contain which mods, not mod archives. It does not require or collect Nexus API keys for normal browsing.

## Development commands

```text
Python tests: python -m unittest discover -s tests/python -v
Node tests:   npm run test:js
Build:        npm run build
Full verify:  npm run verify
Index:        python -m pipeline build --workers 6
```

## Dataset hosting

The extension packages a verified snapshot and prefers a newer validated snapshot from `https://ryankhart.github.io/wabbajack-nexus-index/` when available. Remote JSON is fetched by the extension background context; malformed, incompatible, unavailable, or inconsistent remote data falls back to the packaged snapshot. No remote code is loaded or executed.

Valid publications contain root JSON for package compatibility, `latest.json`, and immutable `snapshots/<sha256>/` trees retaining the current and immediately previous snapshots. The scheduled workflow builds and verifies every candidate, but Pages upload and deployment remain inert unless the repository variable `ENABLE_PAGES_DEPLOYMENT` is exactly `true`.

The Pages artifact contains only `data/generated/public`. SQLite and acquisition caches remain local; the large database/package diagnostic archive is limited to manual workflow runs with seven-day retention. A future SQLite research download belongs in a GitHub Release rather than Pages or Git history.

## Local browser testing

Run `npm run build` after generating the public dataset. The command writes browser directories under `dist/` and matching development archives under `artifacts/`.

### Chrome

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/chrome`. The ignored `artifacts/wabbajack-nexus-index-chrome-dev.zip` is the byte-equivalent packaged snapshot for transfer or CI retention; unpack it before loading it locally in Chrome.

### Firefox

The ignored local development package is written to `artifacts/wabbajack-nexus-index-firefox-dev.xpi`. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select that file. Temporary add-ons are removed when Firefox exits; a normal persistent install requires Mozilla signing.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

The original source code and documentation in this repository are licensed under the [Apache License 2.0](LICENSE).

That license does not grant rights to third-party names, trademarks, logos, artwork, or source metadata. Wabbajack, Nexus Mods, modlist authors, and other data sources retain their respective rights. See [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md) for the project-specific licensing boundary.
