// scripts/node-editor.js
export class SkillTreeNodeEditor extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "skilltree-node-editor",
            title: "SkillTree Node Editor",
            template: "modules/skilltree-helper/templates/nodeEditor.hbs",
            width: 700,
            height: "auto",
            closeOnSubmit: true,
            resizable: true
        });
    }

    async getData() {
        const json = await game.settings.get("skilltree-helper", "nodesJSON");
        return { json };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find("[data-action='validate']").on("click", () => this._onValidate(html));
        html.find("[data-action='reset']").on("click", () => this._onReset(html));
        html.find("[data-action='export']").on("click", () => this._onExport(html));
        html.find("[data-action='import']").on("click", () => this._onImport(html));

        // When a file is selected, load it
        html.find("input[name='importFile']").on("change", (ev) => this._onFileSelected(html, ev));
    }

    _parseJSON(raw) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            throw new Error(`Invalid JSON: ${e.message}`);
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Root must be an object.");
        }
        return parsed;
    }

    _basicValidateNodes(nodes) {
        for (const [nodeName, levels] of Object.entries(nodes)) {
            if (!levels || typeof levels !== "object" || Array.isArray(levels)) {
                throw new Error(`Node "${nodeName}" must be an object of levels.`);
            }
            for (const [lvl, reqs] of Object.entries(levels)) {
                if (lvl.startsWith("_")) continue; // allow metadata keys later

                if (!reqs || typeof reqs !== "object" || Array.isArray(reqs)) {
                    throw new Error(`Node "${nodeName}" level "${lvl}" must be an object of requirements.`);
                }
                for (const [reqName, reqLevel] of Object.entries(reqs)) {
                    const n = Number(reqLevel);
                    if (!Number.isFinite(n) || n < 0) {
                        throw new Error(`Requirement "${nodeName}" level "${lvl}" -> "${reqName}" must be a number >= 0.`);
                    }
                }
            }
        }
    }

    async _onValidate(html) {
        const raw = html.find("textarea[name='json']").val();
        try {
            const nodes = this._parseJSON(raw);
            this._basicValidateNodes(nodes);
            ui.notifications.info("SkillTree JSON looks valid.");
        } catch (e) {
            ui.notifications.error(e.message);
            console.error(e);
        }
    }

    async _onReset(html) {
        const defaults = globalThis.SkillTree?.DEFAULT_NODES;
        if (!defaults) {
            ui.notifications.error("Default nodes not found (module not initialized yet).");
            return;
        }
        html.find("textarea[name='json']").val(JSON.stringify(defaults, null, 2));
        ui.notifications.info("Reset to module default (not saved yet).");
    }

    async _onExport(html) {
        const raw = html.find("textarea[name='json']").val();

        // Validate before exporting (prevents exporting broken JSON)
        try {
            const nodes = this._parseJSON(raw);
            this._basicValidateNodes(nodes);

            const pretty = JSON.stringify(nodes, null, 2);
            const blob = new Blob([pretty], { type: "application/json" });

            const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
            const filename = `skilltree-nodes-${stamp}.json`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            ui.notifications.info(`Exported ${filename}`);
        } catch (e) {
            ui.notifications.error(e.message);
            console.error(e);
        }
    }

    async _onImport(html) {
        // Open file picker
        const input = html.find("input[name='importFile']")[0];
        if (!input) {
            ui.notifications.error("Import input not found.");
            return;
        }
        input.value = ""; // allow selecting the same file twice
        input.click();
    }

    async _onFileSelected(html, ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const nodes = this._parseJSON(text);
            this._basicValidateNodes(nodes);

            // Put it into the editor (not saved yet)
            html.find("textarea[name='json']").val(JSON.stringify(nodes, null, 2));
            ui.notifications.info(`Imported "${file.name}" (not saved yet).`);
        } catch (e) {
            ui.notifications.error(e.message);
            console.error(e);
        } finally {
            // Clear selection
            ev.target.value = "";
        }
    }

    async _updateObject(_event, formData) {
        const raw = formData.json;
        try {
            const nodes = this._parseJSON(raw);
            this._basicValidateNodes(nodes);

            await game.settings.set("skilltree-helper", "nodesJSON", JSON.stringify(nodes, null, 2));

            // Update runtime immediately
            if (globalThis.SkillTree) {
                globalThis.SkillTree.NODES = nodes;
            }

            ui.notifications.info("SkillTree nodes saved.");
        } catch (e) {
            ui.notifications.error(e.message);
            console.error(e);
        }
    }
}
