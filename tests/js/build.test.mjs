import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { buildExtension } from "../../scripts/build-extension.mjs";

test("builds permission-free Chrome and Firefox packages with bundled data", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wjni-build-"));
  const data = path.join(root, "data");
  const output = path.join(root, "dist");
  await mkdir(path.join(data, "games", "skyrimspecialedition"), { recursive: true });
  await writeFile(path.join(data, "index-meta.json"), JSON.stringify({ bucketSize: 1000 }));
  await writeFile(path.join(data, "modlists.json"), "{}");
  await writeFile(
    path.join(data, "games", "skyrimspecialedition", "0.json"),
    JSON.stringify({ mods: {} })
  );

  await buildExtension({
    sourceDir: path.resolve("extension/src"),
    dataDir: data,
    outputRoot: output,
  });

  for (const target of ["chrome", "firefox"]) {
    const targetRoot = path.join(output, target);
    const manifest = JSON.parse(await readFile(path.join(targetRoot, "manifest.json")));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions ?? [], []);
    assert.deepEqual(manifest.host_permissions ?? [], []);
    assert.deepEqual(manifest.content_scripts[0].matches, [
      "https://www.nexusmods.com/*/mods/*",
      "https://next.nexusmods.com/*/mods/*",
    ]);
    assert.deepEqual(manifest.content_scripts[0].js, ["core.global.js", "content.js"]);
    assert.ok(
      manifest.web_accessible_resources[0].resources.includes("assets/*.webp"),
      "the bundled logo must be readable from the injected page"
    );
    assert.ok(
      (await readFile(path.join(targetRoot, "assets", "wabbajack-transparent.webp")))
        .byteLength > 0,
      "the built package must contain the Wabbajack logo"
    );
    assert.equal(
      JSON.parse(await readFile(path.join(targetRoot, "data", "index-meta.json"))).bucketSize,
      1000
    );
    const core = await readFile(path.join(targetRoot, "core.global.js"), "utf8");
    assert.doesNotMatch(core, /export function/);
    assert.match(core, /globalThis\.WJNI/);
    const context = { URL };
    context.globalThis = context;
    vm.runInNewContext(core, context);
    assert.equal(
      typeof context.WJNI.createRetryableLoader,
      "function",
      "the built API must expose every helper used by content.js"
    );
  }

  const firefox = JSON.parse(
    await readFile(path.join(output, "firefox", "manifest.json"))
  );
  assert.equal(
    firefox.browser_specific_settings.gecko.id,
    "wabbajack-nexus-index@local"
  );
});
