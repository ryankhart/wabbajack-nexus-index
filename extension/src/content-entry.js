(() => {
  "use strict";

  const PANEL_ID = "wjni-panel";
  const PREVIEW_LIMIT = 4;
  const COLLECTIONS_LABEL = "collections containing this mod";
  const COLLECTIONS_CONTINUATION_CLASS = "wjni-collections-continues";
  const runtime = globalThis.chrome?.runtime || globalThis.browser?.runtime;
  const api = globalThis.WJNI;
  let lastRoute = "";
  let renderGeneration = 0;
  let scheduled = false;

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

  function findAccordionList() {
    return document.querySelector("dl.accordion");
  }

  function findCollectionsBody() {
    let fallback = null;
    for (const host of document.querySelectorAll("collections-containing-mod")) {
      const body = host.closest("dd");
      if (!body) {
        continue;
      }
      fallback ||= body;
      const bounds = body.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        return body;
      }
    }
    return fallback || findCollectionsAnchor()?.closest("dd") || null;
  }

  function clearCollectionsContinuation() {
    for (const element of document.querySelectorAll(`.${COLLECTIONS_CONTINUATION_CLASS}`)) {
      element.classList.remove(COLLECTIONS_CONTINUATION_CLASS);
    }
  }

  function syncCollectionsContinuation(panel) {
    const collectionsBody = findCollectionsBody();
    clearCollectionsContinuation();
    if (collectionsBody && panel.previousElementSibling === collectionsBody) {
      collectionsBody.classList.add(COLLECTIONS_CONTINUATION_CLASS);
    }
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
    const collectionsBody = findCollectionsBody();
    const accordion = collectionsBody?.closest("dl.accordion") || findAccordionList();
    if (accordion) {
      if (collectionsBody?.parentElement === accordion) {
        collectionsBody.insertAdjacentElement("afterend", panel);
      } else {
        accordion.append(panel);
      }
      syncCollectionsContinuation(panel);
      return;
    }
    const anchor = findCollectionsAnchor() || findFallbackAnchor();
    if (anchor === document.body || anchor.tagName === "MAIN") {
      anchor.prepend(panel);
    } else {
      anchor.insertAdjacentElement("afterend", panel);
    }
    syncCollectionsContinuation(panel);
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
    const introIcon = document.createElement("img");
    introIcon.className = "wjni-intro-icon";
    introIcon.src = runtime.getURL("assets/wabbajack-transparent.webp");
    introIcon.alt = "";
    introIcon.setAttribute("aria-hidden", "true");
    const introText = document.createElement("strong");
    introText.textContent = `Included in ${rows.length} Wabbajack modlist${
      rows.length === 1 ? "" : "s"
    }`;
    introHeading.append(introIcon, introText);
    const introActions = document.createElement("div");
    introActions.className = "wjni-intro-actions";
    const freshness = document.createElement("span");
    freshness.className = "wjni-freshness";
    freshness.textContent = generatedAt ? `Index updated ${generatedAt}` : "Bundled index";

    const grid = document.createElement("div");
    grid.id = `${PANEL_ID}-grid`;
    grid.className = "wjni-grid";
    const collectionShell = document.createElement("div");
    collectionShell.className = "wjni-collection-shell";

    function createCard(row) {
      const card = document.createElement("article");
      card.className = "wjni-card";

      const artwork = makeLink(
        row.wabbajackUrl || row.galleryUrl,
        "",
        "wjni-card-artwork"
      );
      artwork.setAttribute("aria-label", `${row.title} on the official Wabbajack site`);
      if (row.imageUrl) {
        const image = document.createElement("img");
        image.className = "wjni-card-image";
        image.src = row.imageUrl;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
          image.remove();
          card.classList.add("wjni-image-missing");
        });
        artwork.append(image);
      } else {
        card.classList.add("wjni-image-missing");
      }

      const titleOverlay = document.createElement("span");
      titleOverlay.className = "wjni-title-overlay";
      titleOverlay.textContent = row.title;
      artwork.append(titleOverlay);

      const footer = document.createElement("div");
      footer.className = "wjni-card-footer";
      const facts = document.createElement("div");
      facts.className = "wjni-facts";
      const modCount = document.createElement("span");
      modCount.className = "wjni-mod-count";
      modCount.textContent = `${row.modCount.toLocaleString()} mods`;
      modCount.title = "Unique Nexus mod pages indexed from the current Wabbajack manifest";
      facts.append(modCount);
      if (row.classification === "NSFW") {
        const classification = document.createElement("span");
        classification.className = "wjni-classification";
        classification.textContent = "Adult";
        classification.setAttribute("aria-label", "Adult Wabbajack modlist");
        facts.append(classification);
      }
      footer.append(facts);
      card.append(artwork, footer);
      return card;
    }

    function renderCards(expanded) {
      const visibleRows = expanded ? rows : rows.slice(0, PREVIEW_LIMIT);
      grid.replaceChildren(...visibleRows.map(createCard));
    }

    if (rows.length > PREVIEW_LIMIT) {
      const viewToggle = document.createElement("button");
      viewToggle.type = "button";
      viewToggle.className = "wjni-view-toggle";
      viewToggle.textContent = "View all";
      viewToggle.setAttribute("aria-expanded", "false");
      viewToggle.setAttribute("aria-controls", grid.id);
      viewToggle.addEventListener("click", () => {
        const expanded = viewToggle.getAttribute("aria-expanded") !== "true";
        viewToggle.setAttribute("aria-expanded", String(expanded));
        viewToggle.textContent = expanded ? "Collapse" : "View all";
        renderCards(expanded);
      });
      introActions.append(viewToggle);
    }

    introActions.append(freshness);
    intro.append(introHeading, introActions);
    renderCards(false);
    collectionShell.append(intro, grid);
    body.append(collectionShell);
  }

  async function fetchJson(relativePath) {
    const response = await fetch(runtime.getURL(relativePath), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Bundled index request failed: ${response.status}`);
    }
    return response.json();
  }

  const loadMetadata = api.createRetryableLoader(() => fetchJson("data/index-meta.json"));
  const loadModlists = api.createRetryableLoader(() => fetchJson("data/modlists.json"));

  async function lookup(identity) {
    const metadata = await loadMetadata();
    const bucketSize = metadata.bucketSize;
    const bucket = api.bucketForMod(identity.modId, bucketSize);
    const availableBuckets = metadata.buckets?.[identity.gameDomain] || [];
    if (!availableBuckets.includes(bucket)) {
      return { rows: [], generatedAt: metadata.generatedAt || "" };
    }
    const [modlists, lookupBucket] = await Promise.all([
      loadModlists(),
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
      clearCollectionsContinuation();
      return;
    }
    const route = `${identity.gameDomain}:${identity.modId}`;
    if (existing && existing.dataset.route === route) {
      const accordion = findAccordionList();
      const collectionsBody = findCollectionsBody();
      const collectionsAnchor = findCollectionsAnchor();
      if (
        (collectionsBody && existing.previousElementSibling !== collectionsBody) ||
        (!collectionsBody && accordion && existing.parentElement !== accordion) ||
        (!accordion && collectionsAnchor && existing.previousElementSibling !== collectionsAnchor)
      ) {
        placePanel(existing);
      } else {
        syncCollectionsContinuation(existing);
      }
      return;
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
    const identity = api.parseNexusModUrl(location.href);
    if (!identity) {
      return;
    }
    const panel = document.getElementById(PANEL_ID);
    const accordion = findAccordionList();
    const collectionsBody = findCollectionsBody();
    const collectionsAnchor = findCollectionsAnchor();
    if (
      !panel ||
      (collectionsBody && panel.previousElementSibling !== collectionsBody) ||
      (!collectionsBody && accordion && panel.parentElement !== accordion) ||
      (!accordion && collectionsAnchor && panel.previousElementSibling !== collectionsAnchor)
    ) {
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
