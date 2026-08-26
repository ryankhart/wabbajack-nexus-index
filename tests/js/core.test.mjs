import test from "node:test";
import assert from "node:assert/strict";

import {
  bucketForMod,
  createNexusArchiveLinks,
  createRetryableLoader,
  createListRows,
  parseNexusModUrl,
  parseWabbajackArchiveSearchUrl,
} from "../../extension/src/core.mjs";

test("parses canonical Nexus mod identity and ignores query/hash", () => {
  assert.deepEqual(
    parseNexusModUrl(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files#main"
    ),
    { gameDomain: "skyrimspecialedition", modId: 12604 }
  );
  assert.deepEqual(
    parseNexusModUrl("https://next.nexusmods.com/skyrimspecialedition/mods/42"),
    { gameDomain: "skyrimspecialedition", modId: 42 }
  );
  assert.deepEqual(
    parseNexusModUrl("https://www.nexusmods.com/newvegas/mods/123"),
    { gameDomain: "newvegas", modId: 123 }
  );
  assert.deepEqual(
    parseNexusModUrl("https://www.nexusmods.com/7daystodie/mods/456"),
    { gameDomain: "7daystodie", modId: 456 }
  );
});

test("rejects non-detail pages, non-Nexus hosts, and malformed IDs", () => {
  for (const url of [
    "https://nexusmods.com/skyrimspecialedition/mods/42",
    "https://www.nexusmods.com/skyrimspecialedition/mods/",
    "https://www.nexusmods.com/games/skyrimspecialedition/mods",
    "https://www.nexusmods.com/skyrimspecialedition/mods/42/files",
    "https://example.com/skyrimspecialedition/mods/42",
    "not a url",
  ]) {
    assert.equal(parseNexusModUrl(url), null, url);
  }
});

test("parses only canonical per-modlist Wabbajack archive-search routes", () => {
  assert.deepEqual(
    parseWabbajackArchiveSearchUrl(
      "https://www.wabbajack.org/search/wj-featured/tpf?ignored=true#results"
    ),
    {
      repository: "wj-featured",
      machineId: "tpf",
      statusUrl:
        "https://raw.githubusercontent.com/wabbajack-tools/mod-lists/master/reports/wj-featured/tpf/status.json",
    }
  );

  for (const url of [
    "https://www.wabbajack.org/search/global",
    "https://www.wabbajack.org/gallery",
    "https://wabbajack.org/search/wj-featured/tpf",
    "https://example.com/search/wj-featured/tpf",
    "not a url",
  ]) {
    assert.equal(parseWabbajackArchiveSearchUrl(url), null, url);
  }
});

test("projects exact Wabbajack Nexus IDs to mod and file pages", () => {
  assert.deepEqual(
    createNexusArchiveLinks({
      $type: "NexusDownloader, Wabbajack.Lib",
      GameName: "SkyrimSpecialEdition",
      ModID: 21916,
      FileID: 75329,
      Name: "A Lovely Letter Alternate Routes",
    }),
    {
      gameDomain: "skyrimspecialedition",
      modId: 21916,
      fileId: 75329,
      modUrl: "https://www.nexusmods.com/skyrimspecialedition/mods/21916",
      fileUrl:
        "https://www.nexusmods.com/skyrimspecialedition/mods/21916?tab=files&file_id=75329",
    }
  );
});

test("normalizes authoritative game aliases and rejects inferred Nexus identities", () => {
  for (const [game, expectedDomain] of [
    ["SkyrimVR", "skyrimspecialedition"],
    ["FalloutNewVegas", "newvegas"],
    ["SevenDaysToDie", "7daystodie"],
    ["BaldursGate3", "baldursgate3"],
  ]) {
    assert.equal(
      createNexusArchiveLinks({
        $type: "Nexus",
        Game: game,
        ModId: 42,
        FileId: 100,
      }).gameDomain,
      expectedDomain
    );
  }

  for (const state of [
    { $type: "HttpDownloader", GameName: "SkyrimSpecialEdition", ModID: 42, FileID: 100 },
    { $type: "Nexus", Game: "UnknownGame", ModID: 42, FileID: 100 },
    { $type: "Nexus", Game: "SkyrimSpecialEdition", ModID: 0, FileID: 100 },
    { $type: "Nexus", Game: "SkyrimSpecialEdition", ModID: 42, FileID: "100" },
    { Name: "Filename-42-100.zip" },
  ]) {
    assert.equal(createNexusArchiveLinks(state), null);
  }
});

test("retries a cached bundled-data load after a transient rejection", async () => {
  let attempts = 0;
  const load = createRetryableLoader(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("temporary read failure");
    }
    return { ready: true };
  });

  await assert.rejects(load(), /temporary read failure/);
  assert.deepEqual(await load(), { ready: true });
  assert.equal(attempts, 2);
});

test("computes the published bucket number", () => {
  assert.equal(bucketForMod(0, 1000), 0);
  assert.equal(bucketForMod(999, 1000), 0);
  assert.equal(bucketForMod(12604, 1000), 12);
  assert.throws(() => bucketForMod(-1, 1000));
  assert.throws(() => bucketForMod(1, 0));
});

test("sorts rows by descending mod count with deterministic title ties", () => {
  const modlists = {
    "repo/Beta": {
      title: "Beta List",
      nexusModCount: 1300,
      classification: "NSFW",
      imageUrl: "https://images.example.test/beta.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "https://example.test/beta",
      status: "indexed",
    },
    "repo/Alpha": {
      title: "Alpha List",
      nexusModCount: 1200,
      classification: "SFW",
      imageUrl: "https://images.example.test/alpha.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Alpha",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
      status: "indexed",
    },
    "repo/Gamma": {
      title: "Gamma List",
      nexusModCount: 1200,
      classification: "SFW",
      imageUrl: "https://images.example.test/gamma.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Gamma",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
      status: "indexed",
    },
  };

  assert.deepEqual(createListRows(["repo/Gamma", "repo/Alpha", "repo/Beta"], modlists), [
    {
      stableId: "repo/Beta",
      title: "Beta List",
      modCount: 1300,
      classification: "NSFW",
      imageUrl: "https://images.example.test/beta.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "https://example.test/beta",
    },
    {
      stableId: "repo/Alpha",
      title: "Alpha List",
      modCount: 1200,
      classification: "SFW",
      imageUrl: "https://images.example.test/alpha.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Alpha",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
    },
    {
      stableId: "repo/Gamma",
      title: "Gamma List",
      modCount: 1200,
      classification: "SFW",
      imageUrl: "https://images.example.test/gamma.webp",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Gamma",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
    },
  ]);
});

test("drops missing or non-indexed list IDs and sanitizes unexpected classifications", () => {
  assert.deepEqual(
    createListRows(["missing", "repo/stale", "repo/known"], {
      "repo/stale": {
        title: "Stale",
        nexusModCount: 4,
        classification: "SFW",
        wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Stale",
        status: "stale",
      },
      "repo/known": {
        title: "Known",
        nexusModCount: 3,
        classification: "surprise",
        imageUrl: "http://images.example.test/unsafe.webp",
        wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
        galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
        readmeUrl: null,
        status: "indexed",
      },
    }),
    [
      {
        stableId: "repo/known",
        title: "Known",
        modCount: 3,
        classification: "UNKNOWN",
        imageUrl: "",
        wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
        galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
        readmeUrl: "",
      },
    ]
  );
});
