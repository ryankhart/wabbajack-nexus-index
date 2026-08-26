(() => {
  "use strict";

  const REMOTE_BASE = "https://ryankhart.github.io/wabbajack-nexus-index";
  const REQUEST_TIMEOUT_MS = 5000;
  const SNAPSHOT_PATTERN = /^[0-9a-f]{64}$/;
  const GAME_DOMAIN_PATTERN = /^[a-z0-9-]+$/;
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;

  if (!runtime?.onMessage) {
    return;
  }

  function validTimestamp(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
  }

  function requirePlainObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${label} must be an object`);
    }
    return value;
  }

  async function fetchJson(url, cache) {
    const signal = globalThis.AbortSignal?.timeout?.(REQUEST_TIMEOUT_MS);
    const response = await fetch(url, { cache, signal });
    if (!response.ok) {
      throw new Error(`Index request failed: ${response.status}`);
    }
    return response.json();
  }

  function validatePointer(value) {
    const pointer = requirePlainObject(value, "Remote index pointer");
    if (
      pointer.schemaVersion !== 1 ||
      !SNAPSHOT_PATTERN.test(pointer.snapshotId) ||
      !validTimestamp(pointer.generatedAt)
    ) {
      throw new TypeError("Remote index pointer is invalid");
    }
    return pointer;
  }

  function validateMetadata(value, expectedGeneratedAt = null) {
    const metadata = requirePlainObject(value, "Index metadata");
    if (
      metadata.schemaVersion !== 1 ||
      !validTimestamp(metadata.generatedAt) ||
      (expectedGeneratedAt !== null && metadata.generatedAt !== expectedGeneratedAt) ||
      !Number.isSafeInteger(metadata.bucketSize) ||
      metadata.bucketSize <= 0
    ) {
      throw new TypeError("Index metadata is invalid");
    }
    const buckets = requirePlainObject(metadata.buckets, "Index bucket manifest");
    for (const [gameDomain, bucketNumbers] of Object.entries(buckets)) {
      if (
        !GAME_DOMAIN_PATTERN.test(gameDomain) ||
        !Array.isArray(bucketNumbers) ||
        bucketNumbers.some(
          (bucketNumber) => !Number.isSafeInteger(bucketNumber) || bucketNumber < 0
        )
      ) {
        throw new TypeError("Index bucket manifest is invalid");
      }
    }
    return metadata;
  }

  function validateIdentity(message) {
    if (
      !GAME_DOMAIN_PATTERN.test(message?.gameDomain || "") ||
      !Number.isSafeInteger(message?.modId) ||
      message.modId <= 0
    ) {
      throw new TypeError("Lookup identity is invalid");
    }
    return { gameDomain: message.gameDomain, modId: message.modId };
  }

  function validateBucket(value, identity, expectedBucket, bucketSize) {
    const lookupBucket = requirePlainObject(value, "Lookup bucket");
    if (
      lookupBucket.schemaVersion !== 1 ||
      lookupBucket.gameDomain !== identity.gameDomain ||
      lookupBucket.bucket !== expectedBucket ||
      lookupBucket.bucketSize !== bucketSize
    ) {
      throw new TypeError("Lookup bucket identity is invalid");
    }
    const mods = requirePlainObject(lookupBucket.mods, "Lookup bucket mods");
    const modId = String(identity.modId);
    const stableIds = Object.hasOwn(mods, modId) ? mods[modId] : [];
    if (!Array.isArray(stableIds) || stableIds.some((stableId) => typeof stableId !== "string")) {
      throw new TypeError("Lookup membership list is invalid");
    }
    return stableIds;
  }

  async function readLookup(source, identity) {
    const metadata = source.metadata;
    const bucketNumber = Math.floor(identity.modId / metadata.bucketSize);
    const availableBuckets = metadata.buckets[identity.gameDomain] || [];
    if (!availableBuckets.includes(bucketNumber)) {
      return {
        ok: true,
        source: source.name,
        generatedAt: metadata.generatedAt,
        stableIds: [],
        modlists: {},
      };
    }

    const [modlistsValue, bucketValue] = await Promise.all([
      fetchJson(source.url("modlists.json"), source.cache),
      fetchJson(
        source.url(`games/${identity.gameDomain}/${bucketNumber}.json`),
        source.cache
      ),
    ]);
    const modlists = requirePlainObject(modlistsValue, "Modlist metadata");
    const stableIds = validateBucket(
      bucketValue,
      identity,
      bucketNumber,
      metadata.bucketSize
    );
    if (stableIds.some((stableId) => !Object.hasOwn(modlists, stableId))) {
      throw new TypeError("Lookup membership references missing modlist metadata");
    }
    return {
      ok: true,
      source: source.name,
      generatedAt: metadata.generatedAt,
      stableIds,
      modlists,
    };
  }

  async function remoteSource() {
    const pointer = validatePointer(
      await fetchJson(`${REMOTE_BASE}/latest.json`, "no-store")
    );
    const snapshotBase = `${REMOTE_BASE}/snapshots/${pointer.snapshotId}`;
    const metadata = validateMetadata(
      await fetchJson(`${snapshotBase}/index-meta.json`, "force-cache"),
      pointer.generatedAt
    );
    return {
      name: "remote",
      metadata,
      cache: "force-cache",
      url: (relativePath) => `${snapshotBase}/${relativePath}`,
    };
  }

  async function bundledSource() {
    const metadata = validateMetadata(
      await fetchJson(runtime.getURL("data/index-meta.json"), "no-store")
    );
    return {
      name: "bundled",
      metadata,
      cache: "no-store",
      url: (relativePath) => runtime.getURL(`data/${relativePath}`),
    };
  }

  async function availableSources() {
    const [remoteResult, bundledResult] = await Promise.allSettled([
      remoteSource(),
      bundledSource(),
    ]);
    const sources = [];
    const errors = [];

    if (remoteResult.status === "fulfilled") {
      sources.push(remoteResult.value);
    } else {
      errors.push(remoteResult.reason);
    }
    if (bundledResult.status === "fulfilled") {
      sources.push(bundledResult.value);
    } else {
      errors.push(bundledResult.reason);
    }

    sources.sort((left, right) => {
      const ageDifference =
        Date.parse(right.metadata.generatedAt) - Date.parse(left.metadata.generatedAt);
      if (ageDifference !== 0) {
        return ageDifference;
      }
      return left.name === "remote" ? -1 : 1;
    });
    return { sources, errors };
  }

  async function lookup(message) {
    const identity = validateIdentity(message);
    const { sources, errors } = await availableSources();
    for (const source of sources) {
      try {
        return await readLookup(source, identity);
      } catch (error) {
        errors.push(error);
      }
    }
    throw new AggregateError(errors, "Remote and bundled index lookups failed");
  }

  async function status() {
    const { sources, errors } = await availableSources();
    const source = sources[0];
    if (source) {
      return {
        ok: true,
        source: source.name,
        generatedAt: source.metadata.generatedAt,
      };
    }
    throw new AggregateError(errors, "Remote and bundled index status checks failed");
  }

  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    let operation;
    if (message?.type === "wjni:lookup") {
      operation = lookup(message);
    } else if (message?.type === "wjni:status") {
      operation = status();
    } else {
      return false;
    }
    operation.then(
      sendResponse,
      (error) => {
        console.warn("Unofficial Wabbajack-Nexus Index lookup failed", error);
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Index lookup failed",
        });
      }
    );
    return true;
  });
})();
