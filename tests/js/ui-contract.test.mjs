import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contentPath = new URL("../../extension/src/content-entry.js", import.meta.url);
const cssPath = new URL("../../extension/src/content.css", import.meta.url);

test("mounts a Nexus-native sibling accordion row with an accessible button", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(content, /className = "wjni-panel wjni-accordion-row"/);
  assert.match(content, /createElement\("button"\)/);
  assert.match(content, /button\.type = "button"/);
  assert.match(content, /setAttribute\("aria-expanded", "true"\)/);
  assert.match(content, /setAttribute\("aria-controls", body\.id\)/);
  assert.match(content, /createElementNS\(SVG_NAMESPACE, "svg"\)/);
  assert.match(content, /className = "wjni-chevron acc-status"/);
  assert.match(content, /setAttribute\("class", "icon icon-arrow"\)/);
  assert.match(content, /setAttribute\("href", "\/assets\/images\/icons\/icons\.svg#icon-arrow"\)/);
  assert.match(content, /button\.classList\.toggle\("accopen", !expanded\)/);
  assert.doesNotMatch(content, /chevron\.textContent/);
  assert.match(content, /insertAdjacentElement\("afterend", panel\)/);
  assert.doesNotMatch(content, /createElement\("details"\)/);
  assert.doesNotMatch(content, /createElement\("summary"\)/);
  assert.match(css, /\.wjni-body\[hidden\]\s*\{[^}]*display:\s*none !important;/s);
  assert.match(css, /\.wjni-chevron\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;/s);
  assert.match(
    css,
    /\.wjni-chevron \.icon-arrow\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*width:\s*10px;[^}]*height:\s*7px;[^}]*fill:\s*#fff;[^}]*transform:\s*translate\(-50%, -50%\) rotate\(180deg\);/s
  );
  assert.match(
    css,
    /\.wjni-summary\[aria-expanded="false"\] \.wjni-chevron \.icon-arrow\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s
  );
});

test("mounts the Wabbajack body inside Nexus's native accordion list", async () => {
  const content = await readFile(contentPath, "utf8");

  assert.match(content, /body\.id = `\$\{PANEL_ID\}-body`/);
  assert.match(content, /document\.querySelector\("dl\.accordion"\)/);
  assert.match(content, /accordion\.append\(panel\)/);
});

test("shows four wide artwork cards at full width without horizontal scrolling", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(content, /"wjni-card-artwork"/);
  assert.match(content, /className = "wjni-card-image"/);
  assert.match(content, /image\.src = row\.imageUrl/);
  assert.match(content, /image\.loading = "lazy"/);
  assert.match(content, /className = "wjni-title-overlay"/);
  assert.match(content, /className = "wjni-card-footer"/);
  assert.match(content, /const PREVIEW_LIMIT = 4/);
  assert.match(css, /\.wjni-grid\s*\{[^}]*display:\s*grid;/s);
  assert.match(
    css,
    /\.wjni-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s
  );
  assert.doesNotMatch(css, /\.wjni-grid\s*\{[^}]*overflow-x:\s*auto;/s);
});

test("View all expands every card and Collapse restores the four-card preview", async () => {
  const content = await readFile(contentPath, "utf8");

  assert.match(content, /viewToggle\.textContent = "View all"/);
  assert.match(content, /viewToggle\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(content, /viewToggle\.setAttribute\("aria-controls", grid\.id\)/);
  assert.match(content, /expanded \? rows : rows\.slice\(0, PREVIEW_LIMIT\)/);
  assert.match(content, /viewToggle\.textContent = expanded \? "Collapse" : "View all"/);
});

test("matches Nexus collection cards and only labels adult modlists", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(content, /if \(row\.classification === "NSFW"\)/);
  assert.match(content, /classification\.textContent = "Adult"/);
  assert.match(content, /facts\.append\(classification\)/);
  assert.doesNotMatch(content, /classification\.textContent = row\.classification/);
  assert.doesNotMatch(content, /className = "wjni-separator"/);
  assert.match(
    css,
    /\.wjni-card\s*\{[^}]*overflow:\s*hidden;[^}]*background:\s*var\(--wjni-surface-translucent-mid\);[^}]*border:\s*0;[^}]*border-radius:\s*4px;/s
  );
  assert.match(
    css,
    /\.wjni-card-artwork\s*\{[^}]*position:\s*relative;[^}]*aspect-ratio:\s*16 \/ 9;[^}]*overflow:\s*hidden;/s
  );
  assert.match(
    css,
    /\.wjni-card-image\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/s
  );
  assert.match(
    css,
    /\.wjni-title-overlay\s*\{[^}]*position:\s*absolute;[^}]*left:\s*0;[^}]*bottom:\s*0;[^}]*width:\s*100%;[^}]*padding:/s
  );
  assert.match(
    css,
    /\.wjni-card-footer\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*padding:/s
  );
  assert.match(
    css,
    /\.wjni-classification\s*\{[^}]*color:\s*var\(--wjni-danger-strong\);[^}]*font-size:\s*12px;[^}]*font-weight:\s*300;[^}]*line-height:\s*16px;[^}]*letter-spacing:\s*0\.3px;/s
  );
});

