# Spec: GitHub-Hosted Dataset Delivery

Module id: `github-hosting`

## Objective

Deliver reconciled Wabbajack membership updates to the Chrome and Firefox extensions through a free, static GitHub Pages deployment while retaining a verified bundled snapshot for offline use and failure recovery. The browser runtime consumes JSON data only; SQLite, acquisition caches, and remote executable code remain outside the hot path.

## Requirements and Acceptance Criteria

### REQ-HOST-001: Publish immutable static snapshots

- AC-HOST-001: Given a reconciled dataset, when publication completes, then the existing root JSON projection remains available for extension packaging and an identical immutable copy exists under `snapshots/<sha256>/`, where the snapshot ID is derived from the published metadata bytes.
- AC-HOST-002: Given a published snapshot, then `latest.json` identifies its schema version, snapshot ID, and generation time, and the identified metadata generation time agrees with the pointer.
- AC-HOST-003: Given a second valid publication, then the new snapshot and the immediately previous snapshot remain available so a client holding the prior pointer cannot race into a missing directory.
- AC-HOST-004: Given an unreconciled or schema-invalid candidate, when publication fails, then the root projection, pointer, and retained immutable snapshots remain byte-for-byte unchanged.

### REQ-HOST-002: Prefer validated remote data without losing bundled fallback

- AC-HOST-005: Given a supported Nexus mod page and a valid GitHub Pages snapshot, when the content script requests a lookup, then an extension background context fetches `latest.json`, validates the pointer and metadata, fetches only the required bucket plus list metadata, and returns the current membership result.
- AC-HOST-006: Given a valid remote snapshot that confirms an absent bucket or empty membership, then the extension treats that as a confirmed empty result and does not substitute stale bundled memberships.
- AC-HOST-007: Given a timeout, HTTP failure, malformed pointer, invalid schema, inconsistent generation time, wrong game/bucket identity, or malformed lookup payload, then the background context retries the same lookup against the packaged JSON snapshot and reports bundled provenance.
- AC-HOST-008: Given both remote and bundled data failure, then the existing retryable error surface remains mounted and Nexus functionality remains unaffected.
- AC-HOST-009: Chrome and Firefox packages declare only `https://ryankhart.github.io/*` as a data host, execute no remote code, include the background transport appropriate to each browser, retain the packaged lookup metadata, modlists, and game buckets, and exclude Pages-only pointers, snapshots, and operator coverage.
- AC-HOST-010: The toolbar popup reports the generation time and whether the active readable source is `GitHub Pages` or `Bundled fallback`.

### REQ-HOST-003: Deploy only verified candidates through an explicit gate

- AC-HOST-011: Given a scheduled or manual GitHub Actions run, then the index build and canonical verification complete before a Pages artifact can be uploaded.
- AC-HOST-012: Given `ENABLE_PAGES_DEPLOYMENT` is not exactly `true`, then no Pages upload or deployment job runs.
- AC-HOST-013: Given the gate is enabled and the verified build succeeds, then only `data/generated/public` is uploaded as the Pages artifact and a separate least-privilege job deploys it to the `github-pages` environment.
- AC-HOST-014: Given the build or verification fails, then no Pages deployment occurs and the previously deployed site remains active.
- AC-HOST-015: Given a scheduled run, then the large database/package diagnostic archive is not uploaded; manual runs may retain it for seven days.

## Non-Goals

- Creating a GitHub remote, enabling Pages, setting repository variables, pushing, or publishing from this implementation branch.
- Serving SQLite directly to the extension or committing generated databases and acquisition caches.
- Removing the packaged last-known-good dataset.
- Executing JavaScript, WebAssembly, HTML, or CSS obtained from the dataset host.
- Browser-store submission or signing.

## Tech Stack

Python 3.11 standard-library publication, deterministic JSON, modern dependency-light JavaScript, Manifest V3, Chrome service workers, Firefox background scripts, Node 22 built-in tests, and official GitHub Pages Actions.

## Commands

- Focused publication tests: `python -m unittest tests.python.test_publish -v`
- Focused extension tests: `node --test tests/js/background.test.mjs tests/js/content-entry.test.mjs tests/js/popup.test.mjs tests/js/build.test.mjs`
- Workflow contract: `node --test tests/js/workflow.test.mjs`
- Full verification: `npm run verify`

## Project Structure

- `pipeline/publish.py` — root projection, immutable snapshot copies, latest pointer, retention, and atomic replacement.
- `extension/src/background.js` — remote validation, bounded lookup, and bundled fallback.
- `extension/src/content-entry.js` — page/UI consumer of background lookup results.
- `extension/src/popup.js` — active-source freshness display.
- `scripts/build-extension.mjs` — browser-specific background manifests and package assembly.
- `.github/workflows/update-index.yml` — verified, explicitly gated Pages deployment.
- `tests/python/` and `tests/js/` — publication, transport, package, popup, and workflow contracts.

## Testing Strategy

Use strict vertical RED → GREEN cycles. First require immutable snapshots and retention in the real temporary SQLite publication test. Next exercise the background transport in a VM with real validation code and deterministic fetch fixtures, including remote success, confirmed empty, malformed remote fallback, and total failure. Then route the content script and popup through runtime messages. Finally require browser-specific manifests and the explicit Pages workflow gate before canonical verification.

## Boundaries

- Always: complete reconciliation, immutable snapshot identity, exact game/mod identity, bounded one-bucket lookup, schema validation, bundled fallback, no remote code, least-privilege deployment.
- Ask first: creating/configuring a remote, setting `ENABLE_PAGES_DEPLOYMENT`, enabling GitHub Pages, pushing, publishing Releases, or submitting browser packages.
- Never: deploy a failed candidate, expose caches/SQLite through Pages, broaden host permissions, collect credentials or telemetry, or silently convert remote failure into a true-empty claim.

## Traceability

| Acceptance criterion | Planned evidence | Implementation task |
|---|---|---|
| AC-HOST-001–004 | `tests/python/test_publish.py` immutable pointer, retention, and failed-candidate tests | HOST-T1 |
| AC-HOST-005–008 | `tests/js/background.test.mjs` plus content-entry failure/empty tests | HOST-T2 |
| AC-HOST-009 | `tests/js/build.test.mjs` package manifest and generated-background execution | HOST-T3 |
| AC-HOST-010 | `tests/js/popup.test.mjs` runtime status/source rendering | HOST-T3 |
| AC-HOST-011–015 | `tests/js/workflow.test.mjs` build dependency, gate, path, permissions, and bounded diagnostic-retention assertions | HOST-T4 |

## Success Criteria

A valid local publication emits a current root projection, a content-addressed current snapshot, the previous snapshot, and a valid pointer; both browser packages use a tested background transport to prefer validated Pages data and fall back to packaged data; the popup exposes provenance; the Pages workflow is inert unless explicitly enabled; and `npm run verify` passes without a remote write.

## Resolved Decisions

- GitHub Pages hosts only the compact JSON projection. The optional SQLite research artifact belongs in a future GitHub Release, not Pages or Git history.
- The remote base is `https://ryankhart.github.io/wabbajack-nexus-index/`.
- Remote data requests run in an extension background context for consistent Chrome/Firefox cross-origin behavior.
- Root JSON paths remain temporarily compatible with bundled packages; remote clients use immutable snapshot paths selected by `latest.json`.
- Each deployment retains the latest two immutable snapshots.
- Repository variable `ENABLE_PAGES_DEPLOYMENT=true` is the explicit publication switch.

## Open Questions

None blocking local implementation. The public repository/account identity and actual Pages enablement remain separate approval-gated deployment decisions.
