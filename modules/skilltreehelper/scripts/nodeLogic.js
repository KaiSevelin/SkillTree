const MODULE_ID = "skilltreehelper";

function asNonNegativeInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
}

function getLevelFromActorItem(item) {
    const flagged = Number(item?.getFlag?.(MODULE_ID, "skillTree")?.level);
    if (Number.isFinite(flagged) && flagged >= 0) return Math.floor(flagged);
    return 1;
}

function getSourceUuid(item) {
    return String(item?.flags?.core?.sourceId ?? "").trim();
}

function getByPath(obj, path) {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function getExplicitNodeRef(item) {
    return String(item?.flags?.[MODULE_ID]?.nodeId ?? "").trim();
}

function getNodeRefCandidates(item) {
    return [
        getExplicitNodeRef(item),
        getSourceUuid(item),
        String(item?.uuid ?? "").trim(),
        String(item?.id ?? "").trim()
    ].filter(Boolean);
}

function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase();
}

function parseTraitCsv(value) {
    if (value == null) return [];
    return String(value)
        .split(",")
        .map((part) => normalizeToken(part))
        .filter(Boolean);
}

function readItemField(item, field) {
    if (!item || !field) return undefined;
    const direct = item?.system?.[field];
    if (direct != null) return direct;
    const fromProps = item?.system?.props?.[field];
    if (fromProps != null) return fromProps;
    return item?.[field];
}

function getItemTemplateName(item) {
    const candidates = [
        getByPath(item, "system.template"),
        getByPath(item, "system.templateName"),
        getByPath(item, "system._template"),
        getByPath(item, "system.itemTemplate"),
        getByPath(item, "flags.csb.template"),
        getByPath(item, "flags.custom-system-builder.template")
    ];

    for (const candidate of candidates) {
        const value = String(candidate ?? "").trim();
        if (value) return value;
    }
    return "";
}

function isItemFromTemplate(item, templateName) {
    return normalizeToken(getItemTemplateName(item)) === normalizeToken(templateName);
}

function isItemEquipped(item) {
    const candidates = [
        getByPath(item, "system.equipped"),
        getByPath(item, "system.isEquipped"),
        getByPath(item, "system.props.Equipped"),
        getByPath(item, "system.props.equipped"),
        getByPath(item, "system.props.IsEquipped"),
        getByPath(item, "system.props.isEquipped")
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "boolean") return candidate;
        if (typeof candidate === "number") return candidate > 0;
        const token = normalizeToken(candidate);
        if (token === "true" || token === "1" || token === "yes") return true;
        if (token === "false" || token === "0" || token === "no") return false;
    }

    return false;
}

function buildCycleGraph(data) {
    return {
        nodes: new Map(Object.entries(data).map(([nodeId, node]) => [
            nodeId,
            {
                requirements: Array.isArray(node?.requirements) ? node.requirements : [],
                anyOf: Array.isArray(node?.anyOf) ? node.anyOf : []
            }
        ]))
    };
}

export function normalizeGraphData(input) {
    const normalized = {};

    for (const [nodeIdRaw, node] of Object.entries(input ?? {})) {
        const nodeId = String(nodeIdRaw).trim();
        if (!nodeId) continue;

        const requirements = Array.isArray(node?.requirements) ? node.requirements : [];
        const anyOf = Array.isArray(node?.anyOf) ? node.anyOf : [];
        normalized[nodeId] = {
            name: String(node?.name ?? "").trim(),
            type: String(node?.type ?? "").trim(),
            requirements: requirements.map((req) => ({
                nodeId: String(req?.nodeId ?? req?.skillId ?? req?.itemId ?? "").trim(),
                minLevel: asNonNegativeInt(req?.minLevel)
            })).filter((req) => req.nodeId.length > 0),
            anyOf: anyOf
                .map((group) => {
                    const options = Array.isArray(group?.options) ? group.options : Array.isArray(group) ? group : [];
                    const normalizedOptions = options.map((req) => ({
                        nodeId: String(req?.nodeId ?? req?.skillId ?? req?.itemId ?? "").trim(),
                        minLevel: asNonNegativeInt(req?.minLevel)
                    })).filter((req) => req.nodeId.length > 0);
                    return normalizedOptions.length ? { options: normalizedOptions } : null;
                })
                .filter(Boolean)
        };
    }

    return normalized;
}

