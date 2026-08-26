# Capability Map: Wabbajack Nexus Index

| Module id | Responsibility | Depends on |
|---|---|---|
| `registry-ingestion` | Enumerate Wabbajack sources, extract current Skyrim-family manifests, normalize exact Nexus identities, and reconcile coverage | — |
| `dataset-publication` | Preserve indexed history and emit deterministic, validated lookup artifacts with provenance and freshness | `registry-ingestion` |
| `extension-surface` | Detect Nexus mod pages and render the matching Wabbajack lists in a resilient Chrome/Firefox UI | `dataset-publication` |

Build order: `registry-ingestion` → `dataset-publication` → `extension-surface`.

## Boundary contracts

### `registry-ingestion` provides

- stable list identity `(repository_name, machine_url)`;
- immutable list snapshot identity `(stable_list_id, version, download_hash)`;
- normalized Nexus mod identity `(game_domain, mod_id)`;
- deduplicated membership evidence with retained file IDs;
- one terminal status for every discovered in-scope list.

### `dataset-publication` provides

- schema-versioned list metadata and mod-to-list lookup artifacts;
- unique Nexus mod-page count per list snapshot;
- a coverage report proving discovered totals reconcile;
- atomic last-known-good publication semantics.

### `extension-surface` consumes

- only published schema-versioned artifacts;
- no Nexus API key and no mod title matching;
- no executable remote code.

## Scope validation

The modules are independently testable and dependency direction is acyclic. A list may be indexed without an extension, and the extension is intentionally unable to reinterpret raw manifests. This keeps discovery/data quality separate from site integration.
