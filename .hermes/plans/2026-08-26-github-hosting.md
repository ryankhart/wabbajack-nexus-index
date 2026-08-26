# GitHub Hosting Implementation Plan

Spec: `.hermes/specs/wabbajack-nexus-index/SPEC-github-hosting.md`

## HOST-T1 — Immutable publication snapshots

- Traces to: AC-HOST-001–004
- RED: extend `tests/python/test_publish.py` to require `latest.json`, content-addressed snapshot parity, two-snapshot retention, and unchanged last-known-good state after failure.
- GREEN: derive the snapshot ID from `index-meta.json`, copy the root projection into `snapshots/<id>`, retain the prior pointer target, write `latest.json`, and preserve the existing directory-level atomic replace.
- REFACTOR: isolate pointer validation/copy retention helpers while green.
- Regression: `python -m unittest tests.python.test_publish -v`

## HOST-T2 — Remote lookup with bundled fallback

- Traces to: AC-HOST-005–008
- RED: add `tests/js/background.test.mjs` cases for valid remote membership, confirmed remote empty, malformed/inconsistent remote fallback, and dual-source failure; update content-entry tests to require runtime messaging rather than direct data fetches.
- GREEN: add `extension/src/background.js` with strict pointer/metadata/bucket validation, bounded remote paths, and bundled fallback; route content lookups through the background context.
- REFACTOR: share only pure validation helpers needed by both status and lookup paths, keep errors diagnostic but credential-free.
- Regression: `node --test tests/js/background.test.mjs tests/js/content-entry.test.mjs tests/js/core.test.mjs`

## HOST-T3 — Browser packages and popup provenance

- Traces to: AC-HOST-009–010
- RED: require the exact Pages host permission, Chrome service worker, Firefox background script, packaged background source, and popup source label in `build.test.mjs` and `popup.test.mjs`.
- GREEN: teach the build script to copy the background transport and emit browser-specific background manifests; have the popup request source status through runtime messaging.
- REFACTOR: keep Chrome callback and Firefox Promise messaging adapters explicit and small.
- Regression: `node --test tests/js/build.test.mjs tests/js/popup.test.mjs`

## HOST-T4 — Explicitly gated Pages deployment

- Traces to: AC-HOST-011–015
- RED: extend `tests/js/workflow.test.mjs` to require the repository-variable gate, verified-build dependency, Pages artifact path, least-privilege permissions, `github-pages` environment, and manual-only bounded diagnostic retention.
- GREEN: split build and deploy responsibilities in `.github/workflows/update-index.yml`, retain large diagnostic artifacts only for seven days after manual runs, and add gated official Pages actions.
- Regression: `node --test tests/js/workflow.test.mjs`

## Final verification and delivery

1. Run all focused suites after each GREEN.
2. Run `npm run verify` after the final edit.
3. Build packages against the real generated public dataset from the primary worktree in a temporary output path and execute the generated background boundary tests.
4. Stage only this request's source, workflow, spec, plan, tests, and documentation paths.
5. Run `git diff --cached --check`, added-line privacy/security scans, record the exact staged hash, and dispatch an independent read-only review of every staged path.
6. Reproduce concrete findings with focused RED tests before fixes; restage and rereview if the candidate changes.
7. Commit the verified change locally. Do not create a remote, push, enable Pages, set repository variables, or publish.