export function detectCycles(graph) {
    const marks = new Map();
    const stack = [];
    const cycles = [];

    function visit(nodeId) {
        const mark = marks.get(nodeId) ?? 0;
        if (mark === 2) return;
        if (mark === 1) {
            const start = stack.indexOf(nodeId);
            if (start >= 0) cycles.push(stack.slice(start).concat(nodeId));
            return;
        }

        marks.set(nodeId, 1);
        stack.push(nodeId);

        const node = graph.nodes.get(nodeId);
        for (const req of node?.requirements ?? []) {
            if (!graph.nodes.has(req.nodeId)) continue;
            visit(req.nodeId);
        }
        for (const group of node?.anyOf ?? []) {
            for (const req of group.options ?? []) {
                if (!graph.nodes.has(req.nodeId)) continue;
                visit(req.nodeId);
            }
        }

        stack.pop();
        marks.set(nodeId, 2);
    }

    for (const nodeId of graph.nodes.keys()) visit(nodeId);
    return cycles;
}

export function validateGraphData(data) {
    const normalized = normalizeGraphData(data);

    for (const [nodeId, node] of Object.entries(normalized)) {
        for (const req of node.requirements) {
            if (!normalized[req.nodeId]) {
                throw new Error(`Requirement node is missing from graph: ${req.nodeId} (required by ${nodeId})`);
            }
        }
        for (const group of node.anyOf ?? []) {
            if (!Array.isArray(group.options) || group.options.length === 0) {
                throw new Error(`anyOf group is empty on node: ${nodeId}`);
            }
            for (const req of group.options) {
                if (!normalized[req.nodeId]) {
                    throw new Error(`anyOf option node is missing from graph: ${req.nodeId} (required by ${nodeId})`);
                }
            }
        }
    }

    const cycles = detectCycles(buildCycleGraph(normalized));
    if (cycles.length > 0) {
        const formatted = cycles.map((cycle) => cycle.join(" -> ")).join(" | ");
        throw new Error(`Cycle detected in graph: ${formatted}`);
    }

    return normalized;
}

export async function getGraphData() {
    let raw = "{}";

    try {
        raw = await game.settings.get(MODULE_ID, "graphJSON");
    } catch {
        raw = "{}";
    }

    try {
        return normalizeGraphData(JSON.parse(String(raw ?? "{}")));
    } catch {
        return {};
    }
}

export async function setGraphData(data) {
    const normalized = validateGraphData(data);
    await game.settings.set(MODULE_ID, "graphJSON", JSON.stringify(normalized, null, 2));
}

export function getActorNodeLevels(actor, graphData) {
    const levels = new Map();
    const knownNodes = new Set(Object.keys(graphData ?? {}));
    const uniqueNameToNodeId = new Map();
    const seenNames = new Set();

    for (const [nodeId, node] of Object.entries(graphData ?? {})) {
        const name = String(node?.name ?? "").trim().toLowerCase();
        if (!name) continue;
        if (seenNames.has(name)) {
            uniqueNameToNodeId.delete(name);
            continue;
        }
        seenNames.add(name);
        uniqueNameToNodeId.set(name, nodeId);
    }

    for (const item of actor?.items ?? []) {
        const candidates = getNodeRefCandidates(item);
        const level = getLevelFromActorItem(item);
        let matched = false;

        for (const candidate of candidates) {
            if (!knownNodes.has(candidate)) continue;
            const prev = levels.get(candidate) ?? 0;
            if (level > prev) levels.set(candidate, level);
            matched = true;
            break;
        }

        // Final fallback for systems where sourceId is not preserved:
        // if graph node names are unique, map by exact item name.
        if (!matched) {
            const byName = uniqueNameToNodeId.get(String(item?.name ?? "").trim().toLowerCase());
            if (byName) {
                const prev = levels.get(byName) ?? 0;
                if (level > prev) levels.set(byName, level);
            }
        }
    }

    return levels;
}

export function resolveNodeIdForItem(item, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const knownNodes = new Set(Object.keys(normalized));

    for (const candidate of getNodeRefCandidates(item)) {
        if (knownNodes.has(candidate)) return candidate;
    }

    const byNameMatches = Object.entries(normalized)
        .filter(([, node]) => String(node?.name ?? "").trim().toLowerCase() === String(item?.name ?? "").trim().toLowerCase())
        .map(([nodeId]) => nodeId);

    if (byNameMatches.length === 1) return byNameMatches[0];
    return null;
}

