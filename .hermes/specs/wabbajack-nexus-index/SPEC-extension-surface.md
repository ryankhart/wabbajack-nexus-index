# Spec: Nexus Extension Surface

Module id: `extension-surface`

## Objective

On supported Nexus Mods pages, add a native-looking, accessible panel showing every currently indexed Wabbajack list that contains the exact mod page.

## UI reference

The provided Nexus screenshot establishes the target placement and hierarchy:

- insert a new accordion row directly after the existing `Collections containing this mod` section when that section exists;
- title it `Wabbajack modlists containing this mod`;
- use the existing full-width dark accordion/card rhythm, compact list cards, white primary text, blue count text, and red classification text;
- do not modify, nest inside, or intercept Nexus's existing collection cards or links.

DOM selectors remain adapter details and must be discovered/verified against the live page; no selector is inferred from the screenshot alone.

## Requirements and Acceptance Criteria

### REQ-EXT-001: Detect exact Nexus page identity

- AC-EXT-001: Given `/skyrimspecialedition/mods/12604` with optional query/hash, when parsed, then identity is `('skyrimspecialedition', 12604)`.
- AC-EXT-002: Given unsupported games, listing/search routes, malformed IDs, zero, negatives, or deceptive text elsewhere in the URL, then no lookup or panel mount occurs.
- AC-EXT-003: Given canonical URL metadata that agrees with the path, then the path identity remains stable; disagreement is surfaced diagnostically and never title-matched.

### REQ-EXT-002: Mount safely and idempotently

- AC-EXT-004: Given the Nexus description page and an existing Collections accordion, then one Wabbajack accordion is inserted immediately after it.
- AC-EXT-005: Given the preferred anchor is absent or replaced, then a documented fallback mounts near `About this mod` without breaking page layout.
- AC-EXT-006: Given repeated mutation callbacks or SPA navigation to the same mod, then only one current panel exists.
- AC-EXT-007: Given SPA navigation to another supported mod, then stale content is removed and the new identity is loaded.

### REQ-EXT-003: Show all matching Wabbajack lists

- AC-EXT-008: Given N matching list IDs, then all N are available in the expanded panel, sorted by official status then title, with no silent display cap.
- AC-EXT-009: Each row shows linked list title, `<count> mods` in blue, and `NSFW` or `SFW` in red.
- AC-EXT-010: Each row exposes the official Wabbajack gallery link; when present, the author-maintained README is a distinct secondary native link.
- AC-EXT-011: The displayed count is clearly defined by tooltip/accessible text as unique Nexus mod pages indexed from the current Wabbajack manifest.
- AC-EXT-012: Official, unofficial, maintenance, stale, and last-verified states remain distinguishable without using color alone.

### REQ-EXT-004: Handle empty, loading, and failure states

- AC-EXT-013: While loading, the shell renders immediately with `aria-busy=true` and a polite status message.
- AC-EXT-014: Given no matching memberships in a complete fresh snapshot, then the panel says no indexed Wabbajack lists include this mod and names dataset freshness.
- AC-EXT-015: Given partial/stale coverage, missing bucket, network error, timeout, or schema mismatch, then the panel remains mounted with a concise retryable error and never claims true absence.
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

## Success Criteria

Both browser packages load without errors and, on a known indexed Nexus mod page, show the exact matching list set with required blue counts, red NSFW/SFW text, working official links, and resilient accessible states.

## Open Questions

Wabbajack currently exposes a durable official gallery URL, but a stable per-list web-page route has not been verified. Until one is proven, the product must label the official gallery link honestly and expose the list README separately rather than inventing a per-list URL.
