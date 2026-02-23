// scripts/node-logic.js
import { SKILL_KEYS, STAT_KEYS, TRAIT_KEYS, RESOURCE_KEYS } from "./keys.js";
function getProps(doc) {
    const gp = globalThis.getProperty ?? ((o, p) => p.split(".").reduce((a, k) => a?.[k], o));
    return gp(doc, "system.props") ?? {};
}

function asLevel(val) {
    if (typeof val === "boolean") return val ? 1 : 0;
    if (val == null) return 0;

    if (typeof val === "string") {
        const t = val.trim().toLowerCase();
        if (t === "true") return 1;
        if (t === "false") return 0;
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
    }

    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
}

// Build a case-insensitive lookup: lowerKey -> actualKey
function buildKeyMap(obj) {
    const m = new Map();
    for (const k of Object.keys(obj ?? {})) m.set(String(k).toLowerCase(), k);
    return m;
}
function makeMergedItemProps(weapon, armor) {
    const merged = {};

    // ----------------
    // Weapon traits
    // ----------------
    if (weapon) {
        Object.assign(merged, getProps(weapon));
    } else {
        // ✅ Unarmed defaults
        merged["Traits_Unarmed"] = 1;
        merged["Traits_Control"] = 1;
        merged["Traits_Fast"] = 1;
        merged["Traits_Disarming"] = 1;
    }

    // ----------------
    // Armor traits
    // ----------------
    if (armor) {
        Object.assign(merged, getProps(armor));

        const hasArmorTrait =
            merged.Traits_LightArmor ||
            merged.Traits_MediumArmor ||
            merged.Traits_HeavyArmor;

        if (!hasArmorTrait) {
            // Defensive fallback
            merged.Traits_LightArmor = 1;
        }
    } else {
        // ✅ No armor = light armor
        merged["Traits_LightArmor"] = 1;
    }

    return merged;
}
// Enforce full-name prefixes in nodeData
function classify(name) {
    const n = String(name).toLowerCase();
    if (SKILL_KEYS.some(k => k.toLowerCase() === n)) return "actor";
    if (STAT_KEYS.some(k => k.toLowerCase() === n)) return "actor";
    if (RESOURCE_KEYS.some(k => k.toLowerCase() === n)) return "actor";
    if (TRAIT_KEYS.some(k => k.toLowerCase() === n)) return "item";
    return "unknown";
}


// Auto-progression: level N requires level N-1
// Applies to Skills_ by default; change this if you want it broader.
function shouldAutoProgress(name) {
    return /^skills_/i.test(String(name));
}

function resolveRequirements(nodeName, targetLevel, NODES) {
    const visited = new Set();
    const aggregated = new Map(); // lower-name -> { name: canonicalName, level: highest }

    function add(reqName, lvl) {
        const key = String(reqName).toLowerCase();
        const prev = aggregated.get(key);
        if (!prev || lvl > prev.level) aggregated.set(key, { name: reqName, level: lvl });
    }

    function walk(name, lvl) {
        const k = `${String(name).toLowerCase()}:${lvl}`;
        if (visited.has(k)) return;
        visited.add(k);

        // ✅ implicit skill progression (level N needs N-1)
        if (lvl > 1 && shouldAutoProgress(name)) {
            add(name, lvl - 1);
            walk(name, lvl - 1);
        }

        // Node names in NODES are treated case-insensitively too:
        // find the actual node key by case-insensitive match
        const nodeKeyLower = String(name).toLowerCase();
        const actualNodeKey = Object.keys(NODES).find(k2 => k2.toLowerCase() === nodeKeyLower);
        if (!actualNodeKey) return;

        const def = NODES[actualNodeKey];
        const reqs = def?.[lvl] ?? {};

        for (const [reqName, reqLevelRaw] of Object.entries(reqs)) {
            const reqLvl = asLevel(reqLevelRaw);
            add(reqName, reqLvl);
            walk(reqName, reqLvl);
        }
    }

    walk(nodeName, asLevel(targetLevel));

    // return canonical names with highest level
    const out = {};
    for (const { name, level } of aggregated.values()) out[name] = level;
    return out;
}

/**
 * Returns { have, source, keyUsed } for a requirement name.
 * - Skills_/Stats_ from actor props (case-insensitive key match)
 * - Traits_ from item props (case-insensitive key match)
 * Enforces full-name style: if name doesn't start with Skills_/Stats_/Traits_, it is "unknown"
 */
