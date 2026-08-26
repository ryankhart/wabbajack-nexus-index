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
  const gameDomains = ["skyrimspecialedition", "newvegas", "7daystodie"];
  await Promise.all(
    gameDomains.map((gameDomain) =>
      mkdir(path.join(data, "games", gameDomain), { recursive: true })
    )
  );
  await writeFile(path.join(data, "index-meta.json"), JSON.stringify({ bucketSize: 1000 }));
  await writeFile(path.join(data, "modlists.json"), "{}");
  await Promise.all(
    gameDomains.map((gameDomain) =>
      writeFile(
        path.join(data, "games", gameDomain, "0.json"),
        JSON.stringify({ gameDomain, mods: {} })
      )
    )
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
    assert.equal(manifest.name, "Unofficial Wabbajack-Nexus Index");
    assert.equal(
      manifest.description,
      "Unofficial, independent index of Wabbajack modlists for Nexus Mods pages; not affiliated with Wabbajack or Nexus Mods."
    );
    assert.equal(
      manifest.homepage_url,
      "https://github.com/ryankhart/wabbajack-nexus-index"
    );
    assert.deepEqual(manifest.permissions ?? [], []);
    assert.deepEqual(manifest.host_permissions ?? [], []);
    assert.deepEqual(manifest.action, {
      default_icon: {
        16: "assets/icon-16.png",
        32: "assets/icon-32.png",
      },
      default_popup: "popup.html",
      default_title: "Unofficial Wabbajack-Nexus Index",
    });
    assert.deepEqual(manifest.icons, {
      16: "assets/icon-16.png",
      32: "assets/icon-32.png",
      48: "assets/icon-48.png",
      128: "assets/icon-128.png",
    });
    assert.deepEqual(manifest.content_scripts[0].matches, [
      "https://www.nexusmods.com/*/mods/*",
      "https://next.nexusmods.com/*/mods/*",
    ]);
    assert.deepEqual(manifest.content_scripts[0].js, ["core.global.js", "content.js"]);
    assert.ok(
      manifest.web_accessible_resources[0].resources.includes("assets/*.png"),
      "the packaged mark must be readable from the injected page"
    );
    assert.ok(
      !manifest.web_accessible_resources[0].resources.includes("assets/*.webp"),
      "the package must not expose the retired Wabbajack logo format"
    );
    for (const size of [16, 32, 48, 128]) {
      const icon = await readFile(path.join(targetRoot, "assets", `icon-${size}.png`));
      assert.ok(
        icon.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        `icon-${size}.png must be a PNG`
      );
      assert.equal(icon.readUInt32BE(16), size);
      assert.equal(icon.readUInt32BE(20), size);
    }
    const suppliedMark = await readFile(path.join(targetRoot, "assets", "brand-mark.png"));
    assert.ok(
      suppliedMark.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      "the supplied source mark must ship as a PNG"
    );
    assert.equal(suppliedMark.readUInt32BE(16), 1254);
    assert.equal(suppliedMark.readUInt32BE(20), 1254);
    await assert.rejects(
      readFile(path.join(targetRoot, "assets", "brand-mark.svg")),
      /ENOENT/,
      "the rejected generated mark must not ship"
    );
    await assert.rejects(
      readFile(path.join(targetRoot, "assets", "wabbajack-transparent.webp")),
      /ENOENT/,
      "the copied Wabbajack logo must not ship"
    );
    assert.equal(
      JSON.parse(await readFile(path.join(targetRoot, "data", "index-meta.json"))).bucketSize,
      1000
    );
    for (const gameDomain of gameDomains) {
      assert.equal(
        JSON.parse(
          await readFile(path.join(targetRoot, "data", "games", gameDomain, "0.json"))
        ).gameDomain,
        gameDomain
      );
    }
    assert.match(await readFile(path.join(targetRoot, "popup.html"), "utf8"), /popup\.js/);
    assert.match(
      await readFile(path.join(targetRoot, "popup.js"), "utf8"),
      /data\/index-meta\.json/
    );
    assert.match(await readFile(path.join(targetRoot, "popup.css"), "utf8"), /\.popup/);
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