test("uses the bundled Wabbajack logo beside the inclusion heading", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(content, /introIcon = document\.createElement\("img"\)/);
  assert.match(
    content,
    /introIcon\.src = runtime\.getURL\("assets\/wabbajack-transparent\.webp"\)/
  );
  assert.doesNotMatch(content, /introIcon\.textContent = "◆"/);
  assert.match(
    css,
    /\.wjni-intro-icon\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;[^}]*filter:\s*grayscale\(1\) invert\(1\) brightness\(0\.55\) contrast\(1\.2\);/s
  );
});

test("uses Nexus translucent surfaces with color-mix fallbacks", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--wjni-surface-translucent-low:\s*#ffffff0d;/);
  assert.match(css, /--wjni-surface-translucent-mid:\s*#ffffff1a;/);
  assert.match(
    css,
    /@supports \(color:\s*color-mix\(in lab, red, red\)\)\s*\{[^}]*--wjni-surface-translucent-low:\s*color-mix\(in oklab, var\(--color-white, #fff\) 5%, transparent\);/s
  );
  assert.match(
    css,
    /@supports \(color:\s*color-mix\(in lab, red, red\)\)\s*\{[^}]*--wjni-surface-translucent-mid:\s*color-mix\(in oklab, var\(--color-white, #fff\) 10%, transparent\);/s
  );
  assert.match(css, /\.wjni-body\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.1\);/s);
  assert.match(
    css,
    /\.wjni-collection-shell\s*\{[^}]*background:\s*var\(--wjni-surface-translucent-low\);/s
  );
});

test("copies the native Nexus accordion layer hierarchy and bottom spacing", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(
    css,
    /\.wjni-accordion-row\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;/s
  );
  assert.match(
    css,
    /\.wjni-summary\s*\{[^}]*padding:\s*12px;[^}]*margin-bottom:\s*1px;[^}]*background:\s*rgba\(255, 255, 255, 0\.05\);/s
  );
  assert.match(
    css,
    /\.wjni-body\s*\{[^}]*margin-bottom:\s*1px;[^}]*padding:\s*20px 20px 0;[^}]*background:\s*rgba\(255, 255, 255, 0\.1\);/s
  );
  assert.match(css, /\.wjni-body\s*\{[^}]*display:\s*flow-root;/s);
  assert.match(
    css,
    /\.wjni-collection-shell\s*\{[^}]*margin-bottom:\s*20px;[^}]*padding:\s*12px;[^}]*background:\s*var\(--wjni-surface-translucent-low\);/s
  );
});

test("squares the native Collections bottom corners only while Wabbajack follows it", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(
    content,
    /const COLLECTIONS_CONTINUATION_CLASS = "wjni-collections-continues"/
  );
  assert.match(
    content,
    /collectionsBody\.classList\.add\(COLLECTIONS_CONTINUATION_CLASS\)/
  );
  assert.match(
    content,
    /element\.classList\.remove\(COLLECTIONS_CONTINUATION_CLASS\)/
  );
  assert.match(
    css,
    /\.wjni-collections-continues\s*\{[^}]*border-bottom-left-radius:\s*0 !important;[^}]*border-bottom-right-radius:\s*0 !important;/s
  );
});

test("relocates an existing panel when the Collections anchor hydrates late", async () => {
  const content = await readFile(contentPath, "utf8");

  assert.match(content, /placePanel\(existing\)/);
  assert.match(content, /syncCollectionsContinuation\(existing\)/);
  assert.match(
    content,
    /MutationObserver\([\s\S]*collectionsAnchor[\s\S]*previousElementSibling !== collectionsAnchor[\s\S]*scheduleRender\(\)/
  );
});
