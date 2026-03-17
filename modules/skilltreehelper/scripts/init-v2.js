import { SkillTreeNodeEditor } from "./node-editor-v2.js";
import {
    buildSkillGraph,
    detectCycles,
    validateGraphData,
    getGraphData,
    setGraphData,
    getActorNodeLevels,
    resolveNodeIdForItem,
    bindItemToNode,
    ensureActorItemNodeRef,
    ensureActorNodeRefs,
    validateActorUnlock,
    evaluateGraphForActor,
    getAvailableManeuvers,
    getFirstGrantableNode,
    getFirstGrantableNodeFromWorldGraph,
    grantFirstAvailableNode,
    normalizeGraphData,
    exportGraphData,
    importGraphData,
    setNodeLevel,
    setSkillLevel
} from "./nodeLogic.js";

const MODULE_ID = "skilltreehelper";

function readGraphDataSync() {
    try {
        const raw = game.settings.get(MODULE_ID, "graphJSON");
        return normalizeGraphData(JSON.parse(String(raw ?? "{}")));
    } catch {
        return {};
    }
}

function createSkillTreeApi() {
    const api = {
        buildSkillGraph,
        detectCycles,
        validateGraphData,
        getGraphData,
        setGraphData,
        getActorNodeLevels,
        resolveNodeIdForItem,
        bindItemToNode,
        ensureActorItemNodeRef,
        ensureActorNodeRefs,
        validateActorUnlock,
        evaluateGraphForActor,
        getAvailableManeuvers,
        getFirstGrantableNode,
        getFirstGrantableNodeFromWorldGraph,
        grantFirstAvailableNode,
        normalizeGraphData,
        exportGraphData,
        importGraphData,
        setNodeLevel,
        setSkillLevel,
        nextStepToward(actor, nodeId, targetLevel = 1, graphData = null) {
            const resolvedGraph = graphData ?? readGraphDataSync();
            return getFirstGrantableNode(actor, nodeId, targetLevel, resolvedGraph);
        }
    };

    Object.defineProperty(api, "NODES", {
        configurable: true,
        enumerable: true,
        get() {
            return buildSkillGraph(readGraphDataSync()).nodes;
        }
    });

    return api;
}

Hooks.once("init", () => {
    globalThis.SkillTree = createSkillTreeApi();

    game.settings.register(MODULE_ID, "graphJSON", {
        name: "SkillTree Graph JSON",
        hint: "World-level graph configuration for item prerequisites.",
        scope: "world",
        config: false,
        type: String,
        default: "{}"
    });

    game.settings.registerMenu(MODULE_ID, "node-editor", {
        name: "SkillTree Graph Editor",
        label: "Open Editor",
        hint: "Edit world-level item prerequisite graph.",
        icon: "fas fa-project-diagram",
        type: SkillTreeNodeEditor,
        restricted: true
    });
});

Hooks.once("ready", () => {
    globalThis.SkillTree = createSkillTreeApi();

    console.log("SkillTree Helper loaded:", globalThis.SkillTree);
});

Hooks.on("createItem", async (item) => {
    try {
        if (!item?.parent || item.parent.documentName !== "Actor") return;
        if (item.getFlag(MODULE_ID, "nodeId")) return;

        const graph = await getGraphData();
        await ensureActorItemNodeRef(item, graph);
    } catch (error) {
        console.warn("SkillTree failed to bind nodeId on createItem", error);
    }
});
