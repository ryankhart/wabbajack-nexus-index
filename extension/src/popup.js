(() => {
  "use strict";

  const freshness = document.getElementById("index-updated");
  const source = document.getElementById("index-source");
  const status = freshness.closest(".popup-status");
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;

  function requestStatus() {
    const message = { type: "wjni:status" };
    if (globalThis.browser?.runtime?.sendMessage) {
      return globalThis.browser.runtime.sendMessage(message);
    }
    return new Promise((resolve, reject) => {
      runtime.sendMessage(message, (response) => {
        if (runtime.lastError) {
          reject(new Error(runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async function showFreshness() {
    try {
      const response = await requestStatus();
      if (!response?.ok) {
        throw new Error(response?.error || "Index status request failed");
      }
      const sourceLabel = {
        remote: "GitHub Pages",
        bundled: "Bundled fallback",
      }[response.source];
      if (!sourceLabel) {
        throw new Error("Index status has an unknown source");
      }
      const generatedAt = response.generatedAt;
      const generatedDate = new Date(generatedAt);
      if (typeof generatedAt !== "string" || Number.isNaN(generatedDate.getTime())) {
        throw new Error("Index metadata has no valid generation time");
      }

      source.textContent = sourceLabel;
      freshness.dateTime = generatedAt;
      freshness.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(generatedDate);
      status.dataset.state = "ready";
    } catch (error) {
      console.warn("Unofficial Wabbajack-Nexus Index popup could not read metadata", error);
      source.textContent = "Unavailable";
      freshness.removeAttribute("datetime");
      freshness.textContent = "Unable to read index metadata";
      status.dataset.state = "error";
    }
  }

  showFreshness();
})();
