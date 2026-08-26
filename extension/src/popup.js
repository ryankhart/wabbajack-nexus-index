(() => {
  "use strict";

  const freshness = document.getElementById("index-updated");
  const status = freshness.closest(".popup-status");

  async function showFreshness() {
    try {
      const response = await fetch("data/index-meta.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Bundled index request failed: ${response.status}`);
      }
      const metadata = await response.json();
      const generatedAt = metadata.generatedAt;
      const generatedDate = new Date(generatedAt);
      if (typeof generatedAt !== "string" || Number.isNaN(generatedDate.getTime())) {
        throw new Error("Bundled index metadata has no valid generation time");
      }

      freshness.dateTime = generatedAt;
      freshness.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(generatedDate);
      status.dataset.state = "ready";
    } catch (error) {
      console.warn("Unofficial Wabbajack-Nexus Index popup could not read metadata", error);
      freshness.removeAttribute("datetime");
      freshness.textContent = "Unable to read bundled index metadata";
      status.dataset.state = "error";
    }
  }

  showFreshness();
})();
