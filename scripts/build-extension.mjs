import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_MATCHES = [
  "https://www.nexusmods.com/*/mods/*",
  "https://next.nexusmods.com/*/mods/*",
];

function manifestFor(target) {
  const manifest = {
    manifest_version: 3,
    name: "Unofficial Wabbajack-Nexus Index",
    version: "0.1.0",
    description:
      "Unofficial, independent index of Wabbajack modlists for Nexus Mods pages; not affiliated with Wabbajack or Nexus Mods.",
    homepage_url: "https://github.com/ryankhart/wabbajack-nexus-index",
    icons: {
      16: "assets/icon-16.png",
      32: "assets/icon-32.png",
      48: "assets/icon-48.png",
      128: "assets/icon-128.png",
    },
    action: {
      default_icon: {
        16: "assets/icon-16.png",
        32: "assets/icon-32.png",
      },
      default_popup: "popup.html",
      default_title: "Unofficial Wabbajack-Nexus Index",
    },
    content_scripts: [
      {
        matches: CONTENT_MATCHES,
        js: ["core.global.js", "content.js"],
        css: ["content.css"],
        run_at: "document_idle",
      },
    ],
    web_accessible_resources: [
      {
        resources: ["assets/*.png", "data/*.json", "data/games/*/*.json"],
        matches: CONTENT_MATCHES,
      },
    ],
  };
  if (target === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: "wabbajack-nexus-index@local",
        strict_min_version: "109.0",
      },
    };
  }
  return manifest;
}

async function requireFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Required file is not regular: ${filePath}`);
  }
}

function transformCore(source) {
  const script = source.replace(/^export\s+/gm, "");
  return `${script}\n\nglobalThis.WJNI = Object.freeze({\n  parseNexusModUrl,\n  bucketForMod,\n  createRetryableLoader,\n  createListRows,\n});\n`;
}

export async function buildExtension({ sourceDir, dataDir, outputRoot }) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedData = path.resolve(dataDir);
  const resolvedOutput = path.resolve(outputRoot);
  await Promise.all([
    requireFile(path.join(resolvedSource, "core.mjs")),
    requireFile(path.join(resolvedSource, "content-entry.js")),
    requireFile(path.join(resolvedSource, "content.css")),
    requireFile(path.join(resolvedSource, "popup.html")),
    requireFile(path.join(resolvedSource, "popup.js")),
    requireFile(path.join(resolvedSource, "popup.css")),
    ...[16, 32, 48, 128].map((size) =>
      requireFile(path.join(resolvedSource, "assets", `icon-${size}.png`))
    ),
    requireFile(path.join(resolvedData, "index-meta.json")),
    requireFile(path.join(resolvedData, "modlists.json")),
  ]);

  const [core, content, css, popupHtml, popupScript, popupCss] = await Promise.all([
    readFile(path.join(resolvedSource, "core.mjs"), "utf8"),
    readFile(path.join(resolvedSource, "content-entry.js"), "utf8"),
    readFile(path.join(resolvedSource, "content.css"), "utf8"),
    readFile(path.join(resolvedSource, "popup.html"), "utf8"),
    readFile(path.join(resolvedSource, "popup.js"), "utf8"),
    readFile(path.join(resolvedSource, "popup.css"), "utf8"),
  ]);
  await rm(resolvedOutput, { recursive: true, force: true });

  for (const target of ["chrome", "firefox"]) {
    const targetRoot = path.join(resolvedOutput, target);
    await mkdir(targetRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(targetRoot, "core.global.js"), transformCore(core), "utf8"),
      writeFile(path.join(targetRoot, "content.js"), content, "utf8"),
      writeFile(path.join(targetRoot, "content.css"), css, "utf8"),
      writeFile(path.join(targetRoot, "popup.html"), popupHtml, "utf8"),
      writeFile(path.join(targetRoot, "popup.js"), popupScript, "utf8"),
      writeFile(path.join(targetRoot, "popup.css"), popupCss, "utf8"),
      cp(path.join(resolvedSource, "assets"), path.join(targetRoot, "assets"), {
        recursive: true,
      }),
      writeFile(
        path.join(targetRoot, "manifest.json"),
        `${JSON.stringify(manifestFor(target), null, 2)}\n`,
        "utf8"
      ),
      cp(resolvedData, path.join(targetRoot, "data"), { recursive: true }),
    ]);
  }
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const root = path.resolve(path.dirname(modulePath), "..");
  await buildExtension({
    sourceDir: path.join(root, "extension", "src"),
    dataDir: path.join(root, "data", "generated", "public"),
    outputRoot: path.join(root, "dist"),
  });
  console.log(`Built Chrome and Firefox extensions in ${path.join(root, "dist")}`);
}
