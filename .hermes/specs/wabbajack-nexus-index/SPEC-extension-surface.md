# Spec: Nexus Extension Surface

Module id: `extension-surface`

## Objective

On supported Nexus Mods pages, add a native-looking, accessible panel showing every currently indexed Wabbajack list that contains the exact mod page.

## UI reference

The provided Nexus screenshot establishes the target placement and hierarchy:

- insert a new accordion row directly after the existing `Collections containing this mod` section when that section exists;
- title it `Wabbajack modlists containing this mod`;
- use the existing full-width dark accordion/card rhythm and four-column layout, with each card presenting Wabbajack's canonical 16:9 gallery artwork, a bottom-left title overlay, and an in-card metadata footer;
- do not modify, nest inside, or intercept Nexus's existing collection cards or links.

DOM selectors remain adapter details and must be discovered/verified against the live page; no selector is inferred from the screenshot alone.

## Requirements and Acceptance Criteria

### REQ-EXT-001: Detect exact Nexus page identity

- AC-EXT-001: Given a canonical Nexus mod URL for any published game domain, such as `/newvegas/mods/123`, with optional query/hash, when parsed, then the exact domain and positive integer mod ID are preserved.
- AC-EXT-002: Given listing/search routes, malformed domains or IDs, zero, negatives, non-Nexus hosts, or deceptive text elsewhere in the URL, then no lookup or panel mount occurs.
- AC-EXT-003: Given canonical URL metadata that agrees with the path, then the path identity remains stable; disagreement is surfaced diagnostically and never title-matched.

### REQ-EXT-002: Mount safely and idempotently

- AC-EXT-004: Given the Nexus description page and an existing Collections accordion, then one Wabbajack accordion is inserted immediately after it.
- AC-EXT-005: Given the preferred anchor is absent or replaced, then a documented fallback mounts near `About this mod` without breaking page layout.
- AC-EXT-006: Given repeated mutation callbacks or SPA navigation to the same mod, then only one current panel exists.
- AC-EXT-007: Given SPA navigation to another supported mod, then stale content is removed and the new identity is loaded.

### REQ-EXT-003: Show all matching Wabbajack lists

- AC-EXT-008: Given N matching list IDs, then all N are available in the expanded panel, sorted by descending unique Nexus mod-page count with title and stable ID as deterministic tie-breakers, with no silent display cap.
- AC-EXT-009: Each card shows the canonical Wabbajack gallery artwork at 16:9, overlays the linked list title at the artwork's bottom-left, and places `<count> mods` in blue in a footer below the artwork. Lists classified `NSFW` by Wabbajack additionally show `Adult` in red; non-NSFW lists show no classification label.
- AC-EXT-010: Each card's artwork/title links to the official Wabbajack `/modlist/$repo/$id` resolver. Gallery and author README URLs remain distinct published metadata for future surfaces but are not required as additional links in v1.
- AC-EXT-011: The displayed count is clearly defined by tooltip/accessible text as unique Nexus mod pages indexed from the current Wabbajack manifest.
- AC-EXT-012: Given stale or otherwise non-indexed list metadata, then the list is not presented as a current membership. Any future status surface must use literal text rather than color alone.

### REQ-EXT-004: Handle empty, loading, and failure states

- AC-EXT-013: While loading, the shell renders immediately with `aria-busy=true` and a polite status message.
- AC-EXT-014: Given no matching memberships in a complete fresh snapshot, including a range omitted from the bucket manifest because it contains no memberships, then the entire `Wabbajack modlists containing this mod` section is omitted and any temporary loading shell is removed.
- AC-EXT-015: Given partial/stale coverage, an advertised bucket that is missing or unreadable, network error, timeout, or schema mismatch, then the panel remains mounted with a concise retryable error and never claims true absence.
- AC-EXT-016: A failed lookup does not prevent Nexus controls or content from working.

### REQ-EXT-005: Work in Chrome and Firefox

