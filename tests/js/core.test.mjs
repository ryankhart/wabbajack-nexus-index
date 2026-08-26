import test from "node:test";
import assert from "node:assert/strict";

import {
  bucketForMod,
  createListRows,
  parseNexusModUrl,
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
});

test("rejects non-detail pages, non-Nexus hosts, and malformed IDs", () => {
  for (const url of [
    "https://www.nexusmods.com/skyrimspecialedition/mods/",
    "https://www.nexusmods.com/games/skyrimspecialedition/mods",
    "https://www.nexusmods.com/skyrimspecialedition/mods/42/files",
    "https://example.com/skyrimspecialedition/mods/42",
    "not a url",
  ]) {
    assert.equal(parseNexusModUrl(url), null, url);
  }
});

test("computes the published bucket number", () => {
  assert.equal(bucketForMod(0, 1000), 0);
  assert.equal(bucketForMod(999, 1000), 0);
  assert.equal(bucketForMod(12604, 1000), 12);
  assert.throws(() => bucketForMod(-1, 1000));
  assert.throws(() => bucketForMod(1, 0));
});

test("creates alphabetized rows with count, classification, and links", () => {
  const modlists = {
    "repo/Beta": {
      title: "Beta List",
      nexusModCount: 900,
      classification: "NSFW",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "https://example.test/beta",
      status: "indexed",
    },
    "repo/Alpha": {
      title: "Alpha List",
      nexusModCount: 1200,
      classification: "SFW",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Alpha",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
      status: "indexed",
    },
  };

  assert.deepEqual(createListRows(["repo/Beta", "repo/Alpha"], modlists), [
    {
      stableId: "repo/Alpha",
      title: "Alpha List",
      modCount: 1200,
      classification: "SFW",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Alpha",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "",
    },
    {
      stableId: "repo/Beta",
      title: "Beta List",
      modCount: 900,
      classification: "NSFW",
      wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
      galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
      readmeUrl: "https://example.test/beta",
    },
  ]);
});

test("drops stale lookup IDs and sanitizes unexpected classifications", () => {
  assert.deepEqual(
    createListRows(["missing", "repo/known"], {
      "repo/known": {
        title: "Known",
        nexusModCount: 3,
        classification: "surprise",
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
        wabbajackUrl: "https://www.wabbajack.org/modlist/repo/Beta",
        galleryUrl: "https://www.wabbajack.org/#/modlists/gallery",
        readmeUrl: "",
      },
    ]
  );
});
