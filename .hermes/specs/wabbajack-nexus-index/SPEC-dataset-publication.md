# Spec: Dataset Publication

Module id: `dataset-publication`

## Objective

Preserve auditable list snapshots and publish a compact, deterministic, last-known-good dataset that the extension can query without Nexus credentials.

## Requirements and Acceptance Criteria

### REQ-DATA-001: Preserve provenance and history

- AC-DATA-001: Given an indexed list version, then the database stores stable list ID, snapshot version/hash, source URLs, fetch time, parser version, list flags, and membership evidence.
- AC-DATA-002: Given a list removed from a later catalog, then history remains and the current run records an absence/tombstone rather than deleting prior evidence.
- AC-DATA-003: Given a changed NSFW/official/maintenance flag, then the new snapshot is published and prior values remain auditable.

### REQ-DATA-002: Compute product semantics

- AC-DATA-004: Given a list with many Nexus file IDs from one mod page, then `nexus_mod_count` equals distinct `(game_domain, mod_id)` values.
- AC-DATA-005: Given Wabbajack `nsfw=true`, then the published list label is `NSFW`; given false, it is `SFW`; unknown is preserved rather than guessed.
- AC-DATA-006: Given repository name and machine URL, then a stable list ID, the official Wabbajack `/modlist/$repo/$id` resolver URL, the gallery URL, and the author README URL are published separately.

### REQ-DATA-003: Emit deterministic lookup artifacts

- AC-DATA-007: Given identical database state and schema version, two builds emit byte-identical JSON artifacts except for a separately supplied build timestamp.
- AC-DATA-008: Given a Nexus mod key, then exactly one bounded bucket identifies all current matching list IDs without scanning every list.
- AC-DATA-009: Given every referenced list ID, then `modlists.json` contains its title, count, NSFW label, official status, links, version, and freshness.
- AC-DATA-010: Given a completed run, then `coverage.json` enumerates every in-scope record and `index-meta.json` reports reconciled totals and source-set identity.

### REQ-DATA-004: Protect last-known-good publication

- AC-DATA-011: Given an incomplete or schema-invalid run, when publication is attempted, then the public output remains unchanged and the failed candidate is retained separately for diagnosis.
- AC-DATA-012: Given a valid complete run, when published locally, then files are atomically replaced and hashes in `index-meta.json` match their bytes.
- AC-DATA-013: Given a stale list whose current manifest failed but a prior verified snapshot exists, then it is explicitly marked stale and publication policy determines retention without representing it as freshly verified.

### REQ-DATA-005: Support continual updates

- AC-DATA-014: Given scheduled automation, then metadata checks run every four hours by default, unchanged manifests are reused, and failures are reported without destructive replacement.
- AC-DATA-015: Given no configured remote host, then automation builds and validates locally but performs no push, release, or publication side effect.

## Non-Goals

- Public hosting selection, GitHub repository publication, or browser-store updates without approval.
- Rehosting Nexus descriptions, images, files, download metrics, or user data.
- A network API server in v1; static versioned artifacts are sufficient.

## Tech Stack

Python 3.11 `sqlite3` working database and deterministic JSON artifacts. Optional future GitHub Pages/Releases hosting is a deployment concern, not part of the local core.

## Commands

- Full Python test: `python -m unittest discover -s tests/python -v`
- Artifact build: `python -m pipeline publish --database data/work/index.sqlite --output data/generated`
- Schema verification: `python -m pipeline verify --output data/generated`

## Testing Strategy

Use temporary SQLite databases and directories. Assert exact JSON structures, byte determinism, reconciliation arithmetic, stale/tombstone behavior, and atomic failure semantics.

## Boundaries

- Always: deterministic order, explicit schema version, atomic writes, provenance, no silent stale fallback.
- Ask first: selecting a public host, enabling remote writes, adding telemetry, changing retention policy.
- Never: publish partial data as complete, include API keys, include raw mod or installer patch content.

## Traceability

| Acceptance criterion | Planned evidence | Task |
|---|---|---|
| AC-DATA-001–003 | persistence/history tests | DATA-T1 |
| AC-DATA-004–006 | semantic projection tests | DATA-T2 |
| AC-DATA-007–010 | deterministic artifact tests | DATA-T3 |
| AC-DATA-011–013 | atomic/stale publication tests | DATA-T4 |
| AC-DATA-014–015 | local automation tests | DATA-T5 |

## Success Criteria

A complete ingestion run produces validated, deterministic artifacts whose lookup results, counts, classifications, provenance, and coverage totals exactly match the working database.
