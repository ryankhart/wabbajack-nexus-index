# GitHub Extension Release Plan

## Scope

Prepare and publish `v0.1.0` Chrome and Firefox extension archives on GitHub without submitting either extension to a browser store.

## Tasks

- [ ] REL-T1 (AC-REL-001–003): RED permanent Firefox identity and versioned artifact expectations → GREEN build/package implementation → focused tests → full `npm run verify` → exact archive parity and checksum inspection.
- [ ] REL-T2 (AC-REL-004–007): update installation/release documentation and durable state → stage explicit paths → independent exact-snapshot review → commit and push → publish `v0.1.0` with both archives and checksums → download and verify the live assets and metadata.

## Risks and Mitigations

- Version drift: derive archive names from the built manifest version and test package/manifest agreement.
- Firefox install confusion: state clearly that the unsigned GitHub XPI is temporary in regular Firefox until Mozilla signs a later store or unlisted submission.
- Stale or substituted assets: checksum exact local archives, upload those paths, then download and hash the GitHub assets independently.
- Accidental store publication: use only Git and GitHub Release operations; do not access AMO or Chrome Web Store submission flows.

## Verification Checkpoints

1. Focused RED failure for old `@local` identity and `-dev` package names.
2. Focused GREEN tests and canonical `npm run verify`.
3. Byte-for-byte archive parity plus local SHA-256 verification.
4. Independent review of the exact staged candidate.
5. Remote tag/release target and downloaded asset checksum verification.

## Boundaries

- Publish only after Ryan's explicit approval, which was given on 2026-08-27.
- Do not publish to, submit to, or sign through either browser store.
- Do not include SQLite, caches, credentials, or ignored diagnostic artifacts.
