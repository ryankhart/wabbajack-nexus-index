(() => {
  "use strict";

  const PANEL_ID = "wjni-panel";
  const COLLECTIONS_LABEL = "collections containing this mod";
  const runtime = globalThis.chrome?.runtime || globalThis.browser?.runtime;
  const api = globalThis.WJNI;
  let lastRoute = "";
  let renderGeneration = 0;
  let scheduled = false;
  let metadataPromise;
  let modlistsPromise;

  if (!runtime || !api) {
    return;
  }

  function normalizedText(element) {
    return (element.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function findCollectionsAnchor() {
    const candidates = document.querySelectorAll(
      "summary, button, h2, h3, h4, h5, [role='button']"
    );
    for (const candidate of candidates) {
      if (normalizedText(candidate) !== COLLECTIONS_LABEL) {
        continue;
      }
      const details = candidate.closest("details");
      if (details) {
        return details;
      }
      const interactive = candidate.closest("button, [role='button']") || candidate;
      const parent = interactive.parentElement;
      if (parent && parent.childElementCount <= 4) {
        return parent;
      }
      return interactive;
    }
    return null;
  }

  function findFallbackAnchor() {
    const candidates = document.querySelectorAll("h1, h2, h3, main section");
    for (const candidate of candidates) {
      if (normalizedText(candidate) === "about this mod") {
        return candidate.parentElement || candidate;
      }
    }
    return document.querySelector("main") || document.body;
  }

  function placePanel(panel) {
    const anchor = findCollectionsAnchor() || findFallbackAnchor();
    if (anchor === document.body || anchor.tagName === "MAIN") {
      anchor.prepend(panel);
    } else {
      anchor.insertAdjacentElement("afterend", panel);
    }
  }

  function makeLink(url, label, className) {
    const link = document.createElement("a");
    link.className = className;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "wjni-panel wjni-accordion-row";
    panel.setAttribute("aria-label", "Wabbajack modlist membership");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wjni-summary";
    button.setAttribute("aria-expanded", "true");
    const title = document.createElement("span");
    title.className = "wjni-summary-title";
    title.textContent = "Wabbajack modlists containing this mod";
    const chevron = document.createElement("span");
    chevron.className = "wjni-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌃";
    button.append(title, chevron);

    const body = document.createElement("div");
    body.id = `${PANEL_ID}-body`;
    body.className = "wjni-body";
    body.dataset.role = "body";
    body.setAttribute("aria-live", "polite");
    body.setAttribute("aria-busy", "true");
    body.textContent = "Looking up this mod in the bundled Wabbajack index…";
    button.setAttribute("aria-controls", body.id);
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      chevron.textContent = expanded ? "⌄" : "⌃";
      body.hidden = expanded;
    });

    panel.append(button, body);
    return panel;
  }

  function renderMessage(panel, message, kind = "message") {
    const body = panel.querySelector("[data-role='body']");
    body.className = `wjni-body wjni-${kind}`;
    body.setAttribute("aria-busy", "false");
    body.replaceChildren();
    const text = document.createElement("p");
    text.textContent = message;
    body.append(text);
  }

  function renderRows(panel, rows, generatedAt) {
    const body = panel.querySelector("[data-role='body']");
    body.className = "wjni-body";
    body.setAttribute("aria-busy", "false");
    body.replaceChildren();

    const intro = document.createElement("div");
    intro.className = "wjni-intro";
    const introHeading = document.createElement("div");
    introHeading.className = "wjni-intro-heading";
    const introIcon = document.createElement("span");
    introIcon.className = "wjni-intro-icon";
    introIcon.setAttribute("aria-hidden", "true");
    introIcon.textContent = "◆";
    const introText = document.createElement("strong");
    introText.textContent = `Included in ${rows.length} Wabbajack modlist${
      rows.length === 1 ? "" : "s"
    }`;
    introHeading.append(introIcon, introText);
    const freshness = document.createElement("span");
    freshness.textContent = generatedAt ? `Index updated ${generatedAt}` : "Bundled index";
    intro.append(introHeading, freshness);

    const grid = document.createElement("div");
    grid.className = "wjni-grid";
    for (const row of rows) {
      const card = document.createElement("article");
      card.className = "wjni-card";

      const icon = document.createElement("span");
      icon.className = "wjni-card-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "W";

      const copy = document.createElement("div");
      copy.className = "wjni-card-copy";

      const name = makeLink(
        row.wabbajackUrl || row.galleryUrl,
        row.title,
        "wjni-title"
      );
      name.setAttribute("aria-label", `${row.title} on the official Wabbajack site`);

      const facts = document.createElement("div");
      facts.className = "wjni-facts";
      const modCount = document.createElement("span");
      modCount.className = "wjni-mod-count";
      modCount.textContent = `${row.modCount.toLocaleString()} mods`;
      modCount.title = "Unique Nexus mod pages indexed from the current Wabbajack manifest";
      const separator = document.createElement("span");
      separator.className = "wjni-separator";
      separator.textContent = "•";
      const classification = document.createElement("span");
      classification.className = "wjni-classification";
      classification.textContent = row.classification;
      classification.setAttribute(
        "aria-label",
        `Wabbajack classification: ${row.classification}`
      );
      facts.append(modCount, separator, classification);
      copy.append(name, facts);
      card.append(icon, copy);
      grid.append(card);
    }
    body.append(intro, grid);
  }

  async function fetchJson(relativePath) {
    const response = await fetch(runtime.getURL(relativePath), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Bundled index request failed: ${response.status}`);
    }
    return response.json();
  }

  async function lookup(identity) {
    metadataPromise ||= fetchJson("data/index-meta.json");
    modlistsPromise ||= fetchJson("data/modlists.json");
    const metadata = await metadataPromise;
    const bucketSize = metadata.bucketSize;
    const bucket = api.bucketForMod(identity.modId, bucketSize);
    const availableBuckets = metadata.buckets?.[identity.gameDomain] || [];
    if (!availableBuckets.includes(bucket)) {
      return { rows: [], generatedAt: metadata.generatedAt || "" };
    }
    const [modlists, lookupBucket] = await Promise.all([
      modlistsPromise,
      fetchJson(`data/games/${identity.gameDomain}/${bucket}.json`),
    ]);
    const stableIds = lookupBucket.mods?.[String(identity.modId)] || [];
    return {
      rows: api.createListRows(stableIds, modlists),
      generatedAt: metadata.generatedAt || "",
    };
  }

  async function renderCurrentPage() {
    scheduled = false;
    const identity = api.parseNexusModUrl(location.href);
    const existing = document.getElementById(PANEL_ID);
    if (!identity) {
      existing?.remove();
      return;
    }
    const route = `${identity.gameDomain}:${identity.modId}`;
    if (existing && existing.dataset.route === route) {
      if (!findCollectionsAnchor() || existing.previousElementSibling === findCollectionsAnchor()) {
        return;
      }
    }

    renderGeneration += 1;
    const generation = renderGeneration;
    existing?.remove();
    const panel = createPanel();
    panel.dataset.route = route;
    placePanel(panel);
    try {
      const result = await lookup(identity);
      if (generation !== renderGeneration || !panel.isConnected) {
        return;
      }
      if (result.rows.length === 0) {
        renderMessage(
          panel,
          "No indexed Wabbajack modlist currently includes this Nexus mod.",
          "empty"
        );
      } else {
        renderRows(panel, result.rows, result.generatedAt);
      }
    } catch (error) {
      if (generation === renderGeneration && panel.isConnected) {
        console.warn("Wabbajack Nexus Index lookup failed", error);
        renderMessage(
          panel,
          "The bundled Wabbajack index could not be read. Reload the page or update the extension.",
          "error"
        );
      }
    }
  }

  function scheduleRender() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    setTimeout(renderCurrentPage, 50);
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(PANEL_ID) && api.parseNexusModUrl(location.href)) {
      scheduleRender();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  lastRoute = location.href;
  setInterval(() => {
    if (location.href !== lastRoute) {
      lastRoute = location.href;
      scheduleRender();
    }
  }, 750);
  scheduleRender();
})();
