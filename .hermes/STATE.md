# Project State

## Mission

Deliver a working, verified Chrome/Firefox extension and continuously reproducible Skyrim-family Wabbajack membership database.

## Current milestone

Grounded project bootstrap and first ingestion vertical slice.

## Verified evidence

- The live Wabbajack registered-source map yielded 139 repository entries and all 139 fetched in one snapshot.
- That snapshot yielded 125 current Skyrim-family list records with 144.16 GiB of declared installer bytes.
- The Wabbajack CDN exposes `definition.json.gz` plus numbered parts.
- A temporary seekable reader opened Keizaal's real `.wabbajack`, read the `modlist` member, and found 1,011 archives, 841 Nexus archives, and 662 unique Nexus mod identities while fetching 6,772,015 of 13,063,471 bytes.

## Decisions

- Python 3.11 standard library for ingestion and SQLite.
- Dependency-light JavaScript WebExtension with Node 22 built-in tests.
- No Nexus API dependency for page identity or routine extension use.
- Stable identity is `(Nexus game domain, mod ID)`.
- Displayed list mod count is distinct Nexus mod pages in the current manifest.
- “Complete” is source-set/snapshot scoped and reconciled, not a claim about private files.
- Local and unpublished until explicit approval.

## Approval boundaries

Ask before public remote creation/push, browser-store publication, license grant, credentials, or high-bandwidth full-installer fallback beyond an agreed budget.

## Next executable action

Finish the capability map/spec/plan, initialize Git, and commit the grounded scaffold.
