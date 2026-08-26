from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

# Wabbajack GameRegistry is authoritative for Nexus page domains. Keep explicit
# no-domain entries so a future inferred slug cannot silently create bad edges.
# Snapshot: https://github.com/wabbajack-tools/wabbajack/blob/
# af938fb980bb4bcd1f6c87542fae6cd34b5020ee/Wabbajack.DTOs/Game/GameRegistry.cs
WABBAJACK_NEXUS_DOMAINS = MappingProxyType(
    {
        "Morrowind": "morrowind",
        "Oblivion": "oblivion",
        "Fallout3": "fallout3",
        "FalloutNewVegas": "newvegas",
        "Skyrim": "skyrim",
        "SkyrimSpecialEdition": "skyrimspecialedition",
        "Fallout4": "fallout4",
        "SkyrimVR": "skyrimspecialedition",
        "Enderal": "enderal",
        "EnderalSpecialEdition": "enderalspecialedition",
        "Fallout4VR": "fallout4",
        "DarkestDungeon": "darkestdungeon",
        "Dishonored": "dishonored",
        "Witcher": "witcher",
        "Witcher3": "witcher3",
        "StardewValley": "stardewvalley",
        "KingdomComeDeliverance": "kingdomcomedeliverance",
        "MechWarrior5Mercenaries": "mechwarrior5mercenaries",
        "NoMansSky": "nomanssky",
        "DragonAgeOrigins": "dragonage",
        "DragonAge2": "dragonage2",
        "DragonAgeInquisition": "dragonageinquisition",
        "KerbalSpaceProgram": "kerbalspaceprogram",
        "Terraria": None,
        "Cyberpunk2077": "cyberpunk2077",
        "Sims4": "thesims4",
        "DragonsDogma": "dragonsdogma",
        "KarrynsPrison": None,
        "Valheim": "valheim",
        "MountAndBlade2Bannerlord": "mountandblade2bannerlord",
        "FinalFantasy7Remake": "finalfantasy7remake",
        "BaldursGate3": "baldursgate3",
        "Starfield": "starfield",
        "SevenDaysToDie": "7daystodie",
        "OblivionRemastered": "oblivionremastered",
        "Fallout76": "fallout76",
        "Fallout4London": "fallout4london",
        "Warhammer40kDarktide": "warhammer40kdarktide",
        "Kotor2": "kotor2",
        "VtMB": "vampirebloodlines",
        "KingdomComeDeliverance2": "kingdomcomedeliverance2",
        "DragonsDogma2": "dragonsdogma2",
        "NieRAutomata": "nierautomata",
        "ModdingTools": "site",
    }
)

_GAME_DOMAINS = {
    **{
        game.casefold(): nexus_domain
        for game, nexus_domain in WABBAJACK_NEXUS_DOMAINS.items()
        if nexus_domain is not None
    },
    **{
        nexus_domain.casefold(): nexus_domain
        for nexus_domain in WABBAJACK_NEXUS_DOMAINS.values()
        if nexus_domain is not None
    },
    # Retain exact legacy spellings observed in older Skyrim manifests.
    "skyrim special edition": "skyrimspecialedition",
    "skyrimse": "skyrimspecialedition",
    "skyrim vr": "skyrimspecialedition",
}

# Wabbajack's current Nexus DTO declares JsonAlias("Nexus") and the legacy
# JsonName("NexusDownloader, Wabbajack.Lib"). Accept only those authoritative
# serialized identities so unrelated downloader types containing "nexus" do
# not create membership edges.
_NEXUS_STATE_TYPES = frozenset({"Nexus", "NexusDownloader, Wabbajack.Lib"})


@dataclass(frozen=True, order=True)
class NexusMembership:
    game_domain: str
    mod_id: int
    file_ids: tuple[int, ...]


@dataclass(frozen=True)
class MembershipExtraction:
    memberships: tuple[NexusMembership, ...]
    rejections: tuple[str, ...]


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value > 0:
        return value
    return None


def _value(state: dict[str, Any], *names: str) -> object:
    for name in names:
        if name in state:
            return state[name]
    return None


def _game_domain(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    return _GAME_DOMAINS.get(value.casefold())


def _is_nexus_state_type(value: object) -> bool:
    return isinstance(value, str) and value.strip() in _NEXUS_STATE_TYPES


def extract_nexus_memberships_with_diagnostics(
    manifest: dict[str, Any],
) -> MembershipExtraction:
    archives = manifest.get("Archives")
    if not isinstance(archives, list):
        return MembershipExtraction(memberships=(), rejections=())
    grouped: dict[tuple[str, int], set[int]] = {}
    rejections: list[str] = []
    for archive_index, archive in enumerate(archives):
        if not isinstance(archive, dict):
            continue
        state = archive.get("State")
        if not isinstance(state, dict):
            continue
        state_type = state.get("$type")
        if not _is_nexus_state_type(state_type):
            continue
        game_domain = _game_domain(
            _value(state, "Game", "game", "GameName", "gameName")
        )
        mod_id = _positive_int(_value(state, "ModID", "modID", "ModId", "modId"))
        if game_domain is None:
            rejections.append(f"archive[{archive_index}]: unknown Nexus game")
            continue
        if mod_id is None:
            rejections.append("archive: ModID must be a positive integer")
            continue
        file_id = _positive_int(
            _value(state, "FileID", "fileID", "FileId", "fileId")
        )
        if file_id is None:
            rejections.append("archive: FileID must be a positive integer")
            continue
        key = (game_domain, mod_id)
        grouped.setdefault(key, set())
        grouped[key].add(file_id)
    return MembershipExtraction(
        memberships=tuple(
            NexusMembership(
                game_domain=game_domain,
                mod_id=mod_id,
                file_ids=tuple(sorted(file_ids)),
            )
            for (game_domain, mod_id), file_ids in sorted(grouped.items())
        ),
        rejections=tuple(rejections),
    )


def extract_nexus_memberships(manifest: dict[str, Any]) -> list[NexusMembership]:
    return list(extract_nexus_memberships_with_diagnostics(manifest).memberships)
