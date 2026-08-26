# Project Agent Context

## Mission

Build and maintain a verifiable Skyrim-family Wabbajack-to-Nexus membership index and a resilient Chrome/Firefox extension that displays it on Nexus mod pages.

## Hard invariants

1. Match Nexus mods only by normalized game domain and integer mod ID; never by title.
2. Count unique Nexus mod pages per list, not archives or installed files.
3. Preserve Wabbajack-provided NSFW classification; do not infer it.
4. Every discovered list reaches an explicit terminal run status; never silently omit failures.
5. Publish only reconciled, schema-valid artifacts; preserve last-known-good data on partial failures.
6. Do not require, collect, or commit Nexus API keys.
7. Use strict RED -> GREEN -> REFACTOR for behavioral code.
8. Do not publish, push, create a remote, select a license, or submit to browser stores without Ryan's approval.

## Canonical commands

- Python tests: `python -m unittest discover -s tests/python -v`
- Node tests: `npm test`
- Build: `npm run build`
- Full verification: `npm run verify`
- Local index: `python -m pipeline build --game skyrimspecialedition`

## Durable state

Read `.hermes/specs/wabbajack-nexus-index/CAPABILITY-MAP.md`, the module specs, `.hermes/plans/`, and `.hermes/STATE.md` before continuing multi-session work.