function getHave(actorProps, actorMap, mergedItemProps, mergedItemMap, reqName) {
    const kind = classify(reqName);
    const reqLower = String(reqName).toLowerCase();

    if (kind === "actor") {
        const actual = actorMap.get(reqLower);
        const have = actual ? asLevel(actorProps[actual]) : 0;
        return { have, source: "actor", keyUsed: actual ?? reqName };
    }

    if (kind === "item") {
        const actual = mergedItemMap.get(reqLower);
        const have = actual ? asLevel(mergedItemProps[actual]) : 0;
        return { have, source: "item", keyUsed: actual ?? reqName };
    }

    return { have: 0, source: "unknown", keyUsed: reqName };
}

/**
 * Unified checker.
 * - Acquire/check a skill/stat: call with (actor, null item)
 * - Perform a maneuver (as a node): call with (actor, item)
 *
 * Returns true OR missing[]
 * missing[] entries: { name, need, have, source, keyUsed }
 */
/**
 * Returns the highest possible rank an actor could reach
 * for a given skill, based on current prerequisites.
 *
 * - Uses SkillTree rules (including implicit rank chaining)
 * - Stops at first failed prerequisite
 * - Does NOT grant anything, only evaluates legality
 */
/**
 * Return all maneuvers that are currently usable by this actor with the given item.
 *
 * A maneuver is considered "available" if:
 * - It exists in NODES
 * - Its key starts with "Maneuvers_"
 * - checkNode(actor, maneuver, 1, NODES, item) === true
 *
 * @param {object} actor Foundry Actor document
 * @param {object} NODES skill tree nodes object
 * @param {object|null} item Foundry Item document (weapon), used for Traits_ checks
 * @param {object} [opts]
 * @param {boolean} [opts.includeFailures=false] If true, returns {available, unavailable}
 * @param {RegExp} [opts.maneuverKeyPattern=/^maneuvers_/i] Override how maneuvers are detected
 * @returns {string[]|{available: string[], unavailable: Array<{name: string, missing: any}>}}
 */
export function getAvailableManeuvers(actor, NODES, weapon = null, armor = null, opts = {}) {
    const { includeFailures = false, maneuverKeyPattern = /^maneuvers_/i } = opts;

    const available = [];
    const unavailable = [];

    for (const nodeName of Object.keys(NODES ?? {})) {
        if (!maneuverKeyPattern.test(nodeName)) continue;

        const result = checkNode(actor, nodeName, 1, NODES, weapon, armor);

        if (result === true) {
            available.push(nodeName);
        } else if (includeFailures) {
            unavailable.push({ name: nodeName, missing: result });
        }
    }

    available.sort((a, b) => a.localeCompare(b));
    if (!includeFailures) return available;

    unavailable.sort((a, b) => a.name.localeCompare(b.name));
    return { available, unavailable };
}
export function getMaxPossibleSkillRank(actor, skillKey, NODES, weapon = null, armor = null) {
    if (!actor || !skillKey || !NODES) return 0;

    let rank = 1;
    while (checkNode(actor, skillKey, rank, NODES, weapon, armor) === true) {
        rank++;
    }
    return rank - 1;
}
/**
 * Unified checker.
 * Always accepts ONE weapon and ONE armor.
 * - weapon: item that provides weapon Traits_
 * - armor: worn armor item that provides armor Traits_
 * - If armor is null, the actor is treated as having Traits_LightArmor = 1
 *
 * Returns true OR missing[] entries: { name, need, have, source, keyUsed }
 */
export function checkNode(actor, nodeName, targetLevel, NODES, weapon = null, armor = null) {
    const actorProps = getProps(actor);

    const actorMap = buildKeyMap(actorProps);

    // Merge weapon+armor props into one trait context
    const mergedItemProps = makeMergedItemProps(weapon, armor);
    const mergedItemMap = buildKeyMap(mergedItemProps);

    const reqs = resolveRequirements(nodeName, targetLevel, NODES);
    const missing = [];

    for (const [reqName, needRaw] of Object.entries(reqs)) {
        const need = asLevel(needRaw);
        const { have, source, keyUsed } = getHave(actorProps, actorMap, mergedItemProps, mergedItemMap, reqName);

        if (source === "unknown") {
            missing.push({ name: reqName, need, have: 0, source: "unknown", keyUsed });
            continue;
        }

        if (have < need) {
            missing.push({ name: reqName, need, have, source, keyUsed });
        }
    }

    return missing.length ? missing : true;
}


