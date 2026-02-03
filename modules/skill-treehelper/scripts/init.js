// scripts/init.js
import { NODES as DEFAULT_NODES } from "./nodeData.js";
import { checkNode } from "./nodeLogic.js";
import { SkillTreeNodeEditor } from "./node-editor.js";

Hooks.once("init", () => {
    // Store defaults so the editor can reset
    const defaultJSON = JSON.stringify(DEFAULT_NODES, null, 2);

    game.settings.register("skilltree-helper", "nodesJSON", {
        name: "SkillTree Nodes (JSON)",
        hint: "Stored per world. Use the editor menu to modify.",
        scope: "world",
        config: false,           // hidden (we show via menu)
        type: String,
        default: defaultJSON
    });

    game.settings.registerMenu("skilltree-helper", "node-editor", {
        name: "SkillTree Node Editor",
        label: "Open Editor",
        hint: "Edit SkillTree nodes in a GUI.",
        icon: "fas fa-project-diagram",
        type: SkillTreeNodeEditor,
        restricted: true
    });
});

Hooks.once("ready", async () => {
    // Load nodes from world setting (edited) or fallback to defaults
    let nodes;
    try {
        const raw = await game.settings.get("skilltree-helper", "nodesJSON");
        nodes = JSON.parse(raw);
    } catch {
        nodes = DEFAULT_NODES;
    }

    globalThis.SkillTree = {
        DEFAULT_NODES,  // for reset button
        NODES: nodes,   // the editable runtime data
        checkNode
    };

    console.log("SkillTree Helper loaded:", globalThis.SkillTree);
});
