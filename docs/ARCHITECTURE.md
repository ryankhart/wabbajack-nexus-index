# Architecture

## Overview

```text
Wabbajack registry
  -> repository metadata adapters
  -> complete current registered list inventory
  -> CDN chunk definitions
  -> seekable ZIP manifest reader
  -> NexusDownloader normalization
  -> SQLite working database
  -> deterministic JSON lookup shards + coverage report
  -> immutable GitHub Pages snapshot
  -> Chrome/Firefox background data transport
  -> Nexus Mods content script panel

Wabbajack archive status reports
  -> Wabbajack archive-link content script
```

## 1. Discovery layer

The authoritative default seed is Wabbajack's registered-repository map.[1] Each named repository URL is fetched with conditional HTTP support, parsed as one record or a list, and preserved with its repository name and source URL. The official featured file is included through that registry rather than separately double-counted.[2]

Future adapters may add opt-in community indexes, submitted direct list URLs, or historical archives. Each adapter must define its own enumerable universe and provenance.

## 2. Manifest acquisition

A `.wabbajack` file is a ZIP containing a `modlist` JSON member and inline patch/data members. The CDN downloader itself exposes a gzipped `FileDefinition` and numbered 2 MiB parts.[5] A seekable reader loads only parts touched by ZIP central-directory and `modlist` reads, verifies declared part sizes, and caches parts under a content/version identity.

Full installer downloads are a fallback only for non-Wabbajack-CDN URLs or malformed archives and must be separately budgeted. Unavailable lists receive a terminal status; they are never silently omitted.

## 3. Identity and counting

Canonical Nexus identity:

```text
(game_domain, mod_id)
```

`file_id` is retained as membership evidence/version detail but does not define the mod page. Multiple files from one Nexus mod count once toward that list's displayed mod count. The list count therefore means **unique Nexus mod pages represented in the manifest**, not Wabbajack archive count, MO2 separator count, or installed-file count.

Game identities normalize through Wabbajack's authoritative `GameRegistry` Nexus names. The checked-in mapping covers every current Wabbajack game definition, including nontrivial and shared domains such as:

- `Skyrim` -> `skyrim`
- `SkyrimSpecialEdition` -> `skyrimspecialedition`
- `SkyrimVR` -> `skyrimspecialedition`
- `FalloutNewVegas` -> `newvegas`
- `SevenDaysToDie` -> `7daystodie`
- `DragonAgeOrigins` -> `dragonage`

Games for which Wabbajack declares no Nexus name remain explicit no-domain entries. The normalizer never derives a Nexus slug from a game title or enum name.

The normalizer rejects booleans, zero/negative IDs, numeric strings with junk, and unknown game identities.

## 4. Working database

SQLite tables:

- `sources` — discovery adapter, URL, fetch time, ETag/hash, status.
- `modlists` — stable `(repository_name, machine_url)`, title, version, game, official, NSFW, maintenance, URLs, source identity.
- `manifest_snapshots` — list/version/hash, acquisition status, bytes/chunks read, manifest metadata.
- `nexus_mods` — canonical game domain + integer mod ID.
- `memberships` — list snapshot + Nexus mod + one or more file IDs/evidence states.
- `runs` / `run_items` — reconciliation totals, errors, and freshness.

History is append-oriented. A list missing from a later catalog is marked absent in that run rather than deleted. The public artifact publishes only the latest successfully reconciled state plus explicit stale/error metadata.

## 5. Public artifacts

The deterministic build emits:

- `index-meta.json` — schema version, generated time, source-set hash, totals, coverage state.
- `games/<domain>/<bucket>.json` — lookup records bucketed by mod ID to bound request size.
- `modlists.json` — compact list metadata keyed by stable list ID.
- `coverage.json` — every discovered list and its terminal indexing state.
- `latest.json` — small pointer to the current content-addressed snapshot.
- `snapshots/<sha256>/...` — immutable copies of the current and immediately previous public projection.
- `database.sqlite` — optional future GitHub Release research artifact, never required by the extension or included in Pages.