- AC-EXT-017: One source tree builds valid Manifest V3 packages for current Chrome and Firefox.
- AC-EXT-018: Host permissions are limited to supported Nexus page origins and the configured static dataset origin.
- AC-EXT-019: The package contains no remotely executed code, telemetry, Nexus credential collection, or unsafe HTML insertion.

### REQ-EXT-006: Accessible native interaction

- AC-EXT-020: Accordion toggle is a real button with `aria-expanded` and keyboard activation.
- AC-EXT-021: Links are real anchors with `target="_blank"` and `rel="noopener noreferrer"`, preserving middle-click/context-menu behavior.
- AC-EXT-022: Blue/red text meets contrast targets against the panel background, and classification includes literal text/icons so color is not the only cue.
- AC-EXT-023: Injected CSS is fully namespaced and does not alter untargeted Nexus geometry.

### REQ-EXT-007: Present an independent extension identity

- AC-EXT-024: Chrome and Firefox packages, toolbar labels, and popup headings use the exact product name `Unofficial Wabbajack-Nexus Index`.
- AC-EXT-025: The manifest and popup plainly state that the extension is independent, unofficial, and not affiliated with or endorsed by Wabbajack or Nexus Mods.
- AC-EXT-026: The manifest homepage targets `https://github.com/ryankhart/wabbajack-nexus-index`; creating or pushing that remote remains outside this change.
- AC-EXT-027: The package uses an original magic-index mark at 16, 32, 48, and 128 pixels for browser and in-product identity, with no copied Wabbajack logo asset.
- AC-EXT-028: The 16-pixel mark retains a distinct portal, wand, and spark silhouette on transparent, light, and dark surroundings.

## Non-Goals

- Installing a modlist from the extension in v1.
- Replacing Nexus's collection UI.
- Using a floating overlay when an in-flow description-page anchor exists.
- Collecting browsing history or analytics.

## Tech Stack

Dependency-light modern JavaScript, Manifest V3, Node 22 built-in tests, deterministic build scripts, and browser-driven verification.

## Commands

- Focused Node test: `node --test tests/js/<file>.test.mjs`
- Full Node tests: `npm test`
- Browser packages: `npm run build`
- Full verification: `npm run verify`

## Testing Strategy

Pure tests cover URL parsing, projection, ordering, and safe DOM construction. Synthetic DOM/browser tests cover idempotence, SPA remounting, and states. Final verification loads the unpacked builds into Chrome and Firefox (or automated equivalents), uses fixture pages plus a live Nexus page, checks geometry/screenshots, and confirms no console errors.

## Boundaries

- Always: URL identity, native DOM APIs, idempotence, accessible states, full matching list availability.
- Ask first: new remote host permission, telemetry, API auth, browser-store submission.
- Never: scrape identity from titles, inject unsafe HTML, request broad browsing permissions, modify existing Nexus controls.

## Traceability

| Acceptance criterion | Planned evidence | Task |
|---|---|---|
| AC-EXT-001–003 | URL parser tests | EXT-T1 |
| AC-EXT-004–007 | mount/navigation tests | EXT-T2 |
| AC-EXT-008–012 | rendering/order tests | EXT-T3 |
| AC-EXT-013–016 | resilience-state tests | EXT-T4 |
| AC-EXT-017–019 | manifest/build validation | EXT-T5 |
| AC-EXT-020–023 | accessibility + browser geometry/screenshots | EXT-T6 |
| AC-EXT-024–028 | manifest/build tests + raster dimension checks + small-size screenshots | EXT-T7 |

## Success Criteria

Both browser packages load without errors and, on a known indexed Nexus mod page, show the exact matching list set with required blue counts, red `Adult` text only for Wabbajack-classified NSFW lists, working official links, resilient accessible states, and a clearly unofficial identity using an original legible small-size mark.

## Resolved Decisions

Wabbajack's official site defines the route `/modlist/$repo/$id` in `src/routes/modlist.$repo.$id.tsx`. It resolves the exact repository/machine pair, renders the list page when the README can be embedded, and otherwise redirects to the catalog-provided README. The extension may therefore use that official resolver for each list while preserving the gallery and raw README as distinct links.
