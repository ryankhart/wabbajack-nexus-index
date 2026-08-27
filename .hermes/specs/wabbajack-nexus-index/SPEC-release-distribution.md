# Spec: GitHub Release Distribution

Module id: `release-distribution`

## Objective

Publish the first versioned Chrome and Firefox extension packages as a verifiable GitHub Release before either browser-store listing exists. The release serves technical users and testers without implying one-click store installation.

## Requirements and Acceptance Criteria

### REQ-REL-001: Give both packages durable release identity

- AC-REL-001: Given project version `0.1.0`, both generated manifests contain `0.1.0` and the archives are named `wabbajack-nexus-index-chrome-v0.1.0.zip` and `wabbajack-nexus-index-firefox-v0.1.0.xpi`.
- AC-REL-002: The Firefox manifest uses the permanent add-on ID `wabbajack-nexus-index@ryankhart.com`, never a development-only `@local` identity.
- AC-REL-003: Each archive contains exactly the files and bytes in its corresponding generated browser directory and remains reproducible.

### REQ-REL-002: Publish a verifiable GitHub release

- AC-REL-004: Git tag and release name `v0.1.0` point to the verified release-preparation commit on `main`.
- AC-REL-005: The release includes both versioned browser archives and `SHA256SUMS.txt`, whose recorded hashes match the uploaded assets.
- AC-REL-006: Release notes explain Chrome's unpacked Developer Mode installation and Firefox's temporary unsigned-XPI limitation, while stating that browser-store releases remain future work.
- AC-REL-007: Publishing the GitHub release does not submit, list, sign, or publish either package through the Chrome Web Store or AMO.

## Non-Goals

- Chrome Web Store submission or listing.
- AMO submission, signing, or listing.
- Automatic updates from GitHub-hosted packages.
- Publishing the SQLite research database.

## Tech Stack

Node 22 build tests, Python 3.11 deterministic ZIP/XPI packaging, Git, GitHub CLI, and SHA-256 checksums.

## Commands

- Focused tests: `node --test tests/js/build.test.mjs` and `python -m unittest tests.python.test_package_extensions -v`
- Full verification: `npm run verify`
- Release inspection: Python `zipfile`, `sha256sum`, and `gh release view v0.1.0 --json ...`

## Testing Strategy

Use strict RED → GREEN for the permanent Firefox ID and versioned package names. Run the full canonical verification, inspect each archive against its generated directory byte-for-byte, verify the checksums locally, then verify tag, assets, hashes, and release metadata from GitHub after publication.

## Boundaries

- Always: keep Chrome/Firefox behavior and packaged data in parity; publish only exact verified archives; state installation limitations plainly.
- Ask first: later browser-store submission, Mozilla signing, Chrome signing, or additional release assets.
- Never: include credentials, API keys, acquisition caches, SQLite data, or unverified packages.

## Traceability

| Acceptance criterion | Planned evidence | Task |
|---|---|---|
| AC-REL-001–003 | Build/package tests plus archive byte-parity inspection | REL-T1 |
| AC-REL-004–007 | Git/GitHub API metadata, downloaded asset checksums, and release-note inspection | REL-T2 |

## Success Criteria

GitHub shows a public `v0.1.0` release on the verified `main` commit with both exact browser packages and matching SHA-256 checksums. The repository remains clean, and neither browser store has received a submission.

## Resolved Decisions

The first release uses the existing project version `0.1.0` and the permanent Firefox ID `wabbajack-nexus-index@ryankhart.com`. GitHub publication is a separate milestone from later browser-store distribution.
