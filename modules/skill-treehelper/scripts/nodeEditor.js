// scripts/node-editor.js
import { SKILL_KEYS, STAT_KEYS, TRAIT_KEYS, ALL_KEYS } from "./keys.js";
export class SkillTreeNodeEditor extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "skilltree-node-editor",
            title: "SkillTree Node Editor",
            template: "modules/skilltree-helper/templates/node-editor.hbs",
            width: 760,
            height: "auto",
            closeOnSubmit: true,
            resizable: true
        });
    }

    constructor(...args) {
        super(...args);
        this._suggestions = null; // {skills:[], stats:[], traits:[], all:[]}
    }

    // ---------- Helpers ----------
    _getProps(doc) {
        const gp = globalThis.getProperty ?? ((o, p) => p.split(".").reduce((a, k) => a?.[k], o));
        return gp(doc, "system.props") ?? {};
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
        // Minimal structural validation; keeps it flexible.
        for (const [nodeName, levels] of Object.entries(nodes)) {
            if (!levels || typeof levels !== "object" || Array.isArray(levels)) {
                throw new Error(`Node "${nodeName}" must be an object of levels.`);
            }

            for (const [lvl, reqs] of Object.entries(levels)) {
                if (lvl.startsWith("_")) continue; // allow metadata keys if you add them later

                if (!reqs || typeof reqs !== "object" || Array.isArray(reqs)) {
                    throw new Error(`Node "${nodeName}" level "${lvl}" must be an object of requirements.`);
                }

                const keyLowerSet = new Set(ALL_KEYS.map(k => k.toLowerCase()));

                for (const [reqName, reqLevel] of Object.entries(reqs)) {
                    if (!keyLowerSet.has(reqName.toLowerCase())) {
                        throw new Error(`Unknown key "${reqName}". Must be one of the defined Skills_/Stats_/Traits_.`);
                    }

                    const n = Number(reqLevel);
                    if (!Number.isFinite(n) || n < 0) {
                        throw new Error(
                            `Requirement "${nodeName}" level "${lvl}" -> "${reqName}" must be a number >= 0.`
                        );
                    }
                }

            }
        }
    }

    _collectKeySuggestions() {
        const sort = (a) => a.slice().sort((x, y) => x.localeCompare(y));
        return {
            skills: sort(SKILL_KEYS),
            stats: sort(STAT_KEYS),
            traits: sort(TRAIT_KEYS),
            all: sort(ALL_KEYS)
        };
    }

    _setDatalistOptions(html, list) {
        const dl = html.find("#skilltree-suggestions");
        dl.empty();
        for (const k of list) dl.append(`<option value="${k}"></option>`);
    }

    // ---------- FormApplication ----------
    async getData() {
        const json = await game.settings.get("skilltree-helper", "nodesJSON");
        this._suggestions = this._collectKeySuggestions();
        return { json, suggestions: this._suggestions.all };
    }


    activateListeners(html) {
        super.activateListeners(html);

        html.find("[data-action='validate']").on("click", () => this._onValidate(html));
        html.find("[data-action='reset']").on("click", () => this._onReset(html));
        html.find("[data-action='export']").on("click", () => this._onExport(html));
        html.find("[data-action='import']").on("click", () => this._onImport(html));
        html.find("[data-action='insertKey']").on("click", () => this._onInsertKey(html));

        html.find("select[name='helperFilter']").on("change", () => this._onFilterChange(html));
        html.find("input[name='importFile']").on("change", (ev) => this._onFileSelected(html, ev));

        // Initialize datalist for current filter (default "all")
        this._suggestions ??= this._collectKeySuggestions();
        const filter = html.find("select[name='helperFilter']").val() ?? "all";
        this._setDatalistOptions(html, this._suggestions[filter] ?? this._suggestions.all);
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
            ui.notifications.error("Default nodes not found (SkillTree.DEFAULT_NODES missing).");
            return;
        }
        html.find("textarea[name='json']").val(JSON.stringify(defaults, null, 2));
        ui.notifications.info("Reset to module default (not saved yet).");
    }

    async _onExport(html) {
        const raw = html.find("textarea[name='json']").val();
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
        const input = html.find("input[name='importFile']")[0];
        if (!input) {
            ui.notifications.error("Import input not found.");
            return;
        }
        input.value = ""; // allow selecting same file twice
        input.click();
    }

    async _onFileSelected(html, ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const nodes = this._parseJSON(text);
            this._basicValidateNodes(nodes);

            html.find("textarea[name='json']").val(JSON.stringify(nodes, null, 2));
            ui.notifications.info(`Imported "${file.name}" (not saved yet).`);
        } catch (e) {
            ui.notifications.error(e.message);
            console.error(e);
        } finally {
            ev.target.value = "";
        }
    }

    _onFilterChange(html) {
        this._suggestions ??= this._collectKeySuggestions();
        const filter = html.find("select[name='helperFilter']").val() ?? "all";
        const list =
            filter === "skills" ? this._suggestions.skills :
                filter === "stats" ? this._suggestions.stats :
                    filter === "traits" ? this._suggestions.traits :
                        this._suggestions.all;

        this._setDatalistOptions(html, list);
    }

    _onInsertKey(html) {
        const key = String(html.find("input[name='helperKey']").val() ?? "").trim();
        if (!key) return;

        if (!/^(skills_|stats_|trait_)/i.test(key)) {
            ui.notifications.warn("Key must start with Skills_, Stats_, or Trait_.");
            return;
        }

        const ta = html.find("textarea[name='json']")[0];
        if (!ta) return;

        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;

        // Insert as a quoted JSON key/token; user can add : 1 etc.
        const insert = `"${key}"`;

        ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end);
        ta.focus();

        const pos = start + insert.length;
        ta.setSelectionRange(pos, pos);
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
