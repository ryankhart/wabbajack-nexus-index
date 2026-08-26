import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const backgroundPath = new URL("../../extension/src/background.js", import.meta.url);
const SNAPSHOT_ID = "a".repeat(64);
const REMOTE_BASE = "https://ryankhart.github.io/wabbajack-nexus-index";

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  };
}

async function startBackground(fetchFixture) {
  const source = await readFile(backgroundPath, "utf8");
  const requests = [];
  let listener;
  const runtime = {
    getURL: (path) => `extension://fixture/${path}`,
    onMessage: {
      addListener: (candidate) => {
        listener = candidate;
      },
    },
  };
  const context = {
    AbortSignal,
    browser: { runtime },
    chrome: { runtime },
    console: { warn() {} },
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return fetchFixture(String(url), options);
    },
    setTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "background.js" });
  assert.equal(typeof listener, "function", "the background must register a message listener");

  return {
    requests,
    send(message) {
      return new Promise((resolve) => {
        assert.equal(listener(message, {}, resolve), true);
      });
    },
  };
}

function metadata(
  buckets = { skyrimspecialedition: [0] },
  generatedAt = "2026-08-26T12:00:00Z"
) {
  return {
    schemaVersion: 1,
    generatedAt,
    bucketSize: 1000,
    buckets,
  };
}

function bucket(stableIds = ["fixture/Remote"]) {
  return {
    schemaVersion: 1,
    gameDomain: "skyrimspecialedition",
    bucket: 0,
    bucketSize: 1000,
    mods: { 42: stableIds },
  };
}

const remotePointer = {
  schemaVersion: 1,
  snapshotId: SNAPSHOT_ID,
  generatedAt: "2026-08-26T12:00:00Z",
};

const remoteModlists = {
  "fixture/Remote": {
    title: "Remote List",
    nexusModCount: 1,
    classification: "SFW",
    status: "indexed",
  },
};

test("returns a validated remote membership from one immutable snapshot", async () => {
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse(remotePointer);
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata(undefined, "2026-08-26T11:00:00Z"));
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/index-meta.json`) {
      return jsonResponse(metadata());
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/modlists.json`) {
      return jsonResponse(remoteModlists);
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/games/skyrimspecialedition/0.json`) {
      return jsonResponse(bucket());
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "remote");
  assert.equal(result.generatedAt, "2026-08-26T12:00:00Z");
  assert.deepEqual([...result.stableIds], ["fixture/Remote"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.modlists)), remoteModlists);
  assert.equal(page.requests.length, 5);
  assert.equal(
    page.requests.find(({ url }) => url === `${REMOTE_BASE}/latest.json`).options.cache,
    "no-store"
  );
  assert.equal(
    page.requests.find(({ url }) => url.endsWith("/index-meta.json") && url.startsWith(REMOTE_BASE))
      .options.cache,
    "force-cache"
  );
});

test("preserves a confirmed empty remote result without reading bundled lookup data", async () => {
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse(remotePointer);
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata(undefined, "2026-08-26T11:00:00Z"));
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/index-meta.json`) {
      return jsonResponse(metadata({ skyrimspecialedition: [] }));
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "remote");
  assert.deepEqual([...result.stableIds], []);
  assert.deepEqual(JSON.parse(JSON.stringify(result.modlists)), {});
  assert.equal(
    page.requests.some(
      ({ url }) => url.startsWith("extension://") && !url.endsWith("/index-meta.json")
    ),
    false
  );
});

test("reports the active readable source and generation time", async () => {
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse(remotePointer);
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata(undefined, "2026-08-26T11:00:00Z"));
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/index-meta.json`) {
      return jsonResponse(metadata());
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({ type: "wjni:status" });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    source: "remote",
    generatedAt: "2026-08-26T12:00:00Z",
  });
  assert.equal(page.requests.length, 3);
});

test("uses newer packaged data when the remote snapshot is older", async () => {
  const bundledGeneratedAt = "2026-08-26T13:00:00Z";
  const bundledModlists = {
    "fixture/Bundled": {
      title: "Bundled List",
      nexusModCount: 1,
      classification: "SFW",
      status: "indexed",
    },
  };
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse(remotePointer);
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/index-meta.json`) {
      return jsonResponse(metadata());
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/modlists.json`) {
      return jsonResponse(remoteModlists);
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/games/skyrimspecialedition/0.json`) {
      return jsonResponse(bucket());
    }
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata(undefined, bundledGeneratedAt));
    }
    if (url === "extension://fixture/data/modlists.json") {
      return jsonResponse(bundledModlists);
    }
    if (url === "extension://fixture/data/games/skyrimspecialedition/0.json") {
      return jsonResponse(bucket(["fixture/Bundled"]));
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "bundled");
  assert.equal(result.generatedAt, bundledGeneratedAt);
  assert.deepEqual([...result.stableIds], ["fixture/Bundled"]);
});

test("falls back to packaged data when the remote pointer is unsafe", async () => {
  const bundledModlists = {
    "fixture/Bundled": {
      title: "Bundled List",
      nexusModCount: 1,
      classification: "SFW",
      status: "indexed",
    },
  };
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) {
      return jsonResponse({ ...remotePointer, snapshotId: "../escape" });
    }
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata());
    }
    if (url === "extension://fixture/data/modlists.json") {
      return jsonResponse(bundledModlists);
    }
    if (url === "extension://fixture/data/games/skyrimspecialedition/0.json") {
      return jsonResponse(bucket(["fixture/Bundled"]));
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "bundled");
  assert.deepEqual([...result.stableIds], ["fixture/Bundled"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.modlists)), bundledModlists);
  assert.equal(
    page.requests.some(({ url }) => url.includes("../escape")),
    false,
    "an untrusted snapshot ID must never become a request path"
  );
});

test("falls back when a remote bucket has a falsy non-array membership", async () => {
  const bundledModlists = {
    "fixture/Bundled": {
      title: "Bundled List",
      nexusModCount: 1,
      classification: "SFW",
      status: "indexed",
    },
  };
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse(remotePointer);
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/index-meta.json`) {
      return jsonResponse(metadata());
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/modlists.json`) {
      return jsonResponse(remoteModlists);
    }
    if (url === `${REMOTE_BASE}/snapshots/${SNAPSHOT_ID}/games/skyrimspecialedition/0.json`) {
      return jsonResponse({ ...bucket(), mods: { 42: null } });
    }
    if (url === "extension://fixture/data/index-meta.json") {
      return jsonResponse(metadata(undefined, "2026-08-26T11:00:00Z"));
    }
    if (url === "extension://fixture/data/modlists.json") {
      return jsonResponse(bundledModlists);
    }
    if (url === "extension://fixture/data/games/skyrimspecialedition/0.json") {
      return jsonResponse(bucket(["fixture/Bundled"]));
    }
    throw new Error(`unexpected request ${url}`);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "bundled");
  assert.deepEqual([...result.stableIds], ["fixture/Bundled"]);
});

test("reports an error when neither remote nor packaged data is readable", async () => {
  const page = await startBackground(async (url) => {
    if (url === `${REMOTE_BASE}/latest.json`) return jsonResponse({}, 503);
    return jsonResponse({}, 404);
  });

  const result = await page.send({
    type: "wjni:lookup",
    gameDomain: "skyrimspecialedition",
    modId: 42,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /remote and bundled index lookups failed/i);
});
