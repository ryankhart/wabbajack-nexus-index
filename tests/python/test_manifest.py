import unittest

import pipeline.manifest as manifest_module
from pipeline.manifest import (
    extract_nexus_memberships,
    extract_nexus_memberships_with_diagnostics,
)


class NexusMembershipTests(unittest.TestCase):
    def test_covers_every_current_wabbajack_game_registry_nexus_mapping(self):
        expected = {
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

        self.assertEqual(
            expected,
            getattr(manifest_module, "WABBAJACK_NEXUS_DOMAINS", None),
        )

    def test_accepts_only_authoritative_nexus_state_types(self):
        manifest = {
            "Archives": [
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "Skyrim",
                        "ModID": 1,
                        "FileID": 10,
                    }
                },
                {
                    "State": {
                        "$type": "Nexus",
                        "GameName": "SkyrimSpecialEdition",
                        "ModID": 2,
                        "FileID": 20,
                    }
                },
                {
                    "State": {
                        "$type": "NotReallyNexusDownloader, Example.Assembly",
                        "Game": "Skyrim",
                        "ModID": 3,
                        "FileID": 30,
                    }
                },
            ]
        }

        memberships = extract_nexus_memberships(manifest)

        self.assertEqual([1, 2], [item.mod_id for item in memberships])

    def test_maps_wabbajack_games_to_authoritative_nexus_domains(self):
        cases = [
            ("FalloutNewVegas", "newvegas"),
            ("DragonAgeOrigins", "dragonage"),
            ("SevenDaysToDie", "7daystodie"),
            ("Fallout4VR", "fallout4"),
            ("VtMB", "vampirebloodlines"),
            ("ModdingTools", "site"),
            ("VAMPIREBLOODLINES", "vampirebloodlines"),
        ]
        manifest = {
            "Archives": [
                {
                    "State": {
                        "$type": "Nexus",
                        "Game": game,
                        "ModID": index,
                        "FileID": index * 10,
                    }
                }
                for index, (game, _) in enumerate(cases, start=1)
            ]
        }

        result = extract_nexus_memberships_with_diagnostics(manifest)

        self.assertEqual((), result.rejections)
        self.assertEqual(
            sorted((domain, index) for index, (_, domain) in enumerate(cases, start=1)),
            [(item.game_domain, item.mod_id) for item in result.memberships],
        )

    def test_deduplicates_files_from_the_same_nexus_mod_page(self):
        manifest = {
            "Archives": [
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "SkyrimSpecialEdition",
                        "ModID": 42,
                        "FileID": 1001,
                    }
                },
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "SkyrimSpecialEdition",
                        "ModID": 42,
                        "FileID": 1002,
                    }
                },
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "SkyrimSpecialEdition",
                        "ModID": 42,
                        "FileID": 1001,
                    }
                },
            ]
        }

        memberships = extract_nexus_memberships(manifest)

        self.assertEqual(1, len(memberships))
        membership = memberships[0]
        self.assertEqual("skyrimspecialedition", membership.game_domain)
        self.assertEqual(42, membership.mod_id)
        self.assertEqual((1001, 1002), membership.file_ids)

    def test_uses_authoritative_nexus_domain_for_vr_and_rejects_near_matches(self):
        manifest = {
            "Archives": [
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "SkyrimVR",
                        "ModID": 7,
                        "FileID": 70,
                    }
                },
                {
                    "State": {
                        "$type": "NexusDownloader, Wabbajack.Lib",
                        "Game": "SkyrimSpecialEdition!",
                        "ModID": 8,
                        "FileID": 80,
                    }
                },
            ]
        }

        memberships = extract_nexus_memberships(manifest)

        self.assertEqual(1, len(memberships))
        self.assertEqual("skyrimspecialedition", memberships[0].game_domain)
        self.assertEqual(7, memberships[0].mod_id)

    def test_rejects_malformed_nexus_ids_with_diagnostics(self):
        states = [
            {"Game": "UnknownGame", "ModID": 1, "FileID": 10},
            {"Game": "Skyrim", "ModID": True, "FileID": 11},
            {"Game": "Skyrim", "ModID": 0, "FileID": 12},
            {"Game": "Skyrim", "ModID": -1, "FileID": 13},
            {"Game": "Skyrim", "ModID": "14", "FileID": 14},
            {"Game": "Skyrim", "ModID": 15, "FileID": False},
            {"Game": "Skyrim", "ModID": 16, "FileID": "16"},
            {"Game": "Skyrim", "ModID": 17, "FileID": 170},
        ]
        manifest = {
            "Archives": [
                {"State": {"$type": "NexusDownloader, Wabbajack.Lib", **state}}
                for state in states
            ]
        }

        result = extract_nexus_memberships_with_diagnostics(manifest)

        self.assertEqual([(17, (170,))], [(item.mod_id, item.file_ids) for item in result.memberships])
        self.assertEqual(7, len(result.rejections))
        self.assertEqual("archive[0]: unknown Nexus game", result.rejections[0])
        self.assertEqual(4, result.rejections.count("archive: ModID must be a positive integer"))
        self.assertEqual(2, result.rejections.count("archive: FileID must be a positive integer"))


if __name__ == "__main__":
    unittest.main()
