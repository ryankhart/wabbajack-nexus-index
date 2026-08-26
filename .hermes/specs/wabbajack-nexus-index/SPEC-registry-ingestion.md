# Spec: Registry Ingestion

Module id: `registry-ingestion`

## Objective

Build an exact, replayable index of Nexus mod-page membership for every current Wabbajack record discoverable from the configured public registry frontier.

## Requirements and Acceptance Criteria

### REQ-ING-001: Enumerate the public source frontier

- AC-ING-001: Given the official `repositories.json`, when discovery runs, then every named repository URL is fetched once and recorded with success or a terminal error.
- AC-ING-002: Given repository payloads that are arrays or single objects, when parsed, then both forms produce normalized catalog records; any non-object entry or missing machine URL, version, or download hash makes that repository source a terminal error rather than silently dropping or collapsing the entry.
- AC-ING-003: Given duplicate list/version records, when normalized, then `(repository_name, machine_url, version, download_hash)` is emitted once with all source provenance retained.
- AC-ING-004: Given any catalog game value, when discovery runs, then the record remains in scope and reaches an explicit terminal index status; unknown Nexus downloader game identities are rejected without guessing a domain.

### REQ-ING-002: Read Wabbajack manifests efficiently

- AC-ING-005: Given a Wabbajack CDN URL, when acquired, then `definition.json.gz` is parsed and only ZIP-touched `/parts/{index}` chunks are fetched.
- AC-ING-006: Given a part whose response length differs from its definition, when read, then acquisition fails with a recorded integrity error.
- AC-ING-007: Given a valid archive containing a `modlist` member, when read, then the manifest JSON is returned without persisting unrelated inline patch blobs.
- AC-ING-008: Given an unavailable, non-CDN, malformed, or unsupported installer, when processed, then the list receives an explicit terminal status and is never silently omitted.

### REQ-ING-003: Normalize exact Nexus identity

- AC-ING-009: Given a Nexus downloader state, when normalized, then its canonical key is `(normalized game domain, positive integer mod ID)` and file ID is retained as evidence.
- AC-ING-010: Given multiple archive/file states for one Nexus mod page in one list, when indexed, then membership is emitted once and every valid file ID is deduplicated and retained.
- AC-ING-011: Given boolean, zero, negative, malformed numeric, or unknown-game IDs, when normalized, then they are rejected with a reason rather than coerced; mixed manifests retain valid memberships and surface bounded rejection detail, while a manifest whose exact Nexus candidates are all invalid receives a malformed terminal status.
- AC-ING-012: Given no exact Nexus downloader state, when processing a manifest, then no title/filename heuristic creates a membership edge.

### REQ-ING-004: Reconcile measurable completeness

- AC-ING-013: Given a completed run, then `discovered_in_scope = indexed + stale + unavailable + malformed + unsupported + excluded`, omitting zero-count terms from serialized summaries.
- AC-ING-014: Given any non-indexed record, then coverage output includes stable list identity, source URL, attempted download URL, terminal status, and safe error detail.
- AC-ING-015: Given an unchanged `(version, download hash)`, when a later run executes, then the prior verified manifest result is reused.

## Non-Goals

- Discovering private, paywalled, or unregistered files with no configured source adapter.
- Downloading the mod archives referenced by a Wabbajack manifest.
- Fuzzy matching Nexus titles, archive names, or authors.

## Tech Stack

- Python 3.11 standard library: `urllib`, `gzip`, `zipfile`, `sqlite3`, `json`, `unittest`.
- No Nexus API client and no credential storage.

## Commands

- Focused test: `python -m unittest tests.python.test_<slice> -v`
- Full test: `python -m unittest discover -s tests/python -v`
- Build current index: `python -m pipeline build --workers 6`

## Project Structure

- `pipeline/` — acquisition, normalization, persistence, and CLI.
- `tests/python/` — behavior tests and synthetic ZIP/CDN fixtures.
- `data/work/` — ignored caches and SQLite work state.
- `data/generated/` — ignored generated artifacts until explicitly staged as a snapshot.

## Code Style

Small typed functions, immutable dataclasses for normalized values, explicit injected fetchers/clocks, and deterministic ordering at every serialization boundary.

## Testing Strategy

Strict vertical RED → GREEN cycles. Unit tests use synthetic byte fixtures and local/in-memory fetch adapters; one bounded live contract test may verify a real Wabbajack CDN definition and is separate from the canonical offline suite.

## Boundaries

- Always: exact IDs, timeouts, bounded responses, safe errors, reconciliation, atomic writes.
- Ask first: full-installer fallback exceeding 2 GiB aggregate, new authenticated sources, new external dependencies.
- Never: store API keys, fetch Nexus mod archives, infer membership by title, silently drop failed lists.

## Traceability

| Acceptance criterion | Planned evidence | Task |
|---|---|---|
| AC-ING-001–004 | catalog discovery tests | ING-T1 |
| AC-ING-005–008 | chunked ZIP reader tests + bounded live contract | ING-T2 |
| AC-ING-009–012 | Nexus normalizer/membership tests | ING-T3 |
| AC-ING-013–015 | reconciliation/cache tests | ING-T4 |

## Success Criteria

The pipeline processes every currently registered record to one terminal state, extracts exact Nexus membership for every successfully read manifest, and emits reconciliation totals that balance.

## Open Questions

- Some catalog download links may not use the Wabbajack CDN; actual fallback volume and formats will be measured before authorizing broad full downloads.