Artifacts are sorted, minified deterministically, hashed, and written atomically. The snapshot ID is the SHA-256 of `index-meta.json`, whose artifact map binds the remaining projection. A failed or partial run never replaces the last-known-good root, pointer, or immutable snapshots.

## 6. Extension runtime

The extension background context:

1. checks the GitHub Pages `latest.json` pointer with a bounded request;
2. validates pointer syntax, schema version, generation time, bucket manifest, requested game/bucket identity, and membership references;
3. fetches only immutable metadata, global modlist metadata, and the one required lookup bucket;
4. treats a valid remote empty result as authoritative;
5. retries malformed, unavailable, inconsistent, or incompatible remote data against the packaged snapshot;
6. returns data only and never loads remote executable content.

The Nexus Mods content script:

1. matches supported Nexus URL shapes;
2. parses the game domain and mod ID from `location.pathname`;
3. mounts a namespaced panel idempotently without nesting controls inside existing links;
4. requests the exact lookup from the extension background context;
5. renders with DOM APIs and `textContent` only;
6. observes SPA navigation and remounts on identity change;
7. leaves the Nexus page usable on timeout, schema mismatch, or missing data.

The Wabbajack content script:

1. matches canonical per-modlist archive-search routes;
2. loads that list's published Wabbajack status report;
3. accepts only authoritative Nexus downloader states with recognized games and positive integer mod/file IDs;
4. links displayed mod names to exact Nexus mod pages and archive filenames to exact Nexus file pages;
5. observes virtualized archive rows and enhances them idempotently as they appear;
6. leaves non-Nexus, malformed, unknown, and ambiguous results unchanged rather than guessing from text.

Links are native `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`. CSS is fully namespaced.

## 7. Continual update contract

A scheduled job runs every four hours. It:

- conditional-fetches source metadata;
- reuses unchanged manifest snapshots by download hash/version;
- indexes new or changed lists with bounded parallelism and retry/backoff;
- records failures without deleting last-known-good memberships;
- performs reconciliation and schema validation;
- uploads a Pages artifact only after `npm run verify` succeeds;
- deploys only when repository variable `ENABLE_PAGES_DEPLOYMENT` is exactly `true`;
- otherwise retains build diagnostics without any publication side effect.

The Pages build uses GitHub's official artifact/deployment actions and a separate least-privilege deployment job.[7] Failed builds cannot replace the active Pages deployment.

The official Wabbajack registry validation itself runs regularly, but this project independently records its own fetch and manifest status.[3]

## Security and privacy boundaries

- No user Nexus API key.
- No page scraping for mod identity.
- No remote executable code.
- No `innerHTML` with external data.
- No browsing-history collection or telemetry in v1.
- Site access limited to supported Nexus mod pages, Wabbajack archive-search pages, and the configured static dataset origin.
- Remote data origin limited to `https://ryankhart.github.io/*`.
- Pages contains the compact public JSON projection only, never SQLite or acquisition caches.
- Mod archives and installer patch blobs are not persisted in generated artifacts.

## Sources

[1] https://github.com/wabbajack-tools/mod-lists/blob/master/repositories.json
[2] https://github.com/wabbajack-tools/mod-lists/blob/master/modlists.json
[3] https://wiki.wabbajack.org/wabbajack_cdn_and_gallery_access/Adding%20a%20Custom%20Repository%20to%20Wabbajack.html
[5] https://raw.githubusercontent.com/wabbajack-tools/wabbajack/main/Wabbajack.Downloaders.WabbajackCDN/WabbajackCDNDownloader.cs
[6] https://github.com/wabbajack-tools/wabbajack/blob/af938fb980bb4bcd1f6c87542fae6cd34b5020ee/Wabbajack.DTOs/Game/GameRegistry.cs
[7] https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
