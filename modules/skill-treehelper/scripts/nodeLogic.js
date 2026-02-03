// scripts/node-logic.js
import { SKILL_KEYS, STAT_KEYS, TRAIT_KEYS } from "./keys.js";
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

// Enforce full-name prefixes in nodeData
function classify(name) {
    const n = String(name).toLowerCase();
    if (SKILL_KEYS.some(k => k.toLowerCase() === n)) return "actor";
    if (STAT_KEYS.some(k => k.toLowerCase() === n)) return "actor";
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
function getHave(actorProps, actorMap, itemProps, itemMap, reqName) {
    const kind = classify(reqName);
    const reqLower = String(reqName).toLowerCase();

    if (kind === "actor") {
        const actual = actorMap.get(reqLower);
        const have = actual ? asLevel(actorProps[actual]) : 0;
        return { have, source: "actor", keyUsed: actual ?? reqName };
    }

    if (kind === "item") {
        if (!itemProps) return { have: 0, source: "item", keyUsed: reqName }; // no item provided
        const actual = itemMap.get(reqLower);
        const have = actual ? asLevel(itemProps[actual]) : 0;
        return { have, source: "item", keyUsed: actual ?? reqName };
    }

    // Unknown requirement key format (doesn't follow your naming rules)
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

export function checkNode(actor, nodeName, targetLevel, NODES, item = null) {
    const actorProps = getProps(actor);
    const itemProps = item ? getProps(item) : null;

    const actorMap = buildKeyMap(actorProps);
    const itemMap = buildKeyMap(itemProps);

    const reqs = resolveRequirements(nodeName, targetLevel, NODES);
    const missing = [];

    for (const [reqName, needRaw] of Object.entries(reqs)) {
        const need = asLevel(needRaw);
        const { have, source, keyUsed } = getHave(actorProps, actorMap, itemProps, itemMap, reqName);

        if (source === "unknown") {
            // Enforce your "full names only" policy
            missing.push({ name: reqName, need, have: 0, source: "unknown", keyUsed });
            continue;
        }

        if (have < need) {
            missing.push({ name: reqName, need, have, source, keyUsed });
        }
    }

    return missing.length ? missing : true;
}
