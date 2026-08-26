const NEXUS_HOSTS = new Set([
  "www.nexusmods.com",
  "next.nexusmods.com",
]);
const CLASSIFICATIONS = new Set(["SFW", "NSFW", "UNKNOWN"]);
const WABBAJACK_NEXUS_DOMAINS = Object.freeze({
  Morrowind: "morrowind",
  Oblivion: "oblivion",
  Fallout3: "fallout3",
  FalloutNewVegas: "newvegas",
  Skyrim: "skyrim",
  SkyrimSpecialEdition: "skyrimspecialedition",
  Fallout4: "fallout4",
  SkyrimVR: "skyrimspecialedition",
  Enderal: "enderal",
  EnderalSpecialEdition: "enderalspecialedition",
  Fallout4VR: "fallout4",
  DarkestDungeon: "darkestdungeon",
  Dishonored: "dishonored",
  Witcher: "witcher",
  Witcher3: "witcher3",
  StardewValley: "stardewvalley",
  KingdomComeDeliverance: "kingdomcomedeliverance",
  MechWarrior5Mercenaries: "mechwarrior5mercenaries",
  NoMansSky: "nomanssky",
  DragonAgeOrigins: "dragonage",
  DragonAge2: "dragonage2",
  DragonAgeInquisition: "dragonageinquisition",
  KerbalSpaceProgram: "kerbalspaceprogram",
  Terraria: null,
  Cyberpunk2077: "cyberpunk2077",
  Sims4: "thesims4",
  DragonsDogma: "dragonsdogma",
  KarrynsPrison: null,
  Valheim: "valheim",
  MountAndBlade2Bannerlord: "mountandblade2bannerlord",
  FinalFantasy7Remake: "finalfantasy7remake",
  BaldursGate3: "baldursgate3",
  Starfield: "starfield",
  SevenDaysToDie: "7daystodie",
  OblivionRemastered: "oblivionremastered",
  Fallout76: "fallout76",
  Fallout4London: "fallout4london",
  Warhammer40kDarktide: "warhammer40kdarktide",
  Kotor2: "kotor2",
  VtMB: "vampirebloodlines",
  KingdomComeDeliverance2: "kingdomcomedeliverance2",
  DragonsDogma2: "dragonsdogma2",
  NieRAutomata: "nierautomata",
  ModdingTools: "site",
});
const WABBAJACK_GAME_DOMAINS = new Map();
for (const [game, domain] of Object.entries(WABBAJACK_NEXUS_DOMAINS)) {
  if (domain) {
    WABBAJACK_GAME_DOMAINS.set(game.toLowerCase(), domain);
    WABBAJACK_GAME_DOMAINS.set(domain.toLowerCase(), domain);
  }
}
for (const [game, domain] of [
  ["skyrim special edition", "skyrimspecialedition"],
  ["skyrimse", "skyrimspecialedition"],
  ["skyrim vr", "skyrimspecialedition"],
]) {
  WABBAJACK_GAME_DOMAINS.set(game, domain);
}
const NEXUS_ARCHIVE_STATE_TYPES = new Set([
  "Nexus",
  "NexusDownloader, Wabbajack.Lib",
]);

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

export function parseWabbajackArchiveSearchUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "www.wabbajack.org") {
    return null;
  }
  const match = url.pathname.match(/^\/search\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }
  let repository;
  let machineId;
  try {
    repository = decodeURIComponent(match[1]);
    machineId = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!repository || !machineId || repository === "." || repository === ".." || machineId === "." || machineId === "..") {
    return null;
  }
  const reportPath = `${encodeURIComponent(repository)}/${encodeURIComponent(machineId)}`;
  return {
    repository,
    machineId,
    statusUrl:
      `https://raw.githubusercontent.com/wabbajack-tools/mod-lists/master/reports/${reportPath}/status.json`,
  };
}

export function createNexusArchiveLinks(state) {
  if (
    !state ||
    typeof state !== "object" ||
    typeof state.$type !== "string" ||
    !NEXUS_ARCHIVE_STATE_TYPES.has(state.$type.trim())
  ) {
    return null;
  }
  const game = state.Game ?? state.game ?? state.GameName ?? state.gameName;
  const gameDomain = typeof game === "string"
    ? WABBAJACK_GAME_DOMAINS.get(game.toLowerCase())
    : null;
  const modId = state.ModID ?? state.modID ?? state.ModId ?? state.modId;
  const fileId = state.FileID ?? state.fileID ?? state.FileId ?? state.fileId;
  if (
    !gameDomain ||
    !Number.isSafeInteger(modId) ||
    modId <= 0 ||
    !Number.isSafeInteger(fileId) ||
    fileId <= 0
  ) {
    return null;
  }
  const modUrl = `https://www.nexusmods.com/${gameDomain}/mods/${modId}`;
  return {
    gameDomain,
    modId,
    fileId,
    modUrl,
    fileUrl: `${modUrl}?tab=files&file_id=${fileId}`,
  };
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
      imageUrl: safeHttpsUrl(item.imageUrl),
      wabbajackUrl: safeHttpsUrl(item.wabbajackUrl),
      galleryUrl: safeHttpsUrl(item.galleryUrl),
      readmeUrl: safeHttpsUrl(item.readmeUrl),
    });
  }
  rows.sort((left, right) =>
    right.modCount - left.modCount ||
    left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) ||
    left.stableId.localeCompare(right.stableId)
  );
  return rows;
}
