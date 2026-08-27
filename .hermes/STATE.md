# Project State

## Purpose

This tracked file is the durable handoff for future development sessions. It records the current milestone, verified baseline, durable decisions, approval boundaries, and next executable action; it is not runtime configuration or a temporary task log.

## Mission

Maintain verified Chrome and Firefox extensions that show which Wabbajack modlists include the Nexus mod being viewed, add exact Nexus mod/file links to Wabbajack archive searches, and consume a continuously refreshed public dataset.

## Current milestone

Prepare the first public browser-extension release while keeping the hosted dataset operational and Chrome/Firefox behavior in parity.

## Verified checkpoint — 2026-08-27

- The public source repository is `ryankhart/wabbajack-nexus-index` under Apache-2.0.
- GitHub Pages serves the validated JSON dataset; its live entry point is `https://ryankhart.github.io/wabbajack-nexus-index/latest.json`. The scheduled update workflow is enabled and its latest checked runs succeeded.
- The currently hosted snapshot generated at `2026-08-27T00:42:02Z` is `4d1acdc1d0342a59f30377a8f576c3fa98ef65f3f69d91cee119c0eaf3089d3a` and reconciles all 221 discovered lists to terminal statuses: 180 indexed, 37 excluded, and 4 unsupported.
- Exact Chrome and Firefox release-candidate packages built from source commit `6e457c9` loaded that hosted snapshot, rendered Nexus and Wabbajack integrations, switched to their separately generated bundled snapshot when the host was blocked, and reported no extension errors.
- No GitHub Release exists yet; browser-store submission remains approval-gated.

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

Prepare the first versioned Chrome and Firefox release for Ryan's review without publishing or submitting it.
