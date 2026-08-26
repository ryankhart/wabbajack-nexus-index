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
    name: "Wabbajack Nexus Index",
    version: "0.1.0",
    description:
      "Shows which Wabbajack modlists include the Nexus mod page you are viewing.",
    homepage_url: "https://www.wabbajack.org/",
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
        resources: ["data/*.json", "data/games/*/*.json"],
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
    requireFile(path.join(resolvedData, "index-meta.json")),
    requireFile(path.join(resolvedData, "modlists.json")),
  ]);

  const [core, content, css] = await Promise.all([
    readFile(path.join(resolvedSource, "core.mjs"), "utf8"),
    readFile(path.join(resolvedSource, "content-entry.js"), "utf8"),
    readFile(path.join(resolvedSource, "content.css"), "utf8"),
  ]);
  await rm(resolvedOutput, { recursive: true, force: true });

  for (const target of ["chrome", "firefox"]) {
    const targetRoot = path.join(resolvedOutput, target);
    await mkdir(targetRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(targetRoot, "core.global.js"), transformCore(core), "utf8"),
      writeFile(path.join(targetRoot, "content.js"), content, "utf8"),
      writeFile(path.join(targetRoot, "content.css"), css, "utf8"),
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
