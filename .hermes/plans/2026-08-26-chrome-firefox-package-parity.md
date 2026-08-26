# Chrome/Firefox Package Parity Plan

## Scope

Close the local-delivery gap between the already shared Chrome/Firefox runtime builds. Preserve one source tree and one generated dataset while producing equivalent, verifiable development artifacts for both browsers.

## Acceptance criteria

- AC-EXT-017: `npm run build` emits `dist/chrome`, `dist/firefox`, `artifacts/wabbajack-nexus-index-chrome-dev.zip`, and `artifacts/wabbajack-nexus-index-firefox-dev.xpi`.
- AC-EXT-029: Each archive has exactly the same relative files and bytes as its corresponding `dist` directory; target trees differ only in Firefox's Gecko manifest metadata.

## Task

- [x] EXT-T8 (AC-EXT-017, AC-EXT-029): RED archive parity and target-difference tests → implement deterministic dual-target packaging → document local Chrome loading → run focused tests and `npm run verify` → inspect exact archives → review and commit.

## Risks and mitigations

- Stale package contents: always replace archives atomically from newly built target directories.
- Platform-dependent ZIP output: use sorted entries, normalized paths, and fixed metadata.
- False parity from filename-only checks: compare every archived byte with the corresponding built file and compare both target manifests after removing only Gecko metadata.
- Build-tree escape: reject symbolic links and Windows reparse points at each target root and before descending into or reading any descendant entry.

## Boundaries

- Do not add browser permissions, remote code, telemetry, credentials, publication, or store submission.
- Do not push or publish artifacts without Ryan's approval.