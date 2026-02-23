// scripts/node-data.js
export const NODES = {
    "Skills_ArtCreative": { "1": {} },
    "Skills_ArtExpertiseDance": { "1": { "Skills_ArtCreative": 1 }, "2": {} },
    "Skills_ArtExpertiseMusic": { "1": { "Skills_ArtCreative": 1 }, "2": {} },
    "Skills_ArtExpertisePainting": { "1": { "Skills_ArtCreative": 1 }, "2": {} },
    "Skills_ArtExpertiseSculpture": { "1": { "Skills_ArtCreative": 1, "Skills_ManufacturingExpertiseStone": 1 }, "2": {} },
    "Skills_ArtExpertiseWriting": { "1": { "Skills_ArtCreative": 1 }, "2": {} },
    "Skills_CharismaPerform": { "1": {}, "2": {} },

    "Skills_CombatExpertiseBlade": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseBow": { "1": { "Skills_CombatRanged": 1 } },
    "Skills_CombatExpertiseCommand": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseCrossbow": { "1": { "Skills_CombatRanged": 1 } },
    "Skills_CombatExpertiseDefense": { "1": { "Skills_CombatMelee": 1 }, "2": {} },
    "Skills_CombatExpertiseFirearm": { "1": { "Skills_CombatFirearm": 1 } },
    "Skills_CombatExpertiseHeavy": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseKnife": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseMounted": { "1": { "Skills_CombatMelee": 1, "Skills_OutdoorRiding": 1 } },
    "Skills_CombatExpertiseOffense": { "1": { "Skills_CombatMelee": 1 }, "2": {}, "3": {} },
    "Skills_CombatExpertisePolearm": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertisePrecision": { "1": { "Skills_CombatMelee": 1 }, "2": {} },
    "Skills_CombatExpertiseQuick": { "1": { "Skills_CombatMelee": 1 }, "2": {}, "3": {} },
    "Skills_CombatExpertiseShield": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseSiege": { "1": { "Skills_CombatMelee": 1 } },
    "Skills_CombatExpertiseTactics": { "1": { "Skills_CombatMelee": 1 }, "2": {} },
    "Skills_CombatExpertiseThrown": { "1": { "Skills_CombatThrown": 1 } },
    "Skills_CombatExpertiseUnarmed": { "1": { "Skills_CombatUnarmed": 1 } },

    "Skills_CombatFirearm": { "1": {} },
    "Skills_CombatMelee": { "1": {} },
    "Skills_CombatRanged": { "1": {} },
    "Skills_CombatThrown": { "1": {} },
    "Skills_CombatUnarmed": { "1": {} },

    "Skills_FaithAscetic": { "1": {}, "2": {} },
    "Skills_IntelligenceInvestigation": { "1": {}, "2": {} },

    "Skills_LearningScholar": { "1": {} },
    "Skills_LearningExpertiseAlchemy": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseApothecary": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseArtScience": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseAstronomy": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseEtiquette": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseHeraldry": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseLanguage": { "1": { "Skills_LearningScholar": 1 }, "2": {}, "3": {}, "4": {}, "5": {}, "6": {}, "7": {}, "8": {}, "9": {}, "10": {} },
    "Skills_LearningExpertiseLaw": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseLore": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseMedicine": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseOccult": { "1": { "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_LearningExpertiseReligion": { "1": { "Skills_LearningScholar": 1 }, "2": {} },

    "Skills_ManufacturingCraft": { "1": {} },
    "Skills_ManufacturingExpertiseFood": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseGlass": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseJewelry": { "1": { "Skills_ManufacturingCraft": 1, "Skills_ArtCreative": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseMechanics": { "1": { "Skills_ManufacturingCraft": 1, "Skills_LearningScholar": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseMetal": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertisePaper": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseSoft": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseStone": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_ManufacturingExpertiseWood": { "1": { "Skills_ManufacturingCraft": 1 }, "2": {} },

    "Skills_OutdoorNavigation": { "1": {}, "2": {} },
    "Skills_OutdoorRiding": { "1": {}, "2": {} },
    "Skills_OutdoorSurvival": { "1": {}, "2": {} },
    "Skills_OutdoorSwimming": { "1": {}, "2": {} },

    "Skills_PaganLowMagic": { "1": {} },
    "Skills_PaganExpertiseAmulet": { "1": { "Skills_PaganLowMagic": 1, "Skills_ManufacturingCraft": 1 }, "2": {} },
    "Skills_PaganExpertiseDivination": { "1": { "Skills_PaganLowMagic": 1 }, "2": {} },
    "Skills_PaganExpertiseHerbalism": { "1": { "Skills_PaganLowMagic": 1 }, "2": {} },
    "Skills_PaganExpertisePotion": { "1": { "Skills_PaganLowMagic": 1, "Skills_PaganExpertiseHerbalism": 1 }, "2": {} },
    "Skills_PaganExpertiseNecromancy": { "1": { "Skills_PaganLowMagic": 1 }, "2": {} },
    "Skills_PaganExpertiseKnotMagic": { "1": { "Skills_PaganLowMagic": 1, "Skills_PaganExpertiseHerbalism": 1 }, "2": {} },
    "Skills_PaganExpertiseWarding": { "1": { "Skills_PaganLowMagic": 1, "Skills_PaganExpertiseHerbalism": 1 }, "2": {} },

    "Skills_ServicesBarber": { "1": {} },
    "Skills_ServicesExpertiseSurgeon": { "1": { "Skills_ServicesBarber": 1 }, "2": {} },

    "Skills_StrengthAthletics": { "1": {}, "2": {} },

    "Skills_SubterfugeCriminal": { "1": {} },
    "Skills_SubterfugeExpertiseLocks": { "1": { "Skills_SubterfugeCriminal": 1 }, "2": {} },
    "Skills_SubterfugeExpertiseSpying": { "1": { "Skills_SubterfugeCriminal": 1 }, "2": {} },
    "Skills_SubterfugeExpertiseStealth": { "1": { "Skills_SubterfugeCriminal": 1 }, "2": {} },
    "Skills_SubterfugeExpertiseThieving": { "1": { "Skills_SubterfugeCriminal": 1 }, "2": {} },

    "Traits_Aiming": { "1": {} },
    "Traits_ArmorBreaking": { "1": {} },
    "Traits_Bracing": { "1": {} },
    "Traits_Charging": { "1": {} },
    "Traits_Control": { "1": {} },
    "Traits_Disarming": { "1": {} },
    "Traits_Fast": { "1": {} },
    "Traits_Fragile": { "1": {} },
    "Traits_Heavy": { "1": {} },
    "Traits_Hooking": { "1": {} },
    "Traits_LongReach": { "1": {} },
    "Traits_Narrow": { "1": {} },
    "Traits_NeedsSpace": { "1": {} },
    "Traits_Parrying": { "1": {} },
    "Traits_PointBlank": { "1": {} },
    "Traits_Reach": { "1": {} },
    "Traits_Receiving": { "1": {} },
    "Traits_Reloading": { "1": {} },
    "Traits_Shield": { "1": {} },
    "Traits_Tactical": { "1": {} },
    "Traits_Versatile": { "1": {} },

    "Maneuvers_FreeAttack": { "1": { "Skills_CombatExpertiseQuick": 1 } },
    "Maneuvers_Feint": { "1": { "Skills_CombatExpertiseQuick": 1, "Traits_Fast": 1, "DexterityPoint": 1 } },
    "Maneuvers_Reload": {
        "1": {
            "Skills_CombatExpertiseQuick": 2,
            "Traits_Reloading": 1,
            "_any": [{ "CritPoint": 2 }, { "DexterityPoint": 1 }]
        }
    },

    "Maneuvers_PointBlank": {
        "1": {
            "Skills_CombatExpertiseQuick": 2,
                "Traits_PointBlank": 1
        }
    },

    "Maneuvers_Versatile": {
        "1": {
            "Skills_CombatExpertiseQuick": 2,
                "Traits_Versatile": 1
        }
    },

    "Maneuvers_CounterAttack": {
        "1": {
            "Skills_CombatExpertiseQuick": 2,
                "Traits_Fast": 1,
                    "CritPoint": 2
        }
    },

    "Maneuvers_Redouble": {
        "1": {
            "Skills_CombatExpertiseQuick": 3,
                "Traits_Fast": 1,
                    "DexterityPoint": 1
        }
    },

    "Maneuvers_Riposte": {
        "1": {
            "Skills_CombatExpertiseQuick": 3,
                "Traits_Fast": 1,
                    "DexterityPoint": 1
        }
    },

    "Maneuvers_Throw": {
        "1": {
            "Skills_CombatExpertiseQuick": 3,
                "Traits_Control": 1,
                    "CritPoint": 2
        }
    },

    "Maneuvers_Brace": {
        "1": {
            "Skills_CombatExpertisePrecision": 1,
                "Traits_Bracing": 1,
                    "_any": [
                        { "StrengthPoint": 1 }
                    ]
        }
    },

    "Maneuvers_Aim": {
        "1": {
            "Skills_CombatExpertisePrecision": 1,
                "Traits_Aiming": 1,
                    "_any": [
                        { "IntelligencePoint": 1 }
                    ]
        }
    },

    "Maneuvers_WeakSpot": {
        "1": {
            "Skills_CombatExpertisePrecision": 2,
                "Traits_Narrow": 1,
                    "IntelligencePoint": 1
        }
    },

    "Maneuvers_Parry": {
        "1": {
            "Skills_CombatExpertiseDefense": 1,
                "Traits_Parrying": 1
        }
    },

    "Maneuvers_Shield": {
        "1": {
            "Skills_CombatExpertiseDefense": 1,
                "Traits_Shield": 1
        }
    },

    "Maneuvers_Bind": {
        "1": {
            "Skills_CombatExpertiseDefense": 1,
                "Traits_Parrying": 1,
                    "CritPoint": 1
        }
    },

    "Maneuvers_Disengage": {
        "1": {
            "Skills_CombatExpertiseDefense": 1,
                "DexterityPoint": 1
        }
    },

    "Maneuvers_Lock": {
        "1": {
            "Skills_CombatExpertiseDefense": 1,
                "Traits_Control": 1,
                    "CritPoint": 1
        }
    },

    "Maneuvers_Disarm": {
        "1": {
            "Skills_CombatExpertiseDefense": 2,
                "Traits_Disarming": 1,
                    "CritPoint": 2
        }
    },

    "Maneuvers_ReceiveCharge": {
        "1": {
            "Skills_CombatExpertiseDefense": 2,
                "Traits_Receiving": 1,
                    "StaminaPoint": 1
        }
    },

    "Maneuvers_Hooking": {
        "1": {
            "Skills_CombatExpertiseDefense": 2,
                "Traits_Hooking": 1,
                    "CritPoint": 2
        }
    },

    "Maneuvers_ArmorBreaker": {
        "1": {
            "Skills_CombatExpertiseOffense": 1,
                "Traits_ArmorBreaking": 1,
                    "CritPoint": 1
        }
    },

    "Maneuvers_Choke": {
        "1": {
            "Skills_CombatExpertiseOffense": 1,
                "Traits_Control": 1,
                    "_any": [
                        { "DexterityPoint": 1 },
                        { "StrengthPoint": 1 }
                    ]
        }
    },

    "Maneuvers_Charge": {
        "1": {
            "Skills_CombatExpertiseOffense": 2,
                "Traits_Charging": 1
        }
    },

    "Maneuvers_AllIn": {
        "1": {
            "Skills_CombatExpertiseOffense": 2,
                "Traits_Heavy": 1,
                    "StrengthPoint": 1
        }
    },

    "Maneuvers_BullRush": {
        "1": {
            "Skills_CombatExpertiseOffense": 3
        }
    },

    "Maneuvers_Formation": {
        "1": {
            "Skills_CombatExpertiseTactics": 1,
                "Traits_Tactical": 1
        }
    },

    "Maneuvers_ShieldWall": {
        "1": {
            "Skills_CombatExpertiseTactics": 2,
                "Traits_Shield": 1
        }
    },

    "Maneuvers_Rally": {
        "1": {
            "Skills_CombatExpertiseCommand": 1,
                "CharismaPoint": 1
        }
    },

    "Maneuvers_ActOfFaith": {
        "1": {
            "Skills_FaithAscetic": 1,
                "FaithPoint": 1
        }
    },

    "Maneuvers_Sap": {
        "1": {
            "Skills_SubterfugeExpertiseStealth": 1
        }
    },

    "Maneuvers_Assassinate": {
        "1": {
            "Skills_SubterfugeExpertiseStealth": 2
        }
    },

    "Maneuvers_ResistHooking": {
        "1": {
            "Skills_StrengthAthletics": 1,
                "StrengthPoint": 1
        }
    },

    "Maneuvers_ActOfStrength": {
        "1": {
            "StrengthPoint": 1
        }
    },

    "Maneuvers_ActOfPrecision": {
        "1": {
            "IntelligencePoint": 1
        }
    },

    "Maneuvers_ActOfToughness": {
        "1": {
            "StaminaPoint": 1
        }
    },

    "Maneuvers_ActOfSpeed": {
        "1": {
            "DexterityPoint": 1
        }
    },

    "Maneuvers_ActOfInspiration": {
        "1": {
            "CharismaPoint": 1
        }
    },

    "Maneuvers_ActOfHeroism": {
        "1": {
            "FaithPoint": 1
        }
    },

    "Maneuvers_CatchBreath": {
        "1": { }
    }
};
