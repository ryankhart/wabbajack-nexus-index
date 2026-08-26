# Spec: All Wabbajack-Supported Games

Modules: `registry-ingestion`, `dataset-publication`, `extension-surface`

## Objective

Expand the index from the Skyrim family to every current public Wabbajack catalog record while preserving exact Nexus identity, explicit terminal coverage, and the existing permission-free Chrome/Firefox runtime.

## Requirements and Acceptance Criteria

### REQ-GAMES-001: Index the complete registered catalog

- AC-GAMES-001: Given a completely fetched Wabbajack repository frontier, when an update runs, then every normalized catalog record enters the index run regardless of its catalog game and reaches exactly one terminal status.
- AC-GAMES-002: Given a retired `force_down` record or an installer the selective reader cannot acquire, when indexed, then it remains represented as `excluded` or `unsupported` with a reason rather than being omitted.
- AC-GAMES-003: Given a future catalog game unknown to this release, when discovery succeeds, then the list still enters the run; unknown Nexus downloader game identities fail closed with diagnostics and are never converted by guessed slugging.

### REQ-GAMES-002: Normalize every authoritative Wabbajack Nexus game

- AC-GAMES-004: Given each game in Wabbajack's current `GameRegistry`, when its Nexus downloader state is normalized, then the checked-in mapping uses that game's exact `NexusName`, including nontrivial domains and shared VR domains.
- AC-GAMES-005: Given a Wabbajack game with no `NexusName`, then the normalizer does not invent a Nexus domain.
- AC-GAMES-006: Given a canonical Nexus domain already serialized as the downloader game value, then it resolves to itself case-insensitively.
- AC-GAMES-007: Given an unknown or near-match game value, then it is rejected with bounded diagnostics.

### REQ-GAMES-003: Publish and consume all game shards

- AC-GAMES-008: Given indexed memberships from multiple Nexus games, publication emits deterministic `games/<domain>/<bucket>.json` shards and lists all emitted domains in `index-meta.json`.
- AC-GAMES-009: Given a canonical Nexus mod URL for any published game domain, the extension parses the exact domain and mod ID, checks that domain's bucket manifest, and renders current matching lists without a game-specific permission or code allowlist.
- AC-GAMES-010: Chrome and Firefox packages bundle every generated game shard through the existing `data/games/*/*.json` resource contract.

## Non-Goals

- Inferring Nexus domains from Wabbajack enum names, titles, or catalog game labels.
- Adding Nexus API credentials or scraping page titles.
- Claiming coverage for private or unregistered Wabbajack lists.
- Publishing, pushing, or submitting browser-store packages.

## Tech Stack

Python 3.11 standard library, SQLite, deterministic JSON artifacts, modern dependency-light JavaScript, Manifest V3, and Node 22 built-in tests.

## Commands

- Focused Python tests: `python -m unittest tests.python.test_manifest tests.python.test_indexer tests.python.test_runner -v`
- Focused Node tests: `node --test tests/js/core.test.mjs tests/js/build.test.mjs`
- Full verification: `npm run verify`
- Complete local index: `python -m pipeline build --workers 6`

## Project Structure

- `pipeline/` — catalog ingestion, authoritative game mapping, manifest normalization, storage, and publication.
- `extension/` — generic Nexus URL parser and bundled-data consumer.
- `tests/python/` and `tests/js/` — behavior and package-boundary tests.
- `data/generated/` — ignored local database and bundled public artifact source.

## Testing Strategy

Use strict vertical RED → GREEN cycles. First prove a non-Skyrim catalog record is omitted, then remove the scope filter. Next prove representative nontrivial Wabbajack game mappings are rejected, then add the complete authoritative mapping. Finally prove multi-domain publication and package copying with deterministic temporary fixtures before running the complete suites and a live local index update.

## Boundaries

- Always: exact `(game_domain, mod_id)` identity, authoritative mappings, explicit run statuses, deterministic shards, last-known-good publication.
- Ask first: new authenticated sources, high-bandwidth full-installer fallback, remote publication, browser-store submission.
- Never: guess Nexus domains, title-match mods, silently omit lists, collect Nexus API keys.

## Traceability

| Acceptance criterion | Planned evidence | Implementation task |
|---|---|---|
| AC-GAMES-001–003 | runner/indexer non-Skyrim and unknown-game tests | GAMES-T1 |
| AC-GAMES-004–007 | manifest authoritative mapping matrix and rejection tests | GAMES-T2 |
| AC-GAMES-008 | multi-domain publication test | GAMES-T3 |
| AC-GAMES-009–010 | generic URL parser and multi-domain packaged-data tests | GAMES-T4 |

## Success Criteria

A complete local update assigns every current registered Wabbajack record a terminal status, publishes exact Nexus memberships for every authoritative Wabbajack Nexus game encountered, builds both browser packages with all generated game shards, and passes canonical verification.

## Resolved Decisions

Wabbajack's current `GameRegistry.cs` is authoritative for game-to-Nexus-domain mapping. The checked-in mapping records all 44 current game definitions: 42 exact Nexus domains and two explicit no-domain entries. Runtime code does not derive domains heuristically.

## Open Questions

None blocking implementation. Newly added upstream Wabbajack games require a reviewed mapping refresh before their Nexus downloader states can produce membership edges; their catalog lists still receive terminal run statuses in the meantime.
