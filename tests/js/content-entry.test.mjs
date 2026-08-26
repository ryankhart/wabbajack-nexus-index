import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

import {
  bucketForMod,
  createListRows,
  createRetryableLoader,
  parseNexusModUrl,
} from "../../extension/src/core.mjs";

const contentPath = new URL("../../extension/src/content-entry.js", import.meta.url);

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = "";
    this.textContent = "";
    this.isConnected = false;
    this.hidden = false;
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    };
  }

  get childElementCount() {
    return this.children.length;
  }

  get previousElementSibling() {
    if (!this.parentElement) {
      return null;
    }
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  setAttributeNS(_namespace, name, value) {
    this.setAttribute(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener() {}

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
      if (this.isConnected) {
        this.ownerDocument.connect(child);
      }
    }
  }

  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
    if (this.isConnected) {
      this.ownerDocument.connect(child);
    }
  }

  insertAdjacentElement(_position, child) {
    if (!this.parentElement) {
      return;
    }
    const index = this.parentElement.children.indexOf(this);
    child.parentElement = this.parentElement;
    this.parentElement.children.splice(index + 1, 0, child);
    if (this.parentElement.isConnected) {
      this.ownerDocument.connect(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  querySelector(selector) {
    if (selector === "[data-role='body']") {
      return this.find((element) => element.dataset.role === "body");
    }
    return null;
  }

  find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) {
        return child;
      }
      const nested = child.find(predicate);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  closest(selector) {
    if (selector === "dd" && this.tagName === "DD") {
      return this;
    }
    if (selector === "dl.accordion" && this === this.ownerDocument.accordion) {
      return this;
    }
    if (selector === "dd" || selector === "dl.accordion") {
      return this.parentElement?.closest(selector) ?? null;
    }
    return null;
  }

  getBoundingClientRect() {
    return { width: 100, height: 100 };
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
        (child) => child !== this
      );
    }
    this.ownerDocument.disconnect(this);
    this.parentElement = null;
  }
}

class FakeDocument {
  constructor() {
    this.byId = new Map();
    this.connectedElements = new Set();
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.accordion = new FakeElement("dl", this);
    this.collectionsBody = new FakeElement("dd", this);
    this.collectionsHost = new FakeElement("collections-containing-mod", this);
    this.collectionsBody.append(this.collectionsHost);
    this.connect(this.documentElement);
    this.connect(this.body);
    this.connect(this.accordion);
    this.accordion.append(this.collectionsBody);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(_namespace, tagName) {
    return this.createElement(tagName);
  }

  getElementById(id) {
    return this.byId.get(id) ?? null;
  }

  querySelector(selector) {
    if (selector === "dl.accordion") {
      return this.accordion;
    }
    if (selector === "main") {
      return null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return [...this.connectedElements].filter((element) =>
        element.classes.has(className)
      );
    }
    if (selector === "collections-containing-mod") {
      return [this.collectionsHost];
    }
    return [];
  }

  connect(element) {
    element.isConnected = true;
    this.connectedElements.add(element);
    if (element.id) {
      this.byId.set(element.id, element);
    }
    for (const child of element.children) {
      this.connect(child);
    }
  }

  disconnect(element) {
    element.isConnected = false;
    this.connectedElements.delete(element);
    if (element.id) {
      this.byId.delete(element.id);
    }
    for (const child of element.children) {
      this.disconnect(child);
    }
  }
}

async function runContentScript(fetchFixture) {
  const source = await readFile(contentPath, "utf8");
  const document = new FakeDocument();
  const timers = [];
  const warnings = [];
  let mutationCallback;

  class FakeMutationObserver {
    constructor(callback) {
      mutationCallback = callback;
    }

    observe() {}
  }

  const context = {
    WJNI: {
      bucketForMod,
      createListRows,
      createRetryableLoader,
      parseNexusModUrl,
    },
    chrome: {
      runtime: {
        getURL: (path) => `extension://fixture/${path}`,
      },
    },
    console: {
      warn: (...args) => warnings.push(args),
    },
    document,
    fetch: async (url) => fetchFixture(url),
    location: {
      href: "https://www.nexusmods.com/skyrimspecialedition/mods/42",
    },
    MutationObserver: FakeMutationObserver,
    setInterval: () => 1,
    setTimeout: (callback) => {
      timers.push(callback);
      return timers.length;
    },
  };
  context.globalThis = context;

  vm.runInNewContext(source, context, { filename: "content-entry.js" });
  assert.equal(timers.length, 1, "initial render should be scheduled once");
  await timers.shift()();

  return {
    document,
    getPanel: () => document.getElementById("wjni-panel"),
    triggerMutation: () => mutationCallback(),
    timers,
    warnings,
  };
}

function jsonResponse(value) {
  return {
    ok: true,
    json: async () => value,
  };
}

test("omits the section and suppresses same-route remounts for a confirmed empty bucket", async () => {
  const page = await runContentScript(async (url) => {
    assert.match(url, /data\/index-meta\.json$/);
    return jsonResponse({
      bucketSize: 1000,
      buckets: { skyrimspecialedition: [] },
    });
  });

  assert.equal(page.getPanel(), null);
  assert.equal(
    page.document.collectionsBody.classes.has("wjni-collections-continues"),
    false,
    "removing the section must restore the Collections row's bottom corners"
  );
  page.triggerMutation();
  assert.equal(page.timers.length, 0, "same-route mutations must not remount an omitted panel");
  assert.equal(
    page.document.collectionsBody.classes.has("wjni-collections-continues"),
    false
  );
});

test("keeps the section visible when an advertised bucket cannot be read", async () => {
  const page = await runContentScript(async (url) => {
    if (url.endsWith("data/index-meta.json")) {
      return jsonResponse({
        bucketSize: 1000,
        buckets: { skyrimspecialedition: [0] },
      });
    }
    if (url.endsWith("data/modlists.json")) {
      return jsonResponse({});
    }
    return { ok: false, status: 404 };
  });

  const panel = page.getPanel();
  assert.ok(panel, "lookup failures must keep the Wabbajack section mounted");
  assert.equal(panel.querySelector("[data-role='body']").className, "wjni-body wjni-error");
  assert.equal(page.warnings.length, 1);
});
