(() => {
  "use strict";

  const api = globalThis.WJNI;
  const route = api?.parseWabbajackArchiveSearchUrl(location.href);
  if (!api || !route) {
    return;
  }

  let archivesByFilename = null;
  let scheduled = false;

  function sameArchive(left, right) {
    return (
      left.modName === right.modName &&
      left.links.modUrl === right.links.modUrl &&
      left.links.fileUrl === right.links.fileUrl
    );
  }

  function indexArchives(status) {
    const index = new Map();
    if (!Array.isArray(status?.Archives)) {
      return index;
    }
    for (const validatedArchive of status.Archives) {
      const archive = validatedArchive?.Original;
      if (!archive || typeof archive.Name !== "string") {
        continue;
      }
      const links = api.createNexusArchiveLinks(archive.State);
      if (!links) {
        continue;
      }
      const modName = typeof archive.State.Name === "string"
        ? archive.State.Name.trim()
        : "";
      const entry = { links, modName };
      if (!index.has(archive.Name)) {
        index.set(archive.Name, entry);
      } else if (
        index.get(archive.Name) &&
        !sameArchive(index.get(archive.Name), entry)
      ) {
        index.set(archive.Name, null);
      }
    }
    return index;
  }

  function replaceTextWithLink(element, url, kind) {
    const existing = element.querySelector("a[data-wjni-link]");
    if (
      existing &&
      existing.dataset.wjniLink === kind &&
      existing.getAttribute("href") === url
    ) {
      return;
    }
    const label = element.textContent;
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
    link.setAttribute("data-wjni-link", kind);
    link.className = "wjni-archive-link";
    link.textContent = label;
    element.replaceChildren(link);
  }

  function enhanceRenderedArchives() {
    scheduled = false;
    if (!archivesByFilename) {
      return;
    }
    for (const heading of document.querySelectorAll("h3")) {
      const entry = archivesByFilename.get(heading.textContent);
      if (!entry) {
        continue;
      }
      replaceTextWithLink(heading, entry.links.fileUrl, "file");
      if (!entry.modName || entry.modName === heading.textContent) {
        continue;
      }
      const modName = [...heading.parentElement.querySelectorAll("p")].find(
        (paragraph) => paragraph.textContent === entry.modName
      );
      if (modName) {
        replaceTextWithLink(modName, entry.links.modUrl, "mod");
      }
    }
  }

  function scheduleEnhancement() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    setTimeout(enhanceRenderedArchives, 0);
  }

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  fetch(route.statusUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Wabbajack status request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((status) => {
      archivesByFilename = indexArchives(status);
      enhanceRenderedArchives();
    })
    .catch((error) => {
      console.warn("Unofficial Wabbajack-Nexus Index archive links failed", error);
    });
})();
