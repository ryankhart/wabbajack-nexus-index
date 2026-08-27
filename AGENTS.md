# Project Agent Context

## Mission

Build and maintain a verified data pipeline and resilient Chrome/Firefox extensions that show which Wabbajack modlists include the Nexus mod being viewed and add exact Nexus mod/file links to Wabbajack archive search results.

## Hard invariants

1. Match Nexus mods only by normalized game domain and integer mod ID; never by title.
2. Count unique Nexus mod pages per list, not archives or installed files.
3. Preserve Wabbajack-provided NSFW classification; do not infer it.
4. Every discovered list reaches an explicit terminal run status; never silently omit failures.
5. Publish only reconciled, schema-valid artifacts; preserve last-known-good data on partial failures.
6. Do not require, collect, or commit Nexus API keys.
7. Use strict RED -> GREEN -> REFACTOR for behavioral code.
8. Do not publish, push, create a remote, select a license, or submit to browser stores without Ryan's approval.
9. Implement every feature and bug fix for both the Chrome and Firefox extensions, and keep both extensions in feature and behavior parity at all times.

## Canonical commands

- Python tests: `python -m unittest discover -s tests/python -v`
- Node tests: `npm test`
- Build: `npm run build`
- Full verification: `npm run verify`
- Local index: `python -m pipeline build --game skyrimspecialedition`

## Durable state

Read `.hermes/specs/wabbajack-nexus-index/CAPABILITY-MAP.md`, the module specs, `.hermes/plans/`, and `.hermes/STATE.md` before continuing multi-session work.

Treat `.hermes/STATE.md` as a tracked durable handoff, not a temporary task log. Update it when the milestone, verified baseline, durable decisions, approval boundaries, or next executable action materially changes. Commit the update with the change that makes it true or as an immediate documentation checkpoint; keep evidence dated and concise, and do not leave stale state edits across unrelated commits.
