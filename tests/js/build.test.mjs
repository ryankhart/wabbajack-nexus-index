import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { buildExtension } from "../../scripts/build-extension.mjs";

async function readTree(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const absolutePath = path.join(entry.parentPath, entry.name);
    files.set(path.relative(root, absolutePath).replaceAll(path.sep, "/"), await readFile(absolutePath));
  }
  return files;
}

test("builds minimally permissioned Chrome and Firefox packages with remote fallback", async (t) => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8")
  );
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
  await mkdir(path.join(data, "snapshots", "fixture"), { recursive: true });
  await writeFile(path.join(data, "latest.json"), JSON.stringify({ snapshotId: "fixture" }));
  await writeFile(path.join(data, "coverage.json"), JSON.stringify({ discovered: 1 }));
  await writeFile(path.join(data, "snapshots", "fixture", "sentinel.json"), "{}");
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
    assert.equal(manifest.version, packageJson.version);
    assert.equal(manifest.name, "Unofficial Wabbajack-Nexus Index");
    assert.equal(
      manifest.description,
      "Shows which Wabbajack modlists include a Nexus mod and links archives to Nexus Mods. Independent, unofficial, and not affiliated."
    );
    assert.ok(manifest.description.length <= 132);
    assert.equal(
      manifest.homepage_url,
      "https://github.com/ryankhart/wabbajack-nexus-index"
    );
    assert.deepEqual(manifest.permissions ?? [], []);
    assert.deepEqual(manifest.host_permissions, ["https://ryankhart.github.io/*"]);
    assert.deepEqual(
      manifest.background,
      target === "chrome"
        ? { service_worker: "background.js" }
        : { scripts: ["background.js"] }
    );
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
    assert.deepEqual(manifest.web_accessible_resources[0].matches, [
      "https://www.nexusmods.com/*",
      "https://next.nexusmods.com/*",
    ]);
    assert.deepEqual(manifest.content_scripts[0], {
      matches: [
        "https://www.nexusmods.com/*/mods/*",
        "https://next.nexusmods.com/*/mods/*",
      ],
      js: ["shared-core.js", "nexusmods.js"],
      css: ["nexusmods.css"],
      run_at: "document_idle",
    });
    assert.deepEqual(manifest.content_scripts[1], {
      matches: ["https://www.wabbajack.org/search/*"],
      js: ["shared-core.js", "wabbajack.js"],
      css: ["wabbajack.css"],
      run_at: "document_idle",
    });
    for (const retiredName of ["core.global.js", "content.js", "content.css"]) {
      await assert.rejects(
        readFile(path.join(targetRoot, retiredName)),
        /ENOENT/,
        `${retiredName} must not survive the site-specific rename`
      );
    }
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
    await assert.rejects(
      readFile(path.join(targetRoot, "data", "latest.json")),
      /ENOENT/,
      "the package must not include the hosting pointer"
    );
    await assert.rejects(
      readFile(path.join(targetRoot, "data", "coverage.json")),
      /ENOENT/,
      "the package must not include operator-only coverage data"
    );
    await assert.rejects(
      readFile(path.join(targetRoot, "data", "snapshots", "fixture", "sentinel.json")),
      /ENOENT/,
      "the package must not duplicate immutable hosting snapshots"
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
      /wjni:status/
    );
    const background = await readFile(path.join(targetRoot, "background.js"), "utf8");
    assert.match(
      background,
      /https:\/\/ryankhart\.github\.io\/wabbajack-nexus-index/
    );
    assert.doesNotMatch(background, /\beval\(|\bFunction\(/);
    assert.match(await readFile(path.join(targetRoot, "popup.css"), "utf8"), /\.popup/);
    assert.match(
      await readFile(path.join(targetRoot, "wabbajack.js"), "utf8"),
      /data-wjni-link/
    );
    assert.match(
      await readFile(path.join(targetRoot, "wabbajack.css"), "utf8"),
      /\.wjni-archive-link/
    );
    const core = await readFile(path.join(targetRoot, "shared-core.js"), "utf8");
    assert.doesNotMatch(core, /export function/);
    assert.match(core, /globalThis\.WJNI/);
    const context = { URL };
    context.globalThis = context;
    vm.runInNewContext(core, context);
    assert.equal(
      typeof context.WJNI.createRetryableLoader,
      "function",
      "the built API must expose every helper used by nexusmods.js"
    );
    assert.equal(
      typeof context.WJNI.parseWabbajackArchiveSearchUrl,
      "function",
      "the built API must expose Wabbajack route parsing"
    );
    assert.equal(
      typeof context.WJNI.createNexusArchiveLinks,
      "function",
      "the built API must expose exact Nexus archive link projection"
    );
  }

  const firefox = JSON.parse(
    await readFile(path.join(output, "firefox", "manifest.json"))
  );
  assert.equal(
    firefox.browser_specific_settings.gecko.id,
    "wabbajack-nexus-index@ryankhart.com"
  );
  assert.equal(
    firefox.browser_specific_settings.gecko.strict_min_version,
    "142.0"
  );
  assert.deepEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] }
  );

  const [chromeFiles, firefoxFiles] = await Promise.all([
    readTree(path.join(output, "chrome")),
    readTree(path.join(output, "firefox")),
  ]);
  assert.deepEqual([...chromeFiles.keys()], [...firefoxFiles.keys()]);
  for (const [relativePath, chromeContents] of chromeFiles) {
    if (relativePath !== "manifest.json") {
      assert.deepEqual(chromeContents, firefoxFiles.get(relativePath), relativePath);
    }
  }
  const chrome = JSON.parse(chromeFiles.get("manifest.json"));
  const normalizedFirefox = JSON.parse(firefoxFiles.get("manifest.json"));
  delete chrome.background;
  delete normalizedFirefox.background;
  delete normalizedFirefox.browser_specific_settings;
  assert.deepEqual(chrome, normalizedFirefox);
});

test("canonical build packages versioned Chrome and Firefox release artifacts", async () => {
  const [packageJson, workflow] = await Promise.all([
    readFile(new URL("../../package.json", import.meta.url)).then(JSON.parse),
    readFile(new URL("../../.github/workflows/update-index.yml", import.meta.url), "utf8"),
  ]);

  assert.equal(
    packageJson.scripts.build,
    "node scripts/build-extension.mjs && python scripts/package_extensions.py"
  );
  assert.match(workflow, /artifacts\/wabbajack-nexus-index-chrome-v0\.1\.0\.zip/);
  assert.match(workflow, /artifacts\/wabbajack-nexus-index-firefox-v0\.1\.0\.xpi/);
});
