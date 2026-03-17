import {
    detectCycles,
    getGraphData,
    normalizeGraphData,
    setGraphData,
    validateGraphData
} from "./nodeLogic.js";

const MODULE_PATH = "modules/skilltreehelper";
const CYTOSCAPE_URL = `${MODULE_PATH}/vendor/cytoscape.min.js`;
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function resolveCytoscapeFactory() {
    if (typeof globalThis.cytoscape === "function") return globalThis.cytoscape;
    if (typeof globalThis.cytoscape?.default === "function") return globalThis.cytoscape.default;

    const cjs = globalThis.module?.exports;
    if (typeof cjs === "function") return cjs;
    if (typeof cjs?.default === "function") return cjs.default;

    return null;
}

async function ensureCytoscapeLoaded() {
    const preloaded = resolveCytoscapeFactory();
    if (preloaded) return preloaded;

    if (!globalThis.__skillTreeCytoscapePromise) {
        globalThis.__skillTreeCytoscapePromise = new Promise((resolve, reject) => {
            const originalAssign = Object.assign;
            const safeAssign = function safeAssign(target, ...sources) {
                try {
                    return originalAssign(target, ...sources);
                } catch {
                    if (target == null) throw new TypeError("Cannot convert undefined or null to object");
                    const out = Object(target);
                    for (const src of sources) {
                        if (src == null) continue;
                        for (const key of Reflect.ownKeys(src)) {
                            try {
                                out[key] = src[key];
                            } catch {
                                // Ignore readonly assignment collisions (e.g. `equals`)
                            }
                        }
                    }
                    return out;
                }
            };
            Object.assign = safeAssign;

            const restoreAssign = () => {
                Object.assign = originalAssign;
            };

            const existing = document.querySelector(`script[src='${CYTOSCAPE_URL}']`);
            if (existing) {
                existing.addEventListener("load", () => {
                    restoreAssign();
                    const cy = resolveCytoscapeFactory();
                    if (!cy) {
                        reject(new Error("Cytoscape loaded but no callable factory was found."));
                        return;
                    }
                    globalThis.cytoscape = cy;
                    resolve(cy);
                }, { once: true });
                existing.addEventListener("error", () => {
                    restoreAssign();
                    reject(new Error("Failed to load Cytoscape."));
                }, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = CYTOSCAPE_URL;
            script.async = true;
            script.onload = () => {
                restoreAssign();
                const cy = resolveCytoscapeFactory();
                if (!cy) {
                    reject(new Error("Cytoscape loaded but no callable factory was found."));
                    return;
                }
                globalThis.cytoscape = cy;
                resolve(cy);
            };
            script.onerror = () => {
                restoreAssign();
                reject(new Error("Failed to load Cytoscape."));
            };
            document.head.appendChild(script);
        });
    }

    return globalThis.__skillTreeCytoscapePromise;
}

function parseMinLevelOrNull(input) {
    if (input == null) return null;
    const trimmed = String(input).trim();
    if (!trimmed) return 0;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return NaN;
    return Math.floor(parsed);
}

function extractItemIdFromUuid(uuid) {
    const parts = String(uuid ?? "").split(".");
    return parts.at(-1) ?? "";
}

async function resolveNodeReferenceFromDrop(document, fallbackUuid) {
    if (!document || document.documentName !== "Item") return null;

    if (document.parent?.documentName === "Actor") {
        const sourceUuid = String(document.flags?.core?.sourceId ?? "").trim();
        if (!sourceUuid) return null;

        const sourceDoc = await fromUuid(sourceUuid).catch(() => null);
        return {
            nodeId: sourceUuid,
            name: sourceDoc?.name ?? document.name ?? sourceUuid,
            type: sourceDoc?.type ?? document.type ?? "item"
        };
    }

    const nodeId = String(document.uuid ?? fallbackUuid ?? "").trim();
    if (!nodeId) return null;

    return {
        nodeId,
        name: document.name ?? extractItemIdFromUuid(nodeId),
        type: document.type ?? "item"
    };
}

function cycleCountForData(graphData) {
    return detectCycles({
        nodes: new Map(Object.entries(graphData).map(([nodeId, node]) => [nodeId, {
            requirements: node.requirements ?? [],
            anyOf: node.anyOf ?? []
        }]))
    }).length;
}

function graphLayoutOptions() {
    return {
        name: "cose",
        animate: false,
        fit: true,
        padding: 28,
        nodeRepulsion: 160000,
        idealEdgeLength: 120,
        edgeElasticity: 100,
        nestingFactor: 0.9,
        gravity: 40,
        componentSpacing: 80
    };
}

export class SkillTreeNodeEditor extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "skilltree-node-editor",
        classes: ["skilltree-node-editor"],
        tag: "section",
        window: {
            title: "SkillTree Graph Editor",
            icon: "fas fa-project-diagram"
        },
        position: {
            width: 980,
            height: 760
        },
        dragDrop: [{ dropSelector: "[data-role='cy-canvas']" }]
    };

    static PARTS = {
        main: {
            template: `${MODULE_PATH}/templates/node-editor.html`
        }
    };

    constructor(options = {}) {
        super(options);
        this._cy = null;
        this._graphData = {};
        this._pendingSourceNodeId = null;
        this._activeTab = "graph";
    }

    async _prepareContext() {
        this._graphData = await getGraphData();

        return {
            json: JSON.stringify(this._graphData, null, 2),
            cycleCount: cycleCountForData(this._graphData),
            nodeCount: Object.keys(this._graphData).length
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        const root = this._getRootElement();
        if (!root) return;

        const formatBtn = root.querySelector("[data-action='format']");
        const applyBtn = root.querySelector("[data-action='apply-json']");
        const validateBtn = root.querySelector("[data-action='validate']");
        const arrangeBtn = root.querySelector("[data-action='arrange']");
        const fitBtn = root.querySelector("[data-action='fit']");
        const tabButtons = root.querySelectorAll("[data-tab-button]");
        const textarea = root.querySelector("textarea[name='json']");
        const canvas = root.querySelector("[data-role='cy-canvas']");
        const form = root.querySelector("form") ?? (root.matches("form") ? root : null);

        formatBtn?.addEventListener("click", () => this._onFormat());
        applyBtn?.addEventListener("click", () => this._applyJsonToGraph());
        validateBtn?.addEventListener("click", () => this._onValidate());
        arrangeBtn?.addEventListener("click", () => this._runGraphLayout());
        fitBtn?.addEventListener("click", () => this._cy?.fit(undefined, 32));
        textarea?.addEventListener("change", () => this._applyJsonToGraph());
        tabButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const tab = String(btn.dataset.tabTarget ?? "graph");
                this._setActiveTab(tab, root);
            });
        });

        if (canvas) {
            canvas.addEventListener("dragover", (event) => event.preventDefault());
            canvas.addEventListener("drop", (event) => this._onDropNode(event));
        }

        form?.addEventListener("submit", (event) => this._onSubmitGraph(event));

        await this._initGraph();
        this._setActiveTab(this._activeTab, root);
    }

    async close(options = {}) {
        this._destroyGraph();
        return super.close(options);
    }

    _canDragDrop() {
        return true;
    }

    async _onDrop(event) {
        await this._onDropNode(event);
    }

    _getTextarea() {
        const root = this._getRootElement();
        return root?.querySelector("textarea[name='json']") ?? null;
    }

    _getRootElement() {
        if (this.element instanceof HTMLElement) return this.element;
        if (Array.isArray(this.element) && this.element[0] instanceof HTMLElement) return this.element[0];
        if (this.element?.[0] instanceof HTMLElement) return this.element[0];
        return null;
    }

    _setActiveTab(tab, rootElement = null) {
        this._activeTab = tab === "json" ? "json" : "graph";
        const root = rootElement ?? this._getRootElement();
        if (!root) return;

        const buttons = root.querySelectorAll("[data-tab-button]");
        buttons.forEach((btn) => {
            btn.classList.toggle("active", String(btn.dataset.tabTarget) === this._activeTab);
        });

        const sections = root.querySelectorAll("[data-tab]");
        sections.forEach((section) => {
            const show = section.getAttribute("data-tab") === this._activeTab;
            section.style.display = show ? "" : "none";
        });

        if (this._activeTab === "graph" && this._cy) {
            this._cy.resize();
            this._cy.fit(undefined, 20);
        }
    }

    _destroyGraph() {
        if (this._cy) {
            this._cy.destroy();
            this._cy = null;
        }
        this._pendingSourceNodeId = null;
        this._setHoveredNodeLabel("");
    }

    async _initGraph() {
        const root = this._getRootElement();
        const canvas = root?.querySelector("[data-role='cy-canvas']");
        if (!canvas) return;

        try {
            await ensureCytoscapeLoaded();
        } catch (error) {
            ui.notifications.error("Could not load vendored Cytoscape script.");
            console.error(error);
            return;
        }

        this._destroyGraph();

        const cytoscapeFactory = resolveCytoscapeFactory();
        if (!cytoscapeFactory) {
            ui.notifications.error("Cytoscape loaded but factory is unavailable.");
            return;
        }

        this._cy = cytoscapeFactory({
            container: canvas,
            elements: this._toElements(),
            style: [
                {
                    selector: "node",
                    style: {
                        "background-color": "#2f6db6",
                        "label": "data(label)",
                        "shape": "round-rectangle",
                        "text-wrap": "wrap",
                        "text-max-width": 220,
                        "color": "#ffffff",
                        "font-size": 12,
                        "text-margin-y": 1,
                        "text-valign": "center",
                        "text-halign": "center",
                        "border-width": 2,
                        "border-color": "#d8e7ff",
                        "padding": "14px",
                        "width": "label",
                        "height": "label",
                        "min-width": 96,
                        "min-height": 64
                    }
                },
                {
                    selector: "edge",
                    style: {
                        "curve-style": "bezier",
                        "target-arrow-shape": "triangle",
                        "line-color": "#7e8794",
                        "target-arrow-color": "#7e8794",
                        "label": "data(label)",
                        "font-size": 10,
                        "text-background-color": "#ffffff",
                        "text-background-opacity": 0.85,
                        "text-background-padding": 2,
                        "width": 2
                    }
                },
                {
                    selector: "node.hovered",
                    style: {
                        "border-color": "#ffd166",
                        "border-width": 4
                    }
                },
                {
                    selector: "edge[relation = 'or']",
                    style: {
                        "line-style": "dashed",
                        "line-color": "#4ca66a",
                        "target-arrow-color": "#4ca66a"
                    }
                },
                {
                    selector: "node.pending",
                    style: {
                        "border-color": "#ffd166",
                        "border-width": 4
                    }
                }
            ],
            layout: graphLayoutOptions(),
            wheelSensitivity: 0.2
        });

        this._bindGraphEvents();
        this._syncHoverLabelFromSelection();
    }

    _bindGraphEvents() {
        if (!this._cy) return;

        this._cy.on("tap", "node", (event) => {
            const originalEvent = event.originalEvent ?? {};
            this._setHoveredNodeLabel(event.target.data("label") ?? event.target.id());
            this._onNodeTapped(event.target.id(), {
                shiftKey: !!originalEvent.shiftKey,
                altKey: !!originalEvent.altKey
            });
        });
        this._cy.on("tap", "edge", (event) => this._onEdgeTapped(event.target));
        this._cy.on("mouseover", "node", (event) => {
            this._cy?.nodes().removeClass("hovered");
            event.target.addClass("hovered");
            this._setHoveredNodeLabel(event.target.data("label") ?? event.target.id());
        });
        this._cy.on("mouseout", "node", () => {
            this._cy?.nodes().removeClass("hovered");
            this._syncHoverLabelFromSelection();
        });
        this._cy.on("tap", (event) => {
            if (event.target === this._cy) this._syncHoverLabelFromSelection();
        });

        this._cy.on("cxttap", "edge", (event) => {
            const relation = String(event.target.data("relation") ?? "and");
            const source = event.target.data("source");
            const target = event.target.data("target");
            const groupIndex = Number(event.target.data("groupIndex"));

            if (relation === "or") this._removeOrDependency(source, target, groupIndex);
            else this._removeDependency(source, target);
            this._rebuildGraphView();
            ui.notifications.info("Dependency removed.");
        });

        this._cy.on("cxttap", "node", (event) => this._onNodeContext(event.target.id()));
    }

    _toElements() {
        const nodes = Object.keys(this._graphData).map((nodeId) => {
            const node = this._graphData[nodeId];
            const itemName = node.name || extractItemIdFromUuid(nodeId);

            return {
                data: {
                    id: nodeId,
                    label: itemName
                }
            };
        });

        const edges = [];
        let edgeIndex = 0;
        for (const [targetId, node] of Object.entries(this._graphData)) {
            for (const req of node.requirements ?? []) {
                const sourceId = req.nodeId;
                if (!this._graphData[sourceId]) continue;
                const minLevel = Number(req.minLevel ?? 0);
                edgeIndex += 1;
                edges.push({
                    data: {
                        id: `dep_${edgeIndex}`,
                        source: sourceId,
                        target: targetId,
                        minLevel,
                        relation: "and",
                        label: minLevel > 0 ? `Lvl ${minLevel}` : "Item"
                    }
                });
            }

            (node.anyOf ?? []).forEach((group, groupIndex) => {
                for (const req of group.options ?? []) {
                    const sourceId = req.nodeId;
                    if (!this._graphData[sourceId]) continue;
                    const minLevel = Number(req.minLevel ?? 0);
                    edgeIndex += 1;
                    edges.push({
                        data: {
                            id: `dep_or_${edgeIndex}`,
                            source: sourceId,
                            target: targetId,
                            minLevel,
                            relation: "or",
                            groupIndex,
                            label: minLevel > 0 ? `OR Lvl ${minLevel}` : "OR Item"
                        }
                    });
                }
            });
        }

        return [...nodes, ...edges];
    }

    _syncTextarea() {
        const ta = this._getTextarea();
        if (!ta) return;
        ta.value = JSON.stringify(this._graphData, null, 2);
    }

    _syncSummary() {
        const root = this._getRootElement();
        const counter = root?.querySelector("[data-role='graph-count']");
        const cycle = root?.querySelector("[data-role='cycle-count']");

        if (counter) counter.textContent = String(Object.keys(this._graphData).length);
        if (cycle) cycle.textContent = String(cycleCountForData(this._graphData));
    }

    _rebuildGraphView() {
        if (!this._cy) return;

        const pending = this._pendingSourceNodeId;
        this._cy.elements().remove();
        this._cy.add(this._toElements());
        this._runGraphLayout();

        if (pending) {
            const node = this._cy.getElementById(pending);
            if (node?.length) node.addClass("pending");
        }

        this._syncHoverLabelFromSelection();
        this._syncTextarea();
        this._syncSummary();
    }

    _runGraphLayout() {
        if (!this._cy) return;
        this._cy.layout(graphLayoutOptions()).run();
    }

    _setHoveredNodeLabel(label) {
        const root = this._getRootElement();
        const target = root?.querySelector("[data-role='node-label']");
        if (!target) return;

        const text = String(label ?? "").trim();
        target.textContent = text || "Hover or click a node to inspect its full name.";
    }

    _syncHoverLabelFromSelection() {
        if (!this._cy) {
            this._setHoveredNodeLabel("");
            return;
        }

        const pending = this._pendingSourceNodeId ? this._graphData[this._pendingSourceNodeId]?.name : "";
        if (pending) {
            this._setHoveredNodeLabel(`Selected source: ${pending}`);
            return;
        }

        const selected = this._cy.$("node:selected").first();
        if (selected?.length) {
            this._setHoveredNodeLabel(selected.data("label") ?? selected.id());
            return;
        }

        this._setHoveredNodeLabel("");
    }

    _parseJSON(raw) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Root must be an object keyed by item UUID.");
        }

        return normalizeGraphData(parsed);
    }

    _applyJsonToGraph() {
        try {
            const raw = String(this._getTextarea()?.value ?? "{}");
            this._graphData = validateGraphData(this._parseJSON(raw));
            this._pendingSourceNodeId = null;
            this._rebuildGraphView();
            ui.notifications.info("Graph updated from JSON.");
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }

    _onFormat() {
        try {
            const ta = this._getTextarea();
            if (!ta) return;

            const parsed = validateGraphData(this._parseJSON(ta.value));
            ta.value = JSON.stringify(parsed, null, 2);
            this._graphData = parsed;
            this._pendingSourceNodeId = null;
            this._rebuildGraphView();
            ui.notifications.info("Graph JSON formatted.");
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }

    _onValidate() {
        try {
            const raw = String(this._getTextarea()?.value ?? "{}");
            validateGraphData(this._parseJSON(raw));
            ui.notifications.info("Graph is valid and cycle-free.");
        } catch (error) {
            ui.notifications.error(error.message);
        }
    }

    async _onDropNode(event) {
        event.preventDefault();

        let dragData = null;
        try {
            dragData = TextEditor.getDragEventData(event);
        } catch (error) {
            console.debug("SkillTree drop parse failed via TextEditor.getDragEventData", error);
        }

        if (!dragData) {
            const raw = event?.dataTransfer?.getData("text/plain");
            if (raw) {
                try {
                    dragData = JSON.parse(raw);
                } catch {
                    dragData = { uuid: raw };
                }
            }
        }

        const uuid = String(dragData?.uuid ?? "").trim();
        const itemType = String(dragData?.type ?? dragData?.documentName ?? "");
        if (!uuid || (itemType && itemType !== "Item")) {
            console.debug("SkillTree drop ignored: unsupported payload", dragData);
            ui.notifications.warn("Drop an Item document into the graph.");
            return;
        }

        const dropped = await fromUuid(uuid).catch(() => null);
        const resolved = await resolveNodeReferenceFromDrop(dropped, uuid);
        if (!resolved) {
            ui.notifications.warn("Drop a world/compendium item, or an actor item with a valid source item.");
            return;
        }

        const current = this._graphData[resolved.nodeId] ?? { requirements: [] };
        this._graphData[resolved.nodeId] = {
            ...current,
            name: resolved.name,
            type: resolved.type,
            requirements: Array.isArray(current.requirements) ? current.requirements : []
        };

        this._rebuildGraphView();
        ui.notifications.info(`Node added: ${resolved.name}`);
    }

    _onNodeTapped(nodeId, modifiers = {}) {
        if (!this._cy) return;

        if (!this._pendingSourceNodeId) {
            this._pendingSourceNodeId = nodeId;
            this._cy.nodes().removeClass("pending");
            this._cy.getElementById(nodeId).addClass("pending");
            ui.notifications.info("Selected prerequisite node. Click a target node to create dependency.");
            return;
        }

        const sourceId = this._pendingSourceNodeId;
        this._pendingSourceNodeId = null;
        this._cy.nodes().removeClass("pending");

        if (sourceId === nodeId) return;

        const response = window.prompt("Minimum required level (blank = just require item)", "1");
        const minLevel = parseMinLevelOrNull(response);
        if (minLevel == null) return;
        if (Number.isNaN(minLevel)) {
            ui.notifications.error("Level must be an integer >= 0.");
            return;
        }

        const orMode = modifiers.shiftKey || modifiers.altKey;
        if (orMode) {
            const groupText = window.prompt("OR group index on target (blank = new group)", "");
            const parsedGroup = String(groupText ?? "").trim();
            const groupIndex = parsedGroup.length ? Number(parsedGroup) : null;
            if (parsedGroup.length && (!Number.isInteger(groupIndex) || groupIndex < 0)) {
                ui.notifications.error("OR group index must be a non-negative integer.");
                return;
            }
            this._setOrDependency(sourceId, nodeId, minLevel, groupIndex);
            ui.notifications.info("OR dependency created.");
        } else {
            this._setDependency(sourceId, nodeId, minLevel);
            ui.notifications.info("Dependency created.");
        }

        this._rebuildGraphView();
    }

    _onEdgeTapped(edge) {
        const sourceId = edge.data("source");
        const targetId = edge.data("target");
        const current = Number(edge.data("minLevel") ?? 0);
        const relation = String(edge.data("relation") ?? "and");
        const groupIndex = Number(edge.data("groupIndex"));

        const response = window.prompt("Set minimum level for this dependency (blank = item only)", String(current));
        const minLevel = parseMinLevelOrNull(response);
        if (minLevel == null) return;
        if (Number.isNaN(minLevel)) {
            ui.notifications.error("Level must be an integer >= 0.");
            return;
        }

        if (relation === "or") this._setOrDependency(sourceId, targetId, minLevel, groupIndex);
        else this._setDependency(sourceId, targetId, minLevel);
        this._rebuildGraphView();
        ui.notifications.info("Dependency updated.");
    }

    _onNodeContext(nodeId) {
        const node = this._graphData[nodeId];
        if (!node) return;

        const response = window.prompt("Node name, or type 'delete' to remove", String(node.name || ""));
        if (response == null) return;

        const trimmed = String(response).trim();
        if (!trimmed) {
            ui.notifications.warn("Name cannot be empty. Type 'delete' to remove node.");
            return;
        }

        if (trimmed.toLowerCase() === "delete") {
            delete this._graphData[nodeId];
            for (const candidate of Object.values(this._graphData)) {
                candidate.requirements = (candidate.requirements ?? []).filter((req) => req.nodeId !== nodeId);
                candidate.anyOf = (candidate.anyOf ?? [])
                    .map((group) => ({
                        options: (group?.options ?? []).filter((req) => req.nodeId !== nodeId)
                    }))
                    .filter((group) => group.options.length > 0);
            }
            this._pendingSourceNodeId = null;
            this._rebuildGraphView();
            ui.notifications.info("Node removed.");
            return;
        }

        node.name = trimmed;
        this._rebuildGraphView();
        ui.notifications.info("Node name updated.");
    }

    _setDependency(sourceId, targetId, minLevel) {
        const target = this._graphData[targetId];
        if (!target) return;

        target.requirements ??= [];
        const existing = target.requirements.find((req) => req.nodeId === sourceId);
        if (existing) existing.minLevel = minLevel;
        else target.requirements.push({ nodeId: sourceId, minLevel });
    }

    _setOrDependency(sourceId, targetId, minLevel, groupIndex = null) {
        const target = this._graphData[targetId];
        if (!target) return;

        target.anyOf ??= [];
        const resolvedIndex = Number.isInteger(groupIndex) && groupIndex >= 0 ? groupIndex : target.anyOf.length;
        if (!target.anyOf[resolvedIndex]) {
            target.anyOf[resolvedIndex] = { options: [] };
        }

        const group = target.anyOf[resolvedIndex];
        group.options ??= [];
        const existing = group.options.find((req) => req.nodeId === sourceId);
        if (existing) existing.minLevel = minLevel;
        else group.options.push({ nodeId: sourceId, minLevel });
    }

    _removeDependency(sourceId, targetId) {
        const target = this._graphData[targetId];
        if (!target) return;
        target.requirements = (target.requirements ?? []).filter((req) => req.nodeId !== sourceId);
    }

    _removeOrDependency(sourceId, targetId, groupIndex) {
        const target = this._graphData[targetId];
        if (!target) return;
        if (!Array.isArray(target.anyOf)) return;
        if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= target.anyOf.length) return;

        const group = target.anyOf[groupIndex];
        if (!group || !Array.isArray(group.options)) return;

        group.options = group.options.filter((req) => req.nodeId !== sourceId);
        target.anyOf = target.anyOf
            .map((g) => ({ options: Array.isArray(g?.options) ? g.options : [] }))
            .filter((g) => g.options.length > 0);
    }

    async _onSubmitGraph(event) {
        event.preventDefault();

        try {
            const parsed = validateGraphData(this._parseJSON(String(this._getTextarea()?.value ?? "{}")));
            await setGraphData(parsed);

            this._graphData = parsed;
            ui.notifications.info("Global graph saved.");
            await this.render({ force: true });
        } catch (error) {
            ui.notifications.error(error.message);
            console.error(error);
        }
    }
}
