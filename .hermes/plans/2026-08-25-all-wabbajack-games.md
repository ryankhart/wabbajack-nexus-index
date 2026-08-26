# All Wabbajack-Supported Games Implementation Plan

Spec: `.hermes/specs/wabbajack-nexus-index/SPEC-all-supported-games.md`

## GAMES-T1 — Complete catalog run

- Traces to: AC-GAMES-001–003
- RED: update runner/indexer tests so a Fallout 4 record must be read, indexed, stored, covered, and reconciled.
- GREEN: remove Skyrim-family filtering from runner and indexer while preserving `force_down` and unsupported terminal states.
- REFACTOR: remove obsolete Skyrim scope symbols and names.
- Regression: `python -m unittest tests.python.test_catalog tests.python.test_indexer tests.python.test_runner -v`

## GAMES-T2 — Authoritative Nexus game mapping

- Traces to: AC-GAMES-004–007
- RED: add representative nontrivial Wabbajack mappings, explicit no-domain games, canonical-domain aliases, and near-match rejection tests.
- GREEN: add the complete current Wabbajack `GameRegistry` mapping and build exact case-insensitive aliases only from enum names, Nexus domains, and retained legacy Skyrim spellings.
- REFACTOR: expose one immutable mapping source and keep extraction logic unchanged.
- Regression: `python -m unittest tests.python.test_manifest tests.python.test_indexer tests.python.test_runner -v`

## GAMES-T3 — Multi-domain publication

- Traces to: AC-GAMES-008
- RED: publish two lists with memberships in different Nexus domains and assert both deterministic shard paths and metadata entries.
- GREEN: change publication only if the existing generic shard builder fails.
- Regression: `python -m unittest tests.python.test_publish -v`

## GAMES-T4 — Generic packaged extension

- Traces to: AC-GAMES-009–010
- RED: add URL and build fixtures for non-Skyrim and numeric-leading Nexus domains; require all game shard trees in both packages.
- GREEN: change parser/build contracts only if the existing wildcard implementation fails.
- Regression: `node --test tests/js/core.test.mjs tests/js/build.test.mjs`

## Final verification and delivery

1. Run `npm run verify` after the final edit.
2. Run `python -m pipeline build --workers 6` to materialize the complete current local index.
3. Programmatically verify catalog totals reconcile, artifact hashes match, multiple non-Skyrim game domains exist, and both browser builds contain the same shard set.
4. Stage only this request's source, spec, plan, test, and documentation hunks; preserve unrelated pre-existing worktree changes.
5. Run staged-diff checks and independent read-only review against the exact candidate.
6. Commit the verified change locally; do not push or publish.
