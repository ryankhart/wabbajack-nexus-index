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
  assert.match(content, /chevron\.textContent = expanded \? "⌄" : "⌃"/);
  assert.match(content, /insertAdjacentElement\("afterend", panel\)/);
  assert.doesNotMatch(content, /createElement\("details"\)/);
  assert.doesNotMatch(content, /createElement\("summary"\)/);
  assert.match(css, /\.wjni-body\[hidden\]\s*\{[^}]*display:\s*none !important;/s);
});

test("mounts the Wabbajack body inside Nexus's native accordion list", async () => {
  const content = await readFile(contentPath, "utf8");

  assert.match(content, /body\.id = `\$\{PANEL_ID\}-body`/);
  assert.match(content, /document\.querySelector\("dl\.accordion"\)/);
  assert.match(content, /accordion\.append\(panel\)/);
});

test("shows four cards at full width without horizontal scrolling", async () => {
  const [content, css] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(content, /className = "wjni-card-icon"/);
  assert.match(content, /textContent = "W"/);
  assert.match(content, /className = "wjni-card-copy"/);
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

test("relocates an existing panel when the Collections anchor hydrates late", async () => {
  const content = await readFile(contentPath, "utf8");

  assert.match(content, /placePanel\(existing\);\s*}\s*return;/s);
  assert.match(
    content,
    /MutationObserver\([\s\S]*collectionsAnchor[\s\S]*previousElementSibling !== collectionsAnchor[\s\S]*scheduleRender\(\)/
  );
});
