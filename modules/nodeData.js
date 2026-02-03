// scripts/node-data.js
export const NODES = {
    Skills_CombatExpertiseKnife: {
        1: { Skills_CombatMelee: 1 },
    },
    Skills_CombatExpertiseQuick: {
        1: { Skills_CombatMelee: 1 },
    }, 
    Skills_CombatMelee: {
        1: {}
    },
    Feint: {
        1: { Skills_CombatExpertiseKnife: 1, Skills_CombatExpertiseQuick: 1, fast: 1, }
    }
};
