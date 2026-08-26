import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

import {
  createNexusArchiveLinks,
  parseWabbajackArchiveSearchUrl,
} from "../../extension/src/shared-core.mjs";

const contentPath = new URL(
  "../../extension/src/wabbajack-entry.js",
  import.meta.url
);

class FakeElement {
  constructor(tagName, text = "") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this._textContent = text;
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map((child) => child.textContent).join("");
    }
    return this._textContent;
  }

  set textContent(value) {
    this.children = [];
    this._textContent = String(value);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(...children) {
    this._textContent = "";
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this._textContent = "";
    this.append(...children);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (
          selector === child.tagName.toLowerCase() ||
          (selector === "a[data-wjni-link]" &&
            child.tagName === "A" &&
            child.dataset.wjniLink)
        ) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

class FakeDocument {
  constructor(cards) {
    this.documentElement = new FakeElement("html");
    this.body = new FakeElement("body");
    this.documentElement.append(this.body);
    this.body.append(...cards);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

function archiveCard(filename, modName) {
  const card = new FakeElement("div");
  const content = new FakeElement("div");
  const heading = new FakeElement("h3", filename);
  const mod = new FakeElement("p", modName);
  content.append(heading, mod);
  card.append(content);
  return { card, heading, mod };
}

async function runContentScript({ cards, status }) {
  const source = await readFile(contentPath, "utf8");
  const document = new FakeDocument(cards.map(({ card }) => card));
  const timers = [];
  const requests = [];
  const warnings = [];
  let mutationCallback;

  class FakeMutationObserver {
    constructor(callback) {
      mutationCallback = callback;
    }

    observe() {}
  }

  const context = {
    URL,
    WJNI: {
      createNexusArchiveLinks,
      parseWabbajackArchiveSearchUrl,
    },
    console: {
      warn: (...args) => warnings.push(args),
    },
    document,
    fetch: async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => status,
      };
    },
    location: {
      href: "https://www.wabbajack.org/search/wj-featured/tpf",
    },
    MutationObserver: FakeMutationObserver,
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
  };
  context.globalThis = context;

  vm.runInNewContext(source, context, { filename: "wabbajack-entry.js" });
  await new Promise((resolve) => setImmediate(resolve));

  return {
    document,
    requests,
    warnings,
    triggerMutation: () => mutationCallback(),
    timers,
  };
}

test("links an exact Nexus archive filename and displayed mod name idempotently", async () => {
  const eligible = archiveCard(
    "A Lovely Letter Alternate Routes-21916-1-0-1544983389.zip",
    "A Lovely Letter Alternate Routes"
  );
  const page = await runContentScript({
    cards: [eligible],
    status: {
      Archives: [
        {
          Original: {
            Name: eligible.heading.textContent,
            State: {
              $type: "NexusDownloader, Wabbajack.Lib",
              GameName: "SkyrimSpecialEdition",
              ModID: 21916,
              FileID: 75329,
              Name: eligible.mod.textContent,
            },
          },
        },
      ],
    },
  });

  assert.deepEqual(page.requests, [
    "https://raw.githubusercontent.com/wabbajack-tools/mod-lists/master/reports/wj-featured/tpf/status.json",
  ]);
  const filenameLink = eligible.heading.querySelector("a[data-wjni-link]");
  const modLink = eligible.mod.querySelector("a[data-wjni-link]");
  assert.equal(
    filenameLink.getAttribute("href"),
    "https://www.nexusmods.com/skyrimspecialedition/mods/21916?tab=files&file_id=75329"
  );
  assert.equal(
    modLink.getAttribute("href"),
    "https://www.nexusmods.com/skyrimspecialedition/mods/21916"
  );
  for (const link of [filenameLink, modLink]) {
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener noreferrer");
  }

  page.triggerMutation();
  while (page.timers.length > 0) {
    page.timers.shift()();
  }
  assert.equal(eligible.heading.querySelectorAll("a[data-wjni-link]").length, 1);
  assert.equal(eligible.mod.querySelectorAll("a[data-wjni-link]").length, 1);
  assert.deepEqual(page.warnings, []);
});

test("leaves ambiguous duplicate archive filenames unlinked without failing", async () => {
  const ambiguous = archiveCard("Duplicate.zip", "Duplicate Mod");
  const archive = (modId, fileId) => ({
    Original: {
      Name: "Duplicate.zip",
      State: {
        $type: "NexusDownloader, Wabbajack.Lib",
        GameName: "SkyrimSpecialEdition",
        ModID: modId,
        FileID: fileId,
        Name: "Duplicate Mod",
      },
    },
  });
  const page = await runContentScript({
    cards: [ambiguous],
    status: {
      Archives: [archive(42, 100), archive(43, 101), archive(44, 102)],
    },
  });

  assert.equal(ambiguous.heading.querySelector("a[data-wjni-link]"), null);
  assert.equal(ambiguous.mod.querySelector("a[data-wjni-link]"), null);
  assert.deepEqual(page.warnings, []);
});
