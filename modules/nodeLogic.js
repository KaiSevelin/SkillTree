// scripts/nodelogic.js

function getProps(doc) {
    const gp = globalThis.getProperty ?? ((o, p) => p.split(".").reduce((a, k) => a?.[k], o));
    return gp(doc, "system.props") ?? {};
}

function capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Converts CSB values into comparable numbers */
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

/**
 * Resolve full prereq chain for (nodeName, targetLevel) using NODES.
 * Returns { requirementName: requiredLevel, ... }
 */
function resolveRequirements(nodeName, targetLevel, NODES) {
    const visited = new Set();
    const aggregated = new Map(); // name -> highest needed level

    function add(name, lvl) {
        const prev = aggregated.get(name) ?? 0;
        if (lvl > prev) aggregated.set(name, lvl);
    }

    function walk(name, lvl) {
        const key = `${name}:${lvl}`;
        if (visited.has(key)) return;
        visited.add(key);

        // ✅ default progression: level L requires level L-1
        if (lvl > 1) {
            add(name, lvl - 1);
            walk(name, lvl - 1);
        }

        const def = NODES?.[name];
        if (!def) return;

        const reqs = def[lvl] ?? {};
        for (const [reqName, reqLevelRaw] of Object.entries(reqs)) {
            const reqLevel = Number(reqLevelRaw) || 0;
            add(reqName, reqLevel);
            walk(reqName, reqLevel);
        }
    }

    walk(nodeName, Number(targetLevel) || 0);
    return Object.fromEntries(aggregated.entries());
}


/**
 * Look up a requirement in:
 * - actor props by exact key (skills)
 * - item props by exact key OR TraitXxx (traits)
 */
function getHave(actorProps, itemProps, reqName) {
    if (reqName in actorProps) {
        return { have: asLevel(actorProps[reqName]), source: "actor", keyUsed: reqName };
    }

    if (itemProps) {
        if (reqName in itemProps) {
            return { have: asLevel(itemProps[reqName]), source: "item", keyUsed: reqName };
        }
        const traitKey = `Trait${capFirst(reqName)}`; // fast -> TraitFast
        if (traitKey in itemProps) {
            return { have: asLevel(itemProps[traitKey]), source: "item", keyUsed: traitKey };
        }
    }

    return { have: 0, source: "actor", keyUsed: reqName };
}

/**
 * Unified checker:
 * - Acquire/check a skill: call with (actor, null item)
 * - Perform a maneuver: call with (actor, item)
 *
 * Returns true OR missing[]
 * missing[] entries: { name, need, have, source, keyUsed }
 */
export function checkNode(actor, nodeName, targetLevel, NODES, item = null) {
    const actorProps = getProps(actor);
    const itemProps = item ? getProps(item) : null;

    const reqs = resolveRequirements(nodeName, targetLevel, NODES);
    const missing = [];

    for (const [reqName, needRaw] of Object.entries(reqs)) {
        const need = asLevel(needRaw);
        const { have, source, keyUsed } = getHave(actorProps, itemProps, reqName);

        if (have < need) {
            missing.push({ name: reqName, need, have, source, keyUsed });
        }
    }

    return missing.length ? missing : true;
}