export async function bindItemToNode(item, nodeId) {
    if (!item?.setFlag) return null;
    const normalized = String(nodeId ?? "").trim();
    if (!normalized) return null;
    await item.setFlag(MODULE_ID, "nodeId", normalized);
    return normalized;
}

export async function ensureActorItemNodeRef(item, graphData = {}) {
    const resolved = resolveNodeIdForItem(item, graphData);
    if (!resolved) return null;
    await bindItemToNode(item, resolved);
    return resolved;
}

export async function ensureActorNodeRefs(actor, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const results = [];

    for (const item of actor?.items ?? []) {
        const nodeId = await ensureActorItemNodeRef(item, normalized);
        if (nodeId) {
            results.push({ itemId: item.id, nodeId });
        }
    }

    return results;
}

export function validateActorUnlock(actor, nodeId, targetLevel = 1, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const node = normalized[nodeId];
    if (!node) return { ok: false, reason: "missing-node", missing: [] };

    const levels = getActorNodeLevels(actor, normalized);
    const haveCurrent = levels.get(nodeId) ?? 0;
    const levelToReach = asNonNegativeInt(targetLevel);

    if (levelToReach <= haveCurrent) {
        return { ok: true, missing: [], have: haveCurrent };
    }

    const missing = [];

    // Implicit progression rule: level N requires already having level N-1.
    // This is intentionally internal and not represented as an explicit graph edge.
    if (levelToReach > 1 && haveCurrent < (levelToReach - 1)) {
        missing.push({
            nodeId,
            need: levelToReach - 1,
            have: haveCurrent,
            hasItem: levels.has(nodeId),
            implicit: true
        });
    }

    for (const req of node.requirements) {
        const have = levels.get(req.nodeId) ?? 0;
        const hasItem = levels.has(req.nodeId);

        if (req.minLevel <= 0) {
            if (!hasItem) {
                missing.push({ nodeId: req.nodeId, need: 0, have, hasItem: false });
            }
            continue;
        }

        if (have < req.minLevel) {
            missing.push({ nodeId: req.nodeId, need: req.minLevel, have, hasItem });
        }
    }

    for (const group of node.anyOf ?? []) {
        let groupSatisfied = false;
        const options = [];

        for (const req of group.options ?? []) {
            const have = levels.get(req.nodeId) ?? 0;
            const hasItem = levels.has(req.nodeId);
            options.push({ nodeId: req.nodeId, need: req.minLevel, have, hasItem });

            if (req.minLevel <= 0) {
                if (hasItem) {
                    groupSatisfied = true;
                    break;
                }
                continue;
            }

            if (have >= req.minLevel) {
                groupSatisfied = true;
                break;
            }
        }

        if (!groupSatisfied) {
            missing.push({ type: "anyOf", options });
        }
    }

    return { ok: missing.length === 0, missing, have: haveCurrent };
}

export function evaluateGraphForActor(actor, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const levels = getActorNodeLevels(actor, normalized);
    const result = {};

    for (const nodeId of Object.keys(normalized)) {
        const current = levels.get(nodeId) ?? 0;
        const check = validateActorUnlock(actor, nodeId, current + 1, normalized);

        result[nodeId] = {
            currentLevel: current,
            canAdvance: check.ok,
            missing: check.missing
        };
    }

    return result;
}

function findActorItemForNode(actor, nodeId, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    for (const item of actor?.items ?? []) {
        if (resolveNodeIdForItem(item, normalized) === nodeId) return item;
    }
    return null;
}

