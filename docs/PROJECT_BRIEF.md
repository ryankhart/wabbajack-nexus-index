# Project Brief

## Objective

Build Chrome/Firefox extensions and a continually regenerated database. On Nexus mod pages, show every discoverable public Wabbajack list that contains the mod being viewed. On Wabbajack archive search pages, link recognized Nexus entries directly to their exact mod and file pages.

## Established facts

- Wabbajack's public registry is rooted in `repositories.json`; each registered repository supplies one or more `modlists.json` records.[1][3]
- Public metadata includes game, NSFW flag, official/unofficial status, version, canonical 16:9 gallery artwork, list download URL, a repository-scoped machine URL, README URL, and archive counts.[2][3]
- Wabbajack compilation preserves Nexus `gameName`, `modID`, and `fileID`, which makes exact identifier matching possible without title matching.[4]
- Wabbajack CDN files are chunk-addressable through `definition.json.gz` and `/parts/{index}`, allowing selective reads of ZIP members instead of whole-installer downloads.[5]
- The Nexus API acceptable-use policy disallows mass fetching intended to rehost Nexus information and requires public applications using the API to register; the extension therefore does not depend on Nexus API metadata.[7]
- Chrome and Firefox both support Manifest V3/WebExtensions content scripts, subject to browser-specific packaging and policy checks.[9][10]

## Current live-source snapshot

A live registry fetch on 2026-08-25 found:

- 139 registered metadata repositories, all fetched successfully;
- 221 current records across all games;
- 125 of those records were in the original Skyrim-family scope (`skyrim`, `skyrimspecialedition`, `skyrimvr`);
- 103 Skyrim-family records were not marked `force_down`;
- 36 records marked official and 23 marked NSFW;
- 144.16 GiB of declared `.wabbajack` installer bytes.

These figures are evidence from one run, not constants. The pipeline must regenerate them.

## Coverage definition

“Complete” means **complete for an enumerated source set at a named snapshot**, never all Wabbajack files that may exist privately.

A build is `complete_for_registry` only when:

1. every repository currently listed in the official registry was fetched or has a recorded terminal error;
2. every current registered record was classified as indexed, unavailable, malformed, unsupported, or excluded with a reason;
3. every successfully opened manifest had every Nexus downloader state normalized and deduplicated by `(game_domain, mod_id)`;
4. totals reconcile: discovered = indexed + terminal-status records;
5. the output records source URLs, catalog hashes/versions, fetch time, and failure details.

Private lists, paywalled lists, Discord attachments without stable public URLs, and lists not registered in a configured discovery source are outside the measurable universe until a source adapter is added.

## User-visible requirements

- Detect supported Nexus mod pages from URL, not page title.
- Insert one idempotent, accessible panel near the mod header/content area.
- Show each matching list as a four-column artwork card using its canonical Wabbajack gallery image, with the linked title overlaid at the artwork's bottom-left.
- Show each list's unique Nexus mod-page count in blue in a footer below the artwork.
- Show `Adult` in red only for lists Wabbajack classifies as NSFW; show no classification label for non-NSFW lists and never infer it from individual mods.
- Link to the official Wabbajack gallery and, when present, the list's author-maintained README.
- Show a useful empty state and dataset freshness/coverage status.
- Never block or break the Nexus page when data is unavailable.
- Detect canonical Wabbajack archive search pages from the URL, not page text.
- Link recognized Nexus mod names to their mod pages and archive filenames to their exact file pages.
- Leave non-Nexus, malformed, unknown, and ambiguous archive entries unchanged; never guess from titles or filenames.

## Non-goals for v1

- Downloading or installing mods.
- Rehosting Nexus descriptions, images, authors, files, or download statistics.
- Claiming discovery of private/unregistered Wabbajack lists.
- Inferring NSFW status from mod content.
- Publishing a browser-store listing without explicit approval.

## Dataset delivery decision

GitHub Pages is the live v1 host for the compact public JSON projection. Its published entry point is `https://ryankhart.github.io/wabbajack-nexus-index/latest.json`. Chrome and Firefox packages retain a verified bundled snapshot, prefer validated immutable Pages snapshots through a background transport, and fall back locally on any remote failure. The scheduled workflow runs every four hours, verifies each candidate, and deploys only while the repository variable `ENABLE_PAGES_DEPLOYMENT` is `true`; that variable is currently enabled.

The full SQLite working database and acquisition cache are not browser runtime artifacts and are never uploaded to Pages. A future SQLite research download may use a GitHub Release. The source repository is public as `ryankhart/wabbajack-nexus-index` under Apache-2.0, and Pages data publishing is active. Creating a GitHub Release or publishing in browser stores remains approval-gated.

## Sources

[1] https://github.com/wabbajack-tools/mod-lists/blob/master/repositories.json
[2] https://github.com/wabbajack-tools/mod-lists/blob/master/modlists.json
[3] https://wiki.wabbajack.org/wabbajack_cdn_and_gallery_access/Adding%20a%20Custom%20Repository%20to%20Wabbajack.html
[4] https://wiki.wabbajack.org/modlist_author_documentation/Pre-Compilation.html
[5] https://raw.githubusercontent.com/wabbajack-tools/wabbajack/main/Wabbajack.Downloaders.WabbajackCDN/WabbajackCDNDownloader.cs
[7] https://help.nexusmods.com/article/114-api-acceptable-use-policy
[9] https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide
[10] https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
