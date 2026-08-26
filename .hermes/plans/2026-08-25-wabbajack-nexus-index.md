# Wabbajack Nexus Index Implementation Plan

## Scope

Implement the three modules in capability-map order using strict vertical TDD and coherent local commits. Publication remains local-only until a remote host and license are approved.

## Phase 1 — Grounded bootstrap

- [ ] BOOT-T1: Initialize `main`, stage explicit scaffold/spec paths, validate citations/links/privacy, and commit `docs: bootstrap wabbajack nexus index`.

Checkpoint: clean Git tree, no remote, no license file.

## Phase 2 — `registry-ingestion`

- [ ] ING-T1 (AC-ING-001–004): RED catalog array/object/duplicate/scope tests → implement fetch/normalization → full Python suite → commit.
- [ ] ING-T2 (AC-ING-005–008): RED chunk boundary/member/error tests → implement CDN definition reader and seekable ZIP stream → bounded live Keizaal contract → commit.
- [ ] ING-T3 (AC-ING-009–012): RED exact Nexus state/invalid-ID/dedup tests → implement normalizer and memberships → commit.
- [ ] ING-T4 (AC-ING-013–015): RED run reconciliation/cache tests → implement statuses and snapshot reuse → commit.

Risks: ZIP64, manifest members spanning many chunks, schema drift, non-CDN downloads, and bandwidth. Mitigations: injected fetchers, strict size/timeout limits, explicit unsupported states, content-key cache, and run budget reporting.

Checkpoint: every current registry Skyrim-family record can be assigned a terminal status.

## Phase 3 — `dataset-publication`

- [ ] DATA-T1 (AC-DATA-001–003): RED immutable history/tombstone tests → implement SQLite schema/repository → commit.
- [ ] DATA-T2 (AC-DATA-004–006): RED unique-count/classification/link projection tests → implement semantic projection → commit.
- [ ] DATA-T3 (AC-DATA-007–010): RED deterministic bucket/coverage tests → emit schema-versioned artifacts → commit.
- [ ] DATA-T4 (AC-DATA-011–013): RED failed-candidate/stale/atomic tests → implement last-known-good publisher → commit.
- [ ] DATA-T5 (AC-DATA-014–015): RED unchanged/failure/no-remote tests → add local scheduled workflow definition and validation → commit.

Checkpoint: generated artifacts reconcile to SQLite and reproduce byte-for-byte with a fixed timestamp.

## Phase 4 — Full current Skyrim database

- [ ] DB-T1: Fetch the current registry and save run frontier identity.
- [ ] DB-T2: Index every current Skyrim-family list with bounded concurrency and resumable cache.
- [ ] DB-T3: Programmatically verify discovered count equals the complete terminal-state count; investigate every failure.
- [ ] DB-T4: Build generated lookup artifacts and coverage report; report exact indexed/failed/stale totals and bytes transferred.

Checkpoint: a complete-for-frontier or honestly partial snapshot exists, with no silent omissions.

## Phase 5 — `extension-surface`

- [ ] EXT-T1 (AC-EXT-001–003): RED URL identity matrix → implement parser → commit.
- [ ] EXT-T2 (AC-EXT-004–007): RED idempotent anchor/SPA tests → implement in-flow accordion mounting → commit.
- [ ] EXT-T3 (AC-EXT-008–012): RED all-row/count/classification/link tests → implement card list → commit.
- [ ] EXT-T4 (AC-EXT-013–016): RED loading/empty/partial/error tests → implement resilient shell/retry → commit.
- [ ] EXT-T5 (AC-EXT-017–019): RED manifest/build validation → build Chrome and Firefox packages → commit.
- [ ] EXT-T6 (AC-EXT-020–023): keyboard/accessibility tests plus live representative viewport screenshots and geometry assertions → fix via RED/GREEN → commit.
- [ ] EXT-T7 (AC-EXT-024–028): RED manifest/popup identity and packaged-icon tests → replace borrowed branding with exact unofficial copy and an original small-size magic-index mark → verify 16/32/48/128-pixel rasters plus popup/panel screenshots → commit.

Checkpoint: unpacked Chrome and Firefox builds work on fixture and live Nexus pages.

## Phase 6 — Final delivery gate

1. Run Python tests, Node tests, schema verifier, browser package build, and browser checks from the final worktree.
2. Stage explicit paths and run `git diff --cached --check`, privacy/secret scans, and exact staged hash.
3. Dispatch independent read-only review against the final staged candidate.
4. Reconcile findings through focused RED → GREEN tests, restage, retest, and rereview if changed.
5. Commit verified slices; do not push or publish.
6. Report path, coverage totals, package paths, test/build evidence, commit IDs, no-remote/no-license state, and remaining deployment decision.

## Parallelism

Read-only research and final review may run in parallel. One worktree has one writer; implementation tasks are sequential unless separate worktrees are deliberately created.