export async function getAvailableManeuvers(actor, options = {}) {
    const maneuverTemplate = String(options.maneuverTemplate ?? "ManeuverTemplate");
    const weaponTemplate = String(options.weaponTemplate ?? "WeaponTemplate");
    const requiredTraitField = String(options.requiredTraitField ?? "RequiredWeaponTrait");
    const weaponTraitsField = String(options.weaponTraitsField ?? "Traits");
    const includeUnavailable = options.includeUnavailable !== false;
    const requireGraphUnlock = options.requireGraphUnlock !== false;
    const graphData = options.graphData ?? await getGraphData();
    const targetLevel = asNonNegativeInt(options.targetLevel ?? 1) || 1;

    const actorItems = Array.from(actor?.items ?? []);
    const maneuvers = actorItems.filter((item) => isItemFromTemplate(item, maneuverTemplate));
    const weapons = actorItems.filter((item) => isItemFromTemplate(item, weaponTemplate) && isItemEquipped(item));

    const weaponTraitSets = weapons.map((weapon) => ({
        weapon,
        traits: new Set(parseTraitCsv(readItemField(weapon, weaponTraitsField)))
    }));

    const available = [];
    const unavailable = [];

    for (const maneuver of maneuvers) {
        const requiredTrait = normalizeToken(readItemField(maneuver, requiredTraitField));
        const traitSatisfied = requiredTrait.length === 0
            ? true
            : weaponTraitSets.some((entry) => entry.traits.has(requiredTrait));

        let graphSatisfied = true;
        let graphFailure = null;

        if (requireGraphUnlock) {
            const maneuverNodeId = resolveNodeIdForItem(maneuver, graphData);
            if (maneuverNodeId) {
                const check = validateActorUnlock(actor, maneuverNodeId, targetLevel, graphData);
                graphSatisfied = check.ok;
                if (!check.ok) graphFailure = check;
            }
        }

        if (traitSatisfied && graphSatisfied) {
            available.push(maneuver);
            continue;
        }

        if (includeUnavailable) {
            const reasons = [];
            if (!traitSatisfied) {
                reasons.push({
                    type: "weapon-trait",
                    requiredTrait,
                    equippedWeapons: weapons.length
                });
            }
            if (!graphSatisfied) {
                reasons.push({
                    type: "graph-prerequisite",
                    missing: graphFailure?.missing ?? []
                });
            }

            unavailable.push({ item: maneuver, reasons });
        }
    }

    return includeUnavailable ? { available, unavailable } : { available };
}

export function getFirstGrantableNode(actor, nodeId, targetLevel = 1, graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const levels = getActorNodeLevels(actor, normalized);
    const path = new Set();

    function key(id, lvl) {
        return `${id}::${lvl}`;
    }

    function resolveNext(id, lvlRaw) {
        const lvl = asNonNegativeInt(lvlRaw);
        const node = normalized[id];
        if (!node) return null;

        const have = levels.get(id) ?? 0;
        if (lvl <= have) return null;

        const k = key(id, lvl);
        if (path.has(k)) return null;
        path.add(k);

        // Implicit progression: level N requires N-1 on the same node.
        if (lvl > 1 && have < (lvl - 1)) {
            const implicitStep = resolveNext(id, lvl - 1);
            if (implicitStep) {
                path.delete(k);
                return implicitStep;
            }
        }

        // Explicit requirements in declared order; first resolvable branch wins.
        for (const req of node.requirements) {
            const reqHave = levels.get(req.nodeId) ?? 0;
            const reqHasItem = levels.has(req.nodeId);

            if (req.minLevel <= 0) {
                if (!reqHasItem) {
                    const child = resolveNext(req.nodeId, 1);
                    if (child) {
                        path.delete(k);
                        return child;
                    }
                }
                continue;
            }

            if (reqHave < req.minLevel) {
                const child = resolveNext(req.nodeId, req.minLevel);
                if (child) {
                    path.delete(k);
                    return child;
                }
            }
        }

        // OR requirement groups: pick first option branch when unresolved.
        for (const group of node.anyOf ?? []) {
            let groupSatisfied = false;
            let firstMissingOption = null;

            for (const req of group.options ?? []) {
                const reqHave = levels.get(req.nodeId) ?? 0;
                const reqHasItem = levels.has(req.nodeId);

                if (req.minLevel <= 0) {
                    if (reqHasItem) {
                        groupSatisfied = true;
                        break;
                    }
                    if (!firstMissingOption) firstMissingOption = { nodeId: req.nodeId, level: 1 };
                    continue;
                }

                if (reqHave >= req.minLevel) {
                    groupSatisfied = true;
                    break;
                }
                if (!firstMissingOption) firstMissingOption = { nodeId: req.nodeId, level: req.minLevel };
            }

            if (!groupSatisfied && firstMissingOption) {
                const child = resolveNext(firstMissingOption.nodeId, firstMissingOption.level);
                if (child) {
                    path.delete(k);
                    return child;
                }
            }
        }

        path.delete(k);
        return {
            nodeId: id,
            level: lvl,
            currentLevel: have,
            name: node.name || id,
            type: node.type || "item"
        };
    }

    return resolveNext(nodeId, targetLevel);
}

