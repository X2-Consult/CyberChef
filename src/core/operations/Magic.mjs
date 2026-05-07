/**
 * @author n1474335 [n1474335@gmail.com]
 * @copyright Crown Copyright 2016
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import Utils from "../Utils.mjs";
import Dish from "../Dish.mjs";
import MagicLib from "../lib/Magic.mjs";

/**
 * Magic operation
 */
class Magic extends Operation {

    /**
     * Magic constructor
     */
    constructor() {
        super();

        this.name = "Magic";
        this.flowControl = true;
        this.module = "Default";
        this.description = "The Magic operation attempts to detect various properties of the input data and suggests which operations could help to make more sense of it.<br><br><b>Options</b><br><u>Depth:</u> If an operation appears to match the data, it will be run and the result will be analysed further. This argument controls the maximum number of levels of recursion.<br><br><u>Intensive mode:</u> When this is turned on, various operations like XOR, bit rotates, and character encodings are brute-forced to attempt to detect valid data underneath. To improve performance, only the first 100 bytes of the data is brute-forced.<br><br><u>Extensive language support:</u> At each stage, the relative byte frequencies of the data will be compared to average frequencies for a number of languages. The default set consists of ~40 of the most commonly used languages on the Internet. The extensive list consists of 284 languages and can result in many languages matching the data if their byte frequencies are similar.<br><br>Optionally enter a regular expression to match a string you expect to find to filter results (crib).";
        this.infoURL = "https://github.com/gchq/CyberChef/wiki/Automatic-detection-of-encoded-data-using-CyberChef-Magic";
        this.inputType = "ArrayBuffer";
        this.outputType = "JSON";
        this.presentType = "html";
        this.args = [
            {
                "name": "Depth",
                "type": "number",
                "value": 3
            },
            {
                "name": "Intensive mode",
                "type": "boolean",
                "value": false
            },
            {
                "name": "Extensive language support",
                "type": "boolean",
                "value": false
            },
            {
                "name": "Crib (known plaintext string or regex)",
                "type": "string",
                "value": ""
            }
        ];
    }

    /**
     * @param {Object} state - The current state of the recipe.
     * @param {number} state.progress - The current position in the recipe.
     * @param {Dish} state.dish - The Dish being operated on.
     * @param {Operation[]} state.opList - The list of operations in the recipe.
     * @returns {Object} The updated state of the recipe.
     */
    async run(state) {
        const ings = state.opList[state.progress].ingValues,
            [depth, intensive, extLang, crib] = ings,
            dish = state.dish,
            magic = new MagicLib(await dish.get(Dish.ARRAY_BUFFER)),
            cribRegex = (crib && crib.length) ? new RegExp(crib, "i") : null;
        let options = await magic.speculativeExecution(depth, extLang, intensive, [], false, cribRegex);

        // Filter down to results which matched the crib
        if (cribRegex) {
            options = options.filter(option => option.matchesCrib);
        }

        // Record the current state for use when presenting
        this.state = state;

        dish.set(options, Dish.JSON);
        return state;
    }

