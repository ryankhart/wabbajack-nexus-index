const NEXUS_HOSTS = new Set([
  "www.nexusmods.com",
  "next.nexusmods.com",
]);
const CLASSIFICATIONS = new Set(["SFW", "NSFW", "UNKNOWN"]);

export function parseNexusModUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !NEXUS_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  const match = url.pathname.match(/^\/([a-z0-9-]+)\/mods\/([1-9][0-9]*)\/?$/i);
  if (!match) {
    return null;
  }
  const modId = Number(match[2]);
  if (!Number.isSafeInteger(modId)) {
    return null;
  }
  return { gameDomain: match[1].toLowerCase(), modId };
}

export function bucketForMod(modId, bucketSize) {
  if (!Number.isSafeInteger(modId) || modId < 0) {
    throw new TypeError("modId must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(bucketSize) || bucketSize <= 0) {
    throw new TypeError("bucketSize must be a positive safe integer");
  }
  return Math.floor(modId / bucketSize);
}

export function createRetryableLoader(load) {
  if (typeof load !== "function") {
    throw new TypeError("load must be a function");
  }
  let pending;
  return () => {
    pending ||= Promise.resolve()
      .then(load)
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    return pending;
  };
}

function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function createListRows(stableIds, modlists) {
  if (!Array.isArray(stableIds) || !modlists || typeof modlists !== "object") {
    return [];
  }
  const rows = [];
  for (const stableId of stableIds) {
    const item = modlists[stableId];
    if (!item || item.status !== "indexed") {
      continue;
    }
    const title = typeof item.title === "string" && item.title.trim()
      ? item.title.trim()
      : String(stableId);
    const modCount = Number.isSafeInteger(item.nexusModCount) && item.nexusModCount >= 0
      ? item.nexusModCount
      : 0;
    const classification = CLASSIFICATIONS.has(item.classification)
      ? item.classification
      : "UNKNOWN";
    rows.push({
      stableId: String(stableId),
      title,
      modCount,
      classification,
      wabbajackUrl: safeHttpsUrl(item.wabbajackUrl),
      galleryUrl: safeHttpsUrl(item.galleryUrl),
      readmeUrl: safeHttpsUrl(item.readmeUrl),
    });
  }
  rows.sort((left, right) =>
    left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) ||
    left.stableId.localeCompare(right.stableId)
  );
  return rows;
}