export async function getFirstGrantableNodeFromWorldGraph(actor, nodeId, targetLevel = 1) {
    const graphData = await getGraphData();
    return getFirstGrantableNode(actor, nodeId, targetLevel, graphData);
}

export async function grantFirstAvailableNode(actor, nodeId, targetLevel = 1, options = {}) {
    const graphData = options.graphData ?? await getGraphData();
    const next = getFirstGrantableNode(actor, nodeId, targetLevel, graphData);
    if (!next) return { ok: false, reason: "nothing-to-grant", granted: null };

    const existing = findActorItemForNode(actor, next.nodeId, graphData);
    if (existing) {
        const currentLevel = Number(existing.getFlag(MODULE_ID, "skillTree")?.level ?? 1);
        const newLevel = Math.max(currentLevel, Number(next.level ?? 1));
        await existing.setFlag(MODULE_ID, "skillTree", { level: newLevel });
        await bindItemToNode(existing, next.nodeId);

        return {
            ok: true,
            granted: {
                nodeId: next.nodeId,
                level: newLevel,
                itemId: existing.id,
                created: false
            }
        };
    }

    const sourceDoc = await fromUuid(next.nodeId).catch(() => null);
    if (!sourceDoc || sourceDoc.documentName !== "Item") {
        return { ok: false, reason: "source-not-found", granted: null, next };
    }

    const createData = sourceDoc.toObject();
    createData.flags ??= {};
    createData.flags.core ??= {};
    createData.flags[MODULE_ID] ??= {};
    createData.flags.core.sourceId = next.nodeId;
    createData.flags[MODULE_ID].nodeId = next.nodeId;
    createData.flags[MODULE_ID].skillTree = { level: Number(next.level ?? 1) };

    const [created] = await actor.createEmbeddedDocuments("Item", [createData]);
    return {
        ok: true,
        granted: {
            nodeId: next.nodeId,
            level: Number(next.level ?? 1),
            itemId: created?.id ?? null,
            created: true
        }
    };
}

export function buildSkillGraph(graphData = {}) {
    const normalized = normalizeGraphData(graphData);
    const nodes = new Map();

    for (const [nodeId, node] of Object.entries(normalized)) {
        nodes.set(nodeId, {
            nodeId,
            name: node.name || nodeId,
            type: node.type || "item",
            requirements: node.requirements,
            anyOf: node.anyOf ?? []
        });
    }

    return { nodes };
}

export function exportGraphData(graph) {
    const out = {};
    for (const [nodeId, node] of graph.nodes.entries()) {
        out[nodeId] = {
            name: String(node?.name ?? ""),
            type: String(node?.type ?? ""),
            requirements: Array.isArray(node?.requirements) ? node.requirements.map((req) => ({
                nodeId: String(req?.nodeId ?? ""),
                minLevel: asNonNegativeInt(req?.minLevel)
            })).filter((req) => req.nodeId.length > 0) : [],
            anyOf: Array.isArray(node?.anyOf)
                ? node.anyOf
                    .map((group) => {
                        const options = Array.isArray(group?.options) ? group.options : [];
                        const normalizedOptions = options.map((req) => ({
                            nodeId: String(req?.nodeId ?? ""),
                            minLevel: asNonNegativeInt(req?.minLevel)
                        })).filter((req) => req.nodeId.length > 0);
                        return normalizedOptions.length ? { options: normalizedOptions } : null;
                    })
                    .filter(Boolean)
                : []
        };
    }
    return normalizeGraphData(out);
}

export async function importGraphData(_actor, data) {
    await setGraphData(data);
}

export async function setNodeLevel(actor, nodeId, targetLevel) {
    const data = await getGraphData();
    return validateActorUnlock(actor, nodeId, targetLevel, data);
}

export async function setSkillLevel(actor, skillId, targetLevel) {
    return setNodeLevel(actor, skillId, targetLevel);
}