    /**
     * Displays Magic results in HTML for web apps.
     *
     * @param {JSON} options
     * @returns {html}
     */
    present(options) {
        const currentRecipeConfig = this.state.opList.map(op => op.config);

        let output = `<style>
            .magic-signals { font-size: 0.82em; line-height: 1.7; }
            .magic-signals .sig-section { margin-bottom: 3px; }
            .magic-signals .sig-label { font-weight: 600; color: #888; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.04em; }
            .magic-pill { display: inline-block; border-radius: 3px; padding: 1px 6px; margin: 1px 2px; font-size: 0.82em; white-space: nowrap; cursor: default; }
            .pill-op       { background: #1a3a5c; color: #7ec8e3; border: 1px solid #2a5a8c; }
            .pill-lang     { background: #1a3d1a; color: #7de87d; border: 1px solid #2a6a2a; }
            .pill-file     { background: #3d2a00; color: #f0c060; border: 1px solid #7a5500; }
            .pill-utf8     { background: #1a1a3d; color: #a0a0f0; border: 1px solid #3a3a8c; }
            .pill-useful   { background: #3d1a3d; color: #e0a0e0; border: 1px solid #7a2a7a; }
            .entropy-bar   { display: inline-block; vertical-align: middle; width: 60px; height: 8px; border-radius: 2px; border: 1px solid #555; background: #222; margin-right: 4px; position: relative; overflow: hidden; }
            .entropy-fill  { height: 100%; border-radius: 1px; }
            .magic-reason  { font-size: 0.78em; color: #aaa; padding-left: 4px; font-style: italic; }
        </style>
        <table class='table table-hover table-sm table-bordered' style='table-layout: fixed;'>
            <tr>
                <th style='width:28%'>Recipe (click to load)</th>
                <th style='width:32%'>Result snippet</th>
                <th style='width:40%'>Detection signals</th>
            </tr>`;

        options.forEach(option => {
            // Replace this Magic op with the generated recipe
            const recipeConfig = currentRecipeConfig.slice(0, this.state.progress)
                    .concat(option.recipe)
                    .concat(currentRecipeConfig.slice(this.state.progress + 1)),
                recipeURL = "recipe=" + Utils.encodeURIFragment(Utils.generatePrettyRecipe(recipeConfig));

            // --- Detection triggers section ---
            // Deduplicate ops, preserving first set of reasons for each
            const seenOps = new Map();
            for (const op of option.matchingOps) {
                if (!seenOps.has(op.op)) seenOps.set(op.op, op.detectionReasons || []);
            }
            let triggersHtml = "";
            if (seenOps.size) {
                const pills = [...seenOps.entries()].map(([opName, reasons]) => {
                    const reasonTip = reasons.length
                        ? Utils.escapeHtml(reasons.join(" · "))
                        : "Matched operation check";
                    return `<span class='magic-pill pill-op' data-toggle='tooltip' data-container='body' title='${reasonTip}'>${Utils.escapeHtml(opName)}</span>`;
                }).join("");
                const reasonList = [...seenOps.values()].flat();
                const reasonHtml = reasonList.length
                    ? `<div class='magic-reason'>${Utils.escapeHtml(reasonList[0])}</div>`
                    : "";
                triggersHtml = `<div class='sig-section'><span class='sig-label'>Triggered by</span><br>${pills}${reasonHtml}</div>`;
            }

            // --- Output quality section ---
            let qualityPills = "";

            if (option.languageScores[0].probability > 0) {
                const likelyLangs = option.languageScores.filter(l => l.probability > 0);
                const langNames = (likelyLangs.length ? likelyLangs : [option.languageScores[0]])
                    .map(l => MagicLib.codeToLanguage(l.lang)).join(", ");
                qualityPills += `<span class='magic-pill pill-lang' data-toggle='tooltip' data-container='body' title='Byte frequency matches ${Utils.escapeHtml(langNames)} (chi-squared test)'>&#x1F310; ${Utils.escapeHtml(langNames)}</span>`;
            }

            if (option.fileType) {
                qualityPills += `<span class='magic-pill pill-file' data-toggle='tooltip' data-container='body' title='Magic bytes match ${Utils.escapeHtml(option.fileType.mime)}'>&#x1F4C4; ${Utils.escapeHtml(option.fileType.mime)} (.${Utils.escapeHtml(option.fileType.ext)})</span>`;
            }

            if (option.isUTF8) {
                qualityPills += `<span class='magic-pill pill-utf8' data-toggle='tooltip' data-container='body' title='Data is valid UTF-8'>UTF-8 &#x2713;</span>`;
            }

            if (option.useful) {
                qualityPills += `<span class='magic-pill pill-useful' data-toggle='tooltip' data-container='body' title='Contains an operation that renders data usefully, e.g. an image viewer'>&#x2728; Useful op</span>`;
            }

            const qualityHtml = qualityPills
                ? `<div class='sig-section'><span class='sig-label'>Output quality</span><br>${qualityPills}</div>`
                : "";

            // --- Entropy bar ---
            const e = option.entropy;
            const ePercent = Math.min(100, (e / 8) * 100).toFixed(1);
            const eColour = e < 3 ? "#4caf50" : e < 5 ? "#ff9800" : "#f44336";
            const eLabel = e < 3 ? "low — text-like" : e < 5 ? "medium — encoded" : "high — compressed/encrypted";
            const entropyHtml = `<div class='sig-section'><span class='sig-label'>Entropy</span><br>` +
                `<span class='entropy-bar' data-toggle='tooltip' data-container='body' title='Shannon entropy: ${e.toFixed(2)}/8 — ${eLabel}'>` +
                `<span class='entropy-fill' style='width:${ePercent}%;background:${eColour}'></span></span>` +
                `<span style='color:${eColour}'>${e.toFixed(2)}</span> <span style='color:#888;font-size:0.8em'>${eLabel}</span></div>`;

            output += `<tr>
                <td><a href="#${recipeURL}">${Utils.generatePrettyRecipe(option.recipe, true)}</a></td>
                <td>${Utils.escapeHtml(Utils.escapeWhitespace(Utils.truncate(option.data, 99)))}</td>
                <td><div class='magic-signals'>${triggersHtml}${qualityHtml}${entropyHtml}</div></td>
            </tr>`;
        });

        output += "</table><script type='application/javascript'>$('[data-toggle=\"tooltip\"]').tooltip()</script>";

        if (!options.length) {
            output = "Nothing of interest could be detected about the input data.\nHave you tried modifying the operation arguments?";
        }

        return output;
    }

}

export default Magic;
