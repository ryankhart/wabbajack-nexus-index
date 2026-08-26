import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const popupHtmlPath = new URL("../../extension/src/popup.html", import.meta.url);
const popupJsPath = new URL("../../extension/src/popup.js", import.meta.url);
const popupCssPath = new URL("../../extension/src/popup.css", import.meta.url);

test("shows bundled index freshness only in the toolbar popup", async () => {
  const [html, script, css] = await Promise.all([
    readFile(popupHtmlPath, "utf8"),
    readFile(popupJsPath, "utf8"),
    readFile(popupCssPath, "utf8"),
  ]);

  assert.match(html, /<link rel="stylesheet" href="popup\.css">/);
  assert.match(html, /<script src="popup\.js" defer><\/script>/);
  assert.match(html, /<main class="popup"/);
  assert.match(html, /<time id="index-updated"/);
  assert.match(html, /role="status"/);

  assert.match(script, /fetch\("data\/index-meta\.json", \{ cache: "no-store" \}\)/);
  assert.match(script, /metadata\.generatedAt/);
  assert.match(script, /freshness\.dateTime = generatedAt/);
  assert.match(script, /Intl\.DateTimeFormat/);
  assert.match(script, /Unable to read bundled index metadata/);

  assert.match(css, /\.popup\s*\{/);
  assert.match(css, /@media \(prefers-color-scheme: light\)/);
});
