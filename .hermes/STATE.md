# Project State

## Purpose

This tracked file is the durable handoff for future development sessions. It records the current milestone, verified baseline, durable decisions, approval boundaries, and next executable action; it is not runtime configuration or a temporary task log.

## Mission

Maintain verified Chrome and Firefox extensions that show which Wabbajack modlists include the Nexus mod being viewed, add exact Nexus mod/file links to Wabbajack archive searches, and consume a continuously refreshed public dataset.

## Current milestone

Prepare the first Chrome Web Store and Firefox Add-ons submission candidates while keeping the live GitHub release, hosted dataset, and browser behavior in parity.

## Verified checkpoint — 2026-08-27

- The public source repository is `ryankhart/wabbajack-nexus-index` under Apache-2.0.
- GitHub Pages serves the validated JSON dataset; its live entry point is `https://ryankhart.github.io/wabbajack-nexus-index/latest.json`. The scheduled update workflow is enabled and its latest checked runs succeeded.
- The currently hosted snapshot generated at `2026-08-27T00:42:02Z` is `4d1acdc1d0342a59f30377a8f576c3fa98ef65f3f69d91cee119c0eaf3089d3a` and reconciles all 221 discovered lists to terminal statuses: 180 indexed, 37 excluded, and 4 unsupported.
- Exact Chrome and Firefox release-candidate packages built from source commit `6e457c9` loaded that hosted snapshot, rendered Nexus and Wabbajack integrations, switched to their separately generated bundled snapshot when the host was blocked, and reported no extension errors.
- GitHub Release `v0.1.0` is public at `https://github.com/ryankhart/wabbajack-nexus-index/releases/tag/v0.1.0`; its tag points to release-preparation commit `107af9c`.
- The published Chrome and Firefox archives each contain 772 files matching their generated browser directory byte-for-byte. Their SHA-256 hashes are `2bb07ae835223b796bf239fb0b397cb5d59ec73a275a7f3a7ea745e734426f0b` and `d09e9d0b716d0e28747f2b33db8ec6ae9692745fea3eacba1befb82605c77ea4`, and downloaded GitHub assets matched the verified local files.
- Browser-store submission remains approval-gated; neither package has been submitted to the Chrome Web Store or Firefox Add-ons.

## Decisions

- Python 3.11 standard library for ingestion and SQLite.
- Dependency-light JavaScript WebExtension with Node 22 built-in tests.
- Chrome and Firefox share source and data; every feature and bug fix preserves behavior parity.
- GitHub Pages hosts validated static JSON; each package retains a verified bundled snapshot and falls back locally on any remote failure.
- No Nexus API dependency, API key collection, analytics, or remote executable code.
- Stable identity is `(Nexus game domain, mod ID)`.
- Displayed list mod count is distinct Nexus mod pages in the current manifest.
- “Complete” is source-set/snapshot scoped and reconciled, not a claim about private files.

## Approval boundaries

Ask before public pushes, GitHub Releases, browser-store submissions, credentials, or high-bandwidth full-installer fallback beyond an agreed budget.

## Next executable action

Prepare Chrome Web Store and Firefox Add-ons submission candidates for Ryan's review without submitting them.
